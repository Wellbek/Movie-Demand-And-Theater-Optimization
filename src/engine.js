// SLOTWISE engine: every calculation behind demo.html and the numbers in proposal.html.
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
    { tag: 'caterpillar-man', title: 'Caterpillar-Man', tagline: 'No Way Down', genre: 'Superhero', profile: 'action', runtime: 148, rating: '12', base: 104, hue: 350 },
    { tag: 'avocado-2', title: 'Avocado', tagline: 'The Way of Guac', genre: 'Sci-fi epic', profile: 'general', runtime: 162, rating: '12', base: 90, hue: 160 },
    { tag: 'defrosted-2', title: 'Defrosted II', tagline: 'Let It Drip', genre: 'Family animation', profile: 'family', runtime: 103, rating: 'ALL', base: 78, hue: 200 },
    { tag: 'gigantic', title: 'Gigantic', tagline: 'Never Let Go of the Door', genre: 'Romance epic', profile: 'drama', runtime: 165, rating: '12', base: 58, hue: 215 },
    { tag: 'outside-in-2', title: 'Outside In 2', tagline: 'New Feelings', genre: 'Family animation', profile: 'family', runtime: 96, rating: 'ALL', base: 66, hue: 45 },
    { tag: 'oppenhammer', title: 'Oppenhammer', tagline: 'The Loudest Workshop', genre: 'Historical drama', profile: 'drama', runtime: 158, rating: '15', base: 45, hue: 25 },
    { tag: 'triassic-world', title: 'Triassic World', tagline: 'Life Finds a Way Earlier', genre: 'Adventure', profile: 'action', runtime: 124, rating: '12', base: 60, hue: 95 },
    { tag: 'top-bun', title: 'Top Bun', tagline: 'Maverick Bakery', genre: 'Action comedy', profile: 'general', runtime: 131, rating: '12', base: 50, hue: 30 },
  ];
  // Boundary case: a release that opens in the planning week, so it has no purchase records.
  const NEW_RELEASE = { tag: 'scavengers-endgame', title: 'The Scavengers', tagline: 'Endgame Sale', genre: 'Superhero', profile: 'action', runtime: 155, rating: '12', base: 120, hue: 270, isNew: true };

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
  const HISTORY_END = '2026-10-04'; // Sunday; the week of 5 Oct is already published [ASSUMPTION]
  const PLAN_START = '2026-10-12'; // Monday of the planning week
  const MAX_ROWS_SHOWN = 200;

  function defaultSettings() {
    return {
      seed: 437,
      historyWeeks: 4,
      venue: 'RIVERSIDE',
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
      credibility: 1, // k: screenings' worth of weight given to the pattern in each cell
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
  const dayType = (d) => (d <= 3 ? 0 : 1); // 0 = Mon-Thu, 1 = Fri-Sun [ASSUMPTION]
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
  function fnv1a(str) {
    let h = 0x811c9dc5;
    for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 0x01000193); }
    return (h >>> 0).toString(16).padStart(8, '0');
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
    const int = (v, lo, hi, label) => {
      if (!Number.isInteger(v) || v < lo || v > hi) errors.push(label + ' must be a whole number from ' + lo + ' to ' + hi + ' (got "' + v + '").');
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
      if (last > 23 * 60 + 59) errors.push('The last show would start at ' + toHHMM(last % 1440) + ' after midnight. This first step keeps every show on its calendar day [ASSUMPTION]; use fewer shows, shorter slots or an earlier first show.');
    }
    if (!(st.caution >= 0 && st.caution <= 1)) errors.push('Caution must be between 0 and 1.');
    if (!(st.credibility >= 0 && st.credibility <= 20)) errors.push('Pattern weight k must be between 0 and 20.');
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
      // Records carry no hall. A total that equals one of the venue's hall sizes is read as a sell-out [ASSUMPTION].
      sc.soldOut = seats.includes(sc.tickets);
      if (sc.tickets > maxSeats) errors.push('Screening ' + sc.tag + ' on ' + sc.date + ' at ' + times[sc.s] + ' has ' + sc.tickets + ' tickets, more than the largest hall (' + maxSeats + ' seats). Check for duplicated rows or the hall settings.');
    });
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
  //   sold-out screening counts as "at least the seats": max(observed, pattern) [ASSUMPTION]
  // w is the weekday's exposure inside its day type (Fri vs Sat vs Sun), so one cell covers 3-4 days.
  // ---------------------------------------------------------------------------
  function estimateDemand(screenings, slate, st, opts) {
    const o = opts || {};
    const k = o.credibility === undefined ? st.credibility : o.credibility;
    const nF = slate.length, nS = st.slots;
    const F = new Float64Array(nF).fill(0), S = new Float64Array(nS).fill(1), D = new Float64Array(7).fill(1);
    const hasRows = new Array(nF).fill(false);
    screenings.forEach((x) => { hasRows[x.f] = true; });
    // start: plain mean tickets per screening of each film
    const s0 = new Float64Array(nF), c0 = new Float64Array(nF);
    screenings.forEach((x) => { s0[x.f] += x.tickets; c0[x.f]++; });
    for (let f = 0; f < nF; f++) F[f] = c0[f] ? s0[f] / c0[f] : 0;
    const adj = (x) => (x.soldOut ? Math.max(x.tickets, F[x.f] * S[x.s] * D[x.d]) : x.tickets);
    // Maximum likelihood for Poisson counts with mean F*S*D: each factor = observed / expected over its rows.
    let iterations = 0;
    for (let it = 0; it < 200; it++) {
      iterations = it + 1;
      const y = screenings.map(adj);
      const nf = new Float64Array(nF), df = new Float64Array(nF);
      screenings.forEach((x, i) => { nf[x.f] += y[i]; df[x.f] += S[x.s] * D[x.d]; });
      const F2 = F.map((v, f) => (df[f] ? nf[f] / df[f] : 0));
      const ns = new Float64Array(nS), ds = new Float64Array(nS);
      screenings.forEach((x, i) => { ns[x.s] += y[i]; ds[x.s] += F2[x.f] * D[x.d]; });
      const S2 = S.map((v, s) => (ds[s] ? ns[s] / ds[s] : 1));
      const nd = new Float64Array(7), dd = new Float64Array(7);
      screenings.forEach((x, i) => { nd[x.d] += y[i]; dd[x.d] += F2[x.f] * S2[x.s]; });
      const D2 = D.map((v, d) => (dd[d] ? nd[d] / dd[d] : 1));
      // scale so time and weekday indices average 1; film strength carries the level
      const ms = S2.reduce((a, b) => a + b, 0) / nS, md = D2.reduce((a, b) => a + b, 0) / 7;
      let change = 0;
      for (let f = 0; f < nF; f++) { const v = F2[f] * ms * md; change = Math.max(change, Math.abs(v - F[f])); F[f] = v; }
      for (let s = 0; s < nS; s++) S[s] = S2[s] / ms;
      for (let d = 0; d < 7; d++) D[d] = D2[d] / md;
      if (change < 1e-6) break;
    }
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
      cells.push({ f, s, t, n: 0, sumY: 0, sumW: 0, soldOut: 0, raw: 0, pattern: F[f] * S[s] * typeMean[t] });
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
      c.tested = c.n > 0;
      c.noRows = !hasRows[c.f];
    });
    const cellOf = (f, s, d) => cells[cellIdx(f, s, dayType(d))];
    // mean demand of one screening on day d, and the predictive's shape (negative binomial)
    const demand = (f, s, d) => cellOf(f, s, d).estimate * w(d);
    const shape = (f, s, d) => Math.max(cellOf(f, s, d).alpha, 1e-6);
    return { F, S, D, typeMean, w, cells, cellIdx, cellOf, demand, shape, hasRows, iterations, credibility: k };
  }

  // Simple alternatives used by the comparison (Section 4): same interface as the selected estimate.
  // They are point estimates, so their prediction is a plain Poisson around the point (very large shape).
  function estimateAlternative(kind, screenings, slate, st) {
    const est = estimateDemand(screenings, slate, st);
    if (kind === 'blend') return est;
    const poisson = () => 1e4;
    if (kind === 'pattern') return { ...est, demand: (f, s, d) => est.F[f] * est.S[s] * est.D[d], shape: poisson };
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
    phaseLoop(2);
    const x = new Float64Array(nVars);
    for (let i = 0; i < m; i++) if (basis[i] < nVars) x[basis[i]] = rhs[i];
    // dual prices y = c_B B^-1, read from the reduced costs of the slack / surplus columns
    const y = rows.map((r, i) => (r.sense === '<=' ? -d[nVars + i] : d[nVars + i]));
    return { status: 'optimal', x, y, z, pivots };
  }

  // ---------------------------------------------------------------------------
  // Planning problem for the week
  // ---------------------------------------------------------------------------
  function buildProblem(st, slate, est) {
    const times = gridOf(st);
    const halls = st.halls.map((h, i) => ({ ...h, i, usable: h.open && h.seats > 0 }));
    const fits = slate.map((f) => f.runtime + st.cleaning <= st.slotMinutes);
    const tested = (f, s, d) => est.cells[est.cellIdx(f, s, dayType(d))].tested;
    // a never-screened time for a film that does have records: its number is an extrapolation
    const untried = (f, s, d) => est.hasRows[f] && !tested(f, s, d);
    const memo = new Map();
    const sold = (f, h, d, s, factor) => {
      const key = f + '|' + h + '|' + d + '|' + s + '|' + factor;
      if (!memo.has(key)) memo.set(key, expectedSoldNB(est.demand(f, s, d) * factor, halls[h].seats, est.shape(f, s, d)));
      return memo.get(key);
    };
    // expected tickets of one screening: E[min(demand, seats)] under the posterior predictive
    const expected = (f, h, d, s) => sold(f, h, d, s, 1);
    // planning value (robust LP, worst case of a box): an untried combination is valued with its
    // demand lowered by the `caution` share. A film without any records (new release) is planned
    // on the manager's own estimate and flagged instead.
    const value = (f, h, d, s) => sold(f, h, d, s, untried(f, s, d) ? 1 - st.caution : 1);
    return { st, slate, est, times, halls, fits, tested, untried, expected, value, nD: 7, nS: times.length };
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
        if (openHalls === 0) out.push('No hall is open, so ' + f.title + ' cannot get its ' + f.min + ' shows (rule one-film-per-hall). Fix: open a hall.');
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
      lp: { vars: vars.length, rows: rows.length, pivots: lp.pivots, objective: lp.z, dualBound: bound, maxReducedCost: worst },
      certificateOk: Math.abs(lp.z - bound) < 1e-6 * Math.max(1, Math.abs(lp.z)) && worst < 1e-7,
      prices: summarizePrices(rows, lp.y, P),
      pinnedValue,
    };
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
    return { plan, score, pins: pinned.pins };
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
    let tickets = 0, value = 0, away = 0, empty = 0, untested = 0, screenings = 0, truth = 0;
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
        if (truthFn) truth += truthFn(f, h, d, s);
      });
      perSlot.push({ d, s, tickets: slotT });
    }
    return { tickets, value, away, empty, untested, screenings, truth: truthFn ? truth : null, perSlot };
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
    const est = estimateDemand(agg.screenings, slate, st);
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
    if (!o.skipOracle) {
      const oracle = solveProposed(P, truth);
      out.oracle = oracle.status === 'optimal' ? { truth: scorePlan(P, oracle.plan, truth).truth } : null;
    }
    out.fingerprint = fnv1a(JSON.stringify({ st, p: proposed.plan, b: baseline.plan, t: Math.round(out.scores.proposed.tickets * 100) }));
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
      { id: 'blend', caution: 1, label: 'Blend + LP, never-screened excluded' },
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
    rows.push({ label: 'Rule of thumb (baseline)', id: 'baseline', truth: base.scores.baseline.truth, promised: base.scores.baseline.tickets, untested: base.scores.baseline.untested });
    return { rows, oracle: base.oracle ? base.oracle.truth : null };
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
      expect: 'Plan found; the new film gets at least 7 shows; its demand is flagged as pattern-only (no records).',
      apply: (st) => ({ ...st, newRelease: true }),
      check: (r) => r.status === 'ok' && r.checks.proposed.shows[r.slate.length - 1] >= 7 && r.checks.proposed.violations.length === 0 && r.estimate.hasRows[r.slate.length - 1] === false,
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
      how: 'Slot length 170 min (and first show 10:00): Avocado needs 162 + 15 = 177 min, Gigantic 165 + 15 = 180 min.',
      expect: 'No plan; the message names both films, rule slot-fit, the minutes each needs and a fix.',
      apply: (st) => ({ ...st, slotMinutes: 170 }),
      check: (r) => r.status === 'infeasible' && r.errors.some((e) => /Gigantic needs 180 min/.test(e)) && r.errors.some((e) => /Avocado needs 177 min/.test(e)),
    },
    {
      id: 'bad-row', kind: 'Failure', title: 'Malformed purchase row',
      how: 'Extra row: caterpillar-man,RIVERSIDE,2026-10-03,19:00,AC-00042,0',
      expect: 'No plan; line-specific message that passes_bought must be a positive whole number.',
      apply: (st) => ({ ...st, extraRows: 'caterpillar-man,RIVERSIDE,2026-10-03,19:00,AC-00042,0' }),
      check: (r) => r.status === 'invalid' && r.errors.some((e) => /Extra row 1: passes_bought "0"/.test(e)),
    },
  ];

  return {
    CATALOG, NEW_RELEASE, DAY_NAMES, DAY_TYPE_NAMES, FIELDS, HISTORY_END, PLAN_START, GROUP_SIZES, GROUP_PROBS, MAX_ROWS_SHOWN, DEFAULT_MIN, PROFILES, DAY_FACTOR,
    defaultSettings, validateSettings, slateOf, gridOf, toHHMM, toMinutes, addDays, weekdayIndex, dayType,
    mulberry32, negBinSample, expectedSoldNB, trueMean, generateHistory, parseExtraRows, aggregate,
    estimateDemand, estimateAlternative, simplex, buildProblem, solveProposed, solveBaseline, checkPlan, scorePlan,
    truthFnFor, explainCell, backtest, run, compareMethods, TEST_CASES, fnv1a,
  };
});
