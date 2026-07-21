import "./globals.css";

export const metadata = {
  title: "Quiz Live — Trò chơi trắc nghiệm trực tiếp",
  description: "Trò chơi trắc nghiệm nhiều người chơi kiểu Kahoot, 3 vòng theo thông điệp của quản trò.",
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({ children }) {
  return (
    <html lang="vi">
      <body>{children}</body>
    </html>
  );
}
