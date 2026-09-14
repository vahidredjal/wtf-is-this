// Shared helpers for the SSR functions (homepage + individual articles).

const PROJECT_ID = 'wtf-is-this-57d1f';
const BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;
const SITE_URL = 'https://wtfisthis.wtf';
const DEFAULT_IMAGE = SITE_URL + '/assets/og-image.png';

const CAT_LABEL = {
  gaming: 'Gaming', sports: 'Sports', politics: 'Politics', tech: 'Tech',
  general: 'General', misc: 'Miscellaneous', entertainment: 'Entertainment'
};
const CATS = Object.keys(CAT_LABEL);

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function fsValue(v) {
  if (v == null) return null;
  if ('stringValue' in v) return v.stringValue;
  if ('booleanValue' in v) return v.booleanValue;
  if ('integerValue' in v) return parseInt(v.integerValue, 10);
  if ('doubleValue' in v) return v.doubleValue;
  if ('timestampValue' in v) return v.timestampValue;
  if ('arrayValue' in v) return (v.arrayValue.values || []).map(fsValue);
  if ('mapValue' in v) return fsFields(v.mapValue.fields || {});
  return null;
}

function fsFields(fields) {
  var out = {};
  for (var k in fields) out[k] = fsValue(fields[k]);
  return out;
}

function fsDocToObj(doc) {
  var obj = fsFields(doc.fields || {});
  obj.id = doc.name.split('/').pop();
  return obj;
}

async function fetchArticles() {
  const res = await fetch(BASE + '/articles?pageSize=300');
  if (!res.ok) return [];
  const json = await res.json();
  return (json.documents || []).map(fsDocToObj);
}

async function fetchArticleById(id) {
  const res = await fetch(BASE + '/articles/' + encodeURIComponent(id));
  if (!res.ok) return null;
  const json = await res.json();
  if (!json.fields) return null;
  return fsDocToObj(json);
}

async function fetchHeroId() {
  const res = await fetch(BASE + '/settings/hero');
  if (!res.ok) return null;
  const json = await res.json();
  return fsFields(json.fields || {}).articleId || null;
}

function isPublished(a) { return (a.status || 'published') !== 'draft'; }

function mediaHtml(a) {
  if (a.image) return '<img src="' + esc(a.image) + '" alt="" style="width:100%;height:100%;object-fit:fill;display:block;">';
  return '';
}

// meta: { title, description, image, url }
function pageShell(bodyHtml, meta) {
  meta = meta || {};
  var title = meta.title || 'WTF Is This';
  var description = meta.description || "Nobody asked, we're telling you anyway.";
  var image = meta.image || DEFAULT_IMAGE;
  var url = meta.url || (SITE_URL + '/');
  var type = meta.type || 'website';

  return '<!doctype html>\n' +
'<html lang="en">\n' +
'<head>\n' +
'<meta charset="UTF-8">\n' +
'<meta name="viewport" content="width=device-width, initial-scale=1.0">\n' +
'<title>' + esc(title) + '</title>\n' +
'<meta property="og:type" content="' + esc(type) + '">\n' +
'<meta property="og:url" content="' + esc(url) + '">\n' +
'<meta property="og:title" content="' + esc(title) + '">\n' +
'<meta property="og:description" content="' + esc(description) + '">\n' +
'<meta property="og:image" content="' + esc(image) + '">\n' +
'<meta name="twitter:card" content="summary_large_image">\n' +
'<meta name="twitter:title" content="' + esc(title) + '">\n' +
'<meta name="twitter:description" content="' + esc(description) + '">\n' +
'<meta name="twitter:image" content="' + esc(image) + '">\n' +
'<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Anton&family=Work+Sans:wght@400;500;600;700;800&display=swap">\n' +
'<link rel="stylesheet" href="/style.css">\n' +
'</head>\n' +
'<body>\n' +
'<div class="page">\n' +
'  <div class="utility-bar">\n' +
'    <div class="eyebrow" style="color:var(--fg-dim);">WTF IS THIS &mdash; NOBODY ASKED, WE\'RE TELLING YOU ANYWAY</div>\n' +
'    <div style="display:flex; align-items:center; gap:28px;" id="utility-right"></div>\n' +
'  </div>\n' +
'  <div class="masthead">\n' +
'    <a href="/" style="display:block; text-decoration:none; color:inherit;"><h1 class="headline wordmark"><span style="color:var(--accent-text);">WTF</span> IS THIS</h1></a>\n' +
'    <div class="nav-row" id="nav-row">\n' +
'      <a href="/" class="nav-link">Home</a>\n' +
'    </div>\n' +
'  </div>\n' +
'  <div style="height:3px; background:var(--line-strong); margin:0 clamp(20px, 4vw, 48px);"></div>\n' +
'  <div id="app">' + bodyHtml + '</div>\n' +
'  <div class="footer">\n' +
'    <div style="display:flex; flex-direction:column; gap:10px;">\n' +
'      <h3 class="headline" style="font-size:26px;"><span style="color:var(--accent-text);">WTF</span> IS THIS</h3>\n' +
'      <p class="byline" style="color:var(--fg-dim);">&copy; 2026 WTF IS THIS MEDIA. WE\'RE NOT SORRY.</p>\n' +
'      <button class="nav-link" id="nav-auth-link" style="font-size:11px; color:var(--fg-dim); margin-top:4px;">Don\'t click this.</button>\n' +
'    </div>\n' +
'  </div>\n' +
'</div>\n' +
'<script src="https://www.gstatic.com/firebasejs/10.13.2/firebase-app-compat.js"></script>\n' +
'<script src="https://www.gstatic.com/firebasejs/10.13.2/firebase-auth-compat.js"></script>\n' +
'<script src="https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore-compat.js"></script>\n' +
'<script src="/app.js"></script>\n' +
'</body>\n' +
'</html>\n';
}

module.exports = {
  PROJECT_ID, BASE, SITE_URL, DEFAULT_IMAGE, CAT_LABEL, CATS,
  esc, fsValue, fsFields, fsDocToObj,
  fetchArticles, fetchArticleById, fetchHeroId,
  isPublished, mediaHtml, pageShell
};
