import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AutoMate — 주제만 던지면, 콘텐츠가 알아서",
  description: "AI가 SNS 콘텐츠를 대신 만들어주는 자동화 앱. 시간은 지키고, 결과는 가져가세요.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
