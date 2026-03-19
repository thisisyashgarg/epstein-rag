import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Epstein Files — Document Search",
  description: "Semantic search across the Jeffrey Epstein court documents using AI",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
