// Server-side rendering for individual article pages.
//
// Hash-based routing (the site's old #article-x links) never sends the hash
// to the server at all, so a link-preview crawler or AI fetch tool hitting
// such a link only ever saw the generic homepage shell — never that
// article's own photo or headline. Real URL paths (/article/<id>) fix that:
// this function reads the id straight from the request path, fetches just
// that article from Firestore, and renders per-article og:title/og:image
// meta tags plus the real article content, so a shared article link shows
// its own photo instead of the site's generic owl mark.

const shared = require('./_shared');
const esc = shared.esc;

function renderArticle(a) {
  var body = a.bodyHtml || (a.body || []).map(function (p) { return '<p>' + esc(p) + '</p>'; }).join('');
  var isDraft = !shared.isPublished(a);
  return '' +
    '<div class="admin-wrap">' +
      '<a href="/" class="see-all" style="display:inline-block; margin-bottom:24px;">&larr; Back to the Feed</a>' +
      (isDraft ? '<div class="tldr-box" style="border-left-color:var(--fg-dim); margin-bottom:20px;">This is a draft &mdash; only visible to editors, not public yet.</div>' : '') +
      '<div class="chip" style="background:var(--cat-' + a.category + ');">' + (shared.CAT_LABEL[a.category] || esc(a.category)) + '</div>' +
      '<h1 class="headline" style="font-size:clamp(32px, 4.2vw, 52px); margin-top:16px;">' + esc(a.headline) + '</h1>' +
      (a.dek ? '<p class="dek" style="font-size:19px; margin-top:16px;">' + esc(a.dek) + '</p>' : '') +
      '<p class="byline" style="margin-top:16px;">' + esc(a.byline) + ' &middot; ' + esc(a.date || '') + ' &middot; ' + esc(a.readTime || '') + '</p>' +
    '</div>' +
    (a.image ? '<div class="img-ph" style="width:100%; height:520px; margin-top:32px;">' + shared.mediaHtml(a) + '</div>' : '') +
    (a.tldr ? '<div class="admin-wrap" style="padding-top:32px;"><div class="tldr-box"><strong>Well, WTF is this?: ' + esc(a.tldr) + '</strong></div></div>' : '') +
    '<div class="admin-wrap article-body" style="display:flex; flex-direction:column; gap:22px; padding-top:' + (a.tldr ? '24px' : (a.image ? '40px' : '32px')) + ';">' +
      body +
    '</div>';
}

function notFoundHtml() {
  return '<div class="admin-wrap"><h1 class="headline" style="font-size:40px;">Can\'t find that one.</h1><p class="dek" style="margin-top:12px;"><a href="/" style="color:var(--accent-text); text-decoration:underline;">Back to the feed</a></p></div>';
}

exports.handler = async function (event) {
  var id = decodeURIComponent((event.path || '').replace(/^\/article\//, '').replace(/\/+$/, ''));

  try {
    var a = id ? await shared.fetchArticleById(id) : null;

    if (!a) {
      return {
        statusCode: 404,
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
        body: shared.pageShell(notFoundHtml(), { title: "Can't find that one — WTF Is This", url: shared.SITE_URL + '/article/' + encodeURIComponent(id) })
      };
    }

    var description = a.dek || a.tldr || "Nobody asked, we're telling you anyway.";
    var html = shared.pageShell(renderArticle(a), {
      title: a.headline + ' — WTF Is This',
      description: description,
      image: a.image || shared.DEFAULT_IMAGE,
      url: shared.SITE_URL + '/article/' + encodeURIComponent(a.id),
      type: 'article'
    });
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'public, max-age=60' },
      body: html
    };
  } catch (err) {
    // Fail safe: fall back to the plain empty shell so the client-side app
    // still loads and can render the article itself once JS runs.
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
      body: shared.pageShell('', { url: shared.SITE_URL + '/article/' + encodeURIComponent(id) })
    };
  }
};
