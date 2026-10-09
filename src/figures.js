// Animated figures for demo.html, all drawn from the current run (window.Engine result):
//   How it works: purchases -> screening, maximum-likelihood fit, Bayes update (Lecture 2, p. 11 style),
//   predictive vs hall size, caution, a two-variable slice of the real LP (Lecture 1, p. 36 style),
//   simplex objective vs dual bound (Lecture 1, p. 41).
//   Compare: a week at the cinema, rule of thumb vs optimised plan, with a cumulative chart and a time control.
// Every number drawn is computed by the engine; nothing here is illustrative only.
(function (root) {
  'use strict';
  const C = { red: '#e50914', grey: '#808080', text: '#e5e5e5', muted: '#b3b3b3', dim: '#666', line: '#2a2a2a', prior: '#f5a524', post: '#54b9ff', green: '#46d369' };
  const FONT = 'Helvetica Neue, Helvetica, Arial, sans-serif';
  const fmt = (x) => Math.round(x).toLocaleString('en-US');
  const f2 = (x) => (Math.round(x * 100) / 100).toFixed(2);
  const loops = [];

  // ---------------------------------------------------------------- canvas + loop helpers
  function canvas(id, height) {
    const cv = document.getElementById(id);
    if (!cv) return null;
    const dpr = Math.min(2, root.devicePixelRatio || 1);
    const W = Math.max(280, cv.parentElement.clientWidth);
    const H = height;
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    cv.style.width = W + 'px'; cv.style.height = H + 'px';
    const ctx = cv.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { cv, ctx, W, H };
  }
  // runs draw(phase in [0,1)) while the canvas is on screen; reduced motion draws the final frame once
  function loop(c, period, draw, still) {
    const reduce = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    let raf = 0, t0 = 0, on = false;
    const frame = (now) => { if (!t0) t0 = now; draw(((now - t0) % period) / period); if (on) raf = requestAnimationFrame(frame); };
    draw(still === undefined ? 0.999 : still);
    if (reduce || typeof IntersectionObserver !== 'function') return;
    const io = new IntersectionObserver((es) => {
      const v = es.some((e) => e.isIntersecting);
      if (v && !on) { on = true; t0 = 0; raf = requestAnimationFrame(frame); }
      if (!v) { on = false; cancelAnimationFrame(raf); }
    });
    io.observe(c.cv);
    loops.push(() => { on = false; cancelAnimationFrame(raf); io.disconnect(); });
  }
  const isNarrow = (id) => { const el = document.getElementById(id); return !!el && el.parentElement.clientWidth < 600; };
  const ease = (p) => 1 - Math.pow(1 - Math.max(0, Math.min(1, p)), 3);
  function text(ctx, s, x, y, o) {
    o = o || {};
    ctx.font = (o.weight || 400) + ' ' + (o.size || 12) + 'px ' + FONT;
    ctx.fillStyle = o.color || C.muted;
    ctx.textAlign = o.align || 'left';
    ctx.textBaseline = o.base || 'alphabetic';
    ctx.fillText(s, x, y);
  }
  function axes(ctx, x0, y0, x1, y1) {
    ctx.strokeStyle = '#555'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(x0, y1); ctx.lineTo(x0, y0); ctx.lineTo(x1, y0); ctx.stroke();
  }
  function niceStep(span, n) { const raw = span / n, mag = Math.pow(10, Math.floor(Math.log10(raw))); return [1, 2, 5, 10].map((m) => m * mag).find((x) => x >= raw); }
  const short = (t) => (t.length > 14 ? t.split(/[ :-]/)[0] : t);

  // ---------------------------------------------------------------- 1 purchases -> one screening
  function figAggregate(r) {
    const c = canvas('figAgg', 230); if (!c) return;
    const sc = r.screenings.filter((x) => x.soldOut).sort((a, b) => b.tickets - a.tickets)[0] || r.screenings.slice().sort((a, b) => b.tickets - a.tickets)[0];
    const time = r.times[sc.s];
    const rows = r.history.rows.filter((x) => x.title_tag === sc.tag && x.play_day === sc.date && x.curtain_time === time);
    const film = r.slate[sc.f];
    const seats = [...new Set(r.settings.halls.map((h) => h.seats).filter((x) => x > 0))];
    document.getElementById('figAggCap').textContent = film.title + ', ' + sc.date + ' ' + time + ': ' + rows.length + ' purchase rows, ' + sc.tickets + ' tickets' + (sc.soldOut ? ' = the seats of a ' + sc.tickets + '-seat hall, so read as sold out (demand was at least ' + sc.tickets + ').' : '.');
    const { ctx, W, H } = c;
    const maxY = Math.max(...seats, sc.tickets) * 1.1;
    const bx = W * 0.6, bw = Math.min(90, W * 0.14), base = H - 26, top = 16;
    const y = (v) => base - ((base - top) * v) / maxY;
    const cols = Math.max(5, Math.floor((W * 0.52) / 34));
    loop(c, 6500, (ph) => {
      ctx.clearRect(0, 0, W, H);
      const shown = Math.floor(ease(ph / 0.75) * rows.length);
      let total = 0;
      rows.forEach((row, i) => {
        if (i < shown) { total += row.passes_bought; return; }
        const k = i - shown;
        if (k >= cols * 5) return;
        const cx = 10 + (k % cols) * 34, cy = 14 + Math.floor(k / cols) * 30;
        ctx.fillStyle = 'hsl(' + film.hue + ',45%,30%)';
        ctx.fillRect(cx, cy, 30, 22);
        text(ctx, String(row.passes_bought), cx + 15, cy + 15, { align: 'center', color: '#fff', weight: 700 });
      });
      text(ctx, 'purchase rows still to add (passes_bought): ' + (rows.length - shown), 10, H - 8, { size: 11 });
      ctx.fillStyle = 'hsl(' + film.hue + ',60%,40%)';
      ctx.fillRect(bx, y(total), bw, base - y(total));
      axes(ctx, bx - 10, base, bx + bw + 10, top);
      seats.forEach((s) => {
        const hit = s === sc.tickets;
        ctx.setLineDash([4, 3]); ctx.strokeStyle = hit ? '#fff' : '#555';
        ctx.beginPath(); ctx.moveTo(bx - 10, y(s)); ctx.lineTo(W - 8, y(s)); ctx.stroke(); ctx.setLineDash([]);
        text(ctx, s + ' seats', W - 8, y(s) - 4, { align: 'right', size: 11, color: hit ? '#fff' : C.dim });
      });
      text(ctx, 'y = ' + total, bx + bw / 2, y(total) - 6, { align: 'center', color: '#fff', weight: 700, size: 14 });
    });
  }

  // ---------------------------------------------------------------- 2 maximum likelihood, pass by pass
  function figMLE(r) {
    const narrow = isNarrow('figMle');
    const c = canvas('figMle', narrow ? 430 : 240); if (!c) return;
    const tr = r.estimate.trace;
    if (!tr || tr.length < 2) return;
    const { ctx, W, H } = c;
    const nS = r.times.length, lw = narrow ? W - 6 : W * 0.58, base = narrow ? 200 : H - 34, top = 22;
    const maxS = Math.max(1.6, ...tr.flatMap((t) => t.S.flat())) * 1.08;
    const lls = tr.map((t) => t.ll), llMax = Math.max(...lls);
    const gapLog = (v) => Math.log10(Math.max(llMax - v, 1e-3));
    const gMax = gapLog(lls[0]), gMin = -3;
    const steps = tr.length - 1;
    document.getElementById('figMleCap').textContent = 'Start: every index 1 (log-likelihood ' + fmt(lls[0]) + '). Converged after ' + steps + ' passes (log-likelihood ' + fmt(llMax) + '). Each pass can only raise the likelihood.';
    loop(c, 1300 * steps + 2400, (ph) => {
      const pos = Math.min(steps, ph * (steps + 1.8));
      const i = Math.floor(pos), a = ease(pos - i), j = Math.min(steps, i + 1);
      const S = [0, 1].map((g) => Array.from({ length: nS }, (_, s) => tr[i].S[g][s] + (tr[j].S[g][s] - tr[i].S[g][s]) * a));
      ctx.clearRect(0, 0, W, H);
      const y = (v) => base - ((base - top) * v) / maxS;
      axes(ctx, 36, base, lw, top);
      [0.5, 1, 1.5, 2].forEach((v) => { if (v < maxS) { text(ctx, v.toFixed(1), 30, y(v) + 4, { align: 'right', size: 11 }); ctx.strokeStyle = C.line; ctx.beginPath(); ctx.moveTo(37, y(v)); ctx.lineTo(lw, y(v)); ctx.stroke(); } });
      const gw = (lw - 44) / nS, bw = Math.min(22, gw * 0.36);
      r.times.forEach((t, s) => {
        const x0 = 44 + s * gw + (gw - 2 * bw) / 2;
        [[0, C.red], [1, C.post]].forEach(([g, col]) => { ctx.fillStyle = col; ctx.fillRect(x0 + g * bw, y(S[g][s]), bw - 2, base - y(S[g][s])); });
        if (gw > 34 || s % 2 === 0) text(ctx, t, 44 + s * gw + gw / 2, base + 14, { align: 'center', size: 11 });
      });
      text(ctx, '■ general films', 44, base + 30, { size: 11, color: C.red });
      text(ctx, '■ family films', 44 + 110, base + 30, { size: 11, color: C.post });
      text(ctx, 'pass ' + (a > 0.5 && j > i ? j : i) + ' of ' + steps, lw, 13, { align: 'right', size: 12, color: '#fff', weight: 700 });
      // distance to the final log-likelihood, log scale: shows every pass, not only the first jump
      const lt = narrow ? base + 64 : top, lb = narrow ? H - 24 : base;
      const lx0 = narrow ? 56 : lw + 56, lx1 = W - 10, ly = (g) => lt + ((lb - lt) * (gMax - g)) / Math.max(1e-9, gMax - gMin);
      axes(ctx, lx0, lb, lx1, lt);
      text(ctx, 'gap to final log-likelihood', lx0, lt - 9, { size: 11 });
      for (let e = Math.ceil(gMin); e <= Math.floor(gMax); e++) text(ctx, e >= 0 ? String(Math.pow(10, e)) : '1e' + e, lx0 - 5, ly(e) + 4, { align: 'right', size: 10 });
      ctx.strokeStyle = C.green; ctx.lineWidth = 2; ctx.beginPath();
      for (let q = 0; q <= Math.min(steps, i + 1); q++) {
        const v = q <= i ? lls[q] : lls[i] + (lls[q] - lls[i]) * a;
        const xx = lx0 + ((lx1 - lx0) * q) / steps, yy = ly(gapLog(v));
        if (!q) ctx.moveTo(xx, yy); else ctx.lineTo(xx, yy);
      }
      ctx.stroke(); ctx.lineWidth = 1;
      text(ctx, 'pass', lx1, lb + 14, { align: 'right', size: 11 });
    });
  }

  // ---------------------------------------------------------------- 3 Bayes update (belief sharpening, Lecture 2 p. 11)
  function gammaPdf(E, x, a, b) { return x <= 0 ? 0 : Math.exp(a * Math.log(b) + (a - 1) * Math.log(x) - b * x - E.logGamma(a)); }
  function figBayes(r, E) {
    const c = canvas('figBayes', isNarrow('figBayes') ? 400 : 250); if (!c) return;
    const est = r.estimate, cell = E.workedCell(est), film = r.slate[cell.f], k = est.credibility;
    const scr = r.screenings.filter((x) => x.f === cell.f && x.s === cell.s && x.t === cell.t);
    const obs = scr.map((x) => ({ y: x.tickets, w: est.w(x.d), date: x.date }));
    const a0 = k * cell.pattern, b0 = k;
    const states = [{ a: a0, b: b0, n: 0, sy: 0, sw: 0 }];
    obs.forEach((o) => { const p = states[states.length - 1]; states.push({ a: p.a + o.y, b: p.b + o.w, n: p.n + 1, sy: p.sy + o.y, sw: p.sw + o.w }); });
    const xmax = Math.max(cell.pattern, ...obs.map((o) => o.y / o.w)) * 1.8;
    const { ctx, W, H } = c;
    const narrow = W < 700;
    const cw = narrow ? W - 10 : Math.min(W * 0.55, W - 300), x0 = 30, base = narrow ? 150 : H - 30, top = 22;
    document.getElementById('figBayesCap').textContent = film.title + ', ' + r.times[cell.s] + ', ' + E.DAY_TYPE_NAMES[cell.t] + ' (the worked example). Each screening adds its tickets y to the shape and its exposure w to the rate.';
    const peak = Math.max(...states.map((s) => gammaPdf(E, Math.max(1e-6, (s.a - 1) / s.b), s.a, s.b)));
    const steps = states.length - 1;
    loop(c, 2200 * steps + 3000, (ph) => {
      const pos = Math.min(steps, ph * (steps + 1.4));
      const i = Math.floor(pos), a = ease((pos - i) * 1.4), j = Math.min(steps, i + 1);
      const st = { a: states[i].a + (states[j].a - states[i].a) * a, b: states[i].b + (states[j].b - states[i].b) * a };
      const done = a > 0.5 ? states[j] : states[i];
      ctx.clearRect(0, 0, W, H);
      const X = (v) => x0 + ((cw - x0) * v) / xmax, Y = (v) => base - ((base - top) * v) / (peak * 1.12);
      axes(ctx, x0, base, cw, top);
      const step = niceStep(xmax, 4);
      for (let v = 0; v <= xmax; v += step) text(ctx, fmt(v), X(v), base + 14, { align: 'center', size: 11 });
      text(ctx, 'θ = mean tickets per screening', (x0 + cw) / 2, base + 28, { align: 'center', size: 11 });
      const curve = (A, B, col, dash) => {
        ctx.strokeStyle = col; ctx.lineWidth = 2.2; ctx.setLineDash(dash || []); ctx.beginPath();
        for (let px = 0; px <= 220; px++) { const v = (xmax * px) / 220, yy = Y(gammaPdf(E, v, A, B)); if (px === 0) ctx.moveTo(X(v), yy); else ctx.lineTo(X(v), yy); }
        ctx.stroke(); ctx.setLineDash([]); ctx.lineWidth = 1;
      };
      curve(a0, b0, C.prior, [6, 4]);
      curve(st.a, st.b, C.post);
      const mean = st.a / st.b;
      ctx.setLineDash([3, 3]); ctx.strokeStyle = '#999'; ctx.beginPath(); ctx.moveTo(X(mean), base); ctx.lineTo(X(mean), top); ctx.stroke(); ctx.setLineDash([]);
      text(ctx, 'posterior mean ' + f2(mean), X(mean) + 4, top + 2, { size: 11, color: '#bbb' });
      if (done.n) { ctx.fillStyle = C.red; ctx.beginPath(); ctx.arc(X(done.sy / done.sw), base, 5, 0, 7); ctx.fill(); }
      const lx = narrow ? 10 : cw + 24, ly0 = narrow ? base + 44 : 26;
      const lines = [
        [C.prior, 'prior Gamma(' + f2(a0) + ', ' + k + '), pattern P = ' + f2(cell.pattern)],
        [C.post, 'posterior Gamma(' + f2(done.a) + ', ' + f2(done.b) + '), ' + done.n + ' screening' + (done.n === 1 ? '' : 's') + ', ' + done.sy + ' tickets'],
        [C.red, done.n ? 'own average ' + f2(done.sy / done.sw) + ' = tickets / exposure' : 'own average: no screening added yet'],
      ];
      lines.forEach(([col, s], q) => { ctx.fillStyle = col; ctx.fillRect(lx, ly0 + q * 22 - 4, 14, 3); text(ctx, s, lx + 20, ly0 + q * 22, { size: 12, color: C.text }); });
      const wp = k / done.b, wd = 1 - wp, by = ly0 + 80;
      text(ctx, 'POSTERIOR MEAN = WEIGHTED AVERAGE', lx, by, { size: 10.5, color: C.dim, weight: 700 });
      text(ctx, f2(done.a / done.b) + ' = ' + f2(wp) + ' × ' + f2(cell.pattern) + (done.n ? ' + ' + f2(wd) + ' × ' + f2(done.sy / done.sw) : ''), lx, by + 22, { size: 13, color: '#fff', weight: 700 });
      const bw = W - lx - 10;
      ctx.fillStyle = C.prior; ctx.fillRect(lx, by + 34, bw * wp, 10);
      ctx.fillStyle = C.post; ctx.fillRect(lx + bw * wp, by + 34, bw * wd, 10);
      text(ctx, 'PRIOR ' + Math.round(100 * wp) + '%', lx, by + 60, { size: 10.5, color: C.prior, weight: 700 });
      text(ctx, 'DATA ' + Math.round(100 * wd) + '%', lx + bw, by + 60, { size: 10.5, color: C.post, weight: 700, align: 'right' });
      if (j > i && i < obs.length && a < 1) text(ctx, 'adding ' + obs[i].date + ': y = ' + obs[i].y + ', w = ' + f2(obs[i].w), lx, by + 84, { size: 12 });
    });
  }

  // ---------------------------------------------------------------- 4 predictive demand vs hall size
  function figPredictive(r, E) {
    const c = canvas('figPred', 230); if (!c) return;
    const P = r.problem, d = 5;
    let best = null;
    for (let s = 0; s < P.nS; s++) r.proposed.plan[d][s].forEach((f, h) => { if (f !== null && (!best || P.est.demand(f, s, d) > P.est.demand(best.f, best.s, d))) best = { f, s, h }; });
    if (!best) return;
    const mu = P.est.demand(best.f, best.s, d), rr = P.est.shape(best.f, best.s, d);
    const sd = Math.sqrt(mu + (mu * mu) / rr), ymax = Math.ceil(mu + 3.2 * sd);
    const pm = Array.from({ length: ymax + 1 }, (_, y) => Math.exp(E.logNegBin(y, Math.max(mu, 1e-9), rr)));
    const halls = P.halls.filter((h) => h.usable).slice().sort((a, b) => a.seats - b.seats);
    const film = r.slate[best.f];
    document.getElementById('figPredCap').textContent = film.title + ', Saturday ' + r.times[best.s] + ': demand mean ' + f2(mu) + ', negative binomial with matched shape ' + f2(rr) + ', shown in each hall size.';
    const { ctx, W, H } = c;
    const x0 = 34, base = H - 30, top = 34, pmax = Math.max(...pm) * 1.15;
    const X = (v) => x0 + ((W - 12 - x0) * v) / ymax, Y = (v) => base - ((base - top) * v) / pmax;
    loop(c, 2600 * halls.length, (ph) => {
      const hi = Math.min(halls.length - 1, Math.floor(ph * halls.length));
      const seats = halls[hi].seats;
      ctx.clearRect(0, 0, W, H);
      axes(ctx, x0, base, W - 12, top);
      const bw = Math.max(1, (W - 12 - x0) / (ymax + 1) - 0.5);
      pm.forEach((p, y) => { ctx.fillStyle = y <= seats ? 'hsl(' + film.hue + ',60%,45%)' : '#4d4d4d'; ctx.fillRect(X(y), Y(p), bw, base - Y(p)); });
      const sx = X(Math.min(seats, ymax));
      ctx.strokeStyle = '#fff'; ctx.setLineDash([5, 4]); ctx.beginPath(); ctx.moveTo(sx, base); ctx.lineTo(sx, top - 6); ctx.stroke(); ctx.setLineDash([]);
      text(ctx, halls[hi].name + ': ' + seats + ' seats', sx + (sx > W * 0.7 ? -6 : 6), top - 2, { align: sx > W * 0.7 ? 'right' : 'left', color: '#fff', weight: 700, size: 12 });
      const step = niceStep(ymax, 5);
      for (let v = 0; v <= ymax; v += step) text(ctx, String(v), X(v), base + 14, { align: 'center', size: 11 });
      text(ctx, 'tickets demanded', W - 12, H - 2, { align: 'right', size: 11 });
      text(ctx, 'E[min(D, ' + seats + ')] = ' + f2(E.expectedSoldNB(mu, seats, rr)) + ' expected tickets', x0, 14, { color: C.text, weight: 700, size: 13 });
      if (W > 620) text(ctx, 'grey = demand above the seats (turned away)', W - 12, 14, { align: 'right', size: 11 });
    });
  }

  // ---------------------------------------------------------------- 5 caution
  function figCaution(r, E) {
    const narrow = isNarrow('figCaution');
    const c = canvas('figCaution', narrow ? 260 : 200); if (!c) return;
    const P = r.problem, cells = P.est.cells.filter((x) => !P.isNew(x.f));
    const untried = cells.filter((x) => !x.tested).sort((a, b) => b.estimate - a.estimate)[0];
    const strong = cells.filter((x) => x.tested).sort((a, b) => a.priorShare - b.priorShare)[0];
    const thin = cells.filter((x) => x.tested && x.n === 1).sort((a, b) => b.estimate - a.estimate)[0];
    const ex = [strong, thin, untried].filter(Boolean);
    const label = (x) => short(r.slate[x.f].title) + ' ' + r.times[x.s] + ' ' + E.DAY_TYPE_NAMES[x.t] + (x.tested ? ', ' + x.n + ' screening' + (x.n === 1 ? '' : 's') : ', untried');
    const cDef = r.settings.caution;
    const { ctx, W, H } = c;
    const lx = narrow ? 8 : Math.min(260, W * 0.45), maxV = Math.max(...ex.map((x) => x.estimate)) * 1.1;
    loop(c, 8000, (ph) => {
      const tri = ph < 0.5 ? ph * 2 : 2 - ph * 2;
      const cc = Math.round(tri * 20) / 20;
      ctx.clearRect(0, 0, W, H);
      text(ctx, 'caution c = ' + cc.toFixed(2) + (Math.abs(cc - cDef) < 1e-9 ? ' (default)' : ''), 8, 16, { color: '#fff', weight: 700, size: 13 });
      if (!narrow) text(ctx, 'value mean = μ × (1 − c × pattern share)', W - 8, 16, { align: 'right', size: 11 });
      ex.forEach((x, q) => {
        const share = x.priorShare, val = x.estimate * (1 - cc * share);
        const y0 = narrow ? 30 + q * 76 : 34 + q * 52;
        text(ctx, label(x), 8, y0 + 14, { size: 12, color: C.text });
        text(ctx, 'pattern share ' + Math.round(100 * share) + '%', 8, narrow ? y0 + 56 : y0 + 30, { size: 11 });
        const y = narrow ? y0 + 22 : y0, X = (v) => lx + ((W - lx - 110) * v) / maxV;
        ctx.fillStyle = '#333'; ctx.fillRect(lx, y + 4, X(x.estimate) - lx, 14);
        ctx.fillStyle = x.tested ? C.red : C.prior; ctx.fillRect(lx, y + 4, X(val) - lx, 14);
        text(ctx, f2(x.estimate) + ' → ' + f2(val), X(x.estimate) + 6, y + 15, { size: 12, color: C.text });
      });
    }, cDef / 2);
  }

  // ---------------------------------------------------------------- 6 two-variable slice of the real LP (Lecture 1, p. 36 style)
  // Every variable except two is fixed at the optimal plan. The two left are film a (chosen) and a
  // runner-up b in the same hall-time; b is free at that time and away from its maximum, and a is above
  // its minimum, so the rows that remain are x_a + x_b <= 1 and 0 <= x <= 1, exactly as drawn.
  function lpSlice(r) {
    const P = r.problem, plan = r.proposed.plan, shows = r.checks.proposed.shows;
    let best = null;
    for (let d = 0; d < 7; d++) for (let s = 0; s < P.nS; s++) P.halls.forEach((hall, h) => {
      const a = plan[d][s][h];
      if (a === null || !hall.usable || r.settings.pins[d + '|' + s + '|' + h] !== undefined || shows[a] <= P.slate[a].min) return;
      P.slate.forEach((fb, b) => {
        if (b === a || !P.fits[b] || plan[d][s].includes(b) || shows[b] < fb.min || (fb.max !== null && shows[b] >= fb.max)) return;
        const va = P.value(a, h, d, s), vb = P.value(b, h, d, s);
        if (va <= 0 || vb <= 0) return;
        const ratio = vb / va;
        if (ratio <= 1 + 1e-9 && (!best || ratio > best.ratio)) best = { d, s, h, a, b, va, vb, ratio };
      });
    });
    return best;
  }
  function figLP(r, E) {
    const c = canvas('figLp', 290); if (!c) return;
    const sl = lpSlice(r);
    if (!sl) return;
    const P = r.problem, A = r.slate[sl.a], B = r.slate[sl.b];
    document.getElementById('figLpCap').textContent = E.DAY_NAMES[sl.d] + ' ' + r.times[sl.s] + ', ' + P.halls[sl.h].name + ': x₁ = ' + A.title + ' here, x₂ = ' + B.title + ' here (the closest runner-up). All other variables stay at the plan, which leaves x₁ + x₂ ≤ 1 and 0 ≤ x ≤ 1. Planning values ' + f2(sl.va) + ' and ' + f2(sl.vb) + '.';
    const { ctx, W, H } = c;
    const narrow = W < 640;
    const ox = 50, oy = H - 36, s0 = Math.min((oy - 24) / 1.2, (narrow ? W - 90 : W * 0.42) / 1.2);
    const X = (v) => ox + v * s0, Y = (v) => oy - v * s0;
    const verts = [[0, 0], [1, 0], [0, 1]];
    const zOf = (p) => sl.va * p[0] + sl.vb * p[1];
    // the line z = sl.va*x1 + sl.vb*x2 clipped to the drawing box [0,1.2]^2
    const clipLine = (z) => {
      const pts = [];
      const L = 1.2;
      const add = (x, y) => { if (x >= -1e-9 && x <= L + 1e-9 && y >= -1e-9 && y <= L + 1e-9) pts.push([x, y]); };
      add(z / sl.va, 0); add(0, z / sl.vb); add(L, (z - sl.va * L) / sl.vb); add((z - sl.vb * L) / sl.va, L);
      return pts.slice(0, 2);
    };
    loop(c, 7500, (ph) => {
      ctx.clearRect(0, 0, W, H);
      for (let q = 1; q <= 7; q++) {
        const seg = clipLine((sl.va * 1.2 * q) / 7);
        if (seg.length === 2) { ctx.strokeStyle = 'rgba(255,255,255,0.07)'; ctx.beginPath(); ctx.moveTo(X(seg[0][0]), Y(seg[0][1])); ctx.lineTo(X(seg[1][0]), Y(seg[1][1])); ctx.stroke(); }
      }
      ctx.fillStyle = 'rgba(255,255,255,0.09)'; ctx.strokeStyle = '#ddd';
      ctx.beginPath(); verts.forEach((p, i) => (i ? ctx.lineTo(X(p[0]), Y(p[1])) : ctx.moveTo(X(p[0]), Y(p[1])))); ctx.closePath(); ctx.fill(); ctx.stroke();
      text(ctx, 'FEASIBLE', X(0.2), Y(0.25), { size: 11, color: C.dim, weight: 700 });
      axes(ctx, ox, oy, X(1.2), Y(1.2));
      text(ctx, 'x₁', X(1.2) + 6, oy + 4, { size: 13, color: C.text, weight: 700 });
      text(ctx, 'x₂', ox - 6, Y(1.2) - 8, { size: 13, color: C.text, weight: 700, align: 'center' });
      text(ctx, '1', X(1), oy + 16, { align: 'center', size: 11 }); text(ctx, '1', ox - 8, Y(1) + 4, { align: 'right', size: 11 }); text(ctx, '0', ox - 8, oy + 14, { align: 'right', size: 11 });
      // the objective line sweeps up to its last contact with the feasible region
      const z = ease(Math.min(1, ph / 0.55)) * sl.va;
      const seg = clipLine(Math.max(1e-6, z));
      if (seg.length === 2) { ctx.strokeStyle = C.post; ctx.setLineDash([6, 4]); ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(X(seg[0][0]), Y(seg[0][1])); ctx.lineTo(X(seg[1][0]), Y(seg[1][1])); ctx.stroke(); ctx.setLineDash([]); ctx.lineWidth = 1; }
      // the simplex step: x1 enters (largest reduced cost) along the edge from (0,0) to (1,0)
      const k = ease(Math.max(0, Math.min(1, (ph - 0.55) / 0.3)));
      ctx.fillStyle = C.post; ctx.beginPath(); ctx.arc(X(k), Y(0), 7, 0, 7); ctx.fill();
      verts.forEach((p) => text(ctx, 'z = ' + f2(zOf(p)), X(p[0]) + 9, Y(p[1]) - 9, { size: 11, color: p[0] === 1 ? '#fff' : C.muted }));
      if (narrow) return;
      const rx = X(1.2) + 60;
      text(ctx, ph > 0.86 ? 'OPTIMAL AT A VERTEX' : 'z = ' + f2(sl.va) + ' x₁ + ' + f2(sl.vb) + ' x₂', rx, 34, { color: ph > 0.86 ? C.post : C.text, weight: 700, size: 14 });
      ['The objective line is pushed up until it last', 'touches the feasible region: at a corner', '(Lecture 1, p. 16). Corners have whole', 'numbers, so the answer is a real schedule:', '(1, 0) = ' + A.title + ' plays here.', 'The fractional point (0.5, 0.5) is feasible', 'but scores only ' + f2((sl.va + sl.vb) / 2) + '.'].forEach((s, i) => text(ctx, s, rx, 62 + i * 19, { size: 12 }));
    });
  }

  // ---------------------------------------------------------------- 7 simplex objective vs dual bound (Lecture 1, p. 41)
  function figDual(r) {
    const c = canvas('figDual', 220); if (!c) return;
    const zt = r.proposed.lp.zTrace || [], bound = r.proposed.lp.dualBound;
    if (zt.length < 2) return;
    const { ctx, W, H } = c;
    const x0 = 56, base = H - 30, top = 34;
    const lo = Math.min(...zt), hi = bound, pad = (hi - lo) * 0.08 || 1;
    const X = (i) => x0 + ((W - 14 - x0) * i) / (zt.length - 1), Y = (v) => base - ((base - top) * (v - lo + pad)) / (hi - lo + 2 * pad);
    document.getElementById('figDualCap').textContent = (zt.length - 1) + ' simplex pivots after the first feasible week. Final planning value ' + f2(zt[zt.length - 1]) + ' = dual bound ' + f2(bound) + ', so no feasible week scores more.';
    loop(c, 6500, (ph) => {
      const n = Math.max(1, Math.round(ease(ph / 0.8) * (zt.length - 1)));
      ctx.clearRect(0, 0, W, H);
      axes(ctx, x0, base, W - 14, top);
      const step = niceStep(hi - lo + 2 * pad, 4);
      for (let v = Math.ceil((lo - pad) / step) * step; v <= hi + pad; v += step) text(ctx, fmt(v), x0 - 6, Y(v) + 4, { align: 'right', size: 11 });
      ctx.fillStyle = 'rgba(84,185,255,0.35)';
      ctx.fillRect(X(n) - 1.5, Y(bound), 3, Y(zt[n]) - Y(bound));
      ctx.strokeStyle = '#fff'; ctx.setLineDash([6, 4]); ctx.beginPath(); ctx.moveTo(x0, Y(bound)); ctx.lineTo(W - 14, Y(bound)); ctx.stroke(); ctx.setLineDash([]);
      text(ctx, 'dual bound ' + f2(bound), W - 14, Y(bound) - 6, { align: 'right', size: 12, color: '#fff' });
      ctx.strokeStyle = C.red; ctx.lineWidth = 2; ctx.beginPath();
      for (let i = 0; i <= n; i++) { if (i) ctx.lineTo(X(i), Y(zt[i])); else ctx.moveTo(X(i), Y(zt[i])); }
      ctx.stroke(); ctx.lineWidth = 1;
      const gap = bound - zt[n];
      text(ctx, 'pivot ' + n + ': planning value ' + f2(zt[n]) + ', gap to bound ' + f2(Math.max(0, gap)), x0, 16, { size: 12, color: gap < 1e-6 ? C.green : C.text, weight: 700 });
      text(ctx, 'simplex pivot', W - 14, H - 4, { align: 'right', size: 11 });
    });
  }

  // ---------------------------------------------------------------- cinema: rule of thumb vs optimised, one show-time per step
  const sim = { step: 1, playing: false, raf: 0, t0: 0, r: null, data: null };
  function cinemaData(r) {
    const P = r.problem, steps = [];
    for (let d = 0; d < 7; d++) for (let s = 0; s < P.nS; s++) {
      const cell = (plan) => P.halls.map((h, hi) => {
        const f = plan[d][s][hi];
        if (!h.usable || f === null) return { f: null, n: 0, away: 0, seats: h.usable ? h.seats : 0, t: 0 };
        const t = P.expected(f, hi, d, s);
        return { f, t, n: Math.round(t), away: Math.max(0, Math.round(P.est.demand(f, s, d) - t)), seats: h.seats };
      });
      steps.push({ d, s, base: cell(r.baseline.plan), prop: cell(r.proposed.plan) });
    }
    let cb = 0, cp = 0;
    steps.forEach((x) => { cb += x.base.reduce((a, c) => a + c.t, 0); cp += x.prop.reduce((a, c) => a + c.t, 0); x.cumB = cb; x.cumP = cp; });
    return steps;
  }
  function cinema(r) {
    sim.r = r;
    sim.data = cinemaData(r);
    const n = sim.data.length;
    document.getElementById('simSlider').max = String(n);
    document.getElementById('simStep').max = String(n);
    sim.step = Math.min(Math.max(1, sim.step), n);
    syncControls();
    drawCinema(1);
    drawSimChart();
  }
  function syncControls() {
    if (!sim.data) return;
    const n = sim.data.length, x = sim.data[sim.step - 1];
    document.getElementById('simSlider').value = String(sim.step);
    const box = document.getElementById('simStep');
    if (document.activeElement !== box) box.value = String(sim.step);
    document.getElementById('simWhen').textContent = root.Engine.DAY_NAMES[x.d] + ' ' + sim.r.times[x.s] + ' · step ' + sim.step + ' of ' + n;
    const pb = document.getElementById('simPlay');
    pb.textContent = sim.playing ? 'Pause' : 'Play';
    pb.setAttribute('aria-pressed', String(sim.playing));
  }
  function setStep(k, animate) {
    if (!sim.data) return;
    sim.step = Math.max(1, Math.min(sim.data.length, Math.round(k) || 1));
    sim.t0 = performance.now() - (animate ? 0 : 5000);
    syncControls();
    drawSimChart();
    if (!sim.raf) sim.raf = requestAnimationFrame(tick);
  }
  function tick(now) {
    const p = Math.min(1, (now - sim.t0) / 1300);
    drawCinema(p);
    if (p < 1) { sim.raf = requestAnimationFrame(tick); return; }
    sim.raf = 0;
    if (sim.playing) {
      if (sim.step < sim.data.length) setTimeout(() => { if (sim.playing) setStep(sim.step + 1, true); }, 250);
      else { sim.playing = false; syncControls(); }
    }
  }
  function drawCinema(p) {
    const narrow = document.getElementById('simCanvas').parentElement.clientWidth < 560;
    const c = canvas('simCanvas', narrow ? 560 : 300); if (!c) return;
    const { ctx, W, H } = c, r = sim.r, x = sim.data[sim.step - 1];
    ctx.clearRect(0, 0, W, H);
    const panels = narrow ? [[0, 0, W, H / 2], [0, H / 2, W, H / 2]] : [[0, 0, W / 2, H], [W / 2, 0, W / 2, H]];
    [['base', 'Rule of thumb (greedy)'], ['prop', 'Optimised plan']].forEach(([key, label], pi) => {
      const [ox, oy, pw, ph] = panels[pi];
      const halls = x[key].filter((h) => h.seats > 0), nH = halls.length;
      text(ctx, label, ox + 12, oy + 18, { color: key === 'prop' ? '#fff' : C.muted, weight: 700, size: 13 });
      const got = halls.reduce((a, h) => a + h.n, 0);
      text(ctx, fmt(got * ease(p)) + ' in', ox + pw - 12, oy + 18, { align: 'right', size: 12, color: key === 'prop' ? '#ff6b72' : C.muted, weight: 700 });
      const hw = (pw - 24 - (nH - 1) * 10) / Math.max(1, nH), top = oy + 30, hh = ph - 30 - 50;
      const maxSeats = Math.max(...halls.map((h) => h.seats), 1);
      halls.forEach((h, k) => {
        const hx = ox + 12 + k * (hw + 10), film = h.f === null ? null : r.slate[h.f];
        const hgt = hh * (0.5 + 0.5 * (h.seats / maxSeats)), hy = top + hh - hgt;
        ctx.fillStyle = '#1b1b1b'; ctx.fillRect(hx, hy, hw, hgt);
        ctx.fillStyle = film ? 'hsl(' + film.hue + ',55%,30%)' : '#262626'; ctx.fillRect(hx, hy, hw, 16);
        text(ctx, film ? short(film.title) : 'empty', hx + 5, hy + 12, { size: 11, color: '#fff', weight: 700 });
        // seat grid sized to fill the hall box
        const bw = hw - 8, bh = hgt - 26;
        const cols = Math.max(1, Math.round(Math.sqrt((h.seats * bw) / Math.max(1, bh)))), rows = Math.ceil(h.seats / cols);
        const dx = bw / cols, dy = bh / Math.max(1, rows), dot = Math.max(1.5, Math.min(dx, dy) * 0.62);
        const seat = (i) => [hx + 4 + (i % cols) * dx + (dx - dot) / 2, hy + 21 + Math.floor(i / cols) * dy + (dy - dot) / 2];
        ctx.fillStyle = '#303030';
        for (let i = 0; i < h.seats; i++) { const [sx, sy] = seat(i); ctx.fillRect(sx, sy, dot, dot); }
        const doorX = hx + hw / 2, doorY = oy + ph - 26;
        for (let i = 0; i < h.n; i++) {
          const q = ease((p - (i / Math.max(1, h.n)) * 0.6) / 0.4);
          if (q <= 0) continue;
          const [sx, sy] = seat(i);
          ctx.fillStyle = film ? 'hsl(' + film.hue + ',85%,' + (q < 1 ? 72 : 60) + '%)' : '#fff';
          ctx.fillRect(doorX + (sx - doorX) * q, doorY + (sy - doorY) * q, dot, dot);
        }
        text(ctx, h.n + ' / ' + h.seats, hx + hw / 2, oy + ph - 30, { align: 'center', size: 11, color: C.text });
        if (h.away) text(ctx, h.away + ' turned away', hx + hw / 2, oy + ph - 16, { align: 'center', size: 10.5, color: '#ff6b72' });
      });
    });
    ctx.strokeStyle = '#333'; ctx.beginPath();
    if (narrow) { ctx.moveTo(8, H / 2); ctx.lineTo(W - 8, H / 2); } else { ctx.moveTo(W / 2, 8); ctx.lineTo(W / 2, H - 8); }
    ctx.stroke();
  }
  function drawSimChart() {
    const c = canvas('simChart', 300); if (!c) return;
    const { ctx, W, H } = c, data = sim.data, n = data.length, k = sim.step;
    const x0 = 46, base = H - 58, top = 30;
    const max = Math.max(data[n - 1].cumP, data[n - 1].cumB);
    const X = (i) => x0 + ((W - 10 - x0) * i) / n, Y = (v) => base - ((base - top) * v) / (max * 1.05);
    ctx.clearRect(0, 0, W, H);
    axes(ctx, x0, base, W - 10, top);
    const step = niceStep(max, 4);
    for (let v = 0; v <= max * 1.05; v += step) { text(ctx, fmt(v), x0 - 5, Y(v) + 4, { align: 'right', size: 10.5 }); ctx.strokeStyle = C.line; ctx.beginPath(); ctx.moveTo(x0 + 1, Y(v)); ctx.lineTo(W - 10, Y(v)); ctx.stroke(); }
    root.Engine.DAY_NAMES.forEach((dn, d) => text(ctx, dn[0], X((d + 0.5) * (n / 7)), base + 14, { align: 'center', size: 10.5 }));
    [['cumB', C.grey], ['cumP', C.red]].forEach(([key, col]) => {
      ctx.strokeStyle = col; ctx.lineWidth = 2;
      ctx.globalAlpha = 0.3; ctx.beginPath(); data.forEach((x, i) => (i ? ctx.lineTo(X(i + 1), Y(x[key])) : ctx.moveTo(X(1), Y(x[key])))); ctx.stroke();
      ctx.globalAlpha = 1; ctx.beginPath(); data.slice(0, k).forEach((x, i) => (i ? ctx.lineTo(X(i + 1), Y(x[key])) : ctx.moveTo(X(1), Y(x[key])))); ctx.stroke();
      ctx.fillStyle = col; ctx.beginPath(); ctx.arc(X(k), Y(data[k - 1][key]), 4, 0, 7); ctx.fill();
    });
    ctx.lineWidth = 1; ctx.strokeStyle = '#fff'; ctx.setLineDash([3, 3]); ctx.beginPath(); ctx.moveTo(X(k), top); ctx.lineTo(X(k), base); ctx.stroke(); ctx.setLineDash([]);
    const b = data[k - 1].cumB, pp = data[k - 1].cumP;
    text(ctx, 'Expected tickets so far', x0, 16, { size: 12, color: C.text, weight: 700 });
    text(ctx, 'Rule of thumb ' + fmt(b), x0, H - 26, { size: 12, color: C.muted });
    text(ctx, 'Optimised ' + fmt(pp) + ' (' + (Math.round(pp) - Math.round(b) >= 0 ? '+' : '') + fmt(Math.round(pp) - Math.round(b)) + ')', x0, H - 8, { size: 12, color: '#ff6b72', weight: 700 });
  }
  function bindCinema() {
    const slider = document.getElementById('simSlider'), box = document.getElementById('simStep');
    if (!slider) return;
    slider.addEventListener('input', () => setStep(+slider.value, true));
    box.addEventListener('change', () => setStep(+box.value, true));
    box.addEventListener('keydown', (e) => { if (e.key === 'Enter') setStep(+box.value, true); });
    document.getElementById('simPlay').addEventListener('click', () => {
      sim.playing = !sim.playing;
      if (sim.playing && sim.step >= sim.data.length) sim.step = 0;
      syncControls();
      if (sim.playing) setStep(sim.step + 1, true);
    });
    document.getElementById('simBack').addEventListener('click', () => { sim.playing = false; setStep(sim.step - 1, true); });
    document.getElementById('simFwd').addEventListener('click', () => { sim.playing = false; setStep(sim.step + 1, true); });
    let rt = 0;
    root.addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(() => { if (sim.r) render(sim.r); }, 200); });
  }

  function render(r) {
    const E = root.Engine;
    while (loops.length) loops.pop()();
    [figAggregate, figMLE, figBayes, figPredictive, figCaution, figLP, figDual, cinema].forEach((fn) => {
      try { fn(r, E); } catch (e) { console.error('figure ' + fn.name + ': ' + e.message); }
    });
  }
  let bound = false;
  root.Figures = { render: (r) => { if (!bound) { bindCinema(); bound = true; } render(r); }, lpSlice, setStep, sim };
})(typeof self !== 'undefined' ? self : this);
