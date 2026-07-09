import { NextResponse } from "next/server";
import {
  serviceClient,
  clientMeta,
  logAudit,
  requireAdmin,
  validatePassword,
} from "@/lib/admin-auth";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const adminHeaders = {
  "Content-Type": "application/json",
  Authorization: `Bearer ${SERVICE_KEY}`,
  apikey: SERVICE_KEY,
};

interface AuthUser {
  id: string;
  email: string;
  created_at: string;
  app_metadata?: { role?: string };
  user_metadata?: { role?: string; username?: string; name?: string };
}

// GET — list admin accounts + their password-login settings (spec #2).
export async function GET() {
  const caller = await requireAdmin();
  if (!caller) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const sb = serviceClient();
  const res = await fetch(`${SUPABASE_URL}/auth/v1/admin/users?per_page=200`, {
    headers: adminHeaders,
  });
  if (!res.ok) return NextResponse.json({ error: "Failed to load users." }, { status: 502 });
  const data = await res.json();
  const users: AuthUser[] = data.users ?? [];
  const admins = users.filter(
    (u) => (u.app_metadata?.role || u.user_metadata?.role) === "admin"
  );

  const { data: settings } = await sb
    .from("admin_auth_settings")
    .select("user_id, password_enabled, password_updated_at, last_password_login_at");
  const byId = new Map((settings ?? []).map((s) => [s.user_id, s]));

  return NextResponse.json({
    admins: admins.map((u) => ({
      id: u.id,
      email: u.email,
      name: u.user_metadata?.name || u.user_metadata?.username || null,
      createdAt: u.created_at,
      passwordEnabled: byId.get(u.id)?.password_enabled ?? false,
      passwordUpdatedAt: byId.get(u.id)?.password_updated_at ?? null,
      lastPasswordLoginAt: byId.get(u.id)?.last_password_login_at ?? null,
    })),
  });
}

// POST — create a new admin, optionally with password login enabled (spec #2).
export async function POST(request: Request) {
  const caller = await requireAdmin();
  if (!caller) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const { ip, userAgent } = clientMeta(request);
  const sb = serviceClient();
  const body = await request.json();
  const email = String(body.email ?? "").trim().toLowerCase();
  const name = String(body.name ?? "").trim();
  const enablePassword = body.enablePassword === true;
  const password = String(body.password ?? "");

  if (!email) return NextResponse.json({ error: "Email is required." }, { status: 400 });
  if (enablePassword) {
    const pwErr = validatePassword(password);
    if (pwErr) return NextResponse.json({ error: pwErr }, { status: 400 });
  }

  const createRes = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
    method: "POST",
    headers: adminHeaders,
    body: JSON.stringify({
      email,
      email_confirm: true,
      ...(enablePassword ? { password } : {}),
      app_metadata: { role: "admin" },
      user_metadata: { role: "admin", name: name || undefined },
    }),
  });
  const created = await createRes.json();
  if (!createRes.ok) {
    return NextResponse.json(
      { error: created.msg || created.message || "Failed to create admin." },
      { status: 400 }
    );
  }

  await sb.from("admin_auth_settings").upsert({
    user_id: created.id,
    password_enabled: enablePassword,
    password_updated_at: enablePassword ? new Date().toISOString() : null,
    updated_at: new Date().toISOString(),
  });
  await logAudit(sb, {
    event: "password_changed",
    email,
    userId: created.id,
    ip,
    userAgent,
    success: true,
  });

  return NextResponse.json({ ok: true, id: created.id });
}

// PATCH — toggle password login and/or reset the password for an admin (spec #2).
export async function PATCH(request: Request) {
  const caller = await requireAdmin();
  if (!caller) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const { ip, userAgent } = clientMeta(request);
  const sb = serviceClient();
  const body = await request.json();
  const userId = String(body.userId ?? "");
  if (!userId) return NextResponse.json({ error: "userId is required." }, { status: 400 });

  const enablePassword: boolean | undefined =
    typeof body.enablePassword === "boolean" ? body.enablePassword : undefined;
  const newPassword: string | undefined =
    typeof body.password === "string" && body.password.length > 0 ? body.password : undefined;

  // If a new password is provided, validate + push it to Supabase (bcrypt).
  if (newPassword) {
    const pwErr = validatePassword(newPassword);
    if (pwErr) return NextResponse.json({ error: pwErr }, { status: 400 });
    const upRes = await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${userId}`, {
      method: "PUT",
      headers: adminHeaders,
      body: JSON.stringify({ password: newPassword }),
    });
    if (!upRes.ok) {
      const e = await upRes.json().catch(() => ({}));
      return NextResponse.json(
        { error: e.msg || e.message || "Failed to update password." },
        { status: 400 }
      );
    }
  }

  const patch: Record<string, unknown> = { user_id: userId, updated_at: new Date().toISOString() };
  if (enablePassword !== undefined) patch.password_enabled = enablePassword;
  if (newPassword) patch.password_updated_at = new Date().toISOString();
  await sb.from("admin_auth_settings").upsert(patch);

  await logAudit(sb, {
    event: "password_changed",
    userId,
    ip,
    userAgent,
    success: true,
  });

  return NextResponse.json({ ok: true });
}
