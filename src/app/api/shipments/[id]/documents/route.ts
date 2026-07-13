import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  buildPackingList,
  buildCommercialInvoice,
  buildSimplifiedCustomsList,
  DocItem,
} from "@/lib/documents";
import type { Receipt, ReceiptItem } from "@prisma/client";

type ReceiptWithItems = Receipt & { items: ReceiptItem[] };

export const runtime = "nodejs";

const FILE_NAMES: Record<string, string> = {
  "packing-list": "packing-list",
  invoice: "commercial-invoice",
  customs: "customs-list",
};

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const type = req.nextUrl.searchParams.get("type") || "packing-list";

  const shipment = await prisma.shipment.findUnique({
    where: { id: params.id },
    include: { receipts: { include: { items: true } } },
  });
  if (!shipment) {
    return NextResponse.json({ error: "사입 건을 찾을 수 없습니다." }, { status: 404 });
  }

  const receipts = shipment.receipts as ReceiptWithItems[];
  const confirmedItems = receipts
    .flatMap((r: ReceiptWithItems) => r.items)
    .filter((i: ReceiptItem) => i.confirmed);

  if (confirmedItems.length === 0) {
    return NextResponse.json(
      { error: "컨펌된 품목이 없습니다. 서류 생성 전에 품목을 확인/컨펌해주세요." },
      { status: 400 }
    );
  }

  const docItems: DocItem[] = confirmedItems.map((item: ReceiptItem, idx: number) => ({
    no: idx + 1,
    nameKo: item.nameKoFinal || item.nameKoDraft,
    nameJa: item.nameJa,
    quantity: item.quantity,
    unitPrice: Number(item.unitPrice),
    amount: Number(item.amount),
    hsCode: item.hsCode,
  }));

  const shipmentInfo = { name: shipment.name, createdAt: shipment.createdAt };

  let buffer;
  if (type === "packing-list") {
    buffer = await buildPackingList(shipmentInfo, docItems);
  } else if (type === "invoice") {
    buffer = await buildCommercialInvoice(shipmentInfo, docItems);
  } else if (type === "customs") {
    buffer = await buildSimplifiedCustomsList(shipmentInfo, docItems);
  } else {
    return NextResponse.json({ error: "알 수 없는 서류 종류입니다." }, { status: 400 });
  }

  const filename = `${FILE_NAMES[type]}-${shipment.name}.xlsx`;

  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${encodeURIComponent(filename)}"`,
    },
  });
}
