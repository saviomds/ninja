import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import {
  serviceClient,
  clientMeta,
  logAudit,
  isLockedOut,
  registerFailure,
  clearFailures,
  findUserByEmail,
  passwordLoginEnabled,
  LOCK_MINUTES,
} from "@/lib/admin-auth";

// Optional Email + Password sign-in.
//
// The password is verified by Supabase (bcrypt) via signInWithPassword on the
// SSR server client, so the resulting session cookies are IDENTICAL to the
// magic-link session and the existing proxy/middleware keeps working. Around
// that we add rate-limiting, per-admin password gating, and an audit trail.
//
// Security: error messages are intentionally generic ("Invalid email or
// password") so we never reveal whether an email exists (spec #12).
export async function POST(request: Request) {
  const sb = serviceClient();
  const { ip, userAgent } = clientMeta(request);

  try {
    if (!passwordLoginEnabled) {
      return NextResponse.json(
        { error: "Password login is currently disabled." },
        { status: 403 }
      );
    }

    const body = await request.json();
    const email = String(body.email ?? "").trim().toLowerCase();
    const password = String(body.password ?? "");
    const rememberMe = body.rememberMe !== false; // default: remember

    if (!email || !password) {
      return NextResponse.json(
        { error: "Enter your email and password." },
        { status: 400 }
      );
    }

    // 1) Rate limit (spec #9) — check before touching credentials.
    const lock = await isLockedOut(sb, email);
    if (lock.locked) {
      await logAudit(sb, { event: "password_login_failed", email, ip, userAgent, success: false });
      return NextResponse.json(
        { error: `Too many login attempts. Try again in about ${LOCK_MINUTES} minutes.` },
        { status: 429 }
      );
    }

    // 2) Look up the account so we can enforce per-admin password gating.
    const user = await findUserByEmail(email);
    if (user?.role === "admin") {
      const { data: settings } = await sb
        .from("admin_auth_settings")
        .select("password_enabled")
        .eq("user_id", user.id)
        .maybeSingle();
      if (!settings?.password_enabled) {
        await logAudit(sb, { event: "password_login_failed", email, userId: user.id, ip, userAgent, success: false });
        return NextResponse.json(
          { error: "Password login is disabled for this account. Use the magic link instead." },
          { status: 403 }
        );
      }
    }

    // 3) Verify the password via Supabase and mint the session cookies.
    //    rememberMe=false => strip cookie expiry so it's a session cookie.
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll: () => cookieStore.getAll(),
          setAll: (list) => {
            list.forEach(({ name, value, options }) => {
              const opts = rememberMe
                ? options
                : { ...options, maxAge: undefined, expires: undefined };
              try { cookieStore.set(name, value, opts); } catch {}
            });
          },
        },
      }
    );

    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error || !data?.user) {
      // 4) Failed — count it, maybe lock, audit, and stay generic.
      const { locked } = await registerFailure(sb, email, ip);
      await logAudit(sb, {
        event: "password_login_failed",
        email,
        userId: user?.id ?? null,
        ip,
        userAgent,
        success: false,
      });
      return NextResponse.json(
        {
          error: locked
            ? `Too many login attempts. Try again in about ${LOCK_MINUTES} minutes.`
            : "Invalid email or password.",
        },
        { status: locked ? 429 : 401 }
      );
    }

    // 5) Success — reset counter, audit, and record last password login.
    await clearFailures(sb, email);
    const role = data.user.app_metadata?.role || data.user.user_metadata?.role || null;
    if (role === "admin") {
      await sb
        .from("admin_auth_settings")
        .update({ last_password_login_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq("user_id", data.user.id);
    }
    await logAudit(sb, {
      event: "password_login_success",
      email,
      userId: data.user.id,
      ip,
      userAgent,
      success: true,
    });

    return NextResponse.json({ ok: true, role: role ?? "client" });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unexpected error." },
      { status: 500 }
    );
  }
}
