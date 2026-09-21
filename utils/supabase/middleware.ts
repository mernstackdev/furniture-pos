import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

// Reachable without a session. /setup is the first-run admin bootstrap; it
// closes itself once an admin exists (enforced in the database).
const PUBLIC_PATHS = ["/login", "/setup"];

/**
 * Refreshes the Supabase session and gates app routes.
 *
 * `getClaims()` is used rather than `getSession()`: it verifies the token
 * signature (refreshing it when close to expiry), whereas `getSession()` trusts
 * whatever the cookie says, which is forgeable.
 *
 * Note this is NOT the only line of defence. Proxy never sees Server Action
 * requests as distinct routes, so every action re-checks the caller itself.
 */
export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const supabase = createServerClient(supabaseUrl!, supabaseKey!, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        supabaseResponse = NextResponse.next({
          request,
        });
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options)
        );
      },
    },
  });

  const { data } = await supabase.auth.getClaims();
  const isSignedIn = Boolean(data?.claims);

  const { pathname } = request.nextUrl;
  const isPublicPath = PUBLIC_PATHS.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`)
  );

  if (!isSignedIn && !isPublicPath) {
    return redirectTo(request, supabaseResponse, "/login");
  }

  if (isSignedIn && isPublicPath) {
    return redirectTo(request, supabaseResponse, "/");
  }

  return supabaseResponse;
}

/**
 * Builds a redirect that still carries the refreshed auth cookies. Dropping
 * them here is what signs a user out on the following request.
 */
function redirectTo(
  request: NextRequest,
  supabaseResponse: NextResponse,
  pathname: string
) {
  const url = request.nextUrl.clone();
  url.pathname = pathname;
  url.search = "";

  const response = NextResponse.redirect(url);
  supabaseResponse.cookies.getAll().forEach((cookie) => response.cookies.set(cookie));
  return response;
}
