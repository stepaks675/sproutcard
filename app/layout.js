import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata = {
  title: "Sproutcard Wrapped — Onchain Trading Recap",
  description: "See your 2025 trading PnL and a shareable card in seconds.",
  openGraph: {
    title: "Sproutcard Wrapped — Onchain Trading Recap",
    description: "See your 2025 trading PnL and a shareable card in seconds.",
    images: [
      {
        url: "/og.png",
        width: 1200,
        height: 630,
        alt: "Sproutcard Wrapped",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Sproutcard Wrapped — Onchain Trading Recap",
    description: "See your 2025 trading PnL and a shareable card in seconds.",
    images: ["/og.png"],
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
