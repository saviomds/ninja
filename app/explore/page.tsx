import Navbar from "@/components/Navbar";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

export const revalidate = 0; // Tells Next.js to always fetch fresh data for this page

export default async function Explore() {
  // Fetch all categories from your products
  const { data: products } = await supabase
    .from("products")
    .select("category");

  // Extract unique categories (ignoring null or empty ones)
  const rawCategories = products 
    ? Array.from(new Set(products.map((p) => p.category).filter(Boolean)))
    : [];

  // Map to our display format
  const categories = rawCategories.map((cat) => ({
    name: cat,
    desc: `Discover our exclusive collection of ${cat}.`,
  }));

  return (
    <main className="min-h-screen bg-gray-950 text-white">
      <Navbar />
      <div className="max-w-6xl mx-auto px-6 py-20">
        <div className="text-center mb-16">
          <h1 className="text-4xl md:text-5xl font-extrabold mb-6 text-transparent bg-clip-text bg-gradient-to-r from-white to-gray-400 tracking-tight">
            Explore Categories
          </h1>
          <p className="text-gray-400 text-lg max-w-2xl mx-auto">
            Discover a wide variety of premium products across multiple collections. Find exactly what you{`'`}re looking for.
          </p>
        </div>
        
        {categories.length === 0 ? (
          <div className="text-center py-20 bg-gray-900/50 rounded-2xl border border-gray-800">
            <p className="text-gray-400 text-lg">No categories found yet. Add some products with categories!</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {categories.map((cat, i) => (
              <div key={i} className="bg-gray-900/40 backdrop-blur-md border border-gray-800 rounded-2xl p-8 hover:border-indigo-500/50 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-indigo-500/10 flex flex-col">
                <h3 className="text-xl font-bold text-white mb-2">{String(cat.name)}</h3>
                <p className="text-gray-400 flex-1">{cat.desc}</p>
                <Link href={`/?category=${encodeURIComponent(String(cat.name))}`} className="inline-block mt-6 text-indigo-400 hover:text-indigo-300 text-sm font-medium transition-colors">
                  Browse collection ↗
                </Link>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
