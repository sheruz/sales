import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dir = path.join(__dirname, "../public/marketing/illustrations");
fs.mkdirSync(dir, { recursive: true });

const bg = "#0B1220";
const panel = "#141C2E";
const panel2 = "#1A2438";
const line = "#243044";
const accent = "#5B63F5";
const accent2 = "#8E9CFF";
const muted = "#9AA6BF";
const ink = "#EEF2FF";
const warm = "#FF6B3D";

function svg(w, h, body, label) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" role="img" aria-label="${label}">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${accent}" stop-opacity="0.18"/>
      <stop offset="100%" stop-color="${warm}" stop-opacity="0.08"/>
    </linearGradient>
  </defs>
  <rect width="${w}" height="${h}" fill="${bg}"/>
  <rect width="${w}" height="${h}" fill="url(#g)"/>
${body}
</svg>`;
}

const card = (x, y, w, h, rx = 12) =>
  `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" fill="${panel}" stroke="${line}"/>`;
const soft = (x, y, w, h, rx = 10) =>
  `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" fill="${panel2}"/>`;
const bar = (x, y, w, h = 8, c = accent) =>
  `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="4" fill="${c}"/>`;
const txt = (x, y, t, size = 18, c = ink, weight = 600) =>
  `<text x="${x}" y="${y}" fill="${c}" font-family="system-ui,sans-serif" font-size="${size}" font-weight="${weight}">${t}</text>`;
const pill = (x, y, w, h, c = accent) =>
  `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${h / 2}" fill="${c}"/>`;

const arts = {
  "web-dashboard": svg(
    1200,
    750,
    [
      card(40, 40, 220, 670),
      soft(70, 80, 160, 36),
      soft(70, 140, 160, 28),
      soft(70, 186, 160, 28),
      soft(70, 232, 160, 28),
      soft(70, 278, 160, 28),
      pill(70, 620, 160, 36, accent),
      card(290, 40, 870, 120),
      txt(320, 90, "Operations console", 28, ink, 700),
      txt(320, 128, "Jobs · customers · approvals in one place", 18, muted, 500),
      card(290, 190, 280, 160),
      card(590, 190, 280, 160),
      card(890, 190, 270, 160),
      txt(320, 230, "Open jobs", 16, muted),
      txt(320, 275, "128", 42, accent2, 800),
      txt(620, 230, "Awaiting review", 16, muted),
      txt(620, 275, "14", 42, warm, 800),
      txt(920, 230, "SLA on track", 16, muted),
      txt(920, 275, "96%", 42, accent2, 800),
      card(290, 380, 870, 330),
      soft(320, 420, 810, 48),
      soft(320, 490, 810, 48),
      soft(320, 560, 810, 48),
      soft(320, 630, 810, 48),
      bar(340, 436, 180, 16, accent),
      bar(340, 506, 140, 16, accent2),
      bar(340, 576, 220, 16, warm),
      bar(340, 646, 160, 16, accent),
    ].join("\n  "),
    "Web application dashboard"
  ),

  "mobile-apps": svg(
    1200,
    750,
    [
      `<rect x="180" y="60" width="320" height="630" rx="42" fill="#0E1524" stroke="${line}" stroke-width="3"/>`,
      `<rect x="200" y="100" width="280" height="540" rx="18" fill="${panel}"/>`,
      soft(220, 130, 240, 90, 16),
      txt(240, 175, "Field check-in", 20, ink, 700),
      soft(220, 250, 240, 70, 14),
      soft(220, 340, 240, 70, 14),
      soft(220, 430, 240, 70, 14),
      pill(220, 540, 240, 44, accent),
      `<rect x="700" y="90" width="320" height="570" rx="42" fill="#0E1524" stroke="${line}" stroke-width="3"/>`,
      `<rect x="720" y="125" width="280" height="490" rx="18" fill="${panel}"/>`,
      soft(740, 155, 240, 120, 16),
      bar(760, 185, 120, 12, accent2),
      bar(760, 215, 200, 10, muted),
      bar(760, 240, 180, 10, muted),
      soft(740, 300, 110, 110, 16),
      soft(870, 300, 110, 110, 16),
      soft(740, 430, 240, 60, 14),
      pill(740, 520, 240, 40, warm),
    ].join("\n  "),
    "Mobile app screens"
  ),

  "erp-board": svg(
    1200,
    750,
    [
      card(40, 40, 1120, 80),
      txt(70, 90, "Inventory · Orders · Fulfillment", 26, ink, 700),
      card(40, 150, 360, 520),
      card(420, 150, 360, 520),
      card(800, 150, 360, 520),
      txt(70, 200, "Incoming", 18, muted),
      txt(450, 200, "In progress", 18, muted),
      txt(830, 200, "Ready", 18, muted),
      soft(70, 240, 300, 90),
      soft(70, 350, 300, 90),
      soft(70, 460, 300, 90),
      soft(450, 240, 300, 90),
      soft(450, 350, 300, 90),
      soft(830, 240, 300, 90),
      soft(830, 350, 300, 90),
      soft(830, 460, 300, 90),
      bar(90, 270, 160, 12, accent),
      bar(470, 270, 140, 12, warm),
      bar(850, 270, 180, 12, accent2),
    ].join("\n  "),
    "ERP operations board"
  ),

  "crm-pipeline": svg(
    1200,
    750,
    [
      card(40, 40, 1120, 80),
      txt(70, 90, "Sales pipeline", 26, ink, 700),
      ...[0, 1, 2, 3].flatMap((i) => {
        const x = 40 + i * 290;
        const labels = ["New", "Qualified", "Proposal", "Won"];
        const colors = [accent, accent2, warm, accent];
        return [
          card(x, 150, 270, 520),
          txt(x + 24, 200, labels[i], 18, muted),
          soft(x + 24, 240, 222, 80),
          soft(x + 24, 340, 222, 80),
          soft(x + 24, 440, 222, 80),
          bar(x + 40, 270, 140, 10, colors[i]),
        ];
      }),
    ].join("\n  "),
    "CRM pipeline board"
  ),

  "saas-tenancy": svg(
    1200,
    750,
    [
      card(40, 40, 220, 670),
      soft(70, 90, 160, 36),
      soft(70, 150, 160, 28),
      soft(70, 196, 160, 28),
      soft(70, 242, 160, 28),
      pill(70, 620, 160, 36, accent),
      card(290, 40, 870, 80),
      txt(320, 90, "Workspace · Acme Corp", 24, ink, 700),
      card(290, 150, 420, 250),
      card(740, 150, 420, 250),
      txt(320, 200, "Active seats", 16, muted),
      txt(320, 260, "42 / 50", 36, accent2, 800),
      txt(770, 200, "Plan", 16, muted),
      txt(770, 260, "Growth", 36, ink, 800),
      card(290, 430, 870, 280),
      soft(320, 470, 810, 60),
      soft(320, 550, 810, 60),
      soft(320, 630, 810, 60),
      pill(1080, 485, 40, 28, accent),
      pill(1080, 565, 40, 28, warm),
      pill(1080, 645, 40, 28, accent2),
    ].join("\n  "),
    "SaaS admin console"
  ),

  "automation-flow": svg(
    1200,
    750,
    [
      card(80, 260, 240, 160),
      card(480, 260, 240, 160),
      card(880, 260, 240, 160),
      txt(110, 330, "Trigger", 18, muted),
      txt(110, 370, "New lead", 24, ink, 700),
      txt(510, 330, "Enrich", 18, muted),
      txt(510, 370, "Lookup + score", 22, ink, 700),
      txt(910, 330, "Action", 18, muted),
      txt(910, 370, "Create task", 24, ink, 700),
      `<path d="M320 340 H480" stroke="${accent}" stroke-width="4" fill="none"/>`,
      `<path d="M720 340 H880" stroke="${accent}" stroke-width="4" fill="none"/>`,
      `<circle cx="400" cy="340" r="8" fill="${accent}"/>`,
      `<circle cx="800" cy="340" r="8" fill="${accent}"/>`,
      soft(80, 100, 1040, 80, 16),
      txt(120, 150, "Automation run · 24 events · 0 failed", 22, ink, 600),
      soft(80, 500, 1040, 160, 16),
      bar(120, 560, 220, 14, accent),
      bar(120, 600, 160, 14, accent2),
      bar(400, 560, 280, 14, warm),
    ].join("\n  "),
    "Automation workflow"
  ),

  "website-marketing": svg(
    1200,
    750,
    [
      card(80, 60, 1040, 80),
      soft(110, 85, 120, 30),
      soft(700, 85, 80, 30),
      soft(800, 85, 80, 30),
      soft(900, 85, 80, 30),
      pill(1000, 85, 90, 30, accent),
      card(80, 170, 640, 480),
      txt(120, 280, "Grow with systems", 36, ink, 800),
      txt(120, 340, "your team will actually use", 28, muted, 500),
      pill(120, 400, 180, 48, accent),
      soft(320, 400, 160, 48, 24),
      card(760, 170, 360, 220),
      card(760, 420, 360, 230),
      soft(790, 210, 300, 40),
      soft(790, 270, 240, 20),
      soft(790, 310, 260, 20),
      soft(790, 460, 300, 40),
      soft(790, 520, 260, 20),
      soft(790, 560, 220, 20),
    ].join("\n  "),
    "Marketing website layout"
  ),

  "mvp-scope": svg(
    1200,
    750,
    [
      card(60, 60, 520, 630),
      txt(100, 130, "Written scope", 28, ink, 700),
      soft(100, 170, 440, 40),
      soft(100, 230, 440, 40),
      soft(100, 290, 440, 40),
      soft(100, 350, 440, 40),
      soft(100, 410, 440, 40),
      bar(100, 500, 200, 14, accent),
      bar(100, 540, 280, 14, accent2),
      bar(100, 580, 160, 14, warm),
      card(620, 60, 520, 300),
      txt(660, 130, "Milestones", 24, ink, 700),
      soft(660, 170, 440, 50),
      soft(660, 240, 440, 50),
      soft(660, 310, 440, 50),
      card(620, 390, 520, 300),
      txt(660, 460, "Weekly demo", 24, ink, 700),
      soft(660, 500, 440, 140),
      pill(690, 560, 160, 40, accent),
    ].join("\n  "),
    "MVP scope and milestones"
  ),

  "ai-workspace": svg(
    1200,
    750,
    [
      card(40, 40, 1120, 80),
      txt(70, 90, "AI assistant · your data, your keys", 26, ink, 700),
      card(40, 150, 380, 520),
      soft(70, 190, 320, 48),
      soft(70, 260, 320, 48),
      soft(70, 330, 320, 48),
      soft(70, 400, 320, 48),
      pill(70, 590, 320, 40, accent),
      card(450, 150, 710, 520),
      soft(490, 190, 630, 90),
      txt(520, 245, "Draft reply from CRM notes", 20, ink, 600),
      soft(490, 310, 630, 200),
      bar(520, 360, 400, 12, muted),
      bar(520, 400, 480, 12, muted),
      bar(520, 440, 360, 12, muted),
      pill(490, 560, 180, 44, accent),
      soft(690, 560, 160, 44, 22),
    ].join("\n  "),
    "AI workspace"
  ),

  "dispatch-board": svg(
    1200,
    750,
    [
      card(40, 40, 1120, 80),
      txt(70, 90, "Dispatch board", 26, ink, 700),
      ...[0, 1, 2, 3, 4].flatMap((i) => {
        const y = 150 + i * 110;
        const colors = [accent, warm, accent2, accent, warm];
        return [
          card(40, y, 1120, 95),
          soft(70, y + 25, 160, 45),
          soft(260, y + 25, 280, 45),
          soft(570, y + 25, 220, 45),
          soft(820, y + 25, 160, 45),
          pill(1010, y + 30, 120, 36, colors[i]),
        ];
      }),
    ].join("\n  "),
    "Logistics dispatch board"
  ),

  "property-portal": svg(
    1200,
    750,
    [
      card(40, 40, 1120, 80),
      txt(70, 90, "Listings & showings", 26, ink, 700),
      card(40, 150, 560, 520),
      card(640, 150, 520, 240),
      card(640, 420, 520, 250),
      soft(80, 200, 480, 180),
      soft(80, 410, 220, 180),
      soft(300, 410, 260, 180),
      soft(680, 200, 440, 50),
      soft(680, 280, 300, 30),
      soft(680, 330, 360, 30),
      soft(680, 470, 440, 50),
      soft(680, 550, 360, 30),
      soft(680, 600, 300, 30),
    ].join("\n  "),
    "Real estate portal"
  ),

  "clinic-booking": svg(
    1200,
    750,
    [
      card(80, 60, 500, 630),
      txt(120, 140, "Book an appointment", 26, ink, 700),
      soft(120, 190, 420, 50),
      soft(120, 270, 420, 50),
      soft(120, 350, 420, 50),
      soft(120, 430, 190, 90),
      soft(340, 430, 190, 90),
      soft(120, 540, 190, 90),
      soft(340, 540, 190, 90),
      pill(120, 650, 200, 40, accent),
      card(640, 60, 480, 630),
      txt(680, 140, "Today", 24, ink, 700),
      soft(680, 190, 400, 70),
      soft(680, 290, 400, 70),
      soft(680, 390, 400, 70),
      soft(680, 490, 400, 70),
      bar(700, 220, 160, 14, accent),
      bar(700, 320, 140, 14, warm),
      bar(700, 420, 180, 14, accent2),
    ].join("\n  "),
    "Clinic booking calendar"
  ),

  "audit-report": svg(
    1200,
    750,
    [
      card(80, 50, 1040, 650),
      txt(130, 130, "Website audit report", 30, ink, 700),
      txt(130, 175, "Annotated findings · prioritized fixes", 18, muted),
      soft(130, 220, 300, 160),
      soft(460, 220, 300, 160),
      soft(790, 220, 280, 160),
      txt(160, 290, "Mobile", 18, muted),
      txt(160, 340, "Needs work", 28, warm, 700),
      txt(490, 290, "Forms", 18, muted),
      txt(490, 340, "Broken", 28, warm, 700),
      txt(820, 290, "SSL", 18, muted),
      txt(820, 340, "OK", 28, accent2, 700),
      soft(130, 420, 940, 80),
      soft(130, 530, 940, 80),
      bar(160, 455, 400, 14, accent),
      bar(160, 565, 520, 14, warm),
    ].join("\n  "),
    "Website audit report"
  ),

  "process-timeline": svg(
    1200,
    750,
    [0, 1, 2, 3, 4, 5]
      .flatMap((i) => {
        const x = 70 + i * 190;
        const labels = ["Call", "Scope", "Design", "Build", "Launch", "Handover"];
        return [
          `<circle cx="${x + 40}" cy="220" r="28" fill="${panel2}" stroke="${accent}" stroke-width="3"/>`,
          txt(x + 28, 228, String(i + 1).padStart(2, "0"), 16, accent2, 700),
          i < 5
            ? `<path d="M${x + 70} 220 H${x + 190}" stroke="${line}" stroke-width="3"/>`
            : "",
          soft(x, 320, 150, 200, 16),
          txt(x + 20, 380, labels[i], 18, ink, 700),
          bar(x + 20, 420, 100, 10, accent),
          bar(x + 20, 450, 80, 10, muted),
        ];
      })
      .join("\n  "),
    "Delivery process timeline"
  ),

  "code-stack": svg(
    1200,
    750,
    [
      card(100, 80, 1000, 120),
      txt(140, 155, "Stack we ship with", 28, ink, 700),
      soft(180, 280, 160, 100, 16),
      txt(204, 340, "Next.js", 22, ink, 700),
      soft(380, 280, 160, 100, 16),
      txt(420, 340, "React", 22, ink, 700),
      soft(560, 280, 160, 100, 16),
      txt(600, 340, "Node", 22, ink, 700),
      soft(740, 280, 160, 100, 16),
      txt(760, 340, "Postgres", 20, ink, 700),
      soft(960, 280, 140, 100, 16),
      txt(1000, 340, "AWS", 22, ink, 700),
      card(180, 460, 840, 180),
      soft(220, 510, 180, 80),
      soft(430, 510, 180, 80),
      soft(640, 510, 180, 80),
      soft(850, 510, 120, 80),
    ].join("\n  "),
    "Technology stack"
  ),

  "construction-jobs": svg(
    1200,
    750,
    [
      card(40, 40, 1120, 80),
      txt(70, 90, "Jobs · estimates · crew schedule", 26, ink, 700),
      card(40, 150, 560, 520),
      soft(80, 200, 480, 70),
      soft(80, 300, 480, 70),
      soft(80, 400, 480, 70),
      soft(80, 500, 480, 70),
      bar(100, 230, 200, 14, accent),
      bar(100, 330, 160, 14, warm),
      card(640, 150, 520, 250),
      card(640, 430, 520, 240),
      soft(680, 200, 440, 50),
      soft(680, 280, 300, 30),
      soft(680, 480, 440, 50),
      soft(680, 560, 360, 30),
    ].join("\n  "),
    "Construction job board"
  ),

  "retail-inventory": svg(
    1200,
    750,
    [
      card(40, 40, 1120, 80),
      txt(70, 90, "Stock · orders · suppliers", 26, ink, 700),
      card(40, 150, 360, 250),
      card(420, 150, 360, 250),
      card(800, 150, 360, 250),
      txt(70, 220, "SKUs", 16, muted),
      txt(70, 275, "1,842", 40, accent2, 800),
      txt(450, 220, "Low stock", 16, muted),
      txt(450, 275, "23", 40, warm, 800),
      txt(830, 220, "Open POs", 16, muted),
      txt(830, 275, "9", 40, accent, 800),
      card(40, 430, 1120, 240),
      soft(80, 480, 1040, 50),
      soft(80, 560, 1040, 50),
      bar(100, 500, 280, 12, accent),
      bar(100, 580, 200, 12, warm),
    ].join("\n  "),
    "Retail inventory dashboard"
  ),

  "security-panel": svg(
    1200,
    750,
    [
      card(60, 50, 1080, 80),
      txt(100, 100, "Access · Keys · Audit log", 26, ink, 700),
      card(60, 160, 360, 500),
      card(440, 160, 360, 500),
      card(820, 160, 320, 500),
      txt(90, 210, "Roles", 18, muted),
      soft(90, 240, 300, 70),
      soft(90, 330, 300, 70),
      soft(90, 420, 300, 70),
      soft(90, 510, 300, 70),
      txt(470, 210, "API keys", 18, muted),
      soft(470, 240, 300, 60),
      soft(470, 320, 300, 60),
      soft(470, 400, 300, 60),
      pill(470, 520, 160, 40, accent),
      txt(850, 210, "Recent events", 18, muted),
      soft(850, 240, 260, 50),
      soft(850, 310, 260, 50),
      soft(850, 380, 260, 50),
      soft(850, 450, 260, 50),
      soft(850, 520, 260, 50),
      bar(110, 265, 140, 12, accent2),
      bar(490, 265, 180, 12, warm),
    ].join("\n  "),
    "Security and access panel"
  ),

  "studio-team": svg(
    1200,
    750,
    [
      card(60, 50, 1080, 80),
      txt(100, 100, "Studio · this week", 26, ink, 700),
      card(60, 160, 540, 500),
      card(620, 160, 520, 230),
      card(620, 410, 520, 250),
      soft(100, 210, 200, 140),
      soft(320, 210, 200, 140),
      soft(100, 380, 200, 140),
      soft(320, 380, 200, 140),
      txt(120, 280, "Design", 18, ink, 700),
      txt(340, 280, "Build", 18, ink, 700),
      txt(120, 450, "Review", 18, ink, 700),
      txt(340, 450, "Ship", 18, ink, 700),
      soft(660, 200, 440, 50),
      soft(660, 270, 360, 30),
      soft(660, 320, 300, 30),
      soft(660, 450, 440, 50),
      soft(660, 520, 360, 30),
      soft(660, 570, 280, 30),
      pill(660, 610, 140, 36, accent),
    ].join("\n  "),
    "Studio collaboration workspace"
  ),

  "chatbot-inbox": svg(
    1200,
    750,
    [
      card(60, 50, 340, 650),
      soft(90, 90, 280, 40),
      soft(90, 150, 280, 50),
      soft(90, 220, 280, 50),
      soft(90, 290, 280, 50),
      soft(90, 360, 280, 50),
      pill(90, 620, 280, 40, accent),
      card(420, 50, 720, 650),
      soft(460, 100, 520, 70),
      soft(460, 200, 420, 90),
      soft(620, 320, 480, 90),
      soft(460, 440, 400, 70),
      bar(490, 130, 200, 14, accent2),
      bar(490, 240, 280, 12, muted),
      bar(660, 360, 280, 12, ink),
      soft(460, 560, 640, 80),
      pill(980, 580, 100, 40, accent),
    ].join("\n  "),
    "Support chatbot inbox"
  ),

  "document-ocr": svg(
    1200,
    750,
    [
      card(60, 50, 520, 650),
      soft(100, 100, 440, 520),
      bar(140, 160, 280, 14, muted),
      bar(140, 210, 360, 14, muted),
      bar(140, 260, 300, 14, muted),
      bar(140, 310, 340, 14, muted),
      bar(140, 360, 200, 14, muted),
      pill(140, 520, 180, 40, accent),
      card(620, 50, 520, 650),
      txt(660, 120, "Extracted fields", 24, ink, 700),
      soft(660, 160, 440, 70),
      soft(660, 250, 440, 70),
      soft(660, 340, 440, 70),
      soft(660, 430, 440, 70),
      bar(690, 190, 160, 12, accent),
      bar(690, 280, 200, 12, accent2),
      bar(690, 370, 140, 12, warm),
      bar(690, 460, 180, 12, accent),
      pill(660, 560, 200, 44, accent),
    ].join("\n  "),
    "Document processing workspace"
  ),
};

for (const [name, content] of Object.entries(arts)) {
  fs.writeFileSync(path.join(dir, `${name}.svg`), content);
  console.log("wrote", name);
}
console.log("done", Object.keys(arts).length);
