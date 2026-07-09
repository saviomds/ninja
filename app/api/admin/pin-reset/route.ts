import { NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import {
  serviceClient,
  clientMeta,
  logAudit,
  isLockedOut,
  registerFailure,
  clearFailures,
  findUserByEmail,
  validatePassword,
  LOCK_MINUTES,
} from "@/lib/admin-auth";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

/** Constant-time PIN comparison to avoid leaking the PIN via timing. */
function pinMatches(input: string, expected: string): boolean {
  const a = Buffer.from(input);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

// PIN-gated admin password reset — no email involved.
// The admin enters email + the shared reset PIN + a new password. If the PIN
// matches ADMIN_RESET_PIN and the email belongs to an admin, the password is
// reset via Supabase (bcrypt). Rate-limited to stop PIN brute-forcing.
export async function POST(request: Request) {
  const sb = serviceClient();
  const { ip, userAgent } = clientMeta(request);

  try {
    const expectedPin = process.env.ADMIN_RESET_PIN;
    if (!expectedPin) {
      return NextResponse.json(
        { error: "Password reset is not configured. Ask the site owner to set ADMIN_RESET_PIN." },
        { status: 503 }
      );
    }

    const body = await request.json();
    const email = String(body.email ?? "").trim().toLowerCase();
    const pin = String(body.pin ?? "");
    const password = String(body.password ?? "");

    if (!email || !pin || !password) {
      return NextResponse.json(
        { error: "Email, reset PIN and new password are all required." },
        { status: 400 }
      );
    }

    // Rate limit (shared with login) to block PIN guessing.
    const lock = await isLockedOut(sb, email);
    if (lock.locked) {
      return NextResponse.json(
        { error: `Too many attempts. Try again in about ${LOCK_MINUTES} minutes.` },
        { status: 429 }
      );
    }

    // Wrong PIN → count as a failed attempt and stay generic.
    if (!pinMatches(pin, expectedPin)) {
      const { locked } = await registerFailure(sb, email, ip);
      await logAudit(sb, { event: "password_reset_requested", email, ip, userAgent, success: false });
      return NextResponse.json(
        {
          error: locked
            ? `Too many attempts. Try again in about ${LOCK_MINUTES} minutes.`
            : "Invalid reset PIN.",
        },
        { status: locked ? 429 : 401 }
      );
    }

    // PIN is correct — only allow resetting an ADMIN account (spec: admin only).
    const user = await findUserByEmail(email);
    if (!user || user.role !== "admin") {
      await logAudit(sb, { event: "password_reset_requested", email, ip, userAgent, success: false });
      return NextResponse.json(
        { error: "No admin account found for this email." },
        { status: 404 }
      );
    }

    const pwErr = validatePassword(password);
    if (pwErr) return NextResponse.json({ error: pwErr }, { status: 400 });

    // Set the new password via Supabase admin API (bcrypt, never plaintext).
    const upRes = await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${user.id}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${SERVICE_KEY}`,
        apikey: SERVICE_KEY,
      },
      body: JSON.stringify({ password }),
    });
    if (!upRes.ok) {
      const e = await upRes.json().catch(() => ({}));
      return NextResponse.json(
        { error: e.msg || e.message || "Failed to reset password." },
        { status: 400 }
      );
    }

    // Keep password login enabled + record the change; clear the lockout counter.
    await sb.from("admin_auth_settings").upsert({
      user_id: user.id,
      password_enabled: true,
      password_updated_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    await clearFailures(sb, email);
    await logAudit(sb, {
      event: "password_changed",
      email,
      userId: user.id,
      ip,
      userAgent,
      success: true,
    });

    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unexpected error." },
      { status: 500 }
    );
  }
}
