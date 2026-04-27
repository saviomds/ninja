"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import Navbar from "@/components/Navbar";
export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const showToast = (message: string, type: "success" | "error") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const handleLogin = async () => {
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/dashboard`,
      },
    });

    if (error) showToast(error.message, "error");
    else showToast("Check your email for login link 🚀", "success");
  };

  return (
    <>
       <Navbar />
    <div className="min-h-screen flex items-center justify-center bg-gray-950">
      <div className="bg-gray-900 p-6 rounded-lg shadow w-80 border border-gray-800">
        <h1 className="text-xl font-semibold mb-4 text-white">Login</h1>

        <input
          type="email"
          placeholder="Your email"
          className="w-full border border-gray-700 px-3 py-2 mb-4 rounded-md text-white bg-gray-800 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-white transition-colors"
          onChange={(e) => setEmail(e.target.value)}
        />

        <button
          onClick={handleLogin}
          className="w-full bg-white text-black py-2 rounded-md hover:bg-gray-200 transition-colors"
        >
          Send Magic Link
        </button>
      </div>

      {/* Toast Message */}
      {toast && (
        <div
          className={`fixed bottom-4 right-4 px-6 py-3 rounded-md shadow-lg text-white z-[100] transition-all ${toast.type === "success" ? "bg-green-600" : "bg-red-600"}`}
        >
          {toast.message}
        </div>
      )}
    </div>
    </>
  );
}