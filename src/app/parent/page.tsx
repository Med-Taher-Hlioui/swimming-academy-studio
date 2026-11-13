import { Suspense } from "react";
import { ParentDashboard } from "../../features/academy/parent/dashboard";
type Props={searchParams:Promise<{academy?:string|string[]}>};
async function Workspace({searchParams}:Props) {
  const {academy}=await searchParams;
  return <ParentDashboard academyId={typeof academy==="string"?academy:""} swimmer=""/>;
}
export default function Page(props:Props) {
  return <Suspense fallback={<p className="p-8" role="status">Loading Parent workspace…</p>}><Workspace {...props}/></Suspense>;
}

