// Server-side rendering for the homepage.
//
// The real site is a client-side app: the raw HTML normally ships with an
// empty <div id="app"></div>, and JavaScript fills it in from Firestore once
// it runs in a real browser. That's invisible to anything that fetches the
// page without executing JavaScript (simple bots, link-preview crawlers, AI
// tools that just GET a URL). This function fetches the same published
// articles from Firestore's public REST API and renders real HTML for the
// homepage, so a plain fetch of "/" shows actual content. Real browsers still
// load the same CSS/JS as always and immediately re-render fresh content on
// top of this once the client app boots — this is purely a fallback for
// non-JS consumers, not a second copy of the app's behavior.

const PROJECT_ID = 'wtf-is-this-57d1f';
const BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;

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

async function fetchHeroId() {
  const res = await fetch(BASE + '/settings/hero');
  if (!res.ok) return null;
  const json = await res.json();
  return fsFields(json.fields || {}).articleId || null;
}

function isPublished(a) { return (a.status || 'published') !== 'draft'; }

function mediaHtml(a) {
  if (a.image) return '<img src="' + esc(a.image) + '" alt="" style="width:100%;height:100%;object-fit:contain;display:block;">';
  return '';
}

function cardHtml(a, headingTag, headingSize) {
  return '' +
    '<a class="card card-link" href="#article-' + esc(a.id) + '">' +
      '<div class="img-ph" style="width:100%; height:220px;">' + mediaHtml(a) + '</div>' +
      '<div class="chip" style="background:var(--cat-' + a.category + ');">' + (CAT_LABEL[a.category] || esc(a.category)) + '</div>' +
      '<' + headingTag + ' class="headline" style="font-size:' + headingSize + ';">' + esc(a.headline) + '</' + headingTag + '>' +
      '<p class="byline">' + esc(a.byline) + ' &middot; ' + esc(a.readTime || '') + '</p>' +
    '</a>';
}

function renderHome(articles, heroId) {
  var pub = articles.filter(isPublished);
  if (pub.length === 0) {
    return '<div class="admin-wrap"><p class="dek">No articles yet.</p></div>';
  }
  var hero = null;
  for (var i = 0; i < pub.length; i++) if (pub[i].id === heroId) hero = pub[i];
  if (!hero) hero = pub[0];
  var secondaries = pub.filter(function (a) { return a.id !== hero.id; }).slice(0, 2);

  var categorySections = CATS.map(function (cat) {
    var items = pub.filter(function (a) { return a.category === cat; }).slice(0, 3);
    if (!items.length) return '';
    return '' +
      '<div class="category-section">' +
        '<div class="category-header" style="border-bottom:3px solid var(--cat-' + cat + ');">' +
          '<h2 class="section-title" style="font-size:34px; color:var(--cat-' + cat + '-text);">' + CAT_LABEL[cat] + '</h2>' +
        '</div>' +
        '<div class="card-grid">' + items.map(function (a) { return cardHtml(a, 'h3', '22px'); }).join('') + '</div>' +
      '</div>';
  }).join('');

  return '' +
    '<div class="hero">' +
      cardHtml(hero, 'h2', 'clamp(30px, 3.4vw, 46px)') +
      '<div style="display:flex; flex-direction:column; gap:28px;">' +
        secondaries.map(function (a) { return cardHtml(a, 'h3', '24px'); }).join('') +
      '</div>' +
    '</div>' +
    categorySections;
}

function pageShell(bodyHtml) {
  return '<!doctype html>\n' +
'<html lang="en">\n' +
'<head>\n' +
'<meta charset="UTF-8">\n' +
'<meta name="viewport" content="width=device-width, initial-scale=1.0">\n' +
'<title>WTF Is This</title>\n' +
'<meta property="og:type" content="website">\n' +
'<meta property="og:url" content="https://wtfisthis.wtf/">\n' +
'<meta property="og:title" content="WTF Is This">\n' +
'<meta property="og:description" content="Nobody asked, we\'re telling you anyway.">\n' +
'<meta property="og:image" content="https://wtfisthis.wtf/assets/og-image.png">\n' +
'<meta name="twitter:card" content="summary_large_image">\n' +
'<meta name="twitter:title" content="WTF Is This">\n' +
'<meta name="twitter:description" content="Nobody asked, we\'re telling you anyway.">\n' +
'<meta name="twitter:image" content="https://wtfisthis.wtf/assets/og-image.png">\n' +
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
'    <a href="#home" style="display:block; text-decoration:none; color:inherit;"><h1 class="headline wordmark"><span style="color:var(--accent-text);">WTF</span> IS THIS</h1></a>\n' +
'    <div class="nav-row" id="nav-row">\n' +
'      <a href="#home" class="nav-link">Home</a>\n' +
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

exports.handler = async function () {
  try {
    var results = await Promise.all([fetchArticles(), fetchHeroId()]);
    var html = pageShell(renderHome(results[0], results[1]));
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'public, max-age=60' },
      body: html
    };
  } catch (err) {
    // Fail safe: on any error, fall back to the plain empty shell so the
    // client-side app still loads and works normally for real visitors.
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
      body: pageShell('')
    };
  }
};
