import type { AcademyRole } from "./contracts";
import { AcademyError, databaseFailure, uuid } from "./validation";

export type Scalar = string | number | boolean | null;
export type Filters = Record<string, Scalar>;
export interface AcademyPort {
  identity(): Promise<{ id: string; verified: boolean } | null>;
  rows<T>(table: string, columns: string, filters: Filters, order: readonly string[], offset: number, limit: number): Promise<T[]>;
  count(table: string, filters: Filters): Promise<number>;
  rpc<T>(name: string, args: Filters, select?: string): Promise<T>;
}

export async function controlled<T>(operation: () => Promise<T>): Promise<T> {
  try { return await operation(); }
  catch (err) {
    if (err instanceof AcademyError) throw err;
    const code = typeof err === "object" && err && "code" in err && typeof err.code === "string" ? err.code : undefined;
    throw databaseFailure(code);
  }
}

export async function academyAccess(port: AcademyPort, candidate: unknown, role: AcademyRole) {
  const academy = uuid(candidate, "academyId");
  const actor = await controlled(() => port.identity());
  if (!actor?.verified) throw new AcademyError("unauthenticated");
  const [membership] = await controlled(() => port.rows<{ id: string }>("academy_memberships", "id",
    { academy_id: academy, profile_id: actor.id, status: "active", role }, ["id"], 0, 1));
  if (!membership) throw new AcademyError("forbidden");
  // Separate academy RLS check also rejects archived academies when the actor has multiple roles.
  const [active] = await controlled(() => port.rows<{ id: string }>("academies", "id",
    { id: academy, status: "active" }, ["id"], 0, 1));
  if (!active) throw new AcademyError("forbidden");
  return { academy, membership: membership.id };
}

