import { put, del } from "@vercel/blob";

export async function uploadReceiptImage(
  file: Buffer,
  filename: string,
  contentType: string
): Promise<string> {
  const blob = await put(`receipts/${Date.now()}-${filename}`, file, {
    access: "public",
    contentType,
  });
  return blob.url;
}

// 영수증 삭제 시 Blob 스토리지에서도 이미지를 정리합니다.
// 실패해도(예: 이미 지워졌거나 URL이 없는 경우) 영수증 삭제 자체는 계속 진행되도록
// 호출하는 쪽에서 try/catch로 감싸 사용하세요.
export async function deleteReceiptImage(url: string): Promise<void> {
  if (!url) return;
  await del(url);
}
