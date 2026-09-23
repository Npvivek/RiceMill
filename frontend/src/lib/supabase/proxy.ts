import { createServerClient } from "@supabase/ssr";
import type { CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function refreshSupabaseSession(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  const pathname = request.nextUrl.pathname;
  if (!url || !publishableKey) {
    if (pathname.startsWith("/dashboard") || pathname === "/import") {
      return NextResponse.redirect(new URL("/login", request.url));
    }
    return NextResponse.next({ request });
  }

  const responseCookies: Array<{ name: string; value: string; options: CookieOptions }> = [];
  const supabase = createServerClient(url, publishableKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        cookiesToSet.forEach(({ name, value, options }) => responseCookies.push({ name, value, options }));
      },
    },
  });

  const authStartedAt = performance.now();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  console.info("[performance] supabase-auth-verification", {
    path: pathname,
    durationMs: Math.round(performance.now() - authStartedAt),
  });

  const requestHeaders = new Headers(request.headers);
  requestHeaders.delete("x-rice-mill-user-id");
  requestHeaders.delete("x-rice-mill-user-email");
  if (user) {
    requestHeaders.set("x-rice-mill-user-id", user.id);
    requestHeaders.set("x-rice-mill-user-email", encodeURIComponent(user.email ?? ""));
  }

  function finalize(response: NextResponse) {
    responseCookies.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
    return response;
  }

  if ((pathname.startsWith("/dashboard") || pathname === "/import") && !user) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", pathname);
    return finalize(NextResponse.redirect(loginUrl));
  }

  if (pathname === "/login" && user) {
    return finalize(NextResponse.redirect(new URL("/dashboard", request.url)));
  }

  return finalize(NextResponse.next({ request: { headers: requestHeaders } }));
}
