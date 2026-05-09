import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const ADMIN_ROUTES = ["/dashboard", "/admin"];
const AUTH_ROUTES  = ["/client-dashboard"];

export default async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isAdminRoute = ADMIN_ROUTES.some((r) => pathname === r || pathname.startsWith(r + "/"));
  const isAuthRoute  = AUTH_ROUTES.some((r)  => pathname === r || pathname.startsWith(r + "/"));

  if (!isAdminRoute && !isAuthRoute) return NextResponse.next();

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
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();

  // Not logged in → login page
  if (!user) return NextResponse.redirect(new URL("/login", request.url));

  const role = user.app_metadata?.role || user.user_metadata?.role;

  // Admin routes require admin role
  if (isAdminRoute && role !== "admin") {
    return NextResponse.redirect(new URL("/client-dashboard", request.url));
  }

  return response;
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
