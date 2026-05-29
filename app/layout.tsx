import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SHOPFLOW · Curadoria de afiliadas",
  description: "Plataforma editorial de curadoria de afiliadas TikTok Shop.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR">
      <body className="antialiased min-h-screen bg-background text-foreground">
        {children}
      </body>
    </html>
  );
}
