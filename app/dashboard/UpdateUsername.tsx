"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";

export default function UpdateUsername({ userId, currentUsername, onUpdate }: { userId: string, currentUsername: string | null, onUpdate: () => void }) {
  const [username, setUsername] = useState(currentUsername || "");
  const [isUpdating, setIsUpdating] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    setUsername(currentUsername || "");
  }, [currentUsername]);

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsUpdating(true);
    setMessage("");

    // Update the profile where the ID matches the logged-in user
    const { error } = await supabase
      .from("profiles")
      .update({ username: username })
      .eq("id", userId);

    if (error) {
      setMessage(`Error: ${error.message}`);
    } else {
      setMessage("Username updated successfully!");
      onUpdate(); // Callback to refresh profile data in parent
    }
    
    setIsUpdating(false);
  };

  return (
    <form onSubmit={handleUpdate} className="flex flex-col gap-4 max-w-sm bg-gray-900/40 backdrop-blur-md border border-gray-800 rounded-2xl p-6">
      <label className="text-sm font-medium text-gray-300">Set your Username</label>
      <input
        type="text"
        value={username}
        onChange={(e) => setUsername(e.target.value)}
        placeholder="e.g. tech_ninja"
        className="bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-base md:text-sm text-white focus:outline-none focus:border-indigo-500"
        required
      />
      <button type="submit" disabled={isUpdating || !username} className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-2 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
        {isUpdating ? "Saving..." : "Save Username"}
      </button>
      {message && <p className={`text-sm mt-2 ${message.startsWith("Error") ? 'text-red-400' : 'text-green-400'}`}>{message}</p>}
    </form>
  );
}