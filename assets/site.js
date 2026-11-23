// Builds the whole site from the content/*.json files that Pages CMS edits.
// Pages are routed by the address hash: #charters, #photos, #photos/aerial.
(() => {
  'use strict';

  const PAGE = 30; // photos shown before "More photos"
  const $ = (s, root = document) => root.querySelector(s);
  const el = (tag, cls, text) => {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null && text !== '') n.textContent = text;
    return n;
  };
  const getJSON = (p) => (window.PREVIEW_DATA
    ? Promise.resolve(window.PREVIEW_DATA[p] || null)
    : fetch(p, { cache: 'no-cache' }).then((r) => (r.ok ? r.json() : null)).catch(() => null));

  // ?preview shows everything ticked hidden, marked with a yellow tag
  const PREVIEW = new URLSearchParams(location.search).has('preview');
  const visible = (x) => x && (PREVIEW || !(x.hidden || x.draft));
  const isHidden = (x) => !!(x && (x.hidden || x.draft));

  const slug = (s) => String(s || '').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  const same = (a, b) => slug(a) === slug(b) && slug(a) !== '';
  const isPlaceholder = (v) => !v || /^\[.*\]$/s.test(String(v).trim());
  const safeUrl = (u) => (/^https:\/\//i.test(String(u || '').trim()) ? String(u).trim() : null);
  const lines = (t) => String(t || '').split(/\n+/).map((s) => s.trim()).filter(Boolean);
  const fmtDate = (d) => {
    const t = Date.parse(d);
    return Number.isNaN(t) ? '' : new Date(t).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
  };
  const fmtMonth = (d) => {
    const t = Date.parse(d);
    return Number.isNaN(t) ? '' : new Date(t).toLocaleDateString('en-GB', { month: 'short', year: 'numeric', timeZone: 'UTC' });
  };
  const hiddenTag = () => el('span', 'draft', 'Hidden');

  let S = {};          // site settings
  let sizes = {};
  let pages = [];
  let menu = [];
  let spots = [];
  let collections = []; // {name, description, cover, hidden, slug, items}
  let allPhotos = [];
  let videos = [];
  const problems = [];  // shown in preview only

  /* ---------- images ---------- */
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

  /* ---------- links ---------- */
  const waNumber = () => (isPlaceholder(S.whatsapp) ? '' : String(S.whatsapp).replace(/\D/g, ''));
  const wa = (text) => (waNumber() ? `https://wa.me/${waNumber()}?text=${encodeURIComponent(text)}` : null);
  const email = () => (isPlaceholder(S.email) || !/@/.test(S.email) ? '' : String(S.email).trim());

  // menu and button links: a page name, a full web address, "whatsapp" or "email"
  function resolveLink(link) {
    const l = String(link || '').trim();
    if (!l) return null;
    if (/^https?:\/\//i.test(l)) return { href: l, external: true };
    if (/^mailto:/i.test(l)) return { href: l };
    if (l.toLowerCase() === 'whatsapp') {
      const h = wa('Hi, I found you through your website.');
      return h ? { href: h, external: true } : null;
    }
    if (l.toLowerCase() === 'email') return email() ? { href: `mailto:${email()}` } : null;
    const s = slug(l.replace(/^#/, ''));
    return { href: s === 'home' || s === '' ? '#' : `#${s}`, page: s || 'home' };
  }
  function linkEl(text, link, cls) {
    const r = resolveLink(link);
    const a = el('a', cls, text);
    a.href = r ? r.href : '#';
    if (r && r.external) { a.target = '_blank'; a.rel = 'noopener'; }
    return a;
  }


  /* ---------- formatted text ----------
     Text fields come from the CMS editor as HTML. Older plain text still works,
     with **bold**, *italic*, - lists, ## headings and [links](https://...).
     Only the tags and links below are kept, so nothing typed in the CMS can run code. */
  const KEEP = new Set(['P', 'BR', 'STRONG', 'B', 'EM', 'I', 'U', 'S', 'H2', 'H3', 'H4', 'UL', 'OL', 'LI', 'BLOCKQUOTE', 'A', 'HR', 'IMG']);
  const esc = (t) => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  function inlineMd(t) {
    return esc(t)
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/__(.+?)__/g, '<strong>$1</strong>')
      .replace(/(^|[^*])\*(?!\s)(.+?)\*(?!\*)/g, '$1<em>$2</em>')
      .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, '<a href="$2">$1</a>');
  }
  function mdToHtml(text) {
    return String(text).replace(/\r/g, '').split(/\n{2,}/).map((block) => {
      const rows = block.split('\n').filter((r) => r.trim());
      if (!rows.length) return '';
      if (rows.every((r) => /^\s*[-*•]\s+/.test(r))) return `<ul>${rows.map((r) => `<li>${inlineMd(r.replace(/^\s*[-*•]\s+/, ''))}</li>`).join('')}</ul>`;
      if (rows.every((r) => /^\s*\d+[.)]\s+/.test(r))) return `<ol>${rows.map((r) => `<li>${inlineMd(r.replace(/^\s*\d+[.)]\s+/, ''))}</li>`).join('')}</ol>`;
      const h = rows[0].match(/^(#{2,4})\s+(.*)$/);
      if (h && rows.length === 1) return `<h${Math.min(h[1].length + 1, 4)}>${inlineMd(h[2])}</h${Math.min(h[1].length + 1, 4)}>`;
      return `<p>${rows.map(inlineMd).join('<br>')}</p>`;
    }).join('');
  }
  function clean(node, out) {
    node.childNodes.forEach((n) => {
      if (n.nodeType === 3) { out.append(document.createTextNode(n.textContent)); return; }
      if (n.nodeType !== 1) return;
      const tag = n.tagName;
      if (tag === 'SCRIPT' || tag === 'STYLE' || tag === 'IFRAME') return;
      if (!KEEP.has(tag)) { clean(n, out); return; }
      const k = document.createElement(tag === 'B' ? 'strong' : tag === 'I' ? 'em' : tag.toLowerCase());
      if (tag === 'A') {
        const href = (n.getAttribute('href') || '').trim();
        const r = /^(https?:|mailto:|#)/i.test(href) ? { href, external: /^https?:/i.test(href) }
          : /^[a-z][a-z0-9+.-]*:/i.test(href) ? null : resolveLink(href);
        if (!r) { clean(n, out); return; }
        k.href = r.href;
        if (r.external) { k.target = '_blank'; k.rel = 'noopener'; }
      }
      if (tag === 'IMG') {
        const s2 = (n.getAttribute('src') || '').trim();
        if (!/^(https:\/\/|media\/|\/?media\/)/i.test(s2)) return;
        k.src = src(s2, 1400);
        k.alt = n.getAttribute('alt') || '';
        k.loading = 'lazy';
      }
      const align = (n.getAttribute('style') || '').match(/text-align:\s*(left|center|right|justify)/i);
      if (align) k.style.textAlign = align[1].toLowerCase();
      clean(n, k);
      out.append(k);
    });
  }
  function rich(value, cls) {
    const box = el('div', cls ? `rich ${cls}` : 'rich');
    const v = String(value || '').trim();
    if (!v) return box;
    const html = /<\/?(p|br|strong|em|b|i|u|s|h[1-6]|ul|ol|li|blockquote|a|hr|img|div|span)\b/i.test(v) ? v : mdToHtml(v);
    clean(new DOMParser().parseFromString(html, 'text/html').body, box);
    return box;
  }

  /* ---------- data ---------- */
  function buildPhotos(sets) {
    const spotArea = (name) => (spots.find((s) => same(s.name, name)) || {}).area || '';
    const list = [];
    (sets || [])
      .map((s, i) => ({ ...s, i }))
      .filter(visible)
      .sort((a, b) => (Date.parse(b.date) || 0) - (Date.parse(a.date) || 0) || b.i - a.i)
      .forEach((s) => {
        const colls = (Array.isArray(s.collections) ? s.collections : [s.collections]).filter(Boolean);
        colls.forEach((c) => {
          if (!collections.some((k) => same(k.name, c))) problems.push(`A photo set from ${s.spot || 'no spot'} (${fmtDate(s.date)}) uses the collection "${c}", which is not in Collections.`);
        });
        if (s.spot && spots.length && !spots.some((k) => same(k.name, s.spot))) problems.push(`The spot "${s.spot}" is not in Spots.`);
        const photos = (Array.isArray(s.photos) ? s.photos : [s.photos]).filter(Boolean);
        photos.forEach((p, n) => list.push({
          p, n: n + 1, date: s.date, spot: s.spot || '', area: spotArea(s.spot),
          colls, title: s.title || '', description: s.description || '', draft: !!s.draft,
        }));
      });
    return list;
  }

  function buildCollections(raw) {
    return (raw || []).filter(visible).map((c) => {
      const items = allPhotos.filter((x) => x.colls.some((n) => same(n, c.name)));
      return { ...c, slug: slug(c.name), items, coverSrc: c.cover || (items[0] && items[0].p) || '' };
    }).filter((c) => PREVIEW || c.items.length);
  }

  /* ---------- header ---------- */
  function buildNav() {
    const list = $('#nav-list');
    list.replaceChildren();
    menu.filter(visible).forEach((item) => {
      const li = el('li');
      const kids = (item.children || []).filter(visible);
      const a = item.link ? linkEl(item.label, item.link) : el('span', 'nav-parent', item.label);
      li.append(a);
      if (isHidden(item)) li.append(hiddenTag());
      if (kids.length) {
        li.classList.add('has-sub');
        const ul = el('ul', 'sub');
        kids.forEach((k) => {
          const kli = el('li');
          kli.append(linkEl(k.label, k.link));
          if (isHidden(k)) kli.append(hiddenTag());
          ul.append(kli);
        });
        li.append(ul);
      }
      list.append(li);
    });
    const btn = $('#menu-btn');
    btn.addEventListener('click', () => {
      const open = btn.getAttribute('aria-expanded') !== 'true';
      btn.setAttribute('aria-expanded', String(open));
      document.body.classList.toggle('nav-open', open);
    });
    list.addEventListener('click', (e) => {
      if (e.target.closest('a')) { btn.setAttribute('aria-expanded', 'false'); document.body.classList.remove('nav-open'); }
    });
  }
  function markNav(pageSlug) {
    document.querySelectorAll('#nav-list a').forEach((a) => {
      const h = a.getAttribute('href');
      const target = h === '#' ? 'home' : h.replace(/^#/, '');
      if (target === pageSlug) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
    });
  }

  /* ---------- photo grid and viewer ---------- */
  let lbList = [];
  let lbAt = 0;
  let lastPointer = 'mouse';
  document.addEventListener('pointerdown', (e) => { lastPointer = e.pointerType; }, true);

  function tileLabel(x, collName) {
    const coll = collName || x.colls[0] || '';
    return { title: x.title || x.spot || coll, sub: [coll, x.area].filter(Boolean).join(' · ') };
  }

  function photoGrid(list, opts = {}) {
    const wrap = el('div', 'grid-wrap');
    const grid = el('div', 'grid');
    const more = el('button', 'btn', 'More photos');
    more.type = 'button';
    let limit = opts.limit || PAGE;
    const draw = () => {
      grid.replaceChildren();
      list.slice(0, limit).forEach((x, i) => {
        const b = el('button', 'ph');
        b.type = 'button';
        b.style.setProperty('--r', ratio(x.p).toFixed(4));
        const lab = tileLabel(x, opts.collection);
        b.setAttribute('aria-label', `Open photo: ${[lab.title, lab.sub, fmtDate(x.date)].filter(Boolean).join(', ')}`);
        const img = el('img');
        img.alt = '';
        img.loading = i < 6 ? 'eager' : 'lazy';
        img.decoding = 'async';
        img.dataset.loading = '';
        img.addEventListener('load', () => {
          delete img.dataset.loading;
          if (!sizes[x.p] && img.naturalWidth) {
            b.style.setProperty('--r', (img.naturalWidth / img.naturalHeight).toFixed(4));
            fit();
          }
        }, { once: true });
        img.src = src(x.p, 900);
        const tag = el('span', 'tag');
        tag.append(el('span', 'tag-title', lab.title), el('span', 'tag-sub', lab.sub));
        const exp = el('span', 'expand');
        exp.setAttribute('aria-hidden', 'true');
        b.append(img, tag, exp);
        if (x.draft) b.append(hiddenTag());
        // on a phone the first tap shows the label and the second opens the photo
        b.addEventListener('click', (e) => {
          if (lastPointer === 'touch' && !b.classList.contains('show') && !e.target.closest('.expand')) {
            grid.querySelectorAll('.ph.show').forEach((o) => o.classList.remove('show'));
            b.classList.add('show');
            return;
          }
          openLb(list, i, opts.collection);
        });
        grid.append(b);
      });
      more.hidden = list.length <= limit;
      fit();
    };
    // when every photo fits in one row, stretch them to the full width
    const fit = () => {
      const w = grid.clientWidth;
      if (!w) return;
      const row = parseFloat(getComputedStyle(grid).getPropertyValue('--row')) || 260;
      const gap = parseFloat(getComputedStyle(grid).columnGap) || 0;
      const tiles = [...grid.children];
      const need = tiles.reduce((t, c) => t + (parseFloat(c.style.getPropertyValue('--r')) || 1.5) * row, 0) + gap * (tiles.length - 1);
      grid.classList.toggle('fill', tiles.length > 0 && need <= w);
    };
    new ResizeObserver(fit).observe(grid);
    more.addEventListener('click', () => {
      const first = limit;
      limit += PAGE;
      draw();
      grid.children[first]?.focus();
    });
    draw();
    const row = el('p', 'more-row');
    row.append(more);
    wrap.append(grid, row);
    wrap.redraw = (newList) => { list = newList; limit = opts.limit || PAGE; draw(); };
    return wrap;
  }

  const lb = $('#lb');
  let lbColl = '';
  function showLb() {
    const x = lbList[lbAt];
    if (!x) return;
    const img = $('#lb-img');
    img.src = src(x.p, 2000);
    const lab = tileLabel(x, lbColl);
    img.alt = [lab.title, lab.sub].filter(Boolean).join(', ');
    $('#lb-count').textContent = `${lbAt + 1} / ${lbList.length}`;
    $('#lb-cap').textContent = [lab.title, lab.sub, fmtDate(x.date)].filter(Boolean).join(' · ');
    $('#lb-desc').textContent = x.description || '';
    const name = String(x.p).split('/').pop().split('?')[0];
    const ask = $('#lb-ask');
    const text = `Hi, I'm asking about this photo: ${[x.spot, fmtDate(x.date)].filter(Boolean).join(', ')} (${name}).`;
    const h = wa(text) || (email() ? `mailto:${email()}?subject=${encodeURIComponent('Photo enquiry')}&body=${encodeURIComponent(text)}` : null);
    ask.hidden = !h;
    if (h) ask.href = h;
    [lbAt + 1, lbAt - 1].forEach((k) => { if (lbList[k]) new Image().src = src(lbList[k].p, 2000); });
  }
  function openLb(list, i, coll) {
    lbList = list;
    lbAt = i;
    lbColl = coll || '';
    showLb();
    lb.showModal();
  }
  const step = (d) => { lbAt = (lbAt + d + lbList.length) % lbList.length; showLb(); };
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
    return /^[\w-]{11}$/.test(String(u || '').trim()) ? String(u).trim() : null;
  };
  function filmGrid(list) {
    const grid = el('div', 'films');
    list.forEach((v) => {
      const id = ytId(v.url);
      if (!id) return;
      const fig = el('figure', 'film');
      if (/\/shorts\//.test(v.url)) fig.classList.add('vertical');
      const frame = el('div', 'film-frame');
      const btn = el('button');
      btn.type = 'button';
      btn.setAttribute('aria-label', `Play ${v.title || 'video'}`);
      const img = el('img');
      img.alt = '';
      img.loading = 'lazy';
      img.src = `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
      btn.append(img, el('span', 'play'));
      // the YouTube player only loads when someone presses play
      btn.addEventListener('click', () => {
        const f = el('iframe');
        f.src = `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0&playsinline=1`;
        f.title = v.title || 'Video';
        f.allow = 'autoplay; encrypted-media; picture-in-picture; fullscreen';
        f.allowFullscreen = true;
        frame.replaceChildren(f);
      });
      frame.append(btn);
      if (isHidden(v)) frame.append(hiddenTag());
      fig.append(frame);
      if (v.title) fig.append(el('h3', null, v.title));
      const meta = [v.spot, fmtMonth(v.date)].filter(Boolean).join(' · ');
      if (meta) fig.append(el('p', null, meta));
      grid.append(fig);
    });
    return grid;
  }

  /* ---------- sections ---------- */
  let headingLevel = 'h2';
  function sectionShell(s, cls) {
    const sec = el('section', `block ${cls || ''}`.trim());
    const wrap = el('div', 'wrap');
    if (s.heading) {
      const h = el(headingLevel, 'sec-title', s.heading);
      headingLevel = 'h2';
      wrap.append(h);
    }
    if (isHidden(s)) wrap.prepend(hiddenTag());
    sec.append(wrap);
    return { sec, wrap };
  }
  const paras = (text, cls) => (String(text || '').trim() ? [rich(text, cls)] : []);

  function buttonsRow(items) {
    const row = el('p', 'btn-row');
    (items || []).forEach((it, i) => {
      const [label, link] = String(it).split('|').map((s) => s.trim());
      if (!label) return;
      const a = linkEl(label, link || label, i === 0 ? 'btn' : 'btn btn-line');
      if (a.getAttribute('href') === '#' && link && !resolveLink(link)) return;
      row.append(a);
    });
    return row.children.length ? row : null;
  }

  const SECTIONS = {
    Text(s) {
      const { sec, wrap } = sectionShell(s, s.image ? 'text split' : 'text');
      const body = el('div', 'text-body');
      body.append(...paras(s.text));
      const row = buttonsRow(s.items);
      if (row) body.append(row);
      if (s.image) {
        const grid = el('div', 'split-row');
        const img = el('img', 'split-img');
        img.alt = '';
        img.loading = 'lazy';
        img.src = src(s.image, 1200);
        const h = wrap.querySelector('.sec-title');
        if (h) body.prepend(h);
        grid.append(img, body);
        wrap.append(grid);
      } else {
        wrap.append(body);
      }
      return sec;
    },

    'Photos and videos'(s, page) {
      const { sec, wrap } = sectionShell(s, 'gallery');
      wrap.append(...paras(s.text, 'sub'));
      const list = (s.photos || []).filter(Boolean).map((p, n) => ({ p, n: n + 1, spot: '', area: '', colls: [page.title], title: page.title, description: '', date: '' }));
      if (list.length) sec.append(photoGrid(list, { collection: page.title }));
      const vids = (s.videos || []).filter(Boolean).map((url) => ({ url }));
      if (vids.length) {
        const w = el('div', 'wrap gallery-films');
        w.append(filmGrid(vids));
        sec.append(w);
      }
      return sec;
    },

    Details(s) {
      const { sec, wrap } = sectionShell(s, 'details');
      wrap.append(...paras(s.text, 'sub'));
      const dl = el('dl', 'spec');
      (s.items || []).forEach((it) => {
        const i = String(it).indexOf(':');
        const row = el('div', 'spec-row');
        if (i > 0) row.append(el('dt', null, it.slice(0, i).trim()), el('dd', null, it.slice(i + 1).trim()));
        else row.append(el('dd', 'spec-wide', String(it).trim()));
        dl.append(row);
      });
      wrap.append(dl);
      return sec;
    },

    List(s) {
      const { sec, wrap } = sectionShell(s, 'list');
      wrap.append(...paras(s.text, 'sub'));
      const ul = el('ul', 'ticks');
      (s.items || []).filter(Boolean).forEach((it) => ul.append(el('li', null, it)));
      wrap.append(ul);
      return sec;
    },

    Buttons(s) {
      const { sec, wrap } = sectionShell(s, 'buttons center');
      wrap.append(...paras(s.text, 'sub'));
      const row = buttonsRow(s.items);
      if (row) wrap.append(row);
      return sec;
    },

    Films(s) {
      const { sec, wrap } = sectionShell(s, 'films-sec');
      wrap.append(...paras(s.text, 'sub'));
      const yt = safeUrl(S.youtube);
      if (yt && !/\[/.test(yt)) {
        const p = el('p', 'sub');
        const a = el('a', 'link', 'All films on YouTube');
        a.href = yt; a.target = '_blank'; a.rel = 'noopener';
        p.append(a);
        wrap.append(p);
      }
      const list = videos.map((v, i) => ({ ...v, i })).filter(visible)
        .sort((a, b) => (Date.parse(b.date) || 0) - (Date.parse(a.date) || 0) || b.i - a.i);
      wrap.append(filmGrid(list));
      return sec;
    },

    Contact(s) {
      const { sec, wrap } = sectionShell(s, 'contact center');
      wrap.append(...paras(s.text, 'sub'));
      const row = el('p', 'btn-row');
      const w = wa('Hi, I found you through your website.');
      if (w) { const a = el('a', 'btn', 'WhatsApp'); a.href = w; a.target = '_blank'; a.rel = 'noopener'; row.append(a); }
      const ig = String(S.instagram || '').replace(/^@/, '').trim();
      if (!isPlaceholder(ig)) { const a = el('a', 'btn btn-line', 'Instagram'); a.href = `https://www.instagram.com/${encodeURIComponent(ig)}/`; a.target = '_blank'; a.rel = 'noopener'; row.append(a); }
      if (email()) { const a = el('a', 'btn btn-line', 'Email'); a.href = `mailto:${email()}`; row.append(a); }
      if (row.children.length) wrap.append(row);
      const plain = [waNumber() ? `+${waNumber()}` : '', email()].filter(Boolean).join(' · ');
      if (plain) wrap.append(el('p', 'contact-plain', plain));
      if (!row.children.length) wrap.append(el('p', 'warn', 'Add the WhatsApp number, Instagram or email under Site in the CMS.'));
      return sec;
    },

    'Enquiry form'(s, page) {
      const { sec, wrap } = sectionShell(s, 'enquiry');
      wrap.append(...paras(s.text, 'sub'));
      if (!waNumber() && !email()) wrap.append(el('p', 'warn', 'The form needs a WhatsApp number or an email under Site in the CMS.'));
      const form = el('form', 'form');
      form.noValidate = true;
      const field = (name, label, type, hint, wide) => {
        const lab = el('label', wide ? 'f wide' : 'f');
        lab.append(el('span', 'f-label', label));
        const input = type === 'textarea' ? el('textarea') : el('input');
        if (type !== 'textarea') input.type = type;
        input.name = name;
        if (hint) input.placeholder = hint;
        if (type === 'textarea') input.rows = 4;
        lab.append(input);
        form.append(lab);
        return input;
      };
      field('name', 'Name', 'text').required = true;
      field('email', 'Email', 'email');
      field('phone', 'WhatsApp number', 'tel');
      field('dates', 'Dates', 'text', 'Example: 10 to 20 May 2027');
      field('guests', 'Guests', 'number', '4').min = 1;
      field('message', 'Message', 'textarea', 'Which breaks, surf level, anything else', true);
      const err = el('p', 'form-err');
      err.setAttribute('role', 'alert');
      const row = el('p', 'btn-row form-row');
      const viaWa = el('button', 'btn', 'Send on WhatsApp');
      viaWa.type = 'submit';
      viaWa.value = 'wa';
      const viaMail = el('button', waNumber() ? 'btn btn-line' : 'btn', 'Send by email');
      viaMail.type = 'submit';
      viaMail.value = 'mail';
      if (waNumber()) row.append(viaWa);
      if (email()) row.append(viaMail);
      form.append(err, row);
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        const f = Object.fromEntries(new FormData(form));
        if (!f.name.trim()) { err.textContent = 'Name is missing.'; form.elements.name.focus(); return; }
        if (!f.email.trim() && !f.phone.trim()) { err.textContent = 'Add an email or a WhatsApp number so we can reply.'; form.elements.email.focus(); return; }
        err.textContent = '';
        const body = [
          `Hi, I'd like to ask about ${page.slug === 'home' || page.slug === 'contact' ? 'a booking' : page.title}.`,
          `Name: ${f.name.trim()}`,
          f.email.trim() && `Email: ${f.email.trim()}`,
          f.phone.trim() && `WhatsApp: ${f.phone.trim()}`,
          f.dates.trim() && `Dates: ${f.dates.trim()}`,
          f.guests && `Guests: ${f.guests}`,
          f.message.trim(),
        ].filter(Boolean).join('\n');
        const how = (e.submitter && e.submitter.value) || (waNumber() ? 'wa' : 'mail');
        const url = how === 'wa' ? wa(body) : `mailto:${email()}?subject=${encodeURIComponent(`Enquiry: ${page.title}`)}&body=${encodeURIComponent(body)}`;
        if (how === 'wa') window.open(url, '_blank', 'noopener'); else location.href = url;
      });
      wrap.append(form);
      return sec;
    },

    Collections(s, page, route) {
      const lvl = headingLevel;
      const { sec, wrap } = sectionShell(s, 'collections');
      const home = pages.find((p) => p.slug !== 'home' && (p.sections || []).some((x) => x.kind === 'Collections' && visible(x)));
      const base = page.slug === 'home' && home ? home.slug : page.slug;
      const chosen = route.sub && (route.sub === 'all' ? { name: 'All Photos', slug: 'all', items: allPhotos, description: '' } : collections.find((c) => c.slug === route.sub));
      if (chosen && page.slug === base) {
        sec.id = 'collection';
        wrap.querySelector('.sec-title')?.remove();
        const back = el('a', 'back', 'All collections');
        back.href = `#${base}`;
        wrap.append(back, el(lvl, 'sec-title', chosen.name));
        if (isHidden(chosen)) wrap.append(hiddenTag());
        wrap.append(...paras(chosen.description, 'sub'));
        const here = [...new Set(chosen.items.map((x) => x.spot).filter(Boolean))].sort();
        const grid = photoGrid(chosen.items, { collection: chosen.slug === 'all' ? '' : chosen.name });
        if (here.length > 1) {
          const lab = el('label', 'spot-pick');
          lab.append(el('span', 'vh', 'Location'));
          const sel = el('select');
          sel.append(new Option('All locations', ''));
          here.forEach((n) => sel.append(new Option(n, n)));
          sel.addEventListener('change', () => grid.redraw(sel.value ? chosen.items.filter((x) => x.spot === sel.value) : chosen.items));
          lab.append(sel);
          const f = el('div', 'filters');
          f.append(lab);
          wrap.append(f);
        }
        sec.append(grid);
        return sec;
      }
      wrap.append(...paras(s.text, 'sub'));
      const cards = el('div', 'cards');
      const all = { name: 'All Photos', slug: 'all', items: allPhotos, coverSrc: allPhotos[0] && allPhotos[0].p, description: 'Every photo, newest first.' };
      // a collection with no cover set uses its newest photo that no earlier card shows
      const used = new Set(collections.map((c) => c.cover).filter(Boolean));
      [all, ...collections].forEach((c) => {
        if (!c.cover) {
          const pick = c.items.find((x) => !used.has(x.p)) || c.items[0];
          c.coverSrc = pick ? pick.p : '';
        }
        if (c.coverSrc) used.add(c.coverSrc);
        if (!c.coverSrc && !PREVIEW) return;
        const a = el('a', 'card');
        a.href = `#${base}/${c.slug}`;
        const fig = el('div', 'card-img');
        if (c.coverSrc) {
          const img = el('img');
          img.alt = '';
          img.loading = 'lazy';
          img.src = src(c.coverSrc, 900);
          fig.append(img);
        }
        if (isHidden(c)) fig.append(hiddenTag());
        a.append(fig, el('h3', null, c.name));
        if (c.description) a.append(el('p', null, c.description));
        a.append(el('span', 'count', `${c.items.length} ${c.items.length === 1 ? 'photo' : 'photos'}`));
        cards.append(a);
      });
      wrap.append(cards);
      return sec;
    },
  };

  /* ---------- pages ---------- */
  function hero(page) {
    if (!page.hero) return null;
    const isHome = page.slug === 'home';
    const sec = el('section', isHome ? 'hero' : 'hero hero-page');
    sec.setAttribute('aria-label', page.title);
    const img = el('img', 'hero-img');
    img.alt = '';
    img.fetchPriority = 'high';
    img.src = src(page.hero, 2200);
    if (/unsplash/.test(page.hero)) img.srcset = `${src(page.hero, 1100)} 1100w, ${src(page.hero, 2200)} 2200w`;
    const t = el('div', 'hero-text wrap');
    if (isHome) {
      t.append(el('p', 'kicker', [S.tagline, S.location].filter(Boolean).join(' · ')), el('h1', null, S.name || page.title));
    } else {
      t.append(el('h1', null, page.title));
      if (page.hero_text) t.append(el('p', 'kicker hero-sub', page.hero_text));
    }
    sec.append(img, t);
    return sec;
  }

  function parseRoute() {
    const [p, sub] = decodeURIComponent(location.hash.replace(/^#/, '')).split('/');
    return { page: slug(p) || 'home', sub: slug(sub) };
  }

  let current = null;
  function render() {
    const route = parseRoute();
    const page = pages.find((p) => p.slug === route.page && visible(p));
    if (!page) {
      // #main and other in-page anchors are not pages
      if (current) return;
      route.page = 'home';
    }
    const pg = page || pages.find((p) => p.slug === 'home' && visible(p)) || pages.find(visible);
    if (!pg) return;
    const samePage = current === pg.slug;
    current = pg.slug;

    const main = $('#main');
    main.replaceChildren();
    if (PREVIEW) {
      const bar = el('div', 'preview-bar');
      bar.append(el('p', null, 'Preview. Items marked Hidden are not on the live site.'));
      [...new Set(problems)].forEach((t) => bar.append(el('p', 'preview-problem', t)));
      main.append(bar);
    }
    if (isHidden(pg)) main.append(hiddenTag());
    const h = hero(pg);
    headingLevel = h ? 'h2' : 'h1';
    if (h) main.append(h);
    (pg.sections || []).filter(visible).forEach((s) => {
      const fn = SECTIONS[s.kind];
      const node = fn && fn(s, pg, route);
      if (node) main.append(node);
    });

    document.title = pg.slug === 'home'
      ? [S.name, S.tagline].filter((x) => x && !isPlaceholder(x)).join(' | ') || document.title
      : [pg.title, S.name].filter(Boolean).join(' | ');
    const desc = pg.description || '';
    if (desc) document.querySelector('meta[name="description"]').content = desc;
    markNav(pg.slug);

    if (samePage && route.sub) $('#collection')?.scrollIntoView();
    else if (!samePage || !route.sub) window.scrollTo(0, 0);
  }

  function applySettings() {
    document.querySelectorAll('[data-set]').forEach((n) => { n.textContent = S[n.dataset.set] || ''; });
    $('#year').textContent = new Date().getFullYear();
  }

  /* ---------- start ---------- */
  Promise.all([
    'content/settings.json', 'content/menu.json', 'content/pages.json', 'content/collections.json',
    'content/spots.json', 'content/photos.json', 'content/videos.json', 'media/_sizes.json',
  ].map(getJSON)).then(([s, m, p, c, sp, ph, v, sz]) => {
    S = s || {};
    menu = m || [];
    pages = (p || []).map((x) => ({ ...x, slug: slug(x.slug || x.title) || 'home' }));
    spots = sp || [];
    sizes = sz || {};
    videos = v || [];
    collections = (c || []).map((x) => ({ ...x, slug: slug(x.name) }));
    allPhotos = buildPhotos(ph);
    collections = buildCollections(c);
    applySettings();
    buildNav();
    render();
    addEventListener('hashchange', render);
  });
})();
