/**
 * Builds public/landing.html from docs/landing-reference.html.
 * Only allowed deltas: form API handlers, honeypots, Log in link, local GSAP, document shell.
 */
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const src = fs.readFileSync(
  path.join(root, "docs", "landing-reference.html"),
  "utf8"
);

const styleMatch = src.match(/<style>([\s\S]*?)<\/style>/);
if (!styleMatch) throw new Error("no <style> in reference");
const style = styleMatch[1];
let content = src.slice(styleMatch.index + styleMatch[0].length).trim();

// No Log in in nav — use /login directly on the same domain.


// Honeypot — waitlist
content = content.replace(
  /(<input id="wlEmail"[^>]*>)/,
  '$1\n        <input type="text" name="website_url" id="wlHp" tabindex="-1" autocomplete="off" aria-hidden="true" style="position:absolute;left:-9999px;opacity:0;height:0;width:0" />'
);

// Honeypot — brief
content = content.replace(
  '<div class="form-foot">',
  '<input type="text" name="website_url" id="fHp" tabindex="-1" autocomplete="off" aria-hidden="true" style="position:absolute;left:-9999px;opacity:0;height:0;width:0" />\n        <div class="form-foot">'
);

const oldForms =
  /\/\* ---------- Forms & copy \(always active\) ---------- \*\/[\s\S]*$/;
if (!oldForms.test(content)) throw new Error("forms block not found");

const newForms = `/* ---------- Forms & copy (always active) ---------- */
(function(){
  function copy(text, btn){
    var label = btn.textContent;
    function ok(){ btn.textContent = 'Copied'; setTimeout(function(){ btn.textContent = label; }, 1600); }
    function fallback(){ var el = btn.previousElementSibling; if(el){ var r = document.createRange(); r.selectNodeContents(el); var s = getSelection(); s.removeAllRanges(); s.addRange(r); btn.textContent = 'Selected, press Ctrl+C'; setTimeout(function(){ btn.textContent = label; }, 2400); } }
    try{ navigator.clipboard.writeText(text).then(ok, fallback); }catch(e){ fallback(); }
  }
  document.querySelectorAll('[data-copy]').forEach(function(b){ b.addEventListener('click', function(){ copy(b.dataset.copy, b); }); });
  var emailRe = /^[^\\s@]+@[^\\s@]+\\.[^\\s@]{2,}$/;
  document.getElementById('waitlist').addEventListener('submit', function(e){
    e.preventDefault();
    var v = document.getElementById('wlEmail').value.trim(), note = document.getElementById('wlNote');
    var hp = (document.getElementById('wlHp') && document.getElementById('wlHp').value) || '';
    if(!emailRe.test(v)){ note.textContent = 'Enter a valid work email, like you@company.com.'; note.style.color = 'var(--coral)'; return; }
    note.style.color = '';
    note.textContent = 'Sending…';
    fetch('/api/waitlist', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: v, website_url: hp })
    }).then(function(r){ return r.json().then(function(d){ return { ok: r.ok, d: d }; }); })
    .then(function(res){
      if(!res.ok || !res.d.success){
        note.style.color = 'var(--coral)';
        note.textContent = (res.d && res.d.error) || 'Something went wrong. Please try again.';
        return;
      }
      note.style.color = '';
      note.textContent = (res.d && res.d.message) || "You're on the list — we'll be in touch soon.";
      document.getElementById('wlEmail').value = '';
    }).catch(function(){
      note.style.color = 'var(--coral)';
      note.textContent = 'Network error. Email hello@delvixstudio.com with subject Autopilot early access.';
    });
  });
  var out = document.getElementById('fOut');
  document.getElementById('brief').addEventListener('submit', function(e){
    e.preventDefault();
    var name = document.getElementById('fName').value.trim(), email = document.getElementById('fEmail').value.trim(), msg = document.getElementById('fMsg').value.trim();
    var hp = (document.getElementById('fHp') && document.getElementById('fHp').value) || '';
    if(!name || !emailRe.test(email) || msg.length < 10){
      out.className = 'form-msg err';
      out.textContent = !name ? 'Add your name so we know who to reply to.' : !emailRe.test(email) ? 'Enter a valid work email.' : 'Add a sentence or two about the project.';
      return;
    }
    var needs = Array.prototype.map.call(document.querySelectorAll('#fType input:checked'), function(i){ return i.value; });
    out.className = 'form-msg'; out.textContent = 'Sending…';
    fetch('/api/contact', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: name,
        email: email,
        company: document.getElementById('fCompany').value.trim(),
        needs: needs,
        budget: document.getElementById('fBudget').value || '',
        startTiming: document.getElementById('fWhen').value || '',
        message: msg,
        website_url: hp
      })
    }).then(function(r){ return r.json().then(function(d){ return { ok: r.ok, d: d }; }); })
    .then(function(res){
      if(!res.ok || !res.d.success){
        out.className = 'form-msg err';
        out.textContent = (res.d && res.d.error) || 'Something went wrong. Please try again.';
        return;
      }
      out.className = 'form-msg';
      out.textContent = (res.d && res.d.message) || "Thanks — we will reply within one business day.";
      var panel = document.getElementById('donePanel');
      panel.hidden = false;
      panel.innerHTML = '<strong>Thanks — we got it.</strong> We will reply within one business day. You can also reach us at hello@delvixstudio.com.';
      document.getElementById('brief').reset();
    }).catch(function(){
      out.className = 'form-msg err';
      out.textContent = 'Network error. Email hello@delvixstudio.com directly.';
    });
  });
})();
</script>
`;

content = content.replace(oldForms, newForms);

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>Delvix Studio</title>
<meta name="description" content="Delvix Studio builds web apps, mobile apps, custom ERP/CRM systems and AI integrations. Makers of Delvix Autopilot.">
<link rel="canonical" href="https://delvixstudio.com">
<meta property="og:type" content="website">
<meta property="og:url" content="https://delvixstudio.com">
<meta property="og:title" content="Delvix Studio">
<meta property="og:description" content="Delvix Studio builds web apps, mobile apps, custom ERP/CRM systems and AI integrations. Makers of Delvix Autopilot.">
<meta property="og:image" content="https://delvixstudio.com/opengraph-image">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="Delvix Studio">
<meta name="twitter:description" content="Delvix Studio builds web apps, mobile apps, custom ERP/CRM systems and AI integrations. Makers of Delvix Autopilot.">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<!-- Google tag (gtag.js) -->
<script async src="https://www.googletagmanager.com/gtag/js?id=G-B03PSCL59W"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
  gtag('config', 'G-B03PSCL59W');
</script>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,200..800&family=Figtree:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap">
<script src="/vendor/gsap.min.js"></script>
<script src="/vendor/ScrollTrigger.min.js"></script>
<style>
${style}
</style>
</head>
<body>
${content}
</body>
</html>
`;

const out = path.join(root, "public", "landing.html");
fs.writeFileSync(out, html);
console.log("wrote", out, html.length, "bytes");
