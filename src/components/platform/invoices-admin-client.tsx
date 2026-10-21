"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { PlatformPageHeader } from "@/components/platform/ui/page-header";
import { PlatformEmptyState } from "@/components/platform/ui/empty-state";
import { formatMoney } from "@/lib/platform/format";
import { platformStatusBadge } from "@/lib/platform/status-badge";

type Invoice = {
  id: string;
  number: string;
  status: string;
  provider: string;
  total: string | number;
  currency: string;
  organization: { name: string };
  paymentUrl: string | null;
};

type RowAction = "mark_paid" | "set_url" | null;

export function InvoicesAdminClient({ canWrite }: { canWrite: boolean }) {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [status, setStatus] = useState("all");
  const [loading, setLoading] = useState(true);
  const [active, setActive] = useState<Invoice | null>(null);
  const [rowAction, setRowAction] = useState<RowAction>(null);
  const [paymentUrl, setPaymentUrl] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const sp = status !== "all" ? `?status=${status}` : "";
      const res = await fetch(`/api/platform/invoices${sp}`);
      const json = await res.json();
      if (json.success) setInvoices(json.data.invoices);
      else toast.error(json.error?.message || "Load failed");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  function openAction(inv: Invoice, action: RowAction) {
    setActive(inv);
    setRowAction(action);
    setPaymentUrl(inv.paymentUrl || "");
    setReason("");
  }

  async function submit() {
    if (!active || !rowAction) return;
    setBusy(true);
    try {
      if (rowAction === "mark_paid") {
        const res = await fetch("/api/platform/invoices", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "mark_paid",
            invoiceId: active.id,
            amount: Number(active.total),
            method: "manual",
            reason: reason || "Mark paid",
          }),
        });
        const json = await res.json();
        if (!json.success) throw new Error(json.error?.message || "Failed");
        toast.success("Marked paid");
      } else {
        const res = await fetch("/api/platform/invoices", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "set_payment_url",
            invoiceId: active.id,
            paymentUrl,
            reason: reason || "Set Payoneer URL",
          }),
        });
        const json = await res.json();
        if (!json.success) throw new Error(json.error?.message || "Failed");
        toast.success("Payment URL saved");
      }
      setActive(null);
      setRowAction(null);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <PlatformPageHeader
        title="Invoices"
        description="All tenants — mark paid is Super Admin only."
        actions={
          <Select
            value={status}
            onValueChange={(v) => v && setStatus(v)}
          >
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="OPEN">Open</SelectItem>
              <SelectItem value="OVERDUE">Overdue</SelectItem>
              <SelectItem value="PAID">Paid</SelectItem>
              <SelectItem value="VOID">Void</SelectItem>
            </SelectContent>
          </Select>
        }
      />

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Invoice list</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-2">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : invoices.length === 0 ? (
            <PlatformEmptyState
              title="No invoices"
              description="Manual and synced invoices will show here."
            />
          ) : (
            <div className="overflow-x-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Number</TableHead>
                    <TableHead>Organization</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Provider</TableHead>
                    <TableHead>Total</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invoices.map((inv) => {
                    const badge = platformStatusBadge(inv.status);
                    return (
                      <TableRow key={inv.id}>
                        <TableCell className="font-medium">{inv.number}</TableCell>
                        <TableCell>{inv.organization.name}</TableCell>
                        <TableCell>
                          <Badge variant={badge.variant}>{badge.label}</Badge>
                        </TableCell>
                        <TableCell>{inv.provider}</TableCell>
                        <TableCell className="tabular-nums">
                          {formatMoney(inv.total, { currency: inv.currency })}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex flex-wrap justify-end gap-1">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() =>
                                window.open(
                                  `/api/billing/invoices/${inv.id}/html`,
                                  "_blank"
                                )
                              }
                            >
                              View
                            </Button>
                            {canWrite &&
                              inv.status !== "PAID" &&
                              inv.status !== "VOID" && (
                                <>
                                  <Button
                                    size="sm"
                                    onClick={() => openAction(inv, "mark_paid")}
                                  >
                                    Mark paid
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => openAction(inv, "set_url")}
                                  >
                                    Set URL
                                  </Button>
                                </>
                              )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog
        open={!!active && !!rowAction}
        onOpenChange={(o) => {
          if (!o) {
            setActive(null);
            setRowAction(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {rowAction === "mark_paid" ? "Mark invoice paid" : "Set payment URL"}
            </DialogTitle>
            <DialogDescription>
              {active
                ? `${active.number} · ${active.organization.name} · ${formatMoney(active.total, { currency: active.currency })}`
                : null}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {rowAction === "set_url" && (
              <div className="space-y-1.5">
                <Label>Payment URL</Label>
                <Input
                  value={paymentUrl}
                  onChange={(e) => setPaymentUrl(e.target.value)}
                  placeholder="https://…"
                />
              </div>
            )}
            <div className="space-y-1.5">
              <Label>Reason</Label>
              <Input
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Required for audit"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setActive(null);
                setRowAction(null);
              }}
              disabled={busy}
            >
              Cancel
            </Button>
            <Button
              disabled={busy || !reason.trim() || (rowAction === "set_url" && !paymentUrl.trim())}
              onClick={() => void submit()}
            >
              {busy ? "Saving…" : "Confirm"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
