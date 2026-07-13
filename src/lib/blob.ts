import { put } from "@vercel/blob";

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
