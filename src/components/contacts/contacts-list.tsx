"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface ContactRow {
  id: string;
  fullName: string;
  title: string | null;
  email: string | null;
  phone: string | null;
  company: { id: string; name: string; domain: string | null };
  _count: {
    primaryOpportunities: number;
    meetings: number;
    inboxConversations: number;
  };
}

interface ContactsListProps {
  initialData: {
    items: ContactRow[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
    filters: { search: string; page: number };
  };
}

export function ContactsList({ initialData }: ContactsListProps) {
  const router = useRouter();
  const [search, setSearch] = useState(initialData.filters.search);
  const { items, pagination } = initialData;

  function applyFilters() {
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    router.push(`/dashboard/contacts?${params.toString()}`);
  }

  function goToPage(page: number) {
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    params.set("page", String(page));
    router.push(`/dashboard/contacts?${params.toString()}`);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[220px] flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-8"
            placeholder="Search contacts, email, or company…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && applyFilters()}
          />
        </div>
        <Button onClick={applyFilters}>Search</Button>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Title</TableHead>
              <TableHead>Company</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>Opportunities</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className="h-24 text-center text-muted-foreground"
                >
                  No contacts found
                </TableCell>
              </TableRow>
            ) : (
              items.map((contact) => (
                <TableRow key={contact.id}>
                  <TableCell>
                    <Link
                      href={`/dashboard/contacts/${contact.id}`}
                      className="font-medium hover:underline"
                    >
                      {contact.fullName}
                    </Link>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {contact.title || "—"}
                  </TableCell>
                  <TableCell>
                    <Link
                      href={`/dashboard/companies/${contact.company.id}`}
                      className="hover:underline"
                    >
                      {contact.company.name}
                    </Link>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {contact.email || "—"}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {contact.phone || "—"}
                  </TableCell>
                  <TableCell>{contact._count.primaryOpportunities}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {pagination.totalPages > 1 && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">
            Page {pagination.page} of {pagination.totalPages} ·{" "}
            {pagination.total} contacts
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={pagination.page <= 1}
              onClick={() => goToPage(pagination.page - 1)}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={pagination.page >= pagination.totalPages}
              onClick={() => goToPage(pagination.page + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
