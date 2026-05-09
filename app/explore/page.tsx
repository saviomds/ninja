import Navbar from "@/components/Navbar";
import Link from "next/link";
import { createClient } from "@/lib/supabase-server";

export const revalidate = 0;

export default async function Explore() {
  const supabase = await createClient();
  const { data: categoriesData, error } = await supabase
    .from("categories")
    .select("name, description");

  if (error) {
    console.error("Error fetching categories from Supabase:", error.message);
  }

  // Fallback to dummy categories if the database is empty or errors out
  const fallbackCategories = [
    "Electronics", "Fashion", "Home & Garden", "Sports & Outdoors", "Beauty", "Toys"
  ].map((name) => ({
    name,
    desc: `Discover our exclusive collection of ${name}.`
  }));

  // Map database categories to our display format
  const categories = categoriesData && categoriesData.length > 0
    ? categoriesData.map((cat) => ({
        name: cat.name,
        // Use the database description if it exists, otherwise use the default phrase
        desc: cat.description || `Discover our exclusive collection of ${cat.name}.`,
      }))
    : fallbackCategories;

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
