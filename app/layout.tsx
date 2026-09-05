import type { Metadata } from "next";
import { Plus_Jakarta_Sans, Inter, JetBrains_Mono, Syne } from "next/font/google";
import { site } from "@/lib/site";
import { ParallaxBg } from "@/components/fx/parallax-bg";
import "./globals.css";

const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-jakarta",
  display: "swap",
});
const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});
const jbmono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jbmono",
  display: "swap",
});
const syne = Syne({
  subsets: ["latin"],
  variable: "--font-syne",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(site.url),
  title: {
    default: `${site.name} — ${site.tagline}`,
    template: `%s · ${site.name}`,
  },
  description: site.description,
  keywords: [
    "audit bisnis AI",
    "digital marketing agency",
    "scale up bisnis",
    "GEO",
    "SEO",
    "growth strategy",
    "revenue booster",
    "UMKM naik kelas",
    "custom software",
  ],
  authors: [{ name: site.name }],
  openGraph: {
    type: "website",
    locale: "id_ID",
    url: site.url,
    siteName: site.name,
    title: `${site.name} — ${site.tagline}`,
    description: site.description,
  },
  twitter: {
    card: "summary_large_image",
    title: `${site.name} — ${site.tagline}`,
    description: site.description,
  },
  robots: { index: true, follow: true },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="id"
      className={`${jakarta.variable} ${inter.variable} ${jbmono.variable} ${syne.variable}`}
    >
      <body className="min-h-screen bg-obsidian text-mist antialiased">
        <ParallaxBg />
        {children}
      </body>
    </html>
  );
}
