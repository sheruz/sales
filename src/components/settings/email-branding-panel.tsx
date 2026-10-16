"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

type Branding = {
  logoPath: string | null;
  senderPhotoPath: string | null;
  senderName: string;
  senderTitle: string;
  websiteUrl: string;
  websiteLabel: string;
  whatsappE164: string;
  bookingUrl: string;
  ctaLabel: string;
  footerServices: string;
  availabilityLine: string;
  legalCompanyName: string;
  businessAddress: string;
};

export function EmailBrandingPanel() {
  const [branding, setBranding] = useState<Branding | null>(null);
  const [previewHtml, setPreviewHtml] = useState("");
  const [busy, setBusy] = useState(false);

  async function load() {
    const res = await fetch("/api/settings/email-branding");
    const json = await res.json();
    if (!json.success) throw new Error(json.error?.message);
    setBranding(json.data.branding);
    setPreviewHtml(json.data.previewHtml);
  }

  useEffect(() => {
    load().catch((e) => toast.error(e.message));
  }, []);

  async function save() {
    if (!branding) return;
    setBusy(true);
    try {
      const res = await fetch("/api/settings/email-branding", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(branding),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error?.message);
      setBranding(json.data.branding);
      toast.success("Email branding saved");
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  async function upload(kind: "logo" | "sender", file: File) {
    const fd = new FormData();
    fd.set("kind", kind);
    fd.set("file", file);
    const res = await fetch("/api/settings/email-branding/upload", {
      method: "POST",
      body: fd,
    });
    const json = await res.json();
    if (!json.success) throw new Error(json.error?.message);
    toast.success(`${kind} uploaded`);
    await load();
  }

  if (!branding) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading branding…
      </div>
    );
  }

  function field(
    key: keyof Branding,
    label: string,
    opts?: { type?: string }
  ) {
    const val = branding![key];
    if (typeof val !== "string" && val !== null) return null;
    return (
      <div className="space-y-1">
        <Label className="text-xs">{label}</Label>
        <Input
          type={opts?.type ?? "text"}
          value={val ?? ""}
          onChange={(e) =>
            setBranding({ ...branding!, [key]: e.target.value })
          }
        />
      </div>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Email branding</CardTitle>
          <CardDescription>
            Org-level sender identity for BRANDED outbound. Images are resized
            to 96×96 PNG and served from your domain. CTA, WhatsApp, and website
            links are tracked (opens + clicks). Set GA4_MEASUREMENT_ID and
            GA4_API_SECRET in .env to mirror events into Google Analytics.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="grid gap-3 sm:grid-cols-2">
            {field("senderName", "Sender name")}
            {field("senderTitle", "Title")}
            {field("websiteUrl", "Website URL")}
            {field("websiteLabel", "Website label")}
            {field("whatsappE164", "WhatsApp (E.164, e.g. +12105550100)")}
            {field("bookingUrl", "Booking / CTA URL")}
            {field("ctaLabel", "CTA label")}
            {field("legalCompanyName", "Legal company name")}
          </div>
          {field("businessAddress", "Business address")}
          {field("footerServices", "Footer services line")}
          {field("availabilityLine", "Availability line")}

          <div className="flex flex-wrap gap-3 pt-2">
            <div>
              <Label className="text-xs">Logo (PNG/JPEG → 96×96)</Label>
              <Input
                type="file"
                accept="image/png,image/jpeg"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) upload("logo", f).catch((err) => toast.error(err.message));
                }}
              />
            </div>
            <div>
              <Label className="text-xs">Sender photo (circle in email)</Label>
              <Input
                type="file"
                accept="image/png,image/jpeg"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f)
                    upload("sender", f).catch((err) => toast.error(err.message));
                }}
              />
            </div>
          </div>

          <Button onClick={save} disabled={busy}>
            {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Save branding
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Live preview</CardTitle>
          <CardDescription>Sample BRANDED email with your branding.</CardDescription>
        </CardHeader>
        <CardContent>
          <iframe
            title="Branding preview"
            srcDoc={previewHtml}
            className="w-full h-[560px] rounded-md border bg-white"
            sandbox=""
          />
        </CardContent>
      </Card>
    </div>
  );
}
