import { NextResponse } from "next/server";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(request: Request) {
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
        type: "magiclink",
        email: email.trim(),
        redirect_to: `${origin}/auth/confirm`,
      }),
    });

    const text = await res.text();
    if (!text) return NextResponse.json({ error: "Empty response from auth server." }, { status: 500 });

    let data: { action_link?: string; msg?: string; error_description?: string };
    try { data = JSON.parse(text); }
    catch { return NextResponse.json({ error: `Auth server error: ${text.slice(0, 200)}` }, { status: 500 }); }

    if (!res.ok) {
      return NextResponse.json(
        { error: data.msg || data.error_description || "Failed to generate magic link." },
        { status: 400 }
      );
    }

    if (!data.action_link) {
      return NextResponse.json({ error: "No link returned from auth server." }, { status: 500 });
    }

    await resend.emails.send({
      from: "Tech Ninja <onboarding@resend.dev>",
      to: email.trim(),
      subject: "Your Tech Ninja sign-in link",
      html: `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#09090b;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#09090b;padding:48px 16px">
    <tr><td align="center">
      <table width="100%" style="max-width:480px;background:#18181b;border-radius:16px;overflow:hidden;border:1px solid #27272a">
        <tr>
          <td style="background:linear-gradient(135deg,#1d4ed8,#7c3aed);padding:32px;text-align:center">
            <p style="margin:0;font-size:24px;font-weight:800;color:#fff;letter-spacing:-0.5px">⚡ Tech Ninja</p>
            <p style="margin:8px 0 0;font-size:13px;color:rgba(255,255,255,0.7)">Mauritius · Device Experts</p>
          </td>
        </tr>
        <tr>
          <td style="padding:40px 32px">
            <h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#fafafa">Sign in to your account</h1>
            <p style="margin:0 0 32px;font-size:15px;color:#a1a1aa;line-height:1.6">
              Click the button below to sign in instantly — no password needed. This link expires in 1 hour.
            </p>
            <a href="${data.action_link}" style="display:inline-block;background:#2563eb;color:#fff;text-decoration:none;font-size:15px;font-weight:700;padding:14px 32px;border-radius:10px;letter-spacing:-0.2px">
              Sign in to Tech Ninja →
            </a>
            <p style="margin:28px 0 0;font-size:12px;color:#52525b;line-height:1.6">
              If the button doesn't work, copy and paste this link:<br>
              <a href="${data.action_link}" style="color:#3b82f6;word-break:break-all;font-size:11px">${data.action_link}</a>
            </p>
            <hr style="border:none;border-top:1px solid #27272a;margin:28px 0">
            <p style="margin:0;font-size:12px;color:#52525b">
              Didn't request this? You can safely ignore this email — your account is secure.
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

    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unexpected error" },
      { status: 500 }
    );
  }
}
