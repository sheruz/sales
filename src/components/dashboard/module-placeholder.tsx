import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { LucideIcon } from "lucide-react";

interface ModulePlaceholderProps {
  title: string;
  description: string;
  phase: string;
  icon: LucideIcon;
}

export function ModulePlaceholder({
  title,
  description,
  phase,
  icon: Icon,
}: ModulePlaceholderProps) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">{title}</h2>
        <p className="text-muted-foreground">{description}</p>
      </div>
      <Card>
        <CardHeader className="items-center text-center">
          <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-lg bg-muted">
            <Icon className="h-6 w-6 text-muted-foreground" />
          </div>
          <CardTitle>{title}</CardTitle>
          <CardDescription>
            This module is scheduled for {phase}. Navigation and authentication
            are ready — the full feature set will be built next.
          </CardDescription>
        </CardHeader>
      </Card>
    </div>
  );
}
