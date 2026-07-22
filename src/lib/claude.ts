// Claude API(비전 + 도구 사용)를 이용해 영수증 사진에서 구매 품목을 한 번에 추출합니다.
// - OCR과 일→한 번역을 별도 서비스 없이 한 번의 호출로 처리합니다.
// - tool_choice로 JSON 스키마를 강제해 결과 형식을 안정적으로 받습니다.
// - 배송대행 신청서(관세 신고용) 다운로드에 필요한 부가 정보(영문명/브랜드/색상/사이즈/HS코드/
//   신고설명)도 함께 추정해서 반환합니다. 영수증에는 보통 안 나오는 정보라 어디까지나 "초안"이며,
//   실제 신고 전에 반드시 사람이 확인해야 합니다.
//
// [합계 단계 조정(할인/세금 추가) 계산 방식]
// 예전에는 "품목별 금액에 비율을 곱해서 반환해줘" 라고 모델에게 직접 계산을 맡겼는데,
// 품목이 여러 개인 영수증에서 모델이 계산을 누락하거나 틀리는 경우가 실제로 발견됐습니다.
// (LLM은 한 번의 생성 과정에서 여러 항목에 걸친 산술을 정확히 수행하는 것이 약한 편입니다.)
// 그래서 모델에게는 "읽기"만 맡기고 — 각 품목은 영수증에 찍힌 그대로의 금액을, 그리고
// 영수증 하단에 표시된 실제 최종 결제 금액(finalTotal)을 별도로 읽어서 반환하게 하고 —
// 비례 배분 계산 자체는 서버 코드에서 결정적으로(정확하게) 수행합니다.

export interface ExtractedItem {
  nameJa: string;
  nameKo: string;
  nameEn: string;
  brand: string;
  colorEn: string;
  size: string;
  hsCode: string;
  declarationKo: string;
  declarationEn: string;
  quantity: number;
  unitPrice: number;
  amount: number;
}

interface RawExtractedItem extends ExtractedItem {}

interface ClaudeToolInput {
  items?: RawExtractedItem[];
  finalTotal?: number;
}

interface ClaudeContentBlock {
  type: string;
  input?: ClaudeToolInput;
}

export async function extractReceiptItems(
  imageBase64: string,
  mediaType: string
): Promise<ExtractedItem[]> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY 환경변수가 설정되어 있지 않습니다.");
  }

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-5",
      max_tokens: 4096,
      system:
        "당신은 일본 매장 영수증(또는 온라인 주문 화면) 사진을 읽고 실제로 구매한 상품 품목만 정확히 " +
        "추출하는 어시스턴트입니다. " +
        "소계/합계/현금/카드/포인트/거스름돈/매장명/주소/전화번호 등 상품이 아닌 줄은 절대 포함하지 마세요. " +
        "각 품목의 한국어 번역명은 자연스러운 한글 상품명으로 작성하세요 (예: コーヒー豆 -> 커피 원두). " +
        "\n\n[중요] 각 품목의 unitPrice와 amount는 영수증에 찍힌 숫자를 그대로 읽어서 반환하세요. " +
        "품목 금액에 할인이나 세금을 반영해서 직접 계산하거나 조정하지 마세요 (비례 배분 계산은 " +
        "서버에서 별도로 정확하게 처리합니다). 대신 finalTotal 필드에 영수증 하단의 " +
        "실제 최종 결제 금액(合計/合計金額/총액/결제금액/구매자가 실제로 지불한 금액)을 " +
        "정확히 읽어서 숫자로 반환하세요. 이 값은 소계, 할인, 세금(소비세/부가세)이 모두 " +
        "반영된 이후의 '진짜 결제 금액'이어야 합니다. 못 찾겠으면 0으로 반환하세요. " +
        "\n\n[수입통관 신고용 부가 정보 — 최선을 다해 추정] 각 품목마다 다음 정보도 함께 채워주세요. " +
        "영수증만으로는 알 수 없는 정보가 많으니, 상품명과 일반 상식을 바탕으로 합리적으로 추정하고, " +
        "확실하지 않으면 표시를 '추정'으로 남기세요 (예: '면 캔버스 추정'): " +
        "nameEn(영어 상품명 초안), brand(브랜드명, 모르면 빈 문자열), colorEn(영문 색상, 모르면 빈 문자열), " +
        "size(사이즈/규격, 모르면 빈 문자열), hsCode(HS 품목분류번호 4~6자리 추정, 예: '6304.92', 확신 없으면 빈 문자열), " +
        "declarationKo(한글 신고설명, 형식: '{한글품목명} / {용도(보통 판매용)} / {소재 추정} / 색상: {색상} / 원산지: 일본'), " +
        "declarationEn(declarationKo와 같은 내용의 영어 버전, 형식: '{English name} / {Purpose} / {Material} / Color: {Color} / Country of origin: Japan'). " +
        "이 부가 정보들은 참고용 초안이며 실제 신고 전 사람이 검토해야 합니다.",
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: { type: "base64", media_type: mediaType, data: imageBase64 },
            },
            {
              type: "text",
              text:
                "이 영수증 사진에서 구매 품목을 모두 추출하고(찍힌 금액 그대로), " +
                "실제 최종 결제 금액(finalTotal)과 수입통관 신고용 부가 정보도 함께 채워줘.",
            },
          ],
        },
      ],
      tools: [
        {
          name: "extract_receipt_items",
          description: "영수증에서 인식한 구매 품목 목록, 실제 최종 결제 금액, 신고용 부가 정보를 반환합니다.",
          input_schema: {
            type: "object",
            properties: {
              items: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    nameJa: { type: "string", description: "영수증에 적힌 원문 품목명(일본어)" },
                    nameKo: { type: "string", description: "품목명의 자연스러운 한국어 번역 초안" },
                    nameEn: { type: "string", description: "품목명의 영어 번역 초안" },
                    brand: { type: "string", description: "브랜드명 (모르면 빈 문자열)" },
                    colorEn: { type: "string", description: "영문 색상 (모르면 빈 문자열)" },
                    size: { type: "string", description: "사이즈/규격 (모르면 빈 문자열)" },
                    hsCode: { type: "string", description: "HS 품목분류번호 추정 (모르면 빈 문자열)" },
                    declarationKo: { type: "string", description: "한글 신고설명 (품목/용도/소재/색상/원산지)" },
                    declarationEn: { type: "string", description: "영어 신고설명" },
                    quantity: { type: "integer", description: "수량. 명시되어 있지 않으면 1" },
                    unitPrice: {
                      type: "number",
                      description: "영수증에 찍힌 그대로의 개당 단가(엔). 할인/세금 계산하지 말고 원본 숫자 그대로.",
                    },
                    amount: {
                      type: "number",
                      description: "영수증에 찍힌 그대로의 해당 품목 합계 금액(엔) = 단가 x 수량. 할인/세금 계산하지 말고 원본 숫자 그대로.",
                    },
                  },
                  required: [
                    "nameJa",
                    "nameKo",
                    "nameEn",
                    "brand",
                    "colorEn",
                    "size",
                    "hsCode",
                    "declarationKo",
                    "declarationEn",
                    "quantity",
                    "unitPrice",
                    "amount",
                  ],
                },
              },
              finalTotal: {
                type: "number",
                description:
                  "영수증에 표시된 실제 최종 결제 금액(세금/할인 모두 반영된 진짜 지불액). 못 찾으면 0.",
              },
            },
            required: ["items", "finalTotal"],
          },
        },
      ],
      tool_choice: { type: "tool", name: "extract_receipt_items" },
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Claude API 오류 (${res.status}): ${text}`);
  }

  const data = await res.json();
  const blocks: ClaudeContentBlock[] = data?.content || [];
  const toolUse = blocks.find((block) => block.type === "tool_use");
  const rawItems = toolUse?.input?.items;
  const finalTotal = toolUse?.input?.finalTotal;

  if (!Array.isArray(rawItems)) {
    throw new Error("Claude 응답에서 품목 추출 결과를 찾을 수 없습니다.");
  }

  return applyTotalLevelAdjustment(rawItems, finalTotal);
}

// 품목별로 찍힌 금액의 합(sumOfItems)과 영수증의 실제 최종 결제 금액(finalTotal)이 다르면
// (할인으로 낮아졌든, 세금 추가로 높아졌든) 그 차이를 모든 품목에 비례 배분합니다.
// 이 계산은 서버에서 정확한 부동소수점 연산으로 처리하며, 모델의 산술 능력에 의존하지 않습니다.
function applyTotalLevelAdjustment(
  items: RawExtractedItem[],
  finalTotal: number | undefined
): ExtractedItem[] {
  const sumOfItems = items.reduce((sum, it) => sum + (Number(it.amount) || 0), 0);

  // finalTotal을 못 읽었거나(0), 품목 합계와 사실상 같으면(반올림 오차 이내) 조정하지 않음
  if (!finalTotal || sumOfItems <= 0 || Math.abs(finalTotal - sumOfItems) < 1) {
    return items;
  }

  const ratio = finalTotal / sumOfItems;

  return items.map((it) => {
    const unitPrice = Number(it.unitPrice) || 0;
    const amount = Number(it.amount) || 0;
    return {
      ...it,
      unitPrice: Math.round(unitPrice * ratio * 100) / 100,
      amount: Math.round(amount * ratio * 100) / 100,
    };
  });
}
