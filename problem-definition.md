# Problem Definition: Fill the Right Seats - Weekly Showtime Planning for One Venue

**IE437 Assignment 1 · Movie Programming - Problem Definition and Decision-Support Design**

Author / student ID or team: Louis Wellmeyer · student ID TBD (fill in before submission)  
Date / version: 2026-10-09 · v3.0  
Summary: A venue's programming manager decides every week which booked film plays in which hall at which show-time.
The purchase records cannot support the whole programming decision, so the first step is narrower: one venue, one week, films already booked, a fixed show-time grid, and an advisory plan.
Demand per film, time and day type is estimated with a Poisson-Gamma Bayes update whose prior is a film x time x weekday pattern, and the week is planned as a cautious linear program, compared with a rule of thumb under the same inputs.
On fictional data the plan reaches 8,211 expected tickets against 7,570 for the rule of thumb (+640, +8.5%); real-world effects are untested.  
Files: `problem-definition.md`, `demo.html`, `proposal.html`  
LLM tools and use: Claude Code with Claude Opus 5.5, 2026-09-29 to 2026-10-09 (reading the brief and lecture slides, role-played reviews, drafting, engine and UI code, tests, the mock study, consistency checks); details and my own review in Section 7.

Citations: `[A §n]` = the assignment brief (`assignment.md`), section n; `[Ref §n]` = the classification reference; `Lec n, p. m` = IE437 lecture deck n (the five decks numbered 0-4 by the course), page m.
Only methods from these five lectures are used.
Every number about the cinema is fictional and produced by `demo.html` with its default settings (seed 437, run fingerprint `0352a4f1`).
Film titles are invented parodies (for example *Caterpillar-Man*, *Avocado*, *Gigantic*); no data of any real film is used, as the brief asks for an "entirely fictional dataset" with invented aliases [A §2].

**How this definition answers the brief's six questions [A §2]** (one line each; the argument is in the referenced section):

| The brief asks | Short answer | Where |
|---|---|---|
| "What problem should the company address first, and what is the scope of your proposal?" | The weekly allocation of already-booked films to halls and show-times at one venue, as an advisory plan; booking, pricing, several venues and mid-week changes are excluded. | §1 |
| "Who will use the results, and what decisions will they support?" | The venue's programming manager, before each week's schedule is published: which film in which hall at each show-time; the head of programming uses trial results for go / no-go. | §1, §6 |
| "What can you establish from the available information, and what needs further investigation?" | Tickets per screening by film, time and weekday; not halls, seats, zero-sale screenings, prices, purchase times or current practice, so sell-outs and untried combinations hide demand. | §3 |
| "What additional information should you request, why do you need it, and what will you do if it is unavailable?" | Data-contract confirmation, a screening log with halls, hall seats and grid, the weekly slate with show commitments, the KPI, a practice interview; each with a priority and a fallback. | §3 table |
| "Which approach do you recommend, and how will you evaluate its validity and usefulness?" | Bayesian demand estimate + robust weekly LP, beside a rule of thumb; validity by backtest, rule and optimality checks and test cases; usefulness by offline replay and an advisory trial. | §4, §5, §6 |
| "Under what conditions should the company test, adopt, revise, or stop the proposal?" | Gated stages with stated continue, revise and stop conditions; thresholds marked [PROPOSED] are to be agreed with the sponsor. | §6 |

## 1. Decision, Scope & Problem Structure

The operator wants to "use its records to understand its audience and improve movie-programming decisions", where movie programming means "choosing which movies to screen, in which screening rooms, and at what times" [A §1, §2].
Its practices, decision rules and current performance are not given [A §2].

> The venue's programming manager uses demand estimated from past purchase records, the venue's hall seats and the confirmed film slate, before next week's schedule is published, to decide which film plays in which hall at each show-time, in order to increase expected admissions without breaking show commitments.

**Why the records are insufficient for the full programming decision.**
One row is one completed purchase for one screening [A §2].
The six fields therefore show what sold, never what could have sold:
1. There is no hall or capacity field, so a sold-out screening records its seats, not its demand, and the records cannot say which room a film used.
2. A screening that sold nothing leaves no row, so the record of what was shown is incomplete.
3. Only combinations someone chose to schedule are observed; a film never shown at 22:00 has no evidence for 22:00.
4. There is no price, cost, purchase time or film information (runtime, release, genre), so revenue, booking curves, mid-week reaction and new titles are outside what the records can inform.
5. Which films to book is decided before any record of them exists.

**Narrower first step and the decision it supports.**
The first step keeps the core of the programming decision (film, room, time) but only where the records plus a few weekly operating settings can carry it: one venue, one planning week (Mon-Sun), films already booked, a fixed show-time grid, decided once before sales open, as a draft the manager approves.
Rooms enter through hall seats that the manager enters each week (an operating rule, Section 3), not through the records.
The information plan in Sections 3 and 6 says what would extend it.

**Boundary:** one decision problem = the plan for one venue and one week: every hall x show-time x day of that week receives one film or stays empty.
In the demo: 3 halls x 5 show-times x 7 days = 105 screen-slots, 6 films (configurable), records of the 4 weeks to Sun 4 Oct 2026, plan for Mon 12 to Sun 18 Oct 2026; the week of 5 Oct is already published `[ASSUMPTION]`.

**Exclusions and their consequences:**

| Excluded | Consequence |
|---|---|
| Film booking and run length (upstream decision) | The slate and per-film show limits are inputs; the tool cannot say which films to acquire. |
| Pricing, concessions, revenue | The objective is admissions; a ticket is not all margin, so the KPI must be confirmed (Section 3). |
| Several venues | Sister venues sharing one audience are treated as independent. |
| Mid-week changes | The plan cannot react to a flop inside the week; that would need purchase times and a feedback design. |
| Holidays, film ageing, weather, competitors | Not in the records; holiday weeks should be left out of the trial. |
| A film in two halls at the same time; after-midnight shows | Not supported; a manager who needs them must pin cells by hand. |
| External signals (other cinemas' sales, box-office success, social media, reviews) | Could improve accuracy (Section 3) but are not in the records and their link to one venue is unproven. |

**Current practice vs baseline:** current practice is unknown [A §2].
The baseline is a rule of thumb defined in Section 4 (approach A), labelled a proposed reference, not the operator's process.

**Decisions:**

| ID | What is chosen | Who uses / approves |
|---|---|---|
| `weekly-plan` | Film (or none) for every hall x show-time x day of the planning week | Programming manager reviews, may pin or block cells, approves before publication |

Dependencies: none inside the boundary.
The real upstream dependency `film-booking → weekly-plan: feasible region (available films, show limits)` lies outside the boundary and enters only as input.
The demand estimate is a supporting analysis, not a decision [Ref §1].
`evaluated_by`: N/A (no child decision).

| Object | Property | Classification (or unresolved status) | Structural evidence or question to resolve |
|---|---|---|---|
| Decision dependency graph | Decision Structure | Flat | One decision in scope; the parent `film-booking` is excluded and only passes inputs. |
| `weekly-plan` | State Structure | Stateless | No state-transition component links decision epochs inside the week: the plan is fixed once and slot demands are treated as independent `[ASSUMPTION]`. If people who saw a film on Monday do not return on Tuesday (audience depletion), a remaining-audience state would appear; check with repeat-purchase patterns of `account_tag` in Stage 0. |
| `weekly-plan` | Information Structure | Open-loop | The whole week is fixed with information available before sales open. Basis: `operational-requirement` `[ASSUMPTION]` (a schedule is published before tickets are sold); TBD: the operator's publication lead time, asked in the practice interview. Re-planning every week does not make one week's problem Feedback [Ref §2]. |

Editing settings, pinning cells and re-running in the demo before approval is interface behaviour and adds no future observations.
This matches the reference's monthly nurse-schedule example (Flat, Stateless, Open-loop with Formulation components) [Ref §6].

## 2. Computable Problem

**Decision variables:** $x_{fhds} \in \lbrace 0,1 \rbrace$ = 1 if film $f$ plays in hall $h$ on day $d$ at show-time $s$.

**Inputs and settings** (operating rules, entered weekly by the manager; demo defaults are fictional `[ASSUMPTION]`): halls with seats (220 / 120 / 60) and whether each is open next week; show-time grid (first show 10:00, 5 shows per hall per day, 180-minute slots, 15 minutes changeover, so shows at 10:00, 13:00, 16:00, 19:00, 22:00); the slate with runtimes and min / max shows per film (default minimum 7, no maximum); pinned or blocked cells; caution $c$ = 0.5; pattern weight $k$ = 1.
Inputs from the records: tickets per screening, derived in Section 3.

**Objective:** maximise expected admissions in the planning week.
The computed metric is expected tickets under the demand estimate; the business outcome it supports is actual admissions, which only a trial can measure (Section 6).
There is one objective, so no priority rule between objectives is needed.

**Supporting analysis (not a component): the demand estimate.**
It supplies the value of each possible screening; the components below remain explicit formulas [Ref §3, "ML Usage ≠ Data-driven Evaluation"].
1. *Pattern by maximum likelihood* (Lec 2, p. 24): $P_{fsd} = F_f \cdot S_s \cdot D_d$ (film strength x time-of-day index x weekday index), the maximiser of the Poisson likelihood of all screening totals, computed by repeating "each factor = observed / expected tickets over its rows" until stable; $S$ and $D$ are scaled to average 1.
   It gives every film x time x day an estimate, including combinations never screened.
2. *Bayes update per cell* (Lec 2, Example 2.1, p. 20; posterior as a weighted average, pp. 16, 22): for film $f$, show-time $s$ and day type $t$ (Mon-Thu, Fri-Sun `[ASSUMPTION]`), demand rate $\theta \sim \text{Gamma}(kP, k)$ with mean $P$ = the pattern, worth $k$ screenings; screenings are Poisson with exposure $w_i = D_{d_i}/\bar D_t$ (the weekday's share inside its day type); posterior $\text{Gamma}(kP + \sum y_i,\ k + \sum w_i)$ with mean $\frac{k}{k+\sum w_i} P + \frac{\sum w_i}{k + \sum w_i} \bar y$.
3. *Sold-out screenings:* records carry no hall, so a total equal to one of the venue's hall sizes is read as a sell-out `[ASSUMPTION]` and enters as $\max(y_i, \text{pattern})$ ("at least the seats").
4. *Prediction:* the posterior predictive of a Poisson-Gamma model is negative binomial (Lec 2, p. 32), so expected sales integrate over the belief instead of plugging in its mean (Lec 2, p. 31).
5. *Films without records* (a new release, or a film that could not fit the grid in the past): $F_f$ = the manager's strength (default 1.3 for a new release) x the average film; flagged in the plan.

| Component ID | Decision ID | Role: Cost / Constraint / State-transition | Model: Formulation / Simulation / Data-driven | Definition, units, and evidence / assumption / unknown |
|---|---|---|---|---|
| `expected-tickets` | `weekly-plan` | Cost (maximise) | Formulation | $\sum x_{fhds}\, v_{fhds}$ in tickets, $v_{fhds} = \mathbb{E}[\min(D_{fsd}, \text{seats}_h)]$ with $D$ the negative-binomial predictive. For a film with records at a time and day type it never played (*untried*), the demand mean is multiplied by $(1-c)$ before valuing: the worst case of a box, which keeps the problem linear because $x \ge 0$ (robust LP, Lec 1, p. 25). The evaluation metric reported in Section 5 is the same sum with $c = 0$. |
| `one-film-per-hall` | `weekly-plan` | Constraint | Formulation | $\sum_f x_{fhds} \le 1$ for every open hall-time; closed halls and blocked cells have no variables. Hard. |
| `no-self-clash` | `weekly-plan` | Constraint | Formulation | $\sum_h x_{fhds} \le 1$: a film never plays in two halls at the same time. Hard. It also keeps the records interpretable, since two such screenings would share one `title_tag` + `venue_tag` + `play_day` + `curtain_time` key [A §2]. |
| `show-limits` | `weekly-plan` | Constraint | Formulation | $\min_f \le \sum_{h,d,s} x_{fhds} \le \max_f$. Hard. `[ASSUMPTION]` stands in for distributor and house rules (TBD, Section 3). |
| `slot-fit` | `weekly-plan` | Constraint | Formulation | $x_{fhds} = 0$ if runtime$_f$ + changeover > slot length. Hard. |

No State-transition component exists (Section 1).
Pinned cells are fixed before solving: their hall-time and film-time leave the problem and the film's limits shrink by one.

**Hard constraints vs preferences:** all rules are hard; there are no soft constraints or penalties.
Caution is part of how the objective values untried combinations, not a constraint.

**Invalid or infeasible input:** malformed settings or purchase rows block the run with a field- or line-specific message (for example a non-positive `passes_bought`, an invalid date, a `curtain_time` that is not on the grid, a screening with more tickets than the largest hall, a grid whose last show starts after midnight).
If the rules cannot all be met, a pre-check names the violated rule, the gap and a fix (for example "Minimum shows add up to 42 but only 35 screen-slots are open"); no plan is shown and earlier results are marked stale.
Rows for another `venue_tag`, for titles not on the slate, or outside the history window are set aside with a note, not silently dropped.
Empty hall-times are allowed (value 0).

**Follow-up questions [Ref §5].**
*Formulation:* variables, objective, hard constraints, parameters and infeasible-input handling are above.
The 0/1 requirement is relaxed to $x \ge 0$: every coefficient is 0 or 1, and the hall-time rows and the film rows (film-time rows nested inside each film's total) form two nested families, so every vertex of the polyhedron is whole-numbered, and an LP optimum sits at a vertex (Lec 1, p. 16).
The tool checks integrality on every run and refuses a fractional plan.
Optimality for the stated formulation is certified on every run by LP duality: the dual bound equals the plan value and every reduced cost is $\le 0$ (KKT and duality, Lec 1, pp. 37-42).
*Data-driven:* N/A - no evaluation component is learned; the estimate only supplies parameters.
Its data questions (coverage, bias, validation) are answered in Section 3 and its backtest in Section 5.
*Simulation:* N/A - the fictional generator creates data and scores the mock checks but is not part of the evaluation of a plan.
*Stateful, Feedback, Hierarchical:* N/A for this boundary (Section 1).

## 3. Information & Uncertainty

**Unit of record:** one completed purchase for one screening; date and time describe the screening, not the purchase [A §2].
**Unit of analysis:** the screening, identified by `title_tag` + `venue_tag` + `play_day` + `curtain_time`; its tickets $y_i$ are the sum of `passes_bought` over its rows.
**Transformations:** rows of the planned venue only; `curtain_time` mapped to a slot of the grid; `play_day` mapped to weekday and day type; aliases mapped to the slate (title, runtime).
**Quality checks:** six fields per row, valid date and 24-hour time, positive whole `passes_bought`, non-empty aliases, times on the grid, screening totals not above the largest hall; set-aside rows are counted and reported.
**Decision time vs later outcomes:** everything above is available before the plan is fixed; the actual admissions of the planned week are later outcomes, used only for evaluation.

**What each field is used for:**

| Field | Status | Used for in this step | Could support later (out of scope now, and why) |
|---|---|---|---|
| `title_tag` | Used | Groups purchases into screenings and screenings into film x time x day-type cells; maps to the slate | Film ageing across weeks; needs release dates and a longer history |
| `venue_tag` | Used as a filter | Keeps the planned venue's rows; others are set aside with a note | Pooling evidence across venues, shared audiences; multi-venue is excluded |
| `play_day` | Used | Weekday, day type, weekday index, history window, backtest cut | Holiday effects and trends; needs a holiday calendar and more weeks |
| `curtain_time` | Used | Show-time slot (time-of-day index); off-grid times are rejected | Designing a new grid; the grid is an operating rule, not learned |
| `account_tag` | Not used | Checked non-empty; distinct accounts are counted for information | Repeat visits, audience overlap between films (cannibalisation), audience depletion (Section 1); decision value unproven and a privacy review is needed |
| `passes_bought` | Used | Summed per screening = tickets sold, the demand observation | Group-size mix (families vs couples) to refine time-of-day profiles |

**Established from the records:** tickets per observed screening, their pattern by film, time and weekday, and how often totals hit a hall size.
**Not established:** halls, seats, zero-sale screenings, prices, purchase times, film attributes, current practice, dataset size, period and quality [A §2]; Section 1 lists the consequences.

**No additional record fields.**
The brief says: "Label any additional fields or operating rules as your own assumptions" [A §2].
The mechanism needs no additional record fields: it runs on the six teaching fields.
What the business has not given is not assumed unless it is stated and tagged `[ASSUMPTION]`; the only such items are the weekly operating settings of Section 2 (halls and seats, grid, runtimes, show limits) and the interpretation rules marked in Sections 1-2.
Because everything rests on this format, the operator must confirm that the six-field specification is the fixed and complete export (first request below): renamed or removed fields, a changed meaning (for example purchase time instead of screening time) or pre-aggregated rows would make validation reject the file or, worse, silently degrade the estimates.

**Gap: there is no real dataset.**
The brief gives a record specification, not a dataset, and asks for a small, entirely fictional one [A §2].
The demo therefore generates the history from its settings (halls, seats, show-time grid, number of films, weeks of history, seed), so changing a setting changes the records (14,165 purchase rows for 420 screenings, 7 Sep to 4 Oct 2026, by default).
It uses two distributions:
1. *Demand per screening:* negative binomial with mean = film strength x time-of-day shape x weekday factor (all invented, with film-by-time differences such as family films selling poorly late at night) and dispersion $r$ = 6; sales = min(demand, seats).
   We use it because ticket buyers form a count (Poisson) whose rate varies from screening to screening (a Gamma mixture), which is exactly the negative binomial, and it matches the Poisson-Gamma model of the estimate (Lec 2, pp. 19-20, 32).
2. *Tickets per purchase:* categorical 1-6 with shares 30%, 45%, 10%, 10%, 3%, 2% (invented); each screening's sales are split into purchases with it.

The past schedule inside the history is chosen by a fictional programmer who knows roughly what sells (log-normal judgement noise, setting "past programmer noise"), so some combinations are never tried, as in real records.
Demand could be predicted more accurately with real records of the venue and, beyond the six fields, with sales of other cinemas showing the same film, each film's national box-office success, pre-sales and booking curves, social-media reach and audience retention (trailer views, mentions), review scores, the release and holiday calendar, weather, competitor schedules and marketing spend.
These are out of scope for the first step because none is in the records, each needs a separate collection agreement, and their link to one venue's admissions is unproven; we simplify with the generator above, whose parameters are visible and adjustable in the demo.
Results on generated data show that the mechanism works; they do not show that real records behave like the generator.

| Fact / assumption / unknown or request | Evidence or reason for current treatment | Why it matters | How to confirm or obtain it; priority | Fallback or limit until confirmed |
|---|---|---|---|---|
| Request: confirm the six-field export is the fixed, complete data contract (names, meaning, one row per completed purchase) | The tool reads only these fields [A §2] | Parser, checks and estimates depend on it | Data owner, written confirmation in Stage 0; **high** | Validation rejects non-conforming files; adapt the parser before any analysis |
| Request: screening log (every scheduled screening with hall, including zero sales) | Not in the specification [A §2] | Exact sell-outs, vanished screenings, hall effects | Operator's scheduling system export; **high** | Sell-outs read from totals equal to a hall size `[ASSUMPTION]`; vanished screenings stay an upward bias for weak slots, flagged; without any hall information the tool stops at demand analytics |
| Request: hall seats, show-time grid, changeover time | Not in the specification | Feasibility (`slot-fit`), value of large vs small halls | Venue manager; **high** | Manager enters them weekly, as in the demo |
| Request: weekly slate with runtimes and min / max show commitments | Contract terms unknown | Hard rules (`show-limits`, `slot-fit`) | Programming manager, distributor terms; **high** | Manager enters them; minimum 0 if unknown, and the plan is labelled advisory |
| Request: KPI - admissions or revenue (price, film rental share) | No price field; the objective could be wrong | Wrong objective, wrong plan | Sponsor decision in Stage 0; **high** | Admissions |
| Request: one interview on current practice and publication lead time | Practice unknown [A §2] | A fair baseline, missing rules, confirms Open-loop | Programming manager; **high** | Stated rule of thumb as reference; lead time stays TBD |
| Request: at least 8 recent weeks of rows `[PROPOSED]`; release dates and holiday calendar | History length unknown; the demo history contains no holidays | Backtest, stability, holiday flags, film ageing | Data owner, public calendar; **medium** | Shorter history with the same caution and a flagged backtest; holiday weeks excluded |
| Request: privacy basis for using `account_tag` | Account-level data may be personal data | Any later audience analysis | Operator's privacy function; **medium** | Not used, as now |
| Request: purchase time and price | Not in the specification | Booking curves, revenue, mid-week reaction (later stages) | Ticketing export; **low** | Weekly plan, admissions only |
| `[ASSUMPTION]` a screening total equal to a hall size is a sell-out | Records carry no hall | Censoring correction | Screening log (above) | A screening that sells exactly a hall size without selling out is misread (rare); the demo flags 120 of 420 screenings (29%) |
| `[ASSUMPTION]` demand of a film-time is stable over the history window, and screenings are independent | Keeps the estimate simple and the objective separable | Opening weeks, ageing, holidays and similar films competing break it | Backtest on held-out weeks; `account_tag` overlap; release dates | Weekly backtest in Stage 1; limitation stated |
| `[ASSUMPTION]` Mon-Thu and Fri-Sun as day types, with a weekday index inside each | Enough evidence per cell from a few weeks | Friday may behave differently from Saturday | Backtest by weekday in Stage 1 | Weekday index keeps the per-day level |
| TBD: refunds, walk-up sales without account, the `play_day` of after-midnight shows | The brief says "completed purchase" only [A §2] | Demand and day-type bias | Data owner; medium | Document and exclude ambiguous rows; after-midnight shows are excluded |

**Main uncertainties, how they are examined, and when not to trust the plan.**
Estimates for untried combinations are extrapolations of the pattern, and an optimiser seeks out exactly the most optimistic ones: "the optimiser will exploit the surrogate wherever it is wrong" (Lec 0, p. 25; illustrated in Lec 1, p. 31).
This is the most important feature of the problem: the records are censored by capacity and selected by past choices, so the data are thinnest exactly where an optimiser looks for gains.
The response is twofold: the robust value discounts untried combinations (Section 2), and the trial deliberately tests a capped number of them to learn what the records cannot show (Section 6).
Its effect was examined with a sweep of the caution level and the pattern weight over 40 fictional histories in two worlds (Section 4): without caution the plan loses 635 ± 64 true expected tickets per week when the past programmer skipped bad combinations for a reason, and caution costs nothing measurable when every combination had been tried.
Sold-out screenings were examined the same way; the "at least the seats" rule is part of the selected estimate that the study compares with plain averages.
The recommendation should not be trusted when most of a plan relies on untried combinations or on films without records, when no hall information exists, in holiday or opening weeks, or when any exclusion of Section 1 is active.

## 4. Alternatives & Selected Approach

Methods were chosen by the course's criteria (Lec 0, pp. 10-12): the decision model is known and linear, it is one static decision per week, and demand must be learned from a fixed log.
That points to linear programming with a robust value and duality (Lec 1) for the decision, and Bayesian estimation (Lec 2) for demand; Lecture 4 supplies the later exploration stage.

| Approach | Mechanism and required information | Strengths, limitations, and effort | Selection and reason |
|---|---|---|---|
| A: Rule of thumb | Score = last history week's tickets per screening; shows in proportion to the score within min / max; fill the best-selling day-times first (by average tickets in the records), biggest hall first, with the highest-scoring film that has shows left, fits the slot and is not on elsewhere at that time; a film stranded below its minimum takes the least attractive show of a film above its minimum; leftover empty slots go to the best free film | Transparent, uses only the records; blind to each film's time-of-day fit; low effort | Baseline, labelled a proposed reference |
| B: Demand report only | Tables of tickets by film and time; the manager plans by hand | Simple; produces no plan, so the decision stays unsupported, and untried times stay invisible | Rejected for the first step; its tables are part of the demo |
| C: Plain averages + LP | Cell or film averages feed the same LP | Simple; ignores sell-outs, cannot rank untried combinations; mock study: own averages −506 ± 59, film averages −1,135 ± 106 tickets per week vs the selection | Rejected |
| D: Bayes estimate + robust LP | Section 2: pattern by MLE, Poisson-Gamma update, negative-binomial expected sales, robust value, LP with duality check | Exact for the stated formulation; certificate on every run; honest about thin data; assumes separable demand | **Selected** |
| E: Gaussian-process prior or Bayesian optimisation (Lec 4) | GP over film x time cells (the v2 design), or trying whole schedules on the real venue with an acquisition function | GP: more hyperparameters and harder to explain for the same purpose; BO: each query is a real week and a schedule has hundreds of variables | Rejected for the first step (Section 7, discussion 2) |
| F: Test-and-learn (bandit, Lec 4) | Spend a few shows per week on untried combinations and update from sales | Learns what the records cannot; turns the problem into Feedback and needs weekly data flow | Stage 2+ add-on (Section 6) |

**Choices inside the selected approach** (evidence: the mock study, 40 fictional histories per world, true expected tickets per week, difference to the selection with 95% interval; "sensible" = the default generator, "random" = past schedule close to random):

| Part | Options | Evidence | Decision |
|---|---|---|---|
| Estimate | film average; own cell average; pattern only; pattern + Bayes update | Sensible: −1,135 ± 106; −506 ± 59; −1,190 ± 113; selected. Random: −592 ± 34; −26 ± 27; −626 ± 28; selected. Backtest error (WAPE, 40 histories): 38.7%, 29.6%, 30.3%, **28.9%** | Pattern + Bayes update |
| Pattern weight $k$ | 0, 1, 2, 4 | Sensible: +14 ± 16, selected, −37 ± 21, −74 ± 32; $k = 0$ would leave an untried cell with no prior weight at all | $k$ = 1 |
| Caution $c$ | 0, 0.3, 0.5, 1 (exclude untried) | Sensible: −635 ± 64, −100 ± 40, selected, +0 ± 0. Random: +0 ± 1 for all | $c$ = 0.5 (allows an untried combination only when its estimate is twice as strong) |
| Solver | enumeration; greedy fill; LP | Enumeration: about $7^{105}$ weeks; greedy cannot trade one slot against another and gives no proof (it is the baseline); LP: exact for the formulation with a certificate | LP |

**Selected flow:** validate settings and rows → sum purchases per screening → read sell-outs → fit the pattern → Bayes update per cell → expected sales per (film, hall, time) with caution → LP → integrality and duality checks → rule-of-thumb plan on the same inputs → score both with the same function and the same rules.
**Tie-breaking and randomness:** the simplex uses fixed pivot rules (largest gain first, Bland's rule after a run of degenerate pivots), so equal-value plans are always broken the same way; randomness exists only in the fictional generator, through a seeded generator.
**Actual calculations:** everything above runs live in `demo.html`.
**Mock:** the hidden demand of the generator, used only by the panels marked MOCK and by the study.
**Not implemented:** approaches B, E and F as features, booking, pricing, several venues, mid-week changes, holidays, ageing, a film in two halls at once, after-midnight shows, the exploration policy.
**Optimality claim:** the plan is optimal for the stated formulation and estimates; it is not optimal with respect to anything the formulation omits, and its value is only as good as the estimates.

## 5. Demonstration & Evaluation

**How to use `demo.html`:** open it in a desktop browser (no server, internet or installation); it generates the fictional history from the default settings and runs once.
1. *Settings:* halls (seats, open next week), show-time grid, slate and min / max shows, a new release, caution and $k$, generator settings (seed, weeks of history, dispersion, past programmer noise), and optional extra purchase rows in the six-field format.
2. *Run:* records (first 200 rows, CSV download, field-usage table, data-gap and data-contract notes) → demand map per film, time and day type (click a cell for prior, own evidence, posterior) → both plans side by side per day or as a week overview (click a cell for the ranked alternatives, then pin or block it, which re-runs) → comparison, certificate, rule prices, backtest and mock scoring.
3. *Modify and repeat:* change a setting, press Run; the page marks results stale while settings differ, and shows no plan with an explanation when the rules cannot be met.
Settings are kept in the page address; "Reset to defaults" restores the defaults; the run fingerprint is identical for identical settings (default `0352a4f1`).
Checked offline in Chromium (Playwright with network disabled: no requests, no console errors, no horizontal overflow at 1440, 1024 and 390 px; all seven test cases pass in the page) and in Firefox 149 (headless render of both files).
The core behaviour maps to Section 2: `expected-tickets` is the score shown per cell and per plan, and the four constraints are checked for both plans.

**Baseline, metrics, conditions:** approach A and the selected approach use the same settings, records, estimate and expected-sales function, and are checked against the same rules.
Primary metric: expected tickets per week (caution 0).
Secondary: untried combinations used, expected turned-away demand, expected empty seats, rule violations, the planning value (caution applied).
Separate from the information used to decide, the MOCK panels score both plans against the generator's hidden demand, which real records never reveal.

**Default result (fictional):** SLOTWISE 8,211 vs rule of thumb 7,570 expected tickets (+640, +8.5%); untried combinations 0 vs 14; expected turned away 662 vs 1,033; expected empty seats 5,789 vs 6,430; 0 rule violations in both.
LP: 630 variables, 321 rules, 430 simplex pivots; plan value 8,210.5 = dual bound 8,210.5.
Dual prices: each required show of Oppenhammer costs 12.1 expected tickets and of Gigantic 2.2 (valid for one show more or less).
MOCK: against the hidden demand 6,506 → 8,099 true expected tickets (+24.5%), 97.8% of an oracle that plans with the true demand (8,284).
Backtest on the records (learn from three weeks, predict the 105 screenings of the fourth; a sold-out screening counts only when predicted below its seats): selected 26.3%, pattern only 25.8%, own averages 28.6%, film averages 39.0% on this seed; over 40 histories the selection is best (28.9%, Section 4).

**Mock study (`src/study.cjs` in the repository, not part of the submission; its table is embedded in the demo's Compare section):** mean true expected tickets per week over 40 histories: sensible past - selected 8,125, rule of thumb 6,388, oracle 8,284 (selected reaches 98.1%); random past - selected 8,054, rule of thumb 6,655, oracle 8,284.
The study compares methods inside a world we built; it does not measure a real venue.

| Case | Inputs / reproduction steps | Expected result / pass criterion | Observed result and supported conclusion |
|---|---|---|---|
| Normal | Defaults, seed 437 (demo: Test cases → "Default week") | Plan found; 0 violations in both plans; certificate holds; proposed ≥ baseline on the planning value | Pass: 8,211 vs 7,570 expected tickets; 0 / 0 violations; 8,210.5 = 8,210.5 |
| Boundary | Add the new release *The Scavengers* (zero purchase rows), minimum 7 | Plan found; ≥ 7 shows; demand flagged as manager estimate (no records) | Pass: 32 shows, flagged "No records: manager estimate"; 0 violations in both plans |
| Boundary | Hall 3 closed next week (its past shows stay in the records) | Plan found with no screening in Hall 3; minimums met | Pass: 0 screenings in Hall 3; 6,119 vs 5,670 expected tickets |
| Boundary | Weeks of history = 1 | Plan found; backtest reported as not available instead of a misleading score | Pass: plan found, "Needs at least 2 weeks of records" |
| Failure | Hall 2 and Hall 3 closed (6 films x 7 minimum = 42 > 35 open slots) | No plan; names `one-film-per-hall`, the gap and a fix; earlier results stale | Pass: "Minimum shows add up to 42 but only 35 screen-slots are open (rule one-film-per-hall). Fix: reopen a hall, add show times, or lower minimums by 7 in total." |
| Failure | Slot length 170 min | No plan; names each film that no longer fits, `slot-fit`, the minutes needed and a fix | Pass: Avocado needs 177 min, Oppenhammer 173 min, Gigantic 180 min, each with a fix |
| Failure | Extra row `caterpillar-man,RIVERSIDE,2026-10-03,19:00,AC-00042,0` | No plan; line-specific validation message | Pass: "Extra row 1: passes_bought "0" must be a positive whole number of tickets." |

**Hand-checkable arithmetic (worked example, demo cell *Gigantic*, 10:00, Fri-Sun):** pattern 45.4 tickets; two screenings with exposure 2.1 and own average 19.4; with $k$ = 1 the posterior mean is $(1 \cdot 45.4 + 2.1 \cdot 19.4) / (1 + 2.1) = 27.9$, 67% from its own evidence; clicking that cell in the demo shows the same numbers.
The simplex result was also compared with brute-force enumeration on 150 random tiny instances (repository tests), and the certificate is checked on every run.

**Established:** the mechanism works end to end offline; settings change the history and the plan through the stated calculations; the plan is optimal for the stated formulation; rules and failures are handled; results reproduce; in fictional worlds with known demand the selected combination beats each simpler alternative on average where the past schedule was chosen sensibly.
Repository tests (13, `node --test`) cover the shared cases, determinism, the six-field records, settings-driven history, fictional titles, brute-force optimality, sold-out reading, caution, the backtest, extra rows, pins and a rule-abiding baseline.
**Not established:** any effect on real admissions, that real records behave like the generator, the right caution level for a real venue, the operator's real rules and current performance, planning-time savings.

## 6. Client Proposal

1. **Stage 0 · data audit (one venue).** The operator provides the high-priority requests of Section 3 and one interview with the programming manager; we report the data contract, sell-out share, zero-sale share, coverage of film-time combinations and week-to-week variability of admissions.
   *Continue* if a screening log with halls and seats exists and at least 8 recent weeks are usable `[PROPOSED]`; *otherwise stop* at demand analytics, or wait for the log.
2. **Stage 1 · offline replay.** Rebuild past weeks; backtest the estimate on held-out weeks against film and slot averages; the manager judges the tool's plans for operability.
   *Continue* if the estimate's error is at least 10% lower than the film-average error and the manager rates at least 8 of 10 replayed weeks operable with minor edits `[PROPOSED]`; *revise* once if not, then stop.
3. **Stage 2 · advisory trial.** Alternate weeks (switchback) between the manager's own plan and the tool-assisted plan at the same venue, excluding holiday weeks, with a capped number of flagged test screenings of untried combinations (exploration, Lec 4, pp. 20-29) whose results calibrate the caution level.
   *Adopt* if tool weeks beat own weeks on admissions per available seat by a margin agreed before the trial, with the interval above zero and no operational incidents; trial length follows from the variability measured in Stage 0 (TBD).

| Condition | When |
|---|---|
| Test | Stage 0 and Stage 1 gates pass; KPI and thresholds signed off by the sponsor before the first trial week |
| Adopt | Trial margin met; manager override rate below an agreed level; export stable for the whole trial |
| Revise | Frequent overrides (a missing rule such as staffing or distributor terms); flagged test screenings underperform (raise caution); estimate drifts (holidays, ageing) |
| Stop | No halls or seats obtainable; estimate not better than averages after one revision; trial shows no gain or a loss; the data contract keeps changing |

These real-world criteria are separate from the functional checks of Section 5.
Metrics: admissions per week and per available seat (primary), sell-outs and turned-away estimates, empty seats in large halls, test-screening results, weekly forecast error against film averages, override share and planning time.
Thresholds marked `[PROPOSED]` are our suggestion for the sponsor to accept or change; the trial margin and length are TBD because they depend on variability not yet seen.

**Responsibilities:** the head of programming sponsors and signs off the KPI, thresholds and each gate; the data owner provides exports and confirms the data contract; the programming manager gives the interview, enters weekly settings, judges replayed plans and runs the trial; the venue manager confirms halls, closures, grid and changeover; we deliver the audit report, the replay study, the tool, the trial analysis and a go / no-go recommendation.
**Cost, timeline and benefit:** not estimated yet; they depend on export speed and quality, which Stage 0 establishes, and a benefit can only be measured in Stage 2.
The +8.5% of the demo is a property of invented data and is not an estimate for the operator.

**Decision requested:** approve Stage 0 and Stage 1 at one venue, with a named sponsor and data contact, the six-field export for at least 8 recent weeks, the screening log with halls and hall seats, and one interview with the programming manager; not production use or a trial budget, which are decided at the Stage 1 gate.

## 7. LLM Review & Key Revisions

Tool: Claude Code with Claude Opus 5.5, in sessions on 2026-09-29 (v1), 2026-10-02 and 2026-10-05 (v2) and 2026-10-09 (v3, this version).
It read the brief and the lecture slides, role-played project-manager and client reviews, proposed methods, wrote the engine, UI, tests and the mock study, and checked consistency across the three files.
I set the direction, rejected or narrowed suggestions, and verified them as recorded below; LLM output was never used as evidence for an external fact.

| Discussion / purpose | LLM suggestion | My assessment and verification evidence | Final decision or revision; location in the deliverables |
|---|---|---|---|
| 1: Fictional vs real films (v2 → v3) | v2: plan six films currently in Korean cinemas, real titles and runtimes from press sources, invented demand | I reversed it in v3: the brief asks for an "entirely fictional dataset ... inventing its aliases and values" [A §2], and real titles invite reading invented sales as facts about real films. A test now asserts that no real title appears in the slate | Invented parody titles (*Caterpillar-Man*, *Avocado*, *Gigantic*, ...); the real-film citations were removed. Header, demo, proposal |
| 2: Method complexity (v1 → v2 → v3) | v1: EM imputation, min-cost flow, subgradient check; v2: negative-binomial MLE, a Gaussian-process prior with kernel search, Bayes on a grid with a censored likelihood, and per-step alternatives | v1 methods were rejected as not taught; in v3 I judged v2 over-engineered for the brief ("A justified simple method can receive full base credit" [A §1]; "complexity earns no credit by itself" [Ref §7]) and restricted methods to Lectures 0-4. Checked by re-running every alternative on 40 fictional histories in two worlds: the simpler Poisson-Gamma estimate with a pattern prior reaches 98.1% of an oracle and has the lowest backtest error | Pattern + Poisson-Gamma update + negative-binomial expected sales + robust LP (Sections 2, 4); GP listed as rejected approach E |
| 3: Caution level and pattern weight | Default caution 0.3 and $k$ = 2 as "moderate" values | Not accepted on intuition: the study showed caution 0.5 better than 0.3 (+100 ± 40 tickets) and $k$ = 1 better than 2 (+37 ± 21), and caution costs nothing when every combination was tried | Defaults $c$ = 0.5, $k$ = 1 (Sections 2, 4; demo Method settings) |
| 4: Information requests vs the six fields | v2 treated a screening log and hall seats as required inputs | Restricted: the mechanism must run on the six fields only, with halls and grid as labelled operating settings, and the operator must confirm the data contract. The demo was rebuilt so the generator follows the settings and the field-usage table shows what is used | "No additional record fields" and the data-contract request (Section 3); demo Records; proposal E4 |
| 5: Baseline robustness and backtest fairness (found by checks, v3) | The first v3 rule of thumb filled slots greedily; the first backtest scored only screenings not read as sold out | A sweep of 120 runs showed the baseline breaking a minimum in 59 of them once a new release joined; the backtest excluded exactly the high-demand screenings that the sold-out rule corrects. Fixed with a repair step and a censoring-aware error; a test now runs the baseline on 24 settings | Section 4 approach A; Section 5 backtest; demo |
| 6: Classification and baseline wording (v1, kept) | Classify `expected-tickets` as Formulation because the estimate only supplies a parameter; call the rule of thumb the operator's current practice | First accepted after checking [Ref §3]; second rejected because current practice is unspecified [A §2] | Section 2 component table; "proposed reference" in Sections 1, 4, demo and proposal |

Earlier LLM-assisted role-plays (a project-manager scope review and client questions such as "Will it suggest things we have never tried?" and "What happens if we cannot provide the schedule log?") shaped Sections 1, 3 and 6; they are working notes, not part of the submission.
