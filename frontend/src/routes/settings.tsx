import { createFileRoute } from "@tanstack/react-router";
import { Settings as SettingsIcon } from "lucide-react";
import { AppShell } from "@/components/wms/app-shell";
import { ModulePlaceholder } from "@/components/wms/module-placeholder";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "Settings · NexusWMS" },
      { name: "description", content: "Notification rules, escalation matrix, shift configuration and user preferences." },
      { property: "og:title", content: "Settings · NexusWMS" },
      { property: "og:description", content: "Escalation matrix, shift configuration and notification preferences." },
    ],
  }),
  component: () => (
    <AppShell title="Settings" subtitle="Notification rules, escalation matrix, shifts and preferences">
      <ModulePlaceholder icon={SettingsIcon} title="Workspace settings" description="Escalation thresholds and notification routing are configured here in the full product." />
    </AppShell>
  ),
});
