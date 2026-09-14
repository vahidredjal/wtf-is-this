(function () {
  // ---- 1. PASTE YOUR FIREBASE CONFIG HERE (from Firebase console > Project settings > General > Your apps) ----
  const firebaseConfig = {
    apiKey: "AIzaSyARrJn8JZ06Sxi6LxIQ3PG0L5Om94Om7Xo",
    authDomain: "wtf-is-this-57d1f.firebaseapp.com",
    projectId: "wtf-is-this-57d1f",
    storageBucket: "wtf-is-this-57d1f.firebasestorage.app",
    messagingSenderId: "375753434281",
    appId: "1:375753434281:web:3ecb2fd0026e57b31635b8"
  };
  firebase.initializeApp(firebaseConfig);
  var auth = firebase.auth();
  var db = firebase.firestore();

  var CAT_LABEL = { gaming: 'Gaming', sports: 'Sports', politics: 'Politics', tech: 'Tech', general: 'General', misc: 'Miscellaneous', entertainment: 'Entertainment' };
  var CATS = ['gaming', 'sports', 'politics', 'tech', 'general', 'misc', 'entertainment'];

  var ARTICLES = [];
  var HERO_ID = null;
  var currentUser = null;
  var editingId = null;
  var pendingDeleteId = null;
  var loading = true;

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function placeholderSvg(size) {
    return '<svg width="' + size + '" height="' + size + '" viewBox="0 0 24 24" fill="none" stroke="var(--fg-dim)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><path d="M21 15l-5-5L5 21"></path></svg>';
  }

  var POSITION_CSS = { center: '50% 50%', top: '50% 0%', bottom: '50% 100%', left: '0% 50%', right: '100% 50%' };
  var POSITION_LABEL = { center: 'Center', top: 'Top', bottom: 'Bottom', left: 'Left', right: 'Right' };

  function mediaHtml(a, size) {
    if (a.image) {
      var pos = POSITION_CSS[a.imagePosition] || POSITION_CSS.center;
      return '<img src="' + esc(a.image) + '" alt="" style="object-position:' + pos + ';">';
    }
    return placeholderSvg(size);
  }

  function findArticle(id) {
    for (var i = 0; i < ARTICLES.length; i++) if (ARTICLES[i].id === id) return ARTICLES[i];
    return null;
  }

  function isPublished(a) { return (a.status || 'published') !== 'draft'; }
  function publishedArticles() { return ARTICLES.filter(isPublished); }

  var ALLOWED_TAGS = { P: 1, STRONG: 1, B: 1, EM: 1, I: 1, S: 1, STRIKE: 1, U: 1, BR: 1, A: 1 };

  function isSafeHref(href) {
    try {
      var url = new URL(href, window.location.href);
      return url.protocol === 'http:' || url.protocol === 'https:' || url.protocol === 'mailto:';
    } catch (e) {
      return false;
    }
  }

  function sanitizeHtml(html) {
    var container = document.createElement('div');
    container.innerHTML = html;
    (function clean(node) {
      var child = node.firstChild;
      while (child) {
        var next = child.nextSibling;
        if (child.nodeType === 1) {
          if (!ALLOWED_TAGS[child.tagName]) {
            while (child.firstChild) node.insertBefore(child.firstChild, child);
            node.removeChild(child);
          } else if (child.tagName === 'A') {
            var href = child.getAttribute('href') || '';
            while (child.attributes.length) child.removeAttribute(child.attributes[0].name);
            if (isSafeHref(href)) {
              child.setAttribute('href', href);
              child.setAttribute('target', '_blank');
              child.setAttribute('rel', 'noopener noreferrer nofollow');
              clean(child);
            } else {
              while (child.firstChild) node.insertBefore(child.firstChild, child);
              node.removeChild(child);
            }
          } else {
            while (child.attributes.length) child.removeAttribute(child.attributes[0].name);
            clean(child);
          }
        } else if (child.nodeType !== 3) {
          node.removeChild(child);
        }
        child = next;
      }
    })(container);
    return container.innerHTML;
  }

  function bodyParagraphsToHtml(body) {
    return (body || []).map(function (p) { return '<p>' + esc(p) + '</p>'; }).join('');
  }

  function heroArticle() {
    var pub = publishedArticles();
    if (HERO_ID) {
      for (var i = 0; i < pub.length; i++) if (pub[i].id === HERO_ID) return pub[i];
    }
    return pub[0] || null;
  }

  function heroCardHtml(a) {
    return '' +
      '<a class="card card-link" href="/article/' + esc(a.id) + '">' +
        '<div class="img-ph" style="width:100%; height:460px;">' + mediaHtml(a, 40) + '</div>' +
        '<div class="chip" style="background:var(--cat-' + a.category + ');">' + CAT_LABEL[a.category] + '</div>' +
        '<h2 class="headline" style="font-size:clamp(30px, 3.4vw, 46px);">' + esc(a.headline) + '</h2>' +
        (a.dek ? '<p class="dek" style="font-size:18px; max-width:640px;">' + esc(a.dek) + '</p>' : '') +
        '<p class="byline">' + esc(a.byline) + ' &middot; ' + esc(a.readTime) + '</p>' +
      '</a>';
  }

  function secondaryCardHtml(a) {
    return '' +
      '<a class="card card-link" href="/article/' + esc(a.id) + '">' +
        '<div class="img-ph" style="width:100%; height:200px;">' + mediaHtml(a, 40) + '</div>' +
        '<div class="chip" style="background:var(--cat-' + a.category + ');">' + CAT_LABEL[a.category] + '</div>' +
        '<h3 class="headline" style="font-size:24px;">' + esc(a.headline) + '</h3>' +
        '<p class="byline">' + esc(a.byline) + ' &middot; ' + esc(a.readTime) + '</p>' +
      '</a>';
  }

  function gridCardHtml(a) {
    return '' +
      '<a class="card card-link" href="/article/' + esc(a.id) + '">' +
        '<div class="img-ph" style="width:100%; height:220px;">' + mediaHtml(a, 36) + '</div>' +
        '<div class="chip" style="background:var(--cat-' + a.category + ');">' + CAT_LABEL[a.category] + '</div>' +
        '<h3 class="headline" style="font-size:22px;">' + esc(a.headline) + '</h3>' +
        '<p class="byline">' + esc(a.byline) + ' &middot; ' + esc(a.readTime) + '</p>' +
      '</a>';
  }

  function categorySectionHtml(cat) {
    var items = publishedArticles().filter(function (a) { return a.category === cat; }).slice(0, 3);
    if (items.length === 0) return '';
    return '' +
      '<div class="category-section">' +
        '<div class="category-header" style="border-bottom:3px solid var(--cat-' + cat + ');">' +
          '<h2 class="section-title" style="font-size:34px; color:var(--cat-' + cat + '-text);">' + CAT_LABEL[cat] + '</h2>' +
          '<a href="/category/' + cat + '" class="see-all">See All &rarr;</a>' +
        '</div>' +
        '<div class="card-grid">' + items.map(gridCardHtml).join('') + '</div>' +
      '</div>';
  }

  function categoryPageHtml(cat) {
    var items = publishedArticles().filter(function (a) { return a.category === cat; });
    return '' +
      '<div class="category-section" style="padding-top:44px;">' +
        '<div class="category-header" style="border-bottom:3px solid var(--cat-' + cat + ');">' +
          '<h2 class="section-title" style="font-size:34px; color:var(--cat-' + cat + '-text);">' + CAT_LABEL[cat] + '</h2>' +
        '</div>' +
        (items.length === 0
          ? '<p class="dek">No articles in this category yet.</p>'
          : '<div class="card-grid">' + items.map(gridCardHtml).join('') + '</div>') +
      '</div>';
  }

  function homeHtml() {
    if (loading) return '<div class="admin-wrap"><p class="dek">Loading&hellip;</p></div>';
    var hero = heroArticle();
    if (!hero) return '<div class="admin-wrap"><p class="dek">No articles yet.' + (currentUser ? ' <a href="/admin" style="color:var(--accent-text); text-decoration:underline;">Add one</a>.' : '') + '</p></div>';
    var secondaries = publishedArticles().filter(function (a) { return a.id !== hero.id; }).slice(0, 2);
    return '' +
      '<div class="hero">' +
        heroCardHtml(hero) +
        '<div style="display:flex; flex-direction:column; gap:28px;">' +
          secondaries.map(function (a, i) {
            return (i > 0 ? '<div style="height:1px; background:var(--line);"></div>' : '') + secondaryCardHtml(a);
          }).join('') +
        '</div>' +
      '</div>' +
      CATS.map(categorySectionHtml).join('');
  }

  function articleHtml(a) {
    return '' +
      '<div class="admin-wrap">' +
        '<a href="/" class="see-all" style="display:inline-block; margin-bottom:24px;">&larr; Back to the Feed</a>' +
        (!isPublished(a) ? '<div class="tldr-box" style="border-left-color:var(--fg-dim); margin-bottom:20px;">This is a draft &mdash; only visible to editors, not public yet.</div>' : '') +
        '<div class="chip" style="background:var(--cat-' + a.category + ');">' + CAT_LABEL[a.category] + '</div>' +
        '<h1 class="headline" style="font-size:clamp(32px, 4.2vw, 52px); margin-top:16px;">' + esc(a.headline) + '</h1>' +
        (a.dek ? '<p class="dek" style="font-size:19px; margin-top:16px;">' + esc(a.dek) + '</p>' : '') +
        '<p class="byline" style="margin-top:16px;">' + esc(a.byline) + ' &middot; ' + esc(a.date) + ' &middot; ' + esc(a.readTime) + '</p>' +
      '</div>' +
      (a.image ? '<div class="img-ph" style="width:100%; height:520px; margin-top:32px;">' + mediaHtml(a, 40) + '</div>' : '') +
      (a.tldr ? '<div class="admin-wrap" style="padding-top:32px;"><div class="tldr-box"><strong>Well, WTF is this?: ' + esc(a.tldr) + '</strong></div></div>' : '') +
      '<div class="admin-wrap article-body" style="display:flex; flex-direction:column; gap:22px; padding-top:' + (a.tldr ? '24px' : (a.image ? '40px' : '32px')) + ';">' +
        (a.bodyHtml || bodyParagraphsToHtml(a.body)) +
      '</div>';
  }

  function notFoundHtml() {
    return '<div class="admin-wrap"><h1 class="headline" style="font-size:40px;">Can\'t find that one.</h1><p class="dek" style="margin-top:12px;"><a href="/" style="color:var(--accent-text); text-decoration:underline;">Back to the feed</a></p></div>';
  }

  function loginHtml() {
    return '' +
      '<div class="admin-wrap" style="max-width:420px;">' +
        '<p class="dek" style="font-size:20px; margin-bottom:24px;">Hey Copernicus, why don&rsquo;t you navigate yourself back to the homepage with your mouse and read the articles with your eyes. If you&rsquo;re not an editor, you&rsquo;re not supposed to be here.</p>' +
        '<form class="admin-form" id="login-form">' +
          '<label>Email</label><input type="email" name="email" required>' +
          '<label>Password</label><input type="password" name="password" required>' +
          '<button type="submit" class="btn btn-primary">Log In</button>' +
          '<div class="error-status" id="login-error"></div>' +
        '</form>' +
      '</div>';
  }

  function adminListHtml() {
    return ARTICLES.map(function (a) {
      var confirmBlock = pendingDeleteId === a.id ? (
        '<div class="delete-confirm">Delete &ldquo;' + esc(a.headline) + '&rdquo;? This can\'t be undone.' +
        '<div style="margin-top:10px; display:flex; gap:10px;">' +
          '<button class="btn btn-danger btn-small" onclick="WTF.deleteConfirm()">Delete It</button>' +
          '<button class="btn btn-outline btn-small" onclick="WTF.deleteCancel()">Cancel</button>' +
        '</div></div>'
      ) : '';
      return '' +
        '<div class="admin-list-item">' +
          '<div class="meta">' +
            '<div style="display:flex; gap:6px; flex-wrap:wrap;">' +
              '<span class="chip" style="background:var(--cat-' + a.category + '); width:fit-content;">' + CAT_LABEL[a.category] + (a.id === HERO_ID ? ' &middot; HERO' : '') + '</span>' +
              (!isPublished(a) ? '<span class="chip chip-draft" style="width:fit-content;">DRAFT</span>' : '') +
            '</div>' +
            '<strong style="font-size:15px;">' + esc(a.headline) + '</strong>' +
            '<span class="byline">' + esc(a.byline) + '</span>' +
          '</div>' +
          '<div class="actions">' +
            '<button class="btn btn-outline btn-small" onclick="window.location.href=\'/article/' + a.id + '\'">View</button>' +
            '<button class="btn btn-outline btn-small" onclick="WTF.startEdit(\'' + a.id + '\')">Edit</button>' +
            '<button class="btn btn-outline btn-small" onclick="WTF.deleteRequest(\'' + a.id + '\')">Delete</button>' +
          '</div>' +
          confirmBlock +
        '</div>';
    }).join('');
  }

  function adminFormHtml() {
    var editing = editingId ? findArticle(editingId) : null;
    var title = editing ? 'Edit Article' : 'New Article';
    return '' +
      '<h2 class="section-title" style="font-size:28px; margin-bottom:20px;">' + title + '</h2>' +
      '<form class="admin-form" id="article-form">' +
        '<label>Headline</label>' +
        '<input type="text" name="headline" value="' + (editing ? esc(editing.headline) : '') + '" required>' +
        '<label>Dek (optional subhead)</label>' +
        '<input type="text" name="dek" value="' + (editing ? esc(editing.dek) : '') + '">' +
        '<label>Byline</label>' +
        '<input type="text" name="byline" value="' + (editing ? esc(editing.byline) : '') + '" placeholder="By Your Name" required>' +
        '<label>Category</label>' +
        '<select name="category">' +
          CATS.map(function (c) {
            return '<option value="' + c + '"' + (editing && editing.category === c ? ' selected' : '') + '>' + CAT_LABEL[c] + '</option>';
          }).join('') +
        '</select>' +
        '<div class="field-row">' +
          '<input type="checkbox" id="hero-check" name="hero"' + (editing && editing.id === HERO_ID ? ' checked' : '') + '>' +
          '<label for="hero-check" style="margin:0;">Make this the main hero story</label>' +
        '</div>' +
        '<label>Image</label>' +
        '<input type="file" name="image" accept="image/*">' +
        (editing ? '<div class="hint">Leave blank to keep the current image. Keep new images under ~500KB.</div>' : '<div class="hint">Optional &mdash; leave blank to use a placeholder. Keep images under ~500KB.</div>') +
        '<label>Image Position</label>' +
        '<select name="imagePosition">' +
          Object.keys(POSITION_LABEL).map(function (p) {
            return '<option value="' + p + '"' + (editing && (editing.imagePosition || 'center') === p ? ' selected' : '') + '>' + POSITION_LABEL[p] + '</option>';
          }).join('') +
        '</select>' +
        '<div class="hint">Which part of the photo stays in frame if it gets cropped.</div>' +
        '<label>Read Time</label>' +
        '<input type="text" name="readTime" value="' + (editing ? esc(editing.readTime) : '') + '" placeholder="e.g. 4 min read">' +
        '<label>Well, WTF is this? (short TL;DR)</label>' +
        '<textarea name="tldr" style="min-height:80px;" placeholder="One or two sentences summing up the story.">' + (editing ? esc(editing.tldr || '') : '') + '</textarea>' +
        '<label>Body</label>' +
        '<div class="rich-toolbar">' +
          '<button type="button" title="Bold" onmousedown="event.preventDefault()" onclick="document.execCommand(\'bold\')"><strong>B</strong></button>' +
          '<button type="button" title="Italic" onmousedown="event.preventDefault()" onclick="document.execCommand(\'italic\')"><em>I</em></button>' +
          '<button type="button" title="Strikethrough" onmousedown="event.preventDefault()" onclick="document.execCommand(\'strikeThrough\')"><s>S</s></button>' +
          '<button type="button" title="Underline" onmousedown="event.preventDefault()" onclick="document.execCommand(\'underline\')"><u>U</u></button>' +
          '<button type="button" title="Add link" onmousedown="event.preventDefault()" onclick="WTF.insertLink()">Link</button>' +
          '<button type="button" title="Remove link" onmousedown="event.preventDefault()" onclick="document.execCommand(\'unlink\')">Unlink</button>' +
        '</div>' +
        '<div class="rich-editor" id="body-editor" contenteditable="true">' + (editing ? (editing.bodyHtml || bodyParagraphsToHtml(editing.body)) : '') + '</div>' +
        '<div style="display:flex; gap:12px; flex-wrap:wrap;">' +
          '<button type="button" class="btn btn-outline" id="save-draft-btn" onclick="WTF.saveForm(\'draft\')">Save Draft</button>' +
          '<button type="button" class="btn btn-primary" id="publish-btn" onclick="WTF.saveForm(\'published\')">Publish</button>' +
          '<button type="button" class="btn btn-outline" onclick="WTF.cancelForm()">Cancel</button>' +
        '</div>' +
        '<div class="publish-status" id="publish-status"></div>' +
      '</form>';
  }

  function adminHtml() {
    if (!currentUser) return '<div class="admin-wrap"><p class="dek">You need to <a href="/login" style="color:var(--accent-text); text-decoration:underline;">log in</a> to edit articles.</p></div>';
    return '' +
      '<div class="admin-wrap">' +
        '<a href="/" class="see-all" style="display:inline-block; margin-bottom:24px;">&larr; Back to the Feed</a>' +
        '<h1 class="headline" style="font-size:clamp(28px, 3.4vw, 40px); margin-bottom:12px;">Edit Articles</h1>' +
        '<p class="dek" style="margin-bottom:24px;">Signed in as ' + esc(currentUser.email) + '. Changes go live for everyone immediately.</p>' +
        (window.__WTF_SHOW_FORM__ ? adminFormHtml() : '<button class="btn btn-primary" onclick="WTF.startNew()">+ New Article</button>') +
        (window.__WTF_SHOW_FORM__ ? '' : '<div style="margin-top:32px;">' + adminListHtml() + '</div>') +
      '</div>';
  }

  function renderNav() {
    var right = document.getElementById('utility-right');
    right.innerHTML = currentUser
      ? '<span class="eyebrow" style="color:var(--fg-muted);">' + esc(currentUser.email) + '</span>'
      : '';
    var authLink = document.getElementById('nav-auth-link');
    var navRow = document.getElementById('nav-row');
    var existingAdmin = document.getElementById('nav-admin-link');
    if (currentUser) {
      authLink.textContent = 'Log Out';
      authLink.onclick = function () { auth.signOut(); };
      if (!existingAdmin) {
        var adminLink = document.createElement('a');
        adminLink.href = '/admin';
        adminLink.className = 'nav-link';
        adminLink.id = 'nav-admin-link';
        adminLink.textContent = 'Edit';
        navRow.appendChild(adminLink);
      }
    } else {
      authLink.textContent = "Don't click this.";
      authLink.onclick = function () { window.location.href = '/login'; };
      if (existingAdmin) existingAdmin.remove();
    }
  }

  function legacyHashRedirect() {
    // Old shared/bookmarked links used #article-x style hash routes. Hash
    // fragments never reach the server, so anything server-rendered (link
    // previews, the SSR homepage/article functions) can't see them anyway.
    // If one shows up client-side, bounce to the equivalent real path once.
    if (!window.location.hash) return false;
    var legacy = window.location.hash.slice(1);
    var target = null;
    if (legacy === 'home' || legacy === '') target = '/';
    else if (legacy === 'login') target = '/login';
    else if (legacy === 'admin') target = '/admin';
    else if (legacy.indexOf('article-') === 0) target = '/article/' + legacy.slice('article-'.length);
    else if (legacy.indexOf('category-') === 0) target = '/category/' + legacy.slice('category-'.length);
    if (!target) return false;
    window.location.replace(target);
    return true;
  }

  function render() {
    if (legacyHashRedirect()) return;
    renderNav();
    var path = window.location.pathname.replace(/\/+$/, '') || '/';
    var app = document.getElementById('app');
    if (path === '/login') {
      app.innerHTML = currentUser ? homeHtml() : loginHtml();
      if (!currentUser) wireLoginForm();
    } else if (path === '/admin') {
      app.innerHTML = adminHtml();
      if (currentUser) wireAdminForm();
    } else if (path.indexOf('/article/') === 0) {
      var a = findArticle(decodeURIComponent(path.slice('/article/'.length)));
      app.innerHTML = a ? articleHtml(a) : notFoundHtml();
    } else if (path.indexOf('/category/') === 0) {
      var cat = decodeURIComponent(path.slice('/category/'.length));
      app.innerHTML = CAT_LABEL[cat] ? categoryPageHtml(cat) : notFoundHtml();
    } else {
      app.innerHTML = homeHtml();
    }
    window.scrollTo(0, 0);
  }

  function wireLoginForm() {
    var form = document.getElementById('login-form');
    if (!form) return;
    form.addEventListener('submit', function (ev) {
      ev.preventDefault();
      var email = form.email.value.trim();
      var password = form.password.value;
      auth.signInWithEmailAndPassword(email, password).then(function () {
        window.location.href = '/admin';
      }).catch(function (err) {
        document.getElementById('login-error').textContent = err.message;
      });
    });
  }

  function wireAdminForm() {
    var form = document.getElementById('article-form');
    if (!form) return;
    try { document.execCommand('defaultParagraphSeparator', false, 'p'); } catch (e) {}
  }

  function fileToDataUrl(file) {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onload = function () { resolve(reader.result); };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  window.WTF = {
    startNew: function () { editingId = null; window.__WTF_SHOW_FORM__ = true; render(); },
    startEdit: function (id) { editingId = id; window.__WTF_SHOW_FORM__ = true; render(); },
    cancelForm: function () { editingId = null; window.__WTF_SHOW_FORM__ = false; render(); },
    insertLink: function () {
      var url = window.prompt('Link URL (include https://):', 'https://');
      if (!url) return;
      if (!isSafeHref(url)) {
        alert('That doesn\'t look like a valid web link. Use a full https:// (or http:// or mailto:) URL.');
        return;
      }
      document.execCommand('createLink', false, url);
    },
    deleteRequest: function (id) { pendingDeleteId = id; render(); },
    deleteCancel: function () { pendingDeleteId = null; render(); },
    deleteConfirm: function () {
      var id = pendingDeleteId;
      pendingDeleteId = null;
      db.collection('articles').doc(id).delete().catch(function (err) { alert('Could not delete: ' + err.message); });
    },
    saveForm: async function (status) {
      var form = document.getElementById('article-form');
      var editorEl = document.getElementById('body-editor');
      var statusEl = document.getElementById('publish-status');
      var draftBtn = document.getElementById('save-draft-btn');
      var publishBtn = document.getElementById('publish-btn');
      var headline = form.headline.value.trim();
      var dek = form.dek.value.trim();
      var byline = form.byline.value.trim();
      var category = form.category.value;
      var isHero = form.hero.checked;
      var bodyText = editorEl.textContent.trim();
      if (!headline || !byline || !bodyText) {
        alert('Please fill in a headline, byline, and some body text.');
        return;
      }
      var bodyHtml = sanitizeHtml(editorEl.innerHTML);
      draftBtn.disabled = true;
      publishBtn.disabled = true;
      statusEl.textContent = 'Saving…';
      try {
        var imageUrl = editingId ? (findArticle(editingId) || {}).image || null : null;
        var file = form.image.files[0];
        if (file) {
          statusEl.textContent = 'Processing image…';
          imageUrl = await fileToDataUrl(file);
          if (imageUrl.length > 700000) {
            statusEl.textContent = '';
            draftBtn.disabled = false;
            publishBtn.disabled = false;
            alert('That image is too large (article data must stay under ~1MB total). Please use a smaller or more compressed image.');
            return;
          }
        }
        var wordCount = bodyText.split(/\s+/).length;
        var readTime = form.readTime.value.trim() || (Math.max(1, Math.round(wordCount / 200)) + ' min read');
        var data = {
          headline: headline, dek: dek, byline: byline, category: category,
          bodyHtml: bodyHtml, image: imageUrl, readTime: readTime,
          imagePosition: form.imagePosition.value, tldr: form.tldr.value.trim(),
          status: status
        };
        var docId = editingId;
        if (editingId) {
          await db.collection('articles').doc(editingId).update(data);
        } else {
          data.date = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
          data.createdAt = firebase.firestore.FieldValue.serverTimestamp();
          var ref = await db.collection('articles').add(data);
          docId = ref.id;
        }
        if (isHero) {
          await db.collection('settings').doc('hero').set({ articleId: docId });
        } else if (HERO_ID === docId) {
          await db.collection('settings').doc('hero').set({ articleId: null });
        }
        editingId = null;
        window.__WTF_SHOW_FORM__ = false;
        render();
      } catch (err) {
        statusEl.textContent = 'Error: ' + err.message;
        draftBtn.disabled = false;
        publishBtn.disabled = false;
      }
    }
  };

  CATS.forEach(function (cat) {
    var link = document.createElement('a');
    link.href = '/category/' + cat;
    link.className = 'nav-link';
    link.textContent = CAT_LABEL[cat];
    document.getElementById('nav-row').appendChild(link);
  });

  auth.onAuthStateChanged(function (user) {
    currentUser = user;
    render();
  });

  db.collection('articles').orderBy('createdAt', 'desc').onSnapshot(function (snapshot) {
    ARTICLES = snapshot.docs.map(function (doc) {
      var d = doc.data();
      d.id = doc.id;
      return d;
    });
    loading = false;
    render();
  }, function (err) {
    loading = false;
    console.error('articles snapshot error', err);
    render();
  });

  db.collection('settings').doc('hero').onSnapshot(function (doc) {
    HERO_ID = doc.exists ? doc.data().articleId : null;
    render();
  });

  render();
})();
