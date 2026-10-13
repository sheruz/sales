import Link from "next/link";
import { Plus } from "lucide-react";
import prisma from "@/lib/db/prisma";
import { hasOrgPermission } from "@/lib/tenant/scope";
import { ImportCsvDialog } from "@/components/leads/import-csv-dialog";
import type { AuthUser } from "@/types/auth";

export async function getLeadsHubCounts(organizationId: string) {
  const [companies, contacts] = await Promise.all([
    prisma.company.count({ where: { organizationId, deletedAt: null } }),
    prisma.contact.count({ where: { organizationId } }),
  ]);
  return { companies, contacts };
}

/** Shared "Leads" page header + Companies/Contacts tabs (Delvix reference design). */
export async function LeadsHubHeader({
  user,
  active,
}: {
  user: AuthUser;
  active: "companies" | "contacts";
}) {
  let counts: { companies: number; contacts: number } | null = null;
  try {
    counts = await getLeadsHubCounts(user.organizationId!);
  } catch {
    counts = null;
  }
  const canCreate = hasOrgPermission(user, "leads.create");

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">Leads</h1>
          <p className="page-sub">
            Every business Autopilot found, and the people behind them.
          </p>
        </div>
        {canCreate ? (
          <div className="page-actions">
            <ImportCsvDialog variant="dx" />
            <Link href="/dashboard/leads/new" className="btn primary">
              <Plus />
              Add lead
            </Link>
          </div>
        ) : null}
      </div>
      <div className="tabs">
        <Link
          href="/dashboard/companies"
          className={`tab${active === "companies" ? " active" : ""}`}
        >
          Companies
          {counts ? <span className="n">{counts.companies}</span> : null}
        </Link>
        <Link
          href="/dashboard/contacts"
          className={`tab${active === "contacts" ? " active" : ""}`}
        >
          Contacts
          {counts ? <span className="n">{counts.contacts}</span> : null}
        </Link>
      </div>
    </>
  );
}
