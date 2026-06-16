import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const { email } = await request.json();

    if (!email || typeof email !== "string") {
      return NextResponse.json({ error: "A valid email is required." }, { status: 400 });
    }

    const trimmed = email.trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmed)) {
      return NextResponse.json({ error: "Please enter a valid email address." }, { status: 400 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

    const res = await fetch(`${supabaseUrl}/rest/v1/newsletter_subscribers`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${serviceRoleKey}`,
        apikey: serviceRoleKey,
        Prefer: "return=minimal",
      },
      body: JSON.stringify({ email: trimmed }),
    });

    if (res.status === 409 || res.status === 23505) {
      // duplicate — already subscribed, treat as success
      return NextResponse.json({ success: true, alreadySubscribed: true });
    }

    if (!res.ok) {
      const text = await res.text();
      // PostgREST unique-violation comes back as 409 but sometimes as 400 with code 23505
      if (text.includes("23505")) {
        return NextResponse.json({ success: true, alreadySubscribed: true });
      }
      console.error("Newsletter insert failed:", res.status, text);
      return NextResponse.json({ error: "Subscription failed. Please try again." }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unexpected error" },
      { status: 500 }
    );
  }
}
