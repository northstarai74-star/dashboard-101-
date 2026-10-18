import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, loginDisabled, readSession } from "@/lib/token";

// Optimistic gate only: redirects signed-out visitors to /login.
// Route handlers and server components still verify the user themselves.
export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (loginDisabled()) return NextResponse.next();
  const session = await readSession(req.cookies.get(SESSION_COOKIE)?.value);

  // /login is never redirected away from: a valid JWT can outlive its user row (e.g. after a reseed),
  // and bouncing to "/" would then loop with the layout's redirect back to /login.
  if (pathname === "/login") return NextResponse.next();
  if (!session) return NextResponse.redirect(new URL("/login", req.url));
  return NextResponse.next();
}

export const config = {
  // Everything except API (handlers self-authenticate; Meta webhook must stay public) and static assets
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
