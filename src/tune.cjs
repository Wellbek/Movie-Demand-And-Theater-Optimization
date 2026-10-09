// Tuning (repository tool): joint grid of caution c and pattern weight k on tuning seeds 1-40 in every
// study world; the defaults are the pair with the best mean true expected tickets averaged over worlds.
// Reported results (study.cjs) use separate seeds 41-80, so the headline is not measured on tuning data.
const fs = require('node:fs');
const path = require('node:path');
const E = require('./engine.js');
const seeds = Array.from({ length: +(process.argv[2] || 40) }, (_, i) => i + 1);
const C = [0, 0.25, 0.5, 0.75, 1], K = [0.5, 1, 2, 4];
const score = {};
for (const w of E.STUDY_WORLDS) {
  for (const seed of seeds) {
    const st = { ...E.defaultSettings(), seed, pastNoise: w.pastNoise, historyWeeks: w.historyWeeks, newRelease: !!w.newRelease };
    const base = E.run(st, { skipOracle: true });
    if (base.status !== 'ok') continue;
    for (const k of K) {
      const est = E.estimateDemand(base.screenings, base.slate, { ...st, credibility: k });
      for (const c of C) {
        const P = E.buildProblem({ ...st, caution: c, credibility: k }, base.slate, est);
        const sol = E.solveProposed(P);
        if (sol.status !== 'optimal') continue;
        const key = 'c=' + c + ' k=' + k;
        ((score[key] = score[key] || {})[w.id] = score[key][w.id] || []).push(E.scorePlan(P, sol.plan, E.truthFnFor(P)).truth);
      }
    }
  }
}
const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;
const rows = Object.entries(score).map(([key, byW]) => ({ key, byWorld: Object.fromEntries(Object.entries(byW).map(([w, a]) => [w, mean(a)])), avg: mean(Object.values(byW).map(mean)) }));
rows.sort((a, b) => b.avg - a.avg);
rows.slice(0, 8).forEach((r) => console.log(r.key.padEnd(12), Math.round(r.avg), Object.entries(r.byWorld).map(([w, v]) => w + ' ' + Math.round(v)).join('  ')));
fs.writeFileSync(path.join(__dirname, 'tune.json'), JSON.stringify({ seeds: seeds.length, rule: 'max mean over worlds', best: rows[0].key, rows }, null, 1) + '\n');
