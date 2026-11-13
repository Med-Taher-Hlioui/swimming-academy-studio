import "server-only";
import { redirect } from "next/navigation";
import { cache } from "react";
import { createLocalAdminClient } from "../../../lib/supabase/local-admin";
import { workspaceAdminConfig } from "../../../lib/supabase/local-admin-config";
import { academyAccess } from "../backend/access";
import { adminRepository } from "../backend/repositories";
import { createAcademyPort } from "../backend/server";
import { AcademyError } from "../backend/validation";
import { adminReads } from "./reads";

export async function openAdmin() {
  const config = workspaceAdminConfig();
  if (!config) throw new AcademyError("unavailable");
  const client = await createLocalAdminClient();
  const port = createAcademyPort(client);
  await academyAccess(port,config.academy,"admin");
  return { ...adminRepository(port,config.academy), ...adminReads(client,config.academy) };
}

export const adminPage = cache(async () => {
  try { return await openAdmin(); }
  catch (error) {
    if (error instanceof AcademyError && error.code === "unauthenticated") redirect("/admin/login?notice=session");
    if (error instanceof AcademyError && error.code === "forbidden") redirect("/admin/login?notice=forbidden");
    redirect("/admin/login?notice=unavailable");
  }
});

