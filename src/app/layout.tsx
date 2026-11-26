import type { Metadata, Viewport } from "next";
import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import { JsonLd } from "@/components/JsonLd";
import { site } from "@/lib/site";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(site.url),
  title: { default: `${site.name}：广东教培机构公开名单索引`, template: `%s｜${site.name}` },
  description: site.description,
  applicationName: site.name,
  openGraph: { siteName: site.name, locale: "zh_CN", type: "website" },
};

export const viewport: Viewport = { themeColor: "#1e4fd8" };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="zh-CN" className="h-full antialiased">
      <body className="flex min-h-full flex-col">
        <a href="#main-content" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[70] focus:rounded-lg focus:bg-brand focus:px-4 focus:py-3 focus:text-white">跳转到主要内容</a>
        <Header />
        <main id="main-content" className="flex-1">{children}</main>
        <Footer />
        <JsonLd
          data={{
            "@context": "https://schema.org",
            "@type": "WebSite",
            name: site.name,
            url: site.url,
            inLanguage: "zh-CN",
            description: site.description,
          }}
        />
      </body>
    </html>
  );
}
