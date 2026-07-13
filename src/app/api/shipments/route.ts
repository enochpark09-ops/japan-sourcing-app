import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const shipments = await prisma.shipment.findMany({
    orderBy: { createdAt: "desc" },
    include: { receipts: { include: { items: true } } },
  });
  return NextResponse.json(shipments);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const name = (body?.name || "").trim();
  if (!name) {
    return NextResponse.json({ error: "사입 건 이름을 입력해주세요." }, { status: 400 });
  }
  const shipment = await prisma.shipment.create({
    data: { name, memo: body?.memo || null },
  });
  return NextResponse.json(shipment);
}
