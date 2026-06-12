"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

interface Comment {
  id: string;
  name: string;
  message: string;
  created_at: string;
  rating?: number;
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

  const handleDeleteAll = async () => {
    if (!confirm("Delete ALL comments? This cannot be undone.")) return;
    const { error } = await supabase.from("comments").delete().neq("id", "");
    if (!error) {
      setComments([]);
    } else {
      console.error("Error deleting all comments:", error);
      alert("Failed to delete all comments. Check your RLS policies in Supabase.");
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8 md:p-12 font-sans text-gray-900">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-semibold">Manage Comments</h1>
          {comments.length > 0 && (
            <button
              onClick={handleDeleteAll}
              className="px-5 py-2.5 bg-red-600 text-white rounded-full text-sm font-semibold hover:bg-red-700 transition-colors"
            >
              Delete All
            </button>
          )}
        </div>
        
        {loading ? (
          <p className="text-gray-500 font-light">Loading comments...</p>
        ) : (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100 text-sm text-gray-500">
                  <th className="p-5 font-medium">Name</th>
                  <th className="p-5 font-medium">Rating</th>
                  <th className="p-5 font-medium">Message</th>
                  <th className="p-5 font-medium">Date</th>
                  <th className="p-5 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {comments.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-gray-400 font-light">
                      No comments found.
                    </td>
                  </tr>
                ) : (
                  comments.map((comment) => (
                    <tr key={comment.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/50 transition-colors">
                      <td className="p-5 font-medium">{comment.name}</td>
                      <td className="p-5">
                        {comment.rating ? (
                          <div className="flex items-center gap-0.5">
                            {Array.from({ length: comment.rating }).map((_, i) => (
                              <svg key={i} className="w-4 h-4 text-amber-400" viewBox="0 0 20 20" fill="currentColor">
                                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                              </svg>
                            ))}
                          </div>
                        ) : (
                          <span className="text-gray-300">—</span>
                        )}
                      </td>
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
