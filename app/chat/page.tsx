"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import { User } from "@supabase/supabase-js";
import Image from "next/image";
import Navbar from "@/components/Navbar";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Profile {
  id: string;
  username: string | null;
  full_name: string | null;
  avatar_url: string | null;
  bio?: string | null;
  location?: string | null;
  phone?: string | null;
  email?: string | null;
  created_at?: string | null;
}

interface ChatMessage {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  created_at: string;
  reply_to: string | null;
  is_deleted: boolean;
  sender: Profile | null;
}

interface Participant {
  user_id: string;
  last_read_at: string;
  profile: Profile | null;
}

interface Conversation {
  id: string;
  created_at: string;
  last_message: string | null;
  last_message_at: string | null;
  participants: Participant[];
  unread_count: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function userName(p: Profile | null | undefined): string {
  if (!p) return "Unknown";
  return p.username || p.full_name || p.email || "User";
}

function sidebarTime(d: string) {
  const date = new Date(d), now = new Date();
  const mins = Math.floor((now.getTime() - date.getTime()) / 60000);
  if (mins < 1)    return "now";
  if (mins < 60)   return `${mins}m`;
  if (mins < 1440) return date.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
  if (mins < 10080) return date.toLocaleDateString("en-US", { weekday: "short" });
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function msgTime(d: string) {
  const date = new Date(d), now = new Date();
  const yest = new Date(now); yest.setDate(yest.getDate() - 1);
  const t = date.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
  if (date.toDateString() === now.toDateString()) return t;
  if (date.toDateString() === yest.toDateString()) return `Yesterday ${t}`;
  return `${date.toLocaleDateString("en-US", { month: "short", day: "numeric" })} ${t}`;
}

function dateSep(d: string) {
  const date = new Date(d), now = new Date();
  const yest = new Date(now); yest.setDate(yest.getDate() - 1);
  if (date.toDateString() === now.toDateString()) return "Today";
  if (date.toDateString() === yest.toDateString()) return "Yesterday";
  return date.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
}

function diffDay(a: string, b: string) {
  return new Date(a).toDateString() !== new Date(b).toDateString();
}

// ─── Avatar ───────────────────────────────────────────────────────────────────

function Avatar({ profile, size = 40 }: { profile: Profile | null | undefined; size?: number }) {
  const name = userName(profile);
  if (profile?.avatar_url) {
    return (
      <Image src={profile.avatar_url} alt={name} width={size} height={size} unoptimized
        className="w-full h-full object-cover rounded-full" />
    );
  }
  return (
    <span className="w-full h-full rounded-full flex items-center justify-center font-bold text-white bg-gradient-to-br from-blue-500 to-violet-600"
      style={{ fontSize: size * 0.38 }}>
      {name.charAt(0).toUpperCase()}
    </span>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function ChatPage() {
  const router = useRouter();

  const [currentUser,    setCurrentUser]    = useState<User | null>(null);
  const [currentProfile, setCurrentProfile] = useState<Profile | null>(null);
  const [isAdmin,        setIsAdmin]        = useState(false);
  const [loading,        setLoading]        = useState(true);
  const [tablesReady,    setTablesReady]    = useState(true);

  const [conversations,    setConversations]    = useState<Conversation[]>([]);
  const [activeConvo,      setActiveConvo]      = useState<Conversation | null>(null);
  const [messages,         setMessages]         = useState<ChatMessage[]>([]);
  const [loadingMessages,  setLoadingMessages]  = useState(false);
  const [allUsers,         setAllUsers]         = useState<Profile[]>([]);

  const [draft,     setDraft]     = useState("");
  const [sending,   setSending]   = useState(false);
  const [replyTo,   setReplyTo]   = useState<ChatMessage | null>(null);
  const [starting,  setStarting]  = useState(false);

  const [mobileView,   setMobileView]   = useState<"list" | "chat">("list");
  const [showNewChat,  setShowNewChat]  = useState(false);
  const [convoSearch,  setConvoSearch]  = useState("");
  const [userSearch,   setUserSearch]   = useState("");
  const [toast,        setToast]        = useState<{ msg: string; ok: boolean } | null>(null);

  const [typingUsers,  setTypingUsers]  = useState<Set<string>>(new Set());
  const [onlineUsers,  setOnlineUsers]  = useState<Set<string>>(new Set());
  const [profileView,  setProfileView]  = useState<Profile | null>(null);

  const bottomRef     = useRef<HTMLDivElement>(null);
  const textareaRef   = useRef<HTMLTextAreaElement>(null);
  const msgCh         = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const presCh        = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const typingTimer   = useRef<ReturnType<typeof setTimeout> | null>(null);
  const currentUserId = useRef<string>("");

  // ── Toast ─────────────────────────────────────────────────────────────────

  function showToast(msg: string, ok = true) {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 4000);
  }

  // ── Fetch helpers ─────────────────────────────────────────────────────────

  async function fetchProfiles(ids: string[]): Promise<Record<string, Profile>> {
    if (!ids.length) return {};
    const { data } = await supabase
      .from("profiles")
      .select("id, username, full_name, avatar_url, bio, location, phone, email, created_at")
      .in("id", ids);
    const map: Record<string, Profile> = {};
    (data || []).forEach(p => { map[p.id] = p; });
    return map;
  }

  async function loadConversations(uid: string) {
    const { data: parts, error: partsErr } = await supabase
      .from("chat_participants")
      .select("conversation_id, last_read_at")
      .eq("user_id", uid);

    if (partsErr) return;
    if (!parts?.length) { setConversations([]); return; }

    const ids = parts.map(p => p.conversation_id);
    const readMap: Record<string, string> = {};
    parts.forEach(p => { readMap[p.conversation_id] = p.last_read_at; });

    const { data: convos } = await supabase
      .from("chat_conversations")
      .select("id, created_at, last_message, last_message_at")
      .in("id", ids)
      .order("last_message_at", { ascending: false });

    if (!convos) { setConversations([]); return; }

    // For each convo, get participant user_ids then load profiles separately
    const enriched: Conversation[] = await Promise.all(convos.map(async (c) => {
      const { data: ps } = await supabase
        .from("chat_participants")
        .select("user_id, last_read_at")
        .eq("conversation_id", c.id);

      const participantIds = (ps || []).map(p => p.user_id);
      const profileMap = await fetchProfiles(participantIds);

      const { count: unread } = await supabase
        .from("chat_messages")
        .select("id", { count: "exact", head: true })
        .eq("conversation_id", c.id)
        .eq("is_deleted", false)
        .neq("sender_id", uid)
        .gt("created_at", readMap[c.id] || "1970-01-01");

      return {
        ...c,
        participants: (ps || []).map(p => ({
          user_id: p.user_id,
          last_read_at: p.last_read_at,
          profile: profileMap[p.user_id] || null,
        })),
        unread_count: unread || 0,
      };
    }));

    setConversations(enriched);
  }

  async function loadAllUsers(uid: string) {
    const { data, error } = await supabase
      .from("profiles")
      .select("id, username, full_name, avatar_url")
      .neq("id", uid)
      .order("username", { nullsFirst: false });

    if (error) {
      console.error("loadAllUsers error:", error);
    }
    setAllUsers(data || []);
  }

  async function loadMessages(convoId: string) {
    setLoadingMessages(true);
    const { data, error } = await supabase
      .from("chat_messages")
      .select("id, conversation_id, sender_id, content, created_at, reply_to, is_deleted")
      .eq("conversation_id", convoId)
      .order("created_at", { ascending: true })
      .limit(200);

    if (error) { setLoadingMessages(false); return; }

    // Fetch all unique sender profiles in one go
    const senderIds = [...new Set((data || []).map(m => m.sender_id))];
    const profileMap = await fetchProfiles(senderIds);

    const enriched: ChatMessage[] = (data || []).map(m => ({
      ...m,
      sender: profileMap[m.sender_id] || null,
    }));

    setMessages(enriched);
    setLoadingMessages(false);
  }

  // ── Realtime ──────────────────────────────────────────────────────────────

  function subscribeToConvo(convoId: string) {
    if (msgCh.current) supabase.removeChannel(msgCh.current);
    const uid = currentUserId.current;

    const ch = supabase.channel(`chat:${convoId}`)
      .on("postgres_changes",
        { event: "INSERT", schema: "public", table: "chat_messages", filter: `conversation_id=eq.${convoId}` },
        async (payload) => {
          const row = payload.new as ChatMessage;
          const profileMap = await fetchProfiles([row.sender_id]);
          const newMsg: ChatMessage = { ...row, sender: profileMap[row.sender_id] || null };
          setMessages(prev => [...prev, newMsg]);
          loadConversations(uid);
          await supabase.from("chat_participants")
            .update({ last_read_at: new Date().toISOString() })
            .eq("conversation_id", convoId).eq("user_id", uid);
        }
      )
      .on("postgres_changes",
        { event: "UPDATE", schema: "public", table: "chat_messages", filter: `conversation_id=eq.${convoId}` },
        (payload) => {
          setMessages(prev => prev.map(m => m.id === payload.new.id ? { ...m, ...(payload.new as ChatMessage) } : m));
        }
      )
      .on("broadcast", { event: "typing" }, ({ payload }) => {
        if (payload.user_id === uid) return;
        setTypingUsers(prev => {
          const s = new Set(prev);
          payload.isTyping ? s.add(payload.user_id) : s.delete(payload.user_id);
          return s;
        });
      })
      .subscribe();

    msgCh.current = ch;
  }

  // ── Open conversation ─────────────────────────────────────────────────────

  async function openConvo(convo: Conversation) {
    setActiveConvo(convo);
    setMobileView("chat");
    setReplyTo(null);
    setTypingUsers(new Set());
    setMessages([]);
    await loadMessages(convo.id);
    subscribeToConvo(convo.id);

    const uid = currentUserId.current;
    if (uid) {
      await supabase.from("chat_participants")
        .update({ last_read_at: new Date().toISOString() })
        .eq("conversation_id", convo.id).eq("user_id", uid);
      setConversations(prev => prev.map(c => c.id === convo.id ? { ...c, unread_count: 0 } : c));
    }
  }

  // ── Start / find conversation ─────────────────────────────────────────────

  async function startConvo(otherId: string) {
    const uid = currentUserId.current;
    if (!uid || starting) return;
    setStarting(true);
    setShowNewChat(false);

    try {
      // ── Step 1: look for an existing 1-to-1 conversation ─────────────────
      const { data: myParts } = await supabase
        .from("chat_participants")
        .select("conversation_id")
        .eq("user_id", uid);

      const myIds = (myParts || []).map(p => p.conversation_id);
      let targetId: string | null = null;
      let isNew = false;

      if (myIds.length > 0) {
        const { data: otherParts } = await supabase
          .from("chat_participants")
          .select("conversation_id")
          .eq("user_id", otherId)
          .in("conversation_id", myIds);

        if (otherParts && otherParts.length > 0) {
          targetId = otherParts[0].conversation_id;
        }
      }

      // ── Step 2: create if not found ───────────────────────────────────────
      if (!targetId) {
        isNew = true;
        const newId = crypto.randomUUID();

        const { error: ce } = await supabase
          .from("chat_conversations")
          .insert({ id: newId, last_message: null, last_message_at: new Date().toISOString() });

        if (ce) {
          showToast(`Could not create conversation: ${ce.message}`, false);
          setStarting(false);
          return;
        }

        const { error: pe } = await supabase.from("chat_participants").insert([
          { conversation_id: newId, user_id: uid,     last_read_at: new Date().toISOString() },
          { conversation_id: newId, user_id: otherId, last_read_at: "1970-01-01T00:00:00Z" },
        ]);

        if (pe) {
          showToast(`Could not add participants: ${pe.message}`, false);
          setStarting(false);
          return;
        }

        targetId = newId;
      }

      // ── Step 3: build the Conversation object ─────────────────────────────
      // For NEW convos: build client-side — avoids a SELECT that could fail
      // because the RLS policy checks chat_participants, and Postgres may not
      // see the just-inserted rows yet within the same request context.
      // For EXISTING convos: reuse state if available, else fetch from DB.
      let builtConvo: Conversation;

      if (isNew) {
        const otherProfile = allUsers.find(u => u.id === otherId) || null;
        builtConvo = {
          id: targetId,
          created_at: new Date().toISOString(),
          last_message: null,
          last_message_at: new Date().toISOString(),
          participants: [
            { user_id: uid,     last_read_at: new Date().toISOString(), profile: currentProfile },
            { user_id: otherId, last_read_at: "1970-01-01T00:00:00Z",   profile: otherProfile },
          ],
          unread_count: 0,
        };
      } else {
        // Try state first (instant, no round-trip)
        const cached = conversations.find(c => c.id === targetId);
        if (cached) {
          builtConvo = cached;
        } else {
          // Fetch from DB — participant row exists so RLS passes
          const { data: convoRow, error: fe } = await supabase
            .from("chat_conversations")
            .select("id, created_at, last_message, last_message_at")
            .eq("id", targetId)
            .single();

          if (fe || !convoRow) {
            showToast(`Could not load conversation: ${fe?.message ?? "not found"}`, false);
            setStarting(false);
            return;
          }

          const { data: partsRows } = await supabase
            .from("chat_participants")
            .select("user_id, last_read_at")
            .eq("conversation_id", targetId);

          const profileMap = await fetchProfiles((partsRows || []).map(p => p.user_id));
          builtConvo = {
            ...convoRow,
            participants: (partsRows || []).map(p => ({
              user_id: p.user_id,
              last_read_at: p.last_read_at,
              profile: profileMap[p.user_id] || null,
            })),
            unread_count: 0,
          };
        }
      }

      // ── Step 4: update sidebar + open ─────────────────────────────────────
      setConversations(prev => {
        const exists = prev.some(c => c.id === targetId);
        return exists
          ? prev.map(c => c.id === targetId ? builtConvo : c)
          : [builtConvo, ...prev];
      });

      await openConvo(builtConvo);
    } catch (err) {
      console.error("startConvo error:", err);
      showToast("Something went wrong — check browser console for details.", false);
    }

    setStarting(false);
  }

  // ── Send message ──────────────────────────────────────────────────────────

  async function sendMessage() {
    const uid = currentUserId.current;
    if (!draft.trim() || !activeConvo || !uid || sending) return;
    const content = draft.trim();
    setSending(true);
    setDraft("");
    if (textareaRef.current) textareaRef.current.style.height = "auto";

    const { error } = await supabase.from("chat_messages").insert({
      conversation_id: activeConvo.id,
      sender_id: uid,
      content,
      reply_to: replyTo?.id || null,
    });

    if (error) {
      showToast(`Send failed: ${error.message}`, false);
      setDraft(content); // restore draft so the user doesn't lose their message
    } else {
      await supabase.from("chat_conversations")
        .update({ last_message: content, last_message_at: new Date().toISOString() })
        .eq("id", activeConvo.id);
      setReplyTo(null);
    }

    setSending(false);
    msgCh.current?.send({ type: "broadcast", event: "typing", payload: { user_id: uid, isTyping: false } });
  }

  function handleTyping() {
    const uid = currentUserId.current;
    if (!uid || !msgCh.current) return;
    msgCh.current.send({ type: "broadcast", event: "typing", payload: { user_id: uid, isTyping: true } });
    if (typingTimer.current) clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(() => {
      msgCh.current?.send({ type: "broadcast", event: "typing", payload: { user_id: uid, isTyping: false } });
    }, 2500);
  }

  async function deleteMessage(msgId: string) {
    await supabase.from("chat_messages").update({ is_deleted: true }).eq("id", msgId);
  }

  // ── Init ──────────────────────────────────────────────────────────────────

  useEffect(() => {
    let alive = true;

    (async () => {
      const { data: authData } = await supabase.auth.getUser();
      const u = authData?.user;
      if (!u) { router.replace("/login"); return; }

      currentUserId.current = u.id;
      const role = u.user_metadata?.role || u.app_metadata?.role;

      // Check tables exist
      const { error: tableErr } = await supabase
        .from("chat_conversations")
        .select("id")
        .limit(1);

      if (tableErr?.code === "42P01" || tableErr?.message?.includes("does not exist")) {
        if (alive) { setTablesReady(false); setLoading(false); }
        return;
      }

      const { data: prof } = await supabase
        .from("profiles")
        .select("id, username, full_name, avatar_url, bio, location, phone, created_at")
        .eq("id", u.id)
        .single();

      if (!alive) return;
      setCurrentUser(u);
      setCurrentProfile(prof);
      setIsAdmin(role === "admin");

      await Promise.all([loadConversations(u.id), loadAllUsers(u.id)]);
      if (alive) setLoading(false);

      // Presence
      const pc = supabase.channel("presence:ninja", { config: { presence: { key: u.id } } });
      pc
        .on("presence", { event: "sync" }, () => setOnlineUsers(new Set(Object.keys(pc.presenceState()))))
        .on("presence", { event: "join" }, ({ key }) => setOnlineUsers(p => new Set([...p, key])))
        .on("presence", { event: "leave" }, ({ key }) => setOnlineUsers(p => { const s = new Set(p); s.delete(key); return s; }))
        .subscribe(async st => { if (st === "SUBSCRIBED") await pc.track({ user_id: u.id }); });
      presCh.current = pc;
    })();

    return () => {
      alive = false;
      if (presCh.current) supabase.removeChannel(presCh.current);
      if (msgCh.current)  supabase.removeChannel(msgCh.current);
    };
  }, [router]);

  // Auto-scroll
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, typingUsers]);

  // ── Derived ───────────────────────────────────────────────────────────────

  const otherOf = (c: Conversation) => c.participants.find(p => p.user_id !== currentUserId.current);

  const filteredConvos = conversations.filter(c => {
    if (!convoSearch) return true;
    return userName(otherOf(c)?.profile).toLowerCase().includes(convoSearch.toLowerCase());
  });

  const filteredUsers = allUsers.filter(u =>
    !userSearch || userName(u).toLowerCase().includes(userSearch.toLowerCase())
  );

  const typingNames = [...typingUsers].map(uid => {
    const p = activeConvo?.participants.find(p => p.user_id === uid);
    return p ? userName(p.profile) : "Someone";
  });

  // ── Tables not ready screen ───────────────────────────────────────────────

  if (!loading && !tablesReady) {
    return (
      <div className="min-h-screen bg-white dark:bg-gray-950 flex flex-col">
        <Navbar />
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="max-w-md w-full bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 rounded-3xl p-8 text-center">
            <div className="text-5xl mb-4">⚠️</div>
            <h2 className="text-lg font-bold text-amber-900 dark:text-amber-200 mb-2">Chat Setup Required</h2>
            <p className="text-sm text-amber-700 dark:text-amber-300 mb-4 leading-relaxed">
              The chat database tables have not been created yet. Run the SQL migration file in your Supabase SQL Editor to enable chat.
            </p>
            <div className="bg-white dark:bg-gray-900 border border-amber-200 dark:border-amber-500/30 rounded-xl px-4 py-3 text-left text-xs font-mono text-gray-600 dark:text-gray-400 mb-5">
              supabase-chat-migration.sql
            </div>
            <p className="text-xs text-amber-600 dark:text-amber-400">
              Go to <strong>Supabase Dashboard → SQL Editor</strong>, paste the contents of that file, and click Run.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ── Loading screen ────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="min-h-screen bg-white dark:bg-gray-950 flex flex-col">
        <Navbar />
        <div className="flex-1 flex items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <div className="w-10 h-10 border-[3px] border-blue-600 border-t-transparent rounded-full animate-spin" />
            <p className="text-sm text-gray-400 dark:text-gray-500">Loading messages…</p>
          </div>
        </div>
      </div>
    );
  }

  // ── Main render ───────────────────────────────────────────────────────────

  return (
    <div className="h-[100dvh] bg-white dark:bg-gray-950 flex flex-col overflow-hidden">
      <Navbar />

      <div className="flex flex-1 overflow-hidden min-h-0">

        {/* ══════════ SIDEBAR ══════════════════════════════════════════════════ */}
        <aside className={`
          flex-col w-full md:w-72 lg:w-80 xl:w-96 flex-shrink-0
          border-r border-gray-200 dark:border-gray-800
          bg-white dark:bg-gray-950
          ${mobileView === "chat" ? "hidden md:flex" : "flex"}
        `}>

          {/* Header */}
          <div className="px-4 pt-4 pb-3 border-b border-gray-100 dark:border-gray-800 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-lg font-bold text-gray-900 dark:text-white">Messages</h1>
                {isAdmin && (
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-violet-500">
                    Admin · All chats visible
                  </span>
                )}
              </div>
              <button
                onClick={() => setShowNewChat(true)}
                className="w-9 h-9 flex items-center justify-center rounded-xl bg-blue-600 hover:bg-blue-700 active:scale-95 text-white transition-all shadow-sm"
                title="New conversation"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
              </button>
            </div>

            <div className="flex items-center gap-2 bg-gray-100 dark:bg-gray-900 border border-transparent dark:border-gray-800 rounded-xl px-3 py-2 focus-within:border-blue-500 transition-all">
              <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input value={convoSearch} onChange={e => setConvoSearch(e.target.value)}
                placeholder="Search conversations…"
                className="flex-1 bg-transparent text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none" />
            </div>
          </div>

          {/* Conversation list */}
          <div className="flex-1 overflow-y-auto">
            {filteredConvos.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full gap-4 p-8 text-center">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-50 to-violet-50 dark:from-blue-500/10 dark:to-violet-500/10 flex items-center justify-center text-3xl">💬</div>
                <div>
                  <p className="text-sm font-bold text-gray-900 dark:text-white mb-1">No conversations yet</p>
                  <p className="text-xs text-gray-400 dark:text-gray-500">Press + to start chatting</p>
                </div>
                <button onClick={() => setShowNewChat(true)}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl transition-colors">
                  New conversation
                </button>
              </div>
            ) : (
              filteredConvos.map(convo => {
                const other = otherOf(convo);
                const isActive = activeConvo?.id === convo.id;
                const online = other ? onlineUsers.has(other.user_id) : false;
                return (
                  <button key={convo.id} onClick={() => openConvo(convo)}
                    className={`
                      w-full flex items-center gap-3 px-4 py-3 text-left
                      border-b border-gray-100 dark:border-gray-800/60 transition-colors active:scale-[0.99]
                      ${isActive ? "bg-blue-50 dark:bg-blue-500/[0.08]" : "hover:bg-gray-50 dark:hover:bg-gray-900/60"}
                    `}>
                    <div className="relative w-11 h-11 flex-shrink-0">
                      <div className="w-full h-full rounded-full overflow-hidden border-2 border-gray-200 dark:border-gray-700">
                        <Avatar profile={other?.profile} size={44} />
                      </div>
                      {online && <span className="absolute bottom-0.5 right-0.5 w-2.5 h-2.5 bg-emerald-500 rounded-full border-2 border-white dark:border-gray-950" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1 mb-0.5">
                        <span className={`text-sm font-semibold truncate ${isActive ? "text-blue-700 dark:text-blue-300" : "text-gray-900 dark:text-white"}`}>
                          {userName(other?.profile)}
                        </span>
                        {convo.last_message_at && (
                          <span className="text-[10px] text-gray-400 dark:text-gray-500 flex-shrink-0">
                            {sidebarTime(convo.last_message_at)}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center justify-between gap-1">
                        <p className={`text-xs truncate ${convo.unread_count > 0 ? "font-semibold text-gray-800 dark:text-gray-200" : "text-gray-400 dark:text-gray-500"}`}>
                          {convo.last_message || "Say hello!"}
                        </p>
                        {convo.unread_count > 0 && (
                          <span className="flex-shrink-0 min-w-[18px] h-[18px] px-1 bg-blue-600 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                            {convo.unread_count > 9 ? "9+" : convo.unread_count}
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </aside>

        {/* ══════════ CHAT AREA ════════════════════════════════════════════════ */}
        <section className={`
          flex-1 flex flex-col overflow-hidden min-w-0
          bg-gray-50/40 dark:bg-[#0b0f1a]
          ${mobileView === "list" ? "hidden md:flex" : "flex"}
        `}>
          {activeConvo ? (() => {
            const other = otherOf(activeConvo);
            const online = other ? onlineUsers.has(other.user_id) : false;
            return (
              <>
                {/* Chat header */}
                <div className="flex items-center gap-3 px-4 py-3 bg-white dark:bg-gray-900/80 border-b border-gray-200 dark:border-gray-800 shadow-sm flex-shrink-0">
                  <button className="md:hidden w-8 h-8 flex items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                    onClick={() => setMobileView("list")}>
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                    </svg>
                  </button>
                  <button
                    onClick={() => other?.profile && setProfileView(other.profile)}
                    className="relative w-9 h-9 flex-shrink-0 rounded-full hover:ring-2 hover:ring-blue-500 transition-all"
                    title="View profile"
                  >
                    <div className="w-full h-full rounded-full overflow-hidden border-2 border-gray-200 dark:border-gray-700">
                      <Avatar profile={other?.profile} size={36} />
                    </div>
                    {online && <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-500 rounded-full border-2 border-white dark:border-gray-900" />}
                  </button>
                  <button
                    onClick={() => other?.profile && setProfileView(other.profile)}
                    className="flex-1 min-w-0 text-left group"
                    title="View profile"
                  >
                    <p className="text-sm font-bold text-gray-900 dark:text-white truncate leading-tight group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                      {userName(other?.profile)}
                    </p>
                    <p className={`text-xs ${online ? "text-emerald-500" : "text-gray-400 dark:text-gray-500"}`}>
                      {typingNames.length > 0 ? `${typingNames[0]} is typing…` : online ? "Active now" : "Offline"}
                    </p>
                  </button>
                </div>

                {/* Messages */}
                <div className="flex-1 overflow-y-auto px-4 py-4">
                  {loadingMessages ? (
                    <div className="flex items-center justify-center h-full">
                      <div className="w-7 h-7 border-[3px] border-blue-600 border-t-transparent rounded-full animate-spin" />
                    </div>
                  ) : messages.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full gap-3 text-center">
                      <div className="text-5xl">👋</div>
                      <p className="text-sm text-gray-400 dark:text-gray-500">No messages yet — say hello!</p>
                    </div>
                  ) : (
                    <>
                      {messages.map((msg, idx) => {
                        const isMine = msg.sender_id === currentUserId.current;
                        const prev = messages[idx - 1];
                        const next = messages[idx + 1];
                        const samePrev = prev?.sender_id === msg.sender_id;
                        const sameNext = next?.sender_id === msg.sender_id;
                        const showDate = !prev || diffDay(prev.created_at, msg.created_at);
                        const showAvatar = !isMine && !sameNext;
                        const showName = !isMine && !samePrev;
                        const replyMsg = msg.reply_to ? messages.find(m => m.id === msg.reply_to) : null;

                        return (
                          <div key={msg.id}>
                            {showDate && (
                              <div className="flex items-center gap-3 my-4">
                                <div className="flex-1 h-px bg-gray-200 dark:bg-gray-800" />
                                <span className="text-[11px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide">
                                  {dateSep(msg.created_at)}
                                </span>
                                <div className="flex-1 h-px bg-gray-200 dark:bg-gray-800" />
                              </div>
                            )}

                            <div className={`flex items-end gap-2 ${isMine ? "flex-row-reverse" : "flex-row"} ${samePrev ? "mt-0.5" : "mt-3"}`}>
                              {!isMine && (
                                <button
                                  onClick={() => msg.sender && setProfileView(msg.sender)}
                                  className={`w-7 h-7 flex-shrink-0 rounded-full overflow-hidden transition-all ${showAvatar ? "border border-gray-200 dark:border-gray-700 hover:ring-2 hover:ring-blue-500" : "invisible pointer-events-none"}`}
                                  title={showAvatar ? `View ${userName(msg.sender)}'s profile` : undefined}
                                >
                                  <Avatar profile={msg.sender} size={28} />
                                </button>
                              )}

                              <div className={`flex flex-col ${isMine ? "items-end" : "items-start"} max-w-[78%] sm:max-w-[65%] md:max-w-[55%]`}>
                                {showName && (
                                  <span className="text-[11px] font-semibold text-gray-500 dark:text-gray-400 mb-0.5 px-1">
                                    {userName(msg.sender)}
                                  </span>
                                )}

                                <div className="group relative">
                                  {replyMsg && (
                                    <div className={`mb-1 px-3 py-1.5 rounded-xl text-xs border-l-[3px] ${
                                      isMine ? "bg-blue-500/20 border-blue-400" : "bg-gray-200 dark:bg-gray-700 border-gray-400 dark:border-gray-500"
                                    }`}>
                                      <p className="font-semibold text-gray-700 dark:text-gray-300">{userName(replyMsg.sender)}</p>
                                      <p className="text-gray-500 dark:text-gray-400 truncate">{replyMsg.is_deleted ? "Deleted" : replyMsg.content}</p>
                                    </div>
                                  )}

                                  <div className={`px-3.5 py-2 rounded-2xl text-sm leading-relaxed break-words ${
                                    isMine
                                      ? "bg-blue-600 text-white rounded-br-[5px]"
                                      : "bg-white dark:bg-gray-800 text-gray-900 dark:text-white border border-gray-200 dark:border-gray-700 shadow-sm rounded-bl-[5px]"
                                  } ${msg.is_deleted ? "opacity-50 italic" : ""}`}>
                                    {msg.is_deleted ? "This message was deleted" : msg.content}
                                  </div>

                                  {!msg.is_deleted && (
                                    <div className={`
                                      absolute top-1/2 -translate-y-1/2
                                      ${isMine ? "-left-1 -translate-x-full pr-1.5" : "-right-1 translate-x-full pl-1.5"}
                                      hidden group-hover:flex items-center gap-1
                                    `}>
                                      <button onClick={() => setReplyTo(msg)}
                                        className="w-6 h-6 flex items-center justify-center rounded-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-400 hover:text-blue-500 shadow-sm transition-colors" title="Reply">
                                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                          <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                                        </svg>
                                      </button>
                                      {isMine && (
                                        <button onClick={() => deleteMessage(msg.id)}
                                          className="w-6 h-6 flex items-center justify-center rounded-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-400 hover:text-red-500 shadow-sm transition-colors" title="Delete">
                                          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                          </svg>
                                        </button>
                                      )}
                                    </div>
                                  )}
                                </div>

                                {!sameNext && (
                                  <span className="text-[10px] text-gray-400 dark:text-gray-500 mt-0.5 px-1">
                                    {msgTime(msg.created_at)}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}

                      {/* Typing indicator */}
                      {typingUsers.size > 0 && (
                        <div className="flex items-end gap-2 mt-3">
                          <div className="w-7 h-7 rounded-full bg-gray-200 dark:bg-gray-700 flex-shrink-0" />
                          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 px-4 py-2.5 rounded-2xl rounded-bl-[5px] shadow-sm">
                            <div className="flex items-center gap-1">
                              {[0, 150, 300].map(d => (
                                <span key={d} className="w-2 h-2 bg-gray-400 dark:bg-gray-500 rounded-full animate-bounce"
                                  style={{ animationDelay: `${d}ms` }} />
                              ))}
                            </div>
                          </div>
                        </div>
                      )}
                      <div ref={bottomRef} className="h-1" />
                    </>
                  )}
                </div>

                {/* Input area */}
                <div className="flex-shrink-0 bg-white dark:bg-gray-900/80 border-t border-gray-200 dark:border-gray-800 p-3">
                  {replyTo && (
                    <div className="flex items-center gap-2 mb-2 px-3 py-2 bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/30 rounded-xl">
                      <div className="w-1 h-8 bg-blue-500 rounded-full flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-[11px] font-bold text-blue-600 dark:text-blue-400">
                          Replying to {userName(replyTo.sender)}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{replyTo.content}</p>
                      </div>
                      <button onClick={() => setReplyTo(null)} className="text-gray-400 hover:text-gray-600 dark:hover:text-white transition-colors flex-shrink-0">
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  )}

                  <div className="flex items-end gap-2">
                    <textarea ref={textareaRef} value={draft} rows={1}
                      onChange={e => { setDraft(e.target.value); handleTyping(); }}
                      onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
                      onInput={e => {
                        const el = e.target as HTMLTextAreaElement;
                        el.style.height = "auto";
                        el.style.height = `${Math.min(el.scrollHeight, 144)}px`;
                      }}
                      placeholder="Type a message… (Enter to send)"
                      className="flex-1 px-4 py-2.5 text-sm rounded-2xl resize-none bg-gray-100 dark:bg-gray-800 border border-transparent dark:border-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:border-blue-500 focus:bg-white dark:focus:bg-gray-800 transition-all max-h-36 overflow-y-auto" />

                    <button onClick={sendMessage} disabled={!draft.trim() || sending}
                      className="w-10 h-10 flex-shrink-0 flex items-center justify-center rounded-2xl bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed text-white transition-all active:scale-95 shadow-sm">
                      {sending
                        ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        : <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>
                      }
                    </button>
                  </div>
                  <p className="text-[10px] text-gray-400 dark:text-gray-600 text-center mt-1.5">Enter to send · Shift+Enter new line</p>
                </div>
              </>
            );
          })() : (
            <div className="flex-1 flex flex-col items-center justify-center gap-5 p-8 text-center">
              <div className="relative">
                <div className="w-24 h-24 rounded-3xl bg-gradient-to-br from-blue-100 to-violet-100 dark:from-blue-500/10 dark:to-violet-500/10 flex items-center justify-center text-5xl">💬</div>
                <div className="absolute -bottom-1 -right-1 w-8 h-8 rounded-xl bg-gradient-to-br from-blue-600 to-violet-600 flex items-center justify-center text-white text-base shadow-lg">⚡</div>
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
                  {isAdmin ? "Admin Messaging Hub" : "Your Messages"}
                </h2>
                <p className="text-sm text-gray-400 dark:text-gray-500 max-w-xs leading-relaxed">
                  Select a conversation or press <span className="font-semibold text-blue-500">+</span> to start a new one.
                </p>
              </div>
              <button onClick={() => setShowNewChat(true)}
                className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm rounded-2xl transition-all active:scale-95 shadow-sm">
                Start a conversation
              </button>
            </div>
          )}
        </section>
      </div>

      {/* ══════════ NEW CHAT MODAL ════════════════════════════════════════════ */}
      {showNewChat && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-sm"
          onClick={() => setShowNewChat(false)}>
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-t-3xl sm:rounded-3xl shadow-2xl w-full sm:max-w-md overflow-hidden flex flex-col max-h-[80dvh]"
            onClick={e => e.stopPropagation()}>

            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-gray-800 flex-shrink-0">
              <div>
                <h2 className="text-base font-bold text-gray-900 dark:text-white">New Conversation</h2>
                <p className="text-xs text-gray-400 mt-0.5">{filteredUsers.length} user{filteredUsers.length !== 1 ? "s" : ""} available</p>
              </div>
              <button onClick={() => setShowNewChat(false)}
                className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 dark:bg-gray-800 text-gray-500 hover:text-gray-900 dark:hover:text-white transition-colors">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800 flex-shrink-0">
              <div className="flex items-center gap-2 bg-gray-100 dark:bg-gray-800 rounded-xl px-3 py-2">
                <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input value={userSearch} onChange={e => setUserSearch(e.target.value)}
                  placeholder="Search by name…" autoFocus
                  className="flex-1 bg-transparent text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none" />
              </div>
            </div>

            <div className="overflow-y-auto flex-1">
              {filteredUsers.length === 0 ? (
                <div className="text-center py-10 space-y-2">
                  <p className="text-2xl">🔍</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">No users found</p>
                  <p className="text-xs text-gray-400 dark:text-gray-500">Other users will appear here once they sign up</p>
                </div>
              ) : (
                filteredUsers.map(u => (
                  <div key={u.id} className="flex items-center gap-3 px-5 py-3.5 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                    <button
                      onClick={() => setProfileView(u)}
                      className="w-10 h-10 rounded-full overflow-hidden flex-shrink-0 border border-gray-200 dark:border-gray-700 hover:ring-2 hover:ring-blue-500 transition-all"
                      title="View profile"
                    >
                      <Avatar profile={u} size={40} />
                    </button>
                    <button
                      onClick={() => startConvo(u.id)}
                      disabled={starting}
                      className="flex-1 min-w-0 text-left disabled:opacity-50"
                    >
                      <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">{userName(u)}</p>
                      <p className="text-xs text-gray-400 dark:text-gray-500 truncate">
                        {u.bio ? u.bio : u.location ? u.location : "Tap to message"}
                      </p>
                    </button>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {onlineUsers.has(u.id) && (
                        <div className="flex items-center gap-1">
                          <span className="w-2 h-2 bg-emerald-500 rounded-full" />
                          <span className="text-[11px] text-emerald-500 font-medium">Online</span>
                        </div>
                      )}
                      <button
                        onClick={() => startConvo(u.id)}
                        disabled={starting}
                        className="w-8 h-8 flex items-center justify-center rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white transition-all active:scale-95"
                        title="Message"
                      >
                        {starting
                          ? <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          : <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>
                        }
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* ══════════ PROFILE MODAL ═══════════════════════════════════════════ */}
      {profileView && (() => {
        const isMe = profileView.id === currentUserId.current;
        const isOnline = onlineUsers.has(profileView.id);
        const showAdmin = isMe && isAdmin;
        const joinedDate = profileView.created_at
          ? new Date(profileView.created_at).toLocaleDateString("en-US", { month: "long", year: "numeric" })
          : null;
        const displayName = profileView.full_name || profileView.username || "User";
        const handle = profileView.username;

        return (
          <div
            className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/70 backdrop-blur-sm"
            onClick={() => setProfileView(null)}
          >
            <div
              className="bg-white dark:bg-[#0f1117] border border-gray-200 dark:border-gray-800 rounded-t-3xl sm:rounded-3xl shadow-2xl w-full sm:max-w-md overflow-hidden flex flex-col max-h-[92dvh] sm:max-h-[90dvh]"
              onClick={e => e.stopPropagation()}
            >
              {/* ── Cover banner ─────────────────────────────────────── */}
              <div className="relative z-20 h-36 flex-shrink-0 bg-gradient-to-br from-blue-600 via-violet-600 to-purple-700 overflow-hidden">
                {/* decorative blobs */}
                <div className="absolute -top-6 -left-6 w-32 h-32 rounded-full bg-white/10" />
                <div className="absolute top-4 right-16 w-16 h-16 rounded-full bg-white/10" />
                <div className="absolute -bottom-8 right-8 w-28 h-28 rounded-full bg-white/10" />
                <div className="absolute bottom-2 left-20 w-10 h-10 rounded-full bg-white/10" />
                {/* close */}
                <button
                  onClick={() => setProfileView(null)}
                  className="absolute top-3 right-3 w-8 h-8 flex items-center justify-center rounded-full bg-black/25 hover:bg-black/45 text-white transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
                {/* admin / you label inside banner */}
                {(showAdmin || isMe) && (
                  <div className="absolute top-3 left-3">
                    {showAdmin
                      ? <span className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold uppercase tracking-widest bg-amber-400 text-amber-900 rounded-full shadow">
                          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" /></svg>
                          Admin
                        </span>
                      : <span className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold uppercase tracking-widest bg-white/20 text-white rounded-full shadow">
                          You
                        </span>
                    }
                  </div>
                )}
              </div>

              {/* ── Scrollable body ───────────────────────────────────── */}
              <div className="overflow-y-auto flex-1">
                <div className="px-5 pb-6">

                  {/* Avatar row */}
                  <div className="flex items-end justify-between mt-4 mb-5">
                    <div className={`relative w-24 h-24 rounded-full flex-shrink-0 shadow-2xl ${isOnline ? "ring-4 ring-emerald-400 ring-offset-2 ring-offset-white dark:ring-offset-[#0f1117]" : "ring-4 ring-white dark:ring-[#0f1117]"}`}>
                      <div className="w-full h-full rounded-full overflow-hidden">
                        <Avatar profile={profileView} size={96} />
                      </div>
                      {isOnline && (
                        <span className="absolute bottom-1 right-1 w-4 h-4 bg-emerald-400 border-2 border-white dark:border-[#0f1117] rounded-full shadow" />
                      )}
                    </div>
                    {/* status pill */}
                    <div className={`mb-1 px-3 py-1.5 rounded-full text-xs font-semibold flex items-center gap-1.5 ${isOnline
                      ? "bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/30"
                      : "bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 border border-gray-200 dark:border-gray-700"}`}>
                      <span className={`w-2 h-2 rounded-full ${isOnline ? "bg-emerald-400 animate-pulse" : "bg-gray-400"}`} />
                      {isOnline ? "Active now" : "Offline"}
                    </div>
                  </div>

                  {/* Name + handle + badges */}
                  <div className="mb-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-2xl font-bold text-gray-900 dark:text-white leading-tight">
                        {displayName}
                      </h2>
                      {showAdmin && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-500/30 rounded-full">
                          <svg className="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" /></svg>
                          Admin
                        </span>
                      )}
                    </div>
                    {handle && (
                      <p className="text-sm text-blue-500 dark:text-blue-400 font-medium mt-0.5">@{handle}</p>
                    )}
                    {!handle && profileView.full_name && (
                      <p className="text-sm text-gray-400 dark:text-gray-500 mt-0.5">No username set</p>
                    )}
                  </div>

                  {/* Bio */}
                  {profileView.bio && (
                    <div className="mt-4 p-3.5 bg-gray-50 dark:bg-gray-800/60 rounded-2xl border border-gray-100 dark:border-gray-700/50">
                      <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed">{profileView.bio}</p>
                    </div>
                  )}

                  {/* Divider */}
                  <div className="my-4 border-t border-gray-100 dark:border-gray-800" />

                  {/* Info rows */}
                  <div className="space-y-3">
                    {profileView.location && (
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-xl bg-blue-50 dark:bg-blue-500/10 flex items-center justify-center flex-shrink-0">
                          <svg className="w-4 h-4 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                          </svg>
                        </div>
                        <div>
                          <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 leading-none mb-0.5">Location</p>
                          <p className="text-sm font-medium text-gray-800 dark:text-gray-200">{profileView.location}</p>
                        </div>
                      </div>
                    )}

                    {profileView.phone && (
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-xl bg-violet-50 dark:bg-violet-500/10 flex items-center justify-center flex-shrink-0">
                          <svg className="w-4 h-4 text-violet-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                          </svg>
                        </div>
                        <div>
                          <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 leading-none mb-0.5">Phone</p>
                          <p className="text-sm font-medium text-gray-800 dark:text-gray-200">{profileView.phone}</p>
                        </div>
                      </div>
                    )}

                    {joinedDate && (
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 flex items-center justify-center flex-shrink-0">
                          <svg className="w-4 h-4 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                        </div>
                        <div>
                          <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 leading-none mb-0.5">Member since</p>
                          <p className="text-sm font-medium text-gray-800 dark:text-gray-200">{joinedDate}</p>
                        </div>
                      </div>
                    )}

                    {/* Role row */}
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 ${showAdmin ? "bg-amber-50 dark:bg-amber-500/10" : "bg-gray-50 dark:bg-gray-800"}`}>
                        {showAdmin
                          ? <svg className="w-4 h-4 text-amber-500" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" /></svg>
                          : <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                        }
                      </div>
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 leading-none mb-0.5">Role</p>
                        <p className={`text-sm font-semibold ${showAdmin ? "text-amber-600 dark:text-amber-400" : "text-gray-600 dark:text-gray-300"}`}>
                          {showAdmin ? "Administrator" : "Member"}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Divider */}
                  <div className="my-5 border-t border-gray-100 dark:border-gray-800" />

                  {/* Actions */}
                  <div className="space-y-2.5">
                    {!isMe && (
                      <button
                        onClick={() => { startConvo(profileView.id); setProfileView(null); }}
                        disabled={starting}
                        className="w-full py-3.5 bg-gradient-to-r from-blue-600 to-violet-600 hover:from-blue-700 hover:to-violet-700 disabled:opacity-50 text-white font-bold text-sm rounded-2xl transition-all active:scale-[0.98] flex items-center justify-center gap-2 shadow-lg shadow-blue-500/25"
                      >
                        {starting
                          ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          : <>
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                              </svg>
                              Send a Message
                            </>
                        }
                      </button>
                    )}
                    {isMe && (
                      <a
                        href="/profile"
                        className="w-full py-3.5 bg-gradient-to-r from-blue-600 to-violet-600 hover:from-blue-700 hover:to-violet-700 text-white font-bold text-sm rounded-2xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-blue-500/25"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                        Edit My Profile
                      </a>
                    )}
                    <button
                      onClick={() => setProfileView(null)}
                      className="w-full py-3 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300 font-semibold text-sm rounded-2xl transition-all"
                    >
                      Close
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ══════════ TOAST ════════════════════════════════════════════════════ */}
      {toast && (
        <div className={`fixed bottom-6 right-6 z-[200] flex items-center gap-3 px-5 py-3.5 rounded-xl shadow-2xl border text-sm font-semibold transition-all ${
          toast.ok
            ? "bg-emerald-50 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-200 border-emerald-200 dark:border-emerald-500/30"
            : "bg-red-50 dark:bg-rose-500/20 text-red-600 dark:text-rose-200 border-red-200 dark:border-rose-500/30"
        }`}>
          <span>{toast.ok ? "✅" : "❌"}</span>
          <span>{toast.msg}</span>
        </div>
      )}
    </div>
  );
}
