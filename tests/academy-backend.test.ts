import assert from "node:assert/strict";
import { test } from "node:test";
import { academyAccess, type AcademyPort, type Filters } from "../src/features/academy/backend/access";
import { adminRepository, parentRepository } from "../src/features/academy/backend/repositories";
import { AcademyError, birthDate, date, guardian, period, phone, price, swimmer, term } from "../src/features/academy/backend/validation";

const A = "aaaaaaaa-0000-4000-8000-000000000001", B = "bbbbbbbb-0000-4000-8000-000000000002";
const USER = "cccccccc-0000-4000-8000-000000000003", CHILD = "dddddddd-0000-4000-8000-000000000004";
const MEMBERSHIP = "eeeeeeee-0000-4000-8000-000000000005";

function fake({role="admin", verified=true, signedIn=true, active=true, error}: {
  role?: string; verified?: boolean; signedIn?: boolean; active?: boolean; error?: string;
} = {}) {
  const calls: {name:string; filters:Filters; columns?:string}[] = [];
  const port: AcademyPort = {
    identity: async () => signedIn ? {id:USER,verified} : null,
    async rows<T>(name: string, columns: string, filters: Filters) {
      calls.push({name,filters,columns});
      const values = name === "academy_memberships"
        ? filters.academy_id === A && filters.profile_id === USER && filters.role === role && filters.status === "active" ? [{id:MEMBERSHIP}] : []
        : name === "academies" && active && filters.id === A ? [{id:A}] : [];
      return values as T[];
    },
    async count(name,filters) { calls.push({name,filters}); return filters.normalized_status === null ? 1 : 0; },
    async rpc<T>(name: string, filters: Filters, columns?: string) {
      calls.push({name,filters,columns});
      if (error) throw {code:error,message:"private DB detail"};
      return (name.startsWith("academy_parent_") ? [] : CHILD) as T;
    },
  };
  return {port,calls};
}

test("validates swimmer name, paired update version, and optional unknown skill level", () => {
  assert.equal(swimmer({name:" Fictional ",status:"trial",level:null}).p_level,null);
  assert.throws(() => swimmer({name:"Example",status:"trial",id:CHILD}), {field:"version"});
  assert.throws(() => swimmer({name:"\nExample",status:"trial"}), {field:"name"});
});

test("normalizes phone numbers only with explicit country context and validates email", () => {
  assert.equal(phone("00 216 20 123 456"),"+21620123456");
  assert.equal(phone("20 123 456","TN"),"+21620123456");
  assert.throws(() => phone("20123456"), {field:"phone"});
  assert.throws(() => phone("20123456 / 20987654","TN"), {field:"phone"});
  assert.throws(() => guardian({name:"Example",email:"not-an-email"}), {field:"email"});
});

test("validates calendar dates, date ordering and billing periods", () => {
  assert.equal(date("2024-02-29"),"2024-02-29");
  assert.throws(() => date("2026-02-29"), {field:"date"});
  assert.throws(() => birthDate("2026-12-01","2026-11-12"), {field:"birthDate"});
  assert.throws(() => term("2026-06-01","2026-05-31"), {field:"endsBefore"});
  assert.throws(() => period(2026,13), {field:"billingMonth"});
  assert.deepEqual(term(null,null),{p_starts:null,p_ends:null});
});

test("prices are exact decimal strings and validated before transport", async () => {
  assert.equal(price("999999999.999"),"999999999.999");
  assert.throws(() => price("60.0001"), {field:"monthlyPriceTnd"});
  assert.throws(() => price(60), {field:"monthlyPriceTnd"});
  const {port,calls} = fake();
  await adminRepository(port,A).savePlan({code:"60",label:"Example",monthlyPriceTnd:"60",active:true});
  assert.equal(calls.at(-1)?.filters.p_price,"60.000");
});

test("unverified or anonymous actors cannot reach membership or database operations", async () => {
  for (const options of [{verified:false},{signedIn:false}]) {
    const {port,calls}=fake(options);
    await assert.rejects(academyAccess(port,A,"admin"), {code:"unauthenticated"});
    assert.deepEqual(calls,[]);
  }
});

test("academy ID alone confers no access; archived and incorrect roles fail closed", async () => {
  for (const [id,options] of [[B,{}],[A,{role:"parent"}],[A,{role:"coach"}],[A,{active:false}]] as const) {
    const {port,calls}=fake(options);
    await assert.rejects(adminRepository(port,id).listSwimmers(), {code:"forbidden"});
    assert.ok(calls.every(call=>["academy_memberships","academies"].includes(call.name)));
  }
});

test("authorized writes pin the academy and suppress raw SQL errors", async () => {
  const {port,calls}=fake({error:"23505"});
  const admin = adminRepository(port,A);
  await assert.rejects(admin.saveSwimmer({name:"Example",level:"beginner",status:"active",p_academy:B}), {
    name:"AcademyError",code:"conflict",message:"conflict",
  });
  assert.deepEqual(calls.at(-1)?.filters, {
    p_id:null,p_expected:null,p_name:"Example",p_level:"beginner",p_status:"active",p_archive:false,p_academy:A,
  });
});

test("unknown swimmer levels require review without a write", async () => {
  const {port,calls}=fake();
  await assert.rejects(adminRepository(port,A).saveSwimmer({name:"Example",status:"trial"}),
    {code:"level_review_required"});
  assert.deepEqual(calls,[]);
});

test("monthly status preserves explicit unknown and NULL through operations and reporting", async () => {
  const {port,calls}=fake();
  const admin=adminRepository(port,A);
  for (const status of ["unknown",null]) {
    await admin.recordMonth({subscriptionId:CHILD,year:2026,month:6,status});
    assert.equal(calls.at(-1)?.filters.p_status,status);
    assert.equal(calls.at(-1)?.filters.p_year,2026);
  }
  const dashboard=await admin.dashboard(2026,6);
  assert.equal(dashboard.recordedMonthlyStatuses.blank,1);
  assert.equal(dashboard.recordedMonthlyStatuses.unknown,0);
});

test("parent access filters own verified relationships and only uses published projections", async () => {
  const {port,calls}=fake({role:"parent"});
  const parent=parentRepository(port,A);
  await parent.listVerifiedChildren();
  assert.deepEqual(calls.at(-1)?.filters,{academy_id:A,parent_membership_id:MEMBERSHIP,revoked_at:null});
  assert.equal(calls.at(-1)?.columns,"relationship,swimmers!inner(id,display_name,level)");
  assert.deepEqual(await parent.publishedChildDetails(CHILD),{subscriptions:[],monthlyStatuses:[],documents:[]});
  const rpc = calls.filter(c=>c.name.startsWith("academy_parent_"));
  assert.equal(rpc.length,3);
  assert.ok(rpc.every(c=>c.filters.p_academy === A && c.filters.p_swimmer === CHILD && !c.columns?.includes("source")));
});

test("document and approval inputs reject unsupported or forged values", () => {
  const {port}=fake();
  const admin=adminRepository(port,A);
  assert.throws(() => admin.saveDocument({swimmerId:CHILD,type:"certificate",status:"X"}), {field:"status"});
  assert.throws(() => admin.approveImportReview({batchId:CHILD,version:1,previewDigest:"fake"}), AcademyError);
});

