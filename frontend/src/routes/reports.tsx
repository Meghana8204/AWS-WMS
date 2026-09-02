import { createFileRoute } from "@tanstack/react-router";
import {
  BarChart3,
  FileText,
  Download,
  TrendingUp,
  Clock,
  AlertTriangle,
  ArrowUpRight,
  Filter,
} from "lucide-react";
import { AppShell } from "@/components/wms/app-shell";
import { SectionCard } from "@/components/wms/primitives";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export const Route = createFileRoute("/reports")({
  component: Reports,
});

function Reports() {
  const reportTypes = [
    {
      title: "Inventory Valuation",
      desc: "Current stock value across all categories.",
      icon: TrendingUp,
    },
    { title: "Supplier Lead Times", desc: "Average days from PO issuance to GRN.", icon: Clock },
    { title: "Gate Entry Throughput", desc: "Daily vehicle processing metrics.", icon: BarChart3 },
    {
      title: "Material Rejection Report",
      desc: "Quality control failure analysis.",
      icon: AlertTriangle,
    },
    { title: "Warehouse Occupancy", desc: "Bin and rack utilization trends.", icon: BarChart3 },
    {
      title: "Procurement Spend",
      desc: "Monthly authorized spend by department.",
      icon: TrendingUp,
    },
  ];

  return (
    <AppShell
      title="Analytical Reports"
      subtitle="Data-driven insights for warehouse and procurement operations"
    >
      <div className="mb-8 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {reportTypes.map((report, idx) => (
          <Card
            key={idx}
            className="group border-border/40 hover:border-primary/30 transition-all hover:shadow-soft overflow-hidden"
          >
            <CardContent className="p-6">
              <div className="flex items-start justify-between">
                <div className="size-12 rounded-2xl bg-primary-soft/20 flex items-center justify-center text-primary mb-4 group-hover:scale-110 transition-transform">
                  <BarChart3 className="size-6" />
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="rounded-full h-8 w-8 text-muted-foreground hover:text-primary"
                >
                  <ArrowUpRight className="size-4" />
                </Button>
              </div>
              <h3 className="font-bold text-foreground mb-1">{report.title}</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">{report.desc}</p>
              <div className="mt-6 flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 rounded-lg text-[10px] font-black uppercase"
                >
                  <FileText className="size-3 mr-1.5" /> Preview
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 rounded-lg text-[10px] font-black uppercase"
                >
                  <Download className="size-3 mr-1.5" /> Export PDF
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <SectionCard
        title="Scheduled Distributions"
        description="Automated email reports sent to stakeholders"
        icon={Clock}
      >
        <div className="space-y-4">
          <ScheduledItem
            title="Daily Gate Activity"
            recipients="Security, Warehouse Mgr"
            frequency="Daily @ 18:00"
          />
          <ScheduledItem
            title="Weekly Stock Level"
            recipients="Procurement, Inventory Team"
            frequency="Monday @ 08:00"
          />
          <ScheduledItem
            title="Monthly Spend Summary"
            recipients="Finance Head, CFO"
            frequency="1st of Month"
          />
        </div>
      </SectionCard>
    </AppShell>
  );
}

function ScheduledItem({ title, recipients, frequency }: any) {
  return (
    <div className="flex items-center justify-between p-4 rounded-xl border border-border/60 bg-muted/20">
      <div className="flex items-center gap-4">
        <div className="size-10 rounded-xl bg-card flex items-center justify-center border border-border shadow-sm">
          <FileText className="size-5 text-muted-foreground" />
        </div>
        <div>
          <p className="text-sm font-bold">{title}</p>
          <p className="text-[10px] text-muted-foreground">Recipients: {recipients}</p>
        </div>
      </div>
      <div className="text-right">
        <p className="text-xs font-black text-primary uppercase">{frequency}</p>
        <span className="text-[9px] font-bold text-success-foreground bg-success-soft/30 px-1.5 py-0.5 rounded border border-success/20 mt-1 inline-block">
          ACTIVE
        </span>
      </div>
    </div>
  );
}
