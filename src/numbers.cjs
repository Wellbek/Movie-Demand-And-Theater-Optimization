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
  const S = study.results.sensible, R = study.results.random, Q = study.results.sparse, NR = study.results.newrel;
  const cases = E.TEST_CASES.map((tc) => tc.check(E.run(tc.apply(E.defaultSettings()))));
  const prices = Object.fromEntries(r.proposed.prices.min.map((x) => [x.tag, x.price]));
  const perDay = (sc) => E.DAY_NAMES.map((n, d) => sc.perSlot.filter((x) => x.d === d).reduce((a, x) => a + x.tickets, 0));
  // differences are taken between the rounded figures that are shown, so displayed numbers add up
  const R0 = (x) => Math.round(x);
  const dR = (a, c) => R0(a) - R0(c);
  const pctR = (a, c) => pct(dR(a, c) / R0(c));
  const st1 = (k, W) => { const x = (W || S)[k]; return { d: sgn(x.diff), ci: fmt(x.ci95) }; };
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
    dispersion: String(r.estimate.dispersion),
    baseTickets: fmt(b.tickets),
    propTickets: fmt(p.tickets),
    gainTickets: sgn(dR(p.tickets, b.tickets)),
    gainPct: pctR(p.tickets, b.tickets),
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
    objective: (Math.round(r.proposed.lp.objective * 10) / 10).toLocaleString('en-US', { minimumFractionDigits: 1 }),
    dualBound: (Math.round(r.proposed.lp.dualBound * 10) / 10).toLocaleString('en-US', { minimumFractionDigits: 1 }),
    priceOpp: prices.oppenhammer ? prices.oppenhammer.toFixed(1) : '0',
    priceGig: prices.gigantic ? prices.gigantic.toFixed(1) : '0',
    truthBase: fmt(b.truth),
    truthProp: fmt(p.truth),
    truthGain: sgn(dR(p.truth, b.truth)),
    truthPct: pctR(p.truth, b.truth),
    oracle: fmt(r.oracle.truth),
    oraclePct: ((100 * R0(p.truth)) / R0(r.oracle.truth)).toFixed(1) + '%',
    casesPass: String(cases.filter(Boolean).length),
    casesTotal: String(cases.length),
    wapeBlend: (S['backtest WAPE blend'].mean * 100).toFixed(1) + '%',
    wapePattern: (S['backtest WAPE pattern'].mean * 100).toFixed(1) + '%',
    wapeCell: (S['backtest WAPE cellAverage'].mean * 100).toFixed(1) + '%',
    wapeFilm: (S['backtest WAPE filmAverage'].mean * 100).toFixed(1) + '%',
    stSel: fmt(S.selected.mean),
    stBase: fmt(S['rule of thumb (baseline)'].mean),
    stProg: fmt(S['simulated past programmer'].mean),
    stOracle: fmt(S['oracle (knows true demand)'].mean),
    stSelPctOracle: ((100 * R0(S.selected.mean)) / R0(S['oracle (knows true demand)'].mean)).toFixed(1) + '%',
    stGainBase: sgn(-S['rule of thumb (baseline)'].diff), stGainBaseCi: fmt(S['rule of thumb (baseline)'].ci95),
    stGainProg: sgn(-S['simulated past programmer'].diff), stGainProgCi: fmt(S['simulated past programmer'].ci95),
    studySeeds: String(study.seeds),
    rnSel: fmt(R.selected.mean), rnBase: fmt(R['rule of thumb (baseline)'].mean), rnOracle: fmt(R['oracle (knows true demand)'].mean),
    spSel: fmt(Q.selected.mean), spBase: fmt(Q['rule of thumb (baseline)'].mean), spOracle: fmt(Q['oracle (knows true demand)'].mean),
    spCovered: Math.round(100 * Q['tested combinations share'].mean) + '%',
  };
  const add = (prefix, key, W) => { const x = st1(key, W); N[prefix] = x.d; N[prefix + 'Ci'] = x.ci; };
  add('stFilmAvg', 'film average'); add('stCellAvg', 'own cell average'); add('stPattern', 'pattern only');
  add('stNoCaution', 'caution 0'); add('stCaution025', 'caution 0.25'); add('stCaution075', 'caution 0.75'); add('stCaution1', 'caution 1');
  add('stK1', 'k 1'); add('stK2', 'k 2'); add('stK8', 'k 8'); add('stSoldOutFix', 'with sold-out correction');
  add('rnNoCaution', 'caution 0', R); add('rnCaution1', 'caution 1', R); add('rnSoldOutFix', 'with sold-out correction', R); add('rnCellAvg', 'own cell average', R);
  add('nrNoCaution', 'caution 0', NR); add('nrCautionNew', 'caution on new release', NR); add('nrK1', 'k 1', NR); add('stRepeat', 'repeat last week'); add('nrRepeat', 'repeat last week', NR); add('rnSoldOutFix2', 'with sold-out correction', R);
  N.nrSel = fmt(NR.selected.mean); N.nrOracle = fmt(NR['oracle (knows true demand)'].mean); N.nrPctOracle = ((100 * R0(NR.selected.mean)) / R0(NR['oracle (knows true demand)'].mean)).toFixed(1) + '%';
  N.nrCautionNewAbs = fmt(Math.abs(NR['caution on new release'].diff)); N.stRepeatAbs = fmt(Math.abs(S['repeat last week'].diff)); N.stProgAbs = fmt(Math.abs(S['simulated past programmer'].diff));
  N.seedFrom = String(study.seedFrom); N.seedTo = String(study.seedFrom + study.seeds - 1);
  { const rl = E.repeatLastWeekPlan(r.problem, r.screenings); const sc = E.scorePlan(r.problem, rl); N.repeatPromised = fmt(sc.tickets); N.repeatGainPct = pctR(p.tickets, sc.tickets); N.repeatGain = sgn(dR(p.tickets, sc.tickets)); }
  N.repeatTruth = fmt(E.scorePlan(r.problem, E.repeatLastWeekPlan(r.problem, r.screenings), E.truthFnFor(r.problem)).truth);
  const rc = Object.fromEntries(r.ruleCosts.map((c) => [c.tag, c]));
  const one = (x) => (x === null || x === undefined ? 'n/a' : (Math.round(x * 10) / 10).toFixed(1));
  N.oppUp = one(rc.oppenhammer && rc.oppenhammer.upTickets); N.oppDown = one(rc.oppenhammer && rc.oppenhammer.downTickets);
  N.gigUp = one(rc.gigantic && rc.gigantic.upTickets); N.gigDown = one(rc.gigantic && rc.gigantic.downTickets);
  add('spNoCaution', 'caution 0', Q); add('spCaution1', 'caution 1', Q); add('spCaution075', 'caution 0.75', Q); add('spSoldOutFix', 'with sold-out correction', Q); add('spCellAvg', 'own cell average', Q);
  N.stNoCautionAbs = fmt(Math.abs(S['caution 0'].diff));
  N.nrNoCautionAbs = fmt(Math.abs(NR['caution 0'].diff)); N.spCaution1Abs = fmt(Math.abs(Q['caution 1'].diff));
  // where the rule of thumb's optimism comes from (mock): its untried screenings, estimated vs true
  (function untriedSplit() {
    const P = r.problem, T = E.truthFnFor(P);
    let est = 0, tru = 0;
    for (let d = 0; d < 7; d++) for (let s = 0; s < P.nS; s++) r.baseline.plan[d][s].forEach((f, h) => { if (f !== null && P.untried(f, s, d)) { est += P.expected(f, h, d, s); tru += T(f, h, d, s); } });
    N.baseUntriedEst = fmt(est);
    N.baseUntriedTrue = fmt(tru);
  })();
  // simulated past programmer on the default week (mock)
  N.progTruth = fmt(E.scorePlan(r.problem, E.pastProgrammerPlan(r.problem), E.truthFnFor(r.problem)).truth);
  N.seatRows = seatRows();
  // exhibit day: the day where the two plans differ most (weekend days differ by a few percent)
  const pb = perDay(b), pp = perDay(p);
  let ex = 0;
  pb.forEach((v, d) => { if (pp[d] / v > pp[ex] / pb[ex]) ex = d; });
  N.exDayName = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'][ex] + ' ' + E.addDays(E.PLAN_START, ex).slice(8).replace(/^0/, '') + ' Oct';
  N.exDayBase = fmt(pb[ex]); N.exDayProp = fmt(pp[ex]); N.exDayPct = pctR(pp[ex], pb[ex]);
  const wk = [4, 5, 6].map((d) => pctR(pp[d], pb[d]));
  N.weekendPcts = wk.join(', ');
  N.satGrid = satGrid(ex);
  Object.assign(N, workedExample());
  N.chartDay = dayChart(E.DAY_NAMES, perDay(b), perDay(p));
  N.chartStudy = studyChart([
    ['Rule of thumb', S['rule of thumb (baseline)'].mean, '#808080'],
    ['Film average + LP', S['film average'].mean, '#5a5a5a'],
    ['No caution + LP', S['caution 0'].mean, '#5a5a5a'],
    ['Simulated programmer', S['simulated past programmer'].mean, '#5a5a5a'],
    ['Repeat last week', S['repeat last week'].mean, '#5a5a5a'],
    ['Own average + LP', S['own cell average'].mean, '#5a5a5a'],
    ['Pattern only + LP', S['pattern only'].mean, '#5a5a5a'],
    ['Selected', S.selected.mean, '#e50914'],
    ['Oracle', S['oracle (knows true demand)'].mean, '#46d369'],
  ]);
  return N;

  // Saturday of the plan week, rule of thumb vs SLOTWISE, as two small coloured grids
  function satGrid(d) {
    const P = r.problem;
    const grid = (plan, label, total) => {
      let h = '<div><div class="sg-h">' + label + ' <span>' + fmt(total) + ' expected tickets that day</span></div><table class="sg"><thead><tr><th></th>' + P.halls.map((x) => '<th>' + x.name + ' (' + x.seats + ')</th>').join('') + '</tr></thead><tbody>';
      P.times.forEach((t, s) => {
        h += '<tr><th>' + E.toHHMM(t % 1440) + '</th>' + P.halls.map((x, hi) => {
          const f = plan[d][s][hi];
          if (f === null) return '<td class="e">empty</td>';
          const film = P.slate[f];
          return '<td style="background:hsl(' + film.hue + ',55%,34%)">' + film.title + (P.untried(f, s, d) ? ' <b class="amber">?</b>' : '') + '<span>' + fmt(P.expected(f, hi, d, s)) + '</span></td>';
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
    const c = E.workedCell(est);
    const film = r.slate[c.f];
    const two = (x) => (Math.round(x * 100) / 100).toFixed(2);
    // the posterior mean is recomputed from the two-decimal figures shown, so it can be checked by hand
    const P2 = +two(c.pattern), W2 = +two(c.sumW), Y = c.sumY, k = est.credibility;
    return {
      exFilm: film.title, exTime: E.toHHMM(r.problem.times[c.s] % 1440), exType: E.DAY_TYPE_NAMES[c.t],
      exPattern: two(P2), exSumY: String(Math.round(Y)), exN: String(c.n), exW: two(W2), exK: String(k),
      exOwn: two(Y / W2), exAlpha: two(k * P2 + Y), exBeta: two(k + W2), exPost: two((k * P2 + Y) / (k + W2)),
      exWeight: Math.round((100 * W2) / (k + W2)) + '%',
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
    const top = Math.max(...a, ...c);
    const raw = top / 4, mag = Math.pow(10, Math.floor(Math.log10(raw))), step = [1, 2, 5, 10].map((m) => m * mag).find((x) => x >= raw);
    const max = Math.ceil((top * 1.05) / step) * step;
    const gw = (W - L - 8) / labels.length, bw = 22;
    const y = (v) => T + (H - T - B) * (1 - v / max);
    let s = '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Expected tickets per day, rule of thumb vs SLOTWISE">';
    for (let v = 0; v <= max + 1e-9; v += step) { s += '<line x1="' + L + '" x2="' + (W - 8) + '" y1="' + y(v).toFixed(1) + '" y2="' + y(v).toFixed(1) + '" stroke="#2a2a2a"/><text x="' + (L - 6) + '" y="' + (y(v) + 4).toFixed(1) + '" text-anchor="end">' + fmt(v) + '</text>'; }
    labels.forEach((lab, i) => {
      const x0 = L + i * gw + (gw - 2 * bw) / 2;
      s += '<rect x="' + x0.toFixed(1) + '" y="' + y(a[i]).toFixed(1) + '" width="' + (bw - 2) + '" height="' + (H - B - y(a[i])).toFixed(1) + '" fill="#808080" rx="2"/>';
      s += '<rect x="' + (x0 + bw).toFixed(1) + '" y="' + y(c[i]).toFixed(1) + '" width="' + (bw - 2) + '" height="' + (H - B - y(c[i])).toFixed(1) + '" fill="#e50914" rx="2"/>';
      s += '<text x="' + (L + i * gw + gw / 2).toFixed(1) + '" y="' + (H - B + 16) + '" text-anchor="middle">' + lab + '</text>';
    });
    return s + '</svg>';
  }
  function studyChart(rows) {
    // ascending, with the selected method and the oracle last
    const tail = rows.filter((x) => x[0] === 'Selected' || x[0] === 'Oracle');
    rows = rows.filter((x) => !tail.includes(x)).sort((a, b) => a[1] - b[1]).concat(tail);
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
