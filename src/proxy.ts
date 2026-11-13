import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

export function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    "/admin/:path*",
    "/parent/:path*",
    "/dashboard/:path*",
    "/swimmers/:path*",
    "/groups/:path*",
    "/attendance/:path*",
    "/registrations/:path*",
    "/shark-ai/:path*",
    "/settings/:path*",
  ],
};
