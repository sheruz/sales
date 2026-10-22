import {
  CompanyEnrichmentStatus,
  ContactStatus,
  JobStatus,
  MembershipStatus,
  OpportunityStage,
  OpportunityStatus,
  SuppressionReason,
  type Prisma,
} from "@prisma/client";
import prisma from "@/lib/db/prisma";
import { FEATURE_KEYS } from "@/lib/billing/features";
import { NotFoundError, ValidationError } from "@/lib/api/response";
import { billingGateway } from "@/services/billing-gateway.service";
import { entitlementService } from "@/services/entitlement.service";
import {
  extractDomain,
  normalizeDomain,
} from "@/services/company.service";
import { normalizeEmail } from "@/services/contact.service";
import { emailSafetyService } from "@/services/email-safety.service";
import { websiteAuditService } from "@/services/website-audit.service";
import { suggestColumnMapping } from "@/lib/crm/import/headers";
import { checkEmailQuality } from "@/lib/crm/import/email-quality";
import { resolveImportContact } from "@/lib/crm/import/contact-from-row";
import { customerTypeFromRelationship } from "@/lib/crm/import/outreach-exclude";
import {
  deriveImportTimezone,
  fillEmptyFields,
  isCustomerRelationship,
  normalizeCountry,
  normalizeRelationship,
  parseEmployeeCount,
  parseYesNo,
  splitTags,
} from "@/lib/crm/import/normalize";
import { parseCsvText, toErrorCsv } from "@/lib/crm/import/parse";
import { mapRows, validateMappedRows } from "@/lib/crm/import/validate";
import {
  CSV_IMPORT_SOURCE,
  type ColumnMapping,
  type ImportRowResult,
  type ImportSummary,
  type ValidationReport,
} from "@/lib/crm/import/types";

const JOB_TYPE = "crm_csv_import";

type JobMeta = {
  fileName?: string;
  headers: string[];
  mapping: ColumnMapping;
  rawRows: Record<string, string>[];
  runAuditAfterImport?: boolean;
  validation?: ValidationReport;
  summary?: ImportSummary;
  errorCsv?: string;
  auditQueuedCompanyIds?: string[];
};

function emptySummary(): ImportSummary {
  return {
    imported: 0,
    updated: 0,
    skipped: 0,
    failed: 0,
    companiesCreated: 0,
    companiesUpdated: 0,
    contactsCreated: 0,
    contactsUpdated: 0,
    suppressionsAdded: 0,
    wonOpportunities: 0,
    auditsQueued: 0,
    emailChecks: {
      validManual: 0,
      invalid: 0,
      roleGeneric: 0,
      typoSuggestions: 0,
    },
    changes: [],
    results: [],
  };
}

function mergeMeta(
  existing: unknown,
  patch: Partial<JobMeta>
): Prisma.InputJsonValue {
  const base =
    existing && typeof existing === "object"
      ? (existing as Record<string, unknown>)
      : {};
  return { ...base, ...patch } as Prisma.InputJsonValue;
}

async function loadExistingIndexes(organizationId: string) {
  const [companies, contacts] = await Promise.all([
    prisma.company.findMany({
      where: { organizationId, deletedAt: null },
      select: {
        id: true,
        name: true,
        country: true,
        domain: true,
        normalizedDomain: true,
      },
    }),
    prisma.contact.findMany({
      where: { organizationId },
      select: {
        id: true,
        companyId: true,
        firstName: true,
        lastName: true,
        normalizedEmail: true,
      },
    }),
  ]);

  const domains = new Set<string>();
  const companyKeys = new Set<string>();
  const companyByDomain = new Map<string, (typeof companies)[0]>();
  const companyByKey = new Map<string, (typeof companies)[0]>();

  for (const c of companies) {
    const d = c.normalizedDomain || c.domain;
    if (d) {
      domains.add(d);
      companyByDomain.set(d, c);
    }
    const key = `${c.name.toLowerCase()}|${(c.country || "").toLowerCase()}`;
    companyKeys.add(key);
    companyByKey.set(key, c);
  }

  const emails = new Set<string>();
  const contactByEmail = new Map<string, (typeof contacts)[0]>();
  const contactByNameCompany = new Map<string, (typeof contacts)[0]>();

  for (const ct of contacts) {
    if (ct.normalizedEmail) {
      emails.add(ct.normalizedEmail);
      contactByEmail.set(ct.normalizedEmail, ct);
    }
    contactByNameCompany.set(
      `${ct.firstName.toLowerCase()}|${ct.lastName.toLowerCase()}|${ct.companyId}`,
      ct
    );
  }

  return {
    domains,
    companyKeys,
    emails,
    companyByDomain,
    companyByKey,
    contactByEmail,
    contactByNameCompany,
  };
}

export class CrmImportService {
  async preview(input: {
    organizationId: string;
    userId: string;
    fileName: string;
    csvText: string;
    mapping?: ColumnMapping;
    runAuditAfterImport?: boolean;
  }) {
    const { headers, rows } = parseCsvText(input.csvText);
    if (!headers.length || !rows.length) {
      throw new ValidationError("CSV file is empty or invalid");
    }
    if (rows.length > 5000) {
      throw new ValidationError("CSV limited to 5000 rows");
    }

    const mapping = input.mapping ?? suggestColumnMapping(headers);
    const mapped = mapRows(rows, mapping);
    const indexes = await loadExistingIndexes(input.organizationId);
    const validation = validateMappedRows(mapped, {
      domains: indexes.domains,
      companyKeys: indexes.companyKeys,
      emails: indexes.emails,
      contactKeys: new Set(),
    });

    const runAuditAfterImport = input.runAuditAfterImport ?? true;
    const previewRows = mapped.slice(0, 20);

    const job = await prisma.jobLog.create({
      data: {
        organizationId: input.organizationId,
        jobType: JOB_TYPE,
        status: JobStatus.PENDING,
        message: `Preview: ${input.fileName || "import.csv"} (${rows.length} rows)`,
        metadata: {
          fileName: input.fileName,
          headers,
          mapping,
          rawRows: rows,
          runAuditAfterImport,
          validation,
          previewAt: new Date().toISOString(),
          createdByUserId: input.userId,
        } satisfies JobMeta & {
          previewAt: string;
          createdByUserId: string;
        },
      },
    });

    return {
      jobId: job.id,
      headers,
      mapping,
      runAuditAfterImport,
      totalRows: rows.length,
      previewRows,
      validation,
    };
  }

  async confirm(input: {
    organizationId: string;
    userId: string;
    jobId: string;
    mapping?: ColumnMapping;
    runAuditAfterImport?: boolean;
  }) {
    const job = await prisma.jobLog.findFirst({
      where: {
        id: input.jobId,
        organizationId: input.organizationId,
        jobType: JOB_TYPE,
      },
    });
    if (!job) throw new NotFoundError("Import job not found");
    if (job.status === JobStatus.PROCESSING) {
      throw new ValidationError("Import already in progress");
    }
    if (job.status === JobStatus.COMPLETED) {
      throw new ValidationError("Import already completed");
    }

    const meta = (job.metadata ?? {}) as JobMeta;
    const mapping = input.mapping ?? meta.mapping;
    const runAuditAfterImport =
      input.runAuditAfterImport ?? meta.runAuditAfterImport ?? true;
    const rawRows = meta.rawRows ?? [];
    if (!rawRows.length) {
      throw new ValidationError("Import job has no rows — re-upload the CSV");
    }

    await prisma.jobLog.update({
      where: { id: job.id },
      data: {
        status: JobStatus.PROCESSING,
        message: "Importing…",
        metadata: mergeMeta(job.metadata, { mapping, runAuditAfterImport }),
      },
    });

    try {
      const { auditCompanyIds, ...summary } = await this.runImport({
        organizationId: input.organizationId,
        userId: input.userId,
        jobId: job.id,
        rawRows,
        mapping,
        runAuditAfterImport,
      });

      const errorCsv = toErrorCsv(
        summary.results.filter(
          (r) =>
            r.status === "failed" ||
            r.status === "skipped" ||
            r.emailStatus === "invalid" ||
            (r.reason || "").startsWith("email_")
        )
      );

      await prisma.jobLog.update({
        where: { id: job.id },
        data: {
          status: JobStatus.COMPLETED,
          message: `Imported ${summary.imported}, updated ${summary.updated}, skipped ${summary.skipped}, failed ${summary.failed}`,
          metadata: mergeMeta(job.metadata, {
            mapping,
            runAuditAfterImport,
            summary,
            errorCsv,
            auditQueuedCompanyIds: auditCompanyIds,
            rawRows: [],
          }),
        },
      });

      if (runAuditAfterImport && auditCompanyIds.length > 0) {
        void this.queueAuditsForProspects({
          organizationId: input.organizationId,
          userId: input.userId,
          jobId: job.id,
          companyIds: auditCompanyIds,
        }).catch(() => undefined);
      }

      return { jobId: job.id, summary };
    } catch (err) {
      await prisma.jobLog.update({
        where: { id: job.id },
        data: {
          status: JobStatus.FAILED,
          message: err instanceof Error ? err.message : "Import failed",
        },
      });
      throw err;
    }
  }

  async getJob(organizationId: string, jobId: string) {
    const job = await prisma.jobLog.findFirst({
      where: { id: jobId, organizationId, jobType: JOB_TYPE },
    });
    if (!job) throw new NotFoundError("Import job not found");
    const meta = (job.metadata ?? {}) as JobMeta;
    return {
      id: job.id,
      status: job.status,
      message: job.message,
      createdAt: job.createdAt,
      summary: meta.summary ?? null,
      validation: meta.validation ?? null,
      runAuditAfterImport: meta.runAuditAfterImport ?? true,
      fileName: meta.fileName,
      hasErrorCsv: Boolean(meta.errorCsv),
    };
  }

  async getErrorCsv(organizationId: string, jobId: string): Promise<string> {
    const job = await prisma.jobLog.findFirst({
      where: { id: jobId, organizationId, jobType: JOB_TYPE },
    });
    if (!job) throw new NotFoundError("Import job not found");
    const meta = (job.metadata ?? {}) as JobMeta;
    if (meta.errorCsv) return meta.errorCsv;
    if (meta.summary?.results) return toErrorCsv(meta.summary.results);
    return "row,status,reason\n";
  }

  private async runImport(input: {
    organizationId: string;
    userId: string;
    jobId: string;
    rawRows: Record<string, string>[];
    mapping: ColumnMapping;
    runAuditAfterImport: boolean;
  }): Promise<ImportSummary & { auditCompanyIds: string[] }> {
    const mapped = mapRows(input.rawRows, input.mapping);
    const summary = emptySummary();
    const auditCompanyIds: string[] = [];
    const auditCompanySet = new Set<string>();

    const isOwner = billingGateway.isPlatformOwner(input.organizationId);
    const indexes = await loadExistingIndexes(input.organizationId);

    const members = await prisma.organizationUser.findMany({
      where: {
        organizationId: input.organizationId,
        status: MembershipStatus.ACTIVE,
      },
      include: { user: { select: { id: true, email: true } } },
    });
    const ownerByEmail = new Map(
      members
        .filter((m) => m.user.email)
        .map((m) => [m.user.email.toLowerCase(), m.user.id])
    );

    let csvSourceId: string | null = null;
    const ensureCsvSource = async () => {
      if (csvSourceId) return csvSourceId;
      const existing = await prisma.opportunitySource.findFirst({
        where: { organizationId: input.organizationId, key: "csv_import" },
      });
      if (existing) {
        csvSourceId = existing.id;
        return csvSourceId;
      }
      const created = await prisma.opportunitySource.create({
        data: {
          organizationId: input.organizationId,
          key: "csv_import",
          name: "CSV Import",
        },
      });
      csvSourceId = created.id;
      return csvSourceId;
    };

    const seenEmails = new Set<string>();

    for (const row of mapped) {
      const result: ImportRowResult = {
        row: row._rowNumber,
        status: "skipped",
      };

      try {
        const companyName = row.company_name.trim();
        if (!companyName) {
          result.status = "skipped";
          result.reason = "missing_company_name";
          summary.skipped++;
          summary.results.push(result);
          continue;
        }

        const domain =
          normalizeDomain(row.website) || extractDomain(row.website) || null;
        const country = normalizeCountry(row.country);
        const companyKey = `${companyName.toLowerCase()}|${(country || "").toLowerCase()}`;

        const rel = normalizeRelationship(row.relationship);
        const isCustomer = isCustomerRelationship(rel);
        const dnc = parseYesNo(row.do_not_contact);
        const outreachFlags = customerTypeFromRelationship(rel, dnc);
        const tags = splitTags(row.tags);
        const timezone = deriveImportTimezone({
          city: row.city,
          country: country || row.country,
        });
        const employeeCount = parseEmployeeCount(row.employee_count);

        // Prospects pass enrichment; clients/DNC never audited
        const enrichmentStatus = outreachFlags.outreachExcluded
          ? CompanyEnrichmentStatus.SKIPPED
          : CompanyEnrichmentStatus.ENRICHED;

        // Resolve contact identity (email-only / company_email → General inbox)
        const resolved = resolveImportContact({
          email: row.email,
          companyEmail: row.company_email,
          firstName: row.first_name,
          lastName: row.last_name,
          title: row.title,
          website: row.website.trim() || domain,
          companyDomain: domain,
        });

        let email: string | null = resolved.ok
          ? resolved.contact.email
          : normalizeEmail(row.email);
        let contactSkipReason: string | null = null;
        if (
          !resolved.ok &&
          resolved.code !== "no_email" &&
          (row.email.trim() || row.company_email.trim())
        ) {
          contactSkipReason = `${resolved.code}:${resolved.message}`;
          email = null;
        }

        if (email && seenEmails.has(email)) {
          result.status = "skipped";
          result.reason = "duplicate_in_file_email";
          summary.skipped++;
          summary.results.push(result);
          continue;
        }
        if (email) seenEmails.add(email);

        // Free built-in email checks (no Hunter)
        let emailStatus: string | null = null;
        let roleGeneric = false;
        let typoSuggestion: string | null = null;
        if (email && resolved.ok) {
          const quality = await checkEmailQuality(email);
          emailStatus = quality.emailStatus;
          roleGeneric =
            quality.roleGeneric || resolved.contact.isGeneralInbox;
          typoSuggestion = quality.typoSuggestion;
          result.typoSuggestion = typoSuggestion ?? undefined;
          result.roleGeneric = roleGeneric || undefined;

          if (quality.typoSuggestion) {
            summary.emailChecks.typoSuggestions++;
          }
          if (roleGeneric) summary.emailChecks.roleGeneric++;

          if (!quality.ok) {
            summary.emailChecks.invalid++;
            result.emailStatus = "invalid";
            result.reason = `email_${quality.failure}:${quality.message ?? email}`;
          } else {
            summary.emailChecks.validManual++;
            result.emailStatus = "valid_manual";
          }
        } else if (contactSkipReason) {
          result.reason = contactSkipReason;
        }

        let company =
          (domain && indexes.companyByDomain.get(domain)) ||
          indexes.companyByKey.get(companyKey) ||
          null;

        let companyAction: "created" | "updated" | "unchanged" = "unchanged";
        const filledCompanyFields: string[] = [];

        if (!company) {
          if (!isOwner) {
            await entitlementService.assertAndConsume(
              input.organizationId,
              FEATURE_KEYS.OPPORTUNITIES,
              1,
              { purpose: "crm_csv_import" }
            );
          }

          const created = await prisma.company.create({
            data: {
              organizationId: input.organizationId,
              name: companyName,
              domain,
              normalizedDomain: domain,
              website: row.website.trim() || null,
              phone: row.company_phone.trim() || null,
              address: row.address.trim() || null,
              city: row.city.trim() || null,
              state: row.state_province.trim() || null,
              country,
              industry: row.industry.trim() || null,
              employeeCount,
              linkedInUrl: row.company_linkedin_url.trim() || null,
              timezone,
              source: row.source.trim() || CSV_IMPORT_SOURCE,
              enrichmentStatus,
              enrichedAt:
                enrichmentStatus === CompanyEnrichmentStatus.ENRICHED
                  ? new Date()
                  : null,
              status: "ACTIVE",
              metadata: {
                imported: true,
                importJobId: input.jobId,
                ...outreachFlags,
                tags,
                notes: row.notes.trim() || null,
                companyEmail: row.company_email.trim() || null,
              } as Prisma.InputJsonValue,
            },
          });
          company = {
            id: created.id,
            name: created.name,
            country: created.country,
            domain: created.domain,
            normalizedDomain: created.normalizedDomain,
          };
          companyAction = "created";
          summary.companiesCreated++;
          if (domain) {
            indexes.domains.add(domain);
            indexes.companyByDomain.set(domain, company);
          }
          indexes.companyKeys.add(companyKey);
          indexes.companyByKey.set(companyKey, company);
        } else {
          const full = await prisma.company.findFirst({
            where: { id: company.id, organizationId: input.organizationId },
          });
          if (full) {
            const incoming = {
              website: row.website.trim() || null,
              phone: row.company_phone.trim() || null,
              address: row.address.trim() || null,
              city: row.city.trim() || null,
              state: row.state_province.trim() || null,
              country,
              industry: row.industry.trim() || null,
              employeeCount,
              linkedInUrl: row.company_linkedin_url.trim() || null,
              timezone,
              domain: domain ?? full.domain,
              normalizedDomain: domain ?? full.normalizedDomain,
            };
            const { patch, filled } = fillEmptyFields(
              full as unknown as Record<string, unknown>,
              incoming as unknown as Record<string, unknown>,
              [
                "website",
                "phone",
                "address",
                "city",
                "state",
                "country",
                "industry",
                "employeeCount",
                "linkedInUrl",
                "timezone",
                "domain",
                "normalizedDomain",
              ]
            );
            const prevMeta =
              full.metadata && typeof full.metadata === "object"
                ? (full.metadata as Record<string, unknown>)
                : {};
            const nextMeta = {
              ...prevMeta,
              imported: true,
              importJobId: input.jobId,
              ...(outreachFlags.outreachExcluded
                ? {
                    customerType: outreachFlags.customerType,
                    relationship: outreachFlags.relationship,
                    outreachExcluded: true,
                  }
                : {
                    customerType:
                      prevMeta.customerType || outreachFlags.customerType,
                    relationship:
                      prevMeta.relationship || outreachFlags.relationship,
                  }),
              tags: Array.from(
                new Set([
                  ...((prevMeta.tags as string[]) || []),
                  ...tags,
                ])
              ),
              ...(row.notes.trim() && !prevMeta.notes
                ? { notes: row.notes.trim() }
                : {}),
            };

            const enrichPatch: Prisma.CompanyUpdateInput = {
              ...patch,
              metadata: nextMeta as Prisma.InputJsonValue,
            };
            // Prospects: ensure ENRICHED so audit queue picks them up
            if (!outreachFlags.outreachExcluded) {
              if (full.enrichmentStatus !== CompanyEnrichmentStatus.ENRICHED) {
                enrichPatch.enrichmentStatus = CompanyEnrichmentStatus.ENRICHED;
                enrichPatch.enrichedAt = new Date();
              }
            } else {
              enrichPatch.enrichmentStatus = CompanyEnrichmentStatus.SKIPPED;
            }

            await prisma.company.update({
              where: { id: full.id },
              data: enrichPatch,
            });
            if (filled.length) {
              companyAction = "updated";
              filledCompanyFields.push(...filled);
              summary.companiesUpdated++;
              summary.changes.push({
                row: row._rowNumber,
                entity: "company",
                fields: filled,
              });
            }
          }
        }

        result.companyId = company.id;
        result.companyAction = companyAction;

        let contactId: string | undefined;
        let contactAction: ImportRowResult["contactAction"] = "none";

        if (resolved.ok && email) {
          const rc = resolved.contact;
          const first = rc.firstName;
          const last = rc.lastName;

          let contact =
            indexes.contactByEmail.get(email) ||
            (first && last
              ? indexes.contactByNameCompany.get(
                  `${first.toLowerCase()}|${last.toLowerCase()}|${company.id}`
                )
              : null) ||
            null;

          if (contact && contact.companyId !== company.id) {
            // Org-unique email — still update that contact's empty fields
          }

          const contactMeta: Record<string, unknown> = {
            imported: true,
            importJobId: input.jobId,
            tags,
            notes: row.notes.trim() || null,
            relationship: outreachFlags.relationship,
            doNotContact: dnc,
            outreachExcluded: outreachFlags.outreachExcluded,
            isGeneralInbox: rc.isGeneralInbox,
            emailSource: rc.emailSource,
            ...(roleGeneric || rc.isGeneralInbox
              ? { emailRole: "generic" }
              : {}),
            ...(typoSuggestion
              ? { typoSuggestion, typoSuggestionApplied: false }
              : {}),
            ...(emailStatus === "valid_manual"
              ? {
                  verifiedBy: "user",
                  verifiedByUserId: input.userId,
                  verifiedAt: new Date().toISOString(),
                  verifiedLabel: "verified by user (CSV import)",
                }
              : {}),
            ...(emailStatus === "invalid"
              ? { emailCheckFailed: result.reason }
              : {}),
          };

          if (!contact) {
            const created = await prisma.contact.create({
              data: {
                organizationId: input.organizationId,
                companyId: company.id,
                firstName: first || "there",
                lastName: last || "",
                fullName: rc.fullName || email,
                title: rc.title,
                email,
                normalizedEmail: email,
                emailStatus,
                phone: row.phone.trim() || null,
                linkedInUrl: row.linkedin_url.trim() || null,
                source: row.source.trim() || CSV_IMPORT_SOURCE,
                status: dnc
                  ? ContactStatus.UNSUBSCRIBED
                  : ContactStatus.ACTIVE,
                verifiedAt:
                  emailStatus === "valid_manual" ? new Date() : null,
                metadata: contactMeta as Prisma.InputJsonValue,
              },
            });
            contact = {
              id: created.id,
              companyId: created.companyId,
              firstName: created.firstName,
              lastName: created.lastName,
              normalizedEmail: created.normalizedEmail,
            };
            contactAction = "created";
            contactId = created.id;
            summary.contactsCreated++;
            indexes.emails.add(email);
            indexes.contactByEmail.set(email, contact);
            if (first && last) {
              indexes.contactByNameCompany.set(
                `${first.toLowerCase()}|${last.toLowerCase()}|${company.id}`,
                contact
              );
            }
          } else {
            const full = await prisma.contact.findFirst({
              where: { id: contact.id, organizationId: input.organizationId },
            });
            if (full) {
              // Re-import: attach to this company if contact had no company match
              // and fill empty fields only (including names when previously empty)
              const incoming = {
                title: rc.title || full.title,
                phone: row.phone.trim() || null,
                linkedInUrl: row.linkedin_url.trim() || null,
                email: email || full.email,
                normalizedEmail: email || full.normalizedEmail,
                firstName:
                  full.firstName === "there" || !full.firstName.trim()
                    ? first || full.firstName
                    : full.firstName,
                lastName: !full.lastName.trim() ? last : full.lastName,
                fullName:
                  !full.fullName.trim() ||
                  full.fullName === full.email ||
                  full.firstName === "there"
                    ? rc.fullName
                    : full.fullName,
              };
              const { patch, filled } = fillEmptyFields(
                {
                  title: full.title,
                  phone: full.phone,
                  linkedInUrl: full.linkedInUrl,
                  email: full.email,
                  normalizedEmail: full.normalizedEmail,
                  firstName: full.firstName,
                  lastName: full.lastName,
                  fullName: full.fullName,
                } as Record<string, unknown>,
                incoming as Record<string, unknown>,
                [
                  "title",
                  "phone",
                  "linkedInUrl",
                  "email",
                  "normalizedEmail",
                  "firstName",
                  "lastName",
                  "fullName",
                ]
              );
              if (!full.emailStatus && emailStatus) {
                (patch as Record<string, unknown>).emailStatus = emailStatus;
                filled.push("emailStatus");
              }
              if (
                !outreachFlags.outreachExcluded &&
                emailStatus === "valid_manual" &&
                (!full.emailStatus || full.emailStatus === "unknown")
              ) {
                (patch as Record<string, unknown>).emailStatus =
                  "valid_manual";
                if (!filled.includes("emailStatus")) filled.push("emailStatus");
              }
              if (
                emailStatus === "invalid" &&
                email &&
                full.normalizedEmail === email
              ) {
                (patch as Record<string, unknown>).emailStatus = "invalid";
              }

              const prevMeta =
                full.metadata && typeof full.metadata === "object"
                  ? (full.metadata as Record<string, unknown>)
                  : {};
              const nextMeta = {
                ...prevMeta,
                ...contactMeta,
                tags: Array.from(
                  new Set([
                    ...((prevMeta.tags as string[]) || []),
                    ...tags,
                  ])
                ),
              };

              // Move contact onto this company if empty-company mismatch and same org email
              const companyPatch =
                full.companyId !== company.id
                  ? { companyId: company.id }
                  : {};

              await prisma.contact.update({
                where: { id: full.id },
                data: {
                  ...patch,
                  ...companyPatch,
                  ...(dnc ? { status: ContactStatus.UNSUBSCRIBED } : {}),
                  metadata: nextMeta as Prisma.InputJsonValue,
                  ...(emailStatus === "valid_manual" && !full.verifiedAt
                    ? { verifiedAt: new Date() }
                    : {}),
                },
              });
              contactId = full.id;
              if (filled.length || companyPatch.companyId) {
                contactAction = "updated";
                summary.contactsUpdated++;
                summary.changes.push({
                  row: row._rowNumber,
                  entity: "contact",
                  fields: filled.length
                    ? filled
                    : ["companyId"],
                });
                result.fieldsFilled = [...filledCompanyFields, ...filled];
              } else {
                contactAction = "unchanged";
              }
            }
          }
          result.contactId = contactId;
          result.contactAction = contactAction;
        } else if (contactSkipReason) {
          result.contactAction = "none";
        }

        if (dnc) {
          const suppressEmail = email || normalizeEmail(row.company_email);
          const suppressDomain =
            domain ||
            (suppressEmail ? extractDomain(suppressEmail) : null);
          try {
            if (suppressEmail) {
              const already = await emailSafetyService.isSuppressed(
                input.organizationId,
                suppressEmail
              );
              if (!already) {
                await emailSafetyService.suppress({
                  organizationId: input.organizationId,
                  email: suppressEmail,
                  domain: suppressDomain,
                  reason: SuppressionReason.MANUAL,
                  source: "csv_import_dnc",
                });
                summary.suppressionsAdded++;
                result.suppressed = true;
              }
            } else if (suppressDomain) {
              await emailSafetyService.suppress({
                organizationId: input.organizationId,
                domain: suppressDomain,
                reason: SuppressionReason.MANUAL,
                source: "csv_import_dnc",
              });
              summary.suppressionsAdded++;
              result.suppressed = true;
            }
          } catch {
            /* duplicate suppression */
          }
        }

        if (isCustomer && rel === "client") {
          const existingOpp = await prisma.opportunity.findFirst({
            where: {
              organizationId: input.organizationId,
              companyId: company.id,
              status: OpportunityStatus.WON,
            },
            select: { id: true },
          });
          if (!existingOpp) {
            if (!isOwner && companyAction !== "created") {
              await entitlementService.assertAndConsume(
                input.organizationId,
                FEATURE_KEYS.OPPORTUNITIES,
                1,
                { purpose: "crm_csv_import_won" }
              );
            }
            const sourceId = await ensureCsvSource();
            const ownerEmail = row.owner_email.trim().toLowerCase();
            const ownerId =
              (ownerEmail && ownerByEmail.get(ownerEmail)) || input.userId;
            await prisma.opportunity.create({
              data: {
                organizationId: input.organizationId,
                companyId: company.id,
                primaryContactId: contactId ?? null,
                sourceId,
                stage: OpportunityStage.WON,
                status: OpportunityStatus.WON,
                ownerId,
                whyNow: "Imported as existing client",
                recommendedAction: "Retain — do not outreach",
              },
            });
            summary.wonOpportunities++;
            result.wonOpportunity = true;
          }
        }

        // Queue audit for eligible prospects
        if (
          input.runAuditAfterImport &&
          !outreachFlags.outreachExcluded &&
          enrichmentStatus === CompanyEnrichmentStatus.ENRICHED &&
          (row.website.trim() || domain) &&
          emailStatus === "valid_manual" &&
          !auditCompanySet.has(company.id)
        ) {
          auditCompanySet.add(company.id);
          auditCompanyIds.push(company.id);
          result.queuedAudit = true;
          summary.auditsQueued++;
        }

        if (emailStatus === "invalid" || contactSkipReason) {
          // Company may still be persisted; contact skipped / invalid → error report
          result.status = "failed";
          if (contactSkipReason && !result.reason) {
            result.reason = contactSkipReason;
          }
          summary.failed++;
        } else if (
          companyAction === "created" ||
          contactAction === "created"
        ) {
          result.status = "imported";
          summary.imported++;
        } else {
          result.status = "updated";
          if (!result.reason) {
            result.reason = "already_exists_no_empty_fields";
          }
          summary.updated++;
        }
        summary.results.push(result);
      } catch (err) {
        result.status = "failed";
        result.reason =
          err instanceof Error ? err.message : "Unknown import error";
        summary.failed++;
        summary.results.push(result);
      }
    }

    return { ...summary, auditCompanyIds };
  }

  private async queueAuditsForProspects(input: {
    organizationId: string;
    userId: string;
    jobId: string;
    companyIds: string[];
  }) {
    // Process in small batches (audit API max 3 per call); continue across days via queue
    const ids = [...input.companyIds];
    let done = 0;
    while (ids.length > 0) {
      const chunk = ids.splice(0, 3);
      try {
        await websiteAuditService.auditBatch(
          input.organizationId,
          chunk.length,
          input.userId,
          chunk
        );
        done += chunk.length;
      } catch {
        // Daily limit / credits — remaining stay ENRICHED for normal audit queue
        break;
      }
    }

    const job = await prisma.jobLog.findFirst({
      where: { id: input.jobId, organizationId: input.organizationId },
    });
    if (!job) return;
    const meta = (job.metadata ?? {}) as JobMeta;
    const summary = meta.summary;
    if (summary) {
      await prisma.jobLog.update({
        where: { id: job.id },
        data: {
          message: `${job.message ?? ""} · Audits started for ${done}/${input.companyIds.length} prospects`,
          metadata: mergeMeta(job.metadata, { summary }),
        },
      });
    }
  }
}

export const crmImportService = new CrmImportService();
