import "./globals.css";
import Footer from "@/components/Footer";
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
  twitter: {
    card: "summary_large_image",
  }
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-gray-950 text-gray-50 flex flex-col min-h-screen">
        {children}
        <Footer />
      </body>
    </html>
  );
}