import { createClient } from "@/lib/supabase-server";
import { serviceClient, clientMeta, logAudit } from "@/lib/admin-auth";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const type = searchParams.get("type"); // "recovery" for password reset

  if (code) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error && data?.user) {
      // Password reset flow → go to reset page
      if (type === "recovery") {
        return NextResponse.redirect(`${origin}/reset-password`);
      }
      // Audit the completed magic-link sign-in (spec #10).
      const { ip, userAgent } = clientMeta(request);
      await logAudit(serviceClient(), {
        event: "magic_link_login",
        email: data.user.email ?? null,
        userId: data.user.id,
        ip,
        userAgent,
        success: true,
      });
      // Normal login flow → route by role
      const role = data.user.app_metadata?.role || data.user.user_metadata?.role;
      if (role === "admin") return NextResponse.redirect(`${origin}/dashboard`);
      return NextResponse.redirect(`${origin}/client-dashboard`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_failed`);
}
