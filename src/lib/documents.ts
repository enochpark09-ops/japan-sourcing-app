import ExcelJS from "exceljs";

export interface DocItem {
  no: number;
  nameKo: string;
  nameJa: string;
  quantity: number;
  unitPrice: number;
  amount: number;
  hsCode?: string | null;
}

export interface ShipmentInfo {
  name: string;
  createdAt: Date;
}

function headerStyle(cell: ExcelJS.Cell) {
  cell.font = { bold: true };
  cell.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFE5E7EB" },
  };
  cell.border = {
    top: { style: "thin" },
    bottom: { style: "thin" },
    left: { style: "thin" },
    right: { style: "thin" },
  };
}

function cellBorder(cell: ExcelJS.Cell) {
  cell.border = {
    top: { style: "thin" },
    bottom: { style: "thin" },
    left: { style: "thin" },
    right: { style: "thin" },
  };
}

// 1) 패킹리스트 (Packing List) -----------------------------------------
export async function buildPackingList(
  shipment: ShipmentInfo,
  items: DocItem[]
): Promise<ExcelJS.Buffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Packing List");

  ws.mergeCells("A1:F1");
  ws.getCell("A1").value = `PACKING LIST - ${shipment.name}`;
  ws.getCell("A1").font = { bold: true, size: 14 };

  ws.getCell("A2").value = `작성일 / Date: ${shipment.createdAt.toISOString().slice(0, 10)}`;

  const headerRow = ws.getRow(4);
  const headers = ["No", "품목명(한글)", "품목명(일본어)", "수량", "단가(¥)", "금액(¥)"];
  headers.forEach((h, i) => {
    const cell = headerRow.getCell(i + 1);
    cell.value = h;
    headerStyle(cell);
  });

  let total = 0;
  let rowIdx = 5;
  for (const item of items) {
    const row = ws.getRow(rowIdx);
    row.getCell(1).value = item.no;
    row.getCell(2).value = item.nameKo;
    row.getCell(3).value = item.nameJa;
    row.getCell(4).value = item.quantity;
    row.getCell(5).value = item.unitPrice;
    row.getCell(6).value = item.amount;
    for (let c = 1; c <= 6; c++) cellBorder(row.getCell(c));
    total += item.amount;
    rowIdx++;
  }

  const totalRow = ws.getRow(rowIdx);
  totalRow.getCell(5).value = "합계";
  totalRow.getCell(5).font = { bold: true };
  totalRow.getCell(6).value = total;
  totalRow.getCell(6).font = { bold: true };

  ws.columns = [
    { width: 6 },
    { width: 28 },
    { width: 28 },
    { width: 8 },
    { width: 12 },
    { width: 14 },
  ];

  return wb.xlsx.writeBuffer();
}

// 2) 상업송장 (Commercial Invoice) --------------------------------------
export async function buildCommercialInvoice(
  shipment: ShipmentInfo,
  items: DocItem[]
): Promise<ExcelJS.Buffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Commercial Invoice");

  ws.mergeCells("A1:G1");
  ws.getCell("A1").value = `COMMERCIAL INVOICE - ${shipment.name}`;
  ws.getCell("A1").font = { bold: true, size: 14 };

  ws.getCell("A2").value = "Invoice Date:";
  ws.getCell("B2").value = shipment.createdAt.toISOString().slice(0, 10);
  ws.getCell("A3").value = "Country of Origin:";
  ws.getCell("B3").value = "Japan";

  const headerRow = ws.getRow(5);
  const headers = ["No", "Item (KO/JA)", "HS Code", "Qty", "Unit Price (JPY)", "Amount (JPY)", "Origin"];
  headers.forEach((h, i) => {
    const cell = headerRow.getCell(i + 1);
    cell.value = h;
    headerStyle(cell);
  });

  let total = 0;
  let rowIdx = 6;
  for (const item of items) {
    const row = ws.getRow(rowIdx);
    row.getCell(1).value = item.no;
    row.getCell(2).value = `${item.nameKo} / ${item.nameJa}`;
    row.getCell(3).value = item.hsCode || "";
    row.getCell(4).value = item.quantity;
    row.getCell(5).value = item.unitPrice;
    row.getCell(6).value = item.amount;
    row.getCell(7).value = "Japan";
    for (let c = 1; c <= 7; c++) cellBorder(row.getCell(c));
    total += item.amount;
    rowIdx++;
  }

  const totalRow = ws.getRow(rowIdx);
  totalRow.getCell(5).value = "TOTAL";
  totalRow.getCell(5).font = { bold: true };
  totalRow.getCell(6).value = total;
  totalRow.getCell(6).font = { bold: true };

  ws.columns = [
    { width: 6 },
    { width: 32 },
    { width: 12 },
    { width: 8 },
    { width: 16 },
    { width: 16 },
    { width: 10 },
  ];

  return wb.xlsx.writeBuffer();
}

// 3) 목록통관용 간이서류 ----------------------------------------------
// 주의: 이 서류는 관세청 정식 신고 서식이 아니라, 특송업체/관세사에게 전달하기 위한
// 참고용 간이 목록입니다. 실제 목록통관 신청은 특급탁송업체 또는 관세사를 통해
// 진행해야 하며, 개인통관고유부호 등 추가 정보가 필요할 수 있습니다.
export async function buildSimplifiedCustomsList(
  shipment: ShipmentInfo,
  items: DocItem[]
): Promise<ExcelJS.Buffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("목록통관용 간이서류");

  ws.mergeCells("A1:F1");
  ws.getCell("A1").value = `목록통관용 간이서류 - ${shipment.name}`;
  ws.getCell("A1").font = { bold: true, size: 14 };

  ws.getCell("A2").value =
    "※ 참고용 서류입니다. 실제 목록통관 신청은 특송업체/관세사를 통해 진행하세요.";
  ws.getCell("A2").font = { italic: true, color: { argb: "FF888888" } };

  ws.getCell("A4").value = "발송인(구매처):";
  ws.getCell("B4").value = "";
  ws.getCell("A5").value = "수취인:";
  ws.getCell("B5").value = "";
  ws.getCell("A6").value = "개인통관고유부호:";
  ws.getCell("B6").value = "";

  const headerRow = ws.getRow(8);
  const headers = ["No", "품목명(한글)", "품목명(일본어)", "수량", "단가(¥)", "금액(¥)"];
  headers.forEach((h, i) => {
    const cell = headerRow.getCell(i + 1);
    cell.value = h;
    headerStyle(cell);
  });

  let total = 0;
  let rowIdx = 9;
  for (const item of items) {
    const row = ws.getRow(rowIdx);
    row.getCell(1).value = item.no;
    row.getCell(2).value = item.nameKo;
    row.getCell(3).value = item.nameJa;
    row.getCell(4).value = item.quantity;
    row.getCell(5).value = item.unitPrice;
    row.getCell(6).value = item.amount;
    for (let c = 1; c <= 6; c++) cellBorder(row.getCell(c));
    total += item.amount;
    rowIdx++;
  }

  const totalRow = ws.getRow(rowIdx);
  totalRow.getCell(5).value = "총액";
  totalRow.getCell(5).font = { bold: true };
  totalRow.getCell(6).value = total;
  totalRow.getCell(6).font = { bold: true };

  ws.columns = [
    { width: 6 },
    { width: 28 },
    { width: 28 },
    { width: 8 },
    { width: 12 },
    { width: 14 },
  ];

  return wb.xlsx.writeBuffer();
}
