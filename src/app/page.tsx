import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Target,
  Brain,
  Mail,
  BarChart3,
  Users,
  Zap,
} from "lucide-react";

const features = [
  {
    icon: Target,
    title: "Lead Discovery",
    description:
      "Find, import, and manage potential clients with powerful CRM tools.",
  },
  {
    icon: Brain,
    title: "AI Research",
    description:
      "Automated company research, lead scoring, and personalized outreach.",
  },
  {
    icon: Mail,
    title: "Smart Outreach",
    description:
      "AI-generated emails, follow-up sequences, and reply management.",
  },
  {
    icon: BarChart3,
    title: "Pipeline Analytics",
    description:
      "Track conversions, campaign performance, and revenue metrics.",
  },
  {
    icon: Users,
    title: "Team Collaboration",
    description:
      "Assign leads, manage tasks, and coordinate across your sales team.",
  },
  {
    icon: Zap,
    title: "Sales Automation",
    description:
      "Automated follow-ups, meeting prep, and proposal generation.",
  },
];

export default function HomePage() {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <Zap className="h-6 w-6 text-primary" />
            <span className="text-lg font-semibold">Sales Platform</span>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/login">
              <Button variant="ghost">Sign In</Button>
            </Link>
            <Link href="/login">
              <Button>Get Started</Button>
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1">
        <section className="container mx-auto px-4 py-24 text-center">
          <Badge variant="secondary" className="mb-4">
            AI-Powered Sales Automation
          </Badge>
          <h1 className="mx-auto max-w-3xl text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl">
            Convert More Clients with{" "}
            <span className="text-primary">Intelligent Sales</span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground">
            Discover leads, research companies, generate personalized outreach,
            manage conversations, and close deals — all powered by AI.
          </p>
          <div className="mt-10 flex items-center justify-center gap-4">
            <Link href="/login">
              <Button size="lg">Go to Dashboard</Button>
            </Link>
            <Link href="/login">
              <Button size="lg" variant="outline">
                Sign In
              </Button>
            </Link>
          </div>
        </section>

        <section className="border-t bg-muted/30 py-24">
          <div className="container mx-auto px-4">
            <div className="mb-12 text-center">
              <h2 className="text-3xl font-bold">Everything you need to scale sales</h2>
              <p className="mt-3 text-muted-foreground">
                From lead discovery to deal closure — one unified platform.
              </p>
            </div>
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {features.map((feature) => (
                <Card key={feature.title} className="border-0 bg-background shadow-sm">
                  <CardHeader>
                    <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                      <feature.icon className="h-5 w-5 text-primary" />
                    </div>
                    <CardTitle className="text-lg">{feature.title}</CardTitle>
                    <CardDescription>{feature.description}</CardDescription>
                  </CardHeader>
                  <CardContent />
                </Card>
              ))}
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t py-8">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
          Sales Platform — Internal use only
        </div>
      </footer>
    </div>
  );
}
