"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const OPTIONS = [
  { value: "published", label: "Published (CASL OK for Canada)" },
  { value: "email", label: "Direct email field" },
  { value: "company_email", label: "Company email" },
  { value: "scraped", label: "Scraped / crawled" },
  { value: "__clear__", label: "Not set" },
] as const;

type Props = {
  contactId: string;
  emailSource: string | null;
  canEdit: boolean;
};

export function ContactEmailSource({
  contactId,
  emailSource,
  canEdit,
}: Props) {
  const router = useRouter();
  const [value, setValue] = useState(emailSource || "__clear__");
  const [pending, startTransition] = useTransition();

  function onChange(next: string) {
    if (!canEdit) return;
    const prev = value;
    setValue(next);
    startTransition(async () => {
      try {
        const res = await fetch(`/api/contacts/${contactId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            emailSource: next === "__clear__" ? null : next,
          }),
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) {
          setValue(prev);
          toast.error(json?.error?.message || "Could not update email source");
          return;
        }
        toast.success(
          next === "published"
            ? "Marked as published — Canadian PoW enroll allowed"
            : "Email source updated"
        );
        router.refresh();
      } catch {
        setValue(prev);
        toast.error("Could not update email source");
      }
    });
  }

  return (
    <div className="space-y-1.5 pt-2">
      <p className="text-xs font-medium text-muted-foreground">Email source</p>
      <Select
        value={value}
        onValueChange={onChange}
        disabled={!canEdit || pending}
      >
        <SelectTrigger className="h-9 w-full text-left text-sm">
          <SelectValue placeholder="Not set" />
        </SelectTrigger>
        <SelectContent>
          {OPTIONS.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <p className="text-[11px] leading-snug text-muted-foreground">
        Canadian contacts need <span className="font-medium">Published</span>{" "}
        before Proof of Work enrollment (CASL).
      </p>
    </div>
  );
}
