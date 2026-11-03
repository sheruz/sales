import Link from "next/link";
import type { Metadata } from "next";
import { Check } from "lucide-react";
import { AuditForm } from "@/components/marketing/audit-form";
import { JsonLd, faqJsonLd } from "@/components/marketing/faq-block";
import { PathIcon } from "@/components/marketing/path-icon";
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

function Tick({ className = "text-[#A5B4FC]" }: { className?: string }) {
  return <Check className={`mt-0.5 size-[1.125rem] shrink-0 ${className}`} strokeWidth={2.4} aria-hidden />;
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
      <section className="mkt-hero-grid relative overflow-hidden px-6 py-20 lg:py-28">
        <div className="mkt-wrap relative z-[1] flex flex-wrap items-center gap-14">
          <div className="dx-fade flex min-w-0 flex-[1_1_460px] flex-col gap-6">
            <span className="inline-flex w-fit items-center gap-2 rounded-full border border-[#2A3550] bg-[#121A2B] px-3.5 py-1.5 text-[13px] text-[#A3ADC2]">
              <span className="mkt-status__dot" aria-hidden />
              Remote software studio · US, UK, EU and Gulf hours
            </span>
            <h1 className="m-0 max-w-[16ch] text-[clamp(2.5rem,5.2vw,4rem)] font-extrabold leading-[1.05] tracking-[-0.02em] text-[#F5F7FB]">
              We build the systems your business runs on.
            </h1>
            <p className="m-0 max-w-[36rem] text-[19px] leading-[1.6] text-[#A3ADC2]">
              Web apps, mobile apps, ERP, CRM and AI automation. Scoped in writing, demoed every
              week, and handed over with full code ownership.
            </p>
            <div className="mt-1 flex flex-wrap gap-3">
              <Link
                href={siteConfig.contact.bookingUrl}
                className="inline-flex items-center gap-2.5 rounded-xl bg-[#6366F1] px-[26px] py-4 text-base font-semibold text-white no-underline"
              >
                Book a free call
              </Link>
              <Link
                href="#work"
                className="inline-flex items-center gap-2.5 rounded-xl border border-[#2A3550] px-[26px] py-4 text-base font-semibold text-[#F5F7FB] no-underline"
              >
                See our work
              </Link>
            </div>
            <div className="mt-1 flex flex-wrap gap-5">
              {valueTags.map((t) => (
                <span key={t} className="inline-flex items-center gap-2 text-[15px] text-[#D5DBE8]">
                  <Tick />
                  {t}
                </span>
              ))}
            </div>
          </div>

          <div className="relative min-w-0 flex-[1_1_520px]">
            <div
              className="pointer-events-none absolute inset-x-[4%] top-[8%] h-[70%] rounded-full bg-[#6366F1] opacity-[0.22] blur-[80px]"
              aria-hidden
            />
            <div className="dx-float relative rounded-[18px] border border-[#2A3550] bg-[#121A2B] p-2.5 shadow-[0_40px_80px_rgba(0,0,0,0.45)]">
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
            <div className="dx-float2 absolute bottom-9 left-0 z-[1] hidden items-center gap-3 rounded-[14px] bg-[#F5F7FB] px-4 py-3.5 text-[#0B1220] shadow-[0_20px_40px_rgba(0,0,0,0.35)] sm:flex lg:-left-5">
              <span className="mkt-icon-box !size-9 !rounded-[10px]">
                <PathIcon d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6M8 13h8M8 17h6" size={20} stroke="#4F46E5" />
              </span>
              <span className="flex flex-col">
                <strong className="text-sm">Written scope</strong>
                <span className="text-[13px] text-[#4B5568]">Delivered in 3 days</span>
              </span>
            </div>
            <div className="dx-float absolute right-0 top-7 z-[1] hidden items-center gap-3 rounded-[14px] bg-[#F5F7FB] px-4 py-3.5 text-[#0B1220] shadow-[0_20px_40px_rgba(0,0,0,0.35)] sm:flex sm:-right-3">
              <span className="mkt-icon-box !size-9 !rounded-[10px]">
                <PathIcon d="M6 4l14 8-14 8z" size={20} stroke="#4F46E5" />
              </span>
              <span className="flex flex-col">
                <strong className="text-sm">Demo every week</strong>
                <span className="text-[13px] text-[#4B5568]">See real progress</span>
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* 2. Promise marquee */}
      <section
        className="overflow-hidden border-y border-[#1E2738] bg-[#0E1626] py-[22px]"
        aria-label="What every project gets"
      >
        <div className="dx-marquee flex w-max gap-14 whitespace-nowrap px-6">
          {marquee.map((m, i) => (
            <span
              key={`${m.text}-${i}`}
              className="inline-flex items-center gap-3 text-base font-medium text-[#D5DBE8]"
            >
              <PathIcon d={m.icon} size={20} stroke="#A5B4FC" />
              {m.text}
            </span>
          ))}
        </div>
      </section>

      {/* 3. Services — matches canvas board */}
      <section className="bg-white px-6 py-28 text-[#0B1220]">
        <div className="mkt-wrap flex flex-col gap-12">
          <div className="flex flex-wrap items-end justify-between gap-6">
            <div className="flex max-w-[640px] flex-col gap-3.5">
              <span className="mkt-label">What we build</span>
              <h2 className="mkt-h2">One studio for the software behind your operations.</h2>
            </div>
            <Link
              href="/services"
              className="inline-flex items-center gap-2 font-semibold text-[#4F46E5] no-underline"
            >
              All services →
            </Link>
          </div>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {homeServices.map((s) => (
              <Link
                key={s.href}
                href={s.href}
                className="dx-card flex flex-col gap-3.5 rounded-2xl border border-[#E4E7EF] bg-white p-7 text-[#0B1220] no-underline"
              >
                <span className="mkt-icon-box">
                  <PathIcon d={s.icon} size={24} stroke="#4F46E5" />
                </span>
                <h3 className="m-0 text-xl font-bold">{s.title}</h3>
                <p className="m-0 text-[15px] leading-[1.6] text-[#4B5568]">{s.text}</p>
                <span className="mt-auto text-sm font-semibold text-[#4F46E5]">Learn more →</span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* 4. AI */}
      <section className="bg-[#0B1220] px-6 py-28">
        <div className="mkt-wrap flex flex-wrap items-center gap-16">
          <div className="min-w-0 flex-[1_1_480px]">
            <SlotImage
              slot="HOME-02"
              alt="AI in action"
              width={1500}
              height={1200}
              aspectRatio="5/4"
              className="w-full rounded-[18px]"
              note="Screenshot: Revenue OS deep audit findings or an AI reply draft · 1500×1200"
            />
          </div>
          <div className="flex min-w-0 flex-[1_1_460px] flex-col gap-[22px]">
            <span className="mkt-label mkt-label--light">AI development</span>
            <h2 className="mkt-h2 text-[#F5F7FB]">AI that works on your data, inside your tools.</h2>
            <p className="m-0 text-[17px] leading-[1.65] text-[#A3ADC2]">
              We connect OpenAI and Claude to your CRM, inbox, documents and databases, with clear
              limits on what the AI can do on its own.
            </p>
            <div className="flex flex-col gap-3.5">
              {homeAiPoints.map((a) => (
                <div
                  key={a.title}
                  className="flex gap-3.5 rounded-[14px] border border-[#1E2738] bg-[#121A2B] p-4"
                >
                  <span className="mkt-icon-box--dark">
                    <PathIcon d={a.icon} size={20} stroke="#A5B4FC" />
                  </span>
                  <span className="flex flex-col gap-1">
                    <strong className="text-base text-[#F5F7FB]">{a.title}</strong>
                    <span className="text-sm leading-[1.55] text-[#A3ADC2]">{a.body}</span>
                  </span>
                </div>
              ))}
            </div>
            <Link
              href="/ai"
              className="inline-flex w-fit items-center gap-2.5 rounded-xl border border-[#2A3550] px-[22px] py-3.5 font-semibold text-[#F5F7FB] no-underline"
            >
              Explore AI services
            </Link>
          </div>
        </div>
      </section>

      {/* 5. Process */}
      <section className="bg-[#F5F7FB] px-6 py-28 text-[#0B1220]">
        <div className="mkt-wrap flex flex-col gap-14">
          <div className="flex max-w-[700px] flex-col gap-3.5">
            <span className="mkt-label">How we work</span>
            <h2 className="mkt-h2">From first call to launch, with no surprises.</h2>
            <p className="m-0 text-[17px] leading-[1.65] text-[#4B5568]">
              You always know what is being built, what it costs and what you will see next Friday.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            {processSteps.map((st) => (
              <div
                key={st.n}
                className="flex flex-col gap-3 rounded-2xl border border-[#E4E7EF] bg-white px-5 py-6"
              >
                <span className="font-[family-name:var(--font-mkt-display)] text-[32px] font-extrabold leading-none text-[#4F46E5]">
                  {st.n}
                </span>
                <h3 className="m-0 text-[17px] font-bold">{st.title}</h3>
                <p className="m-0 text-sm leading-[1.55] text-[#4B5568]">{st.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 6. Engagement models */}
      <section className="bg-white px-6 py-28 text-[#0B1220]">
        <div className="mkt-wrap flex flex-col gap-12">
          <div className="flex max-w-[700px] flex-col gap-3.5">
            <span className="mkt-label">Ways to work together</span>
            <h2 className="mkt-h2">Pick the model that fits the work.</h2>
          </div>
          <div className="grid items-stretch gap-5 lg:grid-cols-3">
            {engagementModels.map((md) => (
              <div
                key={md.name}
                className={`flex flex-col gap-[18px] rounded-[18px] p-8 ${
                  md.featured
                    ? "border border-[#0B1220] bg-[#0B1220] text-[#F5F7FB]"
                    : "border border-[#E4E7EF] bg-white text-[#0B1220]"
                }`}
              >
                {md.featured ? (
                  <span className="w-fit rounded-full bg-[#6366F1] px-3 py-1 text-xs font-semibold text-white">
                    Most common
                  </span>
                ) : null}
                <h3 className="m-0 text-2xl font-extrabold">{md.name}</h3>
                <p
                  className={`m-0 text-[15px] leading-[1.6] ${
                    md.featured ? "text-[#A3ADC2]" : "text-[#4B5568]"
                  }`}
                >
                  {md.fits}
                </p>
                <ul className="m-0 flex list-none flex-col gap-2.5 p-0">
                  {md.includes.map((pt) => (
                    <li key={pt} className="flex gap-2.5 text-[15px] leading-snug">
                      <Tick className="text-[#6366F1]" />
                      {pt}
                    </li>
                  ))}
                </ul>
                <Link
                  href="/pricing"
                  className={`mt-auto rounded-xl px-5 py-3.5 text-center text-base font-semibold no-underline ${
                    md.featured
                      ? "bg-[#6366F1] text-white"
                      : "bg-[#F5F7FB] text-[#0B1220]"
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
      <section className="bg-[#0B1220] px-6 py-28">
        <div className="mkt-wrap flex flex-wrap items-start gap-14">
          <div className="flex min-w-0 flex-[1_1_560px] flex-col gap-7">
            <span className="mkt-label mkt-label--light">Why Delvix</span>
            <h2 className="mkt-h2 text-[#F5F7FB]">Clearer than a typical agency.</h2>
            <div className="overflow-x-auto rounded-2xl border border-[#1E2738]">
              <table className="w-full min-w-[520px] border-collapse text-[15px]">
                <thead>
                  <tr className="bg-[#121A2B] text-left">
                    <th className="px-5 py-4 font-medium text-[#A3ADC2]" />
                    <th className="px-5 py-4 font-semibold text-[#F5F7FB]">Delvix Studio</th>
                    <th className="px-5 py-4 font-medium text-[#A3ADC2]">Typical agency</th>
                  </tr>
                </thead>
                <tbody>
                  {whyDelvixRows.map((c) => (
                    <tr key={c.label} className="border-t border-[#1E2738]">
                      <td className="px-5 py-4 text-[#D5DBE8]">{c.label}</td>
                      <td className="px-5 py-4 font-semibold text-[#F5F7FB]">{c.delvix}</td>
                      <td className="px-5 py-4 text-[#A3ADC2]">{c.typical}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <div className="flex min-w-0 flex-[1_1_380px] flex-col gap-[18px]">
            <SlotImage
              slot="HOME-03"
              alt="Founder portrait"
              width={1200}
              height={1500}
              aspectRatio="4/5"
              className="w-full rounded-[18px]"
              note="Real photo of you at your desk, natural light · 1200×1500"
            />
            {showFounderQuote ? (
              <blockquote className="m-0 rounded-2xl border border-[#1E2738] bg-[#121A2B] p-[22px] text-base leading-[1.6] text-[#D5DBE8]">
                “{siteConfig.founderQuote}”
                <footer className="mt-3 text-sm text-[#A3ADC2]">
                  {siteConfig.founderName}, Founder, Delvix Studio
                </footer>
              </blockquote>
            ) : null}
          </div>
        </div>
      </section>

      {/* 8. Industries */}
      <section className="bg-white px-6 py-28 text-[#0B1220]">
        <div className="mkt-wrap flex flex-col gap-12">
          <div className="flex max-w-[700px] flex-col gap-3.5">
            <span className="mkt-label">Industries</span>
            <h2 className="mkt-h2">Built for businesses that run on operations.</h2>
          </div>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {homeIndustries.map((i) => (
              <Link
                key={i.href}
                href={i.href}
                className="dx-card flex flex-col overflow-hidden rounded-2xl border border-[#E4E7EF] bg-white text-[#0B1220] no-underline"
              >
                <SlotImage
                  slot={i.img}
                  alt={i.title}
                  width={1200}
                  height={750}
                  aspectRatio="16/10"
                  tone="light"
                  className="w-full rounded-none border-0 border-b border-dashed border-[#C9CEDB]"
                  note={i.imgNote}
                />
                <div className="flex flex-col gap-2 px-[22px] pb-6 pt-5">
                  <span className="flex items-center gap-2.5">
                    <PathIcon d={i.icon} size={20} stroke="#4F46E5" />
                    <strong className="text-[17px]">{i.title}</strong>
                  </span>
                  <span className="text-sm leading-[1.55] text-[#4B5568]">{i.text}</span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* 9. Featured case study */}
      <section id="work" className="bg-[#0B1220] px-6 py-28">
        <div className="mkt-wrap flex flex-col gap-10">
          <div className="flex flex-wrap items-end justify-between gap-6">
            <div className="flex max-w-[700px] flex-col gap-3.5">
              <span className="mkt-label mkt-label--light">Our work</span>
              <h2 className="mkt-h2 text-[#F5F7FB]">Real projects, real screenshots.</h2>
            </div>
            <Link href="/work" className="font-semibold text-[#A5B4FC] no-underline">
              All case studies →
            </Link>
          </div>
          <div className="flex flex-wrap overflow-hidden rounded-[22px] border border-[#1E2738] bg-[#121A2B]">
            <div className="flex min-w-0 flex-[1_1_520px] flex-col gap-5 p-10">
              <div className="flex flex-wrap gap-2">
                {featuredWork.tags.map((tag, idx) => (
                  <span
                    key={tag}
                    className={`rounded-full px-3 py-1 text-[13px] ${
                      idx === 0
                        ? "bg-[#1B2340] text-[#C7D2FE]"
                        : "border border-[#2A3550] text-[#A3ADC2]"
                    }`}
                  >
                    {tag}
                  </span>
                ))}
              </div>
              <h3 className="m-0 text-[32px] font-extrabold text-[#F5F7FB]">{featuredWork.title}</h3>
              <p className="m-0 text-[17px] leading-[1.65] text-[#A3ADC2]">{featuredWork.lead}</p>
              <div className="flex flex-wrap gap-2">
                {featuredWork.stack.map((t) => (
                  <span
                    key={t}
                    className="rounded-lg border border-[#1E2738] bg-[#0B1220] px-3 py-1.5 text-[13px] text-[#D5DBE8]"
                  >
                    {t}
                  </span>
                ))}
              </div>
              <Link
                href={featuredWork.href}
                className="mt-2 inline-flex w-fit items-center gap-2.5 rounded-xl bg-[#6366F1] px-[22px] py-3.5 font-semibold text-white no-underline"
              >
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
      <section className="bg-[#4F46E5] px-6 py-24 text-white">
        <div className="mkt-wrap flex flex-wrap items-center gap-14">
          <div className="flex min-w-0 flex-[1_1_460px] flex-col gap-[18px]">
            <span className="mkt-label mkt-label--on-indigo">Free, no sales pitch</span>
            <h2 className="mkt-h2 text-white">Get a free website & systems audit.</h2>
            <p className="m-0 text-[17px] leading-[1.65] text-[#E0E7FF]">
              We open your site on a real phone and desktop browser and send you a short report with
              screenshots: what&apos;s broken, what&apos;s slowing you down, and what to fix first.
            </p>
            <div className="grid gap-2.5 sm:grid-cols-2">
              {auditChecks.map((ac) => (
                <span key={ac} className="flex gap-2.5 text-[15px]">
                  <Tick className="text-white" />
                  {ac}
                </span>
              ))}
            </div>
          </div>
          <div className="min-w-0 flex-[1_1_400px]">
            <div className="rounded-[20px] bg-white p-8 text-[#0B1220] shadow-[0_30px_60px_rgba(11,18,32,0.3)]">
              <strong className="mb-4 block font-[family-name:var(--font-mkt-display)] text-xl">
                Request your audit
              </strong>
              <AuditForm variant="light" />
              {auditNote ? (
                <p className="mt-3 text-[13px] text-[#4B5568]">{auditNote}</p>
              ) : null}
            </div>
          </div>
        </div>
      </section>

      {/* 11. Tech stack */}
      <section className="bg-white px-6 py-28 text-[#0B1220]">
        <div className="mkt-wrap flex flex-col gap-10">
          <div className="flex max-w-[700px] flex-col gap-3.5">
            <span className="mkt-label">Technology</span>
            <h2 className="mkt-h2">A modern stack, chosen for your project.</h2>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {techGroups.map(([group, items]) => (
              <div key={group} className="flex flex-col gap-3.5 rounded-2xl bg-[#F5F7FB] p-6">
                <strong className="text-[15px]">{group}</strong>
                <div className="flex flex-wrap gap-2">
                  {items.map((it) => (
                    <span
                      key={it}
                      className="rounded-lg border border-[#E4E7EF] bg-white px-3 py-1.5 text-sm"
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

      {/* 12. FAQ — centered like canvas */}
      <section className="bg-[#F5F7FB] px-6 py-28 text-[#0B1220]">
        <div className="mx-auto flex max-w-[880px] flex-col gap-9">
          <div className="flex flex-col items-center gap-3.5 text-center">
            <span className="mkt-label">FAQ</span>
            <h2 className="mkt-h2">Questions we hear before every project.</h2>
          </div>
          <div className="flex flex-col gap-3">
            {faq.map((f) => (
              <details
                key={f.q}
                className="rounded-[14px] border border-[#E4E7EF] bg-white px-6 py-5"
              >
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-[17px] font-semibold marker:content-none [&::-webkit-details-marker]:hidden">
                  {f.q}
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="#4F46E5"
                    strokeWidth="2"
                    className="shrink-0"
                    aria-hidden
                  >
                    <path d="M6 9l6 6 6-6" />
                  </svg>
                </summary>
                <p className="mt-3.5 text-[15px] leading-[1.65] text-[#4B5568]">{f.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* 13. Final CTA */}
      <section id="book" className="bg-[#0B1220] px-6 py-28">
        <div className="mkt-wrap">
          <div className="mx-auto flex max-w-3xl flex-col items-center gap-5 rounded-[28px] border border-[#1E2738] bg-[#121A2B] p-8 text-center sm:p-14">
            <h2 className="m-0 text-[clamp(2rem,3.6vw,2.875rem)] font-extrabold leading-[1.1] text-[#F5F7FB]">
              Tell us what you&apos;re running on today.
            </h2>
            <p className="m-0 text-[17px] leading-[1.65] text-[#A3ADC2]">
              A free 30-minute call. You leave with a clear next step, whether or not you work with
              us.
            </p>
            <div className="flex flex-wrap justify-center gap-3">
              <Link
                href={siteConfig.contact.bookingUrl}
                className="inline-flex items-center gap-2.5 rounded-xl bg-[#6366F1] px-[26px] py-4 font-semibold text-white no-underline"
              >
                Book a free call
              </Link>
              <a
                href={siteConfig.contact.whatsapp}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2.5 rounded-xl border border-[#2A3550] px-[26px] py-4 font-semibold text-[#F5F7FB] no-underline"
                aria-label="Chat on WhatsApp"
              >
                {siteConfig.contact.phoneDisplay}
              </a>
            </div>
            <div className="flex flex-wrap justify-center gap-5">
              {valueTags.map((t) => (
                <span key={t} className="inline-flex items-center gap-2 text-sm text-[#D5DBE8]">
                  <Tick />
                  {t}
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
