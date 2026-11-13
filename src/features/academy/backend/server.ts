import "server-only";
import { createClient } from "../../../lib/supabase/server";
import { controlled, type AcademyPort, type Filters } from "./access";
import { adminRepository, parentRepository } from "./repositories";
import { AcademyError } from "./validation";

export function createAcademyPort(client: Awaited<ReturnType<typeof createClient>>): AcademyPort {

  return {
    async identity() {
      const {data,error} = await client.auth.getUser();
      if (error) {
        if (error.name === "AuthSessionMissingError" || [400,401,403].includes(error.status ?? 0)) return null;
        throw error;
      }
      return data.user && {id:data.user.id,verified:!!data.user.email_confirmed_at && !data.user.is_anonymous};
    },
    async rows<T>(table: string, columns: string, filters: Filters, order: readonly string[], offset: number, limit: number) {
      let query = client.from(table).select(columns);
      for (const [key,value] of Object.entries(filters)) query = value === null ? query.is(key,null) : query.eq(key,value);
      for (const key of order) query = query.order(key,{ascending:true});
      const {data,error} = await query.range(offset,offset+limit-1);
      if (error) throw error;
      return data as unknown as T[];
    },
    async count(table,filters) {
      let query = client.from(table).select("id",{head:true,count:"exact"});
      for (const [key,value] of Object.entries(filters)) query = value === null ? query.is(key,null) : query.eq(key,value);
      const {count,error} = await query;
      if (error) throw error;
      if (count === null) throw new AcademyError("unavailable");
      return count;
    },
    async rpc<T>(name: string,args: Filters,select?: string) {
      const call = client.rpc(name,args);
      const {data,error} = await (select ? call.select(select) : call);
      if (error) throw error;
      return data as T;
    },
  };
}

// Always create per request; these objects capture the SSR caller, not a privileged key.
export async function createAcademyAdminRepository(academy: unknown) {
  return adminRepository(createAcademyPort(await controlled(createClient)),academy);
}
export async function createAcademyParentRepository(academy: unknown) {
  return parentRepository(createAcademyPort(await controlled(createClient)),academy);
}

