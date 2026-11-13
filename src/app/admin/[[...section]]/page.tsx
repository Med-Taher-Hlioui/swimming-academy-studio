import { connection } from "next/server";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { adminPage } from "../../../features/academy/admin/access";
import { Coaches } from "../../../features/academy/admin/management";
import { Attendance, Groups, ImportReview } from "../../../features/academy/admin/operations";
import { AdminShell, links, Notice } from "../../../features/academy/admin/ui";
import { Overview, queryValue, Subscriptions, Swimmers, type Query } from "../../../features/academy/admin/views";

type Props={params:Promise<{section?:string[]}>;searchParams:Promise<Query>};
async function Workspace({params,searchParams}:Props) {
  await connection();
  const [{section=[]},query]=await Promise.all([params,searchParams]);
  const path=section[0]??"dashboard";
  if(section.length>1||!links.some(([key])=>key===path)) notFound();
  const repo=await adminPage();
  const View=({coaches:Coaches,dashboard:Overview,swimmers:Swimmers,subscriptions:Subscriptions,groups:Groups,attendance:Attendance,registrations:ImportReview})[path as typeof links[number][0]];
  return <AdminShell section={path}><Notice code={queryValue(query,"notice")}/><View repo={repo} query={query}/></AdminShell>;
}
export default function Page(props:Props) {
  return <Suspense fallback={<main className="p-8" role="status">Loading Admin workspace…</main>}><Workspace {...props}/></Suspense>;
}

