// Reads the content/*.json files that Pages CMS edits and builds the page from them.
(() => {
  'use strict';
  const PAGE = 24; // photos shown before "More photos"
  const $ = (s, el = document) => el.querySelector(s);
  const el = (tag, cls, text) => {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  };
  const getJSON = (p) => (window.PREVIEW_DATA
    ? Promise.resolve(window.PREVIEW_DATA[p] || null)
    : fetch(p, { cache: 'no-cache' }).then((r) => (r.ok ? r.json() : null)).catch(() => null));

  const fmtDate = (d) => {
    const t = Date.parse(d);
    return Number.isNaN(t) ? '' : new Date(t).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
  };
  const fmtMonth = (d) => {
    const t = Date.parse(d);
    return Number.isNaN(t) ? '' : new Date(t).toLocaleDateString('en-GB', { month: 'short', year: 'numeric', timeZone: 'UTC' });
  };
  const isPlaceholder = (v) => !v || /^\[.*\]$/.test(String(v).trim());
  const safeUrl = (u) => (/^https:\/\//i.test(u) ? u : null);

  // ?preview shows sessions and films ticked "Hide from the site"
  const PREVIEW = new URLSearchParams(location.search).has('preview');
  const visible = (x) => PREVIEW || !x.draft;

  let sizes = {};
  let settings = {};

  // Image URLs. Unsplash placeholders are resized by Unsplash, uploads use the thumbnail the build makes.
  const src = (p, w) => {
    if (/^https:\/\/images\.unsplash\.com\//.test(p)) return `${p}?w=${w}&q=${w > 1200 ? 80 : 70}&auto=format&fit=max`;
    if (/^https?:/i.test(p)) return safeUrl(p);
    const path = String(p).replace(/^\/+/, '');
    const s = sizes[path];
    if (w <= 1200 && s && s[2]) return path.replace(/^media\//, 'media/thumbs/');
    return path;
  };
  const ratio = (p) => {
    const s = sizes[p] || sizes[String(p).replace(/^\/+/, '')];
    return s ? s[0] / s[1] : 1.5;
  };

  // WhatsApp link with a message filled in
  const wa = (text) => {
    const n = isPlaceholder(settings.whatsapp) ? '' : String(settings.whatsapp).replace(/\D/g, '');
    return n ? `https://wa.me/${n}?text=${encodeURIComponent(text)}` : '#contact';
  };

  /* ---------- settings ---------- */
  function applySettings() {
    document.querySelectorAll('[data-set]').forEach((n) => {
      const v = settings[n.dataset.set];
      if (v) n.textContent = v;
    });
    document.querySelectorAll('[data-set-img]').forEach((img) => {
      const v = settings[img.dataset.setImg];
      if (!v) return;
      img.src = src(v, img.classList.contains('hero-img') ? 2200 : 1100);
      if (img.classList.contains('hero-img')) img.srcset = `${src(v, 1100)} 1100w, ${src(v, 2200)} 2200w`;
    });
    const ig = String(settings.instagram || '').replace(/^@/, '');
    const links = {
      instagram: isPlaceholder(ig) ? null : `https://www.instagram.com/${encodeURIComponent(ig)}/`,
      email: isPlaceholder(settings.email) ? null : `mailto:${settings.email}`,
      youtube: safeUrl(settings.youtube),
    };
    document.querySelectorAll('[data-set-href]').forEach((a) => {
      const href = links[a.dataset.setHref];
      if (href) a.href = href;
      if (href && href.startsWith('https')) { a.target = '_blank'; a.rel = 'noopener'; }
    });
    document.querySelectorAll('[data-wa]').forEach((a) => {
      a.href = wa(a.dataset.wa);
      if (a.href.startsWith('https')) { a.target = '_blank'; a.rel = 'noopener'; }
    });
    if (!isPlaceholder(settings.name)) document.title = `${settings.name} | ${settings.tagline || 'Surf photo'}, ${settings.location || ''}`;
    $('#year').textContent = new Date().getFullYear();
  }

  /* ---------- photos ---------- */
  let all = [];      // every photo, newest session first
  let shown = [];    // after filters
  let limit = PAGE;
  const filter = { shot: '', spot: '' };

  function flatten(sessions) {
    const list = [];
    sessions
      .filter(visible)
      .map((s, i) => ({ ...s, i }))
      .sort((a, b) => (Date.parse(b.date) || 0) - (Date.parse(a.date) || 0) || b.i - a.i)
      .forEach((s) => {
        const photos = Array.isArray(s.photos) ? s.photos : [s.photos];
        photos.filter(Boolean).forEach((p, n) => list.push({ p, n: n + 1, date: s.date, spot: s.spot || '', shot: s.shot || '', surfers: s.surfers || '', draft: !!s.draft }));
      });
    return list;
  }

  function fillSpots() {
    const sel = $('#spot');
    [...new Set(all.map((x) => x.spot).filter(Boolean))].sort().forEach((s) => sel.append(new Option(s, s)));
  }

  function renderGrid() {
    shown = all.filter((x) => (!filter.shot || x.shot === filter.shot) && (!filter.spot || x.spot === filter.spot));
    const grid = $('#grid');
    grid.replaceChildren();
    shown.slice(0, limit).forEach((x, i) => {
      const b = el('button', 'ph');
      b.type = 'button';
      b.style.setProperty('--r', ratio(x.p).toFixed(4));
      b.setAttribute('aria-label', `Open photo: ${x.spot}, ${fmtDate(x.date)}`);
      const img = el('img');
      img.alt = '';
      img.loading = i < 8 ? 'eager' : 'lazy';
      img.decoding = 'async';
      img.dataset.loading = '';
      img.addEventListener('load', () => {
        delete img.dataset.loading;
        // photo with no size on record: use its real shape once it arrives
        if (!sizes[x.p] && img.naturalWidth) b.style.setProperty('--r', (img.naturalWidth / img.naturalHeight).toFixed(4));
      }, { once: true });
      img.src = src(x.p, 900);
      b.append(img, el('span', 'tag', `${x.spot} · ${fmtDate(x.date)}`));
      if (x.draft) b.append(el('span', 'draft', 'Hidden'));
      b.addEventListener('click', () => openLb(i));
      grid.append(b);
    });
    $('#empty').hidden = shown.length > 0;
    $('#more').hidden = shown.length <= limit;
  }

  function wireFilters() {
    document.querySelectorAll('.chip').forEach((c) => c.addEventListener('click', () => {
      document.querySelectorAll('.chip').forEach((o) => o.setAttribute('aria-pressed', String(o === c)));
      filter.shot = c.dataset.shot;
      limit = PAGE;
      renderGrid();
    }));
    $('#spot').addEventListener('change', (e) => { filter.spot = e.target.value; limit = PAGE; renderGrid(); });
    $('#more').addEventListener('click', () => {
      const first = limit;
      limit += PAGE;
      renderGrid();
      $('#grid').children[first]?.focus();
    });
  }

  /* ---------- lightbox ---------- */
  const lb = $('#lb');
  let at = 0;
  function showLb() {
    const x = shown[at];
    if (!x) return;
    const img = $('#lb-img');
    img.src = src(x.p, 2000);
    img.alt = `${x.shot === 'Drone' ? 'Drone photo' : 'Surf photo'} at ${x.spot}, ${fmtDate(x.date)}`;
    $('#lb-count').textContent = `${at + 1} / ${shown.length}`;
    const who = isPlaceholder(x.surfers) ? '' : ` · ${x.surfers}`;
    $('#lb-cap').textContent = `${x.spot} · ${fmtDate(x.date)}${who}`;
    const name = String(x.p).split('/').pop().split('?')[0];
    $('#lb-buy').href = wa(`Hi, I'd like to buy this photo: ${x.spot}, ${fmtDate(x.date)}, photo ${x.n} (${name}).`);
    // load the neighbours ahead of time
    [at + 1, at - 1].forEach((k) => { if (shown[k]) new Image().src = src(shown[k].p, 2000); });
  }
  function openLb(i) {
    at = i;
    showLb();
    lb.showModal();
  }
  const step = (d) => { at = (at + d + shown.length) % shown.length; showLb(); };
  $('#lb-prev').addEventListener('click', () => step(-1));
  $('#lb-next').addEventListener('click', () => step(1));
  $('#lb-close').addEventListener('click', () => lb.close());
  lb.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft') step(-1);
    if (e.key === 'ArrowRight') step(1);
  });
  let x0 = null;
  const stage = $('.lb-stage');
  stage.addEventListener('pointerdown', (e) => { x0 = e.clientX; });
  stage.addEventListener('pointerup', (e) => {
    if (x0 == null) return;
    const dx = e.clientX - x0;
    x0 = null;
    if (Math.abs(dx) > 50) step(dx < 0 ? 1 : -1);
  });
  lb.addEventListener('close', () => { $('#lb-img').removeAttribute('src'); });

  /* ---------- films ---------- */
  const ytId = (u) => {
    const m = String(u || '').match(/(?:youtu\.be\/|[?&]v=|\/embed\/|\/shorts\/|\/live\/)([\w-]{11})/);
    if (m) return m[1];
    return /^[\w-]{11}$/.test(String(u).trim()) ? String(u).trim() : null;
  };

  function renderFilms(videos) {
    const grid = $('#films-grid');
    videos
      .filter(visible)
      .map((v, i) => ({ ...v, i, id: ytId(v.url) }))
      .filter((v) => v.id)
      .sort((a, b) => (Date.parse(b.date) || 0) - (Date.parse(a.date) || 0) || b.i - a.i)
      .forEach((v) => {
        const fig = el('figure', 'film');
        if (/\/shorts\//.test(v.url)) fig.classList.add('vertical');
        const frame = el('div', 'film-frame');
        const btn = el('button');
        btn.type = 'button';
        btn.setAttribute('aria-label', `Play ${v.title || 'video'}`);
        const img = el('img');
        img.alt = '';
        img.loading = 'lazy';
        img.src = `https://i.ytimg.com/vi/${v.id}/hqdefault.jpg`;
        btn.append(img, el('span', 'play'));
        // the YouTube player only loads when someone presses play
        btn.addEventListener('click', () => {
          const f = el('iframe');
          f.src = `https://www.youtube-nocookie.com/embed/${v.id}?autoplay=1&rel=0&playsinline=1`;
          f.title = v.title || 'Video';
          f.allow = 'autoplay; encrypted-media; picture-in-picture; fullscreen';
          f.allowFullscreen = true;
          frame.replaceChildren(f);
        });
        frame.append(btn);
        if (v.draft) frame.append(el('span', 'draft', 'Hidden'));
        const meta = [v.spot, fmtMonth(v.date)].filter(Boolean).join(' · ');
        fig.append(frame, el('h3', null, v.title || ''), el('p', null, meta));
        grid.append(fig);
      });
  }

  /* ---------- prices ---------- */
  function renderPrices(list) {
    const grid = $('#prices-grid');
    list.forEach((p) => {
      const tile = el('div', 'price');
      tile.append(el('h3', null, p.name || ''), el('p', 'amount', p.price || ''));
      String(p.details || '').split('\n').map((s) => s.trim()).filter(Boolean).forEach((line) => tile.append(el('p', null, line)));
      grid.append(tile);
    });
  }

  /* ---------- start ---------- */
  Promise.all([
    getJSON('content/settings.json'),
    getJSON('content/sessions.json'),
    getJSON('content/videos.json'),
    getJSON('content/packages.json'),
    getJSON('media/_sizes.json'),
  ]).then(([s, sessions, videos, packages, sz]) => {
    settings = s || {};
    sizes = sz || {};
    applySettings();
    if (PREVIEW) {
      document.body.prepend(el('p', 'preview-bar', 'Preview. Items marked Hidden are not on the live site.'));
      // keep ?preview when moving between sections
      document.querySelectorAll('a[href^="#"]').forEach((a) => { a.href = `?preview${a.getAttribute('href')}`; });
    }
    all = flatten(sessions || []);
    fillSpots();
    wireFilters();
    renderGrid();
    renderFilms(videos || []);
    renderPrices(packages || []);
  });
})();
