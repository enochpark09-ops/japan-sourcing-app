// Google Cloud Vision API (REST, API 키 방식) 를 이용한 영수증 텍스트 인식(OCR).
// GCP 콘솔에서 "Cloud Vision API"를 활성화한 API 키가 필요합니다.

export async function runOcr(imageBase64: string): Promise<string> {
  const apiKey = process.env.GOOGLE_CLOUD_API_KEY;
  if (!apiKey) {
    throw new Error("GOOGLE_CLOUD_API_KEY 환경변수가 설정되어 있지 않습니다.");
  }

  const res = await fetch(
    `https://vision.googleapis.com/v1/images:annotate?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        requests: [
          {
            image: { content: imageBase64 },
            features: [{ type: "DOCUMENT_TEXT_DETECTION" }],
            imageContext: { languageHints: ["ja"] },
          },
        ],
      }),
    }
  );

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Vision API 오류 (${res.status}): ${text}`);
  }

  const data = await res.json();
  const annotation = data?.responses?.[0]?.fullTextAnnotation?.text;
  if (!annotation) {
    const errMsg = data?.responses?.[0]?.error?.message;
    if (errMsg) throw new Error(`Vision API 오류: ${errMsg}`);
    return "";
  }
  return annotation as string;
}
