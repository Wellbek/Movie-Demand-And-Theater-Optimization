// SLOTWISE demo UI. All calculations live in engine.js (window.Engine); this file only
// binds settings, runs the engine and draws results, explanations and charts.
(function () {
  'use strict';
  const E = window.Engine;
  const $ = (id) => document.getElementById(id);
  const fmt = (x) => Math.round(x).toLocaleString('en-US');
  const fmt1 = (x) => (Math.round(x * 10) / 10).toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const sgn = (x) => { const v = Math.round(x); return v === 0 ? '0' : (v > 0 ? '+' : '-') + fmt(Math.abs(v)); };
  const pct = (x) => (x >= 0 ? '+' : '') + (x * 100).toFixed(1) + '%';
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const STUDY = /*__STUDY__*/;

  let settings = loadSettings();
  let result = null; // last successful run
  const view = { dt: 1, day: 5, planMode: 'side' };

  // ------------------------------------------------------------------ settings <-> address bar
  function loadSettings() {
    const def = E.defaultSettings();
    try {
      const m = /[#&]s=([^&]+)/.exec(location.hash);
      if (!m) return def;
      const s = JSON.parse(decodeURIComponent(m[1]));
      return { ...def, ...s, halls: Array.isArray(s.halls) ? s.halls : def.halls, limits: s.limits || {}, pins: s.pins || {} };
    } catch (e) {
      return def;
    }
  }
  function saveSettings() {
    try { history.replaceState(null, '', '#s=' + encodeURIComponent(JSON.stringify(settings))); } catch (e) { /* file:// in some browsers */ }
  }

  // ------------------------------------------------------------------ posters (inline SVG, no image files)
  const filmColor = (film, l) => 'hsl(' + film.hue + ',55%,' + (l || 38) + '%)';
  function emblem(tag, hue) {
    const c1 = 'hsl(' + hue + ',70%,62%)', c2 = 'hsl(' + hue + ',60%,82%)';
    switch (tag) {
      case 'caterpillar-man': return [0, 1, 2, 3, 4, 5].map((i) => '<circle cx="' + (52 + i * 19) + '" cy="' + (118 - Math.sin(i / 1.6) * 34) + '" r="' + (i === 5 ? 19 : 15) + '" fill="' + (i === 5 ? '#d7263d' : c1) + '" stroke="#111" stroke-width="3"/>').join('') + '<path d="M150 70l12-22M160 76l20-14" stroke="#111" stroke-width="4" fill="none"/><path d="M140 82l14 6M140 92h16" stroke="#fff" stroke-width="3"/>';
      case 'avocado-2': return '<ellipse cx="100" cy="110" rx="54" ry="70" fill="#2f5d1e"/><ellipse cx="100" cy="114" rx="43" ry="58" fill="#c9e27a"/><circle cx="100" cy="130" r="24" fill="#7a4a1f"/><circle cx="92" cy="122" r="6" fill="#a8743f"/>';
      case 'defrosted-2': return '<g stroke="' + c2 + '" stroke-width="5" stroke-linecap="round">' + [0, 60, 120].map((a) => '<line x1="100" y1="50" x2="100" y2="150" transform="rotate(' + a + ' 100 100)"/>').join('') + '</g><path d="M86 150q4 16 0 24a6 6 0 1 0 8 0q-4-8 0-24z" fill="' + c2 + '"/><path d="M118 148q3 10 0 15a5 5 0 1 0 6 0q-3-5 0-15z" fill="' + c2 + '"/>';
      case 'gigantic': return '<path d="M30 140h140l-18 30H48z" fill="#111"/><rect x="62" y="112" width="76" height="28" fill="#eee"/><rect x="74" y="88" width="12" height="24" fill="#c0392b"/><rect x="96" y="88" width="12" height="24" fill="#c0392b"/><rect x="118" y="88" width="12" height="24" fill="#c0392b"/><path d="M150 176l22-42 20 42z" fill="' + c2 + '"/>';
      case 'outside-in-2': return ['#f1c40f', '#3498db', '#e74c3c', '#9b59b6', '#2ecc71'].map((col, i) => '<circle cx="' + (100 + 34 * Math.cos(i * 1.2566)) + '" cy="' + (108 + 34 * Math.sin(i * 1.2566)) + '" r="28" fill="' + col + '" opacity=".85"/>').join('');
      case 'oppenhammer': return '<circle cx="100" cy="70" r="30" fill="#f39c12" opacity=".8"/><circle cx="76" cy="84" r="22" fill="#e67e22" opacity=".8"/><circle cx="124" cy="84" r="22" fill="#e67e22" opacity=".8"/><rect x="94" y="96" width="12" height="80" fill="#5d4037"/><rect x="66" y="96" width="68" height="26" rx="3" fill="#bdc3c7"/>';
      case 'triassic-world': return '<ellipse cx="100" cy="140" rx="30" ry="26" fill="#2b1d0e"/><ellipse cx="66" cy="90" rx="11" ry="30" transform="rotate(-20 66 90)" fill="#2b1d0e"/><ellipse cx="100" cy="76" rx="11" ry="32" fill="#2b1d0e"/><ellipse cx="134" cy="90" rx="11" ry="30" transform="rotate(20 134 90)" fill="#2b1d0e"/>';
      case 'top-bun': return '<path d="M44 128q56-80 112 0z" fill="#d68a3a"/><rect x="44" y="128" width="112" height="10" fill="#7a3e12"/>' + [[70, 104], [92, 92], [112, 98], [132, 110], [100, 114], [80, 118]].map(([x, y]) => '<ellipse cx="' + x + '" cy="' + y + '" rx="4" ry="2.4" fill="#fff6d6"/>').join('') + '<path d="M30 112l-18-8M170 112l18-8M36 124H10M164 124h26" stroke="#ddd" stroke-width="4"/>';
      case 'scavengers-endgame': return '<path d="M100 40l52 20v44c0 40-26 64-52 76-26-12-52-36-52-76V60z" fill="#2c2c54" stroke="' + c1 + '" stroke-width="5"/><path d="M70 98q30-22 60 0q-30 14-60 0z" fill="#111"/><circle cx="86" cy="98" r="5" fill="#fff"/><circle cx="114" cy="98" r="5" fill="#fff"/>';
      default: return '<circle cx="100" cy="100" r="40" fill="' + c1 + '"/>';
    }
  }
  function poster(film, wide) {
    const id = 'g' + film.tag.replace(/[^a-z0-9]/g, '') + (wide ? 'w' : '');
    const W = wide ? 880 : 200, H = wide ? 250 : 300;
    const art = wide
      ? '<g transform="translate(560 10) scale(1.15)">' + emblem(film.tag, film.hue) + '</g>'
      : '<g transform="translate(0 6)">' + emblem(film.tag, film.hue) + '</g>';
    const titleSize = 27;
    // long titles are squeezed to the poster width instead of overflowing it
    const fit = film.title.length * titleSize * 0.66 > 184 ? ' textLength="184" lengthAdjust="spacingAndGlyphs"' : '';
    const text = wide ? '' : '<text x="100" y="246" text-anchor="middle" font-family="Helvetica Neue,Arial,sans-serif" font-weight="900" font-size="' + titleSize + '" fill="#fff" letter-spacing="-0.5"' + fit + '>' + esc(film.title.toUpperCase()) + '</text><text x="100" y="268" text-anchor="middle" font-family="Helvetica Neue,Arial,sans-serif" font-size="11" fill="rgba(255,255,255,.8)" letter-spacing="1.5">' + esc(film.tagline.toUpperCase()) + '</text>';
    return '<svg viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="xMidYMid slice" role="img" aria-label="' + esc(film.title) + ' poster (generated)"><defs><linearGradient id="' + id + '" x1="0" y1="0" x2="' + (wide ? 1 : 0.4) + '" y2="1"><stop offset="0" stop-color="hsl(' + film.hue + ',60%,30%)"/><stop offset="1" stop-color="hsl(' + ((film.hue + 30) % 360) + ',55%,9%)"/></linearGradient></defs><rect width="' + W + '" height="' + H + '" fill="url(#' + id + ')"/>' + art + text + (wide ? '' : '<text x="10" y="26" font-family="Helvetica Neue,Arial,sans-serif" font-weight="900" font-size="24" fill="#e50914" transform="scale(1 1.2) translate(0 -4)">S</text>') + '</svg>';
  }
  function heroArt(film) {
    // abstract auditorium: rows of seats in perspective under a projector beam
    let seats = '';
    for (let r = 0; r < 7; r++) {
      const y = 520 + r * 58, w = 34 + r * 5, gap = 10 + r * 2, n = 18 + r * 2;
      const x0 = 800 - (n * (w + gap)) / 2;
      for (let i = 0; i < n; i++) {
        const lit = (i * 7 + r * 3) % 5 === 0;
        seats += '<rect x="' + (x0 + i * (w + gap)) + '" y="' + y + '" width="' + w + '" height="' + (22 + r * 3) + '" rx="6" fill="' + (lit ? '#7a0a10' : '#2a0b0d') + '" opacity="' + (0.55 + r * 0.06) + '"/>';
      }
    }
    return '<svg viewBox="0 0 1600 900" preserveAspectRatio="xMidYMid slice"><defs><radialGradient id="hg" cx="0.72" cy="0.18" r="0.9"><stop offset="0" stop-color="#6b0b10"/><stop offset=".45" stop-color="#220607"/><stop offset="1" stop-color="#141414"/></radialGradient><linearGradient id="beam" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".22"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient></defs><rect width="1600" height="900" fill="url(#hg)"/><rect x="430" y="60" width="980" height="380" rx="8" fill="' + (film ? 'hsl(' + film.hue + ',45%,14%)' : '#0b0b0b') + '" stroke="#3a0a0d" stroke-width="3"/>' + (film ? '<g opacity=".55" transform="translate(760 70) scale(1.8)">' + emblem(film.tag, film.hue) + '</g><text x="920" y="425" text-anchor="middle" font-family="Helvetica Neue,Arial,sans-serif" font-weight="900" font-size="34" fill="rgba(255,255,255,.35)" letter-spacing="2">NOW PLANNING: ' + esc(film.title.toUpperCase()) + '</text>' : '') + '<path d="M1180 900L820 440h460z" fill="url(#beam)" opacity=".5"/>' + seats + '</svg>';
  }

  // ------------------------------------------------------------------ modal
  function openModal(html) {
    $('modalBody').innerHTML = html;
    $('modalBack').classList.add('on');
    document.body.style.overflow = 'hidden';
    $('modalX').focus();
  }
  function closeModal() {
    $('modalBack').classList.remove('on');
    document.body.style.overflow = '';
  }
  $('modalX').addEventListener('click', closeModal);
  $('modalBack').addEventListener('click', (e) => { if (e.target === $('modalBack')) closeModal(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeModal(); });

  // ------------------------------------------------------------------ settings form
  function bindNumber(id, key, isFloat) {
    const el = $(id);
    el.value = settings[key];
    el.addEventListener('input', () => {
      settings[key] = el.value === '' ? NaN : isFloat ? parseFloat(el.value) : Number(el.value);
      changed(key);
    });
  }
  function changed(key) {
    document.body.classList.add('dirty');
    if (key === 'filmCount' || key === 'newRelease') renderFilmRows();
    if (['firstStart', 'slots', 'slotMinutes', 'cleaning'].includes(key)) gridPreview();
  }
  function fillForm() {
    ['slots', 'slotMinutes', 'cleaning', 'filmCount', 'credibility', 'seed', 'historyWeeks', 'nbShape'].forEach((k) => ($(k).value = settings[k]));
    ['newReleaseStrength', 'pastNoise'].forEach((k) => ($(k).value = settings[k]));
    $('firstStart').value = settings.firstStart;
    $('newRelease').checked = !!settings.newRelease;
    $('caution').value = settings.caution;
    $('cautionV').textContent = Number(settings.caution).toFixed(2);
    $('extraRows').value = settings.extraRows || '';
    renderHallRows();
    renderFilmRows();
    gridPreview();
    pinCount();
  }
  function renderHallRows() {
    $('hallRows').innerHTML = settings.halls.map((h, i) => '<div class="hall-row"><span>' + esc(h.name) + '</span><input type="number" min="0" max="600" step="1" data-hall="' + i + '" value="' + h.seats + '" aria-label="Seats in ' + esc(h.name) + '"><input type="checkbox" data-open="' + i + '" ' + (h.open ? 'checked' : '') + ' aria-label="' + esc(h.name) + ' open in the plan week"></div>').join('');
    $('hallRows').querySelectorAll('[data-hall]').forEach((el) => el.addEventListener('input', () => { settings.halls[+el.dataset.hall].seats = el.value === '' ? NaN : Number(el.value); changed('halls'); }));
    $('hallRows').querySelectorAll('[data-open]').forEach((el) => el.addEventListener('change', () => { settings.halls[+el.dataset.open].open = el.checked; changed('halls'); }));
  }
  function renderFilmRows() {
    const count = Number.isInteger(settings.filmCount) ? Math.max(2, Math.min(E.CATALOG.length, settings.filmCount)) : 6;
    const films = E.CATALOG.slice(0, count).concat(settings.newRelease ? [E.NEW_RELEASE] : []);
    $('filmRows').innerHTML = films.map((f) => {
      const lim = settings.limits[f.tag] || {};
      const min = lim.min === undefined || lim.min === null ? E.DEFAULT_MIN : lim.min;
      const max = lim.max === undefined || lim.max === null ? '' : lim.max;
      return '<div class="film-row"><span class="nm" title="' + esc(f.title) + '">' + esc(f.title) + ' <span class="dim">(' + f.runtime + ')</span></span><input type="number" min="0" step="1" data-min="' + f.tag + '" value="' + min + '" aria-label="Minimum shows ' + esc(f.title) + '"><input type="number" min="0" step="1" data-max="' + f.tag + '" value="' + max + '" placeholder="none" aria-label="Maximum shows ' + esc(f.title) + '"></div>';
    }).join('');
    $('filmRows').querySelectorAll('[data-min]').forEach((el) => el.addEventListener('input', () => {
      const t = el.dataset.min;
      settings.limits[t] = { ...(settings.limits[t] || {}), min: el.value === '' ? 0 : Number(el.value) };
      changed('limits');
    }));
    $('filmRows').querySelectorAll('[data-max]').forEach((el) => el.addEventListener('input', () => {
      const t = el.dataset.max;
      settings.limits[t] = { ...(settings.limits[t] || {}), max: el.value === '' ? null : Number(el.value) };
      changed('limits');
    }));
  }
  function gridPreview() {
    const ok = /^([01]\d|2[0-3]):[0-5]\d$/.test(settings.firstStart) && Number.isInteger(settings.slots) && Number.isInteger(settings.slotMinutes);
    if (!ok) { $('gridPreview').textContent = ''; return; }
    const t = E.gridOf(settings);
    const last = t[t.length - 1] + settings.slotMinutes;
    $('gridPreview').textContent = 'Shows start at ' + t.map((m) => E.toHHMM(m % 1440)).join(', ') + '; the last slot ends at ' + E.toHHMM(last % 1440) + (last >= 1440 ? ' (next day)' : '') + '. A film fits if runtime + changeover <= ' + settings.slotMinutes + ' min.';
  }
  function pinCount() {
    const n = Object.keys(settings.pins || {}).length;
    $('pinCount').textContent = n ? n + ' pinned / blocked cell' + (n > 1 ? 's' : '') + ' in force' : '';
  }
  function bindForm() {
    ['slots', 'slotMinutes', 'cleaning', 'filmCount', 'credibility', 'seed', 'historyWeeks', 'nbShape'].forEach((k) => bindNumber(k, k));
    ['newReleaseStrength', 'pastNoise'].forEach((k) => bindNumber(k, k, true));
    $('firstStart').addEventListener('input', () => { settings.firstStart = $('firstStart').value.trim(); changed('firstStart'); });
    $('newRelease').addEventListener('change', () => { settings.newRelease = $('newRelease').checked; changed('newRelease'); });
    $('caution').addEventListener('input', () => { settings.caution = parseFloat($('caution').value); $('cautionV').textContent = settings.caution.toFixed(2); changed('caution'); });
    $('extraRows').addEventListener('input', () => { settings.extraRows = $('extraRows').value; changed('extraRows'); });
    $('addHall').addEventListener('click', () => { if (settings.halls.length < 6) { settings.halls.push({ name: 'Hall ' + (settings.halls.length + 1), seats: 80, open: true }); renderHallRows(); changed('halls'); } });
    $('delHall').addEventListener('click', () => { if (settings.halls.length > 1) { settings.halls.pop(); renderHallRows(); changed('halls'); } });
    $('run').addEventListener('click', run);
    $('runTop').addEventListener('click', () => { run(); $('slate').scrollIntoView(); });
    $('reset').addEventListener('click', () => { settings = E.defaultSettings(); fillForm(); run(); });
    $('clearPins').addEventListener('click', () => { settings.pins = {}; pinCount(); run(); });
    $('dlCsv').addEventListener('click', downloadCsv);
    $('runAll').addEventListener('click', runAllCases);
  }

  // ------------------------------------------------------------------ run
  function run() {
    saveSettings();
    const t0 = performance.now();
    const r = E.run(settings);
    const ms = performance.now() - t0;
    document.body.classList.remove('dirty');
    pinCount();
    if (r.status === 'ok') {
      result = r;
      result.ms = ms;
      document.body.classList.remove('stale');
      $('heroAlert').innerHTML = '';
      $('settingsAlert').innerHTML = r.notes.length ? '<div class="alert warn small"><b>Notes on the records:</b><ul>' + r.notes.map((n) => '<li>' + esc(n) + '</li>').join('') + '</ul></div>' : '';
      renderAll();
    } else {
      document.body.classList.add('stale');
      const kind = r.status === 'infeasible' ? 'The rules cannot all be met, so no plan is shown.' : 'The inputs are invalid, so nothing was calculated.';
      const html = '<div class="alert"><b>No plan. ' + kind + '</b><ul>' + r.errors.map((e) => '<li>' + esc(e) + '</li>').join('') + '</ul><div class="small" style="margin-top:.4rem">' + (result ? 'Results further down are from the last successful run and are marked STALE.' : 'Change the settings and press Run.') + '</div></div>';
      $('heroAlert').innerHTML = html;
      $('settingsAlert').innerHTML = html;
      $('heroMeta').innerHTML = '<span class="chip" style="border-color:var(--red);color:#ff6b72">NO PLAN</span>';
    }
  }

  // ------------------------------------------------------------------ rendering
  function renderAll() {
    const r = result;
    renderHero(r);
    renderSlate(r);
    renderRecords(r);
    renderDemand(r);
    renderPlans(r);
    renderCompare(r);
  }

  function renderHero(r) {
    const b = r.scores.baseline, p = r.scores.proposed;
    const top = r.slate.map((f, i) => ({ f, t: filmStats(r, i).tickets })).sort((x, y) => y.t - x.t)[0];
    $('heroArt').innerHTML = heroArt(top.f);
    const gain = p.tickets - b.tickets;
    const open = r.problem.halls.filter((h) => h.usable).length;
    $('heroTitle').textContent = 'Next week at ' + r.settings.venue;
    $('heroMeta').innerHTML = '<span class="match">' + pct(gain / b.tickets) + ' expected tickets vs rule of thumb</span><span class="chip">12-18 OCT 2026</span><span>' + open + ' hall' + (open === 1 ? '' : 's') + '</span><span>' + r.times.length * 7 + ' show-times</span><span class="chip">' + r.slate.length + ' FILMS</span><span class="chip">FICTIONAL</span>';
    $('heroDesc').innerHTML = 'SLOTWISE plans ' + fmt(p.tickets) + ' expected tickets against ' + fmt(b.tickets) + ' for the rule of thumb (' + sgn(gain) + '), under the same inputs and rules, and uses ' + p.untested + ' untried film-time combination' + (p.untested === 1 ? '' : 's') + ' against ' + b.untested + '. The plan is proven best for the stated formulation (duality certificate ' + (r.proposed.certificateOk ? 'holds' : 'FAILED') + '). Fictional data; real effects are untested.';
    $('heroFp').textContent = 'seed ' + r.settings.seed + ' · fingerprint ' + r.fingerprint + ' · ' + fmt(r.rowCount) + ' purchase rows · computed in ' + Math.round(r.ms) + ' ms';
  }

  function filmStats(r, f) {
    const P = r.problem;
    let shows = 0, tickets = 0;
    const plan = r.proposed.plan;
    for (let d = 0; d < 7; d++) for (let s = 0; s < P.nS; s++) plan[d][s].forEach((x, h) => { if (x === f) { shows++; tickets += P.expected(f, h, d, s); } });
    const n = r.screenings.filter((x) => x.f === f).length;
    return { shows, tickets, n, baseShows: r.checks.baseline.shows[f] };
  }

  function renderSlate(r) {
    const stats = r.slate.map((f, i) => ({ f, i, ...filmStats(r, i) }));
    const ranked = stats.slice().sort((a, b) => b.tickets - a.tickets);
    $('top10').innerHTML = ranked.map((x, k) => '<div class="t10" tabindex="0" role="button" data-film="' + x.i + '" aria-label="Rank ' + (k + 1) + ': ' + esc(x.f.title) + '"><div class="num">' + (k + 1) + '</div><div class="poster">' + poster(x.f) + (x.f.isNew ? '<span class="badge-new">New release</span>' : '') + '</div><div class="cap">' + fmt(x.tickets) + ' exp. tickets · ' + x.shows + ' shows</div></div>').join('');
    $('slateRow').innerHTML = stats.map((x) => {
      const top = ranked.indexOf(x) < 3;
      return '<div class="card" tabindex="0" role="button" data-film="' + x.i + '" aria-label="' + esc(x.f.title) + ' details"><div class="poster">' + poster(x.f) + '</div>' + (top ? '<div class="badge-top">TOP<b>' + (ranked.indexOf(x) + 1) + '</b></div>' : '') + (x.f.isNew ? '<span class="badge-new">Opens this week</span>' : '') +
        '<div class="bob"><div class="icons"><span class="circle fill">&#9654;</span><span class="circle">+</span><span class="circle" style="margin-left:auto">&#8964;</span></div>' +
        '<div class="match" style="font-size:.8rem">' + x.shows + ' shows · ' + fmt(x.tickets) + ' exp. tickets</div>' +
        '<div class="tags" style="margin:.25rem 0"><span class="chip">' + x.f.rating + (x.f.rating === 'ALL' ? '' : '+') + '</span><span>' + x.f.runtime + ' min</span><span>' + esc(x.f.genre) + '</span></div>' +
        '<div class="dim">' + (x.n ? x.n + ' screenings in the records' : 'No records: manager estimate') + ' · rule of thumb ' + x.baseShows + ' shows</div></div></div>';
    }).join('');
    document.querySelectorAll('[data-film]').forEach((el) => {
      const open = () => filmModal(+el.dataset.film);
      el.addEventListener('click', open);
      el.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); } });
    });
  }

  function filmModal(f) {
    const r = result, P = r.problem, film = r.slate[f];
    const st = filmStats(r, f);
    const cells = (t) => P.times.map((tm, s) => {
      const c = P.est.cells[P.est.cellIdx(f, s, t)];
      return '<td class="n">' + fmt(c.estimate) + '<div class="tiny dim">' + (c.n ? c.n + ' shown' : film.isNew ? 'no records' : 'untried') + '</div></td>';
    }).join('');
    const hallShows = P.halls.map((h, hi) => {
      let n = 0;
      for (let d = 0; d < 7; d++) for (let s = 0; s < P.nS; s++) if (r.proposed.plan[d][s][hi] === f) n++;
      return h.name + ': ' + n;
    }).join(' · ');
    openModal('<div class="mhead">' + poster(film, true) + '<div class="mtitle" id="modalTitle">' + esc(film.title) + '<div style="font-size:1rem;font-weight:400;color:var(--text2);margin-top:.3rem">' + esc(film.tagline) + '</div></div></div><div class="mbody">' +
      '<div class="meta"><span class="match">' + st.shows + ' shows planned (rule of thumb: ' + st.baseShows + ')</span><span class="chip">' + film.rating + (film.rating === 'ALL' ? '' : '+') + '</span><span>' + film.runtime + ' min</span><span>' + esc(film.genre) + '</span><span class="chip">' + esc(film.tag) + '</span></div>' +
      '<p>' + (st.n ? st.n + ' screenings of this film are in the records.' : 'This film has no purchase records' + (film.isNew ? ' (it opens in the planning week). Its demand is the manager\'s strength (' + r.settings.newReleaseStrength + ' x the average film) times the time and weekday indices, and it is flagged as such.' : '.')) + ' Planned expected tickets: <b>' + fmt(st.tickets) + '</b>. Shows per hall: ' + esc(hallShows) + '. Minimum ' + film.min + ', maximum ' + (film.max === null ? 'none' : film.max) + '.</p>' +
      '<h3 style="margin-top:1rem">Expected tickets per screening (posterior mean)</h3><div class="tablewrap"><table><thead><tr><th>Day type</th>' + P.times.map((t) => '<th class="n">' + E.toHHMM(t % 1440) + '</th>').join('') + '</tr></thead><tbody><tr><td>Mon-Thu</td>' + cells(0) + '</tr><tr><td>Fri-Sun</td>' + cells(1) + '</tr></tbody></table></div>' +
      '<p class="small muted">Untried = the film never played at that time and day type in the records; the number is the pattern and is valued with caution in the plan. Fit: runtime ' + film.runtime + ' + changeover ' + r.settings.cleaning + ' = ' + (film.runtime + r.settings.cleaning) + ' min vs slot ' + r.settings.slotMinutes + ' min (' + (P.fits[f] ? 'fits' : 'does NOT fit') + ').</p></div>');
  }

  function renderRecords(r) {
    const d = r.diagnostics;
    const kp = [
      ['Purchase rows', fmt(r.rowCount), r.extraCount ? r.extraCount + ' pasted by you' : 'generated'],
      ['Screenings', fmt(r.screenings.length), r.history.first + ' to ' + r.history.last],
      ['Read as sold out', fmt(d.detected), 'total = a hall size (' + (d.detected / Math.max(1, r.screenings.length) * 100).toFixed(0) + '%)'],
      ['Combinations tried', d.cellsTested + ' / ' + d.cellsTotal, 'film x time x day type'],
      ['Distinct accounts', fmt(d.accounts), 'account_tag, not used in the plan'],
    ];
    $('recKpis').innerHTML = kp.map(([l, v, s]) => '<div class="kpi"><div class="l">' + l + '</div><div class="v">' + v + '</div><div class="s">' + esc(s) + '</div></div>').join('');
    const rows = r.history.rows;
    const shown = rows.slice(0, E.MAX_ROWS_SHOWN);
    $('recTable').innerHTML = '<thead><tr>' + E.FIELDS.map((f) => '<th>' + f + '</th>').join('') + '</tr></thead><tbody>' + shown.map((x) => '<tr>' + E.FIELDS.map((f) => '<td' + (f === 'passes_bought' ? ' class="n"' : '') + '><span class="mono">' + esc(x[f]) + '</span></td>').join('') + '</tr>').join('') + '</tbody>';
    $('recNote').textContent = 'first ' + shown.length + ' of ' + fmt(rows.length) + ' generated rows';
  }
  function downloadCsv() {
    if (!result) return;
    const lines = [E.FIELDS.join(',')].concat(result.history.rows.map((x) => E.FIELDS.map((f) => x[f]).join(',')));
    const blob = new Blob([lines.join('\n') + '\n'], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'riverside-purchases-seed' + result.settings.seed + '.csv';
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }

  function heatColor(v, max) {
    const t = Math.max(0, Math.min(1, v / max));
    return 'rgba(229,9,20,' + (0.08 + 0.85 * t).toFixed(3) + ')';
  }
  function renderDemand(r) {
    const P = r.problem;
    $('dtTabs').innerHTML = [1, 0].map((t) => '<button type="button" class="tab' + (view.dt === t ? ' on' : '') + '" data-dt="' + t + '">' + E.DAY_TYPE_NAMES[t] + '</button>').join('');
    $('dtTabs').querySelectorAll('[data-dt]').forEach((b) => b.addEventListener('click', () => { view.dt = +b.dataset.dt; renderDemand(result); }));
    const max = Math.max(...P.est.cells.map((c) => c.estimate));
    let html = '<div class="hh"></div>' + P.times.map((t) => '<div class="hh">' + E.toHHMM(t % 1440) + '</div>').join('');
    r.slate.forEach((film, f) => {
      html += '<div class="rh" title="' + esc(film.title) + '">' + esc(film.title) + '</div>';
      P.times.forEach((t, s) => {
        const c = P.est.cells[P.est.cellIdx(f, s, view.dt)];
        const cls = 'hc' + (c.tested ? '' : ' untried') + (c.soldOut ? ' so' : '');
        html += '<div class="' + cls + '" style="background:' + heatColor(c.estimate, max) + '" tabindex="0" role="button" data-cell="' + f + '|' + s + '" aria-label="' + esc(film.title) + ' ' + E.toHHMM(t % 1440) + '">' + fmt(c.estimate) + '<small>' + (c.n ? c.n + ' shown' : film.isNew ? 'no rows' : 'untried') + '</small></div>';
      });
    });
    const heat = $('heat');
    heat.style.gridTemplateColumns = 'minmax(110px,1.4fr) repeat(' + P.times.length + ',minmax(58px,1fr))';
    heat.innerHTML = html;
    heat.querySelectorAll('[data-cell]').forEach((el) => {
      const open = () => { const [f, s] = el.dataset.cell.split('|').map(Number); cellModal(f, s, view.dt); };
      el.addEventListener('click', open);
      el.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); } });
    });
    $('heatLegend').innerHTML = '<span><i style="background:rgba(229,9,20,.15)"></i>low</span><span><i style="background:rgba(229,9,20,.93)"></i>high (max ' + fmt(max) + ')</span><span><i style="background:repeating-linear-gradient(135deg,rgba(255,255,255,.4) 0 3px,transparent 3px 6px)"></i>untried: pattern only</span><span><i style="background:#fff;border-radius:50%"></i>sold out at least once</span>';
    barChart('chartS', P.times.map((t) => E.toHHMM(t % 1440)), [{ name: 'S', color: '#e50914', values: Array.from(P.est.S) }], { ref: 1, decimals: 2 });
    barChart('chartD', E.DAY_NAMES, [{ name: 'D', color: '#e50914', values: Array.from(P.est.D) }], { ref: 1, decimals: 2 });
  }

  function cellModal(f, s, t) {
    const r = result, P = r.problem, film = r.slate[f];
    const c = P.est.cells[P.est.cellIdx(f, s, t)];
    const scr = r.screenings.filter((x) => x.f === f && x.s === s && x.t === t);
    const k = P.est.credibility;
    const rows = scr.map((x) => '<tr><td>' + x.date + '</td><td>' + E.DAY_NAMES[x.d] + '</td><td class="n">' + x.tickets + '</td><td class="n">' + fmt1(P.est.w(x.d)) + '</td><td>' + (x.soldOut ? '<span class="pill mock">SOLD OUT</span> counted as ' + fmt(Math.max(x.tickets, P.est.F[f] * P.est.S[s] * P.est.D[x.d])) : '') + '</td></tr>').join('');
    openModal('<div class="mbody" style="padding-top:2rem"><h2 id="modalTitle">' + esc(film.title) + ' · ' + E.toHHMM(P.times[s] % 1440) + ' · ' + E.DAY_TYPE_NAMES[t] + '</h2>' +
      '<div class="kpis" style="margin:.8rem 0"><div class="kpi"><div class="l">Pattern (prior mean)</div><div class="v">' + fmt1(c.pattern) + '</div><div class="s">F ' + fmt1(P.est.F[f]) + ' x S ' + P.est.S[s].toFixed(2) + ' x D ' + P.est.typeMean[t].toFixed(2) + '</div></div>' +
      '<div class="kpi"><div class="l">Own average</div><div class="v">' + (c.own === null ? 'none' : fmt1(c.own)) + '</div><div class="s">' + c.n + ' screening' + (c.n === 1 ? '' : 's') + ', exposure ' + fmt1(c.sumW) + '</div></div>' +
      '<div class="kpi"><div class="l">Posterior mean</div><div class="v">' + fmt1(c.estimate) + '</div><div class="s">' + Math.round(c.weight * 100) + '% own evidence, ' + Math.round((1 - c.weight) * 100) + '% pattern</div></div></div>' +
      '<p class="small">Prior Gamma(' + fmt1(k * c.pattern) + ', ' + k + ') with mean = pattern, worth k = ' + k + ' screening(s). Posterior Gamma(' + fmt1(c.alpha) + ', ' + fmt1(c.beta) + '): mean = ' + fmt1(c.alpha) + ' / ' + fmt1(c.beta) + ' = ' + fmt1(c.estimate) + ' tickets per screening at an average ' + E.DAY_TYPE_NAMES[t] + ' day. ' + (c.tested ? '' : (film.isNew ? 'This film has no records; the number is the manager\'s estimate times the indices.' : '<b>Untried:</b> in the plan this demand is lowered by the caution share (' + Math.round(r.settings.caution * 100) + '%) before it is valued.')) + '</p>' +
      (scr.length ? '<div class="scrollbox"><table><thead><tr><th>Date</th><th>Day</th><th class="n">Tickets</th><th class="n">Exposure w</th><th>Note</th></tr></thead><tbody>' + rows + '</tbody></table></div>' : '<p class="muted">No screening of this film at this time and day type in the records.</p>') + '</div>');
  }

  // ------------------------------------------------------------------ plans
  function shortTitle(t) { return t.length > 14 ? t.split(/[ :]/)[0] : t; }
  function renderPlans(r) {
    const P = r.problem;
    const tabs = [['side', 'Side by side'], ['week', 'Week overview']];
    $('planTabs').innerHTML = tabs.map(([k, l]) => '<button type="button" class="tab' + (view.planMode === k ? ' on' : '') + '" data-mode="' + k + '">' + l + '</button>').join('');
    $('planTabs').querySelectorAll('[data-mode]').forEach((b) => b.addEventListener('click', () => { view.planMode = b.dataset.mode; renderPlans(result); }));
    $('dayTabs').style.display = view.planMode === 'side' ? '' : 'none';
    $('dayTabs').innerHTML = E.DAY_NAMES.map((n, d) => '<button type="button" class="tab' + (view.day === d ? ' on' : '') + '" data-day="' + d + '">' + n + ' ' + E.addDays(E.PLAN_START, d).slice(8) + ' Oct</button>').join('');
    $('dayTabs').querySelectorAll('[data-day]').forEach((b) => b.addEventListener('click', () => { view.day = +b.dataset.day; renderPlans(result); }));
    const panel = (which, label) => {
      const plan = r[which].plan, other = r[which === 'proposed' ? 'baseline' : 'proposed'].plan;
      const sc = r.scores[which];
      let html = '<div class="rowtitle"><h3>' + label + '</h3><span class="small muted">' + fmt(sc.tickets) + ' expected tickets · ' + sc.untested + ' untried · ' + r.checks[which].violations.length + ' rule violations</span></div>';
      if (view.planMode === 'side') {
        const d = view.day;
        html += '<div class="sched" style="grid-template-columns:54px repeat(' + P.halls.length + ',1fr)"><div></div>' + P.halls.map((h) => '<div class="sh">' + esc(h.name) + ' · ' + h.seats + '</div>').join('');
        P.times.forEach((t, s) => {
          html += '<div class="dh">' + E.toHHMM(t % 1440) + '</div>';
          P.halls.forEach((h, hi) => html += cellHtml(which, plan, other, d, s, hi, false));
        });
        html += '</div>';
      } else {
        html += '<div class="sched" style="grid-template-columns:40px repeat(' + P.nS * P.halls.length + ',1fr)"><div></div>' + P.times.map((t) => '<div class="sh" style="grid-column:span ' + P.halls.length + '">' + E.toHHMM(t % 1440) + '</div>').join('');
        for (let d = 0; d < 7; d++) {
          html += '<div class="dh">' + E.DAY_NAMES[d] + '</div>';
          for (let s = 0; s < P.nS; s++) P.halls.forEach((h, hi) => html += cellHtml(which, plan, other, d, s, hi, true));
        }
        html += '</div><p class="tiny dim">Each time block has one column per hall (largest first as listed in Settings). Hover for details; click to open.</p>';
      }
      return html;
    };
    $('planA').innerHTML = panel('baseline', 'Rule of thumb (baseline)');
    $('planB').innerHTML = panel('proposed', 'SLOTWISE (proposed)');
    document.querySelectorAll('.sched [data-pc]').forEach((el) => el.addEventListener('click', () => {
      const [which, d, s, h] = el.dataset.pc.split('|');
      planCellModal(which, +d, +s, +h);
    }));
    $('filmLegend').innerHTML = r.slate.map((f) => '<span><i style="background:' + filmColor(f) + '"></i>' + esc(f.title) + '</span>').join('');
  }
  function cellHtml(which, plan, other, d, s, h, compact) {
    const r = result, P = r.problem;
    const f = plan[d][s][h];
    const key = d + '|' + s + '|' + h;
    const pinned = r.settings.pins[key] !== undefined;
    if (!P.halls[h].usable) return '<div class="sc closed" title="Closed">' + (compact ? '' : 'closed') + '</div>';
    if (f === null) return '<button type="button" class="sc empty' + (pinned ? ' pin' : '') + '" data-pc="' + which + '|' + key + '" title="Empty">' + (compact ? '' : (pinned ? 'blocked' : 'empty')) + '</button>';
    const film = r.slate[f];
    const exp = P.expected(f, h, d, s);
    const cls = 'sc' + (P.untried(f, s, d) ? ' flag' : '') + (pinned ? ' pin' : '') + (other[d][s][h] !== f ? ' diff' : '');
    const title = film.title + ' · ' + E.DAY_NAMES[d] + ' ' + E.toHHMM(P.times[s] % 1440) + ' · ' + P.halls[h].name + ' · ' + fmt(exp) + ' expected tickets';
    if (compact) return '<button type="button" class="' + cls + '" style="background:' + filmColor(film) + ';min-height:1.6rem;padding:.1rem" data-pc="' + which + '|' + key + '" title="' + esc(title) + '"><span class="v">' + fmt(exp) + '</span></button>';
    return '<button type="button" class="' + cls + '" style="background:' + filmColor(film) + '" data-pc="' + which + '|' + key + '" title="' + esc(title) + '"><span class="t">' + esc(shortTitle(film.title)) + '</span><span class="v">' + fmt(exp) + ' / ' + P.halls[h].seats + '</span></button>';
  }

  function planCellModal(which, d, s, h) {
    const r = result, P = r.problem;
    const plan = r[which].plan;
    const ex = E.explainCell(P, plan, d, s, h);
    const key = d + '|' + s + '|' + h;
    const pinned = r.settings.pins[key];
    const chosen = ex.chosen === null ? null : r.slate[ex.chosen];
    const why = which === 'proposed'
      ? 'The linear program chooses the whole week at once. A film with a higher value here can still go elsewhere when its shows are worth more at another time, or when minimum shows of other films must be met.'
      : 'The rule of thumb fills the best-selling day-times first, biggest hall first, with the highest-scoring film that still has shows left; it does not look at this film\'s demand at this time.';
    const rows = ex.options.map((o) => {
      let status = '';
      if (o.chosen) status = '<span class="pill pass">CHOSEN</span>';
      else if (!o.fits) status = 'does not fit the slot';
      else if (o.busyElsewhere) status = 'on in another hall now';
      const ev = o.noRows ? 'no records' : o.tested ? o.n + ' shown' : 'untried';
      const pinBtn = o.fits && !o.busyElsewhere && !o.chosen ? '<button type="button" class="btn ghost sm" data-pin="' + o.tag + '">Pin here</button>' : '';
      return '<tr><td>' + esc(o.title) + '</td><td class="n">' + fmt1(o.demand) + '</td><td class="n">' + fmt1(o.expected) + '</td><td class="n">' + fmt1(o.value) + '</td><td>' + ev + '</td><td>' + status + '</td><td>' + pinBtn + '</td></tr>';
    }).join('');
    openModal('<div class="mbody" style="padding-top:2rem"><h2 id="modalTitle">' + (which === 'proposed' ? 'SLOTWISE' : 'Rule of thumb') + ' · ' + E.DAY_NAMES[d] + ' ' + E.addDays(E.PLAN_START, d).slice(5) + ' · ' + E.toHHMM(P.times[s] % 1440) + ' · ' + esc(P.halls[h].name) + ' (' + P.halls[h].seats + ' seats)</h2>' +
      '<p>' + (chosen ? '<b>' + esc(chosen.title) + '</b> is planned here: ' + fmt1(P.expected(ex.chosen, h, d, s)) + ' expected tickets (demand ' + fmt1(P.est.demand(ex.chosen, s, d)) + ', seats ' + P.halls[h].seats + ').' : '<b>No film</b> is planned here' + (pinned === '' ? ' (blocked by you).' : '.')) + ' ' + why + '</p>' +
      '<div class="tablewrap"><table><thead><tr><th>Film</th><th class="n">Demand</th><th class="n">Expected in this hall</th><th class="n">Planning value</th><th>Evidence</th><th>Status</th><th></th></tr></thead><tbody>' + rows + '</tbody></table></div>' +
      '<p class="small muted">Expected = E[min(demand, seats)] under the posterior predictive. Planning value = the same with untried combinations lowered by the caution share. Ranked by planning value.</p>' +
      '<div class="actions">' + (pinned !== undefined ? '<button type="button" class="btn info sm" id="unpin">Remove pin / block</button>' : '<button type="button" class="btn ghost sm" id="block">Block this slot</button>') + (chosen && pinned === undefined ? '<button type="button" class="btn ghost sm" data-pin="' + chosen.tag + '">Pin ' + esc(chosen.title) + ' here</button>' : '') + '<span class="small muted">Pins apply to both plans and the page re-runs.</span></div></div>');
    const body = $('modalBody');
    body.querySelectorAll('[data-pin]').forEach((b) => b.addEventListener('click', () => { settings.pins[key] = b.dataset.pin; closeModal(); run(); }));
    if ($('block')) $('block').addEventListener('click', () => { settings.pins[key] = ''; closeModal(); run(); });
    if ($('unpin')) $('unpin').addEventListener('click', () => { delete settings.pins[key]; closeModal(); run(); });
  }

  // ------------------------------------------------------------------ comparison
  function renderCompare(r) {
    const b = r.scores.baseline, p = r.scores.proposed;
    const kp = [
      ['Expected tickets', fmt(b.tickets) + ' &rarr; ' + fmt(p.tickets), sgn(p.tickets - b.tickets) + ' (' + pct((p.tickets - b.tickets) / b.tickets) + ') under the same estimate', 'up'],
      ['Planning value', fmt(b.value) + ' &rarr; ' + fmt(p.value), 'what the optimiser maximises (caution applied)', ''],
      ['Untried combinations', b.untested + ' &rarr; ' + p.untested, 'screenings relying on extrapolation', ''],
      ['Expected turned away', fmt(b.away) + ' &rarr; ' + fmt(p.away), 'demand that finds the hall full', ''],
      ['Empty seats (expected)', fmt(b.empty) + ' &rarr; ' + fmt(p.empty), 'open halls only', ''],
      ['Rule violations', r.checks.baseline.violations.length + ' &rarr; ' + r.checks.proposed.violations.length, 'one film per hall, no clash, show limits, slot fit', ''],
    ];
    $('kpis').innerHTML = kp.map(([l, v, s, c]) => '<div class="kpi"><div class="l">' + l + ' <span class="dim">baseline &rarr; SLOTWISE</span></div><div class="v ' + c + '">' + v + '</div><div class="s">' + s + '</div></div>').join('');
    const perDay = (sc) => E.DAY_NAMES.map((n, d) => sc.perSlot.filter((x) => x.d === d).reduce((a, x) => a + x.tickets, 0));
    barChart('chartDay', E.DAY_NAMES, [{ name: 'Rule of thumb', color: '#808080', values: perDay(b) }, { name: 'SLOTWISE', color: '#e50914', values: perDay(p) }], {});
    barChart('chartShows', r.slate.map((f) => shortTitle(f.title)), [{ name: 'Rule of thumb', color: '#808080', values: r.checks.baseline.shows }, { name: 'SLOTWISE', color: '#e50914', values: r.checks.proposed.shows }], { mins: r.slate.map((f) => f.min) });
    const lp = r.proposed.lp, pr = r.proposed.prices;
    $('certPanel').innerHTML = '<h3>Is it the best plan? <span class="pill ' + (r.proposed.certificateOk ? 'pass' : 'fail') + '">' + (r.proposed.certificateOk ? 'CERTIFIED' : 'NOT CERTIFIED') + '</span></h3>' +
      '<table><tbody><tr><td>Linear program</td><td class="n">' + lp.vars + ' variables, ' + lp.rows + ' rules, ' + lp.pivots + ' simplex pivots</td></tr>' +
      '<tr><td>Plan value (primal)</td><td class="n">' + fmt1(lp.objective) + '</td></tr><tr><td>Upper bound from dual prices</td><td class="n">' + fmt1(lp.dualBound) + '</td></tr>' +
      '<tr><td>Largest reduced cost (must be &le; 0)</td><td class="n">' + lp.maxReducedCost.toExponential(1) + '</td></tr><tr><td>Whole-numbered schedule</td><td class="n">yes (checked)</td></tr></tbody></table>' +
      '<p class="small">Bound = value, so no feasible week scores higher <i>under the stated formulation and estimates</i>; it says nothing about rules or effects the formulation omits.</p>' +
      '<h3 style="margin-top:.8rem">What the rules cost (dual prices)</h3>' +
      (pr.min.length ? '<ul class="small">' + pr.min.map((x) => '<li>Each required show of <b>' + esc(x.title) + '</b> costs ' + fmt1(x.price) + ' expected tickets (its minimum binds).</li>').join('') + '</ul>' : '<p class="small">No minimum-show rule binds: the minimums cost nothing this week.</p>') +
      '<p class="tiny dim">Valid for small changes only (one show more or less).</p>';
    const bt = r.backtest;
    $('backtestPanel').innerHTML = '<h3>Does the estimate predict? (backtest on the records)</h3>' + (bt.available
      ? '<p class="small">Learn from the first ' + bt.trainWeeks + ' week(s), predict the ' + bt.testScreenings + ' screenings of the last recorded week (from ' + bt.cut + '). Error = weighted absolute percentage error (lower is better); a sold-out screening counts only if the prediction is below its seats.</p><table><thead><tr><th>Estimate</th><th class="n">Error (WAPE)</th></tr></thead><tbody>' + bt.methods.map((m) => '<tr><td>' + esc(m.label) + '</td><td class="n">' + (m.wape * 100).toFixed(1) + '%</td></tr>').join('') + '</tbody></table><p class="tiny dim">This checks only combinations the past programmer chose; untried combinations cannot be backtested, which is why the plan is cautious there and why the trial (proposal) tests a few deliberately.</p>'
      : '<p class="small">' + esc(bt.reason) + ' No backtest score is shown rather than a misleading one.</p>') +
      '<p class="small">Across the 40 fictional histories of the study (default settings): selected ' + (STUDY.results.sensible['backtest WAPE blend'].mean * 100).toFixed(1) + '%, pattern only ' + (STUDY.results.sensible['backtest WAPE pattern'].mean * 100).toFixed(1) + '%, own average ' + (STUDY.results.sensible['backtest WAPE cellAverage'].mean * 100).toFixed(1) + '%, film average ' + (STUDY.results.sensible['backtest WAPE filmAverage'].mean * 100).toFixed(1) + '%. One seed can rank them differently; the average is the evidence.</p>';
    renderMock(r);
  }

  function renderMock(r) {
    const b = r.scores.baseline, p = r.scores.proposed;
    const o = r.oracle ? r.oracle.truth : null;
    const wv = (w) => STUDY.results[w];
    const studyRow = (k, label) => '<tr><td>' + label + '</td><td class="n">' + fmt(wv('sensible')[k].mean) + '</td><td class="n">' + (wv('sensible')[k].diff === undefined || k.startsWith('selected') ? '' : sgn(wv('sensible')[k].diff) + ' &plusmn; ' + fmt(wv('sensible')[k].ci95)) + '</td><td class="n">' + fmt(wv('random')[k].mean) + '</td><td class="n">' + (wv('random')[k].diff === undefined || k.startsWith('selected') ? '' : sgn(wv('random')[k].diff) + ' &plusmn; ' + fmt(wv('random')[k].ci95)) + '</td></tr>';
    $('mockPanel').innerHTML = '<h3><span class="pill mock">MOCK</span> Scored against the generator\'s hidden demand</h3>' +
      '<p class="small">Only possible because the data are generated: the hidden true demand is used to compute what each plan would really sell on average. It checks the mechanism, not a real venue.</p>' +
      '<div class="kpis"><div class="kpi"><div class="l">Rule of thumb</div><div class="v">' + fmt(b.truth) + '</div><div class="s">true expected tickets</div></div><div class="kpi"><div class="l">SLOTWISE</div><div class="v up">' + fmt(p.truth) + '</div><div class="s">' + sgn(p.truth - b.truth) + ' (' + pct((p.truth - b.truth) / b.truth) + ')</div></div>' + (o ? '<div class="kpi"><div class="l">Oracle (knows the truth)</div><div class="v">' + fmt(o) + '</div><div class="s">SLOTWISE reaches ' + (p.truth / o * 100).toFixed(1) + '%</div></div>' : '') + '<div class="kpi"><div class="l">Promised vs true (SLOTWISE)</div><div class="v">' + fmt(p.tickets) + ' / ' + fmt(p.truth) + '</div><div class="s">estimate vs hidden truth</div></div></div>' +
      '<div class="actions"><button class="btn ghost sm" type="button" id="scoreAlt">Score the alternatives on these settings</button><span class="small muted">re-plans with each alternative estimate / caution and scores against the truth</span></div><div id="altTable"></div>' +
      '<h3 style="margin-top:1rem">40 fictional histories (default settings, seeds 1-40)</h3><p class="small">Mean true expected tickets per week, and the difference to the selected method with a 95% interval. "Sensible": the past programmer knew roughly what sells (default). "Random": the past schedule was close to random, so every combination was tried.</p>' +
      '<div class="tablewrap"><table><thead><tr><th>Method</th><th class="n">Sensible past</th><th class="n">vs selected</th><th class="n">Random past</th><th class="n">vs selected</th></tr></thead><tbody>' +
      studyRow('selected (blend, k=1, caution 0.5)', '<b>Selected: Bayes blend, k = 1, caution 0.5 + LP</b>') + studyRow('film average', 'Film average + LP') + studyRow('own cell average', 'Own cell average + LP') + studyRow('pattern only', 'Pattern only + LP') + studyRow('blend, caution 0', 'Blend, no caution') + studyRow('blend, caution 0.3', 'Blend, caution 0.3') + studyRow('blend, caution 1 (exclude)', 'Blend, untried excluded') + studyRow('blend, k=2', 'Blend, k = 2') + studyRow('blend, k=4', 'Blend, k = 4') + studyRow('rule of thumb (baseline)', 'Rule of thumb (baseline)') + studyRow('oracle (knows true demand)', 'Oracle (knows true demand)') +
      '</tbody></table></div><p class="tiny dim">Computed by the repository script study.cjs with this engine; embedded at build time. Caution helps when untried combinations were skipped for a reason (sensible past) and costs nothing measurable when everything was tried (random past).</p>';
    $('scoreAlt').addEventListener('click', () => {
      const cm = E.compareMethods(settings);
      if (!cm) { $('altTable').innerHTML = '<p class="small">Run a valid plan first.</p>'; return; }
      $('altTable').innerHTML = '<div class="tablewrap"><table><thead><tr><th>Method (current settings)</th><th class="n">Promised</th><th class="n">True (mock)</th><th class="n">Untried used</th></tr></thead><tbody>' + cm.rows.map((x) => '<tr><td>' + esc(x.label) + '</td><td class="n">' + fmt(x.promised) + '</td><td class="n">' + fmt(x.truth) + '</td><td class="n">' + x.untested + '</td></tr>').join('') + (cm.oracle ? '<tr><td>Oracle</td><td></td><td class="n">' + fmt(cm.oracle) + '</td><td></td></tr>' : '') + '</tbody></table></div>';
    });
  }

  // ------------------------------------------------------------------ charts (inline SVG)
  function barChart(id, labels, series, opt) {
    const o = opt || {};
    const W = 560, H = 210, L = 40, B = 34, T = 12, R = 8;
    const all = series.flatMap((s) => s.values).concat(o.mins || []).concat(o.ref ? [o.ref] : []);
    const max = Math.max(1e-9, ...all) * 1.1;
    const n = labels.length, gw = (W - L - R) / n, bw = Math.min(26, (gw * 0.8) / series.length);
    const y = (v) => T + (H - T - B) * (1 - v / max);
    let svg = '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="bar chart">';
    for (let g = 0; g <= 4; g++) { const v = (max / 1.1) * g / 4; svg += '<line x1="' + L + '" x2="' + (W - R) + '" y1="' + y(v) + '" y2="' + y(v) + '" stroke="#2a2a2a"/><text x="' + (L - 5) + '" y="' + (y(v) + 4) + '" text-anchor="end">' + (o.decimals ? v.toFixed(o.decimals) : fmt(v)) + '</text>'; }
    labels.forEach((lab, i) => {
      const x0 = L + i * gw + (gw - bw * series.length) / 2;
      series.forEach((s, k) => {
        const v = s.values[i];
        svg += '<rect x="' + (x0 + k * bw) + '" y="' + y(v) + '" width="' + (bw - 2) + '" height="' + Math.max(0, H - B - y(v)) + '" fill="' + s.color + '" rx="2"><title>' + esc(s.name + ' · ' + lab + ': ' + (o.decimals ? v.toFixed(o.decimals) : fmt(v))) + '</title></rect>';
      });
      if (o.mins) svg += '<line x1="' + (x0 - 2) + '" x2="' + (x0 + bw * series.length) + '" y1="' + y(o.mins[i]) + '" y2="' + y(o.mins[i]) + '" stroke="#f5c518" stroke-width="2" stroke-dasharray="3 2"/>';
      svg += '<text x="' + (L + i * gw + gw / 2) + '" y="' + (H - B + 15) + '" text-anchor="middle">' + esc(lab) + '</text>';
    });
    if (o.ref) svg += '<line x1="' + L + '" x2="' + (W - R) + '" y1="' + y(o.ref) + '" y2="' + y(o.ref) + '" stroke="#fff" stroke-dasharray="4 3" opacity=".6"/>';
    let lx = L;
    series.forEach((s) => { svg += '<rect x="' + lx + '" y="' + (H - 12) + '" width="10" height="10" fill="' + s.color + '"/><text x="' + (lx + 14) + '" y="' + (H - 3) + '">' + esc(s.name) + '</text>'; lx += 26 + s.name.length * 7; });
    if (o.mins) svg += '<line x1="' + lx + '" x2="' + (lx + 14) + '" y1="' + (H - 7) + '" y2="' + (H - 7) + '" stroke="#f5c518" stroke-width="2" stroke-dasharray="3 2"/><text x="' + (lx + 18) + '" y="' + (H - 3) + '">minimum shows</text>';
    if (o.ref) svg += '<text x="' + (W - R) + '" y="' + (y(o.ref) - 4) + '" text-anchor="end">average = 1</text>';
    $(id).innerHTML = svg + '</svg>';
  }

  // ------------------------------------------------------------------ test cases
  function observed(tc, r) {
    if (r.status !== 'ok') return r.status.toUpperCase() + ': ' + r.errors.join(' ');
    const s = r.scores;
    const parts = ['Plan found; violations ' + r.checks.proposed.violations.length + ' / ' + r.checks.baseline.violations.length + ' (proposed / baseline)', 'certificate ' + (r.proposed.certificateOk ? 'holds' : 'fails'), 'expected tickets ' + fmt(s.proposed.tickets) + ' vs ' + fmt(s.baseline.tickets)];
    if (tc.id === 'new-release') parts.push('The Scavengers: ' + r.checks.proposed.shows[r.slate.length - 1] + ' shows, no records');
    if (tc.id === 'hall-closed') parts.push('screenings in Hall 3: 0');
    if (tc.id === 'one-week') parts.push('backtest: ' + (r.backtest.available ? 'available' : 'not available'));
    return parts.join('; ') + '.';
  }
  function renderCases(results) {
    $('caseTable').innerHTML = '<thead><tr><th>Kind</th><th>Case</th><th>How to reproduce</th><th>Pass criterion</th><th>Observed</th><th>Result</th><th></th></tr></thead><tbody>' + E.TEST_CASES.map((tc, i) => {
      const res = results && results[i];
      return '<tr><td><span class="pill ' + (tc.kind === 'Failure' ? 'fail' : tc.kind === 'Boundary' ? 'mock' : 'pass') + '">' + tc.kind.toUpperCase() + '</span></td><td><b>' + esc(tc.title) + '</b></td><td class="small">' + esc(tc.how) + '</td><td class="small">' + esc(tc.expect) + '</td><td class="small">' + (res ? esc(res.obs) : '<span class="dim">not run yet</span>') + '</td><td>' + (res ? '<span class="pill ' + (res.pass ? 'pass' : 'fail') + '">' + (res.pass ? 'PASS' : 'FAIL') + '</span>' : '') + '</td><td><button type="button" class="btn ghost sm" data-load="' + i + '">Load</button></td></tr>';
    }).join('') + '</tbody>';
    $('caseTable').querySelectorAll('[data-load]').forEach((b) => b.addEventListener('click', () => {
      const tc = E.TEST_CASES[+b.dataset.load];
      settings = tc.apply(E.defaultSettings());
      fillForm();
      run();
      document.getElementById('top').scrollIntoView();
    }));
  }
  function runAllCases() {
    const res = E.TEST_CASES.map((tc) => { const r = E.run(tc.apply(E.defaultSettings())); return { pass: tc.check(r), obs: observed(tc, r) }; });
    renderCases(res);
    const n = res.filter((x) => x.pass).length;
    $('runAllNote').textContent = n + ' of ' + res.length + ' cases pass (' + new Date().toLocaleTimeString() + ').';
  }

  // ------------------------------------------------------------------ boot
  window.addEventListener('scroll', () => $('nav').classList.toggle('solid', window.scrollY > 40), { passive: true });
  document.querySelectorAll('[data-scroll]').forEach((btn) => btn.addEventListener('click', () => {
    const row = $(btn.dataset.scroll);
    row.scrollBy({ left: +btn.dataset.dir * row.clientWidth * 0.8, behavior: 'smooth' });
  }));
  $('heroArt').innerHTML = heroArt();
  $('fpDefault').textContent = E.run(E.defaultSettings(), { skipOracle: true }).fingerprint;
  bindForm();
  fillForm();
  run();
  runAllCases();
  window.SLOTWISE = { get result() { return result; }, get settings() { return settings; }, run, runAllCases };
})();
