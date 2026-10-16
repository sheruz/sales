/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..", "src");

function walk(dir, out = []) {
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name);
    const st = fs.statSync(p);
    if (st.isDirectory()) walk(p, out);
    else if (/\.(tsx|ts)$/.test(name)) out.push(p);
  }
  return out;
}

let fixed = 0;
for (const file of walk(ROOT)) {
  let src = fs.readFileSync(file, "utf8");
  const orig = src;

  // attr=appHome( → attr={appHome(
  src = src.replace(
    /(\s)([A-Za-z_][\w]*)=app(Home|Ops)\(/g,
    "$1$2={app$3("
  );

  // {appHome()} missing closing } before next attr or tag end
  // Match {appHome(...)} that is missing the outer }
  src = src.replace(
    /\{app(Home|Ops)\(\)(?!\})(?=\s*[A-Za-z_/>])/g,
    "{app$1()}"
  );
  src = src.replace(
    /\{app(Home|Ops)\(("[^"]*"|'[^']*'|`[^`]*`)\)(?!\})(?=\s*[A-Za-z_/>])/g,
    "{app$1($2)}"
  );

  if (src !== orig) {
    fs.writeFileSync(file, src);
    fixed++;
    console.log(path.relative(path.join(ROOT, ".."), file));
  }
}
console.log(JSON.stringify({ fixed }, null, 2));
