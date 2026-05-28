import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SHOPFLOW",
  description: "Curadoria qualitativa de afiliadas TikTok Shop com IA.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR">
      <body className="antialiased">{children}</body>
    </html>
  );
}
