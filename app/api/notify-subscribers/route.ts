import { NextResponse } from "next/server";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM = process.env.RESEND_FROM ?? "TechNinja <onboarding@resend.dev>";
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://techninja.vercel.app";

type Payload =
  | { type: "product"; name: string; description?: string; price: number; category?: string; image?: string }
  | { type: "update"; title: string; content: string; updateType?: string; link?: string };

function productEmail(p: Extract<Payload, { type: "product" }>) {
  return /* html */`<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>New Product — TechNinja</title></head>
<body style="margin:0;padding:0;background:#f4f6f9;font-family:'Helvetica Neue',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f9;padding:32px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">

        <!-- Header -->
        <tr>
          <td style="background:#2563EB;padding:28px 40px;">
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td>
                  <table cellpadding="0" cellspacing="0">
                    <tr>
                      <td style="background:rgba(255,255,255,0.2);border-radius:8px;width:36px;height:36px;text-align:center;vertical-align:middle;">
                        <span style="color:#fff;font-size:18px;font-weight:900;line-height:36px;">⚡</span>
                      </td>
                      <td style="padding-left:10px;">
                        <span style="color:#ffffff;font-size:20px;font-weight:900;letter-spacing:-0.5px;">TechNinja</span>
                      </td>
                    </tr>
                  </table>
                </td>
                <td align="right">
                  <span style="color:rgba(255,255,255,0.7);font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:0.1em;">New Arrival</span>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Badge -->
        <tr>
          <td style="background:#EFF6FF;padding:14px 40px;border-bottom:1px solid #DBEAFE;">
            <span style="display:inline-block;background:#2563EB;color:#ffffff;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.12em;padding:4px 12px;border-radius:100px;">
              🛍️ New Product Just Dropped
            </span>
          </td>
        </tr>

        <!-- Product image -->
        ${p.image ? `<tr><td style="padding:32px 40px 0;text-align:center;">
          <img src="${p.image}" alt="${p.name}" width="280" style="max-width:280px;height:auto;border-radius:16px;border:1px solid #E5E7EB;object-fit:cover;"/>
        </td></tr>` : ""}

        <!-- Product info -->
        <tr>
          <td style="padding:32px 40px;">
            ${p.category ? `<p style="margin:0 0 8px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.12em;color:#9CA3AF;">${p.category}</p>` : ""}
            <h1 style="margin:0 0 12px;font-size:26px;font-weight:800;color:#111827;line-height:1.2;">${p.name}</h1>
            ${p.description ? `<p style="margin:0 0 20px;font-size:15px;color:#6B7280;line-height:1.6;">${p.description}</p>` : ""}
            <p style="margin:0 0 28px;font-size:30px;font-weight:900;color:#2563EB;">Rs ${p.price.toLocaleString()}</p>
            <a href="${SITE_URL}/Clients" style="display:inline-block;background:#2563EB;color:#ffffff;font-size:14px;font-weight:700;text-decoration:none;padding:14px 32px;border-radius:10px;letter-spacing:0.02em;">
              Shop Now →
            </a>
          </td>
        </tr>

        <!-- Divider -->
        <tr><td style="padding:0 40px;"><hr style="border:none;border-top:1px solid #F3F4F6;"/></td></tr>

        <!-- Perks -->
        <tr>
          <td style="padding:24px 40px;">
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td width="33%" style="text-align:center;padding:0 8px;">
                  <p style="margin:0;font-size:20px;">⚡</p>
                  <p style="margin:4px 0 0;font-size:12px;font-weight:600;color:#374151;">Same-day<br/>Delivery</p>
                </td>
                <td width="33%" style="text-align:center;padding:0 8px;">
                  <p style="margin:0;font-size:20px;">🛡️</p>
                  <p style="margin:4px 0 0;font-size:12px;font-weight:600;color:#374151;">2-Year<br/>Warranty</p>
                </td>
                <td width="33%" style="text-align:center;padding:0 8px;">
                  <p style="margin:0;font-size:20px;">🔒</p>
                  <p style="margin:4px 0 0;font-size:12px;font-weight:600;color:#374151;">Secure<br/>Checkout</p>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background:#F9FAFB;border-top:1px solid #F3F4F6;padding:24px 40px;text-align:center;">
            <p style="margin:0 0 4px;font-size:12px;color:#9CA3AF;">You're receiving this because you subscribed to TechNinja updates.</p>
            <p style="margin:0;font-size:12px;color:#9CA3AF;">© ${new Date().getFullYear()} TechNinja, Mauritius · <a href="${SITE_URL}" style="color:#2563EB;text-decoration:none;">techninja.mu</a></p>
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

  return /* html */`<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>${u.title} — TechNinja</title></head>
<body style="margin:0;padding:0;background:#f4f6f9;font-family:'Helvetica Neue',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f9;padding:32px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">

        <!-- Header -->
        <tr>
          <td style="background:#111827;padding:28px 40px;">
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td>
                  <table cellpadding="0" cellspacing="0">
                    <tr>
                      <td style="background:#2563EB;border-radius:8px;width:36px;height:36px;text-align:center;vertical-align:middle;">
                        <span style="color:#fff;font-size:18px;font-weight:900;line-height:36px;">⚡</span>
                      </td>
                      <td style="padding-left:10px;">
                        <span style="color:#ffffff;font-size:20px;font-weight:900;letter-spacing:-0.5px;">TechNinja</span>
                      </td>
                    </tr>
                  </table>
                </td>
                <td align="right">
                  <span style="color:rgba(255,255,255,0.5);font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:0.1em;">Update</span>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Badge -->
        <tr>
          <td style="background:#F9FAFB;padding:14px 40px;border-bottom:1px solid #E5E7EB;">
            <span style="display:inline-block;background:#111827;color:#ffffff;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.12em;padding:4px 12px;border-radius:100px;">
              ${icon} ${u.updateType ? u.updateType.charAt(0).toUpperCase() + u.updateType.slice(1) : "Announcement"}
            </span>
          </td>
        </tr>

        <!-- Content -->
        <tr>
          <td style="padding:40px 40px 32px;">
            <h1 style="margin:0 0 16px;font-size:26px;font-weight:800;color:#111827;line-height:1.2;">${u.title}</h1>
            <p style="margin:0 0 28px;font-size:15px;color:#6B7280;line-height:1.7;">${u.content}</p>
            ${u.link ? `<a href="${u.link.startsWith("http") ? u.link : `https://${u.link}`}" style="display:inline-block;background:#2563EB;color:#ffffff;font-size:14px;font-weight:700;text-decoration:none;padding:14px 32px;border-radius:10px;letter-spacing:0.02em;">Read More →</a>` : `<a href="${SITE_URL}" style="display:inline-block;background:#2563EB;color:#ffffff;font-size:14px;font-weight:700;text-decoration:none;padding:14px 32px;border-radius:10px;letter-spacing:0.02em;">Visit TechNinja →</a>`}
          </td>
        </tr>

        <!-- Divider -->
        <tr><td style="padding:0 40px;"><hr style="border:none;border-top:1px solid #F3F4F6;"/></td></tr>

        <!-- Footer -->
        <tr>
          <td style="background:#F9FAFB;border-top:1px solid #F3F4F6;padding:24px 40px;text-align:center;">
            <p style="margin:0 0 4px;font-size:12px;color:#9CA3AF;">You're receiving this because you subscribed to TechNinja updates.</p>
            <p style="margin:0;font-size:12px;color:#9CA3AF;">© ${new Date().getFullYear()} TechNinja, Mauritius · <a href="${SITE_URL}" style="color:#2563EB;text-decoration:none;">techninja.mu</a></p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

export async function POST(request: Request) {
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
        ? `New Product: ${payload.name} — TechNinja`
        : `${payload.title} — TechNinja`;

    const html =
      payload.type === "product" ? productEmail(payload) : updateEmail(payload);

    // Resend batch: max 100 per call
    const BATCH = 100;
    let sent = 0;
    for (let i = 0; i < subscribers.length; i += BATCH) {
      const chunk = subscribers.slice(i, i + BATCH);
      const emails = chunk.map(({ email }) => ({
        from: FROM,
        to: email,
        subject,
        html,
      }));
      await resend.batch.send(emails);
      sent += chunk.length;
    }

    return NextResponse.json({ sent });
  } catch (err: unknown) {
    console.error("notify-subscribers error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unexpected error" },
      { status: 500 }
    );
  }
}
