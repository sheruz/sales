import fs from "fs";
import zlib from "zlib";

const html = fs.readFileSync(
  "c:/Users/shahroz.hanif/Downloads/Delvix Studio Website.html",
  "utf8"
);

// Extract manifest
const manifestMatch = html.match(
  /<script[^>]*type="__bundler\/manifest"[^>]*>([\s\S]*?)<\/script>/
);
if (!manifestMatch) {
  console.error("No manifest found");
  process.exit(1);
}

const manifest = JSON.parse(manifestMatch[1]);

// Extract template (which contains the page structure with UUIDs)
const templateMatch = html.match(
  /<script[^>]*type="__bundler\/template"[^>]*>([\s\S]*?)<\/script>/
);
if (!templateMatch) {
  console.error("No template found");
  process.exit(1);
}

const templateHtml = JSON.parse(templateMatch[1]);

// Parse template to find page titles and UUIDs using regex
const sectionRegex = /<h2>(.*?)<\/h2>[\s\S]*?src="about:blank#([0-9a-f-]+)"/g;
const pages = [];
let match;
while ((match = sectionRegex.exec(templateHtml)) !== null) {
  pages.push({ title: match[1], uuid: match[2] });
}

console.log(`Found ${pages.length} pages`);

// Helper function to strip HTML tags
function stripHtml(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<svg[\s\S]*?<\/svg>/gi, " ")
    .replace(/data:[^"']+/gi, " ")
    .replace(/<[^>]+>/g, "\n")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#\d+;/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .split(/\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 2)
    .join("\n");
}

// Process each page
const allContent = [];

for (const page of pages) {
  console.log(`\nProcessing: ${page.title}`);
  
  const pageData = manifest[page.uuid];
  if (!pageData) {
    console.log(`  No data found for ${page.uuid}`);
    continue;
  }

  // Decompress if needed
  let pageHtml;
  if (pageData.compressed) {
    const buffer = Buffer.from(pageData.data, "base64");
    pageHtml = zlib.gunzipSync(buffer).toString("utf8");
  } else {
    pageHtml = pageData.data;
  }

  // Save raw HTML for inspection
  const pageSlug = page.title.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  fs.writeFileSync(`storage/page-${pageSlug}.html`, pageHtml);
  
  // Extract text content
  const text = stripHtml(pageHtml);

  allContent.push(`\n\n========== ${page.title.toUpperCase()} ==========\n\n${text}`);

  // Also extract image slot IDs
  const slots = pageHtml.match(/\b((?:HOME|SVC|IND|CS|AUDIT|MENU|ABOUT)(?:-IND)?-\d+)\b/g);
  if (slots && slots.length > 0) {
    const uniqueSlots = [...new Set(slots)];
    console.log(`  Image slots: ${uniqueSlots.join(", ")}`);
  }
}

// Write output
fs.mkdirSync("storage", { recursive: true });
fs.writeFileSync("storage/canvas-copy.txt", allContent.join("\n"));
console.log(`\nWrote ${allContent.length} sections to storage/canvas-copy.txt`);
