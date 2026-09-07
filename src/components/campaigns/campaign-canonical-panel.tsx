"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { toast } from "sonner";
import { Loader2, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type SequenceOption = { id: string; name: string; status: string };
type ContactHit = {
  id: string;
  fullName: string;
  email: string | null;
  company?: { id: string; name: string } | null;
};
type OpportunityHit = {
  id: string;
  stage: string;
  companyId: string;
  company?: { name: string } | null;
};
type EnrollmentRow = {
  id: string;
  status: string;
  currentStepOrder: number;
  nextRunAt: string | Date | null;
  lastExecutedAt?: string | Date | null;
  stopReason: string | null;
  createdAt?: string | Date;
  sequence: { id: string; name: string };
  contact: {
    id: string;
    fullName: string;
    email: string | null;
    company?: { id: string; name: string } | null;
  };
  opportunity: { id: string; stage: string } | null;
};

type LegacyLeadRow = {
  id: string;
  bridgedAt: string | Date | null;
  lead: {
    id: string;
    fullName: string;
    email: string | null;
    company: string | null;
    status: string;
    automationStatus: string;
  };
  sequenceEnrollment: {
    id: string;
    status: string;
    currentStepOrder: number;
  } | null;
};

interface CampaignCanonicalPanelProps {
  campaignId: string;
  defaultSequenceId: string | null;
  sequences: SequenceOption[];
  enrollments: EnrollmentRow[];
  legacyLeads: LegacyLeadRow[];
  /** PATCH default sequence — campaigns.manage */
  canManageCampaigns: boolean;
  /** POST enrollments — campaigns.manage | sequences.manage | opportunities.update */
  canEnroll: boolean;
  canBridge: boolean;
}

export function CampaignCanonicalPanel({
  campaignId,
  defaultSequenceId,
  sequences,
  enrollments,
  legacyLeads,
  canManageCampaigns,
  canEnroll,
  canBridge,
}: CampaignCanonicalPanelProps) {
  const router = useRouter();
  const activeSequences = useMemo(
    () => sequences.filter((s) => s.status === "ACTIVE"),
    [sequences]
  );

  const [defaultSeq, setDefaultSeq] = useState(defaultSequenceId ?? "");
  const [search, setSearch] = useState("");
  const [contacts, setContacts] = useState<ContactHit[]>([]);
  const [contactId, setContactId] = useState("");
  const [opportunityId, setOpportunityId] = useState("");
  const [opportunities, setOpportunities] = useState<OpportunityHit[]>([]);
  const [sequenceId, setSequenceId] = useState(
    defaultSequenceId || activeSequences[0]?.id || ""
  );
  const [busy, setBusy] = useState(false);
  const [searching, setSearching] = useState(false);
  const [bridgingId, setBridgingId] = useState<string | null>(null);

  async function searchContacts() {
    setSearching(true);
    try {
      const res = await fetch(
        `/api/contacts?search=${encodeURIComponent(search.trim())}&limit=20`
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message || "Search failed");
      setContacts(json.data?.items ?? json.data ?? []);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Search failed");
    } finally {
      setSearching(false);
    }
  }

  async function loadOpportunitiesForContact(cId: string) {
    setOpportunityId("");
    setOpportunities([]);
    const contact = contacts.find((c) => c.id === cId);
    if (!contact?.company?.id) return;
    try {
      const res = await fetch(`/api/opportunities?limit=50`);
      const json = await res.json();
      if (!res.ok) return;
      const items = (json.data?.items ?? json.data ?? []) as OpportunityHit[];
      setOpportunities(
        items.filter((o) => o.companyId === contact.company?.id)
      );
    } catch {
      /* optional */
    }
  }

  async function saveDefaultSequence(value: string) {
    if (!canManageCampaigns) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/campaigns/${campaignId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          defaultSequenceId: value || null,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message || "Update failed");
      setDefaultSeq(value);
      if (value) setSequenceId(value);
      toast.success(value ? "Default sequence set" : "Default sequence cleared");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Update failed");
    } finally {
      setBusy(false);
    }
  }

  async function enroll() {
    if (!canEnroll) return;
    if (!contactId) {
      toast.error("Select a contact");
      return;
    }
    if (!sequenceId && !defaultSeq) {
      toast.error("Select a sequence or set a campaign default");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(`/api/campaigns/${campaignId}/enrollments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contactId,
          opportunityId: opportunityId || null,
          sequenceId: sequenceId || null,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message || "Enroll failed");
      toast.success("Contact enrolled");
      setContactId("");
      setOpportunityId("");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Enroll failed");
    } finally {
      setBusy(false);
    }
  }

  async function bridgeLegacy(campaignLeadId: string) {
    if (!canBridge) return;
    if (
      !window.confirm(
        "Bridge this CampaignLead to canonical enrollment? Pending FollowUpJobs for this lead will be cancelled to prevent duplicate sends."
      )
    ) {
      return;
    }
    setBridgingId(campaignLeadId);
    try {
      const res = await fetch(
        `/api/campaigns/${campaignId}/campaign-leads/${campaignLeadId}/bridge`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sequenceId: sequenceId || defaultSeq || null,
          }),
        }
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message || "Bridge failed");
      toast.success(
        json.data?.alreadyBridged
          ? "Already bridged"
          : `Bridged · cancelled ${json.data?.followUpsCancelled ?? 0} follow-up(s)`
      );
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Bridge failed");
    } finally {
      setBridgingId(null);
    }
  }

  function fmt(d: string | Date | null | undefined) {
    if (!d) return "—";
    try {
      return format(new Date(d), "MMM d, yyyy HH:mm");
    } catch {
      return "—";
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Campaign default sequence</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1 space-y-2">
            <Label>Default OutreachSequence</Label>
            <Select
              value={defaultSeq || "__none__"}
              onValueChange={(v) =>
                saveDefaultSequence(v === "__none__" || v == null ? "" : v)
              }
              disabled={!canManageCampaigns || busy}
            >
              <SelectTrigger>
                <SelectValue placeholder="None" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">None</SelectItem>
                {sequences.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name} ({s.status})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <UserPlus className="h-4 w-4" />
            Canonical — Enroll Contact
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {!canEnroll ? (
            <p className="text-sm text-muted-foreground">
              You can view enrollments but cannot enroll contacts.
            </p>
          ) : (
            <>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Input
                  placeholder="Search contacts by name or email"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") searchContacts();
                  }}
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={searchContacts}
                  disabled={searching}
                >
                  {searching ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    "Search"
                  )}
                </Button>
              </div>
              <div className="grid gap-3 md:grid-cols-3">
                <div className="space-y-2">
                  <Label>Contact</Label>
                  <Select
                    value={contactId || undefined}
                    onValueChange={(v) => {
                      if (!v) return;
                      setContactId(v);
                      loadOpportunitiesForContact(v);
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select contact" />
                    </SelectTrigger>
                    <SelectContent>
                      {contacts.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.fullName}
                          {c.company?.name ? ` · ${c.company.name}` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Opportunity (optional)</Label>
                  <Select
                    value={opportunityId || "__none__"}
                    onValueChange={(v) =>
                      setOpportunityId(!v || v === "__none__" ? "" : v)
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Optional" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">None</SelectItem>
                      {opportunities.map((o) => (
                        <SelectItem key={o.id} value={o.id}>
                          {o.stage}
                          {o.company?.name ? ` · ${o.company.name}` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Sequence</Label>
                  <Select
                    value={sequenceId || undefined}
                    onValueChange={(v) => {
                      if (v) setSequenceId(v);
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select sequence" />
                    </SelectTrigger>
                    <SelectContent>
                      {activeSequences.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <Button onClick={enroll} disabled={busy}>
                {busy ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : null}
                Enroll Contact
              </Button>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Canonical — Sequence Enrollments
          </CardTitle>
        </CardHeader>
        <CardContent>
          {enrollments.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No canonical enrollments yet. Enroll a contact above — no Lead
              required.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b text-muted-foreground">
                  <tr>
                    <th className="py-2 pr-3 font-medium">Contact</th>
                    <th className="py-2 pr-3 font-medium">Company</th>
                    <th className="py-2 pr-3 font-medium">Opportunity</th>
                    <th className="py-2 pr-3 font-medium">Sequence</th>
                    <th className="py-2 pr-3 font-medium">Step</th>
                    <th className="py-2 pr-3 font-medium">Status</th>
                    <th className="py-2 pr-3 font-medium">Next run</th>
                    <th className="py-2 pr-3 font-medium">Last exec</th>
                    <th className="py-2 font-medium">Stop</th>
                  </tr>
                </thead>
                <tbody>
                  {enrollments.map((e) => (
                    <tr key={e.id} className="border-b last:border-0">
                      <td className="py-2 pr-3">{e.contact.fullName}</td>
                      <td className="py-2 pr-3">
                        {e.contact.company?.name ?? "—"}
                      </td>
                      <td className="py-2 pr-3">
                        {e.opportunity?.stage ?? "—"}
                      </td>
                      <td className="py-2 pr-3">{e.sequence.name}</td>
                      <td className="py-2 pr-3">{e.currentStepOrder}</td>
                      <td className="py-2 pr-3">
                        <Badge variant="secondary">{e.status}</Badge>
                      </td>
                      <td className="py-2 pr-3">{fmt(e.nextRunAt)}</td>
                      <td className="py-2 pr-3">{fmt(e.lastExecutedAt)}</td>
                      <td className="py-2">{e.stopReason ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Legacy — Campaign Leads</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="mb-3 text-xs text-muted-foreground">
            Legacy CampaignLead → FollowUpJob / Autopilot remains intact.
            Bridging creates Company + Contact + SequenceEnrollment and cancels
            pending FollowUpJobs for that lead only.
          </p>
          {legacyLeads.length === 0 ? (
            <p className="text-sm text-muted-foreground">No legacy campaign leads</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {legacyLeads.map((row) => (
                <li
                  key={row.id}
                  className="flex flex-col gap-2 rounded-md border p-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <div className="font-medium">{row.lead.fullName}</div>
                    <div className="text-xs text-muted-foreground">
                      {row.lead.email || "no email"}
                      {row.lead.company ? ` · ${row.lead.company}` : ""}
                      {" · "}
                      {row.lead.automationStatus}
                    </div>
                    {row.bridgedAt || row.sequenceEnrollment ? (
                      <Badge variant="outline" className="mt-1">
                        Bridged
                        {row.sequenceEnrollment
                          ? ` · ${row.sequenceEnrollment.status}`
                          : ""}
                      </Badge>
                    ) : null}
                  </div>
                  {canBridge && !row.bridgedAt && !row.sequenceEnrollment ? (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={bridgingId === row.id}
                      onClick={() => bridgeLegacy(row.id)}
                    >
                      {bridgingId === row.id ? (
                        <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                      ) : null}
                      Bridge to sequence
                    </Button>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
