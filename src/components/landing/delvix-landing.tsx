"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import "./delvix-landing.css";

const ROT_WORDS = [
  "web apps",
  "mobile apps",
  "ERP systems",
  "AI agents",
  "client portals",
];

const MARQUEE_A = [
  "Web applications",
  "Mobile apps",
  "Custom ERP",
  "CRM systems",
  "AI agents",
  "Client portals",
  "Automation",
];

const MARQUEE_B = [
  "Next.js",
  "React Native",
  "Flutter",
  "Node.js",
  "PostgreSQL",
  "Claude API",
  "AWS",
];

const SERVICES = [
  {
    num: "01",
    title: "Web applications",
    body: "Dashboards, booking systems, internal tools and SaaS products, built to be fast and easy to change.",
    tags: ["Next.js", "React", "Node", "PostgreSQL"],
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
        <rect x="3" y="4" width="18" height="14" rx="2" />
        <path d="M3 8h18M8 21h8" />
      </svg>
    ),
  },
  {
    num: "02",
    title: "Mobile apps",
    body: "iOS and Android from one codebase, with offline mode, push notifications and store submission handled.",
    tags: ["React Native", "Flutter", "App Store"],
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
        <rect x="7" y="2" width="10" height="20" rx="2.5" />
        <path d="M11 18h2" />
      </svg>
    ),
  },
  {
    num: "03",
    title: "Custom ERP & CRM",
    body: "Systems shaped around how your team works: inventory, billing, scheduling, clinics, sales pipelines.",
    tags: ["Multi-tenant", "Permissions", "Reports"],
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
        <path d="M4 6h16M4 12h16M4 18h10" />
        <circle cx="19" cy="18" r="2" />
      </svg>
    ),
  },
  {
    num: "04",
    title: "AI integrations",
    body: "Assistants, document processing, smart search and AI agents wired into your own data, with guardrails.",
    tags: ["LLM APIs", "RAG", "Agents"],
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
        <path d="M12 3l1.8 4.6L18.5 9l-4.7 1.4L12 15l-1.8-4.6L5.5 9l4.7-1.4z" />
      </svg>
    ),
  },
  {
    num: "05",
    title: "Automation",
    body: "Connect CRM, payments, email and calendar so data moves on its own and nobody copies rows by hand.",
    tags: ["Webhooks", "Stripe", "Google", "Zoom"],
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
        <circle cx="6" cy="6" r="2.5" />
        <circle cx="18" cy="18" r="2.5" />
        <path d="M8.5 6H14a4 4 0 0 1 4 4v5.5M15.5 18H10a4 4 0 0 1-4-4V8.5" />
      </svg>
    ),
  },
  {
    num: "06",
    title: "Rescue & care",
    body: "Take over a stalled project, fix what is broken, document it and keep it updated month to month.",
    tags: ["Code audit", "Performance", "Security"],
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
        <path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18v3h3l6.3-6.3a4 4 0 0 0 5.4-5.4l-2.6 2.6-2.4-.6-.6-2.4z" />
      </svg>
    ),
  },
];

const PROCESS = [
  {
    when: "30 minutes · free",
    title: "Discovery call",
    body: "We learn the business problem, who will use the product and what success looks like.",
  },
  {
    when: "Within 3 days",
    title: "Scope & quote",
    body: "A written plan with features, milestones and a fixed price or monthly rate. No surprises later.",
  },
  {
    when: "Weekly releases",
    title: "Build in sprints",
    body: "Every week you get a working demo on a staging link, so you can steer while it grows.",
  },
  {
    when: "You own the code",
    title: "Launch & support",
    body: "Deployment, handover docs, and an optional retainer for updates and new features.",
  },
];

const STAGES = ["Find", "Enrich", "Audit", "Reach out", "Reply", "Book"];

const RUNS = [
  {
    name: "Harbor Lane Property Co.",
    place: "Fort Worth, TX",
    q: '"property management in Fort Worth"',
    person: "Owner · email verified",
    audit: "mobile speed 41/100 · no online rental application",
    quote:
      "Hi Dana, I tried applying for one of your Fort Worth rentals on my phone and had to download a PDF form to do it.",
    meet: "Thu 10:00 CT · Zoom",
  },
  {
    name: "Northgate Dental Studio",
    place: "Leeds, UK",
    q: '"dental clinic in Leeds"',
    person: "Practice Manager · verified",
    audit: "no online booking · contact form only",
    quote:
      "Hi Priya, your reviews mention how friendly the team is, but new patients still have to phone to book a check-up.",
    meet: "Tue 14:30 GMT · Zoom",
  },
  {
    name: "Coastline Freight Partners",
    place: "Jacksonville, FL",
    q: '"logistics company in Jacksonville"',
    person: "Operations Director · verified",
    audit: "no shipment tracking page · slow homepage",
    quote:
      "Hi Marcus, customers have to email your team to check where a shipment is. There is no tracking page yet.",
    meet: "Wed 09:30 ET · Zoom",
  },
];

const FAQ = [
  {
    q: "Where is your team, and how do time zones work?",
    a: "We work remotely with clients in North America, the UK, Europe and the Gulf. Every project gets agreed overlap hours for calls, plus async updates the rest of the day.",
  },
  {
    q: "Who owns the code and designs?",
    a: "You do. Code lives in your repository from the first week, and full ownership transfers with final payment.",
  },
  {
    q: "How do payments work?",
    a: "Fixed-price projects are split across milestones, so you pay as working features are delivered. Retainers are billed monthly in advance.",
  },
  {
    q: "Can you take over an existing project?",
    a: "Yes. We start with a short code audit, tell you plainly what state it is in, then propose a plan to stabilize and continue it.",
  },
  {
    q: "Will you sign an NDA?",
    a: "Yes, before the discovery call if you prefer.",
  },
  {
    q: "Can I use Delvix Autopilot for my business?",
    a: "It is in early access for a small group of agencies and freelancers. Request access in the Autopilot section — or sign in if you already have an account.",
  },
];

const NEED_OPTIONS = [
  "Web app",
  "Mobile app",
  "ERP / CRM",
  "AI integration",
  "Automation",
  "Take over a project",
];

const LOGO_SVG = (
  <svg viewBox="0 0 32 32" aria-hidden>
    <rect x="1" y="1" width="30" height="30" rx="9" fill="#EAF0FA" />
    <path
      d="M10 8h6.5a8 8 0 0 1 0 16H10z"
      fill="none"
      stroke="#060A13"
      strokeWidth="2.6"
    />
    <g className="spin">
      <circle cx="24" cy="8" r="2.6" fill="#FF6A3D" />
    </g>
  </svg>
);

type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  tx?: number;
  ty?: number;
  c: string;
  s: number;
  dust?: boolean;
};

function LogoMark({ href = "#top" }: { href?: string }) {
  return (
    <a className="logo" href={href} aria-label="Delvix Studio home">
      {LOGO_SVG}
      <span>
        Delvix<small>Studio</small>
      </span>
    </a>
  );
}

export function DelvixLanding() {
  const [motion, setMotion] = useState(true);
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [rotIndex, setRotIndex] = useState(0);
  const [prevRot, setPrevRot] = useState<number | null>(null);
  const [hsProgress, setHsProgress] = useState(0);
  const [tlProgress, setTlProgress] = useState(0);
  const [litSteps, setLitSteps] = useState(0);
  const [giantFill, setGiantFill] = useState(0);
  const [activeNode, setActiveNode] = useState(0);
  const [doneNodes, setDoneNodes] = useState(0);
  const [runIndex, setRunIndex] = useState(0);
  const [lineStates, setLineStates] = useState<Array<"off" | "working" | "on">>(
    () => Array(6).fill("off")
  );
  const [quote, setQuote] = useState("");
  const [quoting, setQuoting] = useState(false);
  const [wlEmail, setWlEmail] = useState("");
  const [wlNote, setWlNote] = useState(
    "Early access is opening to a small group of agencies and freelancers."
  );
  const [formMsg, setFormMsg] = useState("Takes about two minutes.");
  const [formErr, setFormErr] = useState(false);
  const [briefText, setBriefText] = useState<string | null>(null);
  const [hotChars, setHotChars] = useState<Set<number>>(new Set());
  const [year] = useState(() => new Date().getFullYear());

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const heroRef = useRef<HTMLDivElement>(null);
  const hsRef = useRef<HTMLDivElement>(null);
  const timelineRef = useRef<HTMLDivElement>(null);
  const giantRef = useRef<HTMLDivElement>(null);
  const motionRef = useRef(motion);
  const partsRef = useRef<Particle[]>([]);
  const mouseRef = useRef({ x: -9999, y: -9999, r: 110 });
  const sizeRef = useRef({ w: 0, h: 0 });
  const rafRef = useRef(0);

  motionRef.current = motion;

  useEffect(() => {
    try {
      const pref = localStorage.getItem("delvix-motion");
      if (pref === "off") setMotion(false);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (!motion) return;
    const id = window.setInterval(() => {
      setRotIndex((i) => {
        setPrevRot(i);
        return (i + 1) % ROT_WORDS.length;
      });
    }, 2200);
    return () => clearInterval(id);
  }, [motion]);

  useEffect(() => {
    if (prevRot === null) return;
    const t = window.setTimeout(() => setPrevRot(null), 750);
    return () => clearTimeout(t);
  }, [prevRot]);

  const buildParticles = useCallback(() => {
    const cv = canvasRef.current;
    if (!cv) return;
    const ctx = cv.getContext("2d");
    if (!ctx) return;
    const r = cv.getBoundingClientRect();
    const W = r.width;
    const H = r.height;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    sizeRef.current = { w: W, h: H };
    cv.width = W * dpr;
    cv.height = H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const off = document.createElement("canvas");
    off.width = W;
    off.height = H;
    const o = off.getContext("2d");
    if (!o) return;
    const fs = Math.min(W * 0.24, H * 0.42, 330);
    o.fillStyle = "#fff";
    o.textAlign = "center";
    o.textBaseline = "middle";
    o.font = `800 ${fs}px "Bricolage Grotesque", system-ui, sans-serif`;
    const cy = W < 900 ? H * 0.2 : H * 0.36;
    o.fillText("delvix", W / 2, cy);
    const data = o.getImageData(0, 0, W, H).data;
    const gap = W < 600 ? 5 : W < 1100 ? 6 : 7;
    const targets: Array<[number, number]> = [];
    for (let y = 0; y < H; y += gap) {
      for (let x = 0; x < W; x += gap) {
        if (data[(y * W + x) * 4 + 3] > 128) targets.push([x, y]);
      }
    }
    const palette = ["#EAF0FA", "#EAF0FA", "#8E9CFF", "#5B6EFF", "#5B6EFF", "#FF6A3D"];
    const old = partsRef.current;
    const next: Particle[] = [];
    for (let i = 0; i < targets.length; i++) {
      const p = old[i] || {
        x: Math.random() * W,
        y: Math.random() * H,
        vx: 0,
        vy: 0,
        c: palette[0],
        s: 1,
      };
      p.tx = targets[i][0];
      p.ty = targets[i][1];
      p.c = palette[(i * 7) % palette.length];
      p.s = Math.random() * 1.1 + 1.1;
      if (!motionRef.current) {
        p.x = p.tx;
        p.y = p.ty;
      }
      next.push(p);
    }
    for (let k = 0; k < Math.round(W / 14); k++) {
      next.push({
        x: Math.random() * W,
        y: Math.random() * H,
        vx: (Math.random() - 0.5) * 0.3,
        vy: (Math.random() - 0.5) * 0.3,
        dust: true,
        c: "#2A3A5E",
        s: 1.2,
      });
    }
    partsRef.current = next;
  }, []);

  useEffect(() => {
    const cv = canvasRef.current;
    if (!cv) return;
    let cancelled = false;

    const scatter = (cx: number, cy: number, power: number) => {
      for (const p of partsRef.current) {
        if (p.dust) continue;
        const dx = p.x - cx;
        const dy = p.y - cy;
        const d = Math.sqrt(dx * dx + dy * dy) || 1;
        const f = power * (0.6 + Math.random());
        p.vx += (dx / d) * f;
        p.vy += (dy / d) * f;
      }
    };

    const draw = () => {
      if (cancelled) return;
      const ctx = cv.getContext("2d");
      if (!ctx) return;
      const { w: W, h: H } = sizeRef.current;
      ctx.clearRect(0, 0, W, H);
      const mouse = mouseRef.current;
      const moving = motionRef.current;
      for (const p of partsRef.current) {
        if (moving) {
          if (p.dust) {
            p.x += p.vx;
            p.y += p.vy;
            if (p.x < 0 || p.x > W) p.vx *= -1;
            if (p.y < 0 || p.y > H) p.vy *= -1;
          } else {
            const dx = p.x - mouse.x;
            const dy = p.y - mouse.y;
            const d2 = dx * dx + dy * dy;
            const rr = mouse.r * mouse.r;
            if (d2 < rr) {
              const f = ((rr - d2) / rr) * 5.2;
              const d = Math.sqrt(d2) || 1;
              p.vx += (dx / d) * f;
              p.vy += (dy / d) * f;
            }
            p.vx += ((p.tx ?? p.x) - p.x) * 0.045;
            p.vy += ((p.ty ?? p.y) - p.y) * 0.045;
            p.vx *= 0.82;
            p.vy *= 0.82;
            p.x += p.vx;
            p.y += p.vy;
          }
        }
        ctx.fillStyle = p.c;
        ctx.fillRect(p.x, p.y, p.s, p.s);
      }
      if (moving) rafRef.current = requestAnimationFrame(draw);
    };

    const start = () => {
      if (cancelled) return;
      buildParticles();
      draw();
    };

    if (document.fonts?.load) {
      document.fonts.load('800 100px "Bricolage Grotesque"').then(start, start);
    } else {
      start();
    }

    const hero = heroRef.current;
    const onMove = (e: PointerEvent) => {
      const rect = cv.getBoundingClientRect();
      mouseRef.current.x = e.clientX - rect.left;
      mouseRef.current.y = e.clientY - rect.top;
    };
    const onLeave = () => {
      mouseRef.current.x = mouseRef.current.y = -9999;
    };
    const onClick = (e: MouseEvent) => {
      if ((e.target as Element).closest("a,button")) return;
      const rect = cv.getBoundingClientRect();
      scatter(e.clientX - rect.left, e.clientY - rect.top, 26);
    };

    hero?.addEventListener("pointermove", onMove);
    hero?.addEventListener("pointerleave", onLeave);
    hero?.addEventListener("click", onClick);

    const scatterId = window.setInterval(() => {
      if (!motionRef.current) return;
      const { w: W, h: H } = sizeRef.current;
      if (window.scrollY < H) scatter(W / 2, H * 0.36, 9);
    }, 7000);

    let rt: number;
    const onResize = () => {
      clearTimeout(rt);
      rt = window.setTimeout(() => {
        buildParticles();
        if (!motionRef.current) draw();
      }, 200);
    };
    window.addEventListener("resize", onResize);

    return () => {
      cancelled = true;
      cancelAnimationFrame(rafRef.current);
      clearInterval(scatterId);
      clearTimeout(rt);
      hero?.removeEventListener("pointermove", onMove);
      hero?.removeEventListener("pointerleave", onLeave);
      hero?.removeEventListener("click", onClick);
      window.removeEventListener("resize", onResize);
    };
  }, [buildParticles, motion]);

  useEffect(() => {
    const hs = hsRef.current;
    if (!hs) return;
    const onScroll = () => {
      const max = hs.scrollWidth - hs.clientWidth;
      setHsProgress(max > 0 ? hs.scrollLeft / max : 0);
    };
    hs.addEventListener("scroll", onScroll, { passive: true });
    return () => hs.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const onScroll = () => {
      const tl = timelineRef.current;
      if (tl) {
        const rect = tl.getBoundingClientRect();
        const view = window.innerHeight * 0.65;
        const start = rect.top;
        const end = rect.bottom - view;
        const span = Math.max(rect.height - view, 1);
        const p = Math.min(1, Math.max(0, (view - start) / span));
        setTlProgress(motion ? p : 1);
        const steps = PROCESS.length;
        setLitSteps(Math.min(steps, Math.floor(p * steps) + 1));
      }
      const giant = giantRef.current;
      if (giant) {
        const rect = giant.getBoundingClientRect();
        const p = Math.min(
          1,
          Math.max(0, (window.innerHeight - rect.top) / (window.innerHeight * 0.8))
        );
        setGiantFill(motion ? p : 1);
      }
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, [motion]);

  useEffect(() => {
    if (!motion) {
      setLineStates(Array(6).fill("on"));
      setQuote(RUNS[0].quote);
      setActiveNode(5);
      setDoneNodes(5);
      setQuoting(false);
      return;
    }

    let cancelled = false;
    let run = 0;
    let timers: number[] = [];

    const clearTimers = () => {
      timers.forEach(clearTimeout);
      timers = [];
    };

    const typeQuote = (text: string, done: () => void) => {
      setQuoting(true);
      setQuote("");
      let i = 0;
      const tick = () => {
        if (cancelled) return;
        i += 1;
        setQuote(text.slice(0, i));
        if (i < text.length) {
          timers.push(window.setTimeout(tick, 18 + Math.random() * 22));
        } else {
          setQuoting(false);
          done();
        }
      };
      tick();
    };

    const play = () => {
      if (cancelled) return;
      clearTimers();
      const r = RUNS[run];
      setRunIndex(run);
      setLineStates(Array(6).fill("off"));
      setQuote("");
      setQuoting(false);
      setActiveNode(-1);
      setDoneNodes(0);

      const stageMap = [0, 1, 2, 3, 4, 5];
      let step = 0;

      const nextLine = () => {
        if (cancelled) return;
        if (step >= 6) {
          timers.push(
            window.setTimeout(() => {
              run = (run + 1) % RUNS.length;
              play();
            }, 3200)
          );
          return;
        }
        setLineStates((prev) => {
          const n = [...prev];
          n[step] = "working";
          return n;
        });
        setActiveNode(stageMap[step]);
        setDoneNodes(step);

        timers.push(
          window.setTimeout(() => {
            setLineStates((prev) => {
              const n = [...prev];
              n[step] = "on";
              return n;
            });
            if (step === 3) {
              typeQuote(r.quote, () => {
                step += 1;
                nextLine();
              });
            } else {
              step += 1;
              timers.push(window.setTimeout(nextLine, 700));
            }
          }, 900)
        );
      };
      nextLine();
    };

    play();
    return () => {
      cancelled = true;
      clearTimers();
    };
  }, [motion]);

  const toggleMotion = () => {
    const next = !motion;
    setMotion(next);
    try {
      localStorage.setItem("delvix-motion", next ? "on" : "off");
    } catch {
      /* ignore */
    }
  };

  const copyEmail = async () => {
    try {
      await navigator.clipboard.writeText("hello@delvixstudio.com");
    } catch {
      /* ignore */
    }
  };

  const onWaitlist = (e: FormEvent) => {
    e.preventDefault();
    const email = wlEmail.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setWlNote("Please enter a valid work email.");
      return;
    }
    const subject = encodeURIComponent("Delvix Autopilot early access");
    const body = encodeURIComponent(
      `Hi Delvix,\n\nI'd like early access to Delvix Autopilot.\n\nWork email: ${email}\n`
    );
    window.location.href = `mailto:hello@delvixstudio.com?subject=${subject}&body=${body}`;
    setWlNote("Opening your email client — we'll reply soon.");
  };

  const onBrief = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const name = String(fd.get("name") || "").trim();
    const email = String(fd.get("email") || "").trim();
    const company = String(fd.get("company") || "").trim();
    const budget = String(fd.get("budget") || "");
    const when = String(fd.get("when") || "");
    const msg = String(fd.get("msg") || "").trim();
    const needs = NEED_OPTIONS.filter((opt) => fd.get(`need-${opt}`));

    if (!name || !email || !msg) {
      setFormErr(true);
      setFormMsg("Name, email, and project details are required.");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setFormErr(true);
      setFormMsg("Please enter a valid work email.");
      return;
    }

    const text = [
      `Project brief — Delvix Studio`,
      ``,
      `Name: ${name}`,
      `Email: ${email}`,
      `Company / website: ${company || "—"}`,
      `Needs: ${needs.length ? needs.join(", ") : "—"}`,
      `Budget: ${budget || "—"}`,
      `Ideal start: ${when || "—"}`,
      ``,
      `Details:`,
      msg,
    ].join("\n");

    setBriefText(text);
    setFormErr(false);
    setFormMsg("Your brief is ready — copy and send it.");
  };

  const copyBrief = async () => {
    if (!briefText) return;
    try {
      await navigator.clipboard.writeText(briefText);
      setFormMsg("Brief copied. Paste it into an email to hello@delvixstudio.com.");
      setFormErr(false);
    } catch {
      setFormMsg("Could not copy — select the text manually.");
      setFormErr(true);
    }
  };

  const bigline = "Let's build it.";
  const run = RUNS[runIndex];

  const closeMenu = () => setMenuOpen(false);

  return (
    <div className={`dvx${motion ? "" : " still"}`}>
      <div className="grain" aria-hidden />

      <header className={`nav${scrolled ? " scrolled" : ""}${menuOpen ? " open" : ""}`}>
        <div className="wrap">
          <div className="nav-in">
            <LogoMark />
            <nav className="nav-links" aria-label="Main">
              <a href="#services">Services</a>
              <a href="#process">Process</a>
              <a href="#autopilot">Autopilot</a>
              <a href="#engage">Engagement</a>
              <a href="#faq">FAQ</a>
            </nav>
            <div className="nav-right">
              <button
                className="motion-tg"
                type="button"
                aria-pressed={motion}
                onClick={toggleMotion}
              >
                <i />
                <span>{motion ? "Motion on" : "Motion off"}</span>
              </button>
              <Link href="/login" className="btn btn-ghost login-desktop">
                Log in
              </Link>
              <a className="btn btn-primary" href="#contact">
                Start a project <span className="arr">→</span>
              </a>
              <button
                className="menu-btn"
                type="button"
                aria-label="Open menu"
                aria-expanded={menuOpen}
                onClick={() => setMenuOpen((o) => !o)}
              >
                <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden>
                  <path
                    d="M2 5h14M2 13h14"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                  />
                </svg>
              </button>
            </div>
          </div>
          <div className={`mobile-menu${menuOpen ? " open" : ""}`}>
            <a href="#services" onClick={closeMenu}>
              Services
            </a>
            <a href="#process" onClick={closeMenu}>
              Process
            </a>
            <a href="#autopilot" onClick={closeMenu}>
              Autopilot
            </a>
            <a href="#engage" onClick={closeMenu}>
              Engagement
            </a>
            <a href="#faq" onClick={closeMenu}>
              FAQ
            </a>
            <Link href="/login" onClick={closeMenu}>
              Log in →
            </Link>
            <a href="#contact" onClick={closeMenu}>
              Start a project →
            </a>
          </div>
        </div>
      </header>

      <main id="top">
        <div className="hero" id="hero" ref={heroRef}>
          <div className="hero-glow" aria-hidden />
          <canvas id="particles" ref={canvasRef} aria-hidden />
          <div className="hero-hint" aria-hidden>
            Move your cursor through the logo · click to scatter
          </div>
          <div className="wrap">
            <div className="hero-bottom">
              <div>
                <span className="eyebrow">Software studio · Remote, worldwide</span>
                <h1>
                  We build the{" "}
                  <span className="rot" aria-live="polite">
                    {ROT_WORDS.map((w, i) => (
                      <span
                        key={w}
                        className={
                          i === rotIndex ? "on" : i === prevRot ? "out" : undefined
                        }
                      >
                        {w}
                      </span>
                    ))}
                  </span>
                  <br />
                  your business runs on.
                </h1>
              </div>
              <div className="hero-side">
                <p className="lede">
                  Delvix Studio designs and ships web apps, mobile apps, custom ERP
                  and CRM systems, and AI integrations. Fixed scope, a working demo
                  every week, and code you own.
                </p>
                <div className="hero-actions">
                  <a className="btn btn-primary" href="#contact">
                    Book a free call <span className="arr">→</span>
                  </a>
                  <a className="btn btn-ghost" href="#autopilot">
                    See Autopilot
                  </a>
                </div>
                <div className="hero-meta">
                  <span>
                    <i />
                    Taking new projects
                  </span>
                  <span>US · UK · EU · Gulf hours</span>
                </div>
              </div>
            </div>
            <div className="scroll-cue">
              <b />
              Scroll
            </div>
          </div>
        </div>

        <div className="marquee" aria-hidden>
          <div className="mrow">
            {[...MARQUEE_A, ...MARQUEE_A].map((t, i) => (
              <span key={`a-${i}`}>{t}</span>
            ))}
          </div>
          <div className="mrow alt">
            {[...MARQUEE_B, ...MARQUEE_B].map((t, i) => (
              <span key={`b-${i}`}>{t}</span>
            ))}
          </div>
        </div>

        <section id="services" style={{ paddingBottom: "clamp(60px,8vw,100px)" }}>
          <div className="wrap">
            <div className="sec-head">
              <div>
                <span className="eyebrow">What we build</span>
                <h2>One studio for the systems behind your business.</h2>
              </div>
              <p className="lede">
                From a first MVP to replacing the spreadsheets your operations run
                on. Scroll through what we do.
              </p>
            </div>
          </div>
          <div className="hs" ref={hsRef}>
            <div className="hs-track">
              {SERVICES.map((s) => (
                <article className="panel" key={s.num}>
                  <span className="num">{s.num}</span>
                  <span className="ico">{s.icon}</span>
                  <h3>{s.title}</h3>
                  <p>{s.body}</p>
                  <div className="tags">
                    {s.tags.map((t) => (
                      <span key={t}>{t}</span>
                    ))}
                  </div>
                </article>
              ))}
              <article className="panel cta-panel">
                <div>
                  <span className="eyebrow" style={{ color: "#fff" }}>
                    Next step
                  </span>
                  <h3 style={{ marginTop: 18 }}>Have something in mind?</h3>
                </div>
                <p>
                  Tell us what you want to build. You get a written scope and quote
                  within three days.
                </p>
                <a className="btn" href="#contact">
                  Start a project <span className="arr">→</span>
                </a>
              </article>
            </div>
            <div
              className="hs-progress"
              style={{ ["--hs-progress" as string]: String(hsProgress) }}
            >
              <i />
            </div>
          </div>
        </section>

        <section id="process">
          <div className="wrap process-grid">
            <div className="process-sticky">
              <span className="eyebrow">How a project runs</span>
              <h2>Clear scope first. A demo every week.</h2>
              <p className="lede">
                You always know what is being built, what it costs and when it
                lands.
              </p>
            </div>
            <div className="timeline" ref={timelineRef}>
              <div
                className="tl-line"
                style={{ ["--tl-progress" as string]: String(tlProgress) }}
              >
                <i />
              </div>
              {PROCESS.map((step, i) => (
                <div
                  className={`tstep${i < litSteps ? " lit" : ""}`}
                  key={step.title}
                >
                  <span className="dot">{String(i + 1).padStart(2, "0")}</span>
                  <span className="when">{step.when}</span>
                  <h3>{step.title}</h3>
                  <p>{step.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="ap" id="autopilot">
          <div className="wrap">
            <div className="sec-head">
              <div>
                <span className="badge">Our product · Early access</span>
                <h2 style={{ marginTop: 20 }}>
                  Delvix Autopilot finds the clients. <em>You take the call.</em>
                </h2>
              </div>
              <p className="lede">
                The client-acquisition engine we built for our own studio. It finds
                businesses that fit, studies their website, writes a personal first
                email, answers replies and books the meeting.
              </p>
            </div>

            <div className="engine">
              <div className="orbit" aria-label="Six stages of Delvix Autopilot">
                <svg viewBox="0 0 520 520" role="img">
                  <title>Find, Enrich, Audit, Reach out, Reply, Book</title>
                  <defs>
                    <linearGradient id="flowGrad" x1="0" x2="1">
                      <stop offset="0" stopColor="#5B6EFF" stopOpacity="0" />
                      <stop offset="1" stopColor="#FF6A3D" />
                    </linearGradient>
                  </defs>
                  <circle className="ring2" cx="260" cy="260" r="240" />
                  <circle className="ring" cx="260" cy="260" r="200" />
                  <circle
                    className="flow"
                    cx="260"
                    cy="260"
                    r="200"
                    transform="rotate(-90 260 260)"
                  />
                  <g className="core">
                    <circle className="pulse" cx="260" cy="260" r="70" />
                    <circle cx="260" cy="260" r="70" />
                    <text x="260" y="256" fontSize="26">
                      Autopilot
                    </text>
                    <text className="sub" x="260" y="280">
                      runs 24/7
                    </text>
                  </g>
                  {STAGES.map((s, i) => {
                    const a = -Math.PI / 2 + i * ((Math.PI * 2) / STAGES.length);
                    const x = 260 + 200 * Math.cos(a);
                    const y = 260 + 200 * Math.sin(a);
                    const cls =
                      i === activeNode
                        ? "node on"
                        : i < doneNodes
                          ? "node done"
                          : "node";
                    return (
                      <g className={cls} key={s}>
                        <circle cx={x} cy={y} r={30} />
                        <text x={x} y={y + 4}>
                          {s}
                        </text>
                        <text className="nn" x={x} y={y > 260 ? y + 50 : y - 42}>
                          0{i + 1}
                        </text>
                      </g>
                    );
                  })}
                </svg>
              </div>

              <div
                className="console"
                aria-label="Sample Autopilot run with example data"
              >
                <div className="console-top">
                  <div className="dots">
                    <b />
                    <b />
                    <b />
                  </div>
                  <span className="console-title">delvix-autopilot · sample run</span>
                  <span className="live">Running</span>
                </div>
                <div className="console-body">
                  <div className="c-target">
                    <strong>{run.name}</strong>
                    <span>{run.place}</span>
                  </div>
                  {(
                    [
                      <>
                        Found <em>via Google ·</em> {run.q}
                      </>,
                      <>
                        Decision-maker <em>·</em> {run.person}
                      </>,
                      <>
                        Site audit <em>·</em> {run.audit}
                      </>,
                      <>
                        Personal email <em>· sent 9:12 local time</em>
                      </>,
                      <>
                        AI reply <em>·</em> answered pricing question
                      </>,
                      <>
                        Call booked <em>·</em> {run.meet}
                      </>,
                    ] as ReactNode[]
                  ).map((label, i) => (
                    <div
                      key={i}
                      className={`c-line${
                        lineStates[i] === "on"
                          ? " on"
                          : lineStates[i] === "working"
                            ? " working"
                            : ""
                      }`}
                    >
                      <span className="ic" />
                      <span>{label}</span>
                    </div>
                  ))}
                  <div className="c-quote">
                    {quote}
                    {quoting ? <span className="caret" /> : null}
                  </div>
                  <div className="c-foot">
                    <span>Example data</span>
                    <span>
                      run {runIndex + 1} of {RUNS.length}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="feats">
              <div className="feat">
                <h3>Every pitch is specific</h3>
                <p>
                  Emails open with a real observation about the prospect&apos;s own
                  website, so they read like a person wrote them.
                </p>
              </div>
              <div className="feat">
                <h3>Safe by default</h3>
                <p>
                  Approval queue, sending limits, bounce protection, unsubscribe
                  handling and a kill switch on every channel.
                </p>
              </div>
              <div className="feat">
                <h3>Meta and LinkedIn too</h3>
                <p>
                  Facebook and Instagram lead forms flow straight in, and LinkedIn
                  messages are drafted for you to send.
                </p>
              </div>
            </div>

            <form className="waitlist" onSubmit={onWaitlist} noValidate>
              <label htmlFor="wlEmail" style={{ position: "absolute", left: -9999 }}>
                Work email
              </label>
              <input
                id="wlEmail"
                type="email"
                placeholder="Your work email"
                autoComplete="email"
                value={wlEmail}
                onChange={(e) => setWlEmail(e.target.value)}
              />
              <button className="btn btn-primary" type="submit">
                Request early access <span className="arr">→</span>
              </button>
              <span className="wl-note">
                {wlNote}{" "}
                <Link href="/login">Already have access? Log in</Link>
              </span>
            </form>
          </div>
        </section>

        <section id="engage">
          <div className="wrap">
            <div className="sec-head">
              <div>
                <span className="eyebrow">Ways to work together</span>
                <h2>Pick the model that fits the work.</h2>
              </div>
              <p className="lede">
                Every engagement starts with a free call and a written scope.
                Pricing is quoted per project.
              </p>
            </div>
            <div className="models">
              <article className="model">
                <span className="tag">Fixed price</span>
                <h3>Project build</h3>
                <p>A defined product delivered for an agreed price and timeline.</p>
                <ul>
                  <li>Written scope and milestones</li>
                  <li>Weekly demo links</li>
                  <li>30 days of post-launch fixes</li>
                </ul>
                <div className="best">
                  <b>Best for:</b> MVPs, apps, websites, a new internal tool
                </div>
              </article>
              <article className="model hl">
                <span className="tag">Monthly</span>
                <h3>Product retainer</h3>
                <p>Reserved studio time every month for ongoing work.</p>
                <ul>
                  <li>Roadmap planned with you monthly</li>
                  <li>Priority fixes and updates</li>
                  <li>Pause or adjust with notice</li>
                </ul>
                <div className="best">
                  <b>Best for:</b> growing products and ERP/CRM systems in use
                </div>
              </article>
              <article className="model">
                <span className="tag">Full time</span>
                <h3>Dedicated developer</h3>
                <p>A developer from our team working inside your process.</p>
                <ul>
                  <li>Your standups and your tools</li>
                  <li>Time-zone overlap agreed upfront</li>
                  <li>Studio support behind them</li>
                </ul>
                <div className="best">
                  <b>Best for:</b> agencies and teams that need capacity
                </div>
              </article>
            </div>
          </div>
        </section>

        <section id="faq" style={{ paddingTop: 0 }}>
          <div className="wrap faq-grid">
            <div>
              <span className="eyebrow">Questions</span>
              <h2
                style={{
                  fontSize: "clamp(2.2rem,5vw,4rem)",
                  fontWeight: 800,
                  marginTop: 16,
                }}
              >
                Before you get in touch.
              </h2>
            </div>
            <div className="faq">
              {FAQ.map((item) => (
                <details key={item.q}>
                  <summary>
                    {item.q}
                    <span className="pm" />
                  </summary>
                  <p className="ans">{item.a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        <div className="bigcta" id="bigcta">
          <div className="wrap">
            <div
              className="bigline"
              aria-label="Let's build it."
              onMouseMove={(e) => {
                if (!motion) return;
                const el = e.currentTarget;
                const chars = el.querySelectorAll(".ch");
                const next = new Set<number>();
                chars.forEach((ch, i) => {
                  const r = ch.getBoundingClientRect();
                  const cx = r.left + r.width / 2;
                  const cy = r.top + r.height / 2;
                  const d = Math.hypot(e.clientX - cx, e.clientY - cy);
                  if (d < 80) next.add(i);
                });
                setHotChars(next);
              }}
              onMouseLeave={() => setHotChars(new Set())}
            >
              {bigline.split("").map((ch, i) =>
                ch === " " ? (
                  <span key={i}> </span>
                ) : ch === "." ? (
                  <span key={i} className="dotc">
                    .
                  </span>
                ) : (
                  <span
                    key={i}
                    className={`ch${hotChars.has(i) ? " hot" : ""}`}
                  >
                    {ch}
                  </span>
                )
              )}
            </div>
            <div className="bigcta-row">
              <p className="lede">
                A free 30-minute call. A written scope in three days. Weekly demos
                after that.
              </p>
              <a className="btn btn-primary" href="#contact">
                Tell us your idea <span className="arr">→</span>
              </a>
            </div>
          </div>
        </div>

        <section
          className="contact"
          id="contact"
          style={{ paddingTop: "clamp(40px,6vw,70px)" }}
        >
          <div className="wrap contact-grid">
            <div>
              <span className="eyebrow">Start a project</span>
              <h2>Tell us what you want to build.</h2>
              <p className="lede">
                Share a few details and we will reply within one business day.
              </p>
              <div className="mailbox">
                <code>hello@delvixstudio.com</code>
                <button className="copy" type="button" onClick={copyEmail}>
                  Copy email
                </button>
              </div>
              <div className="c-points">
                <div>
                  <b>01</b>
                  <span>A short reply with clarifying questions</span>
                </div>
                <div>
                  <b>02</b>
                  <span>A 30-minute discovery call at a time that suits you</span>
                </div>
                <div>
                  <b>03</b>
                  <span>A written scope and quote within 3 days</span>
                </div>
              </div>
            </div>
            <form className="brief" onSubmit={onBrief} noValidate>
              <div className="field">
                <label htmlFor="fName">Your name</label>
                <input
                  id="fName"
                  name="name"
                  autoComplete="name"
                  placeholder="Jordan Ellis"
                />
              </div>
              <div className="field">
                <label htmlFor="fEmail">Work email</label>
                <input
                  id="fEmail"
                  name="email"
                  type="email"
                  autoComplete="email"
                  placeholder="jordan@company.com"
                />
              </div>
              <div className="field full">
                <label htmlFor="fCompany">Company and website</label>
                <input
                  id="fCompany"
                  name="company"
                  placeholder="Company name, company.com"
                />
              </div>
              <div className="field full">
                <span className="lbl">What do you need?</span>
                <div className="chips">
                  {NEED_OPTIONS.map((opt) => (
                    <label key={opt}>
                      <input type="checkbox" name={`need-${opt}`} value={opt} />
                      {opt}
                    </label>
                  ))}
                </div>
              </div>
              <div className="field">
                <label htmlFor="fBudget">Budget range</label>
                <select id="fBudget" name="budget" defaultValue="">
                  <option value="">Select a range</option>
                  <option>Under $5,000</option>
                  <option>$5,000 – $15,000</option>
                  <option>$15,000 – $50,000</option>
                  <option>$50,000+</option>
                  <option>Monthly retainer</option>
                  <option>Not sure yet</option>
                </select>
              </div>
              <div className="field">
                <label htmlFor="fWhen">Ideal start</label>
                <select id="fWhen" name="when" defaultValue="">
                  <option value="">Select timing</option>
                  <option>As soon as possible</option>
                  <option>Within a month</option>
                  <option>In 1–3 months</option>
                  <option>Just exploring</option>
                </select>
              </div>
              <div className="field full">
                <label htmlFor="fMsg">Project details</label>
                <textarea
                  id="fMsg"
                  name="msg"
                  placeholder="What are you building, who will use it, and what problem does it solve?"
                />
              </div>
              <div className="form-foot">
                <span className={`form-msg${formErr ? " err" : ""}`}>{formMsg}</span>
                <button className="btn btn-primary" type="submit">
                  Prepare my brief <span className="arr">→</span>
                </button>
              </div>
              {briefText ? (
                <div className="done-panel">
                  <strong>Your brief is ready.</strong> Copy it and send it to
                  hello@delvixstudio.com.
                  <pre>{briefText}</pre>
                  <button className="copy" type="button" onClick={copyBrief}>
                    Copy brief
                  </button>
                </div>
              ) : null}
            </form>
          </div>
        </section>
      </main>

      <footer>
        <div className="wrap">
          <div className="foot">
            <LogoMark />
            <div className="foot-links">
              <a href="#services">Services</a>
              <a href="#process">Process</a>
              <a href="#autopilot">Delvix Autopilot</a>
              <a href="#engage">Engagement</a>
              <a href="#contact">Contact</a>
              <Link href="/login">Log in</Link>
              <Link href="/privacy">Privacy</Link>
            </div>
          </div>
          <div
            className="giant"
            ref={giantRef}
            style={{ ["--fill" as string]: `${giantFill * 100}%` }}
            aria-hidden
          >
            delvix
          </div>
          <div className="foot-bottom">
            <span>
              © {year} Delvix Studio · delvixstudio.com
            </span>
            <span>hello@delvixstudio.com</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
