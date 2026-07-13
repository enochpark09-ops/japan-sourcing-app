import "./globals.css";

export const metadata = {
  title: "일본 사입 서류 자동화",
  description: "일본 사입 영수증 업로드 -> 패킹리스트 / 수입서류 자동 생성",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
