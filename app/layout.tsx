import "./globals.css";
import Footer from "@/components/Footer";

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