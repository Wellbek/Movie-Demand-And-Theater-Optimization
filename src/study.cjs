// Mock study (repository tool, not part of the submission): re-runs the pipeline on many
// fictional histories and scores every plan against the generator's hidden demand.
// It is how the estimate and the defaults (caution, pattern weight k) were chosen.
// Three fictional worlds differ only in how the past schedule was chosen and how much was recorded:
//   sensible: the past programmer knew roughly what sells (default generator, noise 0.5, 4 weeks)
//   random:   the past schedule was close to random (noise 3, 4 weeks: every combination tried)
//   sparse:   random past schedule but only 1 week, so untried combinations are untried by chance
// Usage: node src/study.cjs [seeds=40]   -> prints a table and writes src/study.json
const fs = require('node:fs');
const path = require('node:path');
const E = require('./engine.js');

const nSeeds = +(process.argv[2] || 40);
const seeds = Array.from({ length: nSeeds }, (_, i) => i + 1);
const results = {};
const t0 = Date.now();
for (const w of E.STUDY_WORLDS) {
  const perSeed = seeds.map((seed) => E.studyOne(seed, w));
  results[w.id] = E.summarizeStudy(perSeed);
  console.log('\nworld: ' + w.id + ' (' + seeds.length + ' fictional histories)');
  for (const [k, row] of Object.entries(results[w.id])) {
    const ratio = /WAPE|share|dispersion/.test(k);
    console.log('  ' + k.padEnd(36) + (ratio ? row.mean.toFixed(3) : Math.round(row.mean).toString()).padStart(7) + (row.ci95 === undefined ? '' : '   vs selected ' + (row.diff >= 0 ? '+' : '') + Math.round(row.diff) + ' +- ' + Math.round(row.ci95)));
  }
}
console.log('\ntime ' + ((Date.now() - t0) / 1000).toFixed(1) + ' s');
fs.writeFileSync(path.join(__dirname, 'study.json'), JSON.stringify({ seeds: seeds.length, worlds: E.STUDY_WORLDS, results }, null, 1) + '\n');
