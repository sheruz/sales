import type { Metadata } from "next";
import Link from "next/link";
import { SlotImage } from "@/components/marketing/slot-image";
import { hasRealCopy, siteConfig } from "@/content/site";
import { hasSlotImage } from "@/lib/marketing/slot-images";
import { buildPageMetadata } from "@/lib/marketing/page-metadata";

export const metadata: Metadata = buildPageMetadata({
  title: "About Delvix Studio | Remote Software Studio",
  description:
    "A small studio that builds software the way we'd want it built for us. Working remotely with businesses in the US, UK, Europe and the Gulf.",
  path: "/about",
});

const principles = [
  {
    n: "01",
    title: "Scope in writing",
    text: "Before any code, you get features, price and timeline on paper.",
  },
  {
    n: "02",
    title: "Show, don't tell",
    text: "A working demo every week instead of status reports.",
  },
  {
    n: "03",
    title: "Talk to builders",
    text: "You speak directly with the developers on your project.",
  },
  {
    n: "04",
    title: "You own it",
    text: "Code, data and accounts are yours on final payment.",
  },
  {
    n: "05",
    title: "Honest advice",
    text: "If a ready-made tool fits better, we'll tell you.",
  },
];

const photoSlots = [
  { id: "ABOUT-02", note: "Your workspace / desk setup · 1200×900", required: true },
  { id: "ABOUT-03", note: "You on a client call or whiteboarding · 1200×900", required: true },
  {
    id: "ABOUT-04",
    note: "Team photo (only if you have a team) · 1200×900",
    required: false,
  },
] as const;

export default function AboutPage() {
  const story = hasRealCopy(siteConfig.founderQuote) ? siteConfig.founderQuote : "";
  const name = hasRealCopy(siteConfig.founderName) ? siteConfig.founderName : "";
  const showStory = Boolean(story && name);
  const photos = photoSlots.filter((p) => p.required || hasSlotImage(p.id));

  return (
    <>
      <section className="mkt-section mkt-section--dark">
        <div className="mkt-wrap">
          <div className="grid gap-14 lg:grid-cols-2">
            <div className="space-y-6">
              <p className="mkt-eyebrow">About Delvix Studio</p>
              <h1 className="text-4xl font-extrabold text-balance leading-tight sm:text-5xl lg:text-6xl">
                A small studio that builds software the way we&apos;d want it built for us.
              </h1>
              <p className="mkt-muted text-lg leading-relaxed">
                We work remotely with growing businesses in the US, UK, Europe and the Gulf. No
                layers of account managers: you talk to the people writing the code.
              </p>
            </div>
            <SlotImage
              slot="ABOUT-01"
              alt="Founder portrait"
              width={1200}
              height={1500}
              aspectRatio="4/5"
              className="w-full rounded-2xl"
              note="Founder portrait · 1200×1500"
            />
          </div>
        </div>
      </section>

      {showStory ? (
        <section className="mkt-section mkt-section--light">
          <div className="mkt-wrap mx-auto max-w-4xl space-y-5">
            <p className="mkt-eyebrow">Our story</p>
            <h2 className="text-3xl font-extrabold text-balance sm:text-4xl">Why Delvix exists</h2>
            <p className="text-lg leading-loose text-[var(--mkt-light-muted)]">{story}</p>
            <p className="font-semibold">
              {name}, Founder
            </p>
          </div>
        </section>
      ) : null}

      <section className="mkt-section bg-[var(--mkt-light)] text-[var(--mkt-light-ink)]">
        <div className="mkt-wrap space-y-11">
          <div className="max-w-3xl space-y-4">
            <p className="mkt-eyebrow !text-[#4F46E5]">How we work</p>
            <h2 className="text-3xl font-extrabold text-balance sm:text-4xl">
              Five principles behind every project.
            </h2>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {principles.map((p) => (
              <div
                key={p.n}
                className="space-y-3 rounded-2xl border border-[var(--mkt-light-line)] bg-white p-6"
              >
                <span className="text-sm font-extrabold text-[var(--mkt-accent)]">{p.n}</span>
                <h3 className="text-lg font-bold">{p.title}</h3>
                <p className="text-sm leading-relaxed text-[var(--mkt-light-muted)]">{p.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mkt-section mkt-section--dark">
        <div className="mkt-wrap grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {photos.map((photo) => (
            <SlotImage
              key={photo.id}
              slot={photo.id}
              alt={photo.note}
              width={1200}
              height={900}
              aspectRatio="4/3"
              className="w-full rounded-2xl"
              note={photo.note}
            />
          ))}
        </div>
      </section>

      <section className="mkt-section mkt-section--dark">
        <div className="mkt-wrap mx-auto flex max-w-4xl flex-col items-center gap-5 text-center">
          <h2 className="text-3xl font-extrabold text-balance sm:text-4xl">
            Let&apos;s talk about what you&apos;re building.
          </h2>
          <Link href={siteConfig.contact.bookingUrl} className="mkt-btn mkt-btn--primary">
            Book a free call
          </Link>
        </div>
      </section>
    </>
  );
}
