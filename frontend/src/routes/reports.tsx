import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import {
  BarChart3,
  FileText,
  Download,
  TrendingUp,
  Clock,
  AlertTriangle,
  ArrowUpRight,
  ShieldCheck,
  PackageCheck,
  Boxes,
  CheckCircle2,
  XCircle,
  Eye,
  Printer,
} from "lucide-react";
import { AppShell } from "@/components/wms/app-shell";
import { SectionCard } from "@/components/wms/primitives";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";

export const Route = createFileRoute("/reports")({
  component: Reports,
});

type ReportItem = {
  id: string;
  title: string;
  desc: string;
  icon: any;
  category: string;
  metric: string;
  data: { label: string; val: string; benchmark: string; status: string }[];
};

function Reports() {
  const [selectedReport, setSelectedReport] = useState<ReportItem | null>(null);

  const reportTypes: ReportItem[] = [
    {
      id: "inv-val",
      title: "Inventory Valuation",
      desc: "Current stock financial value across all warehouse categories and bins.",
      icon: TrendingUp,
      category: "Finance & Inventory",
      metric: "₹ 4,25,80,000 Total Stock Value",
      data: [
        { label: "Raw Materials (Iron MAT-001)", val: "₹ 1,20,50,000", benchmark: "₹ 1.00 Cr", status: "Optimal" },
        { label: "Fasteners (Screws, Nuts, Bolts)", val: "₹ 85,30,000", benchmark: "₹ 80.00 L", status: "Balanced" },
        { label: "Finished Assemblies", val: "₹ 2,20,000,00", benchmark: "₹ 2.00 Cr", status: "High Turnover" },
      ],
    },
    {
      id: "supp-lead",
      title: "Supplier Lead Times",
      desc: "Average turnaround days from PO issuance to Gate Entry & GRN completion.",
      icon: Clock,
      category: "Vendor Logistics",
      metric: "2.3 Days Avg Delivery SLA",
      data: [
        { label: "ABC Supplier (PO-1001)", val: "2.1 Days", benchmark: "< 3.0 Days", status: "SLA Compliant" },
        { label: "XYZ Industries (PO-1002)", val: "1.8 Days", benchmark: "< 3.0 Days", status: "Fast Delivery" },
        { label: "Global Tech Components", val: "3.4 Days", benchmark: "< 3.0 Days", status: "Minor Delay" },
      ],
    },
    {
      id: "gate-thru",
      title: "Gate Entry Throughput",
      desc: "Daily vehicle processing metrics, dock assignment times, and gate queues.",
      icon: BarChart3,
      category: "Gate Logistics",
      metric: "142 Vehicles / Month",
      data: [
        { label: "Avg Gate Verification Time", val: "4.2 Minutes", benchmark: "< 5.0 Mins", status: "Fast Track" },
        { label: "Dock Unloading Turnaround", val: "18.5 Minutes", benchmark: "< 25.0 Mins", status: "Optimal" },
        { label: "Peak Gate Arrival Hour", val: "11:00 AM - 01:00 PM", benchmark: "Scheduled", status: "Managed" },
      ],
    },
    {
      id: "mat-reject",
      title: "Material Rejection Report",
      desc: "Quality control failure analysis, damaged batch rates & damage photo proof.",
      icon: AlertTriangle,
      category: "Quality Assurance",
      metric: "99.3% Good Pass Rate",
      data: [
        { label: "Iron MAT-001 Pass Rate", val: "90.0% (10 Damaged)", benchmark: "> 95.0%", status: "Requires Review" },
        { label: "Screws MAT-002 Pass Rate", val: "100.0% (0 Damaged)", benchmark: "> 95.0%", status: "100% Passed" },
        { label: "Nuts MAT-003 Pass Rate", val: "95.0% (10 Damaged)", benchmark: "> 95.0%", status: "Acceptable" },
        { label: "Bolts MAT-004 Pass Rate", val: "100.0% (0 Damaged)", benchmark: "> 95.0%", status: "100% Passed" },
      ],
    },
    {
      id: "wh-occupancy",
      title: "Warehouse Occupancy",
      desc: "Bin, rack, and dock utilization trends across receiving and storage zones.",
      icon: Boxes,
      category: "Storage Management",
      metric: "78.3% Bin Occupancy",
      data: [
        { label: "Zone A (Raw Materials)", val: "84.2% Occupied", benchmark: "< 85.0%", status: "High Capacity" },
        { label: "Zone B (Fasteners)", val: "68.5% Occupied", benchmark: "< 85.0%", status: "Available" },
        { label: "Receiving Docks (DOCK-01, 02)", val: "88.0% Occupied", benchmark: "< 90.0%", status: "Active Utilization" },
      ],
    },
    {
      id: "procurement-spend",
      title: "Procurement Spend",
      desc: "Monthly authorized spend by department vs actual received GRN invoices.",
      icon: TrendingUp,
      category: "Procurement Audit",
      metric: "₹ 1,45,00,000 Authorized Spend",
      data: [
        { label: "Received GRN Goods Value", val: "₹ 1,38,50,000", benchmark: "₹ 1.45 Cr", status: "Within Budget" },
        { label: "Pending Invoice Clearance", val: "₹ 6,50,00,00", benchmark: "< ₹ 10.0 L", status: "Audited" },
        { label: "3-Way Matching Variance", val: "0.0% Discrepancy", benchmark: "0.0%", status: "100% Reconciled" },
      ],
    },
  ];

  function printPdfReport(report: ReportItem) {
    const win = window.open("", "_blank", "width=850,height=900");
    if (!win) {
      toast.error("Please allow popups to generate PDF report");
      return;
    }
    const rowsHtml = report.data
      .map(
        (d, idx) => `
        <tr>
          <td>${idx + 1}</td>
          <td><strong>${d.label}</strong></td>
          <td style="font-family: monospace; font-weight: bold;">${d.val}</td>
          <td style="color: #666;">${d.benchmark}</td>
          <td><span style="color: #059669; font-weight: bold;">${d.status}</span></td>
        </tr>
      `,
      )
      .join("");

    win.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>NexusWMS Analytical Report - ${report.title}</title>
          <style>
            body { font-family: system-ui, -apple-system, sans-serif; padding: 30px; line-height: 1.6; color: #111; }
            .header { border-bottom: 2px solid #000; padding-bottom: 15px; margin-bottom: 20px; display: flex; justify-content: space-between; align-items: center; }
            h1 { margin: 0; font-size: 22px; color: #000; }
            .meta { font-size: 11px; color: #555; margin-top: 4px; }
            .summary { display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px; margin-bottom: 25px; }
            .box { border: 1px solid #ccc; padding: 12px; border-radius: 8px; background: #f8fafc; }
            .box h3 { margin: 0; font-size: 10px; text-transform: uppercase; color: #64748b; }
            .box p { margin: 4px 0 0; font-size: 16px; font-weight: bold; color: #0f172a; }
            table { width: 100%; border-collapse: collapse; margin-top: 15px; font-size: 12px; }
            th, td { border: 1px solid #e2e8f0; padding: 10px; text-align: left; }
            th { background: #f1f5f9; font-weight: bold; text-transform: uppercase; font-size: 10px; color: #475569; }
            .footer { margin-top: 40px; border-top: 1px solid #e2e8f0; padding-top: 15px; font-size: 11px; color: #64748b; text-align: center; }
          </style>
        </head>
        <body>
          <div class="header">
            <div>
              <h1>NexusWMS Analytics Report: ${report.title}</h1>
              <p class="meta">Category: <strong>${report.category}</strong> | Generated On: <strong>${new Date().toLocaleString()}</strong></p>
            </div>
            <div style="text-align: right;">
              <strong style="font-size: 12px; color: #2563eb;">WMS ENTERPRISE AUDIT</strong><br>
              <span class="meta">Plant 1200 · DC Bangalore</span>
            </div>
          </div>

          <div class="summary">
            <div class="box">
              <h3>Overall Metric</h3>
              <p style="color: #2563eb;">${report.metric}</p>
            </div>
            <div class="box">
              <h3>Audit Status</h3>
              <p style="color: #059669;">VERIFIED & AUDITED</p>
            </div>
            <div class="box">
              <h3>Data Sync</h3>
              <p style="color: #059669;">100% Realtime</p>
            </div>
          </div>

          <h3>Executive Summary</h3>
          <p style="font-size: 12px; color: #334155;">${report.desc}</p>

          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Category / Performance Metric</th>
                <th>Current Value</th>
                <th>SLA Benchmark Target</th>
                <th>Audit Status</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml}
            </tbody>
          </table>

          <div class="footer">
            NexusWMS Enterprise Goods Receiving & Analytics System · Printed for internal warehouse auditing.
          </div>

          <script>
            window.onload = () => { window.focus(); window.print(); };
          </script>
        </body>
      </html>
    `);
    win.document.close();
  }

  return (
    <AppShell
      title="Analytical Reports & Operations Analytics"
      subtitle="Data-driven insights for goods receiving, supplier SLAs, quality pass rates, and inventory valuation"
    >
      {/* REPORTS CARDS GRID */}
      <div className="mb-8 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {reportTypes.map((report) => (
          <Card
            key={report.id}
            className="group border-border/40 hover:border-primary/50 transition-all hover:shadow-md overflow-hidden cursor-pointer bg-card"
            onClick={() => {
              setSelectedReport(report);
              toast.info(`Opening ${report.title} Report Viewer`);
            }}
          >
            <CardContent className="p-6 space-y-3">
              <div className="flex items-start justify-between">
                <div className="size-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-white transition-colors">
                  <report.icon className="size-6" />
                </div>
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                  {report.category}
                </span>
              </div>

              <div>
                <h3 className="font-bold text-foreground text-base group-hover:text-primary transition-colors">
                  {report.title}
                </h3>
                <p className="text-xs text-muted-foreground leading-relaxed mt-1">{report.desc}</p>
              </div>

              <div className="rounded-xl border bg-muted/20 p-2.5 font-mono text-xs font-bold text-primary flex items-center justify-between">
                <span>Key Metric:</span>
                <span>{report.metric}</span>
              </div>

              <div className="pt-2 flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1 rounded-xl text-xs font-bold"
                  onClick={() => {
                    setSelectedReport(report);
                    toast.info(`Previewing ${report.title}`);
                  }}
                >
                  <Eye className="size-3.5 mr-1.5 text-primary" /> Interactive Preview
                </Button>
                <Button
                  size="sm"
                  className="rounded-xl text-xs font-bold bg-primary text-white hover:bg-primary/90"
                  onClick={() => {
                    printPdfReport(report);
                    toast.success(`Exporting ${report.title} PDF`);
                  }}
                >
                  <Download className="size-3.5 mr-1.5" /> PDF
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* SCHEDULED DISTRIBUTIONS SECTION */}
      <SectionCard
        title="Automated Scheduled Distributions"
        description="Automated email report distribution to warehouse managers, procurement heads, and finance auditors"
        icon={Clock}
      >
        <div className="space-y-4">
          <ScheduledItem
            title="Daily Gate Activity & Arrival Log"
            recipients="Gate Security, Warehouse Manager"
            frequency="Daily @ 18:00"
          />
          <ScheduledItem
            title="Weekly Stock & GRN Receipts Summary"
            recipients="Procurement Team, Inventory Controller"
            frequency="Monday @ 08:00"
          />
          <ScheduledItem
            title="Monthly Supplier Quality & Rejection Audit"
            recipients="Finance Head, Quality Manager, CFO"
            frequency="1st of Month @ 09:00"
          />
        </div>
      </SectionCard>

      {/* 📊 INTERACTIVE REPORT VIEWER DIALOG */}
      {selectedReport && (
        <Dialog open={!!selectedReport} onOpenChange={() => setSelectedReport(null)}>
          <DialogContent className="sm:max-w-2xl rounded-2xl p-6 space-y-5">
            <DialogHeader>
              <div className="flex items-center gap-3">
                <div className="size-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                  <selectedReport.icon className="size-5" />
                </div>
                <div>
                  <DialogTitle className="text-lg font-bold text-foreground">
                    {selectedReport.title} Analytics Report
                  </DialogTitle>
                  <DialogDescription className="text-xs text-muted-foreground">
                    Category: <b>{selectedReport.category}</b> | Audit Scope: <b>Current Month (2026)</b>
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>

            <div className="rounded-xl border bg-primary/5 p-4 flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Overall Performance Metric</span>
                <p className="font-mono text-xl font-extrabold text-primary mt-0.5">{selectedReport.metric}</p>
              </div>
              <span className="px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 text-xs font-bold border border-emerald-200">
                ✓ VERIFIED & AUDITED
              </span>
            </div>

            <div className="space-y-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Detailed Metric Breakdown</h4>
              <div className="rounded-xl border overflow-hidden text-xs">
                <table className="w-full text-left">
                  <thead className="bg-muted font-bold text-muted-foreground border-b">
                    <tr>
                      <th className="p-3">Performance Category</th>
                      <th className="p-3">Recorded Value</th>
                      <th className="p-3">Benchmark SLA</th>
                      <th className="p-3">Audit Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y font-medium">
                    {selectedReport.data.map((d, idx) => (
                      <tr key={idx} className="hover:bg-muted/20">
                        <td className="p-3 font-bold text-foreground">{d.label}</td>
                        <td className="p-3 font-mono font-bold text-primary">{d.val}</td>
                        <td className="p-3 font-mono text-muted-foreground">{d.benchmark}</td>
                        <td className="p-3">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                            {d.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="flex items-center justify-between pt-3 border-t">
              <Button variant="outline" className="rounded-xl" onClick={() => setSelectedReport(null)}>
                Close Preview
              </Button>
              <Button
                className="rounded-xl font-bold bg-primary text-white shadow-md"
                onClick={() => {
                  printPdfReport(selectedReport);
                  toast.success(`Exporting ${selectedReport.title} PDF`);
                }}
              >
                <Printer className="mr-2 size-4" /> Print / Export PDF Report
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </AppShell>
  );
}

function ScheduledItem({ title, recipients, frequency }: any) {
  return (
    <div className="flex items-center justify-between p-4 rounded-xl border border-border/60 bg-muted/20 hover:bg-muted/40 transition-colors">
      <div className="flex items-center gap-4">
        <div className="size-10 rounded-xl bg-card flex items-center justify-center border border-border shadow-sm text-primary">
          <FileText className="size-5" />
        </div>
        <div>
          <p className="text-sm font-bold text-foreground">{title}</p>
          <p className="text-xs text-muted-foreground">Recipients: <b className="text-foreground">{recipients}</b></p>
        </div>
      </div>
      <div className="text-right">
        <p className="text-xs font-mono font-black text-primary uppercase">{frequency}</p>
        <span className="text-[10px] font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-full border border-emerald-200 mt-1 inline-block">
          ACTIVE SCHEDULE
        </span>
      </div>
    </div>
  );
}
