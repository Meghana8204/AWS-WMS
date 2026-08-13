import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  Building2,
  FileText,
  FileSpreadsheet,
  FileCheck,
  TrendingUp,
  Clock,
  ExternalLink,
  ChevronRight,
  Package,
  Calendar,
  AlertCircle,
  Truck,
  Plus,
  Loader2
} from "lucide-react";
import { api } from "@/lib/api-client";
import { AppShell } from "@/components/wms/app-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const Route = createFileRoute("/supplier-dashboard")({
  component: SupplierDashboard,
});

function SupplierDashboard() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [supplierId, setSupplierId] = useState("");
  const [username, setUsername] = useState("");

  // Lists
  const [rfqs, setRfqs] = useState<any[]>([]);
  const [quotations, setQuotations] = useState<any[]>([]);
  const [pos, setPos] = useState<any[]>([]);
  const [asns, setAsns] = useState<any[]>([]);

  useEffect(() => {
    const userInfoStr = localStorage.getItem("user_info");
    if (!userInfoStr) {
      toast.error("Please login first");
      navigate({ to: "/login" });
      return;
    }

    const userInfo = JSON.parse(userInfoStr);
    if (!userInfo.roles?.includes("SUPPLIER")) {
      toast.error("Unauthorized. Access restricted to supplier accounts.");
      navigate({ to: "/login" });
      return;
    }

    setSupplierId(userInfo.supplierId || "");
    setUsername(userInfo.username || "");

    const fetchAllData = async () => {
      try {
        const sid = userInfo.supplierId || "";
        const [fetchedRfqs, fetchedQuotes, fetchedPos, fetchedAsns] = await Promise.all([
          api.getRfqs(sid),
          api.getQuotations(undefined, sid),
          api.getPurchaseOrders(sid),
          api.getAsns(sid)
        ]);

        setRfqs(fetchedRfqs);
        setQuotations(fetchedQuotes);
        setPos(fetchedPos);
        setAsns(fetchedAsns);
      } catch (error: any) {
        toast.error("Error loading dashboard data: " + error.message);
      } finally {
        setLoading(false);
      }
    };

    fetchAllData();
  }, []);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center gap-3 bg-background">
        <Loader2 className="size-8 animate-spin text-primary" />
        <span className="text-sm text-muted-foreground">Loading supplier workspace...</span>
      </div>
    );
  }

  // Calculated stats
  const rfqsReceived = rfqs.length;
  const bidRfqIds = new Set(quotations.map((q) => q.rfq_id));
  const rfqsPending = rfqs.filter((r) => !bidRfqIds.has(r.id)).length;
  const quotesSubmitted = quotations.length;
  const purchaseOrdersCount = pos.length;

  // ASN Pending = POs that have status Open or Confirmed and do not have an associated ASN yet
  const asnPoIds = new Set(asns.map((a) => a.po_id));
  const asnPending = pos.filter((p) => !asnPoIds.has(p.id)).length;

  return (
    <AppShell title="Supplier Portal" subtitle={`Welcome back, ${username}`}>
      <div className="space-y-8">
        {/* KPI Grid */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <Card className="border-border/40 bg-card/60 backdrop-blur-md shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">RFQs Received</span>
              <FileSpreadsheet className="size-4 text-blue-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-extrabold tracking-tight">{rfqsReceived}</div>
              <p className="text-[10px] text-muted-foreground mt-1">Total bid requests received</p>
            </CardContent>
          </Card>

          <Card className="border-border/40 bg-card/60 backdrop-blur-md shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Pending Bid</span>
              <Clock className="size-4 text-amber-500 animate-pulse" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-extrabold tracking-tight text-amber-500">{rfqsPending}</div>
              <p className="text-[10px] text-muted-foreground mt-1">Requires immediate response</p>
            </CardContent>
          </Card>

          <Card className="border-border/40 bg-card/60 backdrop-blur-md shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Bids Submitted</span>
              <FileCheck className="size-4 text-success" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-extrabold tracking-tight text-success">{quotesSubmitted}</div>
              <p className="text-[10px] text-muted-foreground mt-1">Quotation logs archived</p>
            </CardContent>
          </Card>

          <Card className="border-border/40 bg-card/60 backdrop-blur-md shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Purchase Orders</span>
              <Package className="size-4 text-indigo-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-extrabold tracking-tight text-indigo-500">{purchaseOrdersCount}</div>
              <p className="text-[10px] text-muted-foreground mt-1">POs assigned by procurement</p>
            </CardContent>
          </Card>

          <Card className="border-border/40 bg-card/60 backdrop-blur-md shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">ASN Pending</span>
              <Truck className="size-4 text-rose-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-extrabold tracking-tight text-rose-500">{asnPending}</div>
              <p className="text-[10px] text-muted-foreground mt-1">Shipment notices missing</p>
            </CardContent>
          </Card>
        </div>

        {/* Tabular Lists */}
        <Tabs defaultValue="rfqs" className="w-full space-y-4">
          <TabsList className="bg-muted/40 p-1 rounded-xl">
            <TabsTrigger value="rfqs" className="rounded-lg px-4 py-2 text-xs font-bold">RFQs Received</TabsTrigger>
            <TabsTrigger value="quotations" className="rounded-lg px-4 py-2 text-xs font-bold">Quotations Submitted</TabsTrigger>
            <TabsTrigger value="purchase_orders" className="rounded-lg px-4 py-2 text-xs font-bold">Purchase Orders</TabsTrigger>
            <TabsTrigger value="asns" className="rounded-lg px-4 py-2 text-xs font-bold">ASNs & Shipments</TabsTrigger>
          </TabsList>

          {/* RFQs tab */}
          <TabsContent value="rfqs">
            <Card className="border-border/40 shadow-soft">
              <CardHeader>
                <CardTitle className="text-base font-bold">Requests for Quotation</CardTitle>
                <CardDescription className="text-xs">View all RFQs you have been invited to submit proposals for.</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                {rfqs.length === 0 ? (
                  <div className="p-8 text-center text-xs text-muted-foreground">No RFQs received yet.</div>
                ) : (
                  <div className="divide-y divide-border/60">
                    {rfqs.map((rfq) => {
                      const hasBid = bidRfqIds.has(rfq.id);
                      return (
                        <div key={rfq.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 hover:bg-muted/10 transition-colors">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <h4 className="text-sm font-bold">{rfq.rfqNumber}</h4>
                              <span className={cn(
                                "rounded-full px-2 py-0.5 text-[10px] font-bold uppercase",
                                hasBid ? "bg-success-soft/30 text-success" : "bg-amber-soft/30 text-amber-500 animate-pulse"
                              )}>
                                {hasBid ? "Submitted" : "Pending Bid"}
                              </span>
                            </div>
                            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                              <span className="flex items-center gap-1"><Calendar className="size-3.5" /> Delivery: {rfq.requiredDeliveryDate || "N/A"}</span>
                              <span className="flex items-center gap-1"><Building2 className="size-3.5" /> WH: {rfq.warehouse}</span>
                              <span className="font-semibold text-primary">{rfq.items?.length || 0} Materials requested</span>
                            </div>
                          </div>
                          <div>
                            {hasBid ? (
                              <Button variant="outline" size="sm" className="rounded-xl text-xs" disabled>
                                Bid Submitted
                              </Button>
                            ) : (
                              <Button asChild size="sm" className="rounded-xl text-xs bg-amber-500 hover:bg-amber-600 text-white shadow-glow">
                                <Link to="/submit-quotation" search={{ rfqId: rfq.id }}>
                                  Submit Bid <ChevronRight className="ml-1.5 size-3.5" />
                                </Link>
                              </Button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Quotations tab */}
          <TabsContent value="quotations">
            <Card className="border-border/40 shadow-soft">
              <CardHeader>
                <CardTitle className="text-base font-bold">Quotations Archive</CardTitle>
                <CardDescription className="text-xs">History of all submissions sent to the procurement team.</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                {quotations.length === 0 ? (
                  <div className="p-8 text-center text-xs text-muted-foreground">No quotations submitted yet.</div>
                ) : (
                  <div className="divide-y divide-border/60">
                    {quotations.map((q) => (
                      <div key={q.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 hover:bg-muted/10 transition-colors">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <h4 className="text-sm font-bold">Quote Reference: {q.id.substring(0, 8).toUpperCase()}</h4>
                            <span className="rounded-full bg-success-soft/30 text-success px-2 py-0.5 text-[10px] font-bold uppercase">
                              {q.status}
                            </span>
                          </div>
                          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                            <span>RFQ ID: {q.rfq_id}</span>
                            <span>Date: {new Date(q.created_at).toLocaleDateString()}</span>
                          </div>
                        </div>
                        <div className="text-right">
                          <span className="text-sm font-extrabold text-foreground">INR {parseFloat(q.total_amount || 0).toLocaleString()}</span>
                          <span className="block text-[10px] text-muted-foreground mt-0.5">{q.lines?.length || 0} items quoted</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Purchase Orders tab */}
          <TabsContent value="purchase_orders">
            <Card className="border-border/40 shadow-soft">
              <CardHeader>
                <CardTitle className="text-base font-bold">Purchase Orders Assigned</CardTitle>
                <CardDescription className="text-xs">Orders sent by the warehouse procurement division.</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                {pos.length === 0 ? (
                  <div className="p-8 text-center text-xs text-muted-foreground">No purchase orders found.</div>
                ) : (
                  <div className="divide-y divide-border/60">
                    {pos.map((po) => {
                      const hasAsn = asnPoIds.has(po.id);
                      return (
                        <div key={po.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 hover:bg-muted/10 transition-colors">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <h4 className="text-sm font-bold">PO: {po.po_number}</h4>
                              <span className={cn(
                                "rounded-full px-2 py-0.5 text-[10px] font-bold uppercase",
                                po.status === "Closed" ? "bg-muted text-muted-foreground" : "bg-indigo-soft/30 text-indigo-500"
                              )}>
                                {po.status}
                              </span>
                            </div>
                            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                              <span>PO Date: {po.po_date}</span>
                              <span className="font-semibold text-primary">{po.lines?.length || 0} line items</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-4">
                            <div className="text-right hidden sm:block">
                              <span className="block text-[10px] text-muted-foreground">ASN Shipping status</span>
                              <span className={cn("text-xs font-bold block mt-0.5", hasAsn ? "text-success" : "text-rose-500 animate-pulse")}>
                                {hasAsn ? "ASN Submitted" : "ASN Pending"}
                              </span>
                            </div>
                            <div>
                              {hasAsn ? (
                                <Button variant="outline" size="sm" className="rounded-xl text-xs" disabled>
                                  ASN Shipped
                                </Button>
                              ) : (
                                <Button asChild size="sm" className="rounded-xl text-xs bg-indigo-500 hover:bg-indigo-600 text-white shadow-glow">
                                  <Link to="/supplier/asns/new" search={{ poId: po.id, poNumber: po.po_number }}>
                                    Prepare Shipment <Truck className="ml-1.5 size-3.5" />
                                  </Link>
                                </Button>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ASNs tab */}
          <TabsContent value="asns">
            <Card className="border-border/40 shadow-soft">
              <CardHeader>
                <CardTitle className="text-base font-bold font-bold">Advance Shipping Notices</CardTitle>
                <CardDescription className="text-xs">Track shipment transit notifications and vehicle arrivals.</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                {asns.length === 0 ? (
                  <div className="p-8 text-center text-xs text-muted-foreground">No ASNs dispatched.</div>
                ) : (
                  <div className="divide-y divide-border/60">
                    {asns.map((asn) => (
                      <div key={asn.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 hover:bg-muted/10 transition-colors">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <h4 className="text-sm font-bold">ASN: {asn.asn_number}</h4>
                            <span className={cn(
                              "rounded-full px-2 py-0.5 text-[10px] font-bold uppercase",
                              asn.status === "Received" ? "bg-success-soft/30 text-success" : "bg-blue-soft/30 text-blue-500"
                            )}>
                              {asn.status}
                            </span>
                          </div>
                          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                            <span>Vehicle: {asn.vehicle_number || "—"}</span>
                            <span>Arrival: {asn.expected_arrival_at ? new Date(asn.expected_arrival_at).toLocaleString() : "—"}</span>
                          </div>
                        </div>
                        <div className="text-right text-xs">
                          <span className="block font-semibold">Lines: {asn.lines?.length || 0}</span>
                          <span className="block text-muted-foreground mt-0.5">Created: {new Date(asn.created_at).toLocaleDateString()}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AppShell>
  );
}
