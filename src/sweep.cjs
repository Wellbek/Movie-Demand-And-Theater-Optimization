// Robustness sweep embedded in demo.html and quoted in proposal.html / problem-definition.md:
// random configurations (halls, seats, grid, cleaning time, slate, minimums, history, generator),
// selected plan vs the rule of thumb. Usage: node src/sweep.cjs [count]   -> src/sweep.json
const fs = require('node:fs');
const path = require('node:path');
const E = require('./engine.js');
const count = +process.argv[2] || 300;
const summary = (rows) => {
  const ok = rows.filter((x) => x.status === 'ok');
  const n = (f) => ok.filter(f).length;
  const gain = ok.map((x) => (x.truth[1] - x.truth[0]) / x.truth[0]);
  const losses = ok.filter((x) => x.truth[1] < x.truth[0] - 1e-6);
  return {
    configs: rows.length, feasible: ok.length,
    valueWins: n((x) => x.value[1] >= x.value[0] - 1e-6),
    estimateWins: n((x) => x.tickets[1] >= x.tickets[0] - 1e-6),
    truthWins: n((x) => x.truth[1] >= x.truth[0] - 1e-6),
    repeatWins: n((x) => x.truth[1] >= x.repeatTruth - 1e-6),
    violations: n((x) => x.violations > 0),
    meanGainPct: (100 * gain.reduce((a, b) => a + b, 0)) / gain.length,
    worstLossPct: losses.length ? Math.min(...losses.map((x) => (100 * (x.truth[1] - x.truth[0])) / x.truth[0])) : 0,
    smallLosses: losses.filter((x) => (x.truth[0] - x.truth[1]) / x.truth[0] <= 0.015).length,
    bigLossesThinOrOneHall: losses.filter((x) => (x.truth[0] - x.truth[1]) / x.truth[0] > 0.015 && (x.thinShare > 0.4 || x.halls === 1)).length,
    flaggedThin: n((x) => x.thinShare > 0.4),
  };
};
const t0 = Date.now();
const out = { count, seed: 2026, defaults: summary(E.sweep(count, 2026, false)), varied: summary(E.sweep(count, 2026, true)) };
fs.writeFileSync(path.join(__dirname, 'sweep.json'), JSON.stringify(out, null, 1) + '\n');
console.log(JSON.stringify(out, null, 1), '\n', (Date.now() - t0) / 1000 + ' s');
