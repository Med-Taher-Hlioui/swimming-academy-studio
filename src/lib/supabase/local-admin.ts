import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { workspaceAdminConfig, workspaceParentConfig, workspaceCookies } from "./local-admin-config";
import { AcademyError } from "../../features/academy/backend/validation";

async function createLocalWorkspaceClient(role: "admin" | "parent") {
  const config = role === "admin" ? workspaceAdminConfig() : workspaceParentConfig();
  if (!config) throw new AcademyError("unavailable");
  const store = await cookies();
  return createServerClient(config.url, config.publishableKey, {
    cookieOptions: workspaceCookies(role),
    global: { fetch: (input, init) => fetch(input, {...init, cache:"no-store"}) },
    cookies: {
      getAll: () => store.getAll(),
      setAll(values) {
        try { for (const {name,value,options} of values) store.set(name,value,options); }
        catch { /* Proxy persists refresh cookies for page requests. */ }
      },
    },
  });
}


export const createLocalAdminClient = () => createLocalWorkspaceClient("admin");
export const createLocalParentClient = () => createLocalWorkspaceClient("parent");
