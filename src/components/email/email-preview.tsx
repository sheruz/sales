"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, Monitor, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";

type Props = {
  pitchId: string;
  initialStyle?: "BRANDED" | "PLAIN";
};

export function EmailPreview({ pitchId, initialStyle = "BRANDED" }: Props) {
  const [style, setStyle] = useState<"BRANDED" | "PLAIN">(initialStyle);
  const [viewport, setViewport] = useState<"desktop" | "mobile">("desktop");
  const [html, setHtml] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [testBusy, setTestBusy] = useState(false);

  async function load(nextStyle = style) {
    setBusy(true);
    try {
      const res = await fetch(`/api/autopilot/pitches/${pitchId}/preview`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ style: nextStyle }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error?.message || "Preview failed");
      setHtml(json.data.html);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Preview failed");
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    void load(style);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pitchId, style]);

  async function sendTest(testStyle: "BRANDED" | "PLAIN") {
    setTestBusy(true);
    try {
      const res = await fetch(`/api/autopilot/pitches/${pitchId}/preview`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ style: testStyle, sendTest: true }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error?.message || "Send failed");
      toast.success(`Test ${testStyle} sent to ${json.data.testSentTo}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Send failed");
    } finally {
      setTestBusy(false);
    }
  }

  return (
    <div className="space-y-3 rounded-lg border p-3">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          size="sm"
          variant={style === "BRANDED" ? "default" : "outline"}
          onClick={() => setStyle("BRANDED")}
        >
          Branded
        </Button>
        <Button
          size="sm"
          variant={style === "PLAIN" ? "default" : "outline"}
          onClick={() => setStyle("PLAIN")}
        >
          Plain
        </Button>
        <div className="mx-1 h-4 w-px bg-border" />
        <Button
          size="sm"
          variant={viewport === "desktop" ? "secondary" : "ghost"}
          onClick={() => setViewport("desktop")}
        >
          <Monitor className="mr-1 h-3.5 w-3.5" />
          Desktop
        </Button>
        <Button
          size="sm"
          variant={viewport === "mobile" ? "secondary" : "ghost"}
          onClick={() => setViewport("mobile")}
        >
          <Smartphone className="mr-1 h-3.5 w-3.5" />
          Mobile
        </Button>
        <div className="flex-1" />
        <Button
          size="sm"
          variant="outline"
          disabled={testBusy}
          onClick={() => sendTest("BRANDED")}
        >
          {testBusy ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : null}
          Test BRANDED
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={testBusy}
          onClick={() => sendTest("PLAIN")}
        >
          Test PLAIN
        </Button>
      </div>
      <div className="flex justify-center bg-muted/40 p-3 rounded-md min-h-[280px]">
        {busy ? (
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        ) : (
          <iframe
            title="Email preview"
            srcDoc={html}
            className="bg-white border-0 shadow-sm rounded-md"
            style={{
              width: viewport === "mobile" ? 375 : 600,
              maxWidth: "100%",
              height: 520,
            }}
            sandbox=""
          />
        )}
      </div>
    </div>
  );
}
