import ExcelJS from "exceljs";

export interface DocItem {
  no: number;
  nameKo: string;
  nameJa: string;
  nameEn?: string | null;
  brand?: string | null;
  colorEn?: string | null;
  size?: string | null;
  quantity: number;
  unitPrice: number;
  amount: number;
  hsCode?: string | null;
  declarationKo?: string | null;
  declarationEn?: string | null;
}

export interface ShipmentInfo {
  name: string;
  createdAt: Date;
}

// 배송대행 신청서에 고정으로 들어가는 수취인/발송 정보.
// 사입 건마다 바뀌지 않는 값이라 여기에 고정해뒀습니다. 정보가 바뀌면 이 값만 수정하면 됩니다.
const RECIPIENT_INFO = {
  usageType: 2, // 사용구분 (1:개인 / 2:사업자)
  recipient: "Double Y Studio", // 수취인
  phone1: "82-10-9189-5056", // 연락처1
  customsCode: "더블와이5251018", // 개인통관부호 / 사업자등록번호
  postalCode: 13601, // 우편번호
  address:
    "Balibong-ro 11beon-gil, Bundang-gu, Seongnam-si, Gyeonggi-do, Republic of Korea", // 주소
  addressDetail: "5-1, 202", // 상세주소
};

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
  cell.alignment = { wrapText: true, vertical: "middle" };
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

// 4) 배송대행 신청서 --------------------------------------------------
// 배송대행업체 제출용 서식. 수취인 정보(사용구분/수취인/연락처1/개인통관부호/우편번호/주소/상세주소)는
// 항상 같은 값이라 RECIPIENT_INFO에 고정해뒀습니다.
// 현지주문번호(J)/상세url(K)/옵션4(R)는 사입 건마다 달라서 빈 칸으로 남겨두니 다운로드 후 채워주세요.
// 브랜드/영어명/색상/사이즈/HS코드/신고설명은 Claude가 영수증 정보를 바탕으로 추정한 초안입니다.
// 영수증에는 보통 안 나오는 정보라 제출 전 반드시 확인해주세요.
export async function buildForwardingRequest(
  shipment: ShipmentInfo,
  items: DocItem[]
): Promise<ExcelJS.Buffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("배송대행신청");

  ws.mergeCells("A1:U1");
  ws.getCell("A1").value = `배송대행 신청 정보 — ${shipment.name}`;
  ws.getCell("A1").font = { bold: true, size: 13 };

  ws.mergeCells("V1:W1");
  ws.getCell("V1").value = "신고 설명 (세관용)";
  ws.getCell("V1").font = { bold: true, size: 13 };

  const headers = [
    "사용구분*\n(1:개인/2:사업자)",
    "수취인*",
    "연락처1*",
    "연락처2",
    "개인통관부호\n/사업자등록번호*",
    "우편번호*",
    "주소*",
    "상세주소",
    "배송메시지",
    "현지주문번호*",
    "상세url*",
    "브랜드*",
    "상품명(영어)*",
    "상품명(한글)",
    "품목번호(HS)*",
    "색상(영문)",
    "사이즈",
    "옵션4",
    "수량*",
    "단가(엔화)*",
    "세금포함여부",
    "신고설명(한글)",
    "신고설명(영어)",
  ];
  const headerRow = ws.getRow(2);
  headers.forEach((h, i) => {
    const cell = headerRow.getCell(i + 1);
    cell.value = h;
    headerStyle(cell);
  });

  let totalQty = 0;
  let totalAmount = 0;
  let rowIdx = 3;
  for (const item of items) {
    const row = ws.getRow(rowIdx);
    row.getCell(1).value = RECIPIENT_INFO.usageType;
    row.getCell(2).value = RECIPIENT_INFO.recipient;
    row.getCell(3).value = RECIPIENT_INFO.phone1;
    row.getCell(4).value = "";
    row.getCell(5).value = RECIPIENT_INFO.customsCode;
    row.getCell(6).value = RECIPIENT_INFO.postalCode;
    row.getCell(7).value = RECIPIENT_INFO.address;
    row.getCell(8).value = RECIPIENT_INFO.addressDetail;
    row.getCell(9).value = "";
    row.getCell(10).value = ""; // 현지주문번호 - 사입 건마다 다름, 수동 입력
    row.getCell(11).value = ""; // 상세url - 수동 입력
    row.getCell(12).value = item.brand || "";
    row.getCell(13).value = item.nameEn || "";
    row.getCell(14).value = item.nameKo;
    row.getCell(15).value = item.hsCode || "";
    row.getCell(16).value = item.colorEn || "";
    row.getCell(17).value = item.size || "";
    row.getCell(18).value = ""; // 옵션4
    row.getCell(19).value = item.quantity;
    row.getCell(20).value = item.unitPrice;
    row.getCell(21).value = "포함";
    row.getCell(22).value = item.declarationKo || "";
    row.getCell(23).value = item.declarationEn || "";
    for (let c = 1; c <= 23; c++) cellBorder(row.getCell(c));
    totalQty += item.quantity;
    totalAmount += item.amount;
    rowIdx++;
  }

  ws.mergeCells(`A${rowIdx}:R${rowIdx}`);
  ws.getCell(`A${rowIdx}`).value = "합계";
  ws.getCell(`A${rowIdx}`).font = { bold: true };
  ws.getCell(`S${rowIdx}`).value = totalQty;
  ws.getCell(`S${rowIdx}`).font = { bold: true };
  ws.getCell(`T${rowIdx}`).value = totalAmount;
  ws.getCell(`T${rowIdx}`).font = { bold: true };
  ws.mergeCells(`V${rowIdx}:W${rowIdx}`);
  ws.getCell(`V${rowIdx}`).value = `총 ${items.length}개 품목 / ${totalQty}개 / ¥${totalAmount.toLocaleString()}`;

  ws.columns = [
    { width: 10 }, // A 사용구분
    { width: 16 }, // B 수취인
    { width: 16 }, // C 연락처1
    { width: 12 }, // D 연락처2
    { width: 16 }, // E 개인통관부호
    { width: 10 }, // F 우편번호
    { width: 30 }, // G 주소
    { width: 14 }, // H 상세주소
    { width: 12 }, // I 배송메시지
    { width: 14 }, // J 현지주문번호
    { width: 14 }, // K 상세url
    { width: 16 }, // L 브랜드
    { width: 26 }, // M 상품명(영어)
    { width: 20 }, // N 상품명(한글)
    { width: 12 }, // O 품목번호(HS)
    { width: 14 }, // P 색상(영문)
    { width: 10 }, // Q 사이즈
    { width: 10 }, // R 옵션4
    { width: 8 },  // S 수량
    { width: 12 }, // T 단가
    { width: 10 }, // U 세금포함여부
    { width: 34 }, // V 신고설명(한글)
    { width: 34 }, // W 신고설명(영어)
  ];

  return wb.xlsx.writeBuffer();
}

// 5) 영수증 1장 단위 품목 리스트 (컨펌 여부와 무관하게 해당 영수증의 품목을 그대로 내보냄) --
// 사입 건 전체가 아니라 영수증 카드 하나를 그대로 엑셀로 옮기고 싶을 때 사용합니다.
export interface ReceiptExportItem {
  nameJa: string;
  nameKo: string;
  quantity: number;
  unitPrice: number;
  amount: number;
}

export async function buildReceiptItemList(
  label: string,
  items: ReceiptExportItem[]
): Promise<ExcelJS.Buffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("영수증 품목");

  const headers = ["영수증 품목", "원문(일본어)", "한글 품목명", "수량", "단가(¥)", "금액(¥)"];
  const headerRow = ws.getRow(1);
  headers.forEach((h, i) => {
    const cell = headerRow.getCell(i + 1);
    cell.value = h;
    headerStyle(cell);
  });

  let total = 0;
  let rowIdx = 2;
  for (const item of items) {
    const row = ws.getRow(rowIdx);
    row.getCell(1).value = label;
    row.getCell(1).font = { bold: true };
    row.getCell(2).value = item.nameJa;
    row.getCell(3).value = item.nameKo;
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
    { width: 14 },
    { width: 26 },
    { width: 26 },
    { width: 8 },
    { width: 12 },
    { width: 12 },
  ];

  return wb.xlsx.writeBuffer();
}
