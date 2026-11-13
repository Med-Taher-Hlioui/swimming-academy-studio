import Link from "next/link";
import { Suspense } from "react";
import { parentSignIn } from "../../../features/academy/parent/actions";
import { ParentNotice, Section, SignInFrame } from "../../../features/academy/parent/ui";

type Props={searchParams:Promise<{notice?:string;intent?:string}>};
async function Login({searchParams}:Props) {
  const {notice,intent}=await searchParams;
  return <SignInFrame><ParentNotice code={notice}/>
    <Section title={intent==="invite"?"Sign in to accept an invitation":"Your verified account"}><form action={parentSignIn} className="grid gap-4">
      {intent==="invite"&&<input type="hidden" name="intent" value="invite"/>}
      <label className="grid gap-1 text-sm font-medium">Email<input className="rounded-lg border border-slate-300 px-3 py-2" name="email" type="email" required maxLength={254} autoComplete="username"/></label>
      <label className="grid gap-1 text-sm font-medium">Password<input className="rounded-lg border border-slate-300 px-3 py-2" name="password" type="password" required maxLength={256} autoComplete="current-password"/></label>
      <button className="button justify-self-start">Sign in</button>
    </form></Section>
    {intent!=="invite"&&<Link href="/parent/login?intent=invite" className="mt-5 inline-block font-semibold text-cyan-800">I have an invitation</Link>}
  </SignInFrame>;
}
export default function Page(props:Props) {
  return <Suspense fallback={<p className="p-8">Loading sign-in…</p>}><Login {...props}/></Suspense>;
}

