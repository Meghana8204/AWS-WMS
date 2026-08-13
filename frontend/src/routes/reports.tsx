import { createFileRoute } from "@tanstack/react-router";
import { BarChart3 } from "lucide-react";
import { AppShell } from "@/components/wms/app-shell";
import { ModulePlaceholder } from "@/components/wms/module-placeholder";

export const Route = createFileRoute("/reports")({
  head: () => ({
    meta: [
      { title: "Reports · NexusWMS" },
      { name: "description", content: "Inbound performance reports: gate-to-dock dwell time, vendor scorecards and receiving throughput." },
      { property: "og:title", content: "Reports · NexusWMS" },
      { property: "og:description", content: "Dwell time, vendor scorecards and receiving throughput analytics." },
    ],
  }),
  component: () => (
    <AppShell title="Reports" subtitle="Dwell time, vendor scorecards and receiving throughput">
      <ModulePlaceholder icon={BarChart3} title="Reporting workspace" description="Scheduled inbound analytics live here. The arrival journey prototype covers dashboard-level KPIs instead." />
    </AppShell>
  ),
});
