"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface ServiceRow {
  id: string;
  name: string;
  description: string;
  targetClientType: string | null;
  technologies: string[];
  isActive: boolean;
}

export function ServicesPanel({ initialServices }: { initialServices: ServiceRow[] }) {
  const router = useRouter();
  const [services, setServices] = useState(initialServices);
  const [isAdding, setIsAdding] = useState(false);
  const [form, setForm] = useState({
    name: "",
    description: "",
    targetClientType: "",
    technologies: "",
  });

  async function addService() {
    try {
      const res = await fetch("/api/services", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          description: form.description,
          targetClientType: form.targetClientType || undefined,
          technologies: form.technologies.split(",").map((s) => s.trim()).filter(Boolean),
        }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error?.message);
      toast.success("Service created");
      setIsAdding(false);
      setForm({ name: "", description: "", targetClientType: "", technologies: "" });
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    }
  }

  async function removeService(id: string) {
    if (!confirm("Deactivate this service?")) return;
    try {
      const res = await fetch(`/api/services/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (!data.success) throw new Error(data.error?.message);
      setServices(services.filter((s) => s.id !== id));
      toast.success("Service removed");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-muted-foreground">
          Services define what your AI sells. Used in campaigns and autopilot outreach.
        </p>
        <Button size="sm" onClick={() => setIsAdding(!isAdding)}>
          <Plus className="mr-2 h-4 w-4" /> Add service
        </Button>
      </div>

      {isAdding && (
        <Card>
          <CardHeader><CardTitle className="text-base">New service</CardTitle></CardHeader>
          <CardContent className="grid gap-3">
            <div><Label>Name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div><Label>Description</Label><Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} /></div>
            <div><Label>Target clients</Label><Input value={form.targetClientType} onChange={(e) => setForm({ ...form, targetClientType: e.target.value })} placeholder="Startups, SMBs..." /></div>
            <div><Label>Technologies (comma-separated)</Label><Input value={form.technologies} onChange={(e) => setForm({ ...form, technologies: e.target.value })} placeholder="React, Node.js" /></div>
            <Button onClick={addService}>Create service</Button>
          </CardContent>
        </Card>
      )}

      {services.map((service) => (
        <Card key={service.id}>
          <CardHeader className="flex flex-row items-start justify-between pb-2">
            <div>
              <CardTitle className="text-base">{service.name}</CardTitle>
              <CardDescription>{service.description}</CardDescription>
            </div>
            <Button variant="ghost" size="icon" onClick={() => removeService(service.id)}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </CardHeader>
          {service.technologies.length > 0 && (
            <CardContent className="text-sm text-muted-foreground">
              Tech: {service.technologies.join(", ")}
            </CardContent>
          )}
        </Card>
      ))}
    </div>
  );
}
