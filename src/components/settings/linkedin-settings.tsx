"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CheckCircle2, Globe, Loader2 } from "lucide-react";
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

interface LinkedInSettingsProps {
  initialStatus: {
    id: string;
    linkedInEmail: string | null;
    isActive: boolean;
    lastVerifiedAt: string | null;
    dailySearchCount: number;
    dailyMessageCount: number;
  } | null;
}

export function LinkedInSettings({ initialStatus }: LinkedInSettingsProps) {
  const router = useRouter();
  const [liAt, setLiAt] = useState("");
  const [jsessionId, setJsessionId] = useState("");
  const [email, setEmail] = useState("");
  const [isConnecting, setIsConnecting] = useState(false);

  const isConnected = initialStatus?.isActive;

  async function connect() {
    if (!liAt || !jsessionId) {
      toast.error("Both li_at and JSESSIONID are required");
      return;
    }
    setIsConnecting(true);
    try {
      const res = await fetch("/api/linkedin/account", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          liAt,
          jsessionId,
          linkedInEmail: email || undefined,
        }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error?.message);
      toast.success("LinkedIn account connected!");
      setLiAt("");
      setJsessionId("");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Connection failed");
    } finally {
      setIsConnecting(false);
    }
  }

  async function disconnect() {
    try {
      const res = await fetch("/api/linkedin/account", { method: "DELETE" });
      const data = await res.json();
      if (!data.success) throw new Error(data.error?.message);
      toast.success("LinkedIn disconnected");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to disconnect");
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Globe className="h-5 w-5" />
          LinkedIn Account
        </CardTitle>
        <CardDescription>
          Connect your paid LinkedIn account for real search and automated messaging.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {isConnected ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-green-600">
              <CheckCircle2 className="h-5 w-5" />
              <span className="font-medium">Connected</span>
            </div>
            {initialStatus?.linkedInEmail && (
              <p className="text-sm text-muted-foreground">
                Account: {initialStatus.linkedInEmail}
              </p>
            )}
            <p className="text-sm text-muted-foreground">
              Today: {initialStatus?.dailySearchCount ?? 0} searches,{" "}
              {initialStatus?.dailyMessageCount ?? 0} messages sent
            </p>
            <Button variant="outline" size="sm" onClick={disconnect}>
              Disconnect
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="rounded-lg bg-muted p-4 text-sm space-y-2">
              <p className="font-medium">How to get your cookies:</p>
              <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
                <li>Log into LinkedIn in Chrome</li>
                <li>Press F12 → Application → Cookies → linkedin.com</li>
                <li>Copy <code className="text-xs">li_at</code> value</li>
                <li>Copy <code className="text-xs">JSESSIONID</code> value</li>
              </ol>
            </div>
            <div>
              <Label>li_at cookie</Label>
              <Input
                type="password"
                value={liAt}
                onChange={(e) => setLiAt(e.target.value)}
                placeholder="AQEDAR..."
              />
            </div>
            <div>
              <Label>JSESSIONID cookie</Label>
              <Input
                type="password"
                value={jsessionId}
                onChange={(e) => setJsessionId(e.target.value)}
                placeholder='ajax:1234567890...'
              />
            </div>
            <div>
              <Label>LinkedIn Email (optional)</Label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
              />
            </div>
            <Button onClick={connect} disabled={isConnecting}>
              {isConnecting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Globe className="mr-2 h-4 w-4" />
              )}
              Connect LinkedIn
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
