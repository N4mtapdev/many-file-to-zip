import type { Metadata } from "next";
import "./globals.css";
import { DebugConsole } from "@/components/DebugConsole";
import { AuthProvider } from "@/components/AuthProvider";

export const metadata: Metadata = {
  title: "Sắp Xếp & Gộp File | TreXanh Tools",
  description:
    "Tự động sắp xếp tên file theo thứ tự và gộp nhiều file thành 1 file ZIP.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="vi">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:ital,wght@0,400;0,500;0,600;0,700;0,800;0,900;1,400&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="font-sans bg-surface-white text-ink-dark antialiased">
        <AuthProvider>
          <DebugConsole />
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
