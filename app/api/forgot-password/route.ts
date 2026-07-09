import { NextResponse } from "next/server";
import { Resend } from "resend";
import { serviceClient, clientMeta, logAudit } from "@/lib/admin-auth";

export async function POST(request: Request) {
  const resend = new Resend(process.env.RESEND_API_KEY);
  const sb = serviceClient();
  const { ip, userAgent } = clientMeta(request);
  try {
    const { email, origin } = await request.json();
    if (!email) return NextResponse.json({ error: "Email is required." }, { status: 400 });

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

    const res = await fetch(`${supabaseUrl}/auth/v1/admin/generate_link`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${serviceRoleKey}`,
        apikey: serviceRoleKey,
      },
      body: JSON.stringify({
        type: "recovery",
        email: email.trim(),
        redirect_to: `${origin}/auth/confirm?type=recovery`,
      }),
    });

    const text = await res.text();
    if (!text) return NextResponse.json({ error: "Empty response from auth server." }, { status: 500 });

    let data: { action_link?: string; msg?: string; error_description?: string };
    try { data = JSON.parse(text); }
    catch { return NextResponse.json({ error: `Auth server error: ${text.slice(0, 200)}` }, { status: 500 }); }

    // Do not reveal whether the email exists (spec #12): if no account/link,
    // respond as if the email was sent without actually sending anything.
    if (!res.ok || !data.action_link) {
      await logAudit(sb, { event: "password_reset_requested", email: email.trim(), ip, userAgent, success: false });
      return NextResponse.json({ ok: true });
    }

    const { error: sendError } = await resend.emails.send({
      from: "Tech Ninja <onboarding@resend.dev>",
      to: email.trim(),
      subject: "Reset your Tech Ninja password",
      html: `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#09090b;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#09090b;padding:48px 16px">
    <tr><td align="center">
      <table width="100%" style="max-width:480px;background:#18181b;border-radius:16px;overflow:hidden;border:1px solid #27272a">
        <tr>
          <td style="background:linear-gradient(135deg,#b45309,#d97706);padding:32px;text-align:center">
            <p style="margin:0;font-size:24px;font-weight:800;color:#fff;letter-spacing:-0.5px">⚡ Tech Ninja</p>
            <p style="margin:8px 0 0;font-size:13px;color:rgba(255,255,255,0.7)">Mauritius · Device Experts</p>
          </td>
        </tr>
        <tr>
          <td style="padding:40px 32px">
            <h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#fafafa">Reset your password</h1>
            <p style="margin:0 0 32px;font-size:15px;color:#a1a1aa;line-height:1.6">
              We received a request to reset your password. Click the button below to choose a new one. This link expires in 1 hour.
            </p>
            <a href="${data.action_link}" style="display:inline-block;background:#d97706;color:#fff;text-decoration:none;font-size:15px;font-weight:700;padding:14px 32px;border-radius:10px;letter-spacing:-0.2px">
              Reset password →
            </a>
            <p style="margin:28px 0 0;font-size:12px;color:#52525b;line-height:1.6">
              If the button doesn't work, copy and paste this link:<br>
              <a href="${data.action_link}" style="color:#f59e0b;word-break:break-all;font-size:11px">${data.action_link}</a>
            </p>
            <hr style="border:none;border-top:1px solid #27272a;margin:28px 0">
            <p style="margin:0;font-size:12px;color:#52525b">
              Didn't request a password reset? You can safely ignore this email — your account has not been changed.
            </p>
          </td>
        </tr>
        <tr>
          <td style="padding:20px 32px;background:#09090b;border-top:1px solid #27272a;text-align:center">
            <p style="margin:0;font-size:12px;color:#3f3f46">© ${new Date().getFullYear()} Tech Ninja · Mauritius</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`,
    });

    if (sendError) {
      return NextResponse.json(
        { error: `Email delivery failed: ${sendError.message}` },
        { status: 502 }
      );
    }

    await logAudit(sb, { event: "password_reset_requested", email: email.trim(), ip, userAgent, success: true });
    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unexpected error" },
      { status: 500 }
    );
  }
}
