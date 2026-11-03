"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { appHome } from "@/lib/app-paths";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type Row = {
  id: string;
  publicSlug: string;
  visitCount: number;
  firstHumanVisitAt: string | null;
  lastHumanVisitAt: string | null;
  totalDwellMs: number;
  company: { id: string; name: string; website: string | null };
  contact: {
    id: string;
    fullName: string;
    email: string | null;
    title: string | null;
  };
  pitch: { id: string; topIssue: string | null; status: string };
};

export function HotLeadsClient() {
  const [rows, setRows] = useState<Row[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch("/api/pow/hot-leads");
        const json = await res.json();
        if (!json.success) {
          setError(json.error?.message || "Failed to load");
          return;
        }
        setRows(json.data as Row[]);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed");
      }
    })();
  }, []);

  if (error) {
    return <p className="text-sm text-destructive">{error}</p>;
  }

  if (rows.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No human preview visits yet. They appear after a prospect opens their
        personal /for/… link.
      </p>
    );
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Company</TableHead>
            <TableHead>Contact</TableHead>
            <TableHead>First visit</TableHead>
            <TableHead>Visits</TableHead>
            <TableHead>Dwell</TableHead>
            <TableHead>Preview</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => (
            <TableRow key={r.id}>
              <TableCell>
                <Link
                  href={appHome(`/companies/${r.company.id}`)}
                  className="font-medium underline-offset-2 hover:underline"
                >
                  {r.company.name}
                </Link>
              </TableCell>
              <TableCell>
                <div className="text-sm">{r.contact.fullName}</div>
                <div className="text-xs text-muted-foreground">
                  {r.contact.email}
                </div>
              </TableCell>
              <TableCell className="text-sm">
                {r.firstHumanVisitAt
                  ? new Date(r.firstHumanVisitAt).toLocaleString()
                  : "—"}
              </TableCell>
              <TableCell>{r.visitCount}</TableCell>
              <TableCell className="text-sm">
                {Math.round((r.totalDwellMs || 0) / 1000)}s
              </TableCell>
              <TableCell>
                <a
                  href={`/for/${encodeURIComponent(r.publicSlug)}`}
                  className="text-sm underline"
                  target="_blank"
                  rel="noreferrer"
                >
                  Open
                </a>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
