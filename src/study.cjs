// Mock study (repository tool, not part of the submission): re-runs the pipeline on many
// fictional histories and scores every plan against the generator's hidden demand.
// It is how the estimate and the defaults (caution 0.5, pattern weight k = 1) were chosen.
// Two fictional worlds differ only in how the past schedule was chosen:
//   sensible: the past programmer knew roughly what sells (default generator, noise 0.5)
//   random:   the past schedule was close to random (noise 3)
// Usage: node src/study.cjs [seeds=40]   -> prints a table and writes src/study.json
const fs = require('node:fs');
const path = require('node:path');
const E = require('./engine.js');

const nSeeds = +(process.argv[2] || 40);
const seeds = Array.from({ length: nSeeds }, (_, i) => i + 1);
const worlds = [{ id: 'sensible', pastNoise: 0.5 }, { id: 'random', pastNoise: 3 }];

const variants = [
  { key: 'selected (blend, k=1, caution 0.5)', est: 'blend' },
  { key: 'film average', est: 'filmAverage', caution: 0 },
  { key: 'own cell average', est: 'cellAverage', caution: 0 },
  { key: 'pattern only', est: 'pattern', caution: 0 },
  { key: 'blend, caution 0', est: 'blend', caution: 0 },
  { key: 'blend, caution 0.3', est: 'blend', caution: 0.3 },
  { key: 'blend, caution 1 (exclude)', est: 'blend', caution: 1 },
  { key: 'blend, k=0', est: 'blend', credibility: 0 },
  { key: 'blend, k=2', est: 'blend', credibility: 2 },
  { key: 'blend, k=4', est: 'blend', credibility: 4 },
];

const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;
const sd = (a) => { const m = mean(a); return Math.sqrt(a.reduce((x, y) => x + (y - m) ** 2, 0) / Math.max(1, a.length - 1)); };
const results = {};
const t0 = Date.now();
for (const w of worlds) {
  const acc = {};
  const add = (k, v) => { (acc[k] = acc[k] || []).push(v); };
  for (const seed of seeds) {
    const st = { ...E.defaultSettings(), seed, pastNoise: w.pastNoise };
    const base = E.run(st);
    if (base.status !== 'ok') { console.log(w.id, 'seed', seed, base.status, base.errors); continue; }
    add('rule of thumb (baseline)', base.scores.baseline.truth);
    add('oracle (knows true demand)', base.oracle.truth);
    base.backtest.methods.forEach((m) => add('backtest WAPE ' + m.id, m.wape));
    add('sold-out share', base.diagnostics.soldOutTrue / base.diagnostics.screenings);
    add('tested combinations share', base.diagnostics.cellsTested / base.diagnostics.cellsTotal);
    for (const v of variants) {
      const st2 = { ...st };
      if (v.caution !== undefined) st2.caution = v.caution;
      if (v.credibility !== undefined) st2.credibility = v.credibility;
      const est = E.estimateAlternative(v.est, base.screenings, base.slate, st2);
      const P = E.buildProblem(st2, base.slate, est);
      const sol = E.solveProposed(P);
      if (sol.status === 'optimal') add(v.key, E.scorePlan(P, sol.plan, E.truthFnFor(P)).truth);
    }
  }
  const ref = acc[variants[0].key];
  results[w.id] = {};
  console.log('\nworld: ' + w.id + ' (' + seeds.length + ' fictional histories)');
  for (const [k, a] of Object.entries(acc)) {
    const ratio = /WAPE|share/.test(k);
    const row = { mean: mean(a), n: a.length };
    if (!ratio) { const d = a.map((x, i) => x - ref[i]); row.diff = mean(d); row.ci95 = (1.96 * sd(d)) / Math.sqrt(d.length); }
    results[w.id][k] = row;
    console.log('  ' + k.padEnd(36) + (ratio ? row.mean.toFixed(3) : Math.round(row.mean).toString()).padStart(7) + (ratio || !row.ci95 ? '' : '   vs selected ' + (row.diff >= 0 ? '+' : '') + Math.round(row.diff) + ' +- ' + Math.round(row.ci95)));
  }
}
console.log('\ntime ' + ((Date.now() - t0) / 1000).toFixed(1) + ' s');
fs.writeFileSync(path.join(__dirname, 'study.json'), JSON.stringify({ seeds: seeds.length, worlds, results }, null, 1) + '\n');
