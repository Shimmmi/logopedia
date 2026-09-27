import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const PROTECTED = ["/dashboard", "/pupils", "/schedule", "/documents", "/ai", "/images", "/library", "/reports", "/settings", "/admin", "/change-password"];

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (PROTECTED.some((p) => pathname === p || pathname.startsWith(p + "/"))) {
    if (!req.cookies.get("lp_session")) {
      const url = req.nextUrl.clone();
      url.pathname = "/login";
      url.searchParams.set("next", pathname);
      return NextResponse.redirect(url);
    }
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/pupils/:path*", "/schedule/:path*", "/documents/:path*", "/ai/:path*", "/images", "/images/:path*", "/library/:path*", "/reports/:path*", "/settings/:path*", "/admin/:path*", "/change-password"],
};
