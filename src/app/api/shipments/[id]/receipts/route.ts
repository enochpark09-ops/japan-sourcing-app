import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { extractReceiptItems } from "@/lib/claude";
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
  const mediaType = file.type || "image/jpeg";

  // 1) 이미지 업로드 (Vercel Blob) — 실패해도 품목 인식은 계속 진행
  let imageUrl = "";
  try {
    imageUrl = await uploadReceiptImage(buffer, file.name || "receipt.jpg", mediaType);
  } catch (e) {
    console.error("이미지 업로드 실패:", e);
  }

  // 2) Claude Vision으로 품목 인식 + 한글 번역 초안을 한 번에 생성
  let extracted;
  try {
    extracted = await extractReceiptItems(base64, mediaType);
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "품목 인식 중 오류가 발생했습니다.";
    return NextResponse.json({ error: message }, { status: 502 });
  }

  const receipt = await prisma.receipt.create({
    data: {
      shipmentId: shipment.id,
      imageUrl,
      rawText: null,
      status: "pending",
      items: {
        create: extracted.map((item, idx) => ({
          nameJa: item.nameJa,
          nameKoDraft: item.nameKo || "",
          nameKoFinal: null,
          quantity: item.quantity || 1,
          unitPrice: item.unitPrice || 0,
          amount: item.amount || 0,
          confirmed: false,
          sortOrder: idx,
        })),
      },
    },
    include: { items: { orderBy: { sortOrder: "asc" } } },
  });

  return NextResponse.json(receipt);
}
