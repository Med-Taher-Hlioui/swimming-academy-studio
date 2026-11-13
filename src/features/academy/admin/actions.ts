"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createLocalAdminClient } from "../../../lib/supabase/local-admin";
import { workspaceAdminConfig } from "../../../lib/supabase/local-admin-config";
import { AcademyError, choice, match, text, uuid } from "../backend/validation";
import { openAdmin } from "./access";

const field = (form: FormData, key: string) => typeof form.get(key)==="string" ? form.get(key) as string : "";
const optional = (form: FormData,key:string) => field(form,key) || null;
const number = (form: FormData,key:string) => Number(match(field(form,key),key,/^\d{1,15}$/));
const version = (form: FormData) => field(form,"version") ? number(form,"version") : null;
const selectedStatus = (form:FormData) => field(form,"status")==="blank" ? null : field(form,"status");
type Operation = "swimmer"|"birth"|"contact"|"link"|"plan"|"subscription"|"month"|"document"|"group"|"transfer"|"session"|"sessionStatus"|"attendance"|"resolve"|"coach"|"assignCoach"|"endAssignment"|"publish"|"term"|"revokeGuardian"|"note"|"publishNote"|"deleteNote"|"revokeInvitation";

export async function signIn(form:FormData) {
  if (!workspaceAdminConfig()) redirect("/admin/login?notice=unavailable");
  let notice="credentials";
  try {
    const email=match(text(field(form,"email"),"email",254),"email",/^[^\s@]+@[^\s@]+\.[^\s@]+$/);
    const password=field(form,"password");
    if (!password || password.length>256) throw new AcademyError("invalid_input");
    const client=await createLocalAdminClient();
    const result=await client.auth.signInWithPassword({email,password});
    if (!result.error) {
      try { await openAdmin(); notice=""; }
      catch (error) {
        await client.auth.signOut({scope:"local"});
        notice=error instanceof AcademyError && error.code==="forbidden" ? "forbidden" : "unavailable";
      }
    }
  } catch { /* Never include credentials or provider error details. */ }
  redirect(notice ? "/admin/login?notice="+notice : "/admin/dashboard");
}

export async function signOut() {
  if (workspaceAdminConfig()) {
    const client=await createLocalAdminClient();
    await client.auth.signOut({scope:"local"});
  }
  redirect("/admin/login");
}

export async function mutate(op:Operation, form:FormData) {
  let target: string = ({swimmer:"swimmers",birth:"swimmers",contact:"swimmers",link:"swimmers",plan:"subscriptions",
    subscription:"subscriptions",month:"subscriptions",document:"swimmers",group:"groups",transfer:"groups",
    revokeInvitation:"invitations",coach:"coaches",assignCoach:"coaches",endAssignment:"groups",publish:"swimmers",term:"subscriptions",revokeGuardian:"swimmers",note:"swimmers",publishNote:"swimmers",deleteNote:"swimmers",
    session:"attendance",sessionStatus:"attendance",attendance:"attendance",resolve:"registrations"} satisfies Record<Operation,string>)[op] ?? "dashboard";
  const query=new URLSearchParams();
  try {
    const repo=await openAdmin();
    const id=optional(form,"id"), expected=version(form);
    if(field(form,"year")) {const year=number(form,"year");if(year<1||year>9999)throw new AcademyError("invalid_input");query.set("year",String(year));}
    if(field(form,"month")) {const month=number(form,"month");if(month<1||month>12)throw new AcademyError("invalid_input");query.set("month",String(month));}
    const swimmer=optional(form,"swimmer");
    if (swimmer) query.set("swimmer",uuid(swimmer));
    const groupId=optional(form,"group");
    if(groupId) query.set("group",uuid(groupId));
    const coachId=optional(form,"coach");
    if(coachId) query.set("coach",uuid(coachId));
    switch(op) {
      case "revokeInvitation": await repo.revokeInvitation(id); break;
      case "coach": query.set("coach",await repo.saveCoach({id,version:expected,name:field(form,"name"),archived:field(form,"archive")==="on"})); break;
      case "assignCoach":
        target=field(form,"return")==="groups"?"groups":"coaches";
        await repo.assignCoach({coachId,groupId,from:field(form,"from"),until:optional(form,"until"),primary:field(form,"primary")==="on"}); break;
      case "endAssignment":
        target=field(form,"return")==="coaches"?"coaches":"groups";
        await repo.endAssignment({id,version:expected,kind:field(form,"kind"),until:field(form,"until")}); break;
      case "publish":
        target=field(form,"kind")==="document"?"swimmers":"subscriptions";
        await repo.publish(field(form,"kind"),id,expected,field(form,"visible")==="yes"); break;
      case "term": await repo.updateSubscription({id,version:expected,startsOn:optional(form,"start"),endsBefore:optional(form,"end"),lifecycle:field(form,"lifecycle")}); break;
      case "revokeGuardian": await repo.revokeVerifiedGuardian(id); break;
      case "note": await repo.saveNote({id,version:expected,swimmerId:swimmer,sessionId:optional(form,"noteSession"),body:field(form,"body")}); break;
      case "publishNote": await repo.publishNote(id,expected); break;
      case "deleteNote": await repo.deleteNote(id,expected); break;
      case "swimmer": {
        if(id) query.set("swimmer",uuid(id));
        const saved=await repo.saveSwimmer({id,version:expected,name:field(form,"name"),level:optional(form,"level"),status:field(form,"status"),archived:field(form,"archive")==="on"});
        query.set("swimmer",saved); break;
      }
      case "birth": await repo.saveBirthDate(swimmer,optional(form,"birth"),expected); break;
      case "contact": await repo.saveContact({id,version:expected,name:field(form,"name"),phone:optional(form,"phone"),email:optional(form,"email"),
        phoneCountry:field(form,"country")==="on" ? "TN" : undefined,archived:field(form,"archive")==="on"}); break;
      case "link": await repo.linkContact(swimmer,field(form,"contact"),choice(field(form,"linked"),"linked",["yes","no"])==="yes"); break;
      case "plan": await repo.savePlan({id,version:expected,code:field(form,"code"),label:field(form,"label"),
        monthlyPriceTnd:field(form,"price"),active:field(form,"active")==="on"}); break;
      case "subscription": await repo.openSubscription({swimmerId:swimmer,planId:field(form,"plan"),startsOn:optional(form,"start"),endsBefore:optional(form,"end"),confirmed:true}); break;
      case "month": {
        const month=number(form,"month");
        const year=field(form,"year")?number(form,"year"):2026;
        if(month<1||month>12||year<1||year>9999) throw new AcademyError("invalid_input");
        query.set("year",String(year));
        query.set("month",String(month));
        if(id) {
          const current=await repo.monthForPeriod(field(form,"subscription"),year,month);
          if(current?.id!==uuid(id)) throw new AcademyError("conflict");
          await repo.correctMonth({id,version:expected,status:selectedStatus(form),reason:"admin_correction"});
        }
        else await repo.recordMonth({subscriptionId:field(form,"subscription"),year,month,status:selectedStatus(form)});
        break;
      }
      case "document": await repo.saveDocument({swimmerId:swimmer,type:choice(field(form,"type"),"type",["certificate","extract"]),
        version:expected,status:field(form,"status")}); break;
      case "group": query.set("group",await repo.saveGroup({id,version:expected,name:field(form,"name"),level:field(form,"level"),capacity:number(form,"capacity"),
        schedule:optional(form,"schedule"),archived:field(form,"archive")==="on"})); break;
      case "transfer": await repo.transferSwimmer(field(form,"swimmer"),field(form,"group"),field(form,"from"),optional(form,"until")); break;
      case "session": {
        const group=uuid(field(form,"group")); query.set("group",group);
        query.set("session",await repo.createSession(group,field(form,"day"))); break;
      }
      case "sessionStatus":
      case "attendance": {
        const session=uuid(field(form,"session")); query.set("session",session);
        query.set("group",uuid(field(form,"group")));
        if(op==="sessionStatus") await repo.setSessionStatus(session,field(form,"status"),expected);
        else await repo.markAttendance({sessionId:session,swimmerId:swimmer,requestId:field(form,"request"),
          version:expected,status:selectedStatus(form),reason:optional(form,"reason")});
        break;
      }
      case "resolve":
        query.set("batch",uuid(field(form,"batch")));
        await repo.resolveImportException(id,expected,field(form,"resolution")); break;
      default: throw new AcademyError("invalid_input");
    }
    revalidatePath("/admin","layout");
    revalidatePath("/parent","layout");
    query.set("notice","saved");
  } catch (error) {
    if(error instanceof AcademyError && (error.code==="unauthenticated"||error.code==="forbidden")) {
      redirect("/admin/login?notice="+(error.code==="forbidden"?"forbidden":"session"));
    }
    query.set("notice",error instanceof AcademyError ? error.code : "unavailable");
  }
  target="/admin/"+target;
  redirect(target+"?"+query.toString());
}

