import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { extractReceiptItems } from "@/lib/claude";
import type { ReceiptItem } from "@prisma/client";

export const runtime = "nodejs";
export const maxDuration = 60;

// 이미 업로드된 영수증을 다시 인식합니다. (예: 부가세 처리 로직이 업데이트된 경우
// 예전에 올린 영수증에도 새 로직을 적용하고 싶을 때 사용)
// 이미 저장된 이미지(Blob URL)를 다시 불러와 Claude로 재추출하고,
// 기존 품목 초안을 새 결과로 교체합니다.
// 안전장치: 이 영수증의 품목 중 하나라도 이미 "컨펌"되었으면 재분석을 막습니다.
// (사용자가 직접 확인/수정한 데이터를 실수로 덮어쓰지 않기 위함)
export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const receipt = await prisma.receipt.findUnique({
    where: { id: params.id },
    include: { items: true },
  });
  if (!receipt) {
    return NextResponse.json({ error: "영수증을 찾을 수 없습니다." }, { status: 404 });
  }
  if (!receipt.imageUrl) {
    return NextResponse.json(
      { error: "원본 이미지가 없어 재분석할 수 없습니다." },
      { status: 400 }
    );
  }

  const hasConfirmed = receipt.items.some((it: ReceiptItem) => it.confirmed);
  if (hasConfirmed) {
    return NextResponse.json(
      {
        error:
          "이미 컨펌된 품목이 있어 재분석할 수 없습니다. 컨펌된 품목은 '수정' 버튼으로 컨펌 해제한 뒤 다시 시도해주세요.",
      },
      { status: 400 }
    );
  }

  // 저장된 이미지를 다시 불러와 base64로 변환
  let base64: string;
  let mediaType: string;
  try {
    const imgRes = await fetch(receipt.imageUrl);
    if (!imgRes.ok) {
      throw new Error(`이미지 다운로드 실패 (${imgRes.status})`);
    }
    mediaType = imgRes.headers.get("content-type") || "image/jpeg";
    const arrayBuffer = await imgRes.arrayBuffer();
    base64 = Buffer.from(arrayBuffer).toString("base64");
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "이미지를 불러오지 못했습니다.";
    return NextResponse.json({ error: message }, { status: 502 });
  }

  let extracted;
  try {
    extracted = await extractReceiptItems(base64, mediaType);
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "품목 인식 중 오류가 발생했습니다.";
    return NextResponse.json({ error: message }, { status: 502 });
  }

  // 기존 초안 품목을 지우고 새 추출 결과로 교체
  await prisma.receiptItem.deleteMany({ where: { receiptId: receipt.id } });

  const updated = await prisma.receipt.update({
    where: { id: receipt.id },
    data: {
      status: "pending",
      items: {
        create: extracted.map((item, idx) => ({
          nameJa: item.nameJa,
          nameKoDraft: item.nameKo || "",
          nameKoFinal: null,
          nameEn: item.nameEn || null,
          brand: item.brand || null,
          colorEn: item.colorEn || null,
          size: item.size || null,
          hsCode: item.hsCode || null,
          declarationKo: item.declarationKo || null,
          declarationEn: item.declarationEn || null,
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

  return NextResponse.json(updated);
}
