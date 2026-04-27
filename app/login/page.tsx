"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import Navbar from "@/components/Navbar";
export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const showToast = (message: string, type: "success" | "error") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };
  const handleLogin = async () => {
    setIsLoading(true);
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/dashboard`,
      },
    });

    if (error) showToast(error.message, "error");
    else showToast("Check your email for login link 🚀", "success");
    setIsLoading(false);
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
          disabled={isLoading || !email}
          className="w-full bg-white text-black py-2 rounded-md hover:bg-gray-200 transition-colors flex justify-center items-center disabled:opacity-70 disabled:cursor-not-allowed"
        >
          {isLoading ? (
            <>
              <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-black" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Sending...
            </>
          ) : (
            "Send Magic Link"
          )}
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