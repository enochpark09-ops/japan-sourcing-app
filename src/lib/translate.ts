// Google Cloud Translation API (REST v2, API 키 방식) 를 이용한 일본어 -> 한국어 번역.
// GCP 콘솔에서 "Cloud Translation API"를 활성화한 API 키가 필요합니다 (Vision과 같은 키 재사용 가능).

export async function translateJaToKo(texts: string[]): Promise<string[]> {
  if (texts.length === 0) return [];
  const apiKey = process.env.GOOGLE_CLOUD_API_KEY;
  if (!apiKey) {
    throw new Error("GOOGLE_CLOUD_API_KEY 환경변수가 설정되어 있지 않습니다.");
  }

  const res = await fetch(
    `https://translation.googleapis.com/language/translate/v2?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        q: texts,
        source: "ja",
        target: "ko",
        format: "text",
      }),
    }
  );

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Translation API 오류 (${res.status}): ${text}`);
  }

  const data = await res.json();
  const translations = data?.data?.translations;
  if (!translations) throw new Error("Translation API 응답에 번역 결과가 없습니다.");
  return translations.map((t: { translatedText: string }) => t.translatedText);
}
