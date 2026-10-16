import Link from "next/link";
import { EmptyState } from "@/components/ui";

export default function NotFound() {
  return <EmptyState title="This page is outside the demo" description="Use the navigation to explore the academy workspace or return to the dashboard to start the guided demonstration."><Link href="/" className="button">Return to dashboard</Link></EmptyState>;
}
