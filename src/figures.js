// Animated figures for demo.html, all drawn from the current run (window.Engine result).
//   How it works: narrated, smoothly tweened sequences for each step: purchases -> screening,
//   maximum-likelihood passes, Bayes update (Lecture 2, p. 11 style), predictive demand vs hall size,
//   caution, a two-variable slice of the real LP (Lecture 1, p. 36 style), simplex value vs dual bound.
//   Compare: a week at the cinema on a running clock (doors open, people walk in and sit, the film
//   plays, people leave), baseline vs optimised, with a cumulative chart and a time control.
// Every number drawn is computed by the engine.
(function (root) {
  'use strict';
  const C = { red: '#e50914', grey: '#808080', text: '#e5e5e5', muted: '#b3b3b3', dim: '#666', line: '#2a2a2a', prior: '#f5a524', post: '#54b9ff', green: '#46d369', bad: '#ff6b72' };
  const FONT = 'Helvetica Neue, Helvetica, Arial, sans-serif';
  const fmt = (x) => Math.round(x).toLocaleString('en-US');
  const f2 = (x) => (Math.round(x * 100) / 100).toFixed(2);
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const lerp = (a, b, p) => a + (b - a) * p;
  const ease = (p) => { p = clamp(p, 0, 1); return p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2; };
  const short = (t) => (t.length > 14 ? t.split(/[ :-]/)[0] : t);
  const reduceMotion = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const stops = [];

  // ---------------------------------------------------------------- drawing helpers
  function canvas(id, height) {
    const cv = document.getElementById(id);
    if (!cv) return null;
    const dpr = Math.min(2, root.devicePixelRatio || 1);
    const W = Math.max(280, cv.parentElement.clientWidth);
    cv.width = Math.round(W * dpr); cv.height = Math.round(height * dpr);
    cv.style.width = W + 'px'; cv.style.height = height + 'px';
    const ctx = cv.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { cv, ctx, W, H: height };
  }
  const isNarrow = (id) => { const el = document.getElementById(id); return !!el && el.parentElement.clientWidth < 600; };
  function text(ctx, s, x, y, o) {
    o = o || {};
    ctx.font = (o.weight || 400) + ' ' + (o.size || 12) + 'px ' + FONT;
    ctx.fillStyle = o.color || C.muted;
    ctx.textAlign = o.align || 'left';
    ctx.textBaseline = o.base || 'alphabetic';
    ctx.globalAlpha = o.alpha === undefined ? 1 : o.alpha;
    ctx.fillText(s, x, y);
    ctx.globalAlpha = 1;
  }
  function axes(ctx, x0, y0, x1, y1) {
    ctx.strokeStyle = '#555'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(x0, y1); ctx.lineTo(x0, y0); ctx.lineTo(x1, y0); ctx.stroke();
  }
  function rr(ctx, x, y, w, h, r) {
    ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }
  function niceStep(span, n) { const raw = span / n, mag = Math.pow(10, Math.floor(Math.log10(raw))); return [1, 2, 5, 10].map((m) => m * mag).find((x) => x >= raw); }

  // ---------------------------------------------------------------- narrated sequence player
  // scenes: [{ ms, say, draw(p) }] played in order and looped; the narration line shows "step k/n"
  // and the scene's sentence; the button (or a click on the figure) pauses and resumes.
  function story(c, narrId, scenes) {
    const narr = document.getElementById(narrId);
    const total = scenes.reduce((a, s) => a + s.ms, 0);
    let t = 0, last = 0, raf = 0, on = false, paused = false, shown = -1;
    function at(tt) {
      let acc = 0;
      for (let i = 0; i < scenes.length; i++) { if (tt < acc + scenes[i].ms) return [i, (tt - acc) / scenes[i].ms]; acc += scenes[i].ms; }
      return [scenes.length - 1, 1];
    }
    function render() {
      const [i, p] = at(t);
      scenes[i].draw(p);
      if (narr && i !== shown) {
        shown = i;
        narr.querySelector('.nstep').textContent = (i + 1) + ' / ' + scenes.length;
        narr.querySelector('.ntext').textContent = typeof scenes[i].say === 'function' ? scenes[i].say() : scenes[i].say;
      }
    }
    function frame(now) {
      if (!last) last = now;
      if (!paused) t = (t + Math.min(64, now - last)) % total;
      last = now;
      render();
      if (on) raf = requestAnimationFrame(frame);
    }
    if (narr) {
      narr.innerHTML = '<button type="button" class="nbtn" aria-label="Pause animation">❚❚</button><span class="nstep"></span><span class="ntext"></span>';
      const btn = narr.querySelector('.nbtn');
      const toggle = () => { paused = !paused; btn.textContent = paused ? '▶' : '❚❚'; btn.setAttribute('aria-label', paused ? 'Play animation' : 'Pause animation'); };
      btn.addEventListener('click', toggle);
      c.cv.onclick = toggle;
    }
    if (reduceMotion() || typeof IntersectionObserver !== 'function') { t = total - 1; render(); return; }
    render();
    const io = new IntersectionObserver((es) => {
      const v = es.some((e) => e.isIntersecting);
      if (v && !on) { on = true; last = 0; raf = requestAnimationFrame(frame); }
      if (!v) { on = false; cancelAnimationFrame(raf); }
    });
    io.observe(c.cv);
    stops.push(() => { on = false; cancelAnimationFrame(raf); io.disconnect(); });
  }

  // ---------------------------------------------------------------- 1 purchases -> one screening
  function figAggregate(r) {
    const c = canvas('figAgg', 250); if (!c) return;
    const { ctx, W, H } = c;
    const sc = r.screenings.filter((x) => x.soldOut).sort((a, b) => b.tickets - a.tickets)[0] || r.screenings.slice().sort((a, b) => b.tickets - a.tickets)[0];
    const time = r.times[sc.s];
    const rows = r.history.rows.filter((x) => x.title_tag === sc.tag && x.play_day === sc.date && x.curtain_time === time);
    const film = r.slate[sc.f];
    const seats = [...new Set(r.settings.halls.map((h) => h.seats).filter((x) => x > 0))];
    const cum = []; rows.reduce((a, x, i) => (cum[i] = a + x.passes_bought), 0);
    const listW = Math.min(300, W * 0.42), bx = Math.max(listW + 70, W * 0.62), bw = Math.min(80, W * 0.12), base = H - 30, top = 28;
    const maxY = Math.max(...seats, sc.tickets) * 1.12, y = (v) => base - ((base - top) * v) / maxY;
    const rowH = 19, visible = Math.floor((H - 60) / rowH);
    function frame(added, phase3) {
      ctx.clearRect(0, 0, W, H);
      // the purchase list (next rows to add on top)
      text(ctx, 'title_tag · play_day · curtain_time · account · passes', 10, 16, { size: 11, color: C.dim });
      const first = Math.floor(added);
      for (let k = 0; k < visible; k++) {
        const i = first + k; if (i >= rows.length) break;
        const yy = 26 + k * rowH - (added - first) * rowH;
        if (yy < 20) continue;
        ctx.fillStyle = k === 0 ? 'rgba(255,255,255,.08)' : 'rgba(255,255,255,.03)'; ctx.fillRect(10, yy, listW, rowH - 3);
        text(ctx, film.tag + ' · ' + sc.date.slice(5) + ' · ' + time + ' · ' + rows[i].account_tag, 16, yy + 12, { size: 10.5, color: C.muted });
        text(ctx, String(rows[i].passes_bought), 10 + listW - 8, yy + 12, { size: 12, color: '#fff', weight: 700, align: 'right' });
      }
      // a chip in flight from the list to the bar
      if (added < rows.length && added > 0) {
        const f = added - first, i = first;
        const px = lerp(10 + listW, bx + bw / 2, ease(f)), py = lerp(26, y(cum[i] || 0) - 8, ease(f));
        ctx.fillStyle = 'hsl(' + film.hue + ',70%,55%)'; rr(ctx, px - 12, py - 9, 24, 18, 3); ctx.fill();
        text(ctx, String(rows[i].passes_bought), px, py + 4, { align: 'center', color: '#fff', weight: 700, size: 11 });
      }
      const total = first > 0 ? cum[Math.min(first, rows.length) - 1] : 0;
      ctx.fillStyle = 'hsl(' + film.hue + ',60%,40%)';
      ctx.fillRect(bx, y(total), bw, base - y(total));
      axes(ctx, bx - 14, base, Math.min(W - 8, bx + bw + 140), top);
      seats.forEach((s) => {
        const hit = s === sc.tickets && phase3 > 0;
        ctx.setLineDash([4, 3]); ctx.strokeStyle = hit ? '#fff' : '#555';
        ctx.beginPath(); ctx.moveTo(bx - 14, y(s)); ctx.lineTo(Math.min(W - 8, bx + bw + 140), y(s)); ctx.stroke(); ctx.setLineDash([]);
        text(ctx, s + ' seats', Math.min(W - 8, bx + bw + 140), y(s) - 4, { align: 'right', size: 11, color: hit ? '#fff' : C.dim });
      });
      text(ctx, 'y = ' + total, bx + bw / 2, y(total) - 8, { align: 'center', color: '#fff', weight: 800, size: 15 });
      text(ctx, rows.length - first + ' rows left', 10, H - 8, { size: 11 });
      if (phase3 > 0 && sc.soldOut) {
        ctx.globalAlpha = phase3;
        ctx.setLineDash([4, 3]); ctx.strokeStyle = 'hsl(' + film.hue + ',70%,60%)';
        ctx.strokeRect(bx, y(sc.tickets * 1.1), bw, y(sc.tickets) - y(sc.tickets * 1.1)); ctx.setLineDash([]);
        ctx.fillStyle = C.red; rr(ctx, bx + bw + 10, y(sc.tickets) + 6, 82, 18, 2); ctx.fill();
        ctx.globalAlpha = 1;
        text(ctx, 'SOLD OUT', bx + bw + 51, y(sc.tickets) + 19, { align: 'center', color: '#fff', weight: 800, size: 11, alpha: phase3 });
        text(ctx, 'demand ≥ ' + sc.tickets + '?', bx + bw / 2, y(sc.tickets * 1.1) - 6, { align: 'center', size: 11, color: C.text, alpha: phase3 });
      }
    }
    document.getElementById('figAggCap').textContent = film.title + ', ' + sc.date + ' ' + time + ': ' + rows.length + ' purchase rows from the generated records.';
    story(c, 'figAggNarr', [
      { ms: 2600, say: 'Each purchase row is one booking: how many passes one account bought for this film, day and show time.', draw: () => frame(0, 0) },
      { ms: 5200, say: 'Rows with the same film, venue, day and time are added up: the bar is the screening total y.', draw: (p) => frame(ease(p) * rows.length, 0) },
      { ms: 3600, say: sc.soldOut ? 'The total equals a hall size (' + sc.tickets + ' seats), so it is read as sold out: demand was at least ' + sc.tickets + ', possibly more.' : 'The total is below every hall size, so it is the full demand of that screening.', draw: (p) => frame(rows.length, ease(p * 2)) },
    ]);
  }

  // ---------------------------------------------------------------- 2 maximum likelihood, pass by pass
  function figMLE(r) {
    const narrow = isNarrow('figMle');
    const c = canvas('figMle', narrow ? 440 : 260); if (!c) return;
    const tr = r.estimate.trace;
    if (!tr || tr.length < 2) return;
    const { ctx, W, H } = c;
    const nS = r.times.length, lw = narrow ? W - 6 : W * 0.6, base = narrow ? 200 : H - 40, top = 30;
    const maxS = Math.max(1.6, ...tr.flatMap((t) => t.S.flat())) * 1.12;
    const lls = tr.map((t) => t.ll), llMax = Math.max(...lls);
    const gapLog = (v) => Math.log10(Math.max(llMax - v, 1e-3)), gMax = gapLog(lls[0]), gMin = -3;
    const steps = tr.length - 1;
    function frame(pos, showVals) {
      const i = Math.floor(pos), a = pos - i, j = Math.min(steps, i + 1);
      const S = [0, 1].map((g) => Array.from({ length: nS }, (_, s) => lerp(tr[i].S[g][s], tr[j].S[g][s], a)));
      ctx.clearRect(0, 0, W, H);
      const y = (v) => base - ((base - top) * v) / maxS;
      axes(ctx, 36, base, lw, top);
      [0.5, 1, 1.5, 2].forEach((v) => { if (v < maxS) { text(ctx, v.toFixed(1), 30, y(v) + 4, { align: 'right', size: 11 }); ctx.strokeStyle = v === 1 ? '#444' : C.line; ctx.beginPath(); ctx.moveTo(37, y(v)); ctx.lineTo(lw, y(v)); ctx.stroke(); } });
      const gw = (lw - 44) / nS, bw = Math.min(26, gw * 0.36);
      r.times.forEach((t, s) => {
        const x0 = 44 + s * gw + (gw - 2 * bw) / 2;
        [[0, C.red], [1, C.post]].forEach(([g, col]) => {
          ctx.fillStyle = col; ctx.fillRect(x0 + g * bw, y(S[g][s]), bw - 2, base - y(S[g][s]));
          if (showVals && gw > 50) text(ctx, S[g][s].toFixed(2), x0 + g * bw + (bw - 2) / 2, y(S[g][s]) - 4, { align: 'center', size: 10, color: C.text });
        });
        if (gw > 34 || s % 2 === 0) text(ctx, t, 44 + s * gw + gw / 2, base + 14, { align: 'center', size: 11 });
      });
      text(ctx, '■ time index, general films', 44, base + 32, { size: 11, color: C.red });
      text(ctx, '■ family films', 44 + 170, base + 32, { size: 11, color: C.post });
      text(ctx, 'pass ' + (pos >= steps ? steps : i + (a > 0 ? 1 : 0)) + ' of ' + steps, lw, 16, { align: 'right', size: 12, color: '#fff', weight: 700 });
      const lt = narrow ? base + 70 : top, lb = narrow ? H - 24 : base;
      const lx0 = narrow ? 56 : lw + 60, lx1 = W - 10, ly = (g) => lt + ((lb - lt) * (gMax - g)) / Math.max(1e-9, gMax - gMin);
      axes(ctx, lx0, lb, lx1, lt);
      text(ctx, 'how far from the best fit (log-likelihood gap)', lx0, lt - 10, { size: 11 });
      for (let e = Math.ceil(gMin); e <= Math.floor(gMax); e++) text(ctx, e >= 0 ? String(Math.pow(10, e)) : '1e' + e, lx0 - 5, ly(e) + 4, { align: 'right', size: 10 });
      ctx.strokeStyle = C.green; ctx.lineWidth = 2; ctx.beginPath();
      for (let q = 0; q <= Math.min(steps, i + 1); q++) {
        const v = q <= i ? lls[q] : lerp(lls[i], lls[q], a);
        const xx = lx0 + ((lx1 - lx0) * Math.min(q, pos)) / steps, yy = ly(gapLog(v));
        if (!q) ctx.moveTo(xx, yy); else ctx.lineTo(xx, yy);
      }
      ctx.stroke(); ctx.lineWidth = 1;
      text(ctx, 'pass', lx1, lb + 14, { align: 'right', size: 11 });
    }
    const passScenes = [];
    for (let k = 0; k < steps; k++) passScenes.push({ ms: 1300, say: () => 'Pass ' + (k + 1) + ': every index becomes observed ÷ expected tickets over its screenings; the likelihood can only go up (gap ' + Math.max(0, llMax - lls[k + 1]).toFixed(k + 1 >= steps ? 3 : 1) + ').', draw: (p) => frame(k + ease(p), false) });
    document.getElementById('figMleCap').textContent = 'Log-likelihood from ' + fmt(lls[0]) + ' (all indices 1) to ' + fmt(llMax) + ' after ' + steps + ' passes. Index 1 = an average show time.';
    story(c, 'figMleNarr', [
      { ms: 2600, say: 'Start: every show time counts the same (index 1). The data say otherwise; the fit has to find by how much.', draw: () => frame(0, false) },
      ...passScenes,
      { ms: 4200, say: 'Converged. Family films sell best in the afternoon, other films in the evening; these indices give every film a number at every time, even times it never played.', draw: () => frame(steps, true) },
    ]);
  }

  // ---------------------------------------------------------------- 3 Bayes update (belief sharpening, Lecture 2 p. 11)
  function gammaPdf(E, x, a, b) { return x <= 0 ? 0 : Math.exp(a * Math.log(b) + (a - 1) * Math.log(x) - b * x - E.logGamma(a)); }
  function bayesCell(est) {
    // a cell with several screenings and a visible gap between its own average and the pattern
    const c = est.cells.filter((x) => x.n >= 4 && x.n <= 8).sort((a, b) => Math.abs(b.own - b.pattern) / b.pattern - Math.abs(a.own - a.pattern) / a.pattern)[0];
    return c || root.Engine.workedCell(est);
  }
  function figBayes(r, E) {
    const narrow = isNarrow('figBayes');
    const c = canvas('figBayes', narrow ? 420 : 270); if (!c) return;
    const { ctx, W, H } = c;
    const est = r.estimate, cell = bayesCell(est), film = r.slate[cell.f], k = est.credibility;
    const scr = r.screenings.filter((x) => x.f === cell.f && x.s === cell.s && x.t === cell.t);
    const obs = scr.map((x) => ({ y: x.tickets, w: est.w(x.d), date: x.date, day: E.DAY_NAMES[x.d] }));
    const a0 = k * cell.pattern, b0 = k;
    const states = [{ a: a0, b: b0, n: 0, sy: 0, sw: 0 }];
    obs.forEach((o) => { const p = states[states.length - 1]; states.push({ a: p.a + o.y, b: p.b + o.w, n: p.n + 1, sy: p.sy + o.y, sw: p.sw + o.w }); });
    // zoom on the belief about the mean: prior and final posterior +- 5 standard deviations and the
    // final own average; single screenings outside this window are marked at the edge
    const fin = states[states.length - 1];
    const sd0 = Math.sqrt(a0) / b0, sdF = Math.sqrt(fin.a) / fin.b;
    let xlo = Math.min(cell.pattern - 5 * sd0, fin.a / fin.b - 5 * sdF, fin.n ? fin.sy / fin.sw : Infinity);
    let xhi = Math.max(cell.pattern + 5 * sd0, fin.a / fin.b + 5 * sdF, fin.n ? fin.sy / fin.sw : -Infinity);
    const padX = (xhi - xlo) * 0.08; xlo = Math.max(0, xlo - padX); xhi += padX;
    const cw = narrow ? W - 10 : Math.min(W * 0.56, W - 320), x0 = 30, base = narrow ? 170 : H - 40, top = 24;
    const peak = Math.max(...states.map((s) => gammaPdf(E, Math.max(1e-6, (s.a - 1) / s.b), s.a, s.b)));
    const X = (v) => x0 + ((cw - x0) * (v - xlo)) / (xhi - xlo), Y = (v) => base - ((base - top) * v) / (peak * 1.12);
    const xmax = xhi;
    const dotX = (v) => clamp(X(v), x0 + 4, cw - 4);
    const outside = (v) => v < xlo || v > xhi;
    const curve = (A, B, col, dash, upto) => {
      ctx.strokeStyle = col; ctx.lineWidth = 2.4; ctx.setLineDash(dash || []); ctx.beginPath();
      const n = Math.round(240 * (upto === undefined ? 1 : upto));
      for (let px = 0; px <= n; px++) { const v = xlo + ((xhi - xlo) * px) / 240, yy = Y(gammaPdf(E, v, A, B)); if (px === 0) ctx.moveTo(X(v), yy); else ctx.lineTo(X(v), yy); }
      ctx.stroke(); ctx.setLineDash([]); ctx.lineWidth = 1;
    };
    // st: tweened posterior; drop: [index, progress] of a screening falling onto the axis
    function frame(st, done, drop, priorUpto, showPost) {
      ctx.clearRect(0, 0, W, H);
      axes(ctx, x0, base, cw, top);
      const step = niceStep(xhi - xlo, 5);
      for (let v = Math.ceil(xlo / step) * step; v <= xhi; v += step) text(ctx, fmt(v), X(v), base + 14, { align: 'center', size: 11 });
      text(ctx, 'θ = mean tickets per screening (zoomed)', (x0 + cw) / 2, base + 30, { align: 'center', size: 11 });
      curve(a0, b0, C.prior, [6, 4], priorUpto);
      // screenings already absorbed: red dots on the axis at y / w
      const offL = [], offR = [];
      for (let q = 0; q < done.n; q++) {
        const v = obs[q].y / obs[q].w;
        ctx.fillStyle = C.red; ctx.globalAlpha = 0.85; ctx.beginPath(); ctx.arc(dotX(v), base, 4.5, 0, 7); ctx.fill(); ctx.globalAlpha = 1;
        if (v < xlo) offL.push(fmt(v)); else if (v > xhi) offR.push(fmt(v));
      }
      if (offL.length) text(ctx, '← ' + offL.join(', '), x0 + 4, base - 9, { size: 10, color: C.bad });
      if (offR.length) text(ctx, offR.join(', ') + ' →', cw - 4, base - 9, { size: 10, color: C.bad, align: 'right' });
      if (drop) {
        const [q, p] = drop, o = obs[q];
        const yy = lerp(top - 6, base, ease(p)), xx = dotX(o.y / o.w), right = xx > (x0 + cw) / 2;
        ctx.fillStyle = C.red; ctx.beginPath(); ctx.arc(xx, yy, 6, 0, 7); ctx.fill();
        text(ctx, o.day + ' ' + o.date.slice(5) + ': ' + o.y + ' tickets' + (outside(o.y / o.w) ? ' (off the scale)' : ''), xx + (right ? -9 : 9), yy - 6, { size: 11.5, color: '#fff', weight: 700, align: right ? 'right' : 'left' });
      }
      if (showPost) {
        curve(st.a, st.b, C.post);
        const mean = st.a / st.b;
        ctx.setLineDash([3, 3]); ctx.strokeStyle = '#aaa'; ctx.beginPath(); ctx.moveTo(X(mean), base); ctx.lineTo(X(mean), top); ctx.stroke(); ctx.setLineDash([]);
        text(ctx, 'posterior mean ' + f2(mean), X(mean) + 4, top + 4, { size: 11, color: '#ccc' });
      }
      const lx = narrow ? 10 : cw + 28, ly0 = narrow ? base + 50 : 30;
      const lines = [
        [C.prior, 'prior Gamma(' + f2(a0) + ', ' + k + ')' + (narrow ? ', P = ' : ': the pattern, P = ') + f2(cell.pattern) + (narrow ? '' : ', worth k = ' + k)],
        [C.post, 'posterior Gamma(' + f2(st.a) + ', ' + f2(st.b) + ')' + (narrow ? ', n = ' + done.n : ': after ' + done.n + ' screening' + (done.n === 1 ? '' : 's'))],
        [C.red, done.n ? 'own average ' + f2(done.sy / done.sw) + ' (' + done.sy + ' tickets ÷ ' + f2(done.sw) + ')' : 'own average: no screening yet'],
      ];
      lines.forEach(([col, s], q) => { ctx.fillStyle = col; ctx.fillRect(lx, ly0 + q * 22 - 4, 14, 3); text(ctx, s, lx + 20, ly0 + q * 22, { size: 12, color: C.text }); });
      const wp = k / st.b, wd = 1 - wp, by = ly0 + 82, mean = st.a / st.b;
      text(ctx, 'POSTERIOR MEAN = WEIGHTED AVERAGE', lx, by, { size: 10.5, color: C.dim, weight: 700 });
      text(ctx, f2(mean) + ' = ' + f2(wp) + ' × ' + f2(cell.pattern) + (done.n ? ' + ' + f2(wd) + ' × ' + f2(done.sy / done.sw) : ''), lx, by + 22, { size: 13.5, color: '#fff', weight: 700 });
      const bw = W - lx - 10;
      ctx.fillStyle = C.prior; ctx.fillRect(lx, by + 34, bw * wp, 10);
      ctx.fillStyle = C.post; ctx.fillRect(lx + bw * wp, by + 34, bw * wd, 10);
      text(ctx, 'PATTERN ' + Math.round(100 * wp) + '%', lx, by + 60, { size: 10.5, color: C.prior, weight: 700 });
      text(ctx, 'OWN DATA ' + Math.round(100 * wd) + '%', lx + bw, by + 60, { size: 10.5, color: C.post, weight: 700, align: 'right' });
    }
    const tween = (s0, s1, p) => ({ a: lerp(s0.a, s1.a, p), b: lerp(s0.b, s1.b, p) });
    const scenes = [
      { ms: 3200, say: 'Before any screening: the pattern says ' + f2(cell.pattern) + ' tickets on average. As a Gamma prior worth k = ' + k + ' screenings, the mean is uncertain by about ±' + f2(sd0) + '.', draw: (p) => frame(states[0], states[0], null, ease(p * 1.4), false) },
    ];
    obs.forEach((o, q) => {
      scenes.push({ ms: 1300, say: 'Screening ' + (q + 1) + ' of ' + obs.length + ' (' + o.day + ' ' + o.date.slice(5) + ') sold ' + o.y + ' tickets.', draw: (p) => frame(states[q], states[q], [q, p], 1, q > 0) });
      scenes.push({ ms: 1700, say: 'Bayes\' rule: shape + ' + o.y + ', rate + ' + f2(o.w) + ' (weekday exposure). The belief about the mean moves toward the data and gets narrower; one screening counts as much as 1 / k of the pattern.', draw: (p) => frame(tween(states[q], states[q + 1], ease(p)), p > 0.5 ? states[q + 1] : states[q], null, 1, true) });
    });
    scenes.push({ ms: 4200, say: 'Result: ' + f2(states[states.length - 1].a / states[states.length - 1].b) + ' tickets per screening, a weighted average of pattern and own data. Few screenings: the pattern dominates; many: the data do.', draw: () => frame(states[states.length - 1], states[states.length - 1], null, 1, true) });
    document.getElementById('figBayesCap').textContent = film.title + ', ' + r.times[cell.s] + ', ' + E.DAY_TYPE_NAMES[cell.t] + ' (' + obs.length + ' screenings). The hand-checkable worked example in the proposal uses a cell with 2 screenings; the arithmetic is the same.';
    story(c, 'figBayesNarr', scenes);
  }

  // ---------------------------------------------------------------- 4 predictive demand vs hall size
  function figPredictive(r, E) {
    const c = canvas('figPred', 250); if (!c) return;
    const { ctx, W, H } = c;
    const P = r.problem, d = 5;
    let best = null;
    for (let s = 0; s < P.nS; s++) r.proposed.plan[d][s].forEach((f, h) => { if (f !== null && (!best || P.est.demand(f, s, d) > P.est.demand(best.f, best.s, d))) best = { f, s, h }; });
    if (!best) return;
    const mu = P.est.demand(best.f, best.s, d), rr2 = P.est.shape(best.f, best.s, d);
    const sd = Math.sqrt(mu + (mu * mu) / rr2), ymax = Math.ceil(mu + 3.2 * sd);
    const pm = Array.from({ length: ymax + 1 }, (_, y) => Math.exp(E.logNegBin(y, Math.max(mu, 1e-9), rr2)));
    const halls = P.halls.filter((h) => h.usable).slice().sort((a, b) => a.seats - b.seats);
    const film = r.slate[best.f];
    const x0 = 34, base = H - 30, top = 44, pmax = Math.max(...pm) * 1.15;
    const X = (v) => x0 + ((W - 12 - x0) * v) / ymax, Y = (v) => base - ((base - top) * v) / pmax;
    function frame(grow, seats, label) {
      ctx.clearRect(0, 0, W, H);
      axes(ctx, x0, base, W - 12, top);
      const bw = Math.max(1, (W - 12 - x0) / (ymax + 1) - 0.5);
      pm.forEach((p, y) => {
        const over = seats !== null && y > seats;
        ctx.fillStyle = over ? '#4d4d4d' : 'hsl(' + film.hue + ',60%,45%)';
        const h = (base - Y(p)) * ease(grow * 1.3 - (y / ymax) * 0.3);
        ctx.fillRect(X(y), base - h, bw, h);
      });
      const step = niceStep(ymax, 5);
      for (let v = 0; v <= ymax; v += step) text(ctx, String(v), X(v), base + 14, { align: 'center', size: 11 });
      text(ctx, 'tickets demanded by one screening', W - 12, H - 2, { align: 'right', size: 11 });
      if (seats === null) { text(ctx, 'mean demand ' + f2(mu) + ', spread from the records', x0, 18, { color: C.text, weight: 700, size: 13 }); return; }
      const sx = X(Math.min(seats, ymax));
      ctx.strokeStyle = '#fff'; ctx.setLineDash([5, 4]); ctx.beginPath(); ctx.moveTo(sx, base); ctx.lineTo(sx, top - 6); ctx.stroke(); ctx.setLineDash([]);
      text(ctx, label + ': ' + Math.round(seats) + ' seats', sx + (sx > W * 0.7 ? -6 : 6), top - 8, { align: sx > W * 0.7 ? 'right' : 'left', color: '#fff', weight: 700, size: 12 });
      const sold = E.expectedSoldNB(mu, Math.round(seats), rr2);
      text(ctx, 'expected tickets sold = E[min(D, ' + Math.round(seats) + ')] = ' + f2(sold), x0, 18, { color: C.text, weight: 700, size: 13 });
      if (W > 640) text(ctx, 'grey = demand the hall cannot seat', W - 12, 18, { align: 'right', size: 11 });
    }
    const scenes = [{ ms: 3000, say: film.title + ' on Saturday ' + r.times[best.s] + ': demand is uncertain. The predictive is a negative binomial (mean ' + f2(mu) + ') that includes screening spread and estimation uncertainty.', draw: (p) => frame(p, null, '') }];
    let prev = ymax;
    halls.forEach((h, k) => {
      const from = prev, to = h.seats;
      scenes.push({ ms: 2600, say: 'In ' + h.name + ' (' + h.seats + ' seats) demand above ' + h.seats + ' is lost. Expected tickets = E[min(D, ' + h.seats + ')] = ' + f2(E.expectedSoldNB(mu, h.seats, rr2)) + '.', draw: (p) => frame(1, lerp(from, to, ease(p * 1.6)), h.name) });
      prev = to;
    });
    scenes.push({ ms: 3600, say: 'So a bigger hall is worth more only when demand can exceed the smaller one. The plan uses exactly these numbers for every film, hall and time.', draw: () => frame(1, halls[halls.length - 1].seats, halls[halls.length - 1].name) });
    document.getElementById('figPredCap').textContent = 'Variance = μ + μ²/r + w²·Var(θ): Poisson count, screening spread r = ' + P.est.dispersion + ' (maximum likelihood), estimation uncertainty.';
    story(c, 'figPredNarr', scenes);
  }

  // ---------------------------------------------------------------- 5 caution
  function figCaution(r, E) {
    const narrow = isNarrow('figCaution');
    const c = canvas('figCaution', narrow ? 270 : 210); if (!c) return;
    const { ctx, W, H } = c;
    const P = r.problem, cells = P.est.cells.filter((x) => !P.isNew(x.f));
    const untried = cells.filter((x) => !x.tested).sort((a, b) => b.estimate - a.estimate)[0];
    const strong = cells.filter((x) => x.tested).sort((a, b) => a.priorShare - b.priorShare)[0];
    const thin = cells.filter((x) => x.tested && x.n === 1).sort((a, b) => b.estimate - a.estimate)[0];
    const ex = [strong, thin, untried].filter(Boolean);
    const label = (x) => short(r.slate[x.f].title) + ' ' + r.times[x.s] + ' ' + E.DAY_TYPE_NAMES[x.t] + (x.tested ? ', ' + x.n + ' screening' + (x.n === 1 ? '' : 's') : ', never shown');
    const cDef = r.settings.caution;
    const lx = narrow ? 8 : Math.min(270, W * 0.45), maxV = Math.max(...ex.map((x) => x.estimate)) * 1.08;
    function frame(cc) {
      ctx.clearRect(0, 0, W, H);
      text(ctx, 'caution c = ' + cc.toFixed(2) + (Math.abs(cc - cDef) < 0.005 ? ' (default)' : ''), 8, 16, { color: '#fff', weight: 700, size: 13 });
      if (!narrow) text(ctx, 'planning mean = estimate × (1 − c × pattern share)', W - 8, 16, { align: 'right', size: 11 });
      ex.forEach((x, q) => {
        const share = x.priorShare, val = x.estimate * (1 - cc * share);
        const y0 = narrow ? 30 + q * 78 : 36 + q * 56;
        text(ctx, label(x), 8, y0 + 14, { size: 12, color: C.text });
        text(ctx, 'pattern share ' + Math.round(100 * share) + '%', 8, narrow ? y0 + 58 : y0 + 30, { size: 11 });
        const y = narrow ? y0 + 22 : y0, Xs = (v) => lx + ((W - lx - 120) * v) / maxV;
        ctx.fillStyle = '#333'; ctx.fillRect(lx, y + 4, Xs(x.estimate) - lx, 16);
        ctx.fillStyle = x.tested ? C.red : C.prior; ctx.fillRect(lx, y + 4, Xs(val) - lx, 16);
        text(ctx, f2(x.estimate) + ' → ' + f2(val), Xs(x.estimate) + 6, y + 16, { size: 12, color: C.text });
      });
    }
    story(c, 'figCautionNarr', [
      { ms: 2400, say: 'Grey = the estimate. Each estimate is part data, part pattern ("pattern share"). With c = 0 the plan trusts the pattern fully.', draw: () => frame(0) },
      { ms: 3000, say: 'Raising c cuts only the pattern part: the never-shown combination loses most, the well-observed one hardly anything.', draw: (p) => frame(ease(p)) },
      { ms: 2400, say: 'c = 1 ignores the pattern completely: untried times would never be chosen, even good ones.', draw: () => frame(1) },
      { ms: 2600, say: 'The default c = ' + cDef + ' (tuned on mock histories) balances the two: guesses count, but less than evidence.', draw: (p) => frame(lerp(1, cDef, ease(p))) },
      { ms: 3000, say: 'Why: an optimiser hunts for the highest numbers, and the most optimistic numbers are exactly the guesses.', draw: () => frame(cDef) },
    ]);
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
      // the best alternative film for this hall-time (free at that time, below its maximum)
      let alt = null;
      P.slate.forEach((fb, b) => {
        if (b === a || !P.fits[b] || plan[d][s].includes(b) || shows[b] < fb.min || (fb.max !== null && shows[b] >= fb.max)) return;
        const vb = P.value(b, h, d, s);
        if (vb > 0 && (!alt || vb > alt.vb)) alt = { b, vb };
      });
      const va = P.value(a, h, d, s);
      if (!alt || va <= 0 || alt.vb > va) return;
      // a clearly lower alternative (about 70% of the value) keeps the picture readable
      const score = Math.abs(alt.vb / va - 0.7);
      if (!best || score < best.score) best = { d, s, h, a, b: alt.b, va, vb: alt.vb, ratio: alt.vb / va, score };
    });
    return best;
  }
  function figLP(r, E) {
    const c = canvas('figLp', 300); if (!c) return;
    const sl = lpSlice(r);
    if (!sl) return;
    const { ctx, W, H } = c;
    const P = r.problem, A = r.slate[sl.a], B = r.slate[sl.b];
    const narrow = W < 640;
    const ox = 50, oy = H - 38, s0 = Math.min((oy - 26) / 1.25, (narrow ? W - 90 : W * 0.44) / 1.25);
    const X = (v) => ox + v * s0, Y = (v) => oy - v * s0;
    const L = 1.25;
    const clip = (z) => { const pts = []; const add = (x, y) => { if (x >= -1e-9 && x <= L + 1e-9 && y >= -1e-9 && y <= L + 1e-9) pts.push([x, y]); }; add(z / sl.va, 0); add(0, z / sl.vb); add(L, (z - sl.va * L) / sl.vb); add((z - sl.vb * L) / sl.va, L); return pts.slice(0, 2); };
    function frame(o) {
      ctx.clearRect(0, 0, W, H);
      axes(ctx, ox, oy, X(L), Y(L));
      text(ctx, 'x₁', X(L) + 6, oy + 4, { size: 13, color: C.text, weight: 700 });
      text(ctx, 'x₂', ox, Y(L) - 8, { size: 13, color: C.text, weight: 700, align: 'center' });
      text(ctx, '1', X(1), oy + 16, { align: 'center', size: 11 }); text(ctx, '1', ox - 8, Y(1) + 4, { align: 'right', size: 11 }); text(ctx, '0', ox - 8, oy + 14, { align: 'right', size: 11 });
      if (o.box) { ctx.strokeStyle = 'rgba(255,255,255,.25)'; ctx.setLineDash([3, 3]); ctx.strokeRect(X(0), Y(1), s0, s0); ctx.setLineDash([]); }
      if (o.rule > 0) {
        ctx.strokeStyle = '#ddd'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(X(0), Y(1)); ctx.lineTo(X(o.rule), Y(1 - o.rule)); ctx.stroke(); ctx.lineWidth = 1;
        if (o.rule >= 1) text(ctx, 'x₁ + x₂ ≤ 1', X(0.62) + 8, Y(0.38) - 2, { size: 12, color: '#ddd' });
      }
      if (o.fill > 0) {
        ctx.fillStyle = 'rgba(255,255,255,' + 0.1 * o.fill + ')';
        ctx.beginPath(); ctx.moveTo(X(0), Y(0)); ctx.lineTo(X(1), Y(0)); ctx.lineTo(X(0), Y(1)); ctx.closePath(); ctx.fill();
        text(ctx, 'FEASIBLE', X(0.18), Y(0.25), { size: 11, color: C.dim, weight: 700, alpha: o.fill });
      }
      if (o.z !== null) {
        for (let q = 1; q <= 6; q++) { const seg = clip((sl.va * 1.25 * q) / 6); if (seg.length === 2) { ctx.strokeStyle = 'rgba(84,185,255,.08)'; ctx.beginPath(); ctx.moveTo(X(seg[0][0]), Y(seg[0][1])); ctx.lineTo(X(seg[1][0]), Y(seg[1][1])); ctx.stroke(); } }
        const seg = clip(Math.max(1e-6, o.z));
        if (seg.length === 2) { ctx.strokeStyle = C.post; ctx.setLineDash([7, 4]); ctx.lineWidth = 2.2; ctx.beginPath(); ctx.moveTo(X(seg[0][0]), Y(seg[0][1])); ctx.lineTo(X(seg[1][0]), Y(seg[1][1])); ctx.stroke(); ctx.setLineDash([]); ctx.lineWidth = 1; }
        text(ctx, 'z = ' + f2(o.z), X(Math.min(L, o.z / sl.va)) + 6, oy - 8, { size: 11.5, color: C.post, weight: 700 });
        [[0, 0], [1, 0], [0, 1]].forEach((p) => text(ctx, '(' + p[0] + ',' + p[1] + ') z = ' + f2(sl.va * p[0] + sl.vb * p[1]), X(p[0]) + 8, Y(p[1]) - (p[1] ? 10 : 22), { size: 11, color: p[0] === 1 && o.win ? '#fff' : C.muted }));
      }
      if (o.win) {
        const pulse = 7 + 3 * Math.sin(o.win * Math.PI * 6);
        ctx.fillStyle = C.post; ctx.beginPath(); ctx.arc(X(1), Y(0), pulse, 0, 7); ctx.fill();
        ctx.globalAlpha = 0.55; ctx.beginPath(); ctx.arc(X(0.5), Y(0.5), 4, 0, 7); ctx.fill(); ctx.globalAlpha = 1;
        text(ctx, '(0.5, 0.5): ' + f2((sl.va + sl.vb) / 2), X(0.5) - 8, Y(0.5) + 4, { size: 11, align: 'right' });
      }
      if (!narrow) {
        const rx = X(L) + 70;
        text(ctx, E.DAY_NAMES[sl.d] + ' ' + r.times[sl.s] + ', ' + P.halls[sl.h].name, rx, 34, { size: 14, color: '#fff', weight: 700 });
        text(ctx, 'x₁ = ' + A.title + ' here (value ' + f2(sl.va) + ')', rx, 58, { size: 12.5, color: C.text });
        text(ctx, 'x₂ = ' + B.title + ' here (value ' + f2(sl.vb) + ')', rx, 78, { size: 12.5, color: C.text });
        text(ctx, 'all other ' + (r.proposed.lp.vars - 2) + ' variables fixed at the plan', rx, 98, { size: 12 });
        if (o.win) text(ctx, 'OPTIMAL CORNER: (1, 0) = ' + A.title + ' plays here', rx, 134, { size: 13.5, color: C.post, weight: 800 });
      }
    }
    document.getElementById('figLpCap').textContent = 'A real two-variable slice of the weekly LP: ' + E.DAY_NAMES[sl.d] + ' ' + r.times[sl.s] + ', ' + P.halls[sl.h].name + ', ' + A.title + ' vs the best alternative for that hall and time, ' + B.title + '.';
    story(c, 'figLpNarr', [
      { ms: 2600, say: 'Two decisions for one hall and time: x₁ = 1 means ' + A.title + ' plays, x₂ = 1 means ' + B.title + ' plays. Everything else in the week stays as planned.', draw: () => frame({ box: true, rule: 0, fill: 0, z: null, win: 0 }) },
      { ms: 2600, say: 'Rule: one film per hall at a time, x₁ + x₂ ≤ 1. With 0 ≤ x ≤ 1 this leaves a triangle of allowed choices.', draw: (p) => frame({ box: true, rule: ease(p * 1.3), fill: ease(p * 2 - 1), z: null, win: 0 }) },
      { ms: 4200, say: 'Objective z = ' + f2(sl.va) + ' x₁ + ' + f2(sl.vb) + ' x₂ (planning values). Push the line z up as far as the triangle allows.', draw: (p) => frame({ box: true, rule: 1, fill: 1, z: ease(p) * sl.va, win: 0 }) },
      { ms: 3800, say: 'The line last touches a corner, (1, 0): ' + A.title + ' plays. Corners have whole numbers, so the LP answer is a real schedule; the half-half point scores less.', draw: (p) => frame({ box: true, rule: 1, fill: 1, z: sl.va, win: p + 0.001 }) },
    ]);
  }

  // ---------------------------------------------------------------- 7 simplex objective vs dual bound (Lecture 1, p. 41)
  function figDual(r) {
    const c = canvas('figDual', 240); if (!c) return;
    const { ctx, W, H } = c;
    const zt = r.proposed.lp.zTrace || [], bound = r.proposed.lp.dualBound;
    if (zt.length < 2) return;
    const x0 = 58, base = H - 30, top = 36, n = zt.length - 1;
    const lo = Math.min(...zt), hi = bound, pad = (hi - lo) * 0.08 || 1;
    const X = (i) => x0 + ((W - 14 - x0) * i) / n, Y = (v) => base - ((base - top) * (v - lo + pad)) / (hi - lo + 2 * pad);
    function frame(pos, boundAlpha, done) {
      ctx.clearRect(0, 0, W, H);
      axes(ctx, x0, base, W - 14, top);
      const step = niceStep(hi - lo + 2 * pad, 4);
      for (let v = Math.ceil((lo - pad) / step) * step; v <= hi + pad; v += step) text(ctx, fmt(v), x0 - 6, Y(v) + 4, { align: 'right', size: 11 });
      ctx.globalAlpha = boundAlpha;
      ctx.strokeStyle = '#fff'; ctx.setLineDash([6, 4]); ctx.beginPath(); ctx.moveTo(x0, Y(bound)); ctx.lineTo(W - 14, Y(bound)); ctx.stroke(); ctx.setLineDash([]);
      ctx.globalAlpha = 1;
      text(ctx, 'dual bound ' + f2(bound) + ': no week can score more', W - 14, Y(bound) - 7, { align: 'right', size: 12, color: '#fff', alpha: boundAlpha });
      if (pos > 0) {
        const i = Math.floor(pos), a = pos - i, zNow = i >= n ? zt[n] : lerp(zt[i], zt[i + 1], a);
        ctx.strokeStyle = C.red; ctx.lineWidth = 2.2; ctx.beginPath();
        for (let q = 0; q <= Math.min(i, n); q++) { if (q) ctx.lineTo(X(q), Y(zt[q])); else ctx.moveTo(X(q), Y(zt[q])); }
        if (i < n) ctx.lineTo(X(pos), Y(zNow));
        ctx.stroke(); ctx.lineWidth = 1;
        ctx.fillStyle = 'rgba(84,185,255,.4)'; ctx.fillRect(X(Math.min(pos, n)) - 1.5, Y(bound), 3, Y(zNow) - Y(bound));
        ctx.fillStyle = C.red; ctx.beginPath(); ctx.arc(X(Math.min(pos, n)), Y(zNow), 4.5, 0, 7); ctx.fill();
        text(ctx, 'pivot ' + Math.min(n, Math.round(pos)) + ': planning value ' + f2(zNow) + ', gap ' + f2(Math.max(0, bound - zNow)), x0, 18, { size: 12.5, color: done ? C.green : C.text, weight: 700 });
      }
      if (done) text(ctx, 'VALUE = BOUND: CERTIFIED OPTIMAL', W - 14, top + 26, { align: 'right', size: 13, color: C.green, weight: 800, alpha: done });
      text(ctx, 'simplex pivot', W - 14, H - 4, { align: 'right', size: 11 });
    }
    document.getElementById('figDualCap').textContent = n + ' simplex pivots after a first feasible week; ' + r.proposed.lp.vars + ' variables, ' + r.proposed.lp.rows + ' rules.';
    story(c, 'figDualNarr', [
      { ms: 2600, say: 'The dual prices give an upper bound: by weak duality no allowed week can have a higher planning value than ' + f2(bound) + '.', draw: (p) => frame(0, ease(p * 1.5), 0) },
      { ms: 6500, say: 'The simplex method swaps one screening in and one out per pivot; the planning value never goes down.', draw: (p) => frame(Math.max(0.001, ease(p) * n), 1, 0) },
      { ms: 3600, say: 'It stops when the value meets the bound (' + f2(zt[n]) + ' = ' + f2(bound) + '): proof that no better week exists for this model.', draw: (p) => frame(n, 1, ease(p * 2)) },
    ]);
  }

  // ---------------------------------------------------------------- cinema: baseline vs optimised on a running clock
  // u runs from 0 to the number of show times; inside one show time: doors open (people walk in and
  // sit), the film plays (lights down, screen glows), the audience leaves. People = expected tickets.
  const PH_IN = 0.34, PH_OUT = 0.74, SEC_PER_STEP = 3.4;
  const sim = { u: 0.5, playing: false, last: 0, raf: 0, r: null, data: null, layout: null, cache: {} };
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
    steps.forEach((x) => { x.prevB = cb; x.prevP = cp; cb += x.base.reduce((a, c) => a + c.t, 0); cp += x.prop.reduce((a, c) => a + c.t, 0); x.cumB = cb; x.cumP = cp; });
    return steps;
  }
  function layoutPanel(halls, px, py, pw, ph) {
    const usable = halls.map((h, k) => ({ ...h, k })).filter((h) => h.seats > 0);
    const gap = 10, lobbyH = 40, labelH = 16, screenH = 15;
    const shape = usable.map((h) => { const cols = Math.max(6, Math.round(Math.sqrt(h.seats * 1.7))); return { cols, rows: Math.ceil(h.seats / cols) }; });
    const totalCols = shape.reduce((a, x) => a + x.cols, 0);
    const maxRows = Math.max(...shape.map((x) => x.rows), 1);
    const availH = ph - 26 - lobbyH - screenH - labelH - 22;
    const pitch = Math.max(2.4, Math.min(13, (pw - gap * (usable.length + 1) - 16 * usable.length) / totalCols, availH / maxRows));
    const hallH = screenH + 14 + maxRows * pitch + labelH + 6;
    const top = py + 26;
    let x = px + gap;
    const lobbyTop = top + hallH, lobbyY = lobbyTop + lobbyH / 2 + 2;
    const out = usable.map((h, i) => {
      const sh = shape[i], w = sh.cols * pitch + 16;
      const hall = { k: h.k, x, y: top, w, h: hallH, cap: h.seats, pitch };
      hall.screen = { x: x + w * 0.12, y: top + 5, w: w * 0.76, h: screenH - 3 };
      hall.door = { x: x + w / 2, y: top + hallH };
      const y0 = top + screenH + 12 + (maxRows - sh.rows) * pitch * 0.5;
      hall.seats = [];
      for (let q = 0; q < h.seats; q++) {
        const row = Math.floor(q / sh.cols), col = q % sh.cols;
        hall.seats.push({ x: x + 8 + col * pitch + pitch / 2, y: y0 + row * pitch + pitch / 2 });
      }
      // people take the middle seats first, about 60% of the way back
      const cx = x + w / 2, cy = y0 + sh.rows * pitch * 0.6;
      const rng = root.Engine.mulberry32(h.seats * 31 + i);
      hall.order = hall.seats.map((p, q) => [q, Math.hypot((p.x - cx) * 0.8, p.y - cy) + rng() * pitch * 2]).sort((a, b) => a[1] - b[1]).map((e) => e[0]);
      x += w + gap;
      return hall;
    });
    return { halls: out, px, py, pw, ph, lobbyTop, lobbyY, lobbyH, entrance: { x: px + 6, y: lobbyY }, exit: { x: px + pw - 6, y: lobbyY } };
  }
  function audience(key, step, hall, h) {
    const id = key + '|' + step + '|' + hall.k;
    if (sim.cache[id]) return sim.cache[id];
    const rng = root.Engine.mulberry32(7000 + step * 13 + hall.k * 3 + (key === 'prop' ? 1 : 0));
    const n = Math.min(h.n, hall.seats.length);
    const people = [];
    for (let i = 0; i < n; i++) people.push({ tIn: Math.pow(rng(), 0.85), tOut: rng(), lane: (rng() - 0.5) * 14, shade: 40 + rng() * 22 });
    people.sort((a, b) => a.tIn - b.tIn).forEach((p, i) => { p.seat = hall.order[i]; });
    const away = [];
    const full = h.n >= 0.92 * h.seats;
    if (full) for (let i = 0; i < Math.min(h.away, 30); i++) away.push({ t: rng(), lane: (rng() - 0.5) * 14 });
    return (sim.cache[id] = { people, away, full });
  }
  function along(pts, p) {
    const n = pts.length - 1, q = clamp(p, 0, 1) * n, k = Math.min(Math.floor(q), n - 1), f = q - k;
    return { x: lerp(pts[k].x, pts[k + 1].x, f), y: lerp(pts[k].y, pts[k + 1].y, f) };
  }
  function drawPanel(ctx, L, key, label, step, frac) {
    const r = sim.r, x = sim.data[step], halls = x[key];
    const showing = frac >= PH_IN && frac < PH_OUT;
    const dim = showing ? clamp((frac - PH_IN) / 0.05, 0, 1) * clamp((PH_OUT - frac) / 0.05, 0, 1) : 0;
    text(ctx, label, L.px + 10, L.py + 16, { color: key === 'prop' ? '#fff' : C.muted, weight: 700, size: 13 });
    // lobby
    ctx.fillStyle = '#1d1712'; ctx.fillRect(L.px + 4, L.lobbyTop, L.pw - 8, L.lobbyH);
    text(ctx, 'ENTRANCE', L.px + 8, L.lobbyTop + L.lobbyH - 5, { size: 8.5, color: '#f5b301', weight: 700 });
    text(ctx, 'EXIT', L.px + L.pw - 8, L.lobbyTop + L.lobbyH - 5, { size: 8.5, color: '#f5b301', weight: 700, align: 'right' });
    let seatedTotal = 0;
    L.halls.forEach((hall) => {
      const h = halls[hall.k], film = h.f === null ? null : r.slate[h.f];
      ctx.fillStyle = 'rgb(' + Math.round(lerp(30, 12, dim)) + ',' + Math.round(lerp(30, 12, dim)) + ',' + Math.round(lerp(34, 15, dim)) + ')';
      rr(ctx, hall.x, hall.y, hall.w, hall.h, 5); ctx.fill(); ctx.strokeStyle = '#2f2f2f'; ctx.stroke();
      const sc = hall.screen;
      if (film && dim > 0) {
        const g = ctx.createLinearGradient(0, sc.y, 0, sc.y + 60);
        g.addColorStop(0, 'hsla(' + film.hue + ',80%,60%,' + 0.3 * dim + ')'); g.addColorStop(1, 'hsla(' + film.hue + ',80%,60%,0)');
        ctx.fillStyle = g; ctx.fillRect(hall.x + 3, sc.y, hall.w - 6, 60);
      }
      ctx.fillStyle = film ? (dim > 0 ? 'hsl(' + film.hue + ',70%,' + (40 + 25 * dim) + '%)' : 'hsl(' + film.hue + ',35%,28%)') : '#2a2a2a';
      rr(ctx, sc.x, sc.y, sc.w, sc.h, 2); ctx.fill();
      ctx.save(); ctx.beginPath(); ctx.rect(sc.x, sc.y, sc.w, sc.h); ctx.clip();
      const fs = Math.min(11, sc.h - 2);
      ctx.font = '800 ' + fs + 'px ' + FONT;
      const name = film ? (ctx.measureText(film.title).width <= sc.w - 4 ? film.title : short(film.title)) : 'no show';
      text(ctx, name, sc.x + sc.w / 2, sc.y + sc.h - 3, { size: fs, color: film && dim > 0.5 ? '#000' : '#eee', weight: 800, align: 'center' });
      ctx.restore();
      const s = hall.pitch * 0.72;
      ctx.fillStyle = '#2b2b2f';
      hall.seats.forEach((p) => ctx.fillRect(p.x - s / 2, p.y - s / 2, s, s));
      if (!film) return;
      const a = audience(key, step, hall, h);
      const door = hall.door, rad = Math.max(1.4, hall.pitch * 0.32);
      let seated = 0;
      a.people.forEach((p) => {
        const seat = hall.seats[p.seat];
        let pos = null, sit = false;
        if (frac < PH_IN) {
          const q = clamp((frac / PH_IN - p.tIn * 0.6) / 0.38, 0, 1);
          if (q >= 1) sit = true;
          else if (q > 0) pos = along([{ x: L.entrance.x, y: L.lobbyY + p.lane * 0.6 }, { x: door.x, y: L.lobbyY + p.lane * 0.6 }, { x: door.x, y: door.y - 3 }, seat], ease(q));
        } else if (frac < PH_OUT) sit = true;
        else {
          const q = clamp(((frac - PH_OUT) / (1 - PH_OUT) - p.tOut * 0.45) / 0.5, 0, 1);
          if (q <= 0) sit = true;
          else if (q < 1) pos = along([seat, { x: door.x, y: door.y - 3 }, { x: door.x, y: L.lobbyY + p.lane * 0.6 }, { x: L.exit.x, y: L.lobbyY + p.lane * 0.6 }], ease(q));
        }
        if (sit) {
          seated++;
          ctx.fillStyle = 'hsl(' + film.hue + ',70%,' + (p.shade - 6 * dim) + '%)';
          ctx.fillRect(seat.x - s / 2, seat.y - s / 2, s, s);
          ctx.fillStyle = 'rgba(255,255,255,' + (0.55 - 0.35 * dim) + ')';
          ctx.beginPath(); ctx.arc(seat.x, seat.y - s * 0.12, s * 0.22, 0, 7); ctx.fill();
        } else if (pos) {
          ctx.fillStyle = 'hsl(' + film.hue + ',80%,' + (p.shade + 14) + '%)';
          ctx.beginPath(); ctx.arc(pos.x, pos.y + Math.sin((pos.x + pos.y) * 0.9) * 0.6, rad, 0, 7); ctx.fill();
        }
      });
      seatedTotal += seated;
      // turned away: walk to the door, find it full, walk back out
      if (frac < PH_IN && a.full) {
        const ph = frac / PH_IN;
        a.away.forEach((p) => {
          const q = clamp((ph - (0.55 + p.t * 0.25)) / 0.22, 0, 1);
          if (q <= 0 || q >= 1) return;
          const pos = q < 0.55 ? along([{ x: L.entrance.x, y: L.lobbyY + p.lane }, { x: door.x + p.lane * 0.4, y: L.lobbyY - 5 }], q / 0.55) : along([{ x: door.x + p.lane * 0.4, y: L.lobbyY - 5 }, { x: L.entrance.x, y: L.lobbyY + p.lane + 6 }], (q - 0.55) / 0.45);
          ctx.fillStyle = C.bad; ctx.beginPath(); ctx.arc(pos.x, pos.y, rad * 0.9, 0, 7); ctx.fill();
        });
        if (ph > 0.6) { ctx.fillStyle = C.red; rr(ctx, door.x - 23, L.lobbyTop + 3, 46, 12, 2); ctx.fill(); text(ctx, 'SOLD OUT', door.x, L.lobbyTop + 12, { size: 8, color: '#fff', weight: 800, align: 'center' }); }
      }
      text(ctx, seated + ' / ' + hall.cap, hall.x + hall.w / 2, hall.y + hall.h - 5, { size: 10.5, color: '#fff', weight: 800, align: 'center' });
      ctx.fillStyle = dim > 0 ? '#3a1b1b' : '#6b4b1e'; ctx.fillRect(door.x - 6, door.y - 3, 12, 4);
    });
    return seatedTotal;
  }
  function clockAt(u) {
    const n = sim.data.length, i = Math.min(Math.floor(u), n - 1), frac = clamp(u - i, 0, 0.9999);
    const x = sim.data[i], st = sim.r.settings, start = root.Engine.toMinutes(sim.r.times[x.s]);
    const showLen = st.slotMinutes - st.cleaning;
    let m, phase;
    if (frac < PH_IN) { m = start - 20 + (20 * frac) / PH_IN; phase = 'Doors open'; }
    else if (frac < PH_OUT) { m = start + (showLen * (frac - PH_IN)) / (PH_OUT - PH_IN); phase = 'Now showing'; }
    else { m = start + showLen + (st.cleaning * (frac - PH_OUT)) / (1 - PH_OUT); phase = 'Audience leaving, cleaning'; }
    let d = x.d; if (m >= 1440) { m -= 1440; d = (d + 1) % 7; }
    return { i, frac, phase, day: d, time: String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(Math.floor(m % 60)).padStart(2, '0') };
  }
  function drawCinema() {
    const holder = document.getElementById('simCanvas').parentElement;
    const Wp = Math.max(280, holder.clientWidth), narrow = Wp < 620, x = sim.data[0];
    // lay the halls out first (seat size follows the width), then size the canvas to fit them
    if (!sim.layout || sim.layout.W !== Wp) {
      let base, prop, Hn;
      if (narrow) {
        base = layoutPanel(x.base, 0, 0, Wp, 1000);
        const h1 = base.lobbyTop + base.lobbyH + 14;
        prop = layoutPanel(x.prop, 0, h1, Wp, 1000);
        Hn = prop.lobbyTop + prop.lobbyH + 8;
      } else {
        base = layoutPanel(x.base, 0, 0, Wp / 2 - 4, 1000);
        prop = layoutPanel(x.prop, Wp / 2 + 4, 0, Wp / 2 - 4, 1000);
        Hn = Math.max(base.lobbyTop + base.lobbyH, prop.lobbyTop + prop.lobbyH) + 8;
      }
      sim.layout = { W: Wp, H: Hn, narrow, base, prop };
    }
    const c = canvas('simCanvas', sim.layout.H); if (!c) return;
    const { ctx, W, H } = c;
    const ck = clockAt(sim.u);
    ctx.clearRect(0, 0, W, H);
    const nb = drawPanel(ctx, sim.layout.base, 'base', 'Baseline (greedy)', ck.i, ck.frac);
    const np = drawPanel(ctx, sim.layout.prop, 'prop', 'Optimised', ck.i, ck.frac);
    text(ctx, nb + ' seated', sim.layout.base.px + sim.layout.base.pw - 10, sim.layout.base.py + 16, { align: 'right', size: 12, color: C.muted, weight: 700 });
    text(ctx, np + ' seated', sim.layout.prop.px + sim.layout.prop.pw - 10, sim.layout.prop.py + 16, { align: 'right', size: 12, color: C.bad, weight: 700 });
    ctx.strokeStyle = '#333'; ctx.beginPath();
    if (sim.layout.narrow) { const yy = sim.layout.prop.py - 7; ctx.moveTo(8, yy); ctx.lineTo(W - 8, yy); } else { ctx.moveTo(W / 2, 8); ctx.lineTo(W / 2, H - 8); }
    ctx.stroke();
    syncControls(ck);
    drawSimChart(ck);
  }
  function cumAt(ck, key) {
    const x = sim.data[ck.i], prev = key === 'B' ? x.prevB : x.prevP, cur = (key === 'B' ? x.cumB : x.cumP) - prev;
    return prev + cur * clamp(ck.frac / PH_IN, 0, 1);
  }
  function drawSimChart(ck) {
    const c = canvas('simChart', sim.layout && !sim.layout.narrow ? Math.max(240, sim.layout.H) : 300); if (!c) return;
    const { ctx, W, H } = c, data = sim.data, n = data.length;
    const x0 = 46, base = H - 62, top = 30;
    const max = Math.max(data[n - 1].cumP, data[n - 1].cumB);
    const X = (i) => x0 + ((W - 10 - x0) * i) / n, Y = (v) => base - ((base - top) * v) / (max * 1.05);
    ctx.clearRect(0, 0, W, H);
    axes(ctx, x0, base, W - 10, top);
    const step = niceStep(max, 4);
    for (let v = 0; v <= max * 1.05; v += step) { text(ctx, fmt(v), x0 - 5, Y(v) + 4, { align: 'right', size: 10.5 }); ctx.strokeStyle = C.line; ctx.beginPath(); ctx.moveTo(x0 + 1, Y(v)); ctx.lineTo(W - 10, Y(v)); ctx.stroke(); }
    root.Engine.DAY_NAMES.forEach((dn, d) => text(ctx, dn[0], X((d + 0.5) * (n / 7)), base + 14, { align: 'center', size: 10.5 }));
    const u = sim.u;
    [['cumB', 'B', C.grey], ['cumP', 'P', C.red]].forEach(([key, k2, col]) => {
      ctx.strokeStyle = col; ctx.lineWidth = 2;
      ctx.globalAlpha = 0.25; ctx.beginPath(); ctx.moveTo(X(0), Y(0)); data.forEach((x, i) => ctx.lineTo(X(i + 1), Y(x[key]))); ctx.stroke();
      ctx.globalAlpha = 1; ctx.beginPath(); ctx.moveTo(X(0), Y(0));
      for (let i = 0; i < ck.i; i++) ctx.lineTo(X(i + 1), Y(data[i][key]));
      const now = cumAt(ck, k2); ctx.lineTo(X(u), Y(now)); ctx.stroke();
      ctx.fillStyle = col; ctx.beginPath(); ctx.arc(X(u), Y(now), 4, 0, 7); ctx.fill();
    });
    ctx.lineWidth = 1; ctx.strokeStyle = '#fff'; ctx.setLineDash([3, 3]); ctx.beginPath(); ctx.moveTo(X(u), top); ctx.lineTo(X(u), base); ctx.stroke(); ctx.setLineDash([]);
    const b = cumAt(ck, 'B'), p = cumAt(ck, 'P');
    text(ctx, 'Expected tickets so far', x0, 16, { size: 12, color: C.text, weight: 700 });
    text(ctx, 'Baseline ' + fmt(b), x0, H - 30, { size: 12, color: C.muted });
    text(ctx, 'Optimised ' + fmt(p) + ' (' + (Math.round(p) - Math.round(b) >= 0 ? '+' : '') + fmt(Math.round(p) - Math.round(b)) + ')', x0, H - 12, { size: 12.5, color: C.bad, weight: 700 });
  }
  function syncControls(ck) {
    const n = sim.data.length;
    document.getElementById('simSlider').value = String(ck.i + 1);
    const box = document.getElementById('simStep');
    if (document.activeElement !== box) box.value = String(ck.i + 1);
    document.getElementById('simWhen').textContent = root.Engine.DAY_NAMES[ck.day] + ' ' + ck.time + ' · ' + ck.phase + ' · step ' + (ck.i + 1) + ' of ' + n;
    const pb = document.getElementById('simPlay');
    pb.textContent = sim.playing ? 'Pause' : 'Play';
    pb.setAttribute('aria-pressed', String(sim.playing));
  }
  function tick(now) {
    if (!sim.playing) { sim.raf = 0; return; }
    if (!sim.last) sim.last = now;
    sim.u += Math.min(0.1, (now - sim.last) / 1000) / SEC_PER_STEP;
    sim.last = now;
    if (sim.u >= sim.data.length) { sim.u = sim.data.length - 0.0001; sim.playing = false; }
    drawCinema();
    sim.raf = sim.playing ? requestAnimationFrame(tick) : 0;
  }
  function play(on) {
    sim.playing = on;
    sim.last = 0;
    if (on && !sim.raf) sim.raf = requestAnimationFrame(tick);
    drawCinema();
  }
  // jump to show time k (1-based); paused: show it during the film (everyone seated)
  function setStep(k, keepPlaying) {
    if (!sim.data) return;
    const i = clamp(Math.round(k) || 1, 1, sim.data.length) - 1;
    sim.u = i + (keepPlaying && sim.playing ? 0 : 0.5);
    drawCinema();
  }
  function cinema(r) {
    sim.r = r;
    sim.data = cinemaData(r);
    sim.layout = null;
    sim.cache = {};
    const n = sim.data.length;
    document.getElementById('simSlider').max = String(n);
    document.getElementById('simStep').max = String(n);
    sim.u = Math.min(sim.u, n - 0.5);
    drawCinema();
  }
  function bindCinema() {
    const slider = document.getElementById('simSlider'), box = document.getElementById('simStep');
    if (!slider) return;
    slider.addEventListener('input', () => setStep(+slider.value, true));
    box.addEventListener('change', () => setStep(+box.value, true));
    box.addEventListener('keydown', (e) => { if (e.key === 'Enter') setStep(+box.value, true); });
    document.getElementById('simPlay').addEventListener('click', () => { if (!sim.playing && sim.u >= sim.data.length - 0.01) sim.u = 0; play(!sim.playing); });
    document.getElementById('simBack').addEventListener('click', () => { play(false); setStep(Math.floor(sim.u)); });
    document.getElementById('simFwd').addEventListener('click', () => { play(false); setStep(Math.floor(sim.u) + 2); });
    let rt = 0;
    root.addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(() => { if (sim.r) render(sim.r); }, 200); });
  }

  function render(r) {
    const E = root.Engine;
    while (stops.length) stops.pop()();
    [figAggregate, figMLE, figBayes, figPredictive, figCaution, figLP, figDual, cinema].forEach((fn) => {
      try { fn(r, E); } catch (e) { console.error('figure ' + fn.name + ': ' + e.message); }
    });
  }
  let bound = false;
  root.Figures = {
    render: (r) => { if (!bound) { bindCinema(); bound = true; } render(r); },
    // start the week from the first show time and play it (used by "Run plan")
    playWeek: () => { if (!sim.data) return; sim.u = 0; play(true); },
    lpSlice, setStep, sim,
  };
})(typeof self !== 'undefined' ? self : this);
