import Link from "next/link";
import type { Metadata } from "next";
import { Check } from "lucide-react";
import { AuditForm } from "@/components/marketing/audit-form";
import { FaqBlock, JsonLd, faqJsonLd } from "@/components/marketing/faq-block";
import { SlotImage } from "@/components/marketing/slot-image";
import {
  auditChecks,
  engagementModels,
  faq,
  featuredWork,
  hasRealCopy,
  homeAiPoints,
  homeIndustries,
  homeServices,
  processSteps,
  promiseMarquee,
  siteConfig,
  techStack,
  valueTags,
  whyDelvixRows,
} from "@/content/site";

export const metadata: Metadata = {
  title: `${siteConfig.name} — Custom software for growing businesses`,
  description:
    "Web apps, mobile apps, ERP, CRM and AI automation. Scoped in writing, demoed every week, and handed over with full code ownership.",
  alternates: { canonical: siteConfig.url },
};

function CheckIcon({ className = "text-[var(--mkt-accent-light)]" }: { className?: string }) {
  return <Check className={`size-[1.125rem] shrink-0 ${className}`} strokeWidth={2.4} aria-hidden />;
}

export default function MarketingHomePage() {
  const showFounderQuote =
    hasRealCopy(siteConfig.founderQuote) && hasRealCopy(siteConfig.founderName);
  const auditNote = hasRealCopy(siteConfig.auditTurnaround)
    ? `Report in your inbox within ${siteConfig.auditTurnaround}.`
    : null;
  const techGroups = Object.entries(techStack);
  const marquee = [...promiseMarquee, ...promiseMarquee];

  return (
    <>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "Organization",
          name: siteConfig.name,
          url: siteConfig.url,
          email: siteConfig.contact.email,
          telephone: siteConfig.contact.phone,
        }}
      />
      <JsonLd data={faqJsonLd(faq)} />

      {/* 1. Hero */}
      <section className="mkt-hero-grid relative overflow-hidden py-16 sm:py-20 lg:py-24">
        <div className="mkt-wrap relative z-[1] flex flex-wrap items-center gap-10 lg:gap-14">
          <div className="dx-fade flex min-w-0 flex-[1_1_460px] flex-col gap-6">
            <span className="inline-flex w-fit items-center gap-2 rounded-full border border-[var(--mkt-line-2)] bg-[var(--mkt-panel)] px-3.5 py-1.5 text-[13px] text-[var(--mkt-muted)]">
              <span className="mkt-status__dot" aria-hidden />
              Remote software studio · US, UK, EU and Gulf hours
            </span>
            <h1 className="m-0 max-w-[16ch] text-[clamp(2.5rem,5.2vw,4rem)] font-extrabold leading-[1.05] text-[var(--mkt-ink)]">
              We build the systems your business runs on.
            </h1>
            <p className="m-0 max-w-[36ch] text-lg leading-relaxed text-[var(--mkt-muted)] sm:text-[19px]">
              Web apps, mobile apps, ERP, CRM and AI automation. Scoped in writing,
              demoed every week, and handed over with full code ownership.
            </p>
            <div className="mt-1 flex flex-wrap gap-3">
              <Link href={siteConfig.contact.bookingUrl} className="mkt-btn mkt-btn--primary">
                Book a free call
              </Link>
              <Link href="#work" className="mkt-btn mkt-btn--secondary">
                See our work
              </Link>
            </div>
            <div className="mt-1 flex flex-wrap gap-5">
              {valueTags.map((t) => (
                <span
                  key={t}
                  className="inline-flex items-center gap-2 text-[15px] text-[var(--mkt-ink-2)]"
                >
                  <CheckIcon />
                  {t}
                </span>
              ))}
            </div>
          </div>

          <div className="relative min-w-0 flex-[1_1_520px]">
            <div
              className="pointer-events-none absolute inset-x-[4%] top-[8%] h-[70%] rounded-full bg-[var(--mkt-accent)] opacity-20 blur-[80px]"
              aria-hidden
            />
            <div className="dx-float relative rounded-[18px] border border-[var(--mkt-line-2)] bg-[var(--mkt-panel)] p-2.5 shadow-[0_40px_80px_rgba(0,0,0,0.45)]">
              <div className="flex gap-1.5 px-2 pb-3 pt-1.5" aria-hidden>
                <span className="size-2.5 rounded-full bg-[#3A4660]" />
                <span className="size-2.5 rounded-full bg-[#3A4660]" />
                <span className="size-2.5 rounded-full bg-[#3A4660]" />
              </div>
              <SlotImage
                slot="HOME-01"
                alt="Revenue OS dashboard"
                width={1600}
                height={1000}
                priority
                className="w-full rounded-xl"
                note="Revenue OS dashboard, real screenshot · 1600×1000 · blur client names"
              />
            </div>
            <div className="dx-float2 absolute bottom-9 left-0 z-[1] hidden items-center gap-3 rounded-[14px] bg-[var(--mkt-light)] px-4 py-3.5 text-[var(--mkt-light-ink)] shadow-[0_20px_40px_rgba(0,0,0,0.35)] sm:flex sm:-left-3 lg:-left-5">
              <span className="flex size-9 items-center justify-center rounded-[10px] bg-[var(--mkt-accent-pale)]">
                <Check className="size-5 text-[#4F46E5]" strokeWidth={2} aria-hidden />
              </span>
              <span className="flex flex-col">
                <strong className="text-sm">Written scope</strong>
                <span className="text-[13px] text-[var(--mkt-light-muted)]">Delivered in 3 days</span>
              </span>
            </div>
            <div className="dx-float absolute right-0 top-7 z-[1] hidden items-center gap-3 rounded-[14px] bg-[var(--mkt-light)] px-4 py-3.5 text-[var(--mkt-light-ink)] shadow-[0_20px_40px_rgba(0,0,0,0.35)] sm:flex sm:-right-2">
              <span className="flex size-9 items-center justify-center rounded-[10px] bg-[var(--mkt-accent-pale)]">
                <Check className="size-5 text-[#4F46E5]" strokeWidth={2} aria-hidden />
              </span>
              <span className="flex flex-col">
                <strong className="text-sm">Demo every week</strong>
                <span className="text-[13px] text-[var(--mkt-light-muted)]">See real progress</span>
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* 2. Promise marquee */}
      <section className="mkt-marquee" aria-label="What every project gets">
        <div className="dx-marquee mkt-marquee__track px-6">
          {marquee.map((text, i) => (
            <span
              key={`${text}-${i}`}
              className="inline-flex items-center gap-3 text-base font-medium text-[var(--mkt-ink-2)]"
            >
              <CheckIcon />
              {text}
            </span>
          ))}
        </div>
      </section>

      {/* 3. Services */}
      <section className="mkt-section mkt-section--light">
        <div className="mkt-wrap flex flex-col gap-12">
          <div className="flex flex-wrap items-end justify-between gap-6">
            <div className="max-w-xl space-y-3.5">
              <p className="mkt-eyebrow !text-[#4F46E5]">What we build</p>
              <h2 className="m-0 text-[clamp(2rem,3.6vw,2.75rem)] font-extrabold leading-[1.12]">
                One studio for the software behind your operations.
              </h2>
            </div>
            <Link href="/services" className="mkt-link inline-flex items-center gap-2">
              All services →
            </Link>
          </div>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {homeServices.map((s) => (
              <Link
                key={s.href}
                href={s.href}
                className="dx-card flex flex-col gap-3.5 rounded-2xl border border-[var(--mkt-light-line)] bg-white p-7 text-[var(--mkt-light-ink)] no-underline"
              >
                <h3 className="m-0 text-xl font-bold">{s.title}</h3>
                <p className="m-0 text-[15px] leading-relaxed text-[var(--mkt-light-muted)]">
                  {s.text}
                </p>
                <span className="mt-auto text-sm font-semibold text-[#4F46E5]">Learn more →</span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* 4. AI */}
      <section className="mkt-section mkt-section--dark">
        <div className="mkt-wrap flex flex-wrap items-center gap-12 lg:gap-16">
          <div className="min-w-0 flex-[1_1_480px]">
            <SlotImage
              slot="HOME-02"
              alt="AI features in Revenue OS"
              width={1500}
              height={1200}
              className="w-full rounded-[18px]"
              note="Screenshot: Revenue OS deep audit findings or an AI reply draft · 1500×1200"
            />
          </div>
          <div className="flex min-w-0 flex-[1_1_460px] flex-col gap-5">
            <p className="mkt-eyebrow !text-[var(--mkt-accent-light)]">AI development</p>
            <h2 className="m-0 text-[clamp(2rem,3.6vw,2.75rem)] font-extrabold leading-[1.12] text-[var(--mkt-ink)]">
              AI that works on your data, inside your tools.
            </h2>
            <p className="m-0 text-[17px] leading-relaxed text-[var(--mkt-muted)]">
              We connect OpenAI and Claude to your CRM, inbox, documents and databases, with clear
              limits on what the AI can do on its own.
            </p>
            <div className="flex flex-col gap-3.5">
              {homeAiPoints.map((a) => (
                <div
                  key={a.title}
                  className="rounded-[14px] border border-[var(--mkt-line)] bg-[var(--mkt-panel)] p-4"
                >
                  <strong className="block text-base text-[var(--mkt-ink)]">{a.title}</strong>
                  <span className="mt-1 block text-sm leading-relaxed text-[var(--mkt-muted)]">
                    {a.body}
                  </span>
                </div>
              ))}
            </div>
            <Link href="/ai" className="mkt-btn mkt-btn--secondary w-fit">
              Explore AI services
            </Link>
          </div>
        </div>
      </section>

      {/* 5. Process */}
      <section className="mkt-section bg-[var(--mkt-light)] text-[var(--mkt-light-ink)]">
        <div className="mkt-wrap flex flex-col gap-14">
          <div className="max-w-xl space-y-3.5">
            <p className="mkt-eyebrow !text-[#4F46E5]">How we work</p>
            <h2 className="m-0 text-[clamp(2rem,3.6vw,2.75rem)] font-extrabold leading-[1.12]">
              From first call to launch, with no surprises.
            </h2>
            <p className="m-0 text-[17px] leading-relaxed text-[var(--mkt-light-muted)]">
              You always know what is being built, what it costs and what you will see next Friday.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            {processSteps.map((st) => (
              <div
                key={st.n}
                className="flex flex-col gap-3 rounded-2xl border border-[var(--mkt-light-line)] bg-white px-5 py-6"
              >
                <span className="font-[family-name:var(--font-mkt-display)] text-3xl font-extrabold text-[#4F46E5]">
                  {st.n}
                </span>
                <h3 className="m-0 text-[17px] font-bold">{st.title}</h3>
                <p className="m-0 text-sm leading-relaxed text-[var(--mkt-light-muted)]">{st.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 6. Engagement models */}
      <section className="mkt-section mkt-section--light">
        <div className="mkt-wrap flex flex-col gap-12">
          <div className="max-w-xl space-y-3.5">
            <p className="mkt-eyebrow !text-[#4F46E5]">Ways to work together</p>
            <h2 className="m-0 text-[clamp(2rem,3.6vw,2.75rem)] font-extrabold leading-[1.12]">
              Pick the model that fits the work.
            </h2>
          </div>
          <div className="grid items-stretch gap-5 lg:grid-cols-3">
            {engagementModels.map((md) => (
              <div
                key={md.name}
                className={`flex flex-col gap-4.5 rounded-[18px] p-8 ${
                  md.featured
                    ? "border border-[var(--mkt-navy)] bg-[var(--mkt-navy)] text-[var(--mkt-ink)]"
                    : "border border-[var(--mkt-light-line)] bg-white text-[var(--mkt-light-ink)]"
                }`}
              >
                {md.featured ? (
                  <span className="w-fit rounded-full bg-[var(--mkt-accent)] px-3 py-1 text-xs font-semibold text-white">
                    Most common
                  </span>
                ) : null}
                <h3 className="m-0 text-2xl font-extrabold">{md.name}</h3>
                <p
                  className={`m-0 text-[15px] leading-relaxed ${
                    md.featured ? "text-[var(--mkt-muted)]" : "text-[var(--mkt-light-muted)]"
                  }`}
                >
                  {md.fits}
                </p>
                <ul className="m-0 flex list-none flex-col gap-2.5 p-0">
                  {md.includes.map((pt) => (
                    <li key={pt} className="flex gap-2.5 text-[15px] leading-snug">
                      <CheckIcon className="mt-0.5 text-[var(--mkt-accent)]" />
                      {pt}
                    </li>
                  ))}
                </ul>
                <Link
                  href="/pricing"
                  className={`mt-auto rounded-[12px] px-5 py-3.5 text-center text-base font-semibold no-underline ${
                    md.featured
                      ? "bg-[var(--mkt-accent)] text-white"
                      : "bg-[var(--mkt-light)] text-[var(--mkt-light-ink)]"
                  }`}
                >
                  Get pricing
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 7. Why Delvix */}
      <section className="mkt-section mkt-section--dark">
        <div className="mkt-wrap flex flex-wrap items-start gap-12 lg:gap-14">
          <div className="flex min-w-0 flex-[1_1_560px] flex-col gap-7">
            <p className="mkt-eyebrow !text-[var(--mkt-accent-light)]">Why Delvix</p>
            <h2 className="m-0 text-[clamp(2rem,3.6vw,2.75rem)] font-extrabold leading-[1.12] text-[var(--mkt-ink)]">
              Clearer than a typical agency.
            </h2>
            <div className="overflow-x-auto rounded-2xl border border-[var(--mkt-line)]">
              <table className="mkt-table min-w-[520px] text-[15px]">
                <thead>
                  <tr className="bg-[var(--mkt-panel)] text-left">
                    <th className="font-medium text-[var(--mkt-muted)]" />
                    <th className="text-[var(--mkt-ink)]">Delvix Studio</th>
                    <th className="font-medium text-[var(--mkt-muted)]">Typical agency</th>
                  </tr>
                </thead>
                <tbody>
                  {whyDelvixRows.map((c) => (
                    <tr key={c.label}>
                      <td className="text-[var(--mkt-ink-2)]">{c.label}</td>
                      <td className="font-semibold text-[var(--mkt-ink)]">{c.delvix}</td>
                      <td className="text-[var(--mkt-muted)]">{c.typical}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <div className="flex min-w-0 flex-[1_1_380px] flex-col gap-4.5">
            <SlotImage
              slot="HOME-03"
              alt="Founder portrait"
              width={1200}
              height={1500}
              className="w-full rounded-[18px]"
              note="Real photo of you at your desk, natural light · 1200×1500"
            />
            {showFounderQuote ? (
              <blockquote className="m-0 rounded-2xl border border-[var(--mkt-line)] bg-[var(--mkt-panel)] p-[22px] text-base leading-relaxed text-[var(--mkt-ink-2)]">
                “{siteConfig.founderQuote}”
                <footer className="mt-3 text-sm text-[var(--mkt-muted)]">
                  {siteConfig.founderName}, Founder, Delvix Studio
                </footer>
              </blockquote>
            ) : null}
          </div>
        </div>
      </section>

      {/* 8. Industries */}
      <section className="mkt-section mkt-section--light">
        <div className="mkt-wrap flex flex-col gap-12">
          <div className="max-w-xl space-y-3.5">
            <p className="mkt-eyebrow !text-[#4F46E5]">Industries</p>
            <h2 className="m-0 text-[clamp(2rem,3.6vw,2.75rem)] font-extrabold leading-[1.12]">
              Built for businesses that run on operations.
            </h2>
          </div>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {homeIndustries.map((i) => (
              <Link
                key={i.href}
                href={i.href}
                className="dx-card flex flex-col overflow-hidden rounded-2xl border border-[var(--mkt-light-line)] bg-white text-[var(--mkt-light-ink)] no-underline"
              >
                <SlotImage
                  slot={i.img}
                  alt={i.title}
                  width={1200}
                  height={750}
                  className="aspect-[16/10] w-full object-cover"
                  note={`${i.title} photo`}
                />
                <div className="flex flex-col gap-2 px-[22px] pb-6 pt-5">
                  <strong className="text-[17px]">{i.title}</strong>
                  <span className="text-sm leading-relaxed text-[var(--mkt-light-muted)]">
                    {i.text}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* 9. Featured case study */}
      <section id="work" className="mkt-section mkt-section--dark">
        <div className="mkt-wrap flex flex-col gap-10">
          <div className="flex flex-wrap items-end justify-between gap-6">
            <div className="max-w-xl space-y-3.5">
              <p className="mkt-eyebrow !text-[var(--mkt-accent-light)]">Our work</p>
              <h2 className="m-0 text-[clamp(2rem,3.6vw,2.75rem)] font-extrabold leading-[1.12] text-[var(--mkt-ink)]">
                Real projects, real screenshots.
              </h2>
            </div>
            <Link href="/work" className="font-semibold text-[var(--mkt-ink)] no-underline">
              All case studies →
            </Link>
          </div>
          <div className="flex flex-wrap overflow-hidden rounded-[22px] border border-[var(--mkt-line)] bg-[var(--mkt-panel)]">
            <div className="flex min-w-0 flex-[1_1_520px] flex-col gap-5 p-8 sm:p-10">
              <div className="flex flex-wrap gap-2">
                {featuredWork.tags.map((tag, idx) => (
                  <span
                    key={tag}
                    className={`rounded-full px-3 py-1 text-[13px] ${
                      idx === 0
                        ? "bg-[#1B2340] text-[#C7D2FE]"
                        : "border border-[var(--mkt-line-2)] text-[var(--mkt-muted)]"
                    }`}
                  >
                    {tag}
                  </span>
                ))}
              </div>
              <h3 className="m-0 text-3xl font-extrabold text-[var(--mkt-ink)]">
                {featuredWork.title}
              </h3>
              <p className="m-0 text-[17px] leading-relaxed text-[var(--mkt-muted)]">
                {featuredWork.lead}
              </p>
              <div className="flex flex-wrap gap-2">
                {featuredWork.stack.map((t) => (
                  <span
                    key={t}
                    className="rounded-lg border border-[var(--mkt-line)] bg-[var(--mkt-navy)] px-3 py-1.5 text-[13px] text-[var(--mkt-ink-2)]"
                  >
                    {t}
                  </span>
                ))}
              </div>
              <Link href={featuredWork.href} className="mkt-btn mkt-btn--primary mt-2 w-fit">
                Read the case study
              </Link>
            </div>
            <div className="flex min-w-0 flex-[1_1_520px] p-6">
              <SlotImage
                slot="HOME-04"
                alt="Revenue OS pipeline"
                width={1400}
                height={1000}
                className="min-h-[340px] w-full rounded-[14px] object-cover"
                note="Real screenshot of the pipeline or Super Admin packages · 1400×1000"
              />
            </div>
          </div>
        </div>
      </section>

      {/* 10. Free audit band */}
      <section className="bg-[#4F46E5] px-6 py-20 text-white sm:py-24">
        <div className="mkt-wrap flex flex-wrap items-center gap-12 lg:gap-14">
          <div className="flex min-w-0 flex-[1_1_460px] flex-col gap-4.5">
            <span className="text-[13px] font-semibold uppercase tracking-[0.12em] text-[#E0E7FF]">
              Free, no sales pitch
            </span>
            <h2 className="m-0 text-[clamp(2rem,3.6vw,2.75rem)] font-extrabold leading-[1.12]">
              Get a free website & systems audit.
            </h2>
            <p className="m-0 text-[17px] leading-relaxed text-[#E0E7FF]">
              We open your site on a real phone and desktop browser and send you a short report with
              screenshots: what&apos;s broken, what&apos;s slowing you down, and what to fix first.
            </p>
            <div className="grid gap-2.5 sm:grid-cols-2">
              {auditChecks.map((ac) => (
                <span key={ac} className="flex gap-2.5 text-[15px]">
                  <Check className="mt-0.5 size-[1.125rem] shrink-0" strokeWidth={2.4} aria-hidden />
                  {ac}
                </span>
              ))}
            </div>
          </div>
          <div className="min-w-0 flex-[1_1_400px]">
            <div className="rounded-[20px] bg-white p-8 text-[var(--mkt-light-ink)] shadow-[0_30px_60px_rgba(11,18,32,0.3)]">
              <strong className="mb-4 block font-[family-name:var(--font-mkt-display)] text-xl">
                Request your audit
              </strong>
              <AuditForm variant="light" />
              {auditNote ? (
                <p className="mt-3 text-[13px] text-[var(--mkt-light-muted)]">{auditNote}</p>
              ) : null}
            </div>
          </div>
        </div>
      </section>

      {/* 11. Tech stack */}
      <section className="mkt-section mkt-section--light">
        <div className="mkt-wrap flex flex-col gap-10">
          <div className="max-w-xl space-y-3.5">
            <p className="mkt-eyebrow !text-[#4F46E5]">Technology</p>
            <h2 className="m-0 text-[clamp(2rem,3.6vw,2.75rem)] font-extrabold leading-[1.12]">
              A modern stack, chosen for your project.
            </h2>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {techGroups.map(([group, items]) => (
              <div key={group} className="flex flex-col gap-3.5 rounded-2xl bg-[var(--mkt-light)] p-6">
                <strong className="text-[15px]">{group}</strong>
                <div className="flex flex-wrap gap-2">
                  {items.map((it) => (
                    <span
                      key={it}
                      className="rounded-lg border border-[var(--mkt-light-line)] bg-white px-3 py-1.5 text-sm"
                    >
                      {it}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 12. FAQ */}
      <FaqBlock
        items={faq}
        title="Questions we hear before every project."
        tone="light"
        schema={false}
      />

      {/* 13. Final CTA */}
      <section id="book" className="mkt-section mkt-section--dark">
        <div className="mkt-wrap">
          <div className="flex flex-wrap items-center gap-12 rounded-[28px] border border-[var(--mkt-line)] bg-[var(--mkt-panel)] p-8 sm:p-14 lg:gap-14">
            <div className="flex min-w-0 flex-[1_1_480px] flex-col gap-5">
              <h2 className="m-0 text-[clamp(2rem,3.6vw,2.875rem)] font-extrabold leading-[1.1] text-[var(--mkt-ink)]">
                Tell us what you&apos;re running on today.
              </h2>
              <p className="m-0 text-[17px] leading-relaxed text-[var(--mkt-muted)]">
                A free 30-minute call. You leave with a clear next step, whether or not you work with
                us.
              </p>
              <div className="flex flex-wrap gap-3">
                <Link href={siteConfig.contact.bookingUrl} className="mkt-btn mkt-btn--primary">
                  Book a free call
                </Link>
                <a
                  href={siteConfig.contact.whatsapp}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mkt-btn mkt-btn--secondary"
                >
                  Chat on WhatsApp
                </a>
              </div>
              <div className="flex flex-wrap gap-5">
                {valueTags.map((t) => (
                  <span
                    key={t}
                    className="inline-flex items-center gap-2 text-sm text-[var(--mkt-ink-2)]"
                  >
                    <CheckIcon />
                    {t}
                  </span>
                ))}
              </div>
            </div>
            <div className="min-w-0 flex-[1_1_360px]">
              <SlotImage
                slot="HOME-05"
                alt="On a call with a client"
                width={1200}
                height={900}
                className="aspect-[4/3] w-full rounded-[18px] object-cover"
                note="Real photo: you on a video call with a client or demoing on screen · 1200×900"
              />
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
