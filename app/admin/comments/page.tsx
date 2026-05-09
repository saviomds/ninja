"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

interface Comment {
  id: string;
  name: string;
  message: string;
  created_at: string;
}

export default function AdminCommentsPage() {
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchComments();
  }, []);

  const fetchComments = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("comments")
      .select("*")
      .order("created_at", { ascending: false });
      
    if (data) setComments(data);
    if (error) console.error("Error fetching comments:", error);
    setLoading(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this comment?")) return;
    
    const { error } = await supabase.from("comments").delete().eq("id", id);
    
    if (!error) {
      setComments((prev) => prev.filter((c) => c.id !== id));
    } else {
      console.error("Error deleting comment:", error);
      alert("Failed to delete comment. Check your RLS policies in Supabase.");
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8 md:p-12 font-sans text-gray-900">
      <div className="max-w-5xl mx-auto">
        <h1 className="text-3xl font-semibold mb-8">Manage Comments</h1>
        
        {loading ? (
          <p className="text-gray-500 font-light">Loading comments...</p>
        ) : (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100 text-sm text-gray-500">
                  <th className="p-5 font-medium">Name</th>
                  <th className="p-5 font-medium">Message</th>
                  <th className="p-5 font-medium">Date</th>
                  <th className="p-5 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {comments.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="p-8 text-center text-gray-400 font-light">
                      No comments found.
                    </td>
                  </tr>
                ) : (
                  comments.map((comment) => (
                    <tr key={comment.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/50 transition-colors">
                      <td className="p-5 font-medium">{comment.name}</td>
                      <td className="p-5 text-gray-600 font-light max-w-xs truncate" title={comment.message}>{comment.message}</td>
                      <td className="p-5 text-sm text-gray-400 font-light">{new Date(comment.created_at).toLocaleString()}</td>
                      <td className="p-5 text-right">
                        <button
                          onClick={() => handleDelete(comment.id)}
                          className="px-4 py-2 bg-red-50 text-red-600 rounded-full text-sm font-medium hover:bg-red-100 transition-colors"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
