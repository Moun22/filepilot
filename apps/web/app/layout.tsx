import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";

const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
});

export const metadata: Metadata = {
  title: "Filepilot — Coffre administratif intelligent",
  description:
    "Centralisez vos documents, suivez vos démarches administratives et exportez vos dossiers en un clic.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr" className={geistMono.variable}>
      <body>{children}</body>
    </html>
  );
}
