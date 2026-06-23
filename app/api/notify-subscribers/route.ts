import { NextResponse } from "next/server";
import { Resend } from "resend";

const FROM = "Tech Ninja <onboarding@resend.dev>";
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://techninja.vercel.app";

type Payload =
  | { type: "product"; name: string; description?: string; price: number; category?: string; image?: string }
  | { type: "update"; title: string; content: string; updateType?: string; link?: string };

function productEmail(p: Extract<Payload, { type: "product" }>) {
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#09090b;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#09090b;padding:48px 16px">
    <tr><td align="center">
      <table width="100%" style="max-width:480px;background:#18181b;border-radius:16px;overflow:hidden;border:1px solid #27272a">

        <!-- Header -->
        <tr>
          <td style="background:linear-gradient(135deg,#1d4ed8,#7c3aed);padding:32px;text-align:center">
            <p style="margin:0;font-size:24px;font-weight:800;color:#fff;letter-spacing:-0.5px">⚡ Tech Ninja</p>
            <p style="margin:8px 0 0;font-size:13px;color:rgba(255,255,255,0.7)">Mauritius · Device Experts</p>
          </td>
        </tr>

        <!-- Badge -->
        <tr>
          <td style="padding:24px 32px 0;text-align:center">
            <span style="display:inline-block;background:#1d4ed8;color:#fff;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.12em;padding:5px 14px;border-radius:100px">🛍️ New Product Just Dropped</span>
          </td>
        </tr>

        <!-- Product image -->
        ${p.image ? `<tr><td style="padding:24px 32px 0;text-align:center">
          <img src="${p.image}" alt="${p.name}" width="220" style="max-width:220px;height:auto;border-radius:12px;border:1px solid #27272a;object-fit:cover"/>
        </td></tr>` : ""}

        <!-- Content -->
        <tr>
          <td style="padding:28px 32px">
            ${p.category ? `<p style="margin:0 0 6px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.12em;color:#52525b">${p.category}</p>` : ""}
            <h1 style="margin:0 0 10px;font-size:22px;font-weight:700;color:#fafafa;line-height:1.2">${p.name}</h1>
            ${p.description ? `<p style="margin:0 0 18px;font-size:15px;color:#a1a1aa;line-height:1.6">${p.description}</p>` : ""}
            <p style="margin:0 0 28px;font-size:28px;font-weight:900;color:#2563eb">Rs ${p.price.toLocaleString()}</p>
            <a href="${SITE_URL}/Clients" style="display:inline-block;background:#2563eb;color:#fff;text-decoration:none;font-size:15px;font-weight:700;padding:14px 32px;border-radius:10px;letter-spacing:-0.2px">
              Shop Now →
            </a>
          </td>
        </tr>

        <tr><td style="padding:0 32px"><hr style="border:none;border-top:1px solid #27272a"/></td></tr>

        <!-- Perks -->
        <tr>
          <td style="padding:20px 32px">
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td width="33%" style="text-align:center">
                  <p style="margin:0;font-size:18px">⚡</p>
                  <p style="margin:4px 0 0;font-size:11px;font-weight:600;color:#71717a">Same-day<br/>Delivery</p>
                </td>
                <td width="33%" style="text-align:center">
                  <p style="margin:0;font-size:18px">🛡️</p>
                  <p style="margin:4px 0 0;font-size:11px;font-weight:600;color:#71717a">2-Year<br/>Warranty</p>
                </td>
                <td width="33%" style="text-align:center">
                  <p style="margin:0;font-size:18px">🔒</p>
                  <p style="margin:4px 0 0;font-size:11px;font-weight:600;color:#71717a">Secure<br/>Checkout</p>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="padding:20px 32px;background:#09090b;border-top:1px solid #27272a;text-align:center">
            <p style="margin:0 0 4px;font-size:12px;color:#52525b">You're receiving this because you subscribed to Tech Ninja updates.</p>
            <p style="margin:0;font-size:12px;color:#3f3f46">© ${new Date().getFullYear()} Tech Ninja · Mauritius</p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function updateEmail(u: Extract<Payload, { type: "update" }>) {
  const typeIcon: Record<string, string> = { feature: "✨", fix: "🔧", announcement: "📣" };
  const icon = typeIcon[u.updateType ?? "announcement"] ?? "📣";
  const label = u.updateType ? u.updateType.charAt(0).toUpperCase() + u.updateType.slice(1) : "Announcement";
  const ctaHref = u.link ? (u.link.startsWith("http") ? u.link : `https://${u.link}`) : SITE_URL;

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#09090b;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#09090b;padding:48px 16px">
    <tr><td align="center">
      <table width="100%" style="max-width:480px;background:#18181b;border-radius:16px;overflow:hidden;border:1px solid #27272a">

        <!-- Header -->
        <tr>
          <td style="background:linear-gradient(135deg,#1d4ed8,#7c3aed);padding:32px;text-align:center">
            <p style="margin:0;font-size:24px;font-weight:800;color:#fff;letter-spacing:-0.5px">⚡ Tech Ninja</p>
            <p style="margin:8px 0 0;font-size:13px;color:rgba(255,255,255,0.7)">Mauritius · Device Experts</p>
          </td>
        </tr>

        <!-- Content -->
        <tr>
          <td style="padding:40px 32px">
            <span style="display:inline-block;background:#27272a;color:#a1a1aa;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.12em;padding:5px 12px;border-radius:100px;margin-bottom:20px">${icon} ${label}</span>
            <h1 style="margin:0 0 16px;font-size:22px;font-weight:700;color:#fafafa;line-height:1.2">${u.title}</h1>
            <p style="margin:0 0 32px;font-size:15px;color:#a1a1aa;line-height:1.6">${u.content}</p>
            <a href="${ctaHref}" style="display:inline-block;background:#2563eb;color:#fff;text-decoration:none;font-size:15px;font-weight:700;padding:14px 32px;border-radius:10px;letter-spacing:-0.2px">
              ${u.link ? "Read More →" : "Visit Tech Ninja →"}
            </a>
            <hr style="border:none;border-top:1px solid #27272a;margin:28px 0">
            <p style="margin:0;font-size:12px;color:#52525b">Didn't subscribe? You can safely ignore this email.</p>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="padding:20px 32px;background:#09090b;border-top:1px solid #27272a;text-align:center">
            <p style="margin:0 0 4px;font-size:12px;color:#52525b">You're receiving this because you subscribed to Tech Ninja updates.</p>
            <p style="margin:0;font-size:12px;color:#3f3f46">© ${new Date().getFullYear()} Tech Ninja · Mauritius</p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

export async function POST(request: Request) {
  const resend = new Resend(process.env.RESEND_API_KEY);
  try {
    const payload: Payload = await request.json();

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

    const res = await fetch(
      `${supabaseUrl}/rest/v1/newsletter_subscribers?is_active=eq.true&select=email`,
      {
        headers: {
          Authorization: `Bearer ${serviceRoleKey}`,
          apikey: serviceRoleKey,
        },
      }
    );

    const subscribers: { email: string }[] = await res.json();
    if (!subscribers.length) return NextResponse.json({ sent: 0 });

    const subject =
      payload.type === "product"
        ? `New Product: ${payload.name} — Tech Ninja`
        : `${payload.title} — Tech Ninja`;

    const html =
      payload.type === "product" ? productEmail(payload) : updateEmail(payload);

    // Send using resend.emails.send() for each subscriber
    for (const { email } of subscribers) {
      await resend.emails.send({ from: FROM, to: email, subject, html });
    }

    return NextResponse.json({ sent: subscribers.length });
  } catch (err: unknown) {
    console.error("notify-subscribers error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unexpected error" },
      { status: 500 }
    );
  }
}
