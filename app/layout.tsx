import "./globals.css";
import Footer from "@/components/Footer";
import ContactFAB from "@/components/ContactFAB";
import InstallPrompt from "@/components/InstallPrompt";
import ServiceWorker from "@/components/ServiceWorker";
import LoadingScreen from "@/components/LoadingScreen";
import { ThemeProvider } from "@/components/ThemeProvider";
import type { Metadata, Viewport } from "next";

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)",  color: "#0b1f3a" },
  ],
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "https://techninja-psi.vercel.app/"),
  title: "Tech Ninja Platform",
  description: "Repair. Buy. Sell. Your Local Tech Experts in Mauritius.",
  applicationName: "Tech Ninja",
  manifest: "/manifest.webmanifest",
  twitter: { card: "summary_large_image" },
  appleWebApp: {
    capable: true,
    title: "Tech Ninja",
    statusBarStyle: "black-translucent",
    startupImage: "/apple-touch-icon.png",
  },
  icons: {
    icon: [
      { url: "/favicon.ico",               sizes: "any",    type: "image/x-icon" },
      { url: "/favicon-16x16.png",         sizes: "16x16",  type: "image/png"   },
      { url: "/favicon-32x32.png",         sizes: "32x32",  type: "image/png"   },
      { url: "/android-chrome-192x192.png",sizes: "192x192",type: "image/png"   },
      { url: "/android-chrome-512x512.png",sizes: "512x512",type: "image/png"   },
    ],
    apple: [
      { url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
    shortcut: [{ url: "/favicon.ico", type: "image/x-icon" }],
  },
  openGraph: {
    title: "Tech Ninja Platform",
    description: "Repair. Buy. Sell. Your Local Tech Experts in Mauritius.",
    type: "website",
    siteName: "Tech Ninja",
    images: [{ url: "/android-chrome-512x512.png", width: 512, height: 512 }],
  },
  formatDetection: {
    telephone: true,
    email: true,
    address: true,
  },
  other: {
    "mobile-web-app-capable": "yes",
    "msapplication-TileColor":        "#0b1f3a",
    "msapplication-TileImage":        "/android-chrome-192x192.png",
    "msapplication-square70x70logo":  "/favicon-32x32.png",
    "msapplication-square150x150logo":"/android-chrome-192x192.png",
    "msapplication-square310x310logo":"/android-chrome-512x512.png",
    "msapplication-tap-highlight":    "no",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="bg-white dark:bg-[#030712] text-gray-900 dark:text-gray-50 flex flex-col min-h-screen transition-colors duration-200">
        <ThemeProvider>
          <LoadingScreen />
          {children}
          <Footer />
          <ContactFAB />
          <InstallPrompt />
          <ServiceWorker />
        </ThemeProvider>
      </body>
    </html>
  );
}
