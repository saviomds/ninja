import { createBrowserClient } from "@supabase/ssr";

export const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// When the refresh token is invalid (revoked, expired, or stale from a
// previous deployment), Supabase fires SIGNED_OUT automatically after
// a failed refresh attempt. We just need to make sure the local session
// is cleared so the UI updates to a logged-out state.
supabase.auth.onAuthStateChange((event) => {
  if (event === "SIGNED_OUT") {
    // No-op — components already listen to this and update their user state.
    // This listener exists to ensure the module-level client stays in sync.
  }
});
