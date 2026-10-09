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
  assert.equal(a.fingerprint, b.fingerprint);
  const c = E.run({ ...def(), seed: 438 });
  assert.notEqual(a.fingerprint, c.fingerprint);
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
      cells: Array.from({ length: nF * nS * 2 }, () => ({ tested: rng() < 0.7 })),
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

test('caution: untried combinations of known films lose value; new releases do not', () => {
  const r = E.run({ ...def(), newRelease: true });
  const P = r.problem;
  let checked = 0;
  for (let f = 0; f < P.slate.length; f++) for (let s = 0; s < P.nS; s++) for (let d = 0; d < 7; d++) {
    const h = 0;
    if (P.untried(f, s, d)) { assert.ok(P.value(f, h, d, s) < P.expected(f, h, d, s)); checked++; }
    else assert.equal(P.value(f, h, d, s), P.expected(f, h, d, s));
    if (!P.est.hasRows[f]) assert.ok(!P.untried(f, s, d));
  }
  assert.ok(checked > 0);
});

test('backtest: selected estimate beats the film average used by the rule of thumb', () => {
  const r = E.run(def());
  const w = Object.fromEntries(r.backtest.methods.map((m) => [m.id, m.wape]));
  assert.ok(w.blend < w.filmAverage);
});

test('extra rows: wrong venue and unknown titles are set aside with a note; off-grid times fail', () => {
  const ok = E.run({ ...def(), extraRows: 'title_tag,venue_tag,play_day,curtain_time,account_tag,passes_bought\nunknown-film,RIVERSIDE,2026-10-03,19:00,AC-1,2\ncaterpillar-man,HARBOUR,2026-10-03,19:00,AC-1,2' });
  assert.equal(ok.status, 'ok');
  assert.equal(ok.notes.length, 2);
  const bad = E.run({ ...def(), extraRows: 'caterpillar-man,RIVERSIDE,2026-10-03,19:05,AC-1,2' });
  assert.equal(bad.status, 'invalid');
  assert.match(bad.errors[0], /not on the show-time grid/);
  const late = E.run({ ...def(), slots: 6 });
  assert.equal(late.status, 'invalid');
  assert.match(late.errors[0], /after midnight/);
});

test('pins: a pinned film stays, and an impossible pin is reported', () => {
  const r = E.run({ ...def(), pins: { '0|0|0': 'oppenhammer' } });
  assert.equal(r.status, 'ok');
  assert.equal(r.proposed.plan[0][0][0], 5);
  assert.equal(r.baseline.plan[0][0][0], 5);
  const bad = E.run({ ...def(), pins: { '0|0|0': 'oppenhammer', '0|0|1': 'oppenhammer' } });
  assert.equal(bad.status, 'invalid');
});
