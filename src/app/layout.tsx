import type { Metadata, Viewport } from "next";
import { IBM_Plex_Sans_Arabic } from "next/font/google";
import "./globals.css";

const arabic = IBM_Plex_Sans_Arabic({
  variable: "--font-arabic",
  subsets: ["arabic", "latin"],
  weight: ["300", "400", "500", "600", "700"],
});

// رابط الموقع الأساسي لصور المشاركة: من متغير بيئة، أو رابط Vercel تلقائيًا
const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ??
  (process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : "http://localhost:3000");

const description =
  "لوحة متابعة لحظية لفحوصات التحقق الصحي للأسر، وفحص الأطفال قبل الاستلام، والفحص النفسي — مربوطة مباشرة بشيت رفد.";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "رفد | لوحة متابعة الفحوصات",
    template: "%s | رفد",
  },
  description,
  applicationName: "رفد · لوحة الفحوصات",
  authors: [{ name: "رفد" }],
  creator: "رفد",
  publisher: "رفد",
  keywords: ["رفد", "لوحة متابعة", "فحوصات", "التحقق الصحي", "فحص الأطفال", "داشبورد"],
  category: "health",
  formatDetection: { telephone: false, email: false, address: false },
  openGraph: {
    type: "website",
    locale: "ar_SA",
    siteName: "رفد",
    title: "رفد | لوحة متابعة الفحوصات",
    description,
    url: "/",
  },
  twitter: {
    card: "summary_large_image",
    title: "رفد | لوحة متابعة الفحوصات",
    description,
  },
  // اللوحة فيها بيانات صحية خاصة، فممنوع محركات البحث تفهرسها
  robots: {
    index: false,
    follow: false,
    nocache: true,
    googleBot: { index: false, follow: false, noimageindex: true },
  },
  appleWebApp: {
    capable: true,
    title: "رفد",
    statusBarStyle: "default",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#741B8D" },
    { media: "(prefers-color-scheme: dark)", color: "#45105A" },
  ],
  colorScheme: "light",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ar" dir="rtl" className={`${arabic.variable} h-full antialiased`}>
      <body className="min-h-full">{children}</body>
    </html>
  );
}
