import { Suspense } from "react";
import { ParentDashboard } from "../../../../features/academy/parent/dashboard";
type Props={params:Promise<{id:string}>;searchParams:Promise<{academy?:string|string[]}>};
async function Child({params,searchParams}:Props) {
  const [{id},{academy}]=await Promise.all([params,searchParams]);
  return <ParentDashboard academyId={typeof academy==="string"?academy:""} swimmer={id}/>;
}
export default function Page(props:Props) {
  return <Suspense fallback={<p className="p-8" role="status">Loading child profile…</p>}><Child {...props}/></Suspense>;
}

