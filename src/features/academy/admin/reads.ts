import "server-only";
import type { createLocalAdminClient } from "../../../lib/supabase/local-admin";
import type { SwimmerRow } from "../backend/contracts";
import { controlled } from "../backend/access";
import { AcademyError, uuid } from "../backend/validation";

type Client = Awaited<ReturnType<typeof createLocalAdminClient>>;
type Reply<T> = {data:T | null;error:unknown};
async function read<T>(request: PromiseLike<Reply<T>>): Promise<T> {
  return controlled(async () => {
    const {data,error}=await request;
    if (error) throw error;
    if (data === null) throw new AcademyError("unavailable");
    return data;
  });
}

export function adminReads(client: Client, academy: string) {
  return {
    async searchSwimmers(query: string, level: string, status: string, offset: number) {
      let request=client.from("swimmers").select("id,display_name,level,status,archived_at,row_version").eq("academy_id",academy);
      if (query) request=request.ilike("display_name","%" + query.replace(/[\\%_]/g,"\\$&").replaceAll("*","\\*") + "%");
      if (level) request=request.eq("level",level);
      request=status === "archived" ? request.not("archived_at","is",null) : request.is("archived_at",null);
      if (status === "active" || status === "trial") request=request.eq("status",status);
      return read<SwimmerRow[]>(request.order("display_name").order("id").range(offset,offset+24));
    },
    async summaries() {
      const day=new Intl.DateTimeFormat("en-CA",{timeZone:"Africa/Tunis",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
      const active = () => client.from("academy_admin_swimmer_subscriptions").select("id",{head:true,count:"exact"})
        .eq("academy_id",academy).eq("lifecycle","confirmed").or("starts_on.is.null,starts_on.lte."+day).or("ends_before.is.null,ends_before.gt."+day);
      const count = async (query: PromiseLike<{count:number|null;error:unknown}>) => controlled(async () => {
        const {count,error}=await query;
        if(error) throw error;
        if(count===null) throw new AcademyError("unavailable");
        return count;
      });
      const [total,plans,documents,groups]=await Promise.all([
        count(active()),
        read<{id:string;label:string}[]>(client.from("academy_admin_subscription_plans").select("id,label").eq("academy_id",academy).order("label").order("id").limit(50)),
        Promise.all(["certificate","extract"].map(async type=>({type,
          statuses:await Promise.all(["received","unknown","missing","rejected"].map(status=>count(
            client.from("academy_admin_registration_document_statuses").select("id",{head:true,count:"exact"})
              .eq("academy_id",academy).eq("document_type",type).eq("status",status))))}))),
        read<{id:string;name:string;capacity:number;level:string}[]>(client.from("groups").select("id,name,capacity,level").eq("academy_id",academy).is("archived_at",null).order("name").order("id").limit(50)),
      ]);
      return {total, plans:await Promise.all(plans.map(async plan=>({...plan,count:await count(active().eq("plan_id",plan.id))}))),documents,groups};
    },
    async roster(session: string) {
      return read<{swimmer_id:string;swimmer_name_snapshot:string;attendance_version:number;attendance:{status:string;row_version:number}[]|{status:string;row_version:number}|null}[]>(
        client.from("session_roster").select("swimmer_id,swimmer_name_snapshot,attendance_version,attendance(status,row_version)")
          .eq("academy_id",academy).eq("session_id",uuid(session)).is("withdrawn_at",null).order("swimmer_name_snapshot").order("id").limit(100));
    },
  };
}

