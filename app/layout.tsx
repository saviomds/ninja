import "./globals.css";
import Footer from "@/components/Footer";
import ContactFAB from "@/components/ContactFAB";
import { ThemeProvider } from "@/components/ThemeProvider";
import { Metadata } from "next";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "https://techninja-psi.vercel.app/"),
  title: "Tech Ninja Platform",
  description: "Join. Connect. Earn. A simple platform to manage projects, share work, and stay updated.",
  openGraph: {
    title: "Tech Ninja Platform",
    description: "Join. Connect. Earn. A simple platform to manage projects, share work, and stay updated.",
    type: "website",
    siteName: "Tech Ninja",
  },
  twitter: { card: "summary_large_image" },
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
        </ThemeProvider>
      </body>
    </html>
  );
}
