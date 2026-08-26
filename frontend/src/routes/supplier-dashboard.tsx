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
  XCircle,
  Truck,
  Plus,
  Loader2,
} from "lucide-react";
import { api } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import { requireRole } from "@/lib/auth-utils";
import { AppShell } from "@/components/wms/app-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
export const Route = createFileRoute("/supplier-dashboard")({
  beforeLoad: () => requireRole("SUPPLIER"),
  component: SupplierDashboard,
});
function SupplierDashboard() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [supplierId, setSupplierId] = useState("");
  const [username, setUsername] = useState("");
  const [rfqs, setRfqs] = useState<any[]>([]);
  const [quotations, setQuotations] = useState<any[]>([]);
  const [asns, setAsns] = useState<any[]>([]);
  const [declineRfqId, setDeclineRfqId] = useState("");
  const [declineReason, setDeclineReason] = useState("");
  const [declining, setDeclining] = useState(false);
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
        const [fetchedRfqs, fetchedQuotes, fetchedAsns] = await Promise.all([
          api.getRfqs(sid),
          api.getQuotations(undefined, sid),
          api.getAsns(sid),
        ]);
        setRfqs(fetchedRfqs);
        setQuotations(fetchedQuotes);
        setAsns(fetchedAsns);
      } catch (error: any) {
        toast.error("Error loading dashboard data: " + error.message);
      } finally {
        setLoading(false);
      }
    };
    fetchAllData();
  }, []);
  const handleDeclineRfq = async () => {
    const reason = declineReason.trim();
    if (!reason) {
      toast.error("Please provide a reason for declining this RFQ.");
      return;
    }
    try {
      setDeclining(true);
      const declinedQuotation = await api.declineRfq(declineRfqId, reason);
      setQuotations((previous) => [
        declinedQuotation,
        ...previous.filter((quotation) => quotation.id !== declinedQuotation.id),
      ]);
      setDeclineRfqId("");
      setDeclineReason("");
      toast.success("RFQ declined and procurement has been notified.");
    } catch (error: any) {
      toast.error("Unable to decline RFQ: " + error.message);
    } finally {
      setDeclining(false);
    }
  };
  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center gap-3 bg-background">
        <Loader2 className="size-8 animate-spin text-primary" />
        <span className="text-sm text-muted-foreground">Loading supplier workspace...</span>
      </div>
    );
  }
  const rfqsReceived = rfqs.length;
  const quotationByRfq = new Map(
    quotations.map((quotation) => [quotation.rfqId || quotation.rfq_id, quotation]),
  );
  const bidRfqIds = new Set(quotationByRfq.keys());
  const rfqsPending = rfqs.filter((r) => !bidRfqIds.has(r.id)).length;
  const quotesSubmitted = quotations.length;
  const asnsDispatched = asns.length;
  return (
    <AppShell title="Supplier Portal" subtitle={`Welcome back, ${username}`}>
      <div className="space-y-8">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card className="border-border/40 bg-card/60 backdrop-blur-md shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                RFQs Received
              </span>
              <FileSpreadsheet className="size-4 text-blue-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-extrabold tracking-tight">{rfqsReceived}</div>
              <p className="text-[10px] text-muted-foreground mt-1">Total bid requests received</p>
            </CardContent>
          </Card>

          <Card className="border-border/40 bg-card/60 backdrop-blur-md shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Pending Bid
              </span>
              <Clock className="size-4 text-amber-500 animate-pulse" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-extrabold tracking-tight text-amber-500">
                {rfqsPending}
              </div>
              <p className="text-[10px] text-muted-foreground mt-1">Requires immediate response</p>
            </CardContent>
          </Card>

          <Card className="border-border/40 bg-card/60 backdrop-blur-md shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Bids Submitted
              </span>
              <FileCheck className="size-4 text-success" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-extrabold tracking-tight text-success">
                {quotesSubmitted}
              </div>
              <p className="text-[10px] text-muted-foreground mt-1">Quotation logs archived</p>
            </CardContent>
          </Card>

          <Card className="border-border/40 bg-card/60 backdrop-blur-md shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                ASNs Dispatched
              </span>
              <Truck className="size-4 text-rose-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-extrabold tracking-tight text-rose-500">
                {asnsDispatched}
              </div>
              <p className="text-[10px] text-muted-foreground mt-1">Total shipment notifications</p>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="rfqs" className="w-full space-y-4">
          <TabsList className="bg-muted/40 p-1 rounded-xl">
            <TabsTrigger value="rfqs" className="rounded-lg px-4 py-2 text-xs font-bold">
              RFQs Received
            </TabsTrigger>
            <TabsTrigger value="quotations" className="rounded-lg px-4 py-2 text-xs font-bold">
              Quotations Submitted
            </TabsTrigger>
            <TabsTrigger value="asns" className="rounded-lg px-4 py-2 text-xs font-bold">
              ASNs & Shipments
            </TabsTrigger>
          </TabsList>

          <TabsContent value="rfqs">
            <Card className="border-border/40 shadow-soft">
              <CardHeader>
                <CardTitle className="text-base font-bold">Requests for Quotation</CardTitle>
                <CardDescription className="text-xs">
                  View all RFQs you have been invited to submit proposals for.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                {rfqs.length === 0 ? (
                  <div className="p-8 text-center text-xs text-muted-foreground">
                    No RFQs received yet.
                  </div>
                ) : (
                  <div className="divide-y divide-border/60">
                    {rfqs.map((rfq, idx) => {
                      const quotation = quotationByRfq.get(rfq.id);
                      const hasBid = Boolean(quotation);
                      const isRejected =
                        String(quotation?.status || "").toUpperCase() === "REJECTED";
                      const isDeclined =
                        String(quotation?.status || "").toUpperCase() === "DECLINED";
                      return (
                        <div
                          key={rfq.id || `rfq-${idx}`}
                          className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 hover:bg-muted/10 transition-colors"
                        >
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <h4 className="text-sm font-bold">{rfq.rfqNumber}</h4>
                              <span
                                className={cn(
                                  "rounded-full px-2 py-0.5 text-[10px] font-bold uppercase",
<<<<<<< HEAD
                                  hasBid
=======
                                  isRejected || isDeclined
                                    ? "bg-destructive/10 text-destructive"
                                    : hasBid
>>>>>>> origin/main
                                    ? "bg-success-soft/30 text-success"
                                    : "bg-amber-soft/30 text-amber-500 animate-pulse",
                                )}
                              >
<<<<<<< HEAD
                                {hasBid ? "Submitted" : "Pending Bid"}
=======
                                {isRejected
                                  ? "Revision Required"
                                  : isDeclined
                                    ? "Declined"
                                    : hasBid
                                      ? "Submitted"
                                      : "Pending Bid"}
>>>>>>> origin/main
                              </span>
                            </div>
                            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                              <span className="flex items-center gap-1">
                                <Calendar className="size-3.5" /> Delivery:{" "}
                                {rfq.requiredDeliveryDate || "N/A"}
                              </span>
                              <span className="flex items-center gap-1">
                                <Building2 className="size-3.5" /> WH: {rfq.warehouse}
                              </span>
                              <span className="font-semibold text-primary">
                                {rfq.items?.length || 0} Materials requested
                              </span>
                            </div>
                          </div>
                          <div>
<<<<<<< HEAD
                            {hasBid ? (
=======
                            {isRejected ? (
                              <Button
                                asChild
                                size="sm"
                                className="rounded-xl bg-destructive text-xs text-destructive-foreground hover:bg-destructive/90"
                              >
                                <Link to="/submit-quotation" search={{ rfqId: rfq.id }}>
                                  Revise Quotation <ChevronRight className="ml-1.5 size-3.5" />
                                </Link>
                              </Button>
                            ) : isDeclined ? (
                              <Button variant="outline" size="sm" className="rounded-xl text-xs" disabled>
                                RFQ Declined
                              </Button>
                            ) : hasBid ? (
>>>>>>> origin/main
                              <Button
                                variant="outline"
                                size="sm"
                                className="rounded-xl text-xs"
                                disabled
                              >
                                Bid Submitted
                              </Button>
                            ) : (
<<<<<<< HEAD
                              <Button
                                asChild
                                size="sm"
                                className="rounded-xl text-xs bg-amber-500 hover:bg-amber-600 text-white shadow-glow"
                              >
                                <Link to="/submit-quotation" search={{ rfqId: rfq.id }}>
                                  Submit Bid <ChevronRight className="ml-1.5 size-3.5" />
                                </Link>
                              </Button>
=======
                              <div className="flex gap-2">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="rounded-xl border-destructive/40 text-xs text-destructive hover:bg-destructive/10"
                                  onClick={() => {
                                    setDeclineRfqId(rfq.id);
                                    setDeclineReason("");
                                  }}
                                >
                                  <XCircle className="mr-1.5 size-3.5" /> Decline
                                </Button>
                                <Button
                                  asChild
                                  size="sm"
                                  className="rounded-xl text-xs bg-amber-500 hover:bg-amber-600 text-white shadow-glow"
                                >
                                  <Link to="/submit-quotation" search={{ rfqId: rfq.id }}>
                                    Submit Bid <ChevronRight className="ml-1.5 size-3.5" />
                                  </Link>
                                </Button>
                              </div>
>>>>>>> origin/main
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

          <TabsContent value="quotations">
            <Card className="border-border/40 shadow-soft">
              <CardHeader>
                <CardTitle className="text-base font-bold">Quotations Archive</CardTitle>
                <CardDescription className="text-xs">
                  History of all submissions sent to the procurement team.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                {quotations.length === 0 ? (
                  <div className="p-8 text-center text-xs text-muted-foreground">
                    No quotations submitted yet.
                  </div>
                ) : (
                  <div className="divide-y divide-border/60">
<<<<<<< HEAD
                    {quotations.map((q, idx) => (
=======
                    {quotations.map((q, idx) => {
                      const isRejected = String(q.status || "").toUpperCase() === "REJECTED";
                      const isDeclined = String(q.status || "").toUpperCase() === "DECLINED";
                      const rejectionReason = String(q.remarks || "")
                        .split("\n")
                        .findLast((line) => line.startsWith("Rejected by "));
                      const quotationRfqId = q.rfqId || q.rfq_id;
                      return (
>>>>>>> origin/main
                      <div
                        key={q.id || `quo-${idx}`}
                        className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 hover:bg-muted/10 transition-colors"
                      >
<<<<<<< HEAD
                        <div className="space-y-1">
=======
                        <div className="space-y-2">
>>>>>>> origin/main
                          <div className="flex items-center gap-2">
                            <h4 className="text-sm font-bold">
                              Quote Reference: {q.id.substring(0, 8).toUpperCase()}
                            </h4>
<<<<<<< HEAD
                            <span className="rounded-full bg-success-soft/30 text-success px-2 py-0.5 text-[10px] font-bold uppercase">
=======
                            <span
                              className={cn(
                                "rounded-full px-2 py-0.5 text-[10px] font-bold uppercase",
                                isRejected || isDeclined
                                  ? "bg-destructive/10 text-destructive"
                                  : "bg-success-soft/30 text-success",
                              )}
                            >
>>>>>>> origin/main
                              {q.status}
                            </span>
                          </div>
                          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                            <span>RFQ ID: {quotationRfqId}</span>
                            <span>Date: {new Date(q.created_at).toLocaleDateString()}</span>
                          </div>
                          {(isRejected || isDeclined) && (
                            <div className="max-w-xl rounded-xl border border-destructive/20 bg-destructive/10 p-3 text-xs">
                              <p className="flex items-center gap-1.5 font-bold text-destructive">
                                <AlertCircle className="size-3.5" />
                                {isDeclined ? "Your decline reason" : "Rejection reason"}
                              </p>
                              <p className="mt-1 text-muted-foreground">
                                {rejectionReason || q.remarks || "Please contact procurement for more details."}
                              </p>
                            </div>
                          )}
                        </div>
                        <div className="text-right">
                          <span className="text-sm font-extrabold text-foreground">
                            INR {parseFloat(q.total_amount || 0).toLocaleString()}
                          </span>
                          <span className="block text-[10px] text-muted-foreground mt-0.5">
                            {q.lines?.length || 0} items quoted
                          </span>
<<<<<<< HEAD
=======
                          {isRejected && quotationRfqId && (
                            <Button asChild size="sm" className="mt-3 rounded-xl text-xs">
                              <Link to="/submit-quotation" search={{ rfqId: quotationRfqId }}>
                                Revise & Resubmit
                              </Link>
                            </Button>
                          )}
>>>>>>> origin/main
                        </div>
                      </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="asns">
            <Card className="border-border/40 shadow-soft">
              <CardHeader>
                <CardTitle className="text-base font-bold">Advance Shipping Notices</CardTitle>
                <CardDescription className="text-xs">
                  Track shipment transit notifications and vehicle arrivals.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                {asns.length === 0 ? (
                  <div className="p-8 text-center text-xs text-muted-foreground">
                    No ASNs dispatched.
                  </div>
                ) : (
                  <div className="divide-y divide-border/60">
                    {asns.map((asn, idx) => (
                      <div
                        key={asn.id || `asn-${idx}`}
                        className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 hover:bg-muted/10 transition-colors"
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <h4 className="text-sm font-bold">ASN: {asn.asn_number}</h4>
                            <span
                              className={cn(
                                "rounded-full px-2 py-0.5 text-[10px] font-bold uppercase",
                                asn.status === "Received"
                                  ? "bg-success-soft/30 text-success"
                                  : "bg-blue-soft/30 text-blue-500",
                              )}
                            >
                              {asn.status}
                            </span>
                          </div>
                          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                            <span>Vehicle: {asn.vehicle_number || "—"}</span>
                            <span>
                              Arrival:{" "}
                              {asn.expected_arrival_at
                                ? new Date(asn.expected_arrival_at).toLocaleString()
                                : "—"}
                            </span>
                          </div>
                        </div>
                        <div className="text-right text-xs">
                          <span className="block font-semibold">
                            Lines: {asn.lines?.length || 0}
                          </span>
                          <span className="block text-muted-foreground mt-0.5">
                            Created: {new Date(asn.created_at).toLocaleDateString()}
                          </span>
                          <Button
                            asChild
                            variant="outline"
                            size="sm"
                            className="mt-3 rounded-xl text-xs"
                          >
                            <Link to="/procurement/asns/$asnId" params={{ asnId: asn.id }}>
                              View / Edit
                            </Link>
                          </Button>
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
      <Dialog open={Boolean(declineRfqId)} onOpenChange={(open) => !open && setDeclineRfqId("")}>
        <DialogContent className="max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <XCircle className="size-5" /> Decline RFQ
            </DialogTitle>
            <DialogDescription>
              Procurement will see this reason. This response applies only to your supplier account.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="decline-reason">Reason for declining *</Label>
            <Textarea
              id="decline-reason"
              value={declineReason}
              onChange={(event) => setDeclineReason(event.target.value)}
              placeholder="For example: unable to meet the required delivery date"
              className="min-h-28 rounded-xl"
              maxLength={500}
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setDeclineRfqId("")} disabled={declining}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDeclineRfq} disabled={declining}>
              {declining && <Loader2 className="mr-2 size-4 animate-spin" />}
              Confirm Decline
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
