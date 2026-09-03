"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const BRAIN_DOCUMENT_TYPES = [
  "COMPANY_PROFILE",
  "SERVICE",
  "CASE_STUDY",
  "PROPOSAL",
  "SALES_SCRIPT",
  "SUCCESSFUL_DEAL",
  "LOST_DEAL",
  "CUSTOMER_PROFILE",
  "COMPETITOR",
  "FAQ",
  "PRICING",
  "CUSTOM",
] as const;

type BrainDocumentTypeValue = (typeof BRAIN_DOCUMENT_TYPES)[number];

export type BusinessProfileForm = {
  companyName: string;
  description: string | null;
  website: string | null;
  industry: string | null;
  locations: string[];
  targetMarkets: string[];
  companySize: string | null;
  yearsInBusiness: number | null;
  positioning: string | null;
  valueProposition: string | null;
  competitiveAdvantages: string[];
};

export type BrainDocumentRow = {
  id: string;
  type: string;
  title: string;
  content: string;
  status: string;
  createdAt: string;
};

function splitCsv(value: string) {
  return value
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function joinCsv(values: string[]) {
  return values.join(", ");
}

export function BusinessBrainClient({
  initialProfile,
  initialDocuments,
}: {
  initialProfile: BusinessProfileForm | null;
  initialDocuments: BrainDocumentRow[];
}) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [documents, setDocuments] = useState(initialDocuments);
  const [docOpen, setDocOpen] = useState(false);
  const [addingDoc, setAddingDoc] = useState(false);
  const [form, setForm] = useState({
    companyName: initialProfile?.companyName ?? "",
    description: initialProfile?.description ?? "",
    website: initialProfile?.website ?? "",
    industry: initialProfile?.industry ?? "",
    locations: joinCsv(initialProfile?.locations ?? []),
    targetMarkets: joinCsv(initialProfile?.targetMarkets ?? []),
    companySize: initialProfile?.companySize ?? "",
    yearsInBusiness:
      initialProfile?.yearsInBusiness != null
        ? String(initialProfile.yearsInBusiness)
        : "",
    positioning: initialProfile?.positioning ?? "",
    valueProposition: initialProfile?.valueProposition ?? "",
    competitiveAdvantages: joinCsv(
      initialProfile?.competitiveAdvantages ?? []
    ),
  });
  const [docForm, setDocForm] = useState<{
    type: BrainDocumentTypeValue;
    title: string;
    content: string;
  }>({
    type: "COMPANY_PROFILE",
    title: "",
    content: "",
  });

  async function saveProfile() {
    if (!form.companyName.trim()) {
      toast.error("Company name is required");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/business-brain/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyName: form.companyName.trim(),
          description: form.description || null,
          website: form.website || null,
          industry: form.industry || null,
          locations: splitCsv(form.locations),
          targetMarkets: splitCsv(form.targetMarkets),
          companySize: form.companySize || null,
          yearsInBusiness: form.yearsInBusiness
            ? Number(form.yearsInBusiness)
            : null,
          positioning: form.positioning || null,
          valueProposition: form.valueProposition || null,
          competitiveAdvantages: splitCsv(form.competitiveAdvantages),
        }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error?.message);
      toast.success("Profile saved");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  async function addDocument() {
    if (!docForm.title.trim() || !docForm.content.trim()) {
      toast.error("Title and content are required");
      return;
    }
    setAddingDoc(true);
    try {
      const res = await fetch("/api/business-brain/documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(docForm),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error?.message);
      const created = data.data as BrainDocumentRow & { createdAt: string | Date };
      setDocuments([
        {
          id: created.id,
          type: created.type,
          title: created.title,
          content: created.content,
          status: created.status,
          createdAt:
            typeof created.createdAt === "string"
              ? created.createdAt
              : new Date(created.createdAt).toISOString(),
        },
        ...documents,
      ]);
      setDocForm({ type: "COMPANY_PROFILE", title: "", content: "" });
      setDocOpen(false);
      toast.success("Document added");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to add");
    } finally {
      setAddingDoc(false);
    }
  }

  async function removeDocument(id: string) {
    if (!confirm("Delete this document?")) return;
    try {
      const res = await fetch(`/api/business-brain/documents/${id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error?.message);
      setDocuments(documents.filter((d) => d.id !== id));
      toast.success("Document deleted");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete");
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Company profile</CardTitle>
          <CardDescription>
            Concise facts about your business. Used as AI context — private
            reasoning is never shown.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="md:col-span-2">
            <Label>Company name</Label>
            <Input
              value={form.companyName}
              onChange={(e) =>
                setForm({ ...form, companyName: e.target.value })
              }
            />
          </div>
          <div className="md:col-span-2">
            <Label>Description</Label>
            <Textarea
              rows={3}
              value={form.description}
              onChange={(e) =>
                setForm({ ...form, description: e.target.value })
              }
            />
          </div>
          <div>
            <Label>Website</Label>
            <Input
              value={form.website}
              onChange={(e) => setForm({ ...form, website: e.target.value })}
            />
          </div>
          <div>
            <Label>Industry</Label>
            <Input
              value={form.industry}
              onChange={(e) => setForm({ ...form, industry: e.target.value })}
            />
          </div>
          <div>
            <Label>Locations (comma-separated)</Label>
            <Input
              value={form.locations}
              onChange={(e) => setForm({ ...form, locations: e.target.value })}
              placeholder="US, UK, Remote"
            />
          </div>
          <div>
            <Label>Target markets (comma-separated)</Label>
            <Input
              value={form.targetMarkets}
              onChange={(e) =>
                setForm({ ...form, targetMarkets: e.target.value })
              }
              placeholder="SaaS, Fintech"
            />
          </div>
          <div>
            <Label>Company size</Label>
            <Input
              value={form.companySize}
              onChange={(e) =>
                setForm({ ...form, companySize: e.target.value })
              }
              placeholder="11-50"
            />
          </div>
          <div>
            <Label>Years in business</Label>
            <Input
              type="number"
              min={0}
              value={form.yearsInBusiness}
              onChange={(e) =>
                setForm({ ...form, yearsInBusiness: e.target.value })
              }
            />
          </div>
          <div className="md:col-span-2">
            <Label>Positioning</Label>
            <Textarea
              rows={2}
              value={form.positioning}
              onChange={(e) =>
                setForm({ ...form, positioning: e.target.value })
              }
            />
          </div>
          <div className="md:col-span-2">
            <Label>Value proposition</Label>
            <Textarea
              rows={2}
              value={form.valueProposition}
              onChange={(e) =>
                setForm({ ...form, valueProposition: e.target.value })
              }
            />
          </div>
          <div className="md:col-span-2">
            <Label>Competitive advantages (comma-separated)</Label>
            <Input
              value={form.competitiveAdvantages}
              onChange={(e) =>
                setForm({ ...form, competitiveAdvantages: e.target.value })
              }
            />
          </div>
          <div className="md:col-span-2">
            <Button onClick={saveProfile} disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save profile
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <div>
            <CardTitle className="text-base">Knowledge documents</CardTitle>
            <CardDescription>
              Content is stored as concise business knowledge for AI. No private
              chain-of-thought is shown or retained here.
            </CardDescription>
          </div>
          <Dialog open={docOpen} onOpenChange={setDocOpen}>
            <DialogTrigger render={<Button size="sm"><Plus className="mr-2 h-4 w-4" />Add document</Button>} />
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>Add document</DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                <div>
                  <Label>Type</Label>
                  <Select
                    value={docForm.type}
                    onValueChange={(v) =>
                      v &&
                      setDocForm({
                        ...docForm,
                        type: v as BrainDocumentTypeValue,
                      })
                    }
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {BRAIN_DOCUMENT_TYPES.map((t) => (
                        <SelectItem key={t} value={t}>
                          {t.replaceAll("_", " ")}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Title</Label>
                  <Input
                    value={docForm.title}
                    onChange={(e) =>
                      setDocForm({ ...docForm, title: e.target.value })
                    }
                  />
                </div>
                <div>
                  <Label>Content</Label>
                  <Textarea
                    rows={6}
                    value={docForm.content}
                    onChange={(e) =>
                      setDocForm({ ...docForm, content: e.target.value })
                    }
                    placeholder="Concise facts, scripts, or case notes…"
                  />
                </div>
                <Button onClick={addDocument} disabled={addingDoc} className="w-full">
                  {addingDoc ? "Adding…" : "Add document"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          {documents.length === 0 ? (
            <p className="text-sm text-muted-foreground">No documents yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-12" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {documents.map((doc) => (
                  <TableRow key={doc.id}>
                    <TableCell>
                      <div className="font-medium">{doc.title}</div>
                      <div className="text-xs text-muted-foreground line-clamp-1">
                        {doc.content}
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {doc.type.replaceAll("_", " ")}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">{doc.status}</Badge>
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => removeDocument(doc.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
