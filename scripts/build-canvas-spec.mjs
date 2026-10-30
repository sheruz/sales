import fs from "fs";

const pages = [
  { file: "page-home.html", title: "HOME PAGE", slug: "home" },
  { file: "page-header-shared-.html", title: "HEADER (SHARED)", slug: "header" },
  { file: "page-footer-shared-.html", title: "FOOTER (SHARED)", slug: "footer" },
  { file: "page-mega-menu-services-open.html", title: "MEGA MENU (SERVICES)", slug: "mega-menu" },
  { file: "page-service-page-template-web-applications.html", title: "SERVICE TEMPLATE (WEB APPLICATIONS)", slug: "service" },
  { file: "page-industry-page-template-logistics-amp-trucking.html", title: "INDUSTRY TEMPLATE (LOGISTICS & TRUCKING)", slug: "industry" },
  { file: "page-case-study-revenue-os.html", title: "CASE STUDY (REVENUE OS)", slug: "case-study" },
  { file: "page-free-audit.html", title: "FREE AUDIT PAGE", slug: "free-audit" },
  { file: "page-about.html", title: "ABOUT PAGE", slug: "about" },
  { file: "page-pricing.html", title: "PRICING PAGE", slug: "pricing" },
  { file: "page-contact.html", title: "CONTACT PAGE", slug: "contact" },
];

// Extract template and data from HTML
function getTemplate(htmlPath) {
  const html = fs.readFileSync(`storage/${htmlPath}`, "utf8");
  const templateMatch = html.match(
    /<script[^>]*type="__bundler\/template"[^>]*>([\s\S]*?)<\/script>/
  );
  if (!templateMatch) return null;
  
  const template = JSON.parse(templateMatch[1]);
  
  // Also extract the data script
  const dataMatch = html.match(
    /<script[^>]*type="text\/x-dc"[^>]*>([\s\S]*?)<\/script>/
  );
  
  let data = {};
  if (dataMatch) {
    const scriptContent = dataMatch[1];
    // Extract renderVals return object
    const renderValsMatch = scriptContent.match(/renderVals\(\)\s*\{[\s\S]*?return\s*\{([\s\S]*?)\};?\s*\}/);
    if (renderValsMatch) {
      try {
        // Create a safe eval environment to extract the data
        const dataStr = `{${renderValsMatch[1]}}`;
        // This is a simplified extraction - we'll parse key arrays manually
        data._raw = renderValsMatch[1];
      } catch(e) {
        // Ignore parse errors
      }
    }
  }
  
  return { template, data };
}

// Extract data arrays from script
function extractDataArrays(dataRaw) {
  if (!dataRaw) return {};
  
  const arrays = {};
  
  // Extract services array
  const servicesMatch = dataRaw.match(/services:\s*\[([\s\S]*?)\]/);
  if (servicesMatch) {
    const items = [...servicesMatch[1].matchAll(/title:\s*'([^']+)'[\s\S]*?text:\s*'([^']+)'/g)];
    arrays.services = items.map(m => ({ title: m[1], text: m[2] }));
  }
  
  // Extract aiPoints array
  const aiMatch = dataRaw.match(/aiPoints:\s*\[([\s\S]*?)\]/);
  if (aiMatch) {
    const items = [...aiMatch[1].matchAll(/title:\s*'([^']+)'[\s\S]*?text:\s*'([^']+)'/g)];
    arrays.aiPoints = items.map(m => ({ title: m[1], text: m[2] }));
  }
  
  // Extract steps array
  const stepsMatch = dataRaw.match(/steps:\s*\[([\s\S]*?)\]/);
  if (stepsMatch) {
    const items = [...stepsMatch[1].matchAll(/title:\s*'([^']+)'[\s\S]*?text:\s*'([^']+)'/g)];
    arrays.steps = items.map(m => ({ title: m[1], text: m[2] }));
  }
  
  // Extract models array
  const modelsMatch = dataRaw.match(/models:\s*\[([\s\S]*?)\]/);
  if (modelsMatch) {
    const items = [...modelsMatch[1].matchAll(/title:\s*'([^']+)'[\s\S]*?text:\s*'([^']+)'/g)];
    arrays.models = items.map(m => ({ title: m[1], text: m[2] }));
  }
  
  // Extract industries array
  const indMatch = dataRaw.match(/industries:\s*\[([\s\S]*?)\]/);
  if (indMatch) {
    const items = [...indMatch[1].matchAll(/title:\s*'([^']+)'[\s\S]*?text:\s*'([^']+)'/g)];
    arrays.industries = items.map(m => ({ title: m[1], text: m[2] }));
  }
  
  // Extract faq array
  const faqMatch = dataRaw.match(/faq:\s*\[([\s\S]*?)\]/);
  if (faqMatch) {
    const items = [...faqMatch[1].matchAll(/q:\s*'([^']+?)'[\s\S]*?a:\s*'([^']+?)'/g)];
    arrays.faq = items.map(m => ({ q: m[1], a: m[2] }));
  }
  
  // Extract simple arrays
  const promisesMatch = dataRaw.match(/promisesShort.*?\[([^\]]+)\]/);
  if (promisesMatch) {
    arrays.promisesShort = [...promisesMatch[1].matchAll(/'([^']+)'/g)].map(m => m[1]);
  }
  
  const auditMatch = dataRaw.match(/auditChecks.*?\[([^\]]+)\]/);
  if (auditMatch) {
    arrays.auditChecks = [...auditMatch[1].matchAll(/'([^']+)'/g)].map(m => m[1]);
  }
  
  return arrays;
}

// Extract text and structure from template
function extractContent(template, dataArrays = {}) {
  // The template is an HTML string, let's extract readable parts
  const html = template;
  
  // Extract image slots
  const imageSlots = [...html.matchAll(/\b((?:HOME|SVC|IND|CS|AUDIT|MENU|ABOUT)(?:-IND)?-\d+)\b/g)]
    .map(m => m[1]);
  const uniqueSlots = [...new Set(imageSlots)];
  
  // Extract section comments
  const sections = [...html.matchAll(/<!--\s*(\d+\.\s*[^-]+)\s*-->/g)]
    .map(m => m[1].trim());
  
  // Extract headings
  const h1s = [...html.matchAll(/<h1[^>]*>([\s\S]*?)<\/h1>/g)]
    .map(m => m[1].replace(/<[^>]+>/g, '').trim());
  const h2s = [...html.matchAll(/<h2[^>]*>([\s\S]*?)<\/h2>/g)]
    .map(m => m[1].replace(/<[^>]+>/g, '').trim());
  const h3s = [...html.matchAll(/<h3[^>]*>([\s\S]*?)<\/h3>/g)]
    .map(m => m[1].replace(/<[^>]+>/g, '').trim());
  
  // Extract paragraphs
  const paras = [...html.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/g)]
    .map(m => m[1].replace(/<[^>]+>/g, '').trim())
    .filter(p => p.length > 10 && !p.startsWith('{{') && !p.includes('sc-for'));
  
  // Extract button/link text
  const buttons = [...html.matchAll(/>([^<]{3,40})<\/a>/g)]
    .map(m => m[1].trim())
    .filter(t => !t.startsWith('{{') && !t.includes('svg') && t.length > 2);
  
  // Extract eyebrows (small uppercase labels)
  const eyebrows = [...html.matchAll(/<span[^>]*font-size:\s*13px[^>]*letter-spacing:\s*0\.12em[^>]*text-transform:\s*uppercase[^>]*>([^<]+)<\/span>/g)]
    .map(m => m[1].trim());
  
  // Extract form labels
  const labels = [...html.matchAll(/<label[^>]*>([^<]+)</g)]
    .map(m => m[1].trim());
  
  // Extract list items from bullets
  const bullets = [...html.matchAll(/<svg[^>]*><path d="M20 6L9 17l-5-5"><\/path><\/svg>([^<]+)/g)]
    .map(m => m[1].trim());
  
  return {
    sections,
    h1s,
    h2s,
    h3s,
    eyebrows,
    paras,
    buttons,
    labels,
    bullets,
    imageSlots: uniqueSlots,
    dataArrays,
  };
}

// Build the spec
const spec = [];

spec.push("# Delvix Studio Website — Canvas Spec\n");
spec.push("**Generated from:** Delvix Studio Website.html (Cursor Canvas export)");
spec.push("**Purpose:** Complete marketing copy, structure, image slots and design tokens for implementation.\n");
spec.push("---\n");

for (const page of pages) {
  spec.push(`## ${page.title}\n`);
  
  const result = getTemplate(page.file);
  if (!result) {
    spec.push(`_No template found for ${page.file}_\n\n`);
    continue;
  }
  
  const { template, data } = result;
  const dataArrays = extractDataArrays(data._raw);
  const content = extractContent(template, dataArrays);
  
  if (content.sections.length > 0) {
    spec.push("### Sections\n");
    content.sections.forEach((s, i) => {
      spec.push(`${i + 1}. ${s}`);
    });
    spec.push("");
  }
  
  if (content.eyebrows.length > 0) {
    spec.push("### Eyebrows (small labels)\n");
    content.eyebrows.forEach(e => spec.push(`- "${e}"`));
    spec.push("");
  }
  
  if (content.h1s.length > 0) {
    spec.push("### H1 Headlines\n");
    content.h1s.forEach(h => spec.push(`- "${h}"`));
    spec.push("");
  }
  
  if (content.h2s.length > 0) {
    spec.push("### H2 Headlines\n");
    content.h2s.forEach(h => spec.push(`- "${h}"`));
    spec.push("");
  }
  
  if (content.h3s.length > 0 && content.h3s.length <= 15) {
    spec.push("### H3 Headlines\n");
    content.h3s.slice(0, 15).forEach(h => spec.push(`- "${h}"`));
    spec.push("");
  }
  
  if (content.paras.length > 0) {
    spec.push("### Lead / Body Copy\n");
    content.paras.slice(0, 20).forEach(p => {
      if (p.length < 300) {
        spec.push(`- "${p}"`);
      }
    });
    spec.push("");
  }
  
  if (content.bullets.length > 0) {
    spec.push("### Bullet Points\n");
    const uniqueBullets = [...new Set(content.bullets)];
    uniqueBullets.slice(0, 20).forEach(b => spec.push(`- ${b}`));
    spec.push("");
  }
  
  if (content.buttons.length > 0) {
    spec.push("### CTAs / Buttons\n");
    const uniqueButtons = [...new Set(content.buttons)];
    uniqueButtons.slice(0, 15).forEach(b => spec.push(`- "${b}"`));
    spec.push("");
  }
  
  if (content.labels.length > 0 && page.slug === 'free-audit') {
    spec.push("### Form Labels\n");
    content.labels.forEach(l => spec.push(`- "${l}"`));
    spec.push("");
  }
  
  if (content.imageSlots.length > 0) {
    spec.push("### Image Slots\n");
    content.imageSlots.forEach(slot => spec.push(`- \`${slot}\``));
    spec.push("");
  }
  
  // Add data arrays (cards, lists, etc.)
  if (dataArrays.services && dataArrays.services.length > 0) {
    spec.push("### Service Cards\n");
    dataArrays.services.forEach((s, i) => {
      spec.push(`${i + 1}. **${s.title}** — ${s.text}`);
    });
    spec.push("");
  }
  
  if (dataArrays.aiPoints && dataArrays.aiPoints.length > 0) {
    spec.push("### AI Feature Cards\n");
    dataArrays.aiPoints.forEach((a, i) => {
      spec.push(`${i + 1}. **${a.title}** — ${a.text}`);
    });
    spec.push("");
  }
  
  if (dataArrays.steps && dataArrays.steps.length > 0) {
    spec.push("### Process Steps\n");
    dataArrays.steps.forEach((s, i) => {
      spec.push(`${i + 1}. **${s.title}** — ${s.text}`);
    });
    spec.push("");
  }
  
  if (dataArrays.models && dataArrays.models.length > 0) {
    spec.push("### Engagement Models\n");
    dataArrays.models.forEach((m, i) => {
      spec.push(`${i + 1}. **${m.title}** — ${m.text}`);
    });
    spec.push("");
  }
  
  if (dataArrays.industries && dataArrays.industries.length > 0) {
    spec.push("### Industry Cards\n");
    dataArrays.industries.forEach((ind, i) => {
      spec.push(`${i + 1}. **${ind.title}** — ${ind.text}`);
    });
    spec.push("");
  }
  
  if (dataArrays.faq && dataArrays.faq.length > 0) {
    spec.push("### FAQ Items\n");
    dataArrays.faq.forEach((f, i) => {
      spec.push(`${i + 1}. **Q:** ${f.q}`);
      spec.push(`   **A:** ${f.a}\n`);
    });
    spec.push("");
  }
  
  if (dataArrays.promisesShort && dataArrays.promisesShort.length > 0) {
    spec.push("### Promise Bullets (repeated)\n");
    dataArrays.promisesShort.forEach(p => spec.push(`- ${p}`));
    spec.push("");
  }
  
  if (dataArrays.auditChecks && dataArrays.auditChecks.length > 0) {
    spec.push("### Audit Checklist\n");
    dataArrays.auditChecks.forEach(c => spec.push(`- ${c}`));
    spec.push("");
  }
  
  spec.push("---\n");
}

// Add design tokens
spec.push("## DESIGN TOKENS\n");
spec.push("### Colors\n");
spec.push("```");
spec.push("Primary (Indigo):    #6366F1  (buttons, accents)");
spec.push("Primary Light:       #A5B4FC");
spec.push("Dark Background:     #0B1220  (navy)");
spec.push("Dark Surface:        #121A2B");
spec.push("Dark Border:         #1E2738, #2A3550");
spec.push("Dark Text:           #F5F7FB  (headings), #D5DBE8, #A3ADC2");
spec.push("Light Background:    #FFFFFF, #F5F7FB");
spec.push("Light Text:          #0B1220, #4B5568");
spec.push("Success:             #22C55E");
spec.push("```\n");

spec.push("### Typography\n");
spec.push("```");
spec.push("Headings:  Plus Jakarta Sans (500, 600, 700, 800)");
spec.push("Body:      Inter (400, 500, 600)");
spec.push("H1:        40px–64px (clamp), weight 800, line-height 1.05, letter-spacing -0.02em");
spec.push("H2:        32px–44px (clamp), weight 800, line-height 1.12");
spec.push("H3:        20–24px, weight 700");
spec.push("Body:      15–17px, line-height 1.6–1.65");
spec.push("Eyebrow:   13px, weight 600, uppercase, letter-spacing 0.12em");
spec.push("```\n");

spec.push("### Border Radius\n");
spec.push("```");
spec.push("Small:     8–10px  (badges, tags)");
spec.push("Medium:    12–14px (buttons, inputs)");
spec.push("Large:     16–18px (cards)");
spec.push("XL:        20–28px (sections)");
spec.push("Pill:      999px   (status badges)");
spec.push("```\n");

spec.push("### Container\n");
spec.push("```");
spec.push("Max width: 1200px");
spec.push("Padding:   24px (mobile), 48px+ (desktop)");
spec.push("Section:   padding 96–112px vertical");
spec.push("```\n");

spec.push("### Animations\n");
spec.push("```css");
spec.push("@keyframes dxFloat { 0%, 100% { translateY(0) } 50% { translateY(-10px) } }");
spec.push("@keyframes dxFadeUp { from { opacity:0; translateY(16px) } to { opacity:1 } }");
spec.push(".dx-card:hover { transform: translateY(-4px); border-color: #6366F1; }");
spec.push("```\n");

spec.push("### [BRACKET] Fields\n");
spec.push("The following fields are wrapped in square brackets and should be hidden (or show placeholder) when empty:\n");
spec.push("- `[FOUNDER QUOTE: one or two sentences on why you run Delvix this way.]`");
spec.push("- `[Founder name]`");
spec.push("- `[2 business days]`");
spec.push("- Team photo: `ABOUT-04` (hide section if missing)");
spec.push("\n---\n");

spec.push("## NOTES\n");
spec.push("- All page templates include `<dc-import name=\"Header\">` and `<dc-import name=\"Footer\">`.");
spec.push("- Dynamic lists use `<sc-for>` with data from `renderVals()` in the script block.");
spec.push("- Image slots are placeholders; real files go in `/public/marketing/` with exact names from IMAGE-CHECKLIST.md.");
spec.push("- Responsive: flexbox with `flex-wrap`, `clamp()` for fluid typography, `auto-fit` grids.");
spec.push("- Accessibility: semantic HTML, ARIA labels on icons, focus states on interactive elements.\n");

// Write the spec
fs.writeFileSync("storage/canvas-spec.md", spec.join("\n"));
console.log(`\n✅ Wrote canvas-spec.md (${spec.length} lines)\n`);

// Summary stats
const allSlots = new Set();
let sectionCount = 0;
for (const page of pages) {
  const result = getTemplate(page.file);
  if (result) {
    const { template, data } = result;
    const dataArrays = extractDataArrays(data._raw);
    const content = extractContent(template, dataArrays);
    sectionCount += content.sections.length;
    content.imageSlots.forEach(slot => allSlots.add(slot));
  }
}

console.log("Summary:");
console.log(`- ${pages.length} pages documented`);
console.log(`- ${sectionCount} sections across all pages`);
console.log(`- ${allSlots.size} unique image slots: ${[...allSlots].sort().join(", ")}`);
