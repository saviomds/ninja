import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const { email, origin } = await request.json();

    if (!email) {
      return NextResponse.json({ error: "Email is required." }, { status: 400 });
    }

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
        redirect_to: `${origin}/auth/callback?type=recovery`,
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      return NextResponse.json(
        { error: data.msg || data.error_description || data.message || "Failed to generate link" },
        { status: 400 }
      );
    }

    const actionLink = data.action_link;
    if (!actionLink) {
      return NextResponse.json({ error: "No reset link returned from server." }, { status: 500 });
    }

    return NextResponse.json({ actionLink });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unexpected error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
