import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const shipment = await prisma.shipment.findUnique({
    where: { id: params.id },
    include: {
      receipts: {
        orderBy: { createdAt: "asc" },
        include: { items: { orderBy: { sortOrder: "asc" } } },
      },
    },
  });
  if (!shipment) {
    return NextResponse.json({ error: "사입 건을 찾을 수 없습니다." }, { status: 404 });
  }
  return NextResponse.json(shipment);
}
