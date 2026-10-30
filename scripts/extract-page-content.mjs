import fs from "fs";

// Helper to extract JSX-like text content from the Canvas template
function extractTextFromCanvas(json) {
  const texts = [];
  
  function traverse(obj, path = "") {
    if (!obj || typeof obj !== "object") {
      return;
    }
    
    // Look for text content in various Canvas properties
    if (obj.type === "text" && obj.text) {
      texts.push(obj.text);
    }
    
    // Common Canvas/React text properties
    if (typeof obj.children === "string") {
      texts.push(obj.children);
    }
    
    // Recursively traverse arrays and objects
    if (Array.isArray(obj)) {
      obj.forEach((item, i) => traverse(item, `${path}[${i}]`));
    } else {
      Object.keys(obj).forEach((key) => {
        if (key !== "$$typeof" && key !== "_owner" && key !== "_store") {
          traverse(obj[key], `${path}.${key}`);
        }
      });
    }
  }
  
  traverse(json);
  return texts;
}

// Read a page HTML and extract its template
function extractPageContent(htmlPath) {
  const html = fs.readFileSync(htmlPath, "utf8");
  
  // Extract template
  const templateMatch = html.match(
    /<script[^>]*type="__bundler\/template"[^>]*>([\s\S]*?)<\/script>/
  );
  
  if (!templateMatch) {
    return { error: "No template found" };
  }
  
  try {
    const template = JSON.parse(templateMatch[1]);
    
    // Save the JSON for inspection
    const jsonPath = htmlPath.replace(".html", ".json");
    fs.writeFileSync(jsonPath, JSON.stringify(template, null, 2));
    
    // Extract text
    const texts = extractTextFromCanvas(template);
    
    return {
      template,
      texts: texts.filter((t) => t && t.trim().length > 0),
      jsonPath,
    };
  } catch (e) {
    return { error: e.message };
  }
}

// Process home page
console.log("Extracting Home page content...");
const homeResult = extractPageContent(
  "storage/page-home.html"
);

if (homeResult.error) {
  console.error("Error:", homeResult.error);
} else {
  console.log(`Found ${homeResult.texts.length} text elements`);
  console.log("Saved template to:", homeResult.jsonPath);
  console.log("\nFirst 20 text elements:");
  homeResult.texts.slice(0, 20).forEach((text, i) => {
    console.log(`${i + 1}. ${text.substring(0, 100)}${text.length > 100 ? "..." : ""}`);
  });
}
