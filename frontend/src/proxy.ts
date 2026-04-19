import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function proxy(request: NextRequest) {
  const token = request.cookies.get("access_token");
  const { pathname } = request.nextUrl;

  // Auth disabled for testing — uncomment to re-enable
  // if (pathname.startsWith("/dashboard") && !token) {
  //   const loginUrl = new URL("/login", request.url);
  //   loginUrl.searchParams.set("next", pathname);
  //   return NextResponse.redirect(loginUrl);
  // }

  // if (pathname === "/login" && token) {
  //   return NextResponse.redirect(new URL("/dashboard", request.url));
  // }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/login"],
};
