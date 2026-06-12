import { NextResponse } from "next/server";

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

    if (!res.ok) {
      return NextResponse.json(
        { error: data.msg || data.error_description || "Failed to generate reset link." },
        { status: 400 }
      );
    }

    if (!data.action_link) {
      return NextResponse.json({ error: "No link returned from auth server." }, { status: 500 });
    }

    return NextResponse.json({ actionLink: data.action_link });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unexpected error" },
      { status: 500 }
    );
  }
}
