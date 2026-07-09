// ─────────────────────────────────────────────────────────────────────────────
// Dual-auth server helpers.
//
// The password itself lives in Supabase Auth (bcrypt-hashed in auth.users), so
// password sign-in produces a session byte-identical to the magic-link session
// and the existing proxy/middleware keeps working unchanged. These helpers add
// the custom layer around it: per-admin password gating, an audit trail, and
// login rate-limiting — all stored in service-role-only tables.
// ─────────────────────────────────────────────────────────────────────────────
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { createClient as createServerSupabase } from "@/lib/supabase-server";

/** Feature flags (spec #13). Default ON so behaviour is unchanged if unset. */
export const magicLinkEnabled =
  (process.env.NEXT_PUBLIC_ENABLE_MAGIC_LINK ?? "true") !== "false";
export const passwordLoginEnabled =
  (process.env.NEXT_PUBLIC_ENABLE_PASSWORD_LOGIN ?? "true") !== "false";

/** Rate-limit policy (spec #9). */
export const MAX_ATTEMPTS = 5;
export const LOCK_MINUTES = 15;

/** Service-role client — bypasses RLS. NEVER import into client components. */
export function serviceClient(): SupabaseClient {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

/** Extract caller IP + user agent for audit/rate-limit (spec #9, #10). */
export function clientMeta(req: Request) {
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "unknown";
  const userAgent = req.headers.get("user-agent") || "unknown";
  return { ip, userAgent };
}

export type AuthEvent =
  | "password_login_success"
  | "password_login_failed"
  | "magic_link_login"
  | "password_changed"
  | "password_reset_requested"
  | "logout";

/** Append an audit record. Never throws — auditing must not block auth. */
export async function logAudit(
  sb: SupabaseClient,
  entry: {
    event: AuthEvent;
    email?: string | null;
    userId?: string | null;
    ip?: string;
    userAgent?: string;
    success?: boolean;
  }
) {
  try {
    await sb.from("auth_audit_log").insert({
      user_id: entry.userId ?? null,
      email: entry.email ?? null,
      event: entry.event,
      ip: entry.ip ?? null,
      user_agent: entry.userAgent ?? null,
      success: entry.success ?? true,
    });
  } catch {
    /* auditing is best-effort */
  }
}

/** True if this email is currently locked out (spec #9). */
export async function isLockedOut(
  sb: SupabaseClient,
  email: string
): Promise<{ locked: boolean; until?: string }> {
  const { data } = await sb
    .from("auth_login_attempts")
    .select("locked_until")
    .eq("email", email)
    .maybeSingle();
  if (data?.locked_until && new Date(data.locked_until).getTime() > Date.now()) {
    return { locked: true, until: data.locked_until };
  }
  return { locked: false };
}

/** Record a failed attempt; lock the account once MAX_ATTEMPTS is reached. */
export async function registerFailure(
  sb: SupabaseClient,
  email: string,
  ip: string
): Promise<{ attempts: number; locked: boolean }> {
  const { data } = await sb
    .from("auth_login_attempts")
    .select("attempts")
    .eq("email", email)
    .maybeSingle();
  const attempts = (data?.attempts ?? 0) + 1;
  const locked = attempts >= MAX_ATTEMPTS;
  const locked_until = locked
    ? new Date(Date.now() + LOCK_MINUTES * 60_000).toISOString()
    : null;
  await sb.from("auth_login_attempts").upsert({
    email,
    attempts,
    last_ip: ip,
    locked_until,
    updated_at: new Date().toISOString(),
  });
  return { attempts, locked };
}

/** Clear the failure counter after a successful sign-in. */
export async function clearFailures(sb: SupabaseClient, email: string) {
  await sb
    .from("auth_login_attempts")
    .upsert({ email, attempts: 0, locked_until: null, updated_at: new Date().toISOString() });
}

/** Look up an auth user by email via the admin API. Returns null if absent. */
export async function findUserByEmail(email: string): Promise<{
  id: string;
  email: string;
  role: string | null;
} | null> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const res = await fetch(
    `${supabaseUrl}/auth/v1/admin/users?email=${encodeURIComponent(email)}`,
    { headers: { Authorization: `Bearer ${serviceRoleKey}`, apikey: serviceRoleKey } }
  );
  if (!res.ok) return null;
  const data = await res.json();
  const users: Array<{
    id: string;
    email: string;
    app_metadata?: { role?: string };
    user_metadata?: { role?: string };
  }> = data.users ?? [];
  const u = users.find((x) => x.email?.toLowerCase() === email.toLowerCase());
  if (!u) return null;
  return {
    id: u.id,
    email: u.email,
    role: u.app_metadata?.role || u.user_metadata?.role || null,
  };
}

/**
 * Guard for admin-only routes. Reads the caller's Supabase session from cookies
 * and confirms role === "admin". Returns the caller's user id/email or null.
 */
export async function requireAdmin(): Promise<{ id: string; email: string | null } | null> {
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const role = user.app_metadata?.role || user.user_metadata?.role;
  if (role !== "admin") return null;
  return { id: user.id, email: user.email ?? null };
}

/** Password policy: >=8 chars with upper, lower, and a number (spec #3, #12). */
export function validatePassword(pw: string): string | null {
  if (typeof pw !== "string" || pw.length < 8)
    return "Password must be at least 8 characters.";
  if (!/[a-z]/.test(pw)) return "Password must include a lowercase letter.";
  if (!/[A-Z]/.test(pw)) return "Password must include an uppercase letter.";
  if (!/[0-9]/.test(pw)) return "Password must include a number.";
  return null;
}
