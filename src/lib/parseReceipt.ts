// 일본 영수증 OCR 원문 텍스트에서 품목 라인을 추출하는 휴리스틱 파서.
// 일본 영수증 포맷이 매장마다 제각각이라 100% 정확한 파싱은 불가능합니다.
// 그래서 이 결과는 항상 "초안"이며, 화면에서 사용자가 품목명/수량/금액을 직접
// 확인하고 수정(컨펌)한 뒤에만 최종 서류 생성에 사용됩니다.

export interface ParsedLine {
  nameJa: string;
  quantity: number;
  unitPrice: number;
  amount: number;
}

const SKIP_KEYWORDS = [
  "小計",
  "合計",
  "計",
  "税",
  "消費税",
  "お預り",
  "お預かり",
  "預り",
  "おつり",
  "お釣り",
  "釣り",
  "現金",
  "カード",
  "クレジット",
  "point",
  "ポイント",
  "点数",
  "領収書",
  "レシート",
  "様",
  "ありがとう",
  "レジ",
  "担当",
  "電話",
  "TEL",
  "登録番号",
];

// 금액 패턴: ¥1,200 / 1,200円 / 1200 등
const PRICE_RE = /(?:¥\s?)?([\d,]{2,})\s?(?:円)?\s*$/;
// 수량 패턴: ×2, x2, 2個, 2点
const QTY_RE = /[×x]\s?(\d+)|(\d+)\s?[個点]/;

export function parseReceiptText(rawText: string): ParsedLine[] {
  const lines = rawText
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  const results: ParsedLine[] = [];

  for (const line of lines) {
    if (SKIP_KEYWORDS.some((kw) => line.includes(kw))) continue;

    const priceMatch = line.match(PRICE_RE);
    if (!priceMatch) continue;

    const amount = parseInt(priceMatch[1].replace(/,/g, ""), 10);
    if (!amount || amount <= 0) continue;

    let name = line.slice(0, priceMatch.index).trim();
    // 품목명 끝에 남은 구분기호 정리
    name = name.replace(/[\-\.\s]+$/, "").trim();
    if (!name || name.length < 1) continue;
    // 순수 숫자/기호로만 이루어진 줄(바코드 등)은 제외
    if (/^[\d\s\-]+$/.test(name)) continue;

    const qtyMatch = line.match(QTY_RE);
    const quantity = qtyMatch ? parseInt(qtyMatch[1] || qtyMatch[2], 10) : 1;

    const unitPrice = quantity > 0 ? Math.round((amount / quantity) * 100) / 100 : amount;

    results.push({ nameJa: name, quantity: quantity || 1, unitPrice, amount });
  }

  return results;
}
