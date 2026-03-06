import type { Metadata } from "next";
import { Geist_Mono, Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "./components/providers";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "SOL Flip — Apuestas P2P en Solana",
  description:
    "Apuesta SOL contra otro jugador en un coin flip P2P. Dos wallets, una moneda, el contrato decide. Construido con Next.js y Solana Devnet.",
  keywords: [
    "solana",
    "sol flip",
    "apuestas p2p",
    "coin flip",
    "devnet",
    "web3",
    "crypto",
  ],
  icons: {
    icon: "/icon.svg",
    shortcut: "/icon.svg",
    apple: "/icon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <Providers>
        <body
          suppressHydrationWarning
          className={`${inter.variable} ${geistMono.variable} antialiased`}
        >
          {children}
        </body>
      </Providers>
    </html>
  );
}
