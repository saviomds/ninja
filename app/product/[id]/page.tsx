import { createClient } from "@/lib/supabase-server";
import { notFound } from "next/navigation";
import { Metadata } from "next";
import ProductDetailClient from "./ProductDetailClient";

interface Product {
  id: string;
  name: string;
  description: string;
  image: string;
  price: number;
  stock: number;
  category?: string;
  created_at?: string;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const supabase = await createClient();
  const { data: product } = await supabase
    .from("products")
    .select("name, description, image, price")
    .eq("id", id)
    .eq("is_public", true)
    .single();

  if (!product) return { title: "Product Not Found · Tech Ninja" };

  return {
    title: `${product.name} · Tech Ninja`,
    description:
      product.description ||
      `${product.name} — Rs ${product.price?.toLocaleString()} · Available at Tech Ninja Mauritius`,
    openGraph: {
      title: `${product.name} · Tech Ninja`,
      description:
        product.description ||
        `Rs ${product.price?.toLocaleString()} · Tech Ninja Mauritius`,
      images: product.image ? [{ url: product.image }] : undefined,
    },
  };
}

export default async function ProductPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: product } = await supabase
    .from("products")
    .select("*")
    .eq("id", id)
    .eq("is_public", true)
    .single<Product>();

  if (!product) notFound();

  return <ProductDetailClient product={product} />;
}
