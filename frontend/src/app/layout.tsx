import type { Metadata, Viewport } from "next";
import "./globals.css";
import { LayoutShell } from "@/components/LayoutShell";

export const metadata: Metadata = {
  title: "AI未来家庭 — 5位AI导师，陪伴孩子成长",
  description: "学习规划、天赋发现、真题训练、亲子陪伴，全在这里。学学、创创、探探、伴伴、刷刷，让孩子找到自己的节奏。",
  keywords: "AI家庭教育,孩子成长,学习规划,天赋发现,真题训练,错题本,亲子陪伴",
  openGraph: {
    type: "website",
    locale: "zh_CN",
    url: "https://aifamily.xin",
    siteName: "AI未来家庭",
    title: "AI未来家庭 — 5位AI导师，陪伴孩子成长",
    description: "学学·学习规划 / 创创·天赋发现 / 探探·兴趣测评 / 伴伴·亲子陪伴 / 刷刷·真题训练",
    images: [
      {
        url: "https://aifamily.xin/og-home.jpg",
        width: 1200,
        height: 630,
        alt: "AI未来家庭 - 5位AI导师",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "AI未来家庭 — 5位AI导师，陪伴孩子成长",
    description: "学学·学习规划 / 创创·天赋发现 / 探探·兴趣测评 / 伴伴·亲子陪伴 / 刷刷·真题训练",
    images: ["https://aifamily.xin/og-home.jpg"],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" className="h-full antialiased">
      <body className="min-h-full antialiased">
        <LayoutShell>{children}</LayoutShell>
      </body>
    </html>
  );
}
