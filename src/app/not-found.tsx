import Link from "next/link";
import { EmptyState } from "@/components/ui";

export default function NotFound() {
  return <main id="main-content" tabIndex={-1} className="mx-auto max-w-3xl px-5 py-20"><EmptyState title="Page not found" description="Return to the public website or explore the fictional academy workspace."><div className="flex flex-wrap gap-4"><Link href="/" className="secondary-button">Public homepage</Link><Link href="/dashboard" className="secondary-button">Workspace demo</Link></div></EmptyState></main>;
}
