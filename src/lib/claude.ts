// Claude API(비전 + 도구 사용)를 이용해 영수증 사진에서 구매 품목을 한 번에 추출합니다.
// - OCR과 일→한 번역을 별도 서비스 없이 한 번의 호출로 처리합니다.
// - tool_choice로 JSON 스키마를 강제해 결과 형식을 안정적으로 받습니다.

export interface ExtractedItem {
  nameJa: string;
  nameKo: string;
  quantity: number;
  unitPrice: number;
  amount: number;
}

interface ClaudeContentBlock {
  type: string;
  input?: { items?: unknown };
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
      max_tokens: 2048,
      system:
        "당신은 일본 매장 영수증 사진을 읽고 실제로 구매한 상품 품목만 정확히 추출하는 어시스턴트입니다. " +
        "소계/합계/부가세/현금/카드/포인트/거스름돈/매장명/주소/전화번호 등 상품이 아닌 줄은 절대 포함하지 마세요. " +
        "각 품목의 한국어 번역명은 자연스러운 한글 상품명으로 작성하세요 (예: コーヒー豆 -> 커피 원두).",
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
              text: "이 영수증 사진에서 구매 품목을 모두 추출해줘.",
            },
          ],
        },
      ],
      tools: [
        {
          name: "extract_receipt_items",
          description: "영수증에서 인식한 구매 품목 목록을 반환합니다.",
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
                    quantity: { type: "integer", description: "수량. 명시되어 있지 않으면 1" },
                    unitPrice: { type: "number", description: "개당 단가(엔)" },
                    amount: { type: "number", description: "해당 품목의 합계 금액(엔) = 단가 x 수량" },
                  },
                  required: ["nameJa", "nameKo", "quantity", "unitPrice", "amount"],
                },
              },
            },
            required: ["items"],
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
  const items = toolUse?.input?.items;

  if (!Array.isArray(items)) {
    throw new Error("Claude 응답에서 품목 추출 결과를 찾을 수 없습니다.");
  }

  return items as ExtractedItem[];
}
