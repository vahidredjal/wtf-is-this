// Serves an article's photo at a real, fetchable URL.
//
// Article images are stored in Firestore as data: URIs (base64), since the
// site avoids paid Firebase Storage. That's fine for rendering inside the
// page itself, but link-preview crawlers (iMessage, Slack, Twitter/X,
// Facebook) require og:image to be an actual HTTP(S) URL they can fetch —
// they don't accept embedded data: URIs. This function decodes the stored
// data URI and serves it as a real image response, so ssr-article.js can
// point og:image at /article/<id>/image instead.

const shared = require('./_shared');

exports.handler = async function (event) {
  var id = (event.queryStringParameters && event.queryStringParameters.id) || '';

  try {
    var a = id ? await shared.fetchArticleById(id) : null;
    var image = a && a.image;
    if (!image || image.indexOf('data:') !== 0) {
      return { statusCode: 302, headers: { Location: shared.DEFAULT_IMAGE }, body: '' };
    }
    var match = /^data:([^;]+);base64,([\s\S]*)$/.exec(image);
    if (!match) {
      return { statusCode: 302, headers: { Location: shared.DEFAULT_IMAGE }, body: '' };
    }
    return {
      statusCode: 200,
      headers: { 'Content-Type': match[1], 'Cache-Control': 'public, max-age=3600' },
      body: match[2],
      isBase64Encoded: true
    };
  } catch (err) {
    return { statusCode: 302, headers: { Location: shared.DEFAULT_IMAGE }, body: '' };
  }
};
