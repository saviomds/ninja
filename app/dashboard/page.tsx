"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import { User } from "@supabase/supabase-js";
import Image from "next/image";
import Link from "next/link";

interface Product {
  id: string;
  name: string;
  description: string;
  image: string;
  price: number;
  stock: number;
  category?: string;
}

interface SocialProfile {
  id: string;
  platform_name: string;
  platform_icon: string;
  profile_link: string;
  username: string;
  email: string;
  password?: string;
  description?: string;
}

interface AppUpdate {
  id: string;
  info: string;
  content: string;
  link: string;
  created_at?: string;
}

export default function Dashboard() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const [productToDelete, setProductToDelete] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 6;
  const [expandedDesc, setExpandedDesc] = useState<Record<string, boolean>>({});
  const [newProduct, setNewProduct] = useState({
    name: "",
    image: "",
    description: "",
    price: "",
    stock: "",
    category: "",
  });
  
  // Social Media State
  const [socialProfiles, setSocialProfiles] = useState<SocialProfile[]>([]);
  const [isSocialModalOpen, setIsSocialModalOpen] = useState(false);
  const [isSavingSocial, setIsSavingSocial] = useState(false);
  const [editingSocialId, setEditingSocialId] = useState<string | null>(null);
  const [socialToDelete, setSocialToDelete] = useState<string | null>(null);
  const [visiblePasswords, setVisiblePasswords] = useState<Record<string, boolean>>({});
  const [newSocial, setNewSocial] = useState({
    platform_name: "", platform_icon: "", profile_link: "", username: "", email: "", password: "", description: ""
  });

  // Updates State
  const [updates, setUpdates] = useState<AppUpdate[]>([]);
  const [isUpdateModalOpen, setIsUpdateModalOpen] = useState(false);
  const [isSavingUpdate, setIsSavingUpdate] = useState(false);
  const [editingUpdateId, setEditingUpdateId] = useState<string | null>(null);
  const [updateToDelete, setUpdateToDelete] = useState<string | null>(null);
  const [newUpdate, setNewUpdate] = useState({ info: "", content: "", link: "" });

  const showToast = (message: string, type: "success" | "error") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const fetchProducts = async () => {
    const { data } = await supabase
      .from("products")
      .select("*")
      .order("created_at", { ascending: false });

    setProducts(data || []);
    setLoading(false);
  };

  const fetchSocialProfiles = async () => {
    const { data } = await supabase
      .from("social_profiles")
      .select("*")
      .order("created_at", { ascending: false });
    setSocialProfiles(data || []);
  };

  const fetchUpdates = async () => {
    const { data } = await supabase
      .from("updates")
      .select("*")
      .order("created_at", { ascending: false });
    setUpdates(data || []);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  // Pagination & Search logic
  useEffect(() => {
    setCurrentPage(1); // Reset to page 1 when search changes
  }, [searchQuery]);

  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    (p.description && p.description.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const totalPages = Math.ceil(filteredProducts.length / ITEMS_PER_PAGE);
  const paginatedProducts = filteredProducts.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  const toggleDesc = (id: string) => {
    setExpandedDesc(prev => ({ ...prev, [id]: !prev[id] }));
  };

  useEffect(() => {
    const getUserAndProducts = async () => {
      const { data: userData } = await supabase.auth.getUser();

      if (!userData.user) {
        router.push("/login");
        return;
      }

      setUser(userData.user);
      await fetchProducts();
      await fetchSocialProfiles();
      await fetchUpdates();
    };

    getUserAndProducts();
  }, [router]);

  const handleSaveProduct = async () => {
    setIsSaving(true);

    const productData = {
      name: newProduct.name,
      image: newProduct.image,
      description: newProduct.description,
      price: parseFloat(newProduct.price) || 0,
      stock: parseInt(newProduct.stock, 10) || 0,
      category: newProduct.category,
    };

    let error;
    if (editingProductId) {
      const { error: updateError } = await supabase
        .from("products")
        .update(productData)
        .eq("id", editingProductId);
      error = updateError;
    } else {
      const { error: insertError } = await supabase
        .from("products")
        .insert([productData]);
      error = insertError;
    }

    setIsSaving(false);

    if (error) {
      showToast("Error saving product: " + error.message, "error");
    } else {
      setIsModalOpen(false);
      setNewProduct({ name: "", image: "", description: "", price: "", stock: "", category: "" });
      setEditingProductId(null);
      showToast("Product saved successfully!", "success");
      fetchProducts();
    }
  };

  const handleEditClick = (product: Product) => {
    setNewProduct({
      name: product.name,
      image: product.image || "",
      description: product.description || "",
      price: product.price.toString(),
      stock: product.stock.toString(),
      category: product.category || "",
    });
    setEditingProductId(product.id);
    setIsModalOpen(true);
  };

  const handleDeleteProduct = (id: string) => {
    setProductToDelete(id);
  };

  const confirmDelete = async () => {
    if (!productToDelete) return;
    setIsDeleting(true);
    const { error } = await supabase.from("products").delete().eq("id", productToDelete);
    setIsDeleting(false);
    setProductToDelete(null);

    if (error) {
      showToast("Error deleting product: " + error.message, "error");
    } else {
      showToast("Product deleted successfully!", "success");
      fetchProducts();
    }
  };

  const handleDownloadExcel = () => {
    if (products.length === 0) {
      showToast("No products to export", "error");
      return;
    }

    const escapeHtml = (str: string) => {
      return (str || "").toString()
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
    };

    const tableHtml = `
      <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
        <head>
          <meta charset="utf-8" />
          <style>
            table { border-collapse: collapse; width: 100%; font-family: Arial, sans-serif; }
            th { background-color: #4F46E5; color: #ffffff; font-weight: bold; border: 1px solid #d1d5db; padding: 12px; text-align: left; }
            td { border: 1px solid #d1d5db; padding: 10px; vertical-align: top; }
            .num { text-align: right; font-weight: bold; }
            .title { font-size: 24px; font-weight: bold; color: #111827; margin-bottom: 15px; }
            .empty { color: #9ca3af; font-style: italic; }
          </style>
        </head>
        <body>
          <div class="title">Product Inventory Report</div>
          <table>
            <thead>
              <tr>
                <th style="width: 250px;">Product ID</th>
                <th style="width: 200px;">Name</th>
                <th style="width: 150px;">Category</th>
                <th style="width: 120px;">Price (Rs)</th>
                <th style="width: 120px;">Stock</th>
                <th style="width: 350px;">Description</th>
                <th style="width: 250px;">Image URL</th>
              </tr>
            </thead>
            <tbody>
              ${products.map(p => `
                <tr>
                  <td style="color: #6b7280; font-family: monospace;">${escapeHtml(p.id)}</td>
                  <td><strong>${escapeHtml(p.name)}</strong></td>
                  <td>${p.category ? escapeHtml(p.category) : '<span class="empty">Uncategorized</span>'}</td>
                  <td class="num" style="color: #059669;">${p.price}</td>
                  <td class="num" style="color: ${p.stock > 0 ? '#2563eb' : '#dc2626'};">${p.stock}</td>
                  <td>${escapeHtml(p.description) || '<span class="empty">No description</span>'}</td>
                  <td>${p.image ? `<a href="${escapeHtml(p.image)}" style="color: #4F46E5; text-decoration: underline;">View Image</a>` : '<span class="empty">-</span>'}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </body>
      </html>
    `;

    const blob = new Blob([tableHtml], { type: "application/vnd.ms-excel" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", "Products_Inventory.xls");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast("Products exported as Excel successfully!", "success");
  };

  // Social Profile Handlers
  const handleSaveSocial = async () => {
    setIsSavingSocial(true);
    const socialData = { ...newSocial };

    let error;
    if (editingSocialId) {
      const { error: updateError } = await supabase.from("social_profiles").update(socialData).eq("id", editingSocialId);
      error = updateError;
    } else {
      const { error: insertError } = await supabase.from("social_profiles").insert([socialData]);
      error = insertError;
    }

    setIsSavingSocial(false);
    if (error) {
      showToast("Error saving profile: " + error.message, "error");
    } else {
      setIsSocialModalOpen(false);
      setNewSocial({ platform_name: "", platform_icon: "", profile_link: "", username: "", email: "", password: "", description: "" });
      setEditingSocialId(null);
      showToast("Profile saved successfully!", "success");
      fetchSocialProfiles();
    }
  };

  const handleEditSocial = (profile: SocialProfile) => {
    setNewSocial({
      platform_name: profile.platform_name || "",
      platform_icon: profile.platform_icon || "",
      profile_link: profile.profile_link || "",
      username: profile.username || "",
      email: profile.email || "",
      password: profile.password || "",
      description: profile.description || "",
    });
    setEditingSocialId(profile.id);
    setIsSocialModalOpen(true);
  };

  const confirmDeleteSocial = async () => {
    if (!socialToDelete) return;
    setIsDeleting(true);
    const { error } = await supabase.from("social_profiles").delete().eq("id", socialToDelete);
    setIsDeleting(false);
    setSocialToDelete(null);
    if (error) showToast("Error deleting profile: " + error.message, "error");
    else { showToast("Profile deleted successfully!", "success"); fetchSocialProfiles(); }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    showToast(`${label} copied to clipboard!`, "success");
  };

  const togglePassword = (id: string) => {
    setVisiblePasswords(prev => ({ ...prev, [id]: !prev[id] }));
  };

  // Updates Handlers
  const handleSaveUpdate = async () => {
    setIsSavingUpdate(true);
    const updateData = { ...newUpdate };

    let error;
    if (editingUpdateId) {
      const { error: updateError } = await supabase.from("updates").update(updateData).eq("id", editingUpdateId);
      error = updateError;
    } else {
      const { error: insertError } = await supabase.from("updates").insert([updateData]);
      error = insertError;
    }

    setIsSavingUpdate(false);
    if (error) {
      showToast("Error saving update: " + error.message, "error");
    } else {
      setIsUpdateModalOpen(false);
      setNewUpdate({ info: "", content: "", link: "" });
      setEditingUpdateId(null);
      showToast("Update saved successfully!", "success");
      fetchUpdates();
    }
  };

  const handleEditUpdate = (update: AppUpdate) => {
    setNewUpdate({
      info: update.info || "",
      content: update.content || "",
      link: update.link || "",
    });
    setEditingUpdateId(update.id);
    setIsUpdateModalOpen(true);
  };

  const confirmDeleteUpdate = async () => {
    if (!updateToDelete) return;
    setIsDeleting(true);
    const { error } = await supabase.from("updates").delete().eq("id", updateToDelete);
    setIsDeleting(false);
    setUpdateToDelete(null);
    if (error) showToast("Error deleting update: " + error.message, "error");
    else { showToast("Update deleted successfully!", "success"); fetchUpdates(); }
  };

  return (
    <div className="min-h-screen bg-gray-950">
      {/* Top Bar */}
      <div className="bg-gray-900 border-b border-gray-800 px-4 md:px-6 py-4 flex justify-between items-center relative z-20">
        <Link href="/" className="font-semibold text-xl text-white">
          Home
        </Link>

        {/* Desktop Nav */}
        <div className="hidden md:flex items-center gap-4">
          <p className="text-sm text-gray-400">
            {user?.email}
          </p>
          <button 
            onClick={handleLogout}
            className="text-sm bg-gray-800 hover:bg-gray-700 text-white px-4 py-2 rounded-lg border border-gray-700 transition-all"
          >
            Logout
          </button>
        </div>

        {/* Mobile Hamburger Button */}
        <button 
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          className="md:hidden text-gray-400 hover:text-white p-1 transition-colors"
        >
          {isMobileMenuOpen ? (
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
            </svg>
          )}
        </button>

        {/* Mobile Dropdown Menu */}
        {isMobileMenuOpen && (
          <div className="absolute top-full left-0 w-full bg-gray-900 border-b border-gray-800 p-4 flex flex-col gap-4 md:hidden shadow-2xl">
            <p className="text-sm text-gray-400 break-all px-2">{user?.email}</p>
            <button 
              onClick={handleLogout}
              className="text-sm bg-gray-800 hover:bg-gray-700 text-white px-4 py-2 rounded-lg border border-gray-700 transition-all w-full text-left font-medium"
            >
              Logout
            </button>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="max-w-5xl mx-auto p-6">

        {/* --- Updates Section --- */}
        <div className="mb-14">
          <div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4">
            <div>
              <h2 className="text-2xl font-bold text-white">Latest Updates</h2>
              <p className="text-gray-400 text-sm mt-1">Announcements, snippets, and important links</p>
            </div>
            <button
              onClick={() => {
                setNewUpdate({ info: "", content: "", link: "" });
                setEditingUpdateId(null);
                setIsUpdateModalOpen(true);
              }}
              className="w-full md:w-auto bg-gradient-to-r from-emerald-500 to-teal-600 text-white px-6 py-3 rounded-xl font-semibold shadow-[0_0_15px_rgba(16,185,129,0.2)] hover:shadow-[0_0_25px_rgba(16,185,129,0.4)] hover:-translate-y-0.5 transition-all duration-200"
            >
              + Add Update
            </button>
          </div>

          {updates.length === 0 ? (
            <div className="text-center py-12 bg-gray-900/50 rounded-2xl border border-gray-800">
              <p className="text-gray-400 text-lg">No updates posted yet.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {updates.map((update) => (
                <div key={update.id} className="group bg-gray-900/40 backdrop-blur-md border border-gray-800 rounded-2xl p-5 hover:border-gray-700 transition-all duration-300 hover:shadow-xl hover:shadow-black/50 relative flex flex-col md:flex-row gap-4">
                  <div className="flex-1">
                    <h3 className="text-lg font-bold text-white mb-2">{update.info}</h3>
                    <p className="text-gray-300 whitespace-pre-wrap text-sm leading-relaxed mb-4">{update.content}</p>
                    {update.link && (
                      <a href={update.link.startsWith('http') ? update.link : `https://${update.link}`} target="_blank" rel="noopener noreferrer" className="text-emerald-400 hover:text-emerald-300 text-sm font-medium inline-flex items-center gap-1 transition-colors bg-emerald-500/10 px-3 py-1.5 rounded-lg border border-emerald-500/20 w-fit">
                        View Link ↗
                      </a>
                    )}
                  </div>
                  <div className="flex md:flex-col gap-3 justify-end items-end shrink-0 pt-2 md:pt-0 border-t md:border-t-0 border-gray-800">
                    <button onClick={() => handleEditUpdate(update)} className="text-sm text-gray-400 hover:text-white transition-colors bg-gray-800 hover:bg-gray-700 px-4 py-1.5 rounded-lg border border-gray-700">Edit</button>
                    <button onClick={() => setUpdateToDelete(update.id)} className="text-sm text-red-500 hover:text-red-400 transition-colors bg-red-500/10 hover:bg-red-500/20 px-4 py-1.5 rounded-lg border border-red-500/20">Delete</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <hr className="border-gray-800 mb-10" />

        {/* --- Social Media Section --- */}
        <div className="mb-14">
          <div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4">
            <div>
              <h2 className="text-2xl font-bold text-white">Social Media Profiles</h2>
              <p className="text-gray-400 text-sm mt-1">Manage your platform accounts and credentials</p>
            </div>
            <button
              onClick={() => {
                setNewSocial({ platform_name: "", platform_icon: "", profile_link: "", username: "", email: "", password: "", description: "" });
                setEditingSocialId(null);
                setIsSocialModalOpen(true);
              }}
              className="w-full md:w-auto bg-gradient-to-r from-indigo-500 to-purple-600 text-white px-6 py-3 rounded-xl font-semibold shadow-[0_0_15px_rgba(99,102,241,0.2)] hover:shadow-[0_0_25px_rgba(99,102,241,0.4)] hover:-translate-y-0.5 transition-all duration-200"
            >
              + Add Social Info
            </button>
          </div>

          {socialProfiles.length === 0 ? (
            <div className="text-center py-12 bg-gray-900/50 rounded-2xl border border-gray-800">
              <p className="text-gray-400 text-lg">No social media profiles added yet.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {socialProfiles.map((profile) => (
                <div key={profile.id} className="group bg-gray-900/40 backdrop-blur-md border border-gray-800 rounded-2xl p-5 hover:border-gray-700 transition-all duration-300 hover:shadow-xl hover:shadow-black/50 flex flex-col relative">
                  <div className="flex items-center gap-4 mb-4">
                    {profile.platform_icon ? (
                      <Image src={profile.platform_icon} alt={profile.platform_name} width={48} height={48} unoptimized className="w-12 h-12 rounded-xl object-cover bg-gray-800 border border-gray-700" />
                    ) : (
                      <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-gray-800 to-gray-700 border border-gray-600 flex items-center justify-center text-xl font-bold text-gray-300">
                        {profile.platform_name.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div className="overflow-hidden">
                      <h3 className="text-lg font-bold text-white truncate">{profile.platform_name}</h3>
                      <a href={profile.profile_link.startsWith('http') ? profile.profile_link : `https://${profile.profile_link}`} target="_blank" rel="noopener noreferrer" className="text-sm text-indigo-400 hover:text-indigo-300 transition-colors truncate block">
                        Visit Profile ↗
                      </a>
                    </div>
                  </div>
                  
                  {profile.description && (
                    <p className="text-sm text-gray-400 mb-4 line-clamp-3">{profile.description}</p>
                  )}

                  <div className="space-y-2.5 mb-6 flex-1 text-sm text-gray-300 bg-gray-950/50 p-4 rounded-xl border border-gray-800/50">
                    <div className="flex justify-between items-center">
                      <span className="text-gray-500">Username</span>
                      <span className="font-medium truncate max-w-[120px]">{profile.username || "-"}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-500">Email</span>
                      <span className="font-medium truncate max-w-[120px]" title={profile.email}>{profile.email || "-"}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-500">Password</span>
                      <div className="flex items-center gap-2">
                        <span className="font-mono bg-gray-900 px-2 py-0.5 rounded text-gray-400 max-w-[80px] overflow-hidden">
                          {visiblePasswords[profile.id] ? profile.password || "-" : "••••••••"}
                        </span>
                        <button onClick={() => togglePassword(profile.id)} className="text-gray-500 hover:text-white transition-colors">
                          {visiblePasswords[profile.id] ? "🙈" : "👁️"}
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-2 mt-auto">
                    <button onClick={() => copyToClipboard(`Email/User: ${profile.username || profile.email}\nPassword: ${profile.password}`, "Credentials")} className="flex-1 bg-gray-800 hover:bg-gray-700 text-white py-2 rounded-lg text-xs font-medium transition-all border border-gray-700">Copy Creds</button>
                    <button onClick={() => handleEditSocial(profile)} className="flex-1 bg-gray-800 hover:bg-gray-700 text-white py-2 rounded-lg text-xs font-medium transition-all border border-gray-700">Edit</button>
                    <button onClick={() => setSocialToDelete(profile.id)} className="flex-1 bg-red-500/10 hover:bg-red-500/20 text-red-500 py-2 rounded-lg text-xs font-medium transition-all border border-red-500/20">Delete</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <hr className="border-gray-800 mb-10" />

        {/* --- Products Section --- */}
        <div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4">
          <div className="w-full md:w-1/2 relative">
            <h2 className="text-2xl font-bold text-white mb-4 md:hidden">Products</h2>
            <input
              type="text"
              placeholder="Search products by name or description..."
              className="w-full bg-gray-900 border border-gray-800 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-gray-600 transition-all shadow-inner"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <div className="flex w-full md:w-auto items-center gap-4">
            <h2 className="text-2xl font-bold text-white hidden md:block mr-4">Products</h2>
            <button 
              onClick={handleDownloadExcel}
              className="w-full md:w-auto flex items-center justify-center gap-2 bg-gray-800 text-white px-6 py-3 rounded-xl font-semibold hover:bg-gray-700 transition-all duration-200 border border-gray-700"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5 text-emerald-500">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m.75 12l3 3m0 0l3-3m-3 3v-6m-1.5-9H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
              </svg>
              Export Excel
            </button>
            <button 
              onClick={() => {
                setNewProduct({ name: "", image: "", description: "", price: "", stock: "", category: "" });
                setEditingProductId(null);
                setIsModalOpen(true);
              }}
              className="w-full md:w-auto bg-gradient-to-r from-gray-100 to-white text-black px-6 py-3 rounded-xl font-semibold shadow-[0_0_15px_rgba(255,255,255,0.1)] hover:shadow-[0_0_25px_rgba(255,255,255,0.25)] hover:-translate-y-0.5 transition-all duration-200"
            >
              + New Product
            </button>
          </div>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map((n) => (
              <div key={n} className="bg-gray-900/50 h-80 rounded-2xl animate-pulse border border-gray-800"></div>
            ))}
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="text-center py-20 bg-gray-900/50 rounded-2xl border border-gray-800">
            <p className="text-gray-400 text-lg">No products found.</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {paginatedProducts.map((product) => (
                <div
                  key={product.id}
                  className="group bg-gray-900/40 backdrop-blur-md border border-gray-800 rounded-2xl overflow-hidden hover:border-gray-700 transition-all duration-300 hover:shadow-2xl hover:shadow-black/50 flex flex-col"
                >
                  {/* Product Image Wrapper */}
                  <div className="aspect-[4/3] w-full bg-gray-800 relative overflow-hidden">
                    {product.image ? (
                      <Image src={product.image} alt={product.name} fill unoptimized className="object-cover w-full h-full group-hover:scale-105 transition-transform duration-500" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-600">No Image</div>
                    )}
                    {/* Floating Price Tag */}
                    <div className="absolute top-3 right-3 bg-black/70 backdrop-blur-md text-white px-3 py-1 rounded-full text-sm font-bold border border-gray-700 shadow-lg">
                      Rs {product.price}
                    </div>
                  </div>

                  {/* Product Details */}
                  <div className="p-5 flex flex-col flex-1">
                    <h3 className="text-lg font-bold text-white mb-2 line-clamp-1" title={product.name}>
                      {product.name}
                    </h3>
                    
                    <div className="mb-4 flex-1">
                      <p className={`text-sm text-gray-400 transition-all ${expandedDesc[product.id] ? '' : 'line-clamp-2'}`}>
                        {product.description || "No description provided."}
                      </p>
                      {product.description?.length > 80 && (
                        <button onClick={() => toggleDesc(product.id)} className="text-xs text-blue-400 hover:text-blue-300 mt-2 font-medium transition-colors">
                          {expandedDesc[product.id] ? 'Show less' : 'Read more'}
                        </button>
                      )}
                    </div>

                    <div className="mb-4">
                      <span className="text-xs font-semibold bg-indigo-500/10 text-indigo-400 px-2 py-1 rounded-md border border-indigo-500/20">
                        {product.category || "Uncategorized"}
                      </span>
                    </div>

                    <div className="flex items-center text-xs text-gray-400 mb-5 bg-gray-950/50 w-fit px-2.5 py-1.5 rounded-md border border-gray-800/50">
                      <span className={`w-2 h-2 rounded-full mr-2 ${product.stock > 0 ? 'bg-green-500' : 'bg-red-500'}`}></span>
                      {product.stock} in stock
                    </div>

                    {/* Action Buttons */}
                    <div className="flex gap-3 pt-4 border-t border-gray-800/60 mt-auto">
                      <button 
                        onClick={() => handleEditClick(product)} 
                        className="flex-1 bg-gray-800/80 hover:bg-gray-700 text-white py-2 rounded-xl text-sm font-medium transition-all backdrop-blur-sm border border-gray-700/50 hover:border-gray-600"
                      >
                        Edit
                      </button>
                      <button 
                        onClick={() => handleDeleteProduct(product.id)} 
                        className="flex-1 bg-red-500/10 hover:bg-red-500/20 text-red-500 py-2 rounded-xl text-sm font-medium transition-all border border-red-500/10 hover:border-red-500/30"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="flex justify-center items-center mt-10 gap-2 flex-wrap">
                <button 
                  disabled={currentPage === 1} 
                  onClick={() => setCurrentPage(p => p - 1)} 
                  className="px-4 py-2 rounded-xl border border-gray-800 text-sm font-medium text-gray-400 hover:bg-gray-800 disabled:opacity-50 disabled:hover:bg-transparent transition-all"
                >
                  Prev
                </button>
                
                <div className="flex flex-wrap justify-center items-center gap-1 mx-2">
                  {Array.from({ length: totalPages }).map((_, i) => (
                    <button 
                      key={i}
                      onClick={() => setCurrentPage(i + 1)} 
                      className={`w-9 h-9 sm:w-10 sm:h-10 rounded-xl text-sm font-semibold transition-all ${
                        currentPage === i + 1 
                          ? 'bg-white text-black shadow-[0_0_10px_rgba(255,255,255,0.2)]' 
                          : 'text-gray-400 hover:bg-gray-800 border border-transparent hover:border-gray-700'
                      }`}
                    >
                      {i + 1}
                    </button>
                  ))}
                </div>

                <button 
                  disabled={currentPage === totalPages} 
                  onClick={() => setCurrentPage(p => p + 1)} 
                  className="px-4 py-2 rounded-xl border border-gray-800 text-sm font-medium text-gray-400 hover:bg-gray-800 disabled:opacity-50 disabled:hover:bg-transparent transition-all"
                >
                  Next
                </button>
              </div>
            )}
          </>
        )}

        {/* New Product Modal */}
        {isModalOpen && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
            <div className="bg-gray-900 border border-gray-800 p-6 rounded-lg w-full max-w-md shadow-xl">
              <h2 className="text-xl font-semibold text-white mb-4">
                {editingProductId ? "Edit Product" : "Add New Product"}
              </h2>
              <div className="space-y-4">
                <input
                  type="text"
                  placeholder="Product Name"
                  className="w-full border border-gray-700 px-3 py-2 rounded-md text-white bg-gray-800 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-white transition-colors"
                  value={newProduct.name}
                  onChange={(e) => setNewProduct({ ...newProduct, name: e.target.value })}
                />
                <input
                  type="text"
                  placeholder="Category (e.g. Electronics, Fashion)"
                  className="w-full border border-gray-700 px-3 py-2 rounded-md text-white bg-gray-800 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-white transition-colors"
                  value={newProduct.category}
                  onChange={(e) => setNewProduct({ ...newProduct, category: e.target.value })}
                />
                <input
                  type="text"
                  placeholder="Image URL"
                  className="w-full border border-gray-700 px-3 py-2 rounded-md text-white bg-gray-800 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-white transition-colors"
                  value={newProduct.image}
                  onChange={(e) => setNewProduct({ ...newProduct, image: e.target.value })}
                />
                <textarea
                  placeholder="Description"
                  className="w-full border border-gray-700 px-3 py-2 rounded-md text-white bg-gray-800 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-white transition-colors"
                  value={newProduct.description}
                  onChange={(e) => setNewProduct({ ...newProduct, description: e.target.value })}
                />
                <div className="flex gap-4">
                  <input
                    type="number"
                    placeholder="Price"
                    className="w-full border border-gray-700 px-3 py-2 rounded-md text-white bg-gray-800 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-white transition-colors"
                    value={newProduct.price}
                    onChange={(e) => setNewProduct({ ...newProduct, price: e.target.value })}
                  />
                  <input
                    type="number"
                    placeholder="In Store (Stock)"
                    className="w-full border border-gray-700 px-3 py-2 rounded-md text-white bg-gray-800 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-white transition-colors"
                    value={newProduct.stock}
                    onChange={(e) => setNewProduct({ ...newProduct, stock: e.target.value })}
                  />
                </div>
              </div>
              <div className="mt-6 flex justify-end gap-3">
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-md text-gray-400 hover:text-white transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveProduct}
                  disabled={isSaving}
                  className="bg-white text-black px-4 py-2 rounded-md hover:bg-gray-200 transition-colors disabled:opacity-50"
                >
                  {isSaving ? "Saving..." : "Save Product"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Delete Confirmation Modal */}
        {productToDelete && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
            <div className="bg-gray-900 border border-gray-800 p-6 rounded-lg w-full max-w-sm shadow-xl text-center">
              <h2 className="text-xl font-semibold text-white mb-2">Delete Product</h2>
              <p className="text-gray-400 mb-6">Are you sure you want to delete this product? This action cannot be undone.</p>
              <div className="flex justify-center gap-3">
                <button
                  onClick={() => setProductToDelete(null)}
                  className="px-4 py-2 rounded-md text-gray-400 hover:text-white transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmDelete}
                  disabled={isDeleting}
                  className="bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700 transition-colors disabled:opacity-50"
                >
                  {isDeleting ? "Deleting..." : "Delete"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* New Social Profile Modal */}
        {isSocialModalOpen && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
            <div className="bg-gray-900 border border-gray-800 p-6 rounded-lg w-full max-w-md shadow-xl">
              <h2 className="text-xl font-semibold text-white mb-4">
                {editingSocialId ? "Edit Social Profile" : "Add Social Info"}
              </h2>
              <div className="space-y-4">
                <input
                  type="text"
                  placeholder="Platform Name (e.g. Instagram, Website)"
                  className="w-full border border-gray-700 px-3 py-2 rounded-md text-white bg-gray-800 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors"
                  value={newSocial.platform_name}
                  onChange={(e) => setNewSocial({ ...newSocial, platform_name: e.target.value })}
                />
                <input
                  type="text"
                  placeholder="Platform Logo/Icon (Image URL)"
                  className="w-full border border-gray-700 px-3 py-2 rounded-md text-white bg-gray-800 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors"
                  value={newSocial.platform_icon}
                  onChange={(e) => setNewSocial({ ...newSocial, platform_icon: e.target.value })}
                />
                <textarea
                  placeholder="Description or extra info"
                  className="w-full border border-gray-700 px-3 py-2 rounded-md text-white bg-gray-800 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors"
                  value={newSocial.description}
                  onChange={(e) => setNewSocial({ ...newSocial, description: e.target.value })}
                />
                <input
                  type="text"
                  placeholder="Profile Link (URL)"
                  className="w-full border border-gray-700 px-3 py-2 rounded-md text-white bg-gray-800 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors"
                  value={newSocial.profile_link}
                  onChange={(e) => setNewSocial({ ...newSocial, profile_link: e.target.value })}
                />
                <input
                  type="text"
                  placeholder="Username"
                  className="w-full border border-gray-700 px-3 py-2 rounded-md text-white bg-gray-800 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors"
                  value={newSocial.username}
                  onChange={(e) => setNewSocial({ ...newSocial, username: e.target.value })}
                />
                <input
                  type="email"
                  placeholder="Email"
                  className="w-full border border-gray-700 px-3 py-2 rounded-md text-white bg-gray-800 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors"
                  value={newSocial.email}
                  onChange={(e) => setNewSocial({ ...newSocial, email: e.target.value })}
                />
                <input
                  type="password"
                  placeholder="Password"
                  className="w-full border border-gray-700 px-3 py-2 rounded-md text-white bg-gray-800 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors"
                  value={newSocial.password}
                  onChange={(e) => setNewSocial({ ...newSocial, password: e.target.value })}
                />
              </div>
              <div className="mt-6 flex justify-end gap-3">
                <button
                  onClick={() => setIsSocialModalOpen(false)}
                  className="px-4 py-2 rounded-md text-gray-400 hover:text-white transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveSocial}
                  disabled={isSavingSocial || !newSocial.platform_name || !newSocial.profile_link}
                  className="bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSavingSocial ? "Saving..." : "Save Info"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Delete Social Confirmation Modal */}
        {socialToDelete && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
            <div className="bg-gray-900 border border-gray-800 p-6 rounded-lg w-full max-w-sm shadow-xl text-center">
              <h2 className="text-xl font-semibold text-white mb-2">Delete Profile</h2>
              <p className="text-gray-400 mb-6">Are you sure you want to delete this social profile? This action cannot be undone.</p>
              <div className="flex justify-center gap-3">
                <button
                  onClick={() => setSocialToDelete(null)}
                  className="px-4 py-2 rounded-md text-gray-400 hover:text-white transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmDeleteSocial}
                  disabled={isDeleting}
                  className="bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700 transition-colors disabled:opacity-50"
                >
                  {isDeleting ? "Deleting..." : "Delete"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* New Update Modal */}
        {isUpdateModalOpen && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
            <div className="bg-gray-900 border border-gray-800 p-6 rounded-lg w-full max-w-xl shadow-xl">
              <h2 className="text-xl font-semibold text-white mb-4">
                {editingUpdateId ? "Edit Update" : "Add New Update"}
              </h2>
              <div className="space-y-4">
                <input
                  type="text"
                  placeholder="Info / Title (e.g. System Maintenance, New Feature)"
                  className="w-full border border-gray-700 px-3 py-2 rounded-md text-white bg-gray-800 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-colors"
                  value={newUpdate.info}
                  onChange={(e) => setNewUpdate({ ...newUpdate, info: e.target.value })}
                />
                <textarea
                  placeholder="Snippets or Comments..."
                  rows={6}
                  className="w-full border border-gray-700 px-3 py-2 rounded-md text-white bg-gray-800 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-colors resize-y"
                  value={newUpdate.content}
                  onChange={(e) => setNewUpdate({ ...newUpdate, content: e.target.value })}
                />
                <input
                  type="text"
                  placeholder="Relevant Link (Optional URL)"
                  className="w-full border border-gray-700 px-3 py-2 rounded-md text-white bg-gray-800 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-colors"
                  value={newUpdate.link}
                  onChange={(e) => setNewUpdate({ ...newUpdate, link: e.target.value })}
                />
              </div>
              <div className="mt-6 flex justify-end gap-3">
                <button onClick={() => setIsUpdateModalOpen(false)} className="px-4 py-2 rounded-md text-gray-400 hover:text-white transition-colors">
                  Cancel
                </button>
                <button onClick={handleSaveUpdate} disabled={isSavingUpdate || !newUpdate.info || !newUpdate.content} className="bg-emerald-600 text-white px-4 py-2 rounded-md hover:bg-emerald-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                  {isSavingUpdate ? "Saving..." : "Post Update"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Delete Update Confirmation Modal */}
        {updateToDelete && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
            <div className="bg-gray-900 border border-gray-800 p-6 rounded-lg w-full max-w-sm shadow-xl text-center">
              <h2 className="text-xl font-semibold text-white mb-2">Delete Update</h2>
              <p className="text-gray-400 mb-6">Are you sure you want to delete this update? This action cannot be undone.</p>
              <div className="flex justify-center gap-3">
                <button onClick={() => setUpdateToDelete(null)} className="px-4 py-2 rounded-md text-gray-400 hover:text-white transition-colors">
                  Cancel
                </button>
                <button onClick={confirmDeleteUpdate} disabled={isDeleting} className="bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700 transition-colors disabled:opacity-50">
                  {isDeleting ? "Deleting..." : "Delete"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Toast Message */}
        {toast && (
          <div
            className={`fixed bottom-4 right-4 px-6 py-3 rounded-md shadow-lg text-white z-[100] transition-all ${toast.type === "success" ? "bg-green-600" : "bg-red-600"}`}
          >
            {toast.message}
          </div>
        )}

      </div>
    </div>
  );
}