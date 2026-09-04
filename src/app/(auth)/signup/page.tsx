"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { Zap } from "lucide-react";
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

type Plan = {
  id: string;
  name: string;
  description: string | null;
  price: number;
};

export default function SignupPage() {
  const router = useRouter();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [planId, setPlanId] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);
  const [form, setForm] = useState({
    organizationName: "",
    firstName: "",
    lastName: "",
    email: "",
    password: "",
  });

  useEffect(() => {
    fetch("/api/plans")
      .then((r) => r.json())
      .then((d) => {
        if (d.success) {
          setPlans(d.data);
          const free = d.data.find((p: Plan) => p.price === 0);
          if (free) setPlanId(free.id);
        }
      })
      .catch(() => {});
  }, []);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setIsLoading(true);
    try {
      const response = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, planId: planId || undefined }),
      });
      const data = await response.json();
      if (!data.success) {
        toast.error(data.error?.message ?? "Signup failed");
        return;
      }
      if (data.data.checkoutUrl) {
        toast.success("Account created — continue to payment");
        window.location.href = data.data.checkoutUrl;
        return;
      }
      toast.success("Account created");
      router.push("/dashboard");
      router.refresh();
    } catch {
      toast.error("Signup failed");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-lg">
        <CardHeader className="text-center">
          <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Zap className="h-5 w-5" />
          </div>
          <CardTitle>Create your workspace</CardTitle>
          <CardDescription>
            Signup → select plan → pay → get entitlements
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="organizationName">Company name</Label>
              <Input
                id="organizationName"
                required
                value={form.organizationName}
                onChange={(e) =>
                  setForm((f) => ({ ...f, organizationName: e.target.value }))
                }
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="firstName">First name</Label>
                <Input
                  id="firstName"
                  required
                  value={form.firstName}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, firstName: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastName">Last name</Label>
                <Input
                  id="lastName"
                  required
                  value={form.lastName}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, lastName: e.target.value }))
                  }
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Work email</Label>
              <Input
                id="email"
                type="email"
                required
                value={form.email}
                onChange={(e) =>
                  setForm((f) => ({ ...f, email: e.target.value }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                required
                minLength={8}
                value={form.password}
                onChange={(e) =>
                  setForm((f) => ({ ...f, password: e.target.value }))
                }
              />
            </div>

            {plans.length > 0 && (
              <div className="space-y-2">
                <Label>Plan</Label>
                <div className="grid gap-2">
                  {plans.map((p) => (
                    <label
                      key={p.id}
                      className={`flex cursor-pointer items-start gap-3 rounded-md border p-3 text-sm ${
                        planId === p.id ? "border-primary bg-primary/5" : ""
                      }`}
                    >
                      <input
                        type="radio"
                        name="plan"
                        className="mt-1"
                        checked={planId === p.id}
                        onChange={() => setPlanId(p.id)}
                      />
                      <span>
                        <span className="font-medium">{p.name}</span>
                        <span className="text-muted-foreground">
                          {" "}
                          — {p.price === 0 ? "Free" : `$${p.price}/mo`}
                        </span>
                        {p.description && (
                          <span className="mt-0.5 block text-xs text-muted-foreground">
                            {p.description}
                          </span>
                        )}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? "Creating…" : "Create account"}
            </Button>
          </form>
          <p className="mt-4 text-center text-sm text-muted-foreground">
            Already have an account?{" "}
            <Link href="/login" className="underline underline-offset-2">
              Sign in
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
