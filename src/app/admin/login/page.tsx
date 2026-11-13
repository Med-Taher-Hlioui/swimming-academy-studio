import Link from "next/link";
import { Suspense } from "react";
import { PageHeading } from "../../../components/ui";
import { signIn } from "../../../features/academy/admin/actions";
import { Input, Notice, Panel, Save } from "../../../features/academy/admin/ui";

async function Login({searchParams}:{searchParams:Promise<{notice?:string}>}) {
  const {notice}=await searchParams;
  return <main className="mx-auto max-w-xl px-4 py-12"><PageHeading title="Admin sign-in" description="Sign in with an account authorized for the configured Shark Aquatics academy."/>
    <Notice code={typeof notice==="string"?notice:""}/>
    <Panel title="Your account"><form action={signIn} className="grid gap-4">
      <Input label="Email" name="email" type="email" required maxLength={254}/><Input label="Password" name="password" type="password" required maxLength={256}/><Save>Sign in</Save>
    </form></Panel><Link href="/dashboard" className="mt-5 inline-block text-sm font-semibold text-cyan-800">Open the fictional demo</Link>
  </main>;
}
export default function Page(props:Parameters<typeof Login>[0]) {
  return <Suspense fallback={<p className="p-8">Loading sign-in…</p>}><Login {...props}/></Suspense>;
}

