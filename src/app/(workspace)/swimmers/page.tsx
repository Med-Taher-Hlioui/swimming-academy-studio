import type { Metadata } from "next";
import { PageHeading } from "@/components/ui";
import { SwimmerDirectory } from "@/features/swimmers/swimmer-directory";

export default function SwimmersPage() {
  return <>
    <PageHeading title="Swimmers" description="Browse the fictional roster. Group allocations update here when you edit a training group." />
    <SwimmerDirectory />
  </>;
}

export const metadata: Metadata = { title: "Swimmers" };
