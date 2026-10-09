// Numbers quoted in proposal.html (and, via numbers.json, in problem-definition.md),
// computed from the engine with the demo's default settings and from the mock study.
module.exports = function numbers(E, study) {
  const fmt = (x) => Math.round(x).toLocaleString('en-US');
  const sgn = (x) => { const v = Math.round(x); return v === 0 ? '0' : (v > 0 ? '+' : '-') + fmt(Math.abs(v)); };
  const pct = (x) => (x >= 0 ? '+' : '') + (x * 100).toFixed(1) + '%';
  const st = E.defaultSettings();
  const r = E.run(st);
  if (r.status !== 'ok') throw new Error('default run failed: ' + r.errors.join(' | '));
  const b = r.scores.baseline, p = r.scores.proposed;
  const S = study.results.sensible, R = study.results.random;
  const cases = E.TEST_CASES.map((tc) => tc.check(E.run(tc.apply(E.defaultSettings()))));
  const prices = Object.fromEntries(r.proposed.prices.min.map((x) => [x.tag, x.price]));
  const perDay = (sc) => E.DAY_NAMES.map((n, d) => sc.perSlot.filter((x) => x.d === d).reduce((a, x) => a + x.tickets, 0));
  const N = {
    seed: String(st.seed),
    fingerprint: r.fingerprint,
    rows: fmt(r.rowCount),
    screenings: fmt(r.screenings.length),
    soldOutRead: fmt(r.diagnostics.detected),
    soldOutPct: Math.round((100 * r.diagnostics.detected) / r.screenings.length) + '%',
    cellsTested: String(r.diagnostics.cellsTested),
    cellsTotal: String(r.diagnostics.cellsTotal),
    accounts: fmt(r.diagnostics.accounts),
    historyFirst: r.history.first,
    historyLast: r.history.last,
    baseTickets: fmt(b.tickets),
    propTickets: fmt(p.tickets),
    gainTickets: sgn(p.tickets - b.tickets),
    gainPct: pct((p.tickets - b.tickets) / b.tickets),
    baseUntried: String(b.untested),
    propUntried: String(p.untested),
    baseAway: fmt(b.away),
    propAway: fmt(p.away),
    baseEmpty: fmt(b.empty),
    propEmpty: fmt(p.empty),
    baseValue: fmt(b.value),
    propValue: fmt(p.value),
    lpVars: String(r.proposed.lp.vars),
    lpRows: String(r.proposed.lp.rows),
    lpPivots: String(r.proposed.lp.pivots),
    objective: (Math.round(r.proposed.lp.objective * 10) / 10).toLocaleString('en-US'),
    dualBound: (Math.round(r.proposed.lp.dualBound * 10) / 10).toLocaleString('en-US'),
    priceOpp: prices.oppenhammer ? prices.oppenhammer.toFixed(1) : '0',
    priceGig: prices.gigantic ? prices.gigantic.toFixed(1) : '0',
    truthBase: fmt(b.truth),
    truthProp: fmt(p.truth),
    truthGain: sgn(p.truth - b.truth),
    truthPct: pct((p.truth - b.truth) / b.truth),
    oracle: fmt(r.oracle.truth),
    oraclePct: ((100 * p.truth) / r.oracle.truth).toFixed(1) + '%',
    casesPass: String(cases.filter(Boolean).length),
    casesTotal: String(cases.length),
    wapeBlend: (S['backtest WAPE blend'].mean * 100).toFixed(1) + '%',
    wapePattern: (S['backtest WAPE pattern'].mean * 100).toFixed(1) + '%',
    wapeCell: (S['backtest WAPE cellAverage'].mean * 100).toFixed(1) + '%',
    wapeFilm: (S['backtest WAPE filmAverage'].mean * 100).toFixed(1) + '%',
    stSel: fmt(S['selected (blend, k=1, caution 0.5)'].mean),
    stBase: fmt(S['rule of thumb (baseline)'].mean),
    stOracle: fmt(S['oracle (knows true demand)'].mean),
    stSelPctOracle: ((100 * S['selected (blend, k=1, caution 0.5)'].mean) / S['oracle (knows true demand)'].mean).toFixed(1) + '%',
    stGainBase: sgn(-S['rule of thumb (baseline)'].diff),
    stGainBaseCi: fmt(S['rule of thumb (baseline)'].ci95),
    stGainBasePct: pct(-S['rule of thumb (baseline)'].diff / S['rule of thumb (baseline)'].mean),
    stFilmAvg: sgn(S['film average'].diff), stFilmAvgCi: fmt(S['film average'].ci95),
    stCellAvg: sgn(S['own cell average'].diff), stCellAvgCi: fmt(S['own cell average'].ci95),
    stPattern: sgn(S['pattern only'].diff), stPatternCi: fmt(S['pattern only'].ci95),
    stNoCaution: sgn(S['blend, caution 0'].diff), stNoCautionCi: fmt(S['blend, caution 0'].ci95),
    stCaution03: sgn(S['blend, caution 0.3'].diff), stCaution03Ci: fmt(S['blend, caution 0.3'].ci95),
    stK2: sgn(S['blend, k=2'].diff), stK2Ci: fmt(S['blend, k=2'].ci95),
    stK4: sgn(S['blend, k=4'].diff), stK4Ci: fmt(S['blend, k=4'].ci95),
    stK0: sgn(S['blend, k=0'].diff), stK0Ci: fmt(S['blend, k=0'].ci95),
    rnNoCaution: sgn(R['blend, caution 0'].diff), rnNoCautionCi: fmt(R['blend, caution 0'].ci95),
    rnSel: fmt(R['selected (blend, k=1, caution 0.5)'].mean),
    rnBase: fmt(R['rule of thumb (baseline)'].mean),
    rnOracle: fmt(R['oracle (knows true demand)'].mean),
    studySeeds: String(study.seeds),
  };
  N.seatRows = seatRows();
  N.satGrid = satGrid(5);
  Object.assign(N, workedExample());
  N.chartDay = dayChart(E.DAY_NAMES, perDay(b), perDay(p));
  N.chartStudy = studyChart([
    ['Rule of thumb', S['rule of thumb (baseline)'].mean, '#808080'],
    ['Film average + LP', S['film average'].mean, '#5a5a5a'],
    ['Pattern only + LP', S['pattern only'].mean, '#5a5a5a'],
    ['No caution + LP', S['blend, caution 0'].mean, '#5a5a5a'],
    ['Own average + LP', S['own cell average'].mean, '#5a5a5a'],
    ['Selected', S['selected (blend, k=1, caution 0.5)'].mean, '#e50914'],
    ['Oracle', S['oracle (knows true demand)'].mean, '#46d369'],
  ]);
  return N;

  // Saturday of the plan week, rule of thumb vs SLOTWISE, as two small coloured grids
  function satGrid(d) {
    const P = r.problem;
    const grid = (plan, label, total) => {
      let h = '<div><div class="sg-h">' + label + ' <span>' + fmt(total) + ' exp. tickets on Saturday</span></div><table class="sg"><thead><tr><th></th>' + P.halls.map((x) => '<th>' + x.name + ' (' + x.seats + ')</th>').join('') + '</tr></thead><tbody>';
      P.times.forEach((t, s) => {
        h += '<tr><th>' + E.toHHMM(t % 1440) + '</th>' + P.halls.map((x, hi) => {
          const f = plan[d][s][hi];
          if (f === null) return '<td class="e">empty</td>';
          const film = P.slate[f];
          return '<td style="background:hsl(' + film.hue + ',55%,34%)">' + film.title.split(/[ :]/)[0] + (P.untried(f, s, d) ? ' <b class="amber">?</b>' : '') + '<span>' + fmt(P.expected(f, hi, d, s)) + '</span></td>';
        }).join('') + '</tr>';
      });
      return h + '</tbody></table></div>';
    };
    const tot = (plan) => { let x = 0; P.times.forEach((t, s) => P.halls.forEach((h, hi) => { const f = plan[d][s][hi]; if (f !== null) x += P.expected(f, hi, d, s); })); return x; };
    return '<div class="sgwrap">' + grid(r.baseline.plan, 'Rule of thumb', tot(r.baseline.plan)) + grid(r.proposed.plan, 'SLOTWISE', tot(r.proposed.plan)) + '</div>';
  }
  // one demand cell, end to end, for the calculation slide
  function workedExample() {
    const est = r.estimate;
    const c = est.cells.filter((x) => x.n >= 2 && x.n <= 4).sort((a, b) => Math.abs(b.own - b.pattern) / b.pattern - Math.abs(a.own - a.pattern) / a.pattern)[0];
    const film = r.slate[c.f];
    const one = (x) => (Math.round(x * 10) / 10).toFixed(1);
    return {
      exFilm: film.title, exTime: E.toHHMM(r.problem.times[c.s] % 1440), exType: E.DAY_TYPE_NAMES[c.t],
      exPattern: one(c.pattern), exOwn: one(c.own), exN: String(c.n), exW: one(c.sumW), exK: String(est.credibility),
      exPost: one(c.estimate), exWeight: Math.round(c.weight * 100) + '%', exSold: String(c.soldOut),
    };
  }
  function seatRows() {
    let out = '';
    for (let r = 0; r < 6; r++) {
      const y = 520 + r * 62, w = 36 + r * 5, gap = 10 + r * 2, n = 18 + r * 2;
      const x0 = 1000 - (n * (w + gap)) / 2;
      for (let i = 0; i < n; i++) out += '<rect x="' + (x0 + i * (w + gap)).toFixed(0) + '" y="' + y + '" width="' + w + '" height="' + (24 + r * 3) + '" rx="6" fill="' + ((i * 7 + r * 3) % 5 === 0 ? '#7a0a10' : '#2a0b0d') + '" opacity="' + (0.55 + r * 0.07).toFixed(2) + '"/>';
    }
    return out;
  }
  function dayChart(labels, a, c) {
    const W = 620, H = 230, L = 46, B = 30, T = 10;
    const max = Math.max(...a, ...c) * 1.12;
    const gw = (W - L - 8) / labels.length, bw = 22;
    const y = (v) => T + (H - T - B) * (1 - v / max);
    let s = '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Expected tickets per day, rule of thumb vs SLOTWISE">';
    for (let g = 0; g <= 4; g++) { const v = (max / 1.12) * g / 4; s += '<line x1="' + L + '" x2="' + (W - 8) + '" y1="' + y(v).toFixed(1) + '" y2="' + y(v).toFixed(1) + '" stroke="#2a2a2a"/><text x="' + (L - 6) + '" y="' + (y(v) + 4).toFixed(1) + '" text-anchor="end">' + fmt(v) + '</text>'; }
    labels.forEach((lab, i) => {
      const x0 = L + i * gw + (gw - 2 * bw) / 2;
      s += '<rect x="' + x0.toFixed(1) + '" y="' + y(a[i]).toFixed(1) + '" width="' + (bw - 2) + '" height="' + (H - B - y(a[i])).toFixed(1) + '" fill="#808080" rx="2"/>';
      s += '<rect x="' + (x0 + bw).toFixed(1) + '" y="' + y(c[i]).toFixed(1) + '" width="' + (bw - 2) + '" height="' + (H - B - y(c[i])).toFixed(1) + '" fill="#e50914" rx="2"/>';
      s += '<text x="' + (L + i * gw + gw / 2).toFixed(1) + '" y="' + (H - B + 16) + '" text-anchor="middle">' + lab + '</text>';
    });
    return s + '</svg>';
  }
  function studyChart(rows) {
    const W = 620, rowH = 28, L = 150, H = rows.length * rowH + 10;
    const max = Math.max(...rows.map((r) => r[1])) * 1.08;
    let s = '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Mock study: true expected tickets per week by method">';
    rows.forEach(([lab, v, col], i) => {
      const y = 5 + i * rowH, w = ((W - L - 70) * v) / max;
      s += '<text x="' + (L - 8) + '" y="' + (y + 17) + '" text-anchor="end">' + lab + '</text><rect x="' + L + '" y="' + (y + 4) + '" width="' + w.toFixed(1) + '" height="' + (rowH - 10) + '" rx="2" fill="' + col + '"/><text x="' + (L + w + 6).toFixed(1) + '" y="' + (y + 17) + '">' + fmt(v) + '</text>';
    });
    return s + '</svg>';
  }
};
