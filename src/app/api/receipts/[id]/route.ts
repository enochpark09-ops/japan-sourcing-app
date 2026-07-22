import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { deleteReceiptImage } from "@/lib/blob";

// 영수증 한 장(사진 + 인식된 품목 전체) 삭제.
// 잘못 업로드했거나 중복으로 올린 영수증을 지울 때 사용합니다.
// 품목은 schema의 onDelete: Cascade로 함께 삭제됩니다.
export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const receipt = await prisma.receipt.findUnique({ where: { id: params.id } });
  if (!receipt) {
    return NextResponse.json({ error: "영수증을 찾을 수 없습니다." }, { status: 404 });
  }

  try {
    await deleteReceiptImage(receipt.imageUrl);
  } catch (e) {
    console.error("영수증 이미지 삭제 실패(무시하고 계속 진행):", e);
  }

  await prisma.receipt.delete({ where: { id: params.id } });

  return NextResponse.json({ success: true });
}
