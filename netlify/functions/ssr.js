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

const shared = require('./_shared');
const esc = shared.esc;
const CAT_LABEL = shared.CAT_LABEL;
const CATS = shared.CATS;
const isPublished = shared.isPublished;
const mediaHtml = shared.mediaHtml;

function cardHtml(a, headingTag, headingSize) {
  return '' +
    '<a class="card card-link" href="/article/' + esc(a.id) + '">' +
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

exports.handler = async function () {
  try {
    var results = await Promise.all([shared.fetchArticles(), shared.fetchHeroId()]);
    var html = shared.pageShell(renderHome(results[0], results[1]), {
      type: 'website',
      url: shared.SITE_URL + '/'
    });
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
      body: shared.pageShell('', { type: 'website', url: shared.SITE_URL + '/' })
    };
  }
};
