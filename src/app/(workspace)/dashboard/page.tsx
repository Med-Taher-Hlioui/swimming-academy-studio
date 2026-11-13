import type { Metadata } from "next";
﻿import { OverviewDashboard } from "@/features/overview/overview-dashboard";

export default function Overview() {
  return <OverviewDashboard />;
}

export const metadata: Metadata = { title: "Overview" };
