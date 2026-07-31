import type { Metadata } from "next";
import { Geist_Mono, Noto_Sans_Thai } from "next/font/google";
import { ThemeProvider } from "next-themes";
import { LanguageProvider } from "@/i18n";
import "./globals.css";

const notoSansThai = Noto_Sans_Thai({
  variable: "--font-noto-sans-thai",
  subsets: ["thai", "latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const siteUrl = "https://folio-lab-gamma.vercel.app";

// ต้องพูดตรงกับ app.tagline ใน src/i18n/locales/*.json — ที่นี่ i18n เข้าไม่ถึง
// เพราะเป็นข้อความคงที่ฝั่งเซิร์ฟเวอร์ที่ตัวดึงข้อมูลของแพลตฟอร์มอ่าน (US-36, PD-026)
const siteTitle = "folio-lab — ทดสอบพอร์ตย้อนหลัง หุ้นไทยและ ETF ต่างประเทศ";
const siteDescription =
  "ถ้าลงทุนแบบนี้มาตั้งแต่ปีนั้น วันนี้จะเป็นอย่างไร — ทดสอบพอร์ตลงทุนย้อนหลัง ทั้งหุ้นไทยและ ETF ต่างประเทศ ในพอร์ตเดียว พร้อมอธิบายศัพท์การเงินเป็นภาษาไทย";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: "folio-lab",
  description: siteDescription,
  openGraph: {
    type: "website",
    locale: "th_TH",
    url: siteUrl,
    siteName: "folio-lab",
    title: siteTitle,
    description: siteDescription,
    images: [
      {
        url: "/og.png",
        width: 1200,
        height: 630,
        alt: "หน้าจอผลลัพธ์ของ folio-lab แสดงกราฟมูลค่าพอร์ตย้อนหลังพร้อมสรุปผลตอบแทน",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: siteTitle,
    description: siteDescription,
    images: ["/og.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="th"
      suppressHydrationWarning
      className={`${notoSansThai.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col font-sans">
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem={false}
          disableTransitionOnChange
        >
          <LanguageProvider>{children}</LanguageProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
