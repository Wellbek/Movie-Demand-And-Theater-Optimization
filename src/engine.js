// Theater Optimization engine: every calculation behind demo.html and the numbers in proposal.html.
// Runs unchanged in the browser (window.Engine) and in Node (require('./engine.js')).
//
// Pipeline (problem-definition.md, Sections 2 and 4):
//   settings -> fictional purchase history (two distributions, seeded)
//   -> validate rows -> sum purchases per screening -> demand estimate per film x time x day
//   -> value of each possible screening -> weekly plan by linear programming (proposed)
//   and by a rule of thumb (baseline) -> rule checks, comparison, explanations.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Engine = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // ---------------------------------------------------------------------------
  // Fictional slate. Titles are invented parodies; no real film's data is used.
  // `base`, `profile` and the day factors below are the hidden "truth" of the
  // generator. The planner never reads them; it sees only the purchase records.
  // ---------------------------------------------------------------------------
  const CATALOG = [
    { tag: 'caterpillar-man', title: 'Caterpillar-Man', tagline: 'No Way Down', genre: 'Superhero', profile: 'action', runtime: 142, rating: '12', base: 104, hue: 355 },
    { tag: 'avocado-2', title: 'Avocado', tagline: 'The Way of Guac', genre: 'Sci-fi epic', profile: 'general', runtime: 162, rating: '12', base: 90, hue: 145 },
    { tag: 'defrosted-2', title: 'Defrosted II', tagline: 'Let It Drip', genre: 'Family animation', audience: 'family', profile: 'family', runtime: 99, rating: 'ALL', base: 78, hue: 190 },
    { tag: 'gigantic', title: 'Gigantic', tagline: 'Never Let Go of the Door', genre: 'Romance epic', profile: 'drama', runtime: 165, rating: '12', base: 58, hue: 235 },
    { tag: 'outside-in-2', title: 'Outside In 2', tagline: 'New Feelings', genre: 'Family animation', audience: 'family', profile: 'family', runtime: 92, rating: 'ALL', base: 66, hue: 48 },
    { tag: 'oppenhammer', title: 'Oppenhammer', tagline: 'The Loudest Workshop', genre: 'Historical drama', profile: 'drama', runtime: 158, rating: '15', base: 45, hue: 18 },
    { tag: 'triassic-world', title: 'Triassic World', tagline: 'Life Finds a Way Earlier', genre: 'Adventure', profile: 'action', runtime: 119, rating: '12', base: 60, hue: 95 },
    { tag: 'top-bun', title: 'Top Bun', tagline: 'Maverick Bakery', genre: 'Action comedy', profile: 'general', runtime: 127, rating: '12', base: 50, hue: 320 },
  ];
  // Boundary case: a release that opens in the planning week, so it has no purchase records.
  const NEW_RELEASE = { tag: 'scavengers-endgame', title: 'The Scavengers', tagline: 'Endgame Sale', genre: 'Superhero', profile: 'action', runtime: 155, rating: '12', base: 120, hue: 285, isNew: true };

  // Hidden time-of-day shape per profile: multiplier at each clock hour, linearly interpolated.
  const PROFILES = {
    family: [[9, 0.75], [12, 1.25], [15, 1.3], [18, 0.75], [21, 0.22], [24, 0.08]],
    action: [[9, 0.35], [12, 0.6], [15, 0.85], [18, 1.25], [21, 1.3], [24, 0.8]],
    drama: [[9, 0.3], [12, 0.55], [15, 0.75], [18, 1.2], [21, 1.35], [24, 0.9]],
    general: [[9, 0.5], [12, 0.85], [15, 1.0], [18, 1.2], [21, 1.05], [24, 0.6]],
  };
  const DAY_FACTOR = [0.78, 0.8, 0.85, 0.9, 1.15, 1.5, 1.35]; // Mon..Sun, hidden
  const FAMILY_DAY = [0.7, 0.7, 0.7, 0.7, 1.2, 1.2, 1.2]; // families come at weekends, hidden
  // distribution 1: screening demand ~ negative binomial(mean, shape), shape set in the settings (default 6)
  const GROUP_SIZES = [1, 2, 3, 4, 5, 6]; // distribution 2: tickets per purchase (categorical)
  const GROUP_PROBS = [0.3, 0.45, 0.1, 0.1, 0.03, 0.02];
  const ACCOUNT_POOL = 5000;

  const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const HISTORY_END = '2026-10-04'; // Sunday; the week of 5 Oct is already published (assumption)
  const PLAN_START = '2026-10-12'; // Monday of the planning week
  const MAX_ROWS_SHOWN = 200;

  function defaultSettings() {
    return {
      seed: 437,
      historyWeeks: 4,
      venue: 'VENUE-01', // alias only: the brief gives no venue name
      halls: [
        { name: 'Hall 1', seats: 220, open: true },
        { name: 'Hall 2', seats: 120, open: true },
        { name: 'Hall 3', seats: 60, open: true },
      ],
      firstStart: '10:00',
      slots: 5,
      slotMinutes: 180,
      cleaning: 15,
      filmCount: 6,
      newRelease: false,
      newReleaseStrength: 1.3,
      limits: {}, // tag -> { min, max }; missing means DEFAULT_MIN / no cap
      caution: 0.5, // share of value removed from never-screened film x time x day-type combinations
      credibility: 4, // k: screenings' worth of weight given to the pattern in each cell (tuned, src/tune.cjs)
      nbShape: 6, // generator only: demand dispersion (distribution 1)
      pastNoise: 0.5, // generator only: judgement noise of the fictional past programmer
      extraRows: '',
      pins: {}, // "d|s|h" -> film tag (pinned) or '' (blocked)
    };
  }
  const DEFAULT_MIN = 7;

  // ---------------------------------------------------------------------------
  // Deterministic randomness (seeded), dates, small helpers
  // ---------------------------------------------------------------------------
  function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function normalSample(rng) {
    const u = Math.max(rng(), 1e-12);
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rng());
  }
  function gammaSample(rng, shape) {
    // Marsaglia-Tsang; shape >= 1 here
    const d = shape - 1 / 3;
    const c = 1 / Math.sqrt(9 * d);
    for (;;) {
      let x, v;
      do { x = normalSample(rng); v = 1 + c * x; } while (v <= 0);
      v = v * v * v;
      const u = rng();
      if (u < 1 - 0.0331 * x * x * x * x) return d * v;
      if (Math.log(u) < 0.5 * x * x + d * (1 - v + Math.log(v))) return d * v;
    }
  }
  function poissonSample(rng, lambda) {
    let total = 0;
    let rest = lambda;
    while (rest > 0) { // chunks of <= 30 keep Knuth's method numerically safe
      const l = Math.min(rest, 30);
      rest -= l;
      const L = Math.exp(-l);
      let k = 0, p = 1;
      do { k++; p *= rng(); } while (p > L);
      total += k - 1;
    }
    return total;
  }
  // Negative binomial = Poisson whose mean varies from screening to screening (gamma mixing).
  function negBinSample(rng, mean, shape) {
    return poissonSample(rng, (gammaSample(rng, shape) * mean) / shape);
  }
  function pickIndex(rng, probs) {
    const u = rng();
    let acc = 0;
    for (let i = 0; i < probs.length; i++) { acc += probs[i]; if (u < acc) return i; }
    return probs.length - 1;
  }
  function addDays(iso, n) {
    const t = Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10)) + n * 86400000;
    return new Date(t).toISOString().slice(0, 10);
  }
  function weekdayIndex(iso) { // Mon = 0 .. Sun = 6
    const t = Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10));
    return (new Date(t).getUTCDay() + 6) % 7;
  }
  function isValidDate(s) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
    const t = Date.UTC(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10));
    return new Date(t).toISOString().slice(0, 10) === s;
  }
  function toMinutes(hhmm) { return +hhmm.slice(0, 2) * 60 + +hhmm.slice(3, 5); }
  function toHHMM(min) { return String(Math.floor(min / 60)).padStart(2, '0') + ':' + String(min % 60).padStart(2, '0'); }
  const dayType = (d) => (d <= 3 ? 0 : 1); // 0 = Mon-Thu, 1 = Fri-Sun (assumption)
  const DAY_TYPE_NAMES = ['Mon-Thu', 'Fri-Sun'];
  function interp(points, h) {
    if (h <= points[0][0]) return points[0][1];
    for (let i = 1; i < points.length; i++) {
      if (h <= points[i][0]) {
        const [h0, v0] = points[i - 1], [h1, v1] = points[i];
        return v0 + ((v1 - v0) * (h - h0)) / (h1 - h0);
      }
    }
    return points[points.length - 1][1];
  }

  // ---------------------------------------------------------------------------
  // Settings -> problem frame (slate, grid, halls). Settings errors block the run.
  // ---------------------------------------------------------------------------
  function slateOf(st) {
    const films = CATALOG.slice(0, st.filmCount).map((f) => ({ ...f }));
    if (st.newRelease) films.push({ ...NEW_RELEASE });
    films.forEach((f) => {
      const lim = st.limits[f.tag] || {};
      f.min = lim.min === undefined || lim.min === null || lim.min === '' ? DEFAULT_MIN : lim.min;
      f.max = lim.max === undefined || lim.max === null || lim.max === '' ? null : lim.max;
    });
    return films;
  }
  function gridOf(st) {
    const start = toMinutes(st.firstStart);
    const times = [];
    for (let s = 0; s < st.slots; s++) times.push(start + s * st.slotMinutes);
    return times;
  }
  function validateSettings(st) {
    const errors = [];
    const shown = (v) => (v === null || v === undefined || Number.isNaN(v) || v === '' ? 'empty' : '"' + v + '"');
    const int = (v, lo, hi, label) => {
      if (!Number.isInteger(v) || v < lo || v > hi) errors.push(label + ' must be a whole number from ' + lo + ' to ' + hi + ' (got ' + shown(v) + ').');
    };
    int(st.seed, 0, 2 ** 31 - 1, 'Seed');
    int(st.historyWeeks, 1, 12, 'Weeks of history');
    int(st.filmCount, 2, CATALOG.length, 'Films in the records');
    int(st.slots, 1, 8, 'Shows per hall per day');
    int(st.slotMinutes, 60, 300, 'Slot length (minutes)');
    int(st.cleaning, 0, 60, 'Changeover time (minutes)');
    if (!Array.isArray(st.halls) || st.halls.length < 1 || st.halls.length > 6) errors.push('Between 1 and 6 halls are supported.');
    else st.halls.forEach((h, i) => int(h.seats, 0, 600, 'Seats in hall ' + (i + 1)));
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(st.firstStart)) errors.push('First show time must be HH:mm on a 24-hour clock (got "' + st.firstStart + '").');
    else if (!errors.length) {
      const last = toMinutes(st.firstStart) + (st.slots - 1) * st.slotMinutes;
      if (last > 23 * 60 + 59) errors.push('The last show would start at ' + toHHMM(last % 1440) + ' on the next day. This first step keeps every show on its calendar day (our assumption); use fewer shows, shorter slots or an earlier first show.');
    }
    if (!(st.caution >= 0 && st.caution <= 1)) errors.push('Caution must be between 0 and 1.');
    if (!(st.credibility >= 0.5 && st.credibility <= 20)) errors.push('Pattern weight k must be between 0.5 and 20 (at 0 an untried combination would have no prior at all).');
    if (!(st.newReleaseStrength > 0 && st.newReleaseStrength <= 5)) errors.push('New-release strength must be above 0 and at most 5.');
    if (!(st.nbShape >= 1 && st.nbShape <= 100)) errors.push('Demand dispersion (shape) must be between 1 and 100.');
    if (!(st.pastNoise >= 0 && st.pastNoise <= 5)) errors.push('Past programmer noise must be between 0 and 5.');
    if (!errors.length) {
      slateOf(st).forEach((f) => {
        if (!Number.isInteger(f.min) || f.min < 0) errors.push(f.title + ': minimum shows must be a whole number of at least 0.');
        if (f.max !== null && (!Number.isInteger(f.max) || f.max < 0)) errors.push(f.title + ': maximum shows must be blank (no cap) or a whole number.');
        if (f.max !== null && f.max < f.min) errors.push(f.title + ': maximum shows (' + f.max + ') is below its minimum (' + f.min + ').');
      });
    }
    return errors;
  }

  // ---------------------------------------------------------------------------
  // Fictional history generator (mock data; the planner never sees the truth)
  // ---------------------------------------------------------------------------
  function trueMean(film, d, minutes) {
    const fam = film.profile === 'family' ? FAMILY_DAY[d] : 1;
    return film.base * interp(PROFILES[film.profile], minutes / 60) * DAY_FACTOR[d] * fam;
  }
  // E[min(D, c)] for D ~ negative binomial(mean, shape): expected tickets sold in a hall of c seats.
  function expectedSoldNB(mean, cap, shape) {
    if (cap <= 0 || mean <= 0) return 0;
    const q = mean / (shape + mean);
    let p = Math.pow(shape / (shape + mean), shape);
    let cdf = 0, acc = 0;
    for (let k = 0; k < cap; k++) {
      acc += k * p;
      cdf += p;
      p *= ((k + shape) / (k + 1)) * q;
    }
    return acc + cap * Math.max(0, 1 - cdf);
  }

  function generateHistory(st) {
    const rng = mulberry32(st.seed);
    const films = CATALOG.slice(0, st.filmCount);
    const times = gridOf(st);
    const halls = st.halls.map((h, i) => ({ ...h, i })).filter((h) => h.seats > 0).sort((a, b) => b.seats - a.seats || a.i - b.i);
    const days = 7 * st.historyWeeks;
    const first = addDays(HISTORY_END, -days + 1);
    const rows = [];
    const screenings = []; // truth per screening, used only for the mock diagnostics
    for (let n = 0; n < days; n++) {
      const date = addDays(first, n);
      const d = weekdayIndex(date);
      for (let s = 0; s < times.length; s++) {
        // The fictional past programmer: knows roughly what sells, with judgement noise.
        const cands = films
          .filter((f) => f.runtime + st.cleaning <= st.slotMinutes)
          .map((f) => ({ f, score: trueMean(f, d, times[s]) * Math.exp(st.pastNoise * normalSample(rng)) }))
          .sort((a, b) => b.score - a.score);
        halls.forEach((h, k) => {
          if (k >= cands.length) return;
          const f = cands[k].f;
          const mu = trueMean(f, d, times[s]);
          const demand = negBinSample(rng, mu, st.nbShape);
          const sold = Math.min(demand, h.seats);
          screenings.push({ tag: f.tag, date, d, s, hall: h.i, seats: h.seats, mu, demand, sold });
          let left = sold;
          while (left > 0) {
            const g = Math.min(left, GROUP_SIZES[pickIndex(rng, GROUP_PROBS)]);
            left -= g;
            rows.push({
              title_tag: f.tag,
              venue_tag: st.venue,
              play_day: date,
              curtain_time: toHHMM(times[s]),
              account_tag: 'AC-' + String(1 + Math.floor(rng() * ACCOUNT_POOL)).padStart(5, '0'),
              passes_bought: g,
            });
          }
        });
      }
    }
    return { rows, screenings, first, last: HISTORY_END };
  }

  // ---------------------------------------------------------------------------
  // Purchase rows: parse pasted rows, validate, sum per screening
  // ---------------------------------------------------------------------------
  const FIELDS = ['title_tag', 'venue_tag', 'play_day', 'curtain_time', 'account_tag', 'passes_bought'];

  function parseExtraRows(text) {
    const rows = [], errors = [];
    const lines = String(text || '').split(/\r?\n/);
    let n = 0;
    lines.forEach((raw) => {
      const line = raw.trim();
      if (!line) return;
      if (line.replace(/\s/g, '').toLowerCase() === FIELDS.join(',')) return; // header
      n++;
      const p = line.split(',').map((x) => x.trim());
      if (p.length !== 6) { errors.push('Extra row ' + n + ': expected 6 comma-separated fields (' + FIELDS.join(', ') + '), found ' + p.length + '.'); return; }
      const [title_tag, venue_tag, play_day, curtain_time, account_tag, pb] = p;
      if (!title_tag) errors.push('Extra row ' + n + ': title_tag is empty.');
      if (!venue_tag) errors.push('Extra row ' + n + ': venue_tag is empty.');
      if (!isValidDate(play_day)) errors.push('Extra row ' + n + ': play_day "' + play_day + '" is not a valid YYYY-MM-DD date.');
      if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(curtain_time)) errors.push('Extra row ' + n + ': curtain_time "' + curtain_time + '" is not a 24-hour HH:mm time.');
      if (!account_tag) errors.push('Extra row ' + n + ': account_tag is empty.');
      if (!/^\d+$/.test(pb) || +pb < 1) errors.push('Extra row ' + n + ': passes_bought "' + pb + '" must be a positive whole number of tickets.');
      rows.push({ title_tag, venue_tag, play_day, curtain_time, account_tag, passes_bought: +pb, extra: n });
    });
    return { rows, errors };
  }

  // Sums purchases into screenings and records which rows were set aside and why.
  function aggregate(rows, st, slate, history) {
    const times = gridOf(st).map(toHHMM);
    const slotOf = new Map(times.map((t, i) => [t, i]));
    const filmIdx = new Map(slate.map((f, i) => [f.tag, i]));
    const errors = [], notes = [];
    const ignored = { otherVenue: 0, unknownTitle: new Set(), outsideWindow: 0 };
    const map = new Map();
    rows.forEach((r) => {
      const where = r.extra ? 'Extra row ' + r.extra : 'Row';
      if (r.venue_tag !== st.venue) { ignored.otherVenue++; return; }
      if (!filmIdx.has(r.title_tag)) { ignored.unknownTitle.add(r.title_tag); return; }
      if (r.play_day < history.first || r.play_day > history.last) { ignored.outsideWindow++; return; }
      if (!slotOf.has(r.curtain_time)) {
        errors.push(where + ': curtain_time ' + r.curtain_time + ' is not on the show-time grid (' + times.join(', ') + '). Fix the row or the grid settings.');
        return;
      }
      const key = r.title_tag + '|' + r.play_day + '|' + r.curtain_time;
      let sc = map.get(key);
      if (!sc) {
        const d = weekdayIndex(r.play_day);
        sc = { key, f: filmIdx.get(r.title_tag), tag: r.title_tag, date: r.play_day, d, t: dayType(d), s: slotOf.get(r.curtain_time), tickets: 0, purchases: 0 };
        map.set(key, sc);
      }
      sc.tickets += r.passes_bought;
      sc.purchases++;
    });
    const seats = st.halls.map((h) => h.seats).filter((x) => x > 0);
    const maxSeats = Math.max(0, ...seats);
    const screenings = [...map.values()].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.s - b.s || a.f - b.f));
    screenings.forEach((sc) => {
      // Records carry no hall. A total that equals one of the venue's hall sizes is read as a sell-out (assumption).
      sc.soldOut = seats.includes(sc.tickets);
      if (sc.tickets > maxSeats) errors.push('Screening ' + sc.tag + ' on ' + sc.date + ' at ' + times[sc.s] + ' has ' + sc.tickets + ' tickets, more than the largest hall (' + maxSeats + ' seats). Check for duplicated rows or the hall settings.');
    });
    // one venue cannot run more screenings at the same time than it has halls
    const halls = seats.length;
    const concurrent = new Map();
    screenings.forEach((sc) => { const k2 = sc.date + ' ' + times[sc.s]; concurrent.set(k2, (concurrent.get(k2) || 0) + 1); });
    concurrent.forEach((n, when) => { if (n > halls) errors.push(n + ' different films have purchases for ' + when + ', but the venue has only ' + halls + ' hall(s) with seats. Check the pasted rows or the hall settings.'); });
    if (ignored.otherVenue) notes.push(ignored.otherVenue + ' row(s) for another venue_tag were set aside (single-venue scope).');
    if (ignored.unknownTitle.size) notes.push('Rows for titles not on next week\'s slate were set aside: ' + [...ignored.unknownTitle].join(', ') + '.');
    if (ignored.outsideWindow) notes.push(ignored.outsideWindow + ' row(s) outside the history window (' + history.first + ' to ' + history.last + ') were set aside.');
    return { screenings, errors, notes };
  }

  // ---------------------------------------------------------------------------
  // Demand estimate (supporting analysis, not a decision). Lecture 2 methods only:
  //   pattern P(f,s,d) = F_f * S_s * D_d    film strength x time-of-day index x weekday index,
  //                                          fitted by maximum likelihood (Poisson counts)
  //   cell belief       Gamma prior with mean P worth k screenings, Poisson likelihood
  //                     -> posterior Gamma(k*P + sum y, k + sum w)   (Example 2.1 / conjugate pair)
  //                     posterior mean = weighted average of the pattern and the cell's own average
  //   prediction        posterior predictive = negative binomial  (Lecture 2, "integrate, don't plug in")
  //   sold-out screenings (total = a hall size) are flagged; their totals are lower bounds (assumption)
  // w is the weekday's exposure inside its day type (Fri vs Sat vs Sun), so one cell covers 3-4 days.
  // ---------------------------------------------------------------------------
  function estimateDemand(screenings, slate, st, opts) {
    const o = opts || {};
    const k = o.credibility === undefined ? st.credibility : o.credibility;
    const nF = slate.length, nS = st.slots;
    // Time-of-day index per audience group (family films vs all others): the manager marks a film as
    // a family film on the slate (assumption), so a family film is not assumed to share the evening peak.
    const NG = 2;
    const grp = slate.map((f) => (f.audience === 'family' ? 1 : 0));
    const F = new Float64Array(nF).fill(0), D = new Float64Array(7).fill(1);
    const SG = [new Float64Array(nS).fill(1), new Float64Array(nS).fill(1)];
    const Sx = (x) => SG[grp[x.f]][x.s];
    const hasRows = new Array(nF).fill(false);
    screenings.forEach((x) => { hasRows[x.f] = true; });
    // start: plain mean tickets per screening of each film
    const s0 = new Float64Array(nF), c0 = new Float64Array(nF);
    screenings.forEach((x) => { s0[x.f] += x.tickets; c0[x.f]++; });
    for (let f = 0; f < nF; f++) F[f] = c0[f] ? s0[f] / c0[f] : 0;
    // Sold-out totals are used as recorded by default. The alternative "at least the seats" correction
    // (max(total, pattern), applied inside the fit) was tested in the mock study and did not improve
    // plans, so it is kept only as a comparison option; the screening log is the real fix.
    const correct = o.soldOutCorrection === true;
    const adj = (x) => (correct && x.soldOut ? Math.max(x.tickets, F[x.f] * Sx(x) * D[x.d]) : x.tickets);
    // Maximum likelihood for Poisson counts with mean F*S*D: each factor = observed / expected over its rows.
    let iterations = 0;
    // optional trace for the demo's animation: indices and Poisson log-likelihood after each pass
    const trace = o.trace ? [] : null;
    const snap = () => {
      if (!trace) return;
      let ll = 0;
      screenings.forEach((x) => { const mu = Math.max(F[x.f] * Sx(x) * D[x.d], 1e-9); ll += x.tickets * Math.log(mu) - mu - logGamma(x.tickets + 1); });
      trace.push({ S: SG.map((a) => Array.from(a)), D: Array.from(D), ll });
    };
    snap();
    for (let it = 0; it < 300; it++) {
      iterations = it + 1;
      const y = screenings.map(adj);
      const nf = new Float64Array(nF), df = new Float64Array(nF);
      screenings.forEach((x, i) => { nf[x.f] += y[i]; df[x.f] += Sx(x) * D[x.d]; });
      const F2 = F.map((v, f) => (df[f] ? nf[f] / df[f] : 0));
      const ns = [new Float64Array(nS), new Float64Array(nS)], ds = [new Float64Array(nS), new Float64Array(nS)];
      const pn = new Float64Array(nS), pd = new Float64Array(nS);
      screenings.forEach((x, i) => { const g = grp[x.f]; ns[g][x.s] += y[i]; ds[g][x.s] += F2[x.f] * D[x.d]; pn[x.s] += y[i]; pd[x.s] += F2[x.f] * D[x.d]; });
      // a group never screened at a time takes the index of its nearest screened time (the lower one on
      // a tie, to stay cautious); a group with no screenings at all uses the pooled index
      const S2 = [0, 1].map((g) => {
        const own = Array.from({ length: nS }, (v, s) => (ds[g][s] ? ns[g][s] / ds[g][s] : null));
        return own.map((v, s) => {
          if (v !== null) return v;
          for (let dist = 1; dist < nS; dist++) {
            const c = [own[s - dist], own[s + dist]].filter((x) => x !== null && x !== undefined);
            if (c.length) return Math.min(...c);
          }
          return pd[s] ? pn[s] / pd[s] : 1;
        });
      });
      const nd = new Float64Array(7), dd = new Float64Array(7);
      screenings.forEach((x, i) => { nd[x.d] += y[i]; dd[x.d] += F2[x.f] * S2[grp[x.f]][x.s]; });
      const D2 = D.map((v, d) => (dd[d] ? nd[d] / dd[d] : 1));
      // scale so each group's time index and the weekday index average 1; film strength carries the level
      const ms = S2.map((a) => a.reduce((p, q) => p + q, 0) / nS), md = D2.reduce((a, b) => a + b, 0) / 7;
      let change = 0;
      for (let f = 0; f < nF; f++) { const v = F2[f] * ms[grp[f]] * md; change = Math.max(change, Math.abs(v - F[f])); F[f] = v; }
      for (let g = 0; g < NG; g++) for (let s = 0; s < nS; s++) SG[g][s] = S2[g][s] / ms[g];
      for (let d = 0; d < 7; d++) D[d] = D2[d] / md;
      snap();
      if (change < 1e-6) break;
    }
    const S = SG[0];
    const Sf = (f, s) => SG[grp[f]][s];
    // films with no rows (new release, or nothing that fitted the grid): manager's strength x average film
    const withRows = F.filter((v, f) => hasRows[f]);
    const avgF = withRows.length ? withRows.reduce((a, b) => a + b, 0) / withRows.length : 0;
    for (let f = 0; f < nF; f++) if (!hasRows[f]) F[f] = (slate[f].isNew ? st.newReleaseStrength : 1) * avgF;
    const typeMean = [0, 1].map((t) => { const ds = [0, 1, 2, 3, 4, 5, 6].filter((d) => dayType(d) === t); return ds.reduce((a, d) => a + D[d], 0) / ds.length; });
    const w = (d) => D[d] / typeMean[dayType(d)]; // weekday exposure inside its day type

    // cell beliefs (film x time x day type)
    const cells = [];
    const cellIdx = (f, s, t) => (f * nS + s) * 2 + t;
    for (let f = 0; f < nF; f++) for (let s = 0; s < nS; s++) for (let t = 0; t < 2; t++) {
      cells.push({ f, s, t, n: 0, sumY: 0, sumW: 0, soldOut: 0, raw: 0, pattern: F[f] * Sf(f, s) * typeMean[t] });
    }
    screenings.forEach((x) => {
      const c = cells[cellIdx(x.f, x.s, x.t)];
      c.n++;
      c.sumY += adj(x);
      c.sumW += w(x.d);
      c.raw += x.tickets;
      if (x.soldOut) c.soldOut++;
    });
    cells.forEach((c) => {
      c.alpha = k * c.pattern + c.sumY; // posterior shape
      c.beta = k + c.sumW; // posterior rate (in screenings)
      c.estimate = c.beta > 0 ? c.alpha / c.beta : c.pattern; // posterior mean
      c.own = c.n ? c.sumY / c.sumW : null; // the cell's own average (sold-outs corrected)
      c.rawMean = c.n ? c.raw / c.n : null;
      c.weight = c.beta > 0 ? c.sumW / c.beta : 0; // share of the estimate that comes from the cell's own screenings
      c.priorShare = 1 - c.weight; // share that comes from the pattern (1 = no own evidence at all)
      c.tested = c.n > 0;
      c.noRows = !hasRows[c.f];
    });
    const cellOf = (f, s, d) => cells[cellIdx(f, s, dayType(d))];
    // Screening-to-screening spread: negative-binomial shape r by maximum likelihood (Lec 2) over the
    // screenings not read as sold out, each compared with its cell's estimate without itself (leave-one-out).
    const R_GRID = [1, 1.5, 2, 3, 4, 5, 6, 7, 8, 10, 12, 15, 20, 30, 50, 100, 300, 1000];
    const obs = [];
    screenings.forEach((x) => {
      if (x.soldOut) return;
      const c = cells[cellIdx(x.f, x.s, x.t)];
      const a = c.alpha - adj(x), b = c.beta - w(x.d);
      if (b > 0 && a > 0) obs.push([x.tickets, (a / b) * w(x.d)]);
    });
    let r = 1000, best = -Infinity;
    if (obs.length >= 10) {
      R_GRID.forEach((rr) => {
        let ll = 0;
        obs.forEach(([y, mu]) => { ll += logNegBin(y, Math.max(mu, 1e-6), rr); });
        if (ll > best) { best = ll; r = rr; }
      });
    }
    // mean demand of one screening on day d, and the shape of its predictive distribution:
    // variance = mean (Poisson) + mean^2 / r (screening spread) + w^2 Var(theta) (estimation uncertainty),
    // matched by a negative binomial with the same mean and variance (Lec 2: integrate, don't plug in).
    const demand = (f, s, d) => cellOf(f, s, d).estimate * w(d);
    const shape = (f, s, d) => {
      const c = cellOf(f, s, d), mu = c.estimate * w(d);
      const extra = (mu * mu) / r + (w(d) * w(d) * c.alpha) / (c.beta * c.beta);
      return extra > 0 ? Math.max((mu * mu) / extra, 1e-3) : 1e6;
    };
    return { F, S, SG, Sf, grp, D, typeMean, w, cells, cellIdx, cellOf, demand, shape, hasRows, iterations, credibility: k, dispersion: r, dispersionN: obs.length, trace };
  }
  function logGamma(x) {
    // Lanczos approximation, accurate to about 1e-10 for x > 0
    const g = 7, c = [0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313, -176.61502916214059, 12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7];
    if (x < 0.5) return Math.log(Math.PI / Math.sin(Math.PI * x)) - logGamma(1 - x);
    x -= 1;
    let a = c[0];
    const t = x + g + 0.5;
    for (let i = 1; i < g + 2; i++) a += c[i] / (x + i);
    return 0.5 * Math.log(2 * Math.PI) + (x + 0.5) * Math.log(t) - t + Math.log(a);
  }
  function logNegBin(y, mu, r) {
    return logGamma(y + r) - logGamma(r) - logGamma(y + 1) + r * Math.log(r / (r + mu)) + y * Math.log(mu / (r + mu));
  }

  // The demand cell used as the hand-checkable worked example (demo figure, deck, definition): a cell with
  // 2-4 own screenings whose own average differs most from the pattern, so both weights are visible.
  function workedCell(est) {
    const c = est.cells.filter((x) => x.n >= 2 && x.n <= 4).sort((a, b) => Math.abs(b.own - b.pattern) / b.pattern - Math.abs(a.own - a.pattern) / a.pattern)[0];
    return c || est.cells.filter((x) => x.n > 0)[0] || est.cells[0];
  }

  // Simple alternatives used by the comparison (Section 4): same interface as the selected estimate.
  // They are point estimates, so their prediction is the negative binomial around the point with the fitted r.
  function estimateAlternative(kind, screenings, slate, st) {
    const est = estimateDemand(screenings, slate, st);
    if (kind === 'blend') return est;
    const poisson = () => est.dispersion; // point estimates: only the screening spread, no estimation uncertainty
    if (kind === 'pattern') return { ...est, demand: (f, s, d) => est.F[f] * est.Sf(f, s) * est.D[d], shape: poisson };
    // film average: what the rule of thumb looks at (tickets per screening, any time, any day)
    const sum = new Float64Array(slate.length), cnt = new Float64Array(slate.length);
    screenings.forEach((x) => { sum[x.f] += x.tickets; cnt[x.f]++; });
    const avg = Array.from(sum).map((v, f) => (cnt[f] ? v / cnt[f] : est.F[f]));
    if (kind === 'filmAverage') return { ...est, demand: (f) => avg[f], shape: poisson };
    if (kind === 'cellAverage') {
      return { ...est, demand: (f, s, d) => { const c = est.cellOf(f, s, d); return c.n ? c.rawMean : avg[f]; }, shape: poisson };
    }
    throw new Error('unknown estimate ' + kind);
  }

  // ---------------------------------------------------------------------------
  // Linear program: max c'x, rows sum(x over idx) <= or >= rhs, x >= 0.
  // Coefficients are 0/1 and the rows form two nested families (hall side, film side),
  // so every vertex is a whole-numbered schedule; integrality is still checked on every run.
  // Two-phase simplex, Dantzig's rule, Bland's rule after a run of degenerate pivots.
  // ---------------------------------------------------------------------------
  function simplex(nVars, rows, cost) {
    const m = rows.length;
    const art = [];
    rows.forEach((r, i) => { if (r.sense === '>=') art.push(i); });
    const N = nVars + m + art.length;
    const T = rows.map(() => new Float64Array(N));
    const rhs = new Float64Array(m);
    const basis = new Int32Array(m);
    const artCol = new Int32Array(m).fill(-1);
    rows.forEach((r, i) => {
      r.idx.forEach((j) => (T[i][j] = 1));
      T[i][nVars + i] = r.sense === '<=' ? 1 : -1;
      rhs[i] = r.rhs;
      basis[i] = nVars + i;
    });
    art.forEach((i, k) => { artCol[i] = nVars + m + k; T[i][artCol[i]] = 1; basis[i] = artCol[i]; });
    const isArt = (j) => j >= nVars + m;
    const EPS = 1e-9;
    let d = new Float64Array(N);
    let z = 0, pivots = 0;
    const zTrace = []; // planning value after each phase-2 pivot (demo animation)

    function pivot(r, e) {
      const pr = T[r];
      const inv = 1 / pr[e];
      const nz = [];
      for (let j = 0; j < N; j++) if (pr[j] !== 0) { pr[j] *= inv; if (Math.abs(pr[j]) < 1e-12) pr[j] = 0; else nz.push(j); }
      rhs[r] *= inv;
      for (let i = 0; i < m; i++) {
        if (i === r) continue;
        const f = T[i][e];
        if (f === 0) continue;
        const ti = T[i];
        for (const j of nz) { ti[j] -= f * pr[j]; if (Math.abs(ti[j]) < 1e-12) ti[j] = 0; }
        rhs[i] -= f * rhs[r];
        if (Math.abs(rhs[i]) < 1e-11) rhs[i] = 0;
      }
      const de = d[e];
      if (de !== 0) for (const j of nz) d[j] -= de * pr[j];
      z += de * rhs[r];
      basis[r] = e;
    }
    function phaseLoop(phase) {
      let bland = false, stall = 0;
      for (let guard = 0; guard < 100000; guard++) {
        let e = -1, best = EPS;
        for (let j = 0; j < N; j++) {
          if (phase === 2 && isArt(j)) continue;
          if (d[j] > best) { e = j; if (bland) break; best = d[j]; }
        }
        if (e < 0) return;
        let r = -1, ratio = Infinity;
        for (let i = 0; i < m; i++) {
          const a = T[i][e];
          if (a <= EPS) continue;
          const q = rhs[i] / a;
          if (q < ratio - 1e-12 || (q <= ratio + 1e-12 && r >= 0 && basis[i] < basis[r])) { ratio = q; r = i; }
        }
        if (r < 0) throw new Error('LP unbounded'); // cannot happen: every variable sits in a <= 1 row
        pivot(r, e);
        pivots++;
        if (phase === 2) zTrace.push(z);
        if (ratio < 1e-12) { if (++stall > 50) bland = true; } else { stall = 0; bland = false; }
      }
      throw new Error('simplex did not terminate');
    }
    // Phase 1: find any schedule that meets every minimum (drive artificial variables to zero).
    art.forEach((i) => { const ti = T[i]; for (let j = 0; j < N; j++) if (!isArt(j)) d[j] += ti[j]; z -= rhs[i]; });
    if (art.length) phaseLoop(1);
    if (-z > 1e-7) return { status: 'infeasible', pivots };
    for (let i = 0; i < m; i++) {
      if (!isArt(basis[i])) continue;
      for (let j = 0; j < nVars + m; j++) if (Math.abs(T[i][j]) > EPS) { pivot(i, j); break; }
    }
    // Phase 2: the real objective.
    d = new Float64Array(N);
    for (let j = 0; j < nVars; j++) d[j] = cost[j];
    z = 0;
    for (let i = 0; i < m; i++) {
      const cb = basis[i] < nVars ? cost[basis[i]] : 0;
      if (!cb) continue;
      const ti = T[i];
      for (let j = 0; j < N; j++) if (ti[j] !== 0) d[j] -= cb * ti[j];
      z += cb * rhs[i];
    }
    zTrace.push(z);
    phaseLoop(2);
    const x = new Float64Array(nVars);
    for (let i = 0; i < m; i++) if (basis[i] < nVars) x[basis[i]] = rhs[i];
    // dual prices y = c_B B^-1, read from the reduced costs of the slack / surplus columns
    const y = rows.map((r, i) => (r.sense === '<=' ? -d[nVars + i] : d[nVars + i]));
    return { status: 'optimal', x, y, z, pivots, zTrace };
  }

  // ---------------------------------------------------------------------------
  // Planning problem for the week
  // ---------------------------------------------------------------------------
  function buildProblem(st, slate, est) {
    const times = gridOf(st);
    const halls = st.halls.map((h, i) => ({ ...h, i, usable: h.open && h.seats > 0 }));
    const fits = slate.map((f) => f.runtime + st.cleaning <= st.slotMinutes);
    const tested = (f, s, d) => est.cells[est.cellIdx(f, s, dayType(d))].tested;
    // a never-screened film x time x day type: its number is an extrapolation of the pattern.
    // Only a new release (opens in the planning week) is exempt: its number is the manager's estimate.
    const isNew = (f) => !!slate[f].isNew && !est.hasRows[f];
    const untried = (f, s, d) => !isNew(f) && !tested(f, s, d);
    const memo = new Map();
    const sold = (f, h, d, s, factor) => {
      const key = f + '|' + h + '|' + d + '|' + s + '|' + factor;
      if (!memo.has(key)) memo.set(key, expectedSoldNB(est.demand(f, s, d) * factor, halls[h].seats, est.shape(f, s, d)));
      return memo.get(key);
    };
    // expected tickets of one screening: E[min(demand, seats)] under the posterior predictive
    const expected = (f, h, d, s) => sold(f, h, d, s, 1);
    // planning value (robust LP, worst case of a box): the part of each estimate that comes from the
    // pattern rather than from the film's own screenings at that time is lowered by the `caution` share.
    // Untried combinations (all pattern) lose c; a cell with many own screenings loses almost nothing.
    // A new release (no records because it opens in the planning week) is planned on the manager's own
    // estimate, uncautioned and flagged: discounting it would only shrink the manager's number, and the
    // mock study's new-release world shows that this starves new films of shows. A film that was
    // available but never scheduled has no records for a reason (it was judged weaker), so it is
    // cautioned like any untried combination; the robustness sweep found that exempting it lets the
    // optimiser fill the week with it.
    const factor = (f, s, d) => (isNew(f) ? 1 : 1 - st.caution * est.cells[est.cellIdx(f, s, dayType(d))].priorShare);
    const value = (f, h, d, s) => sold(f, h, d, s, factor(f, s, d));
    return { st, slate, est, times, halls, fits, tested, untried, isNew, factor, expected, value, nD: 7, nS: times.length };
  }

  function pinList(P) {
    const pins = [], blocked = new Set(), errors = [];
    Object.entries(P.st.pins || {}).forEach(([key, tag]) => {
      const [d, s, h] = key.split('|').map(Number);
      if (!(d >= 0 && d < 7 && s >= 0 && s < P.nS && h >= 0 && h < P.halls.length)) return; // stale pin after a grid change
      if (tag === '') { blocked.add(key); return; }
      const f = P.slate.findIndex((x) => x.tag === tag);
      if (f < 0) return;
      const where = DAY_NAMES[d] + ' ' + toHHMM(P.times[s]) + ' ' + P.halls[h].name;
      if (!P.halls[h].usable) errors.push('Pinned ' + P.slate[f].title + ' at ' + where + ', but that hall is closed.');
      else if (!P.fits[f]) errors.push('Pinned ' + P.slate[f].title + ' at ' + where + ', but it needs ' + (P.slate[f].runtime + P.st.cleaning) + ' min and slots are ' + P.st.slotMinutes + ' min.');
      else if (pins.some((p) => p.d === d && p.s === s && p.f === f)) errors.push('Pinned ' + P.slate[f].title + ' twice at ' + DAY_NAMES[d] + ' ' + toHHMM(P.times[s]) + '; one film cannot play in two halls at once.');
      else pins.push({ d, s, h, f });
    });
    return { pins, blocked, errors };
  }

  // Pre-solve feasibility explanation: names the violated rule, the gap and a fix.
  function feasibilityProblems(P, pinned) {
    const out = [];
    const nDS = 7 * P.nS;
    const openHalls = P.halls.filter((h) => h.usable).length;
    const free = openHalls * nDS - pinned.pins.length - [...pinned.blocked].filter((k) => P.halls[+k.split('|')[2]].usable).length;
    let needed = 0;
    P.slate.forEach((f, i) => {
      const pinnedF = pinned.pins.filter((p) => p.f === i).length;
      if (f.max !== null && pinnedF > f.max) out.push(f.title + ' is pinned ' + pinnedF + ' times, above its maximum of ' + f.max + '.');
      const need = Math.max(0, f.min - pinnedF);
      needed += need;
      if (need > 0 && !P.fits[i]) out.push(f.title + ' needs ' + (f.runtime + P.st.cleaning) + ' min (' + f.runtime + ' runtime + ' + P.st.cleaning + ' changeover) but slots are ' + P.st.slotMinutes + ' min, so its minimum of ' + f.min + ' shows cannot be met (rule slot-fit). Fix: lengthen slots to ' + (f.runtime + P.st.cleaning) + ' min or set its minimum to 0.');
      else if (need > 0) {
        if (openHalls === 0) out.push('No hall is open with seats, so ' + f.title + ' cannot get its ' + f.min + ' shows (rule one-film-per-hall). Fix: open a hall.');
        else if (f.min > nDS) out.push(f.title + ' needs ' + f.min + ' shows, but one film can play at most ' + nDS + ' times a week (one hall at a time, ' + P.nS + ' slots x 7 days; rule no-self-clash). Fix: lower its minimum to ' + nDS + ' or less.');
      }
    });
    if (!out.length && needed > free) out.push('Minimum shows add up to ' + needed + ' but only ' + free + ' screen-slots are open (rule one-film-per-hall). Fix: reopen a hall, add show times, or lower minimums by ' + (needed - free) + ' in total.');
    return out;
  }

  function solveProposed(P, valueFn) {
    const pinned = pinList(P);
    if (pinned.errors.length) return { status: 'invalid', problems: pinned.errors };
    const problems = feasibilityProblems(P, pinned);
    if (problems.length) return { status: 'infeasible', problems };
    const val = valueFn || P.value;
    const vars = [];
    const hallRow = new Map(), filmRow = new Map(), filmTot = P.slate.map(() => []);
    const pinnedAt = new Set(pinned.pins.map((p) => p.d + '|' + p.s + '|' + p.h));
    const filmBusy = new Set(pinned.pins.map((p) => p.d + '|' + p.s + '|' + p.f));
    for (let d = 0; d < 7; d++) for (let s = 0; s < P.nS; s++) for (let h = 0; h < P.halls.length; h++) {
      const key = d + '|' + s + '|' + h;
      if (!P.halls[h].usable || pinnedAt.has(key) || pinned.blocked.has(key)) continue;
      for (let f = 0; f < P.slate.length; f++) {
        if (!P.fits[f] || filmBusy.has(d + '|' + s + '|' + f)) continue;
        const v = val(f, h, d, s);
        const j = vars.length;
        vars.push({ f, h, d, s, v, c: v });
        const hk = d + '|' + s + '|' + h, fk = d + '|' + s + '|' + f;
        if (!hallRow.has(hk)) hallRow.set(hk, []);
        hallRow.get(hk).push(j);
        if (!filmRow.has(fk)) filmRow.set(fk, []);
        filmRow.get(fk).push(j);
        filmTot[f].push(j);
      }
    }
    const rows = [];
    hallRow.forEach((idx, key) => rows.push({ kind: 'hall', key, idx, sense: '<=', rhs: 1 }));
    filmRow.forEach((idx, key) => { if (idx.length > 1) rows.push({ kind: 'film-time', key, idx, sense: '<=', rhs: 1 }); });
    P.slate.forEach((f, i) => {
      const pinnedF = pinned.pins.filter((p) => p.f === i).length;
      const lo = Math.max(0, f.min - pinnedF);
      if (lo > 0) rows.push({ kind: 'min', key: f.tag, idx: filmTot[i], sense: '>=', rhs: lo });
      if (f.max !== null) rows.push({ kind: 'max', key: f.tag, idx: filmTot[i], sense: '<=', rhs: f.max - pinnedF });
    });
    const lp = simplex(vars.length, rows, vars.map((v) => v.c));
    if (lp.status !== 'optimal') return { status: 'infeasible', problems: ['The rules cannot all be met at once (the linear program has no feasible schedule). Check minimum shows against open screen-slots.'] };
    // integrality check: the plan must be a whole-numbered schedule
    let fractional = 0;
    for (let j = 0; j < vars.length; j++) if (lp.x[j] > 1e-6 && lp.x[j] < 1 - 1e-6) fractional++;
    if (fractional) return { status: 'error', problems: ['The solver returned a fractional plan (' + fractional + ' variables); no plan is shown.'] };
    const plan = emptyPlan(P);
    pinned.pins.forEach((p) => { plan[p.d][p.s][p.h] = p.f; });
    vars.forEach((v, j) => { if (lp.x[j] > 0.5) plan[v.d][v.s][v.h] = v.f; });
    // optimality certificate (LP duality): dual bound = sum of prices x right-hand sides
    let bound = 0;
    rows.forEach((r, i) => { bound += lp.y[i] * r.rhs; });
    // every reduced cost c_j - y'A_j must be <= 0 for the bound to cover every feasible week
    const rowOfVar = vars.map(() => []);
    rows.forEach((r, i) => r.idx.forEach((j) => rowOfVar[j].push(i)));
    let worst = -Infinity;
    vars.forEach((v, j) => { const red = v.c - rowOfVar[j].reduce((a, i) => a + lp.y[i], 0); worst = Math.max(worst, red); });
    const pinnedValue = pinned.pins.reduce((a, p) => a + val(p.f, p.h, p.d, p.s), 0);
    return {
      status: 'optimal',
      plan,
      pins: pinned.pins,
      lp: { vars: vars.length, rows: rows.length, pivots: lp.pivots, objective: lp.z, dualBound: bound, maxReducedCost: worst, zTrace: lp.zTrace },
      certificateOk: Math.abs(lp.z - bound) < 1e-6 * Math.max(1, Math.abs(lp.z)) && worst < 1e-7,
      planValue: lp.z + pinned.pins.reduce((a, p) => a + val(p.f, p.h, p.d, p.s), 0),
      prices: summarizePrices(rows, lp.y, P),
      pinnedValue,
    };
  }

  // What a minimum-show rule costs, by re-solving with the minimum one higher and one lower
  // (dual prices of this degenerate LP hold in one direction only, so they are not reported as costs).
  function ruleCosts(P, base, shows) {
    const out = [];
    P.slate.forEach((film, f) => {
      if (shows[f] !== film.min || film.min === 0) return;
      const at = (m) => {
        const slate2 = P.slate.map((x, i) => (i === f ? { ...x, min: m } : x));
        const P2 = { ...P, slate: slate2 };
        const sol = solveProposed(P2);
        if (sol.status !== 'optimal') return null;
        return { value: sol.planValue, tickets: scorePlan(P2, sol.plan).tickets };
      };
      const b0 = { value: base.planValue, tickets: scorePlan(P, base.plan).tickets };
      const up = at(film.min + 1), down = at(film.min - 1);
      out.push({ tag: film.tag, title: film.title, min: film.min,
        upValue: up ? b0.value - up.value : null, upTickets: up ? b0.tickets - up.tickets : null,
        downValue: down ? down.value - b0.value : null, downTickets: down ? down.tickets - b0.tickets : null });
    });
    return out;
  }

  // Second reference plan built from the records alone: repeat last week's observed schedule
  // (same films at the same weekday and time, the best-selling one in the largest hall), then
  // meet this week's minimums with the same repair step as the rule of thumb.
  function repeatLastWeekPlan(P, screenings) {
    const lastWeekStart = addDays(HISTORY_END, -6);
    const plan = emptyPlan(P);
    const pinned = pinList(P);
    pinned.pins.forEach((p) => { plan[p.d][p.s][p.h] = p.f; });
    const halls = P.halls.filter((h) => h.usable).sort((a, b) => b.seats - a.seats || a.i - b.i);
    const open = [];
    for (let d = 0; d < 7; d++) for (let s = 0; s < P.nS; s++) {
      const shown = screenings.filter((x) => x.date >= lastWeekStart && x.d === d && x.s === s && P.fits[x.f]).sort((a, b) => b.tickets - a.tickets);
      let k = 0;
      halls.forEach((h) => {
        if (pinned.blocked.has(d + '|' + s + '|' + h.i)) return;
        open.push({ d, s, h: h.i });
        if (plan[d][s][h.i] !== null) return;
        while (k < shown.length && plan[d][s].includes(shown[k].f)) k++;
        if (k < shown.length) plan[d][s][h.i] = shown[k++].f;
      });
    }
    const avg = P.slate.map((f, i) => { const xs = screenings.filter((x) => x.f === i); return xs.length ? xs.reduce((a, x) => a + x.tickets, 0) / xs.length : 0; });
    const order = P.slate.map((f, i) => i).sort((a, b) => avg[b] - avg[a] || a - b);
    const shows = P.slate.map(() => 0);
    plan.forEach((day) => day.forEach((slot) => slot.forEach((f) => { if (f !== null) shows[f]++; })));
    [...open].reverse().forEach(({ d, s, h }) => { const f = plan[d][s][h]; if (f !== null && P.slate[f].max !== null && shows[f] > P.slate[f].max) { plan[d][s][h] = null; shows[f]--; } });
    repairMinimums(P, plan, order, open, pinned);
    return plan;
  }

  function summarizePrices(rows, y, P) {
    const out = { min: [], hall: [] };
    rows.forEach((r, i) => {
      if (r.kind === 'min' && y[i] < -1e-6) out.min.push({ tag: r.key, title: P.slate.find((f) => f.tag === r.key).title, price: -y[i] });
      if (r.kind === 'hall' && y[i] > 1e-6) {
        const [d, s, h] = r.key.split('|').map(Number);
        out.hall.push({ d, s, h, price: y[i] });
      }
    });
    out.hall.sort((a, b) => b.price - a.price);
    return out;
  }

  function emptyPlan(P) {
    return Array.from({ length: 7 }, () => Array.from({ length: P.nS }, () => P.halls.map(() => null)));
  }

  // ---------------------------------------------------------------------------
  // Baseline: proposed rule of thumb (a reference, not the operator's known practice)
  //  1 score each film by last history week's tickets per screening;
  //  2 give it shows in proportion to its score, within its min / max;
  //  3 fill the best-selling day-times first, biggest hall first, with the highest-scoring
  //    film that still has shows left, fits the slot and is not already on at that time.
  // ---------------------------------------------------------------------------
  function solveBaseline(P, screenings) {
    const lastWeekStart = addDays(HISTORY_END, -6);
    const sum = new Float64Array(P.slate.length), cnt = new Float64Array(P.slate.length);
    screenings.forEach((x) => { if (x.date >= lastWeekStart) { sum[x.f] += x.tickets; cnt[x.f]++; } });
    const avgAll = sum.reduce((a, b) => a + b, 0) / Math.max(1, cnt.reduce((a, b) => a + b, 0));
    const score = P.slate.map((f, i) => (cnt[i] ? sum[i] / cnt[i] : (f.isNew ? P.st.newReleaseStrength : 1) * avgAll));
    const pinned = pinList(P);
    const plan = emptyPlan(P);
    pinned.pins.forEach((p) => { plan[p.d][p.s][p.h] = p.f; });
    const open = [];
    for (let d = 0; d < 7; d++) for (let s = 0; s < P.nS; s++) for (let h = 0; h < P.halls.length; h++) {
      const key = d + '|' + s + '|' + h;
      if (P.halls[h].usable && plan[d][s][h] === null && !pinned.blocked.has(key)) open.push({ d, s, h });
    }
    const total = open.length;
    const totalScore = score.reduce((a, b, i) => a + (P.fits[i] ? b : 0), 0) || 1;
    const quota = P.slate.map((f, i) => {
      if (!P.fits[i]) return 0;
      const q = Math.round((total * score[i]) / totalScore);
      return Math.max(f.min, Math.min(f.max === null ? 7 * P.nS : f.max, q, 7 * P.nS));
    });
    // fix rounding so quotas add up to the open slots (top scorers absorb the difference)
    const order = P.slate.map((f, i) => i).sort((a, b) => score[b] - score[a] || a - b);
    let diff = total - quota.reduce((a, b) => a + b, 0);
    for (let guard = 0; diff !== 0 && guard < 10000; guard++) {
      let moved = false;
      for (const i of diff > 0 ? order : [...order].reverse()) {
        if (!P.fits[i]) continue;
        const cap = P.slate[i].max === null ? 7 * P.nS : Math.min(P.slate[i].max, 7 * P.nS);
        if (diff > 0 && quota[i] < cap) { quota[i]++; diff--; moved = true; }
        else if (diff < 0 && quota[i] > P.slate[i].min) { quota[i]--; diff++; moved = true; }
        if (diff === 0) break;
      }
      if (!moved) break;
    }
    pinned.pins.forEach((p) => { quota[p.f] = Math.max(0, quota[p.f] - 1); });
    // day-times ranked by observed average tickets per screening in the records
    const dsSum = new Float64Array(7 * P.nS), dsCnt = new Float64Array(7 * P.nS);
    screenings.forEach((x) => { dsSum[x.d * P.nS + x.s] += x.tickets; dsCnt[x.d * P.nS + x.s]++; });
    const dsAvg = (d, s) => (dsCnt[d * P.nS + s] ? dsSum[d * P.nS + s] / dsCnt[d * P.nS + s] : 0);
    open.sort((a, b) => dsAvg(b.d, b.s) - dsAvg(a.d, a.s) || P.halls[b.h].seats - P.halls[a.h].seats || a.d - b.d || a.s - b.s || a.h - b.h);
    open.forEach(({ d, s, h }) => {
      const busy = new Set(plan[d][s].filter((x) => x !== null));
      const pick = order.find((i) => quota[i] > 0 && P.fits[i] && !busy.has(i));
      if (pick !== undefined) { plan[d][s][h] = pick; quota[pick]--; }
    });
    repairMinimums(P, plan, order, open, pinned);
    return { plan, score, pins: pinned.pins };
  }

  // 4 repair: a greedy fill can strand a film below its minimum when its remaining shows only fit
  // times it already plays. Such a film takes the least attractive show of a film above its
  // minimum (or an empty slot); leftover empty slots go to the best film free at that time.
  // `open` lists the fillable cells from most to least attractive; `order` ranks films best first.
  function repairMinimums(P, plan, order, open, pinned) {
    const shows = P.slate.map(() => 0);
    plan.forEach((day) => day.forEach((slot) => slot.forEach((f) => { if (f !== null) shows[f]++; })));
    const isPinned = (d, s, h) => pinned.pins.some((p) => p.d === d && p.s === s && p.h === h);
    const capOf = (i) => (P.slate[i].max === null ? 7 * P.nS : P.slate[i].max);
    const worstFirst = open.slice().reverse();
    for (const i of [...order].reverse()) {
      while (P.fits[i] && shows[i] < P.slate[i].min) {
        const spot = worstFirst.find(({ d, s, h }) => {
          const cur = plan[d][s][h];
          return !isPinned(d, s, h) && !plan[d][s].includes(i) && (cur === null || shows[cur] > P.slate[cur].min);
        });
        if (!spot) break;
        const cur = plan[spot.d][spot.s][spot.h];
        if (cur !== null) shows[cur]--;
        plan[spot.d][spot.s][spot.h] = i;
        shows[i]++;
      }
    }
    open.forEach(({ d, s, h }) => {
      if (plan[d][s][h] !== null) return;
      const pick = order.find((i) => P.fits[i] && !plan[d][s].includes(i) && shows[i] < capOf(i));
      if (pick !== undefined) { plan[d][s][h] = pick; shows[pick]++; }
    });
  }

  // Mock benchmark: the fictional past programmer plans next week the way it planned the history
  // (true demand with judgement noise, best film to the largest hall), then meets the minimums.
  // It is a stand-in for an experienced human, available only because the generator knows the truth.
  function pastProgrammerPlan(P) {
    const rng = mulberry32((P.st.seed ^ 0x5bd1e995) >>> 0);
    const plan = emptyPlan(P);
    const pinned = pinList(P);
    pinned.pins.forEach((p) => { plan[p.d][p.s][p.h] = p.f; });
    const halls = P.halls.filter((h) => h.usable).sort((a, b) => b.seats - a.seats || a.i - b.i);
    const open = [];
    for (let d = 0; d < 7; d++) for (let s = 0; s < P.nS; s++) {
      const cands = P.slate.map((film, f) => ({ f, score: trueMean(film, d, P.times[s]) * Math.exp(P.st.pastNoise * normalSample(rng)) }))
        .filter((c) => P.fits[c.f] && !plan[d][s].includes(c.f)).sort((a, b) => b.score - a.score);
      let k = 0;
      halls.forEach((h) => {
        if (plan[d][s][h.i] !== null || pinned.blocked.has(d + '|' + s + '|' + h.i)) return;
        open.push({ d, s, h: h.i, v: trueMean(P.slate[0], d, P.times[s]) });
        if (k < cands.length) plan[d][s][h.i] = cands[k++].f;
      });
    }
    open.sort((a, b) => b.v - a.v);
    const order = P.slate.map((f, i) => i).sort((a, b) => P.slate[b].base - P.slate[a].base);
    // respect maximums first (drop the least attractive shows of a film above its cap), then minimums
    const shows = P.slate.map(() => 0);
    plan.forEach((day) => day.forEach((slot) => slot.forEach((f) => { if (f !== null) shows[f]++; })));
    [...open].reverse().forEach(({ d, s, h }) => { const f = plan[d][s][h]; if (f !== null && P.slate[f].max !== null && shows[f] > P.slate[f].max) { plan[d][s][h] = null; shows[f]--; } });
    repairMinimums(P, plan, order, open, pinned);
    return plan;
  }

  // ---------------------------------------------------------------------------
  // Checks and scoring (identical for baseline and proposed)
  // ---------------------------------------------------------------------------
  function checkPlan(P, plan) {
    const v = [];
    const shows = P.slate.map(() => 0);
    for (let d = 0; d < 7; d++) for (let s = 0; s < P.nS; s++) {
      const seen = new Set();
      plan[d][s].forEach((f, h) => {
        if (f === null) return;
        shows[f]++;
        if (!P.halls[h].usable) v.push('Hall closed: ' + P.halls[h].name + ' used on ' + DAY_NAMES[d] + ' ' + toHHMM(P.times[s]) + '.');
        if (!P.fits[f]) v.push('slot-fit: ' + P.slate[f].title + ' does not fit a ' + P.st.slotMinutes + '-min slot.');
        if (seen.has(f)) v.push('no-self-clash: ' + P.slate[f].title + ' in two halls on ' + DAY_NAMES[d] + ' ' + toHHMM(P.times[s]) + '.');
        seen.add(f);
      });
    }
    P.slate.forEach((f, i) => {
      if (shows[i] < f.min) v.push('show-limits: ' + f.title + ' has ' + shows[i] + ' shows, below its minimum of ' + f.min + '.');
      if (f.max !== null && shows[i] > f.max) v.push('show-limits: ' + f.title + ' has ' + shows[i] + ' shows, above its maximum of ' + f.max + '.');
    });
    return { violations: v, shows };
  }

  function scorePlan(P, plan, truthFn) {
    let tickets = 0, value = 0, away = 0, empty = 0, untested = 0, screenings = 0, truth = 0, thin = 0;
    const perSlot = [];
    for (let d = 0; d < 7; d++) for (let s = 0; s < P.nS; s++) {
      let slotT = 0;
      plan[d][s].forEach((f, h) => {
        if (!P.halls[h].usable) return;
        if (f === null) { empty += P.halls[h].seats; return; }
        screenings++;
        const dem = P.est.demand(f, s, d);
        const t = P.expected(f, h, d, s);
        tickets += t;
        slotT += t;
        value += P.value(f, h, d, s);
        away += Math.max(0, dem - t); // expected demand that finds the hall full
        empty += P.halls[h].seats - t;
        if (P.untried(f, s, d)) untested++;
        if (P.untried(f, s, d) || (P.isNew && P.isNew(f))) thin += t; // tickets resting on no own evidence
        if (truthFn) truth += truthFn(f, h, d, s);
      });
      perSlot.push({ d, s, tickets: slotT });
    }
    return { tickets, value, away, empty, untested, screenings, truth: truthFn ? truth : null, perSlot, thinShare: tickets ? thin / tickets : 0 };
  }

  // Mock evaluation only: expected sales under the generator's hidden demand.
  function truthFnFor(P) {
    const cache = new Map();
    return (f, h, d, s) => {
      const key = f + '|' + h + '|' + d + '|' + s;
      if (!cache.has(key)) cache.set(key, expectedSoldNB(trueMean(P.slate[f], d, P.times[s]), P.halls[h].seats, P.st.nbShape));
      return cache.get(key);
    };
  }

  // Explanation of one cell: chosen film, its numbers and the ranked alternatives.
  function explainCell(P, plan, d, s, h) {
    const chosen = plan[d][s][h];
    const busy = new Set(plan[d][s].filter((f, k) => f !== null && k !== h));
    const options = P.slate.map((film, f) => {
      const c = P.est.cells[P.est.cellIdx(f, s, dayType(d))];
      return {
        f, title: film.title, tag: film.tag,
        demand: P.est.demand(f, s, d),
        expected: P.expected(f, h, d, s),
        value: P.value(f, h, d, s),
        n: c.n, soldOut: c.soldOut, pattern: c.pattern * P.est.w(d), own: c.own === null ? null : c.own * P.est.w(d),
        weight: c.weight, tested: c.tested, untried: P.untried(f, s, d), noRows: c.noRows,
        fits: P.fits[f], busyElsewhere: busy.has(f), chosen: f === chosen,
      };
    }).sort((a, b) => b.value - a.value);
    return { d, s, h, chosen, options };
  }

  // ---------------------------------------------------------------------------
  // Backtest: hold out the last history week, estimate from the earlier weeks,
  // compare predicted with recorded tickets. A sold-out screening only says
  // "demand >= seats", so it counts as an error only when the prediction is below it.
  // ---------------------------------------------------------------------------
  function backtest(screenings, slate, st) {
    if (st.historyWeeks < 2) return { available: false, reason: 'Needs at least 2 weeks of records (one to learn from, one to check against).' };
    const cut = addDays(HISTORY_END, -6);
    const train = screenings.filter((x) => x.date < cut);
    const test = screenings.filter((x) => x.date >= cut);
    if (!train.length || !test.length) return { available: false, reason: 'Not enough screenings on both sides of the cut.' };
    const methods = [
      { id: 'filmAverage', label: 'Film average (what the rule of thumb uses)' },
      { id: 'cellAverage', label: 'Own average per film x time x day type' },
      { id: 'pattern', label: 'Pattern only (film x time x weekday)' },
      { id: 'blend', label: 'Selected: own evidence blended with the pattern' },
    ];
    const res = methods.map((m) => {
      const e = estimateAlternative(m.id, train, slate, st);
      let absErr = 0, tot = 0;
      test.forEach((x) => {
        const pred = e.demand(x.f, x.s, x.d);
        absErr += x.soldOut ? Math.max(0, x.tickets - pred) : Math.abs(pred - x.tickets);
        tot += x.tickets;
      });
      return { ...m, wape: absErr / tot };
    });
    return { available: true, trainWeeks: st.historyWeeks - 1, testScreenings: test.length, cut, methods: res };
  }

  // ---------------------------------------------------------------------------
  // Full run
  // ---------------------------------------------------------------------------
  function run(settings, opts) {
    const o = opts || {};
    const st = JSON.parse(JSON.stringify(settings));
    const out = { settings: st, errors: [], notes: [] };
    out.errors = validateSettings(st);
    if (out.errors.length) { out.status = 'invalid'; return out; }
    const slate = slateOf(st);
    out.slate = slate;
    out.times = gridOf(st).map(toHHMM);
    const history = generateHistory(st);
    out.history = history;
    const extra = parseExtraRows(st.extraRows);
    if (extra.errors.length) { out.errors = extra.errors; out.status = 'invalid'; return out; }
    const rows = history.rows.concat(extra.rows);
    out.rowCount = rows.length;
    out.extraCount = extra.rows.length;
    const agg = aggregate(rows, st, slate, history);
    out.notes = agg.notes;
    if (agg.errors.length) { out.errors = agg.errors; out.status = 'invalid'; return out; }
    out.screenings = agg.screenings;
    const est = estimateDemand(agg.screenings, slate, st, { trace: !!o.trace });
    out.estimate = est;
    const P = buildProblem(st, slate, est);
    out.problem = P;
    const proposed = solveProposed(P);
    out.proposed = proposed;
    if (proposed.status !== 'optimal') { out.status = proposed.status; out.errors = proposed.problems; return out; }
    const baseline = solveBaseline(P, agg.screenings);
    out.baseline = baseline;
    const truth = truthFnFor(P);
    out.checks = { proposed: checkPlan(P, proposed.plan), baseline: checkPlan(P, baseline.plan) };
    out.scores = { proposed: scorePlan(P, proposed.plan, truth), baseline: scorePlan(P, baseline.plan, truth) };
    out.backtest = backtest(agg.screenings, slate, st);
    out.diagnostics = diagnostics(history, agg.screenings, est, slate, st);
    out.ruleCosts = o.skipOracle ? [] : ruleCosts(P, proposed, out.checks.proposed.shows);
    if (!o.skipOracle) {
      const oracle = solveProposed(P, truth);
      out.oracle = oracle.status === 'optimal' ? { truth: scorePlan(P, oracle.plan, truth).truth } : null;
    }
    out.status = 'ok';
    return out;
  }

  // What the records hide (mock: computable only because the generator knows every screening).
  function diagnostics(history, screenings, est, slate, st) {
    const truthScreens = history.screenings;
    const vanished = truthScreens.filter((x) => x.sold === 0).length;
    const soldOutTrue = truthScreens.filter((x) => x.demand >= x.seats).length;
    const turnedAway = truthScreens.reduce((a, x) => a + Math.max(0, x.demand - x.seats), 0);
    const detected = screenings.filter((x) => x.soldOut).length;
    const cellsTotal = est.cells.length;
    const cellsTested = est.cells.filter((c) => c.tested).length;
    const accounts = new Set(history.rows.map((r) => r.account_tag)).size;
    return { screenings: truthScreens.length, recorded: screenings.length, vanished, soldOutTrue, detected, turnedAway, cellsTotal, cellsTested, accounts, rows: history.rows.length };
  }

  // ---------------------------------------------------------------------------
  // Method comparison on the current settings (mock: scored against hidden demand)
  // ---------------------------------------------------------------------------
  function compareMethods(settings) {
    const st = JSON.parse(JSON.stringify(settings));
    const base = run(st, { skipOracle: false });
    if (base.status !== 'ok') return null;
    const P0 = base.problem;
    const truth = truthFnFor(P0);
    const rows = [];
    const variants = [
      { id: 'filmAverage', caution: 0, label: 'Film average + LP' },
      { id: 'cellAverage', caution: 0, label: 'Own cell average + LP' },
      { id: 'pattern', caution: 0, label: 'Pattern only + LP' },
      { id: 'blend', caution: 0, label: 'Blend + LP, no caution' },
      { id: 'blend', caution: st.caution, label: 'Blend + LP, caution ' + Math.round(st.caution * 100) + '% (selected)' },
      { id: 'blend', caution: 1, label: 'Blend + LP, caution 100% (pattern part ignored)' },
    ];
    variants.forEach((v) => {
      const st2 = { ...st, caution: v.caution };
      const est = estimateAlternative(v.id, base.screenings, base.slate, st2);
      const P = buildProblem(st2, base.slate, est);
      const sol = solveProposed(P);
      if (sol.status !== 'optimal') return;
      const sc = scorePlan(P, sol.plan, truth);
      rows.push({ label: v.label, id: v.id, caution: v.caution, truth: sc.truth, promised: sc.tickets, untested: sc.untested });
    });
    {
      const est = estimateDemand(base.screenings, base.slate, st, { soldOutCorrection: true });
      const P = buildProblem(st, base.slate, est);
      const sol = solveProposed(P);
      if (sol.status === 'optimal') { const sc = scorePlan(P, sol.plan, truth); rows.push({ label: 'Blend + LP with an "at least the seats" sold-out correction', id: 'soldOutFix', truth: sc.truth, promised: sc.tickets, untested: sc.untested }); }
    }
    rows.push({ label: 'Rule of thumb (baseline)', id: 'baseline', truth: base.scores.baseline.truth, promised: base.scores.baseline.tickets, untested: base.scores.baseline.untested });
    const rl = repeatLastWeekPlan(P0, base.screenings);
    const rlScore = scorePlan(P0, rl, truth);
    rows.push({ label: 'Repeat last week (second reference, from the records)', id: 'repeat', truth: rlScore.truth, promised: rlScore.tickets, untested: rlScore.untested, violations: checkPlan(P0, rl).violations.length });
    const pp = pastProgrammerPlan(P0);
    const ppScore = scorePlan(P0, pp, truth);
    rows.push({ label: 'Simulated past programmer (knows true demand up to judgement noise)', id: 'programmer', truth: ppScore.truth, promised: ppScore.tickets, untested: ppScore.untested, violations: checkPlan(P0, pp).violations.length });
    return { rows, oracle: base.oracle ? base.oracle.truth : null };
  }

  // ---------------------------------------------------------------------------
  // Mock study core (shared by src/study.cjs and the demo's in-browser re-run):
  // one fictional history, every variant re-planned and scored against the hidden demand.
  // ---------------------------------------------------------------------------
  const STUDY_WORLDS = [
    { id: 'sensible', label: 'Sensible past', pastNoise: 0.5, historyWeeks: 4 },
    { id: 'random', label: 'Random past', pastNoise: 3, historyWeeks: 4 },
    { id: 'sparse', label: 'Random past, 1 week', pastNoise: 3, historyWeeks: 1 },
    { id: 'newrel', label: 'Sensible past + new release', pastNoise: 0.5, historyWeeks: 4, newRelease: true },
  ];
  const STUDY_VARIANTS = [
    { key: 'selected', label: 'Selected: Bayes estimate, k = 4, caution 0.5', est: 'blend' },
    { key: 'film average', label: 'Film average + LP', est: 'filmAverage', caution: 0 },
    { key: 'own cell average', label: 'Own cell average + LP', est: 'cellAverage', caution: 0 },
    { key: 'pattern only', label: 'Pattern only + LP', est: 'pattern', caution: 0 },
    { key: 'with sold-out correction', label: 'With "at least the seats" correction', est: 'blend', soldOut: true },
    { key: 'caution 0', label: 'Caution 0', est: 'blend', caution: 0 },
    { key: 'caution 0.25', label: 'Caution 0.25', est: 'blend', caution: 0.25 },
    { key: 'caution 0.75', label: 'Caution 0.75', est: 'blend', caution: 0.75 },
    { key: 'caution 1', label: 'Caution 1', est: 'blend', caution: 1 },
    { key: 'k 1', label: 'k = 1', est: 'blend', credibility: 1 },
    { key: 'k 2', label: 'k = 2', est: 'blend', credibility: 2 },
    { key: 'k 8', label: 'k = 8', est: 'blend', credibility: 8 },
    { key: 'caution on new release', label: 'Caution also on films without records', est: 'blend', cautionNoRows: true },
  ];
  function studyOne(seed, world) {
    const st = { ...defaultSettings(), seed, pastNoise: world.pastNoise, historyWeeks: world.historyWeeks, newRelease: !!world.newRelease };
    const base = run(st);
    if (base.status !== 'ok') return null;
    const truth = truthFnFor(base.problem);
    const out = {
      'rule of thumb (baseline)': base.scores.baseline.truth,
      'simulated past programmer': scorePlan(base.problem, pastProgrammerPlan(base.problem), truth).truth,
      'repeat last week': scorePlan(base.problem, repeatLastWeekPlan(base.problem, base.screenings), truth).truth,
      'oracle (knows true demand)': base.oracle.truth,
      'fitted dispersion r': base.estimate.dispersion,
      'sold-out share': base.diagnostics.soldOutTrue / base.diagnostics.screenings,
      'tested combinations share': base.diagnostics.cellsTested / base.diagnostics.cellsTotal,
    };
    if (base.backtest.available) base.backtest.methods.forEach((m) => { out['backtest WAPE ' + m.id] = m.wape; });
    STUDY_VARIANTS.forEach((v) => {
      const st2 = { ...st };
      if (v.caution !== undefined) st2.caution = v.caution;
      if (v.credibility !== undefined) st2.credibility = v.credibility;
      const est = v.soldOut ? estimateDemand(base.screenings, base.slate, st2, { soldOutCorrection: true }) : estimateAlternative(v.est, base.screenings, base.slate, st2);
      const P = buildProblem(st2, v.cautionNoRows ? base.slate.map((f) => ({ ...f, isNew: false })) : base.slate, est);
      const sol = solveProposed(P);
      if (sol.status === 'optimal') out[v.key] = scorePlan(P, sol.plan, truthFnFor(P)).truth;
    });
    return out;
  }
  // mean per key, and for plan scores the paired difference to the selected method with a 95% interval
  function summarizeStudy(perSeed) {
    const res = {};
    const ok = perSeed.filter(Boolean);
    const keys = Object.keys(ok[0] || {});
    const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;
    keys.forEach((k) => {
      const a = ok.map((o) => o[k]).filter((x) => x !== undefined);
      const row = { mean: mean(a), n: a.length };
      if (!/WAPE|share|dispersion/.test(k) && k !== 'selected') {
        const d = ok.filter((o) => o[k] !== undefined).map((o) => o[k] - o.selected);
        const m = mean(d), sd = Math.sqrt(d.reduce((x, y) => x + (y - m) ** 2, 0) / Math.max(1, d.length - 1));
        row.diff = m;
        row.ci95 = (1.96 * sd) / Math.sqrt(d.length);
      }
      res[k] = row;
    });
    return res;
  }

  // Robustness sweep: random configurations (venue, grid, slate, history, method settings); for each
  // feasible one the selected plan is compared with the rule of thumb on the tool's estimate, on the
  // planning value (guaranteed by optimality) and against the generator's hidden demand (mock).
  function randomConfig(rng, i, varyMethod) {
    const pick = (a) => a[Math.floor(rng() * a.length)];
    const nH = 1 + Math.floor(rng() * 4);
    const slotMinutes = pick([150, 160, 170, 180, 190, 200]);
    // every show starts between 08:00 and 23:30 on its calendar day
    const slots = Math.min(3 + Math.floor(rng() * 4), 1 + Math.floor((23 * 60 + 30 - 8 * 60) / slotMinutes));
    const first = 9 * 60 + 30 * Math.floor(rng() * 7);
    const firstStart = Math.min(first, 23 * 60 + 30 - (slots - 1) * slotMinutes);
    const filmCount = 3 + Math.floor(rng() * 6);
    const st = {
      ...defaultSettings(),
      seed: 1000 + i,
      historyWeeks: 1 + Math.floor(rng() * 8),
      halls: Array.from({ length: nH }, (_, k) => ({ name: 'Hall ' + (k + 1), seats: 40 + 10 * Math.floor(rng() * 27), open: true })),
      firstStart: toHHMM(Math.max(8 * 60, firstStart)),
      slots, slotMinutes,
      cleaning: 5 * Math.floor(rng() * 7),
      filmCount,
      newRelease: rng() < 0.3,
      caution: varyMethod ? pick([0, 0.25, 0.5, 0.75, 1]) : defaultSettings().caution,
      credibility: varyMethod ? pick([1, 2, 4, 8]) : defaultSettings().credibility,
      nbShape: pick([2, 4, 6, 10, 20]),
      pastNoise: pick([0, 0.25, 0.5, 1, 2, 3]),
      limits: {},
    };
    // minimums low enough to be feasible: a film that does not fit the slot gets none
    const cap = Math.floor((nH * slots * 7) / (filmCount + (st.newRelease ? 1 : 0)));
    CATALOG.slice(0, filmCount).concat(st.newRelease ? [NEW_RELEASE] : []).forEach((f) => {
      const fits = f.runtime + st.cleaning <= slotMinutes;
      st.limits[f.tag] = { min: fits ? Math.floor(rng() * Math.min(8, cap + 1)) : 0, max: null };
    });
    return st;
  }
  function sweep(count, seed, varyMethod) {
    const rng = mulberry32(seed || 2026);
    const rows = [];
    for (let i = 0; i < count; i++) {
      const st = randomConfig(rng, i, varyMethod);
      const r = run(st, { skipOracle: true });
      if (r.status !== 'ok') { rows.push({ i, status: r.status }); continue; }
      const b = r.scores.baseline, p = r.scores.proposed;
      const rl = scorePlan(r.problem, repeatLastWeekPlan(r.problem, r.screenings), truthFnFor(r.problem));
      rows.push({ i, status: 'ok', halls: st.halls.length, slots: st.slots, films: r.slate.length, weeks: st.historyWeeks, caution: st.caution, k: st.credibility,
        value: [b.value, p.value], tickets: [b.tickets, p.tickets], truth: [b.truth, p.truth], repeatTruth: rl.truth, thinShare: p.thinShare, violations: r.checks.proposed.violations.length + r.checks.baseline.violations.length });
    }
    return rows;
  }

  // Brute-force check of the LP: random tiny instances (one day, up to 2 slots, 2 halls, 3 films),
  // every whole-numbered schedule enumerated and compared with the simplex result.
  function bruteForceCheck(count, seed) {
    const rng = mulberry32(seed || 7);
    let compared = 0, agree = 0, infeasibleBoth = 0;
    for (let n = 0; n < count; n++) {
      const nF = 2 + Math.floor(rng() * 2), nS = 1 + Math.floor(rng() * 2), nH = 1 + Math.floor(rng() * 2);
      const slate = CATALOG.slice(0, nF).map((f) => ({ ...f, min: Math.floor(rng() * 2), max: rng() < 0.5 ? null : 1 + Math.floor(rng() * 3) }));
      const st = { ...defaultSettings(), slots: nS, halls: Array.from({ length: nH }, (_, i) => ({ name: 'H' + i, seats: 20 + Math.floor(rng() * 100), open: true })), caution: rng() };
      const dem = Array.from({ length: nF }, () => Array.from({ length: nS }, () => Array.from({ length: 7 }, () => rng() * 150)));
      const est = {
        demand: (f, s, d) => dem[f][s][d],
        cells: Array.from({ length: nF * nS * 2 }, () => { const tested = rng() < 0.7; return { tested, priorShare: tested ? rng() * 0.6 : 1 }; }),
        cellIdx: (f, s, t) => (f * nS + s) * 2 + t,
        hasRows: slate.map(() => true),
        shape: () => 8,
      };
      const P = buildProblem(st, slate, est);
      const blockRest = {};
      for (let d = 1; d < 7; d++) for (let s = 0; s < nS; s++) for (let h = 0; h < nH; h++) blockRest[d + '|' + s + '|' + h] = '';
      const sol = solveProposed({ ...P, st: { ...st, pins: blockRest } });
      let best = -Infinity;
      const plan = Array.from({ length: nS }, () => Array(nH).fill(null));
      const shows = slate.map(() => 0);
      const cells = [];
      for (let s = 0; s < nS; s++) for (let h = 0; h < nH; h++) cells.push({ s, h });
      (function rec(i, val) {
        if (i === cells.length) { if (slate.every((f, k) => shows[k] >= f.min && (f.max === null || shows[k] <= f.max))) best = Math.max(best, val); return; }
        const { s, h } = cells[i];
        rec(i + 1, val);
        for (let f = 0; f < nF; f++) {
          if (!P.fits[f] || plan[s].includes(f)) continue;
          plan[s][h] = f; shows[f]++;
          rec(i + 1, val + P.value(f, h, 0, s));
          plan[s][h] = null; shows[f]--;
        }
      })(0, 0);
      if (best === -Infinity) { if (sol.status !== 'optimal') infeasibleBoth++; continue; }
      compared++;
      if (sol.status !== 'optimal') continue;
      let got = 0;
      for (let s = 0; s < nS; s++) for (let h = 0; h < nH; h++) { const f = sol.plan[0][s][h]; if (f !== null) got += P.value(f, h, 0, s); }
      if (Math.abs(got - best) < 1e-6) agree++;
    }
    return { count, compared, agree, infeasibleBoth };
  }

  // ---------------------------------------------------------------------------
  // Executable test cases (shared by the demo's Test cases panel and node tests)
  // ---------------------------------------------------------------------------
  const TEST_CASES = [
    {
      id: 'normal', kind: 'Normal', title: 'Default week',
      how: 'Default settings, seed 437.',
      expect: 'Plan found; 0 rule violations in both plans; certificate holds; proposed >= baseline on planning value.',
      apply: (st) => st,
      check: (r) => r.status === 'ok' && r.checks.proposed.violations.length === 0 && r.checks.baseline.violations.length === 0 && r.proposed.certificateOk && r.scores.proposed.value >= r.scores.baseline.value - 1e-6,
    },
    {
      id: 'new-release', kind: 'Boundary', title: 'New release with no records',
      how: 'Add The Scavengers (opens in the planning week, so zero purchase rows), minimum 7 shows.',
      expect: 'Plan found; the new film gets at least 7 shows; its demand is flagged as a manager estimate (no records) and planned without the caution discount.',
      apply: (st) => ({ ...st, newRelease: true }),
      check: (r) => r.status === 'ok' && r.checks.proposed.shows[r.slate.length - 1] >= 7 && r.checks.proposed.violations.length === 0 && r.estimate.hasRows[r.slate.length - 1] === false && r.problem.factor(r.slate.length - 1, 0, 0) === 1,
    },
    {
      id: 'hall-closed', kind: 'Boundary', title: 'Hall 3 closed next week',
      how: 'Untick "open" for Hall 3 (the records still include its past shows).',
      expect: 'Plan found with no screening in Hall 3; minimums still met.',
      apply: (st) => ({ ...st, halls: st.halls.map((h, i) => (i === 2 ? { ...h, open: false } : h)) }),
      check: (r) => r.status === 'ok' && r.proposed.plan.every((day) => day.every((slot) => slot[2] === null)) && r.checks.proposed.violations.length === 0,
    },
    {
      id: 'one-week', kind: 'Boundary', title: 'Only one week of records',
      how: 'Weeks of history = 1.',
      expect: 'Plan found from thinner evidence; backtest reported as not available instead of a misleading score.',
      apply: (st) => ({ ...st, historyWeeks: 1 }),
      check: (r) => r.status === 'ok' && r.backtest.available === false && r.checks.proposed.violations.length === 0,
    },
    {
      id: 'too-few-slots', kind: 'Failure', title: 'Minimums exceed open screen-slots',
      how: 'Close Hall 2 and Hall 3 for the planning week (6 films x 7 minimum shows = 42 > 35 open slots).',
      expect: 'No plan; the message names rule one-film-per-hall, the gap (42 vs 35) and a fix; earlier results marked stale.',
      apply: (st) => ({ ...st, halls: st.halls.map((h, i) => (i > 0 ? { ...h, open: false } : h)) }),
      check: (r) => r.status === 'infeasible' && r.errors.some((e) => /42 but only 35/.test(e)),
    },
    {
      id: 'slot-too-short', kind: 'Failure', title: 'Slots too short for the longest film',
      how: 'Slot length 170 min: Avocado needs 162 + 15 = 177 min, Oppenhammer 158 + 15 = 173 min, Gigantic 165 + 15 = 180 min.',
      expect: 'No plan; the message names each film that no longer fits, rule slot-fit, the minutes it needs and a fix.',
      apply: (st) => ({ ...st, slotMinutes: 170 }),
      check: (r) => r.status === 'infeasible' && ['Avocado needs 177 min', 'Oppenhammer needs 173 min', 'Gigantic needs 180 min'].every((m) => r.errors.some((e) => e.includes(m))),
    },
    {
      id: 'bad-row', kind: 'Failure', title: 'Malformed purchase row',
      how: 'Extra row: caterpillar-man,VENUE-01,2026-10-03,19:00,AC-00042,0',
      expect: 'No plan; line-specific message that passes_bought must be a positive whole number.',
      apply: (st) => ({ ...st, extraRows: 'caterpillar-man,VENUE-01,2026-10-03,19:00,AC-00042,0' }),
      check: (r) => r.status === 'invalid' && r.errors.some((e) => /Extra row 1: passes_bought "0"/.test(e)),
    },
  ];

  return {
    CATALOG, NEW_RELEASE, DAY_NAMES, DAY_TYPE_NAMES, FIELDS, HISTORY_END, PLAN_START, GROUP_SIZES, GROUP_PROBS, MAX_ROWS_SHOWN, DEFAULT_MIN, PROFILES, DAY_FACTOR,
    defaultSettings, validateSettings, slateOf, gridOf, toHHMM, toMinutes, addDays, weekdayIndex, dayType,
    mulberry32, negBinSample, expectedSoldNB, trueMean, generateHistory, parseExtraRows, aggregate,
    estimateDemand, estimateAlternative, simplex, buildProblem, solveProposed, solveBaseline, checkPlan, scorePlan,
    truthFnFor, explainCell, backtest, run, compareMethods, pastProgrammerPlan, repeatLastWeekPlan, ruleCosts, TEST_CASES,
    STUDY_WORLDS, STUDY_VARIANTS, studyOne, summarizeStudy, bruteForceCheck, randomConfig, sweep, workedCell, logGamma, logNegBin,
  };
});
