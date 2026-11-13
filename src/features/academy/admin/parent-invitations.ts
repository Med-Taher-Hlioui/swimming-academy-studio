"use server";
import { createLocalAdminClient } from "../../../lib/supabase/local-admin";
import { workspaceAdminConfig } from "../../../lib/supabase/local-admin-config";
import { choice, date, text, uuid } from "../backend/validation";
import { invitationToken } from "../parent/rules";
import { openAdmin } from "./access";

type State={token?:string;error?:string};
export async function issueParentInvitation(_previous:State,form:FormData):Promise<State> {
  try {
    await openAdmin();
    const config=workspaceAdminConfig();
    if(!config||form.get("verified")!=="on")return {error:"Confirm the guardian relationship before issuing a token."};
    const email=text(form.get("email"),"email",254);
    if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return {error:"Enter a valid verified account email."};
    const client=await createLocalAdminClient();
    const {data,error}=await client.rpc("academy_issue_invitation",{
      p_academy:config.academy,p_email:email,p_role:"parent",p_swimmer:uuid(form.get("swimmer")),
      p_relationship:choice(form.get("relationship"),"relationship",["parent","legal_guardian"]),
      p_history_from:date(form.get("history"),"history"),p_relationship_verified:true,
    });
    const token=Array.isArray(data)?data[0]?.token:undefined;
    return !error&&invitationToken(token)?{token}:{error:"Invitation could not be issued. Check the swimmer and try again."};
  } catch { return {error:"An active Admin session and valid invitation details are required."}; }
}

