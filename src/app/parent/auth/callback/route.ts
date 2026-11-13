import { NextResponse, type NextRequest } from "next/server";
import { createLocalParentClient } from "../../../../lib/supabase/local-admin";
import { workspaceParentConfig } from "../../../../lib/supabase/local-admin-config";
import { authDestination } from "../../../../features/academy/parent/rules";

export async function GET(request:NextRequest) {
  const code=request.nextUrl.searchParams.get("code");
  let path="/parent/login?notice=callback";
  if(workspaceParentConfig()&&code&&code.length<=256&&/^[A-Za-z0-9_-]+$/.test(code)) {
    try {
      const client=await createLocalParentClient();
      const {data,error}=await client.auth.exchangeCodeForSession(code);
      if(!error&&data.user?.email_confirmed_at&&!data.user.is_anonymous) path=authDestination(request.nextUrl.searchParams.get("intent"));
      else if(data.session) await client.auth.signOut({scope:"local"});
    } catch { /* Return a generic callback error. */ }
  }
  return new NextResponse(null,{status:303,headers:{Location:path,"Cache-Control":"private, no-store","Referrer-Policy":"no-referrer"}});
}

