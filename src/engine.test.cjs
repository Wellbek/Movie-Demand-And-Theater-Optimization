// Engine tests: node --test src/
const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('./engine.js');

const def = () => E.defaultSettings();

test('every shared test case (normal, boundary, failure) passes', () => {
  for (const tc of E.TEST_CASES) {
    const r = E.run(tc.apply(def()));
    assert.ok(tc.check(r), tc.kind + ' ' + tc.id + ' failed: ' + r.status + ' ' + (r.errors || []).join(' | '));
  }
});

test('same settings give the same result; another seed gives another history', () => {
  const a = E.run(def()), b = E.run(def());
  const key = (r) => JSON.stringify([r.proposed.plan, r.baseline.plan, r.history.rows.length, r.scores.proposed.tickets]);
  assert.equal(key(a), key(b));
  const c = E.run({ ...def(), seed: 438 });
  assert.notEqual(key(a), key(c));
  assert.notEqual(a.history.rows.length, c.history.rows.length);
});

test('records use exactly the six teaching fields with valid values', () => {
  const r = E.run(def());
  for (const row of r.history.rows) {
    assert.deepEqual(Object.keys(row), E.FIELDS);
    assert.match(row.play_day, /^\d{4}-\d{2}-\d{2}$/);
    assert.match(row.curtain_time, /^([01]\d|2[0-3]):[0-5]\d$/);
    assert.ok(Number.isInteger(row.passes_bought) && row.passes_bought >= 1 && row.passes_bought <= 6);
    assert.ok(row.account_tag.startsWith('AC-'));
  }
});

test('history follows the settings: halls, show times, film count and weeks', () => {
  const base = E.run(def());
  const times = new Set(base.history.rows.map((r) => r.curtain_time));
  assert.deepEqual([...times].sort(), ['10:00', '13:00', '16:00', '19:00', '22:00']);
  const moreSlots = E.run({ ...def(), firstStart: '09:30', slots: 6, slotMinutes: 170, limits: { gigantic: { min: 0 }, 'avocado-2': { min: 0 }, oppenhammer: { min: 0 } } });
  // 170-min slots: the three films longer than 155 min cannot play (runtime + 15 min changeover)
  assert.equal(moreSlots.status, 'ok');
  assert.ok(new Set(moreSlots.history.rows.map((r) => r.curtain_time)).has('09:30'));
  const films = E.run({ ...def(), filmCount: 8 });
  assert.equal(new Set(films.history.rows.map((r) => r.title_tag)).size, 8);
  const weeks = E.run({ ...def(), historyWeeks: 2 });
  assert.equal(weeks.history.first, '2026-09-21');
  const seats = E.run({ ...def(), halls: def().halls.map((h, i) => (i === 0 ? { ...h, seats: 300 } : h)) });
  assert.ok(Math.max(...seats.screenings.map((s) => s.tickets)) > 220);
  for (const r of [base, films, weeks, seats]) {
    const maxSeats = Math.max(...r.settings.halls.map((h) => h.seats));
    assert.ok(r.screenings.every((s) => s.tickets <= maxSeats));
  }
});

test('titles are fictional: no real film title appears anywhere in the slate', () => {
  const real = /\b(spider|avatar|frozen|titanic|inside out|oppenheimer|jurassic|top gun|avengers)\b/i;
  for (const f of E.CATALOG.concat([E.NEW_RELEASE])) assert.ok(!real.test(f.title + ' ' + f.tagline + ' ' + f.tag), f.title);
});

test('proposed plan: whole-numbered, rule-abiding, certificate holds, not worse than baseline', () => {
  for (const seed of [1, 2, 3, 437, 999]) {
    const r = E.run({ ...def(), seed });
    assert.equal(r.status, 'ok');
    assert.ok(r.proposed.certificateOk, 'certificate seed ' + seed);
    assert.equal(r.checks.proposed.violations.length, 0);
    assert.ok(r.scores.proposed.value >= r.scores.baseline.value - 1e-6);
  }
});

test('simplex optimum equals brute force on 150 random tiny instances', () => {
  const rng = E.mulberry32(7);
  let compared = 0;
  for (let n = 0; n < 150; n++) {
    const nF = 2 + Math.floor(rng() * 2), nS = 1 + Math.floor(rng() * 2), nH = 1 + Math.floor(rng() * 2);
    const slate = E.CATALOG.slice(0, nF).map((f) => ({ ...f, min: Math.floor(rng() * 2), max: rng() < 0.5 ? null : 1 + Math.floor(rng() * 3) }));
    const st = { ...def(), slots: nS, halls: Array.from({ length: nH }, (_, i) => ({ name: 'H' + i, seats: 20 + Math.floor(rng() * 100), open: true })), caution: rng() };
    // a hand-made estimate: random demand per film x slot x day, some combinations untried
    const dem = Array.from({ length: nF }, () => Array.from({ length: nS }, () => Array.from({ length: 7 }, () => rng() * 150)));
    const est = {
      demand: (f, s, d) => dem[f][s][d],
      cells: Array.from({ length: nF * nS * 2 }, () => { const tested = rng() < 0.7; return { tested, priorShare: tested ? rng() * 0.6 : 1 }; }),
      cellIdx: (f, s, t) => (f * nS + s) * 2 + t,
      hasRows: slate.map(() => true),
      shape: () => 1e4,
    };
    const P = E.buildProblem(st, slate, est);
    // keep brute force small: block Tuesday to Sunday, so only Monday is planned
    const blockRest = Object.fromEntries([1, 2, 3, 4, 5, 6].flatMap((d) => Array.from({ length: nS }, (_, s) => Array.from({ length: nH }, (_, h) => [d + '|' + s + '|' + h, '']))).flat());
    const sol = E.solveProposed({ ...P, st: { ...st, pins: blockRest } });
    const Pb = P;
    const best = (function () {
      const cells = [];
      for (let s = 0; s < nS; s++) for (let h = 0; h < nH; h++) cells.push({ d: 0, s, h });
      let b = -Infinity;
      const plan = Array.from({ length: nS }, () => Array(nH).fill(null));
      const shows = slate.map(() => 0);
      (function rec(i, val) {
        if (i === cells.length) { if (slate.every((f, k) => shows[k] >= f.min && (f.max === null || shows[k] <= f.max))) b = Math.max(b, val); return; }
        const { s, h } = cells[i];
        rec(i + 1, val);
        for (let f = 0; f < nF; f++) {
          if (!Pb.fits[f] || plan[s].includes(f)) continue;
          plan[s][h] = f; shows[f]++;
          rec(i + 1, val + Pb.value(f, h, 0, s));
          plan[s][h] = null; shows[f]--;
        }
      })(0, 0);
      return b;
    })();
    if (best === -Infinity) { assert.notEqual(sol.status, 'optimal', 'solver found a plan where none exists'); continue; }
    assert.equal(sol.status, 'optimal');
    let got = 0;
    for (let s = 0; s < nS; s++) for (let h = 0; h < nH; h++) { const f = sol.plan[0][s][h]; if (f !== null) got += P.value(f, h, 0, s); }
    assert.ok(Math.abs(got - best) < 1e-3, 'instance ' + n + ': simplex ' + got + ' vs brute force ' + best);
    compared++;
  }
  assert.ok(compared > 100);
});

test('sold-out screenings are detected from totals equal to a hall size and corrected upwards', () => {
  const r = E.run(def());
  const so = r.screenings.filter((s) => s.soldOut);
  assert.ok(so.length > 0);
  assert.ok(so.every((s) => r.settings.halls.some((h) => h.seats === s.tickets)));
  // a cell whose screenings all sold out is estimated at or above the seats
  const cell = r.estimate.cells.find((c) => c.n > 0 && c.soldOut === c.n);
  if (cell) assert.ok(cell.estimate >= Math.min(...r.screenings.filter((s) => s.f === cell.f && s.s === cell.s && s.t === cell.t).map((s) => s.tickets)) - 1e-9);
});

test('caution: only the pattern part of an estimate is discounted; only a new release is exempt', () => {
  const r = E.run({ ...def(), newRelease: true });
  const P = r.problem;
  let checked = 0;
  for (let f = 0; f < P.slate.length; f++) for (let s = 0; s < P.nS; s++) for (let d = 0; d < 7; d++) {
    const c = P.est.cellOf(f, s, d);
    const want = P.isNew(f) ? 1 : 1 - r.settings.caution * c.priorShare;
    assert.ok(Math.abs(P.factor(f, s, d) - want) < 1e-12);
    assert.ok(P.value(f, 0, d, s) <= P.expected(f, 0, d, s) + 1e-9);
    if (!c.tested) { assert.equal(c.priorShare, 1); checked++; }
    if (P.isNew(f)) assert.equal(P.value(f, 0, d, s), P.expected(f, 0, d, s));
  }
  assert.ok(checked > 0);
  // more own screenings -> smaller discount
  const tried = P.est.cells.filter((c) => c.n > 0).sort((a, b) => a.sumW - b.sumW);
  assert.ok(tried[0].priorShare > tried[tried.length - 1].priorShare);
});

test('dispersion: the negative-binomial shape estimated from the records is near the generator value', () => {
  for (const nbShape of [3, 6, 20]) {
    const r = E.run({ ...def(), nbShape }, { skipOracle: true });
    const rr = r.estimate.dispersion;
    assert.ok(rr >= nbShape / 2 && rr <= nbShape * 2.5, 'shape ' + nbShape + ' estimated as ' + rr);
  }
});

test('backtest: selected estimate beats the film average used by the rule of thumb', () => {
  const r = E.run(def());
  const w = Object.fromEntries(r.backtest.methods.map((m) => [m.id, m.wape]));
  assert.ok(w.blend < w.filmAverage);
});

test('extra rows: wrong venue and unknown titles are set aside with a note; off-grid times fail', () => {
  const ok = E.run({ ...def(), extraRows: 'title_tag,venue_tag,play_day,curtain_time,account_tag,passes_bought\nunknown-film,VENUE-01,2026-10-03,19:00,AC-1,2\ncaterpillar-man,VENUE-02,2026-10-03,19:00,AC-1,2' });
  assert.equal(ok.status, 'ok');
  assert.equal(ok.notes.length, 2);
  const bad = E.run({ ...def(), extraRows: 'caterpillar-man,VENUE-01,2026-10-03,19:05,AC-1,2' });
  assert.equal(bad.status, 'invalid');
  assert.match(bad.errors[0], /not on the show-time grid/);
  const late = E.run({ ...def(), slots: 6 });
  assert.equal(late.status, 'invalid');
  assert.match(late.errors[0], /on the next day/);
});

test('pins: a pinned film stays, and an impossible pin is reported', () => {
  const r = E.run({ ...def(), pins: { '0|0|0': 'oppenhammer' } });
  assert.equal(r.status, 'ok');
  assert.equal(r.proposed.plan[0][0][0], 5);
  assert.equal(r.baseline.plan[0][0][0], 5);
  const bad = E.run({ ...def(), pins: { '0|0|0': 'oppenhammer', '0|0|1': 'oppenhammer' } });
  assert.equal(bad.status, 'invalid');
});

test('baseline never breaks a rule across seeds, slate sizes and a new release', () => {
  for (const seed of [1, 7, 21, 437]) for (const filmCount of [4, 6, 8]) for (const newRelease of [false, true]) {
    const r = E.run({ ...def(), seed, filmCount, newRelease }, { skipOracle: true });
    assert.equal(r.status, 'ok');
    assert.deepEqual(r.checks.baseline.violations, [], 'seed ' + seed + ' films ' + filmCount + ' new ' + newRelease);
  }
});

test('brute-force check exported for the demo agrees on every comparable instance', () => {
  const r = E.bruteForceCheck(60, 11);
  assert.ok(r.compared > 30);
  assert.equal(r.agree, r.compared);
});

test('rule costs come from re-solving, and the repeat-last-week reference keeps every rule', () => {
  const r = E.run(def());
  assert.ok(r.ruleCosts.length > 0);
  for (const c of r.ruleCosts) assert.ok(c.upValue >= -1e-6 && (c.downValue === null || c.downValue >= -1e-6));
  for (const seed of [1, 5, 437]) for (const newRelease of [false, true]) {
    const rr = E.run({ ...def(), seed, newRelease }, { skipOracle: true });
    assert.deepEqual(E.checkPlan(rr.problem, E.repeatLastWeekPlan(rr.problem, rr.screenings)).violations, []);
  }
});

test('a film that was available but never scheduled is cautioned like an untried combination', () => {
  // one hall and no judgement noise: the past schedule only ever showed the best film per show-time
  const st = { ...def(), halls: [{ name: 'Hall 1', seats: 210, open: true }], historyWeeks: 1, pastNoise: 0, limits: Object.fromEntries(E.CATALOG.map((f) => [f.tag, { min: 0 }])) };
  const r = E.run(st, { skipOracle: true });
  assert.equal(r.status, 'ok');
  const P = r.problem;
  const unseen = P.slate.map((f, i) => i).filter((i) => !P.est.hasRows[i]);
  assert.ok(unseen.length > 0, 'setting should leave a film without records');
  for (const f of unseen) {
    assert.equal(P.isNew(f), false);
    assert.ok(P.untried(f, 0, 0));
    assert.ok(Math.abs(P.factor(f, 0, 0) - (1 - st.caution)) < 1e-12);
  }
});

test('robustness sweep: 80 random configurations against the rule of thumb', () => {
  const rows = E.sweep(80, 2026, false);
  const ok = rows.filter((x) => x.status === 'ok');
  assert.equal(ok.length, rows.length, 'every generated configuration is feasible');
  const n = (f) => ok.filter(f).length;
  // guaranteed by LP optimality: the baseline is a feasible week, so it cannot score higher on the planning value
  assert.equal(n((x) => x.value[1] >= x.value[0] - 1e-6), ok.length);
  assert.equal(n((x) => x.violations === 0), ok.length);
  // not guaranteed (the optimiser maximises the cautious value, and true demand is unknown): measured
  assert.ok(n((x) => x.tickets[1] >= x.tickets[0] - 1e-6) >= 0.95 * ok.length);
  assert.ok(n((x) => x.truth[1] >= x.truth[0] - 1e-6) >= 0.9 * ok.length);
  const meanGain = ok.reduce((a, x) => a + (x.truth[1] - x.truth[0]) / x.truth[0], 0) / ok.length;
  assert.ok(meanGain > 0.05, 'mean true gain ' + meanGain);
});
