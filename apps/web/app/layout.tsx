import type { Metadata } from "next";
import { Inter, Noto_Sans_Bengali } from "next/font/google";
import "./globals.css";

// Inter ইংরেজি/সংখ্যার জন্য, Noto Sans Bengali বাংলা টেক্সটের জন্য — দুটোই CSS ভ্যারিয়েবল
// হিসেবে এক্সপোজ হয়, globals.css এর --font-sans এ একসাথে ব্যবহার হয়
const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const notoSansBengali = Noto_Sans_Bengali({ subsets: ["bengali"], variable: "--font-noto-bengali" });

export const metadata: Metadata = {
  title: "WhatsApp SaaS",
  description: "WhatsApp মার্কেটিং প্ল্যাটফর্ম",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="bn" className={`${inter.variable} ${notoSansBengali.variable}`}>
      <body>{children}</body>
    </html>
  );
}
