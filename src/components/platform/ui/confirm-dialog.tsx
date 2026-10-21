"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export type PlatformConfirmOptions = {
  title: string;
  description?: string;
  confirmLabel?: string;
  destructive?: boolean;
  requireReason?: boolean;
  requirePassword?: boolean;
  defaultReason?: string;
};

type Props = PlatformConfirmOptions & {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (payload: { reason: string; password: string }) => void | Promise<void>;
  busy?: boolean;
};

export function PlatformConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "Confirm",
  destructive,
  requireReason,
  requirePassword,
  defaultReason = "",
  onConfirm,
  busy,
}: Props) {
  const [reason, setReason] = useState(defaultReason);
  const [password, setPassword] = useState("");

  async function submit() {
    if (requireReason && !reason.trim()) return;
    if (requirePassword && !password.trim()) return;
    await onConfirm({ reason: reason.trim(), password: password.trim() });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) {
          setReason(defaultReason);
          setPassword("");
        }
        onOpenChange(o);
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description ? (
            <DialogDescription>{description}</DialogDescription>
          ) : null}
        </DialogHeader>
        <div className="space-y-3 py-1">
          {requireReason && (
            <div className="space-y-1.5">
              <Label htmlFor="platform-confirm-reason">Reason</Label>
              <Textarea
                id="platform-confirm-reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={2}
                placeholder="Why are you doing this?"
              />
            </div>
          )}
          {requirePassword && (
            <div className="space-y-1.5">
              <Label htmlFor="platform-confirm-password">Your login password</Label>
              <Input
                id="platform-confirm-password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Super Admin password"
              />
            </div>
          )}
        </div>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={busy}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant={destructive ? "destructive" : "default"}
            disabled={
              busy ||
              (requireReason && !reason.trim()) ||
              (requirePassword && !password.trim())
            }
            onClick={() => void submit()}
          >
            {busy ? "Working…" : confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
