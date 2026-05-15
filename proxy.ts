import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const ADMIN_ROUTES = ["/dashboard", "/admin"];
const AUTH_ROUTES  = ["/client-dashboard"];

export default async function proxy(request: NextRequest) {
  // Always build a fresh response so we can write updated session cookies.
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // getUser() refreshes the session and writes updated tokens to cookies on
  // every request — this is what prevents "Refresh Token Not Found" errors.
  const { data: { user } } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  const isAdminRoute = ADMIN_ROUTES.some((r) => pathname === r || pathname.startsWith(r + "/"));
  const isAuthRoute  = AUTH_ROUTES.some((r)  => pathname === r || pathname.startsWith(r + "/"));

  if (isAdminRoute || isAuthRoute) {
    if (!user) return NextResponse.redirect(new URL("/login", request.url));

    const role = user.app_metadata?.role || user.user_metadata?.role;
    if (isAdminRoute && role !== "admin") {
      return NextResponse.redirect(new URL("/client-dashboard", request.url));
    }
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
