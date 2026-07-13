import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { runOcr } from "@/lib/vision";
import { translateJaToKo } from "@/lib/translate";
import { parseReceiptText } from "@/lib/parseReceipt";
import { uploadReceiptImage } from "@/lib/blob";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const shipment = await prisma.shipment.findUnique({ where: { id: params.id } });
  if (!shipment) {
    return NextResponse.json({ error: "사입 건을 찾을 수 없습니다." }, { status: 404 });
  }

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  if (!file) {
    return NextResponse.json({ error: "이미지 파일이 없습니다." }, { status: 400 });
  }

  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const base64 = buffer.toString("base64");

  // 1) 이미지 업로드 (Vercel Blob) — 실패해도 OCR은 계속 진행
  let imageUrl = "";
  try {
    imageUrl = await uploadReceiptImage(buffer, file.name || "receipt.jpg", file.type || "image/jpeg");
  } catch (e) {
    console.error("이미지 업로드 실패:", e);
  }

  // 2) OCR
  let rawText = "";
  try {
    rawText = await runOcr(base64);
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "OCR 처리 중 오류가 발생했습니다.";
    return NextResponse.json({ error: message }, { status: 502 });
  }

  // 3) 라인 파싱 (초안)
  const parsedLines = parseReceiptText(rawText);

  // 4) 일→한 번역 (품목명 초안, 사용자 컨펌 전까지는 draft로만 사용)
  let translations: string[] = [];
  try {
    translations =
      parsedLines.length > 0
        ? await translateJaToKo(parsedLines.map((l) => l.nameJa))
        : [];
  } catch (e) {
    console.error("번역 실패:", e);
    translations = parsedLines.map(() => "");
  }

  const receipt = await prisma.receipt.create({
    data: {
      shipmentId: shipment.id,
      imageUrl,
      rawText,
      status: "pending",
      items: {
        create: parsedLines.map((line, idx) => ({
          nameJa: line.nameJa,
          nameKoDraft: translations[idx] || "",
          nameKoFinal: null,
          quantity: line.quantity,
          unitPrice: line.unitPrice,
          amount: line.amount,
          confirmed: false,
          sortOrder: idx,
        })),
      },
    },
    include: { items: { orderBy: { sortOrder: "asc" } } },
  });

  return NextResponse.json(receipt);
}
