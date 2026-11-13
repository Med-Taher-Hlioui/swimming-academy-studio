"use server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createLocalParentClient } from "../../../lib/supabase/local-admin";
import { workspaceParentConfig, workspaceCookies } from "../../../lib/supabase/local-admin-config";
import { authDestination, invitationToken, isUuid } from "./rules";

export async function parentSignIn(form:FormData) {
  const destination=authDestination(form.get("intent"));
  if (!workspaceParentConfig()) redirect("/parent/login?notice=unavailable");
  let valid=false;
  try {
    const email=form.get("email"), password=form.get("password");
    if(typeof email==="string" && email.length<=254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) &&
      typeof password==="string" && password.length>0 && password.length<=256) {
      const client=await createLocalParentClient();
      const {data,error}=await client.auth.signInWithPassword({email:email.trim(),password});
      valid=!error&&!!data.user?.email_confirmed_at&&!data.user.is_anonymous;
      if(!valid&&data.session)await client.auth.signOut({scope:"local"});
    }
  } catch { /* Never log credentials or provider errors. */ }
  redirect(valid ? destination : "/parent/login?notice=credentials"+(destination.endsWith("/invite")?"&intent=invite":""));
}
export async function parentSignOut() {
  if (workspaceParentConfig()) {
    try { const client=await createLocalParentClient(); await client.auth.signOut({scope:"local"}); } catch { /* Clear browser state below. */ }
  }
  const localParentCookies=workspaceCookies("parent");
  const store=await cookies();
  for(const {name} of store.getAll()) {
    if (name===localParentCookies.name || name.startsWith(localParentCookies.name+".") || name.startsWith(localParentCookies.name+"-")) {
      store.set(name,"",{...localParentCookies,maxAge:0});
    }
  }
  redirect("/parent/login?notice=signedout");
}
export async function acceptInvitation(form:FormData) {
  if(!workspaceParentConfig())redirect("/parent/login?notice=unavailable");
  const token=form.get("token");
  if(!invitationToken(token))redirect("/parent/invite?notice=invite");
  const client=await createLocalParentClient();
  const {data}=await client.auth.getUser();
  if (!data.user?.email_confirmed_at||data.user.is_anonymous) redirect("/parent/login?intent=invite&notice=session");
  let academy:unknown;
  try {
    const result=await client.rpc("academy_accept_parent_invitation",{p_token:token});
    if(!result.error)academy=result.data;
  } catch { /* Invalid, expired, consumed and wrong-recipient tokens share a message. */ }
  redirect(typeof academy==="string"&&isUuid(academy) ? "/parent?academy="+academy : "/parent/invite?notice=invite");
}

