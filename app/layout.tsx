import "./globals.css";
import Footer from "@/components/Footer";
import ContactFAB from "@/components/ContactFAB";
import ServiceWorker from "@/components/ServiceWorker";
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
    // Browser tab — smallest to largest, browser picks best fit
    icon: [
      { url: "/favicon.ico",               sizes: "any",    type: "image/x-icon" },
      { url: "/favicon-16x16.png",         sizes: "16x16",  type: "image/png"   },
      { url: "/favicon-32x32.png",         sizes: "32x32",  type: "image/png"   },
      { url: "/android-chrome-192x192.png",sizes: "192x192",type: "image/png"   },
      { url: "/android-chrome-512x512.png",sizes: "512x512",type: "image/png"   },
    ],
    // iOS — Safari "Add to Home Screen"
    apple: [
      { url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
    // Legacy shortcut icon (IE, old browsers)
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
    // Android Chrome — installable PWA
    "mobile-web-app-capable": "yes",
    // Windows tile
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
      <head>
        {/* Anti-FOUC: set dark class before first paint */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){var s=localStorage.getItem('tn-theme');var d=s?s==='dark':window.matchMedia('(prefers-color-scheme: dark)').matches;if(d)document.documentElement.classList.add('dark');})();`,
          }}
        />
      </head>
      <body className="bg-white dark:bg-[#030712] text-gray-900 dark:text-gray-50 flex flex-col min-h-screen transition-colors duration-200">
        <ThemeProvider>
          {children}
          <Footer />
          <ContactFAB />
          <ServiceWorker />
        </ThemeProvider>
      </body>
    </html>
  );
}
