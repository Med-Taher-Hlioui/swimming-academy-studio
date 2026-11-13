import "server-only";

import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseConfig } from "./config";
import { workspaceAdminConfig, workspaceParentConfig, workspaceCookies } from "./local-admin-config";

export async function updateSession(request: NextRequest) {
  const isAdmin = request.nextUrl.pathname.startsWith("/admin");
  const isParent = request.nextUrl.pathname.startsWith("/parent");
  const config = isAdmin ? workspaceAdminConfig() : isParent ? workspaceParentConfig() : getSupabaseConfig();
  if (request.nextUrl.pathname === "/parent/auth/callback") return NextResponse.next({ request });
  if (!config) {
    const response = NextResponse.next({ request });
    if (isAdmin || isParent) response.headers.set("Cache-Control", "private, no-store");
    return response;
  }

  let response = NextResponse.next({ request });
  const supabase = createServerClient(config.url, config.publishableKey, {
    cookieOptions: isAdmin || isParent ? workspaceCookies(isAdmin ? "admin" : "parent") : { sameSite: "lax", secure: process.env.NODE_ENV === "production" },
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        Object.entries(headers).forEach(([name, value]) => response.headers.set(name, value));
      },
    },
  });

  await supabase.auth.getClaims();
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}
