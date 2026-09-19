import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Next.js 16 renamed `middleware.ts` to `proxy.ts`. It runs on the Node.js
 * runtime and the `runtime` config option throws if set.
 *
 * This is an OPTIMISTIC gate only. It checks for the presence of a session
 * cookie and nothing more:
 *
 *  - it runs on prefetches, so it must never touch the database;
 *  - the bundled auth guide states plainly that Proxy "should not be your only
 *    line of defense", and warns that moving a Server Action to another route
 *    can silently remove Proxy coverage.
 *
 * Real authentication and authorisation live in @bass/auth/dal and are
 * re-checked inside every Server Action, Route Handler and protected page.
 *
 * Because the administration app is now a separate deployment, the whole
 * origin is protected rather than a /admin sub-path.
 */

const SESSION_COOKIE = "bass_session";

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  // The login page is deliberately NOT redirected away from when a cookie is
  // present. A stale or revoked cookie would otherwise bounce between /login
  // (proxy sees a cookie) and / (the page guard sees no valid session)
  // forever. The login page resolves the real session itself.
  if (pathname === "/login") {
    return NextResponse.next();
  }

  if (!request.cookies.get(SESSION_COOKIE)?.value) {
    const url = new URL("/login", request.url);
    url.searchParams.set("next", `${pathname}${search}`);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  // Without a matcher this would run on every asset request, including CSS and
  // images. `media` is excluded so uploaded files stream without this hop.
  matcher: ["/((?!api|_next/static|_next/image|media|favicon.ico).*)"],
};
