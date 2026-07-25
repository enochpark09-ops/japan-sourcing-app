import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { buildReceiptItemList } from "@/lib/documents";
import type { ReceiptItem } from "@prisma/client";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// 영수증 한 장의 품목을 그대로(컨펌 여부와 무관하게) 엑셀로 내보냅니다.
// label은 화면에서 계산한 "{사입건이름}-{영수증순번}" 형태의 문자열을 쿼리로 받아
// 시트 첫 번째 열과 파일명에 그대로 사용합니다.
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const label = req.nextUrl.searchParams.get("label") || "영수증";

  const receipt = await prisma.receipt.findUnique({
    where: { id: params.id },
    include: { items: { orderBy: { sortOrder: "asc" } } },
  });
  if (!receipt) {
    return NextResponse.json({ error: "영수증을 찾을 수 없습니다." }, { status: 404 });
  }
  if (receipt.items.length === 0) {
    return NextResponse.json({ error: "인식된 품목이 없습니다." }, { status: 400 });
  }

  const items = receipt.items.map((item: ReceiptItem) => ({
    nameJa: item.nameJa,
    nameKo: item.nameKoFinal || item.nameKoDraft,
    quantity: item.quantity,
    unitPrice: Number(item.unitPrice),
    amount: Number(item.amount),
  }));

  const buffer = await buildReceiptItemList(label, items);

  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${encodeURIComponent(label)}.xlsx"`,
      "Cache-Control": "no-store, max-age=0",
    },
  });
}
