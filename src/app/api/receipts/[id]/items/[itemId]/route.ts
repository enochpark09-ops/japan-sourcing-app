import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import type { ReceiptItem } from "@prisma/client";

// 품목 한글명 수정 + 컨펌 처리.
// 사입 서류(패킹리스트/송장 등)에는 confirmed=true 인 품목만 사용됩니다.
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string; itemId: string } }
) {
  const body = await req.json();

  const item = await prisma.receiptItem.findFirst({
    where: { id: params.itemId, receiptId: params.id },
  });
  if (!item) {
    return NextResponse.json({ error: "품목을 찾을 수 없습니다." }, { status: 404 });
  }

  const data: {
    nameKoFinal?: string;
    quantity?: number;
    unitPrice?: number;
    amount?: number;
    hsCode?: string | null;
    confirmed?: boolean;
  } = {};

  if (typeof body.nameKoFinal === "string") data.nameKoFinal = body.nameKoFinal.trim();
  if (typeof body.quantity === "number") data.quantity = body.quantity;
  if (typeof body.unitPrice === "number") data.unitPrice = body.unitPrice;
  if (typeof body.amount === "number") data.amount = body.amount;
  if (typeof body.hsCode === "string") data.hsCode = body.hsCode;
  if (typeof body.confirmed === "boolean") {
    // 컨펌하려면 한글 품목명이 비어있으면 안 됨 (초안이라도 있어야 함)
    if (body.confirmed) {
      const finalName = data.nameKoFinal ?? item.nameKoFinal ?? item.nameKoDraft;
      if (!finalName || !finalName.trim()) {
        return NextResponse.json(
          { error: "한글 품목명을 확인/입력한 뒤 컨펌해주세요." },
          { status: 400 }
        );
      }
      if (data.nameKoFinal === undefined) data.nameKoFinal = finalName;
    }
    data.confirmed = body.confirmed;
  }

  const updated = await prisma.receiptItem.update({
    where: { id: item.id },
    data,
  });

  // 영수증에 속한 모든 품목이 컨펌되었으면 영수증 상태도 confirmed로 갱신
  const siblings = await prisma.receiptItem.findMany({ where: { receiptId: params.id } });
  const allConfirmed = siblings.length > 0 && siblings.every((it: ReceiptItem) => it.confirmed);
  await prisma.receipt.update({
    where: { id: params.id },
    data: { status: allConfirmed ? "confirmed" : "pending" },
  });

  return NextResponse.json(updated);
}

// 품목 삭제. 잘못 인식된 줄(상품이 아닌데 품목으로 잡힌 경우 등)을 지울 때 사용합니다.
export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string; itemId: string } }
) {
  const item = await prisma.receiptItem.findFirst({
    where: { id: params.itemId, receiptId: params.id },
  });
  if (!item) {
    return NextResponse.json({ error: "품목을 찾을 수 없습니다." }, { status: 404 });
  }

  await prisma.receiptItem.delete({ where: { id: item.id } });

  // 삭제 후 남은 품목 기준으로 영수증 컨펌 상태 다시 계산
  const siblings = await prisma.receiptItem.findMany({ where: { receiptId: params.id } });
  const allConfirmed = siblings.length > 0 && siblings.every((it: ReceiptItem) => it.confirmed);
  await prisma.receipt.update({
    where: { id: params.id },
    data: { status: allConfirmed ? "confirmed" : "pending" },
  });

  return NextResponse.json({ success: true });
}
