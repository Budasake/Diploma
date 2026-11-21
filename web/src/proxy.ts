import { NextResponse, type NextRequest } from "next/server";

/*
 * Quick check before a dashboard page loads: no login cookie → go to /login.
 * This is only an "optimistic" check (it doesn't verify the token). The real
 * check happens in the page via requireRole() and in FastAPI on every request.
 */
export function proxy(request: NextRequest) {
  if (!request.cookies.has("access_token")) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", request.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/student/:path*", "/teacher/:path*", "/admin/:path*"],
};
