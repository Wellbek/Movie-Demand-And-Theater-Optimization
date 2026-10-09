# Problem Definition: Theater Optimization - Weekly Showtime Planning for One Venue

**IE437 Assignment 1 · Movie Programming - Problem Definition and Decision-Support Design**

Author / student ID or team: Louis Wellmeyer · 20264059  
Date / version: 2026-10-09 · v4.1  
Summary: The purchase records cannot support the whole programming decision, so the first step is narrower: for one venue and one week, assign already-booked films to halls and show-times as an advisory plan.
Demand per film, time and day type is estimated by a Poisson-Gamma Bayes update on a film x time x weekday pattern, and the week is planned as a cautious linear program next to two reference plans under the same inputs.
On fictional data and on its own estimate the plan reaches 7,385 expected tickets against 6,469 for a rule of thumb (+14.2%) and 7,009 for repeating last week (+5.4%); real-world effects are untested.  
Files: `problem-definition.md`, `demo.html`, `proposal.html`  
LLM tools and use: Claude Code with Claude Opus 5.5, 2026-09-29 to 2026-10-09 (reading the brief and lecture slides, role-played reviews, independent grading reviews, drafting, engine, UI and animation code, tests, the mock study, the robustness sweep, consistency checks); details and my own review in Section 7.

Citations: `[A §n]` = the assignment brief (`assignment.md`), section n; `[Ref §n]` = the classification reference; `Lec n, p. m` = IE437 lecture deck n (the five decks numbered 0-4 by the course), page m.
The modelling, estimation and decision methods come only from these five lectures; implementation details that the slides do not cover (the simplex algorithm and its pivot rules, the integrality argument for this constraint structure) are named where used.
Every number about the cinema is fictional and produced by `demo.html` with its default settings (seed 437); the venue is the alias `VENUE-01`, since the brief names no venue.
Labels: `[ASSUMPTION]` = our own operating rule or reading, not given in the brief and to be confirmed (the brief's own label); `[PROPOSED]` = a threshold we suggest for the sponsor to accept or change; `TBD` = unresolved.
Film titles are invented parodies (for example *Caterpillar-Man*, *Avocado*, *Gigantic*); no data of any real film is used, as the brief asks for an "entirely fictional dataset" with invented aliases [A §2].

**How this definition answers the brief's six questions [A §2]** (one line each; the argument is in the referenced section):

| The brief asks | Short answer | Where |
|---|---|---|
| "What problem should the company address first, and what is the scope of your proposal?" | The weekly allocation of already-booked films to halls and show-times at one venue, as an advisory plan; booking, pricing, several venues and mid-week changes are excluded. | §1 |
| "Who will use the results, and what decisions will they support?" | Whoever sets the venue's weekly schedule `[ASSUMPTION]`, before it is published: which film in which hall at each show-time; the programming lead uses trial results for go / no-go. | §1, §6 |
| "What can you establish from the available information, and what needs further investigation?" | Tickets per screening by film, time and weekday; not halls, seats, zero-sale screenings, prices, purchase times or current practice, so sell-outs and untried combinations hide demand. | §3 |
| "What additional information should you request, why do you need it, and what will you do if it is unavailable?" | Data-contract confirmation, a screening log with halls, hall seats and grid, the weekly slate with show commitments, the KPI, a practice interview; each with a priority and a fallback. | §3 table |
| "Which approach do you recommend, and how will you evaluate its validity and usefulness?" | Bayesian demand estimate + cautious weekly LP, beside a rule of thumb; validity by backtest, promised-vs-actual checks, rule and optimality checks and test cases; usefulness by offline replay and a randomised advisory trial. | §4, §5, §6 |
| "Under what conditions should the company test, adopt, revise, or stop the proposal?" | Gated stages with stated continue, revise and stop conditions; thresholds marked `[PROPOSED]` are to be agreed with the sponsor. | §6 |

## 1. Decision, Scope & Problem Structure

The operator wants to "use its records to understand its audience and improve movie-programming decisions", where movie programming means "choosing which movies to screen, in which screening rooms, and at what times" [A §1, §2].
Its practices, decision rules and current performance are not given [A §2]; who decides, how often and how far ahead are therefore assumptions to confirm in the practice interview (Section 3).

> The person who sets the venue's weekly schedule `[ASSUMPTION: role]` uses demand estimated from past purchase records, the venue's hall seats and the confirmed film slate, before next week's schedule is published `[ASSUMPTION: weekly cadence]`, to decide which film plays in which hall at each show-time, in order to increase expected admissions without breaking show commitments.

**Why the records are insufficient for the full programming decision.**
One row is one completed purchase for one screening [A §2].
The six fields therefore show what sold, never what could have sold:
1. There is no hall or capacity field, so a sold-out screening records its seats, not its demand, and the records cannot say which room a film used.
2. A screening that sold nothing leaves no row, so the record of what was shown is incomplete.
3. Only combinations someone chose to schedule are observed; a film never shown at 22:00 has no evidence for 22:00.
4. There is no price, cost, purchase time or film information (runtime, release, genre), so revenue, booking curves, mid-week reaction and new titles are outside what the records can inform.
5. Which films to book is decided before any record of them exists.

**Narrower first step and the decision it supports.**
The first step keeps the core of the programming decision (film, room, time) but only where the records plus a few weekly operating settings can carry it: one venue, one planning week (Mon-Sun), films already booked, a fixed show-time grid, decided once before sales open, as a draft that a person approves.
Rooms enter through hall seats entered each week (an operating rule, Section 3), not through the records.
The information plan in Sections 3 and 6 says what would extend it.

**Scope by priority (MoSCoW):**

| Priority | Content |
|---|---|
| Must have | One venue, one week, booked films; film x hall x show-time; one film per hall-time; no film in two halls at once; min / max shows; runtime + cleaning time fits the slot; demand learned from the six fields only; comparison with a baseline under the same inputs; advisory (pin, block, re-run, nothing published automatically) |
| Should have | Caution on untried combinations; optimality certificate; reasons and runner-up per cell; explained failures; a thin-evidence warning |
| Could have | Flagged test screenings of untried combinations (trial stage); revenue objective once prices exist; holiday calendar |
| Won't have now | Out of scope for step one; listed with their consequences below |

**Show times are fixed, with a configurable cleaning time.**
Every hall uses the same grid of start times each day, and a film may take a slot only if its runtime plus the cleaning time between two shows fits the slot (default 15 minutes, a setting).
Starting each hall as soon as it is clean ("whenever available") is excluded for three reasons: the records observe demand only at the grid times, so demand at other times would be pure extrapolation; regular start times are what audiences and staff work with `[ASSUMPTION]`; and variable start times turn the plan into an interval-scheduling integer program whose LP relaxation is no longer whole-numbered, so the optimality certificate would be lost.
The cost is idle hall minutes after short films, stated in the exclusions.

**Boundary:** one decision problem = the plan for one venue and one week: every hall x show-time x day of that week receives one film or stays empty.
In the demo: 3 halls x 5 show-times x 7 days = 105 screen-slots, 6 films (configurable), records of the 4 weeks to Sun 4 Oct 2026, plan for Mon 12 to Sun 18 Oct 2026; the week of 5 Oct is already published `[ASSUMPTION]`.

**Won't have now - out of scope (common in practice, left out of step one, and what that costs):**

| Excluded | Consequence |
|---|---|
| Film booking and run length (upstream decision `[ASSUMPTION]`) | The slate and per-film show limits are inputs; the tool cannot say which films to acquire. |
| Pricing, concessions, revenue | The objective is admissions; a ticket is not all margin, so the KPI must be confirmed (Section 3). |
| Several venues | Sister venues sharing one audience are treated as independent. |
| Mid-week changes | The plan cannot react to a flop inside the week; that would need purchase times and a feedback design. |
| Holidays, school calendar, local events, film ageing, weather | Not in the records; holiday and opening weeks should be left out of the trial. |
| A film in two halls at the same time; after-midnight shows | Not supported; such cells must be pinned by hand. |
| Flexible start times (a show whenever a hall is free) | Idle hall minutes after short films; the reason for fixed times is given above. |
| External demand signals (social-media buzz and audience retention such as trailer watch-through, reviews, search trends, other cinemas' sales, national box office, pre-sales) | Could improve accuracy (Section 3) but are not in the records, need data agreements, and their link to one venue is unproven. |
| Location (proximity of other cinemas, catchment and travel time, competitor schedules and openings) | Competing venues are invisible; one venue and no location data in step one. |
| Premium formats (large-screen, 3D), dubbed vs subtitled versions, accessible screenings; event cinema and private hire | No format or version field; different demand and contracts. |
| Staff and cleaning rosters, projection maintenance; personalised offers via loyalty accounts | Operational data not given; `account_tag` is not used and would need a privacy review. |

**Current practice vs baseline:** current practice is unknown [A §2].
The baseline is a rule of thumb defined in Section 4 (approach A), labelled a proposed reference, not the operator's process.

**Decisions:**

| ID | What is chosen | Who uses / approves |
|---|---|---|
| `weekly-plan` | Film (or none) for every hall x show-time x day of the planning week | The weekly scheduler `[ASSUMPTION]` reviews, may pin or block cells, approves before publication |

Dependencies: none inside the boundary.
The upstream dependency `film-booking → weekly-plan: feasible region (available films, show limits)` `[ASSUMPTION]` lies outside the boundary and enters only as input.
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

**Inputs and settings** (operating rules, entered weekly; demo defaults are fictional `[ASSUMPTION]`): halls with seats (220 / 120 / 60) and whether each is open next week; show-time grid (first show 10:00, 5 shows per hall per day, 180-minute slots, 15 minutes cleaning time, so shows at 10:00, 13:00, 16:00, 19:00, 22:00); the slate with runtimes and min / max shows per film (default minimum 7, no maximum); pinned or blocked cells; caution $c$ = 0.5; pattern weight $k$ = 4 (both tuned in the mock study, Section 4); a family-film mark per film on the slate `[ASSUMPTION]`.
Inputs from the records: tickets per screening, derived in Section 3.

**Objective:** maximise expected admissions in the planning week.
The computed metric is expected tickets under the demand estimate; the business outcome it supports is actual admissions, which only a trial can measure (Section 6).
The optimiser maximises a cautious version of it (the planning value below); the uncautioned expected tickets are reported beside it.
There is one objective, so no priority rule between objectives is needed.

**Supporting analysis (not a component): the demand estimate.**
It supplies the parameters of the components below, which remain explicit formulas [Ref §3, "ML Usage ≠ Data-driven Evaluation"].
1. *Pattern by maximum likelihood* (Lec 2, p. 24): $P_{fsd} = F_f \cdot S_{g(f),s} \cdot D_d$ (film strength x time-of-day index of the film's audience group $g$, family films or all others, x weekday index) maximises the Poisson likelihood of all screening totals; it is computed by repeating "each factor = observed / expected tickets over its rows" until stable, with each $S_g$ and $D$ scaled to average 1.
   It gives every film x time x day an estimate, including combinations never screened; a group never screened at a time takes the index of its nearest screened time (the lower one on a tie), a cautious extrapolation.
   Without the group index, untried late shows of family films inherited the evening peak of all other films and were estimated at four to five times their (mock) true demand.
2. *Bayes update per cell* (Lec 2, Example 2.1, p. 20; posterior as a weighted average, pp. 16, 22): for film $f$, show-time $s$ and day type $t$ (Mon-Thu, Fri-Sun `[ASSUMPTION]`), demand rate $\theta \sim \text{Gamma}(kP, k)$ with mean $P$ = the pattern, worth $k$ screenings; screenings are Poisson with exposure $w_i = D_{d_i}/\bar D_t$ (the weekday's share inside its day type); posterior $\text{Gamma}(kP + \sum y_i,\ k + \sum w_i)$ with mean $\frac{k}{k+\sum w_i} P + \frac{\sum w_i}{k + \sum w_i} \bar y$, where $\bar y = \sum y_i / \sum w_i$.
3. *Screening-to-screening spread* (Lec 2, MLE, p. 24): a negative-binomial shape $r$ is fitted by maximum likelihood over the screenings not read as sold out, each compared with its cell's estimate without itself (default data: $r$ = 7).
4. *Prediction* (Lec 2, "integrate, don't plug in", p. 31; the negative binomial as the Poisson-Gamma predictive, p. 32): the demand of one screening has mean $\mu = \mathbb{E}[\theta \mid y]\, w_d$ and variance $\mu + \mu^2/r + w_d^2\, \text{Var}(\theta \mid y)$ (Poisson count, screening spread, estimation uncertainty), represented by a negative binomial with that mean and variance.
5. *Sold-out screenings:* records carry no hall, so a total equal to one of the venue's hall sizes is read as a sell-out `[ASSUMPTION]`; such totals are lower bounds of demand and are flagged.
   They enter as recorded: an "at least the seats" correction (replacing them by the pattern when higher) was tested and did not improve plans (Section 4), so the exact fix is the screening log (Section 3).
6. *Films without records:* $F_f$ = a manual strength (default 1.3 for a new release, 1 otherwise) x the average film.
   A new release (it opens in the planning week) is flagged as a manual estimate and planned without the caution discount (Section 4 shows that discounting it starves new films of shows).
   A film that was available but never scheduled has no records for a reason, so it is cautioned like any untried combination; the robustness sweep of Section 5 found that exempting it let the optimiser fill thin weeks with it.

| Component ID | Decision ID | Role: Cost / Constraint / State-transition | Model: Formulation / Simulation / Data-driven | Definition, units, and evidence / assumption / unknown |
|---|---|---|---|---|
| `expected-tickets` | `weekly-plan` | Cost (maximise) | Formulation | $\sum x_{fhds}\, v_{fhds}$ in tickets, $v_{fhds} = \mathbb{E}[\min(D_{fsd}, \text{seats}_h)]$ under the predictive of step 4. For planning the value is $\mathbb{E}[\min(D', \text{seats}_h)]$, where $D'$ has the same negative-binomial shape and mean $\mu\,(1 - c\cdot k/(k+\sum w_i))$: the demand mean is lowered in proportion to the share of the estimate that comes from the pattern (1 for an untried combination), the worst case of a box around each value; new releases are exempt and flagged. With an epigraph variable the objective becomes a robust constraint, and with $x \ge 0$ the worst case is the lower corner, so the problem stays a linear program (robust LP, Lec 1, p. 25; epigraph, p. 18). The evaluation metric reported in Section 5 is the same sum with $c = 0$. |
| `one-film-per-hall` | `weekly-plan` | Constraint | Formulation | $\sum_f x_{fhds} \le 1$ for every open hall-time; closed halls and blocked cells have no variables. Hard. |
| `no-self-clash` | `weekly-plan` | Constraint | Formulation | $\sum_h x_{fhds} \le 1$: a film never plays in two halls at the same time. Hard. It also keeps the records interpretable, since two such screenings would share one `title_tag` + `venue_tag` + `play_day` + `curtain_time` key [A §2]. |
| `show-limits` | `weekly-plan` | Constraint | Formulation | $\min_f \le \sum_{h,d,s} x_{fhds} \le \max_f$. Hard. `[ASSUMPTION]` stands in for distributor and house rules (TBD, Section 3). |
| `slot-fit` | `weekly-plan` | Constraint | Formulation | $x_{fhds} = 0$ if runtime$_f$ + cleaning time > slot length. Hard. |

No State-transition component exists (Section 1).
Why `expected-tickets` is Formulation and not Data-driven: its value is an explicit formula (expected sales capped by seats, summed over the plan) whose parameters, the demand means and spread, come from the supporting estimate; the reference classifies exactly this case as Formulation ("ML Usage ≠ Data-driven Evaluation" [Ref §3]). A learned estimate does enter the cost through those parameters, so its validity is checked separately (backtest, Section 5) rather than hidden in the label.
Pinned cells are fixed before solving: their hall-time and film-time leave the problem and the film's limits shrink by one.

**Hard constraints vs preferences:** all rules are hard; there are no soft constraints or penalties.
Caution is part of how the objective values thin evidence, not a constraint.

**Invalid or infeasible input:** malformed settings or purchase rows block the run with a field- or line-specific message (for example a non-positive `passes_bought`, an invalid date, a `curtain_time` that is not on the grid, a screening with more tickets than the largest hall, more simultaneous screenings than halls, a grid whose last show starts after midnight, an empty setting).
If the rules cannot all be met, a pre-check names the violated rule, the gap and a fix (for example "Minimum shows add up to 42 but only 35 screen-slots are open"); no plan is shown and earlier results are marked stale.
Rows for another `venue_tag`, for titles not on the slate, or outside the history window are set aside with a note, not silently dropped.
Empty hall-times are allowed (value 0).

**Follow-up questions [Ref §5].**
*Formulation:* variables, objective, hard constraints, parameters and infeasible-input handling are above.
The 0/1 requirement is relaxed to $x \ge 0$; an LP optimum sits at a vertex (Lec 1, p. 16), and here every vertex is whole-numbered because every coefficient is 0 or 1 and the hall-time rows and the film rows (film-time rows nested inside each film's total) form two nested families, a standard LP result that the slides do not cover.
The tool solves the LP with the simplex method, checks integrality on every run and refuses a fractional plan.
Optimality is certified on every run by LP duality: the dual bound equals the planning value and every reduced cost is $\le 0$ (KKT and duality, Lec 1, pp. 37-42); the certificate applies to the planning value (caution applied), not to the uncautioned metric.
*Data-driven:* N/A - no evaluation component is learned; the estimate only supplies parameters.
Its data questions (coverage, bias, validation) are answered in Section 3 and its backtest in Section 5.
*Simulation:* N/A - the fictional generator creates data and scores the mock checks but is not part of the evaluation of a plan.
*Stateful, Feedback, Hierarchical:* N/A for this boundary (Section 1).

## 3. Information & Uncertainty

**Unit of record:** one completed purchase for one screening; date and time describe the screening, not the purchase [A §2].
**Unit of analysis:** the screening, identified by `title_tag` + `venue_tag` + `play_day` + `curtain_time`; its tickets $y_i$ are the sum of `passes_bought` over its rows.
**Transformations:** rows of the planned venue only; `curtain_time` mapped to a slot of the grid; `play_day` mapped to weekday and day type; aliases mapped to the slate (title, runtime).
**Quality checks:** six fields per row, valid date and 24-hour time, positive whole `passes_bought`, non-empty aliases, times on the grid, screening totals not above the largest hall, not more simultaneous screenings than halls; set-aside rows are counted and reported.
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

**Established from the records:** tickets per observed screening, their pattern by film, time and weekday, their screening-to-screening spread, and how often totals hit a hall size.
**Not established:** halls, seats, zero-sale screenings, prices, purchase times, film attributes, current practice, dataset size, period and quality [A §2]; Section 1 lists the consequences.
Rows of titles not on next week's slate are set aside although they could sharpen the time-of-day and weekday indices; using them is a possible refinement.
Film runtimes, ratings and the family-film mark come from the weekly slate, not from the records; all of them are invented for the demo.

**No additional record fields.**
The brief says: "Label any additional fields or operating rules as your own assumptions" [A §2].
The mechanism needs no additional record fields: it runs on the six teaching fields.
What the business has not given is not assumed unless it is stated and tagged `[ASSUMPTION]`; the only such items are the weekly operating settings of Section 2 (halls and seats, grid, runtimes, show limits, the family-film mark) and the interpretation rules marked in Sections 1-2.
Because everything rests on this format, the operator must confirm that the six-field specification is the fixed and complete export (first request below): renamed or removed fields, a changed meaning (for example purchase time instead of screening time) or pre-aggregated rows would make validation reject the file or, worse, silently degrade the estimates.

**Gap: there is no real dataset.**
The brief gives a record specification, not a dataset, and asks for a small, entirely fictional one [A §2].
The demo therefore generates the history from its settings (halls, seats, show-time grid, number of films, weeks of history, seed), so changing a setting changes the records (14,165 purchase rows for 420 screenings, 7 Sep to 4 Oct 2026, by default).
Halls, seats and grid describe the venue, so they shape both the history and the plan; a change for next week only is tested with a hall's "open" switch or with pins.
It uses two distributions:
1. *Demand per screening:* negative binomial with mean = film strength x time-of-day shape of the film's profile (family, action, drama or general; four shapes, while the estimate only distinguishes family from other films) x weekday factor (all invented) and dispersion $r$ = 6; sales = min(demand, seats).
   We use it because ticket buyers form a count (Poisson) whose rate varies from screening to screening (a Gamma mixture), which is exactly the negative binomial (Lec 2, pp. 19-20, 32).
   The planner assumes the same family for the screening spread but never sees the generator's $r$; it estimates $r$ from the records (7 by default).
2. *Tickets per purchase:* categorical 1-6 with shares 30%, 45%, 10%, 10%, 3%, 2% (invented); each screening's sales are split into purchases with it.

The past schedule inside the history is chosen by a fictional scheduler who knows roughly what sells (log-normal judgement noise, setting "past scheduler noise"), so some combinations are never tried, as in real records.
Demand could be predicted more accurately with real records of the venue and, beyond the six fields, with sales of other cinemas showing the same film, each film's national box-office success, pre-sales and booking curves, social-media reach and audience retention (trailer views, mentions), review scores, the release and holiday calendar, weather, competitor schedules and marketing spend.
These are out of scope for the first step because none is in the records, each needs a separate collection agreement, and their link to one venue's admissions is unproven; we simplify with the generator above, whose parameters are visible and adjustable in the demo.
Results on generated data show that the mechanism works; they do not show that real records behave like the generator.

| Fact / assumption / unknown or request | Evidence or reason for current treatment | Why it matters | How to confirm or obtain it; priority | Fallback or limit until confirmed |
|---|---|---|---|---|
| Request: confirm the six-field export is the fixed, complete data contract (names, meaning, one row per completed purchase) | The tool reads only these fields [A §2] | Parser, checks and estimates depend on it | Data owner, written confirmation in Stage 0; **high** | Validation rejects non-conforming files; adapt the parser before any analysis |
| Request: screening log (every scheduled screening with hall, including zero sales) | Not in the specification [A §2] | Exact sell-outs, vanished screenings, hall effects | Operator's scheduling system export; **high** (strongly preferred, not a hard gate) | Continue with sell-outs flagged from totals equal to a hall size `[ASSUMPTION]`; vanished screenings stay a stated upward bias for weak slots |
| Request: hall seats, show-time grid, cleaning time | Not in the specification | Feasibility (`slot-fit`), value of large vs small halls | Venue staff; **high** (gate) | Entered weekly, as in the demo; with no hall information at all the tool stops at demand analytics |
| Request: weekly slate with runtimes and min / max show commitments | Contract terms unknown | Hard rules (`show-limits`, `slot-fit`) | Weekly scheduler, distributor terms; **high** | Entered weekly; minimum 0 if unknown, and the plan is labelled advisory |
| Request: KPI - admissions or revenue (price, film rental share) | No price field; the objective could be wrong | Wrong objective, wrong plan | Sponsor decision in Stage 0; **high** | Admissions |
| Request: one interview on current practice, roles, cadence and publication lead time | Practice unknown [A §2] | A fair baseline, missing rules, confirms the assumed role, weekly cadence and Open-loop basis | Weekly scheduler; **high** | Stated rule of thumb as reference; role, cadence and lead time stay `[ASSUMPTION]` / TBD |
| Request: at least 8 recent weeks of rows `[PROPOSED]`; release dates and holiday calendar | History length unknown; the demo history contains no holidays | Backtest, stability, holiday flags, film ageing | Data owner, public calendar; **medium** | Shorter history: the same caution discounts more by itself (more of each estimate is pattern); holiday weeks excluded |
| Request: privacy basis for using `account_tag` | Account-level data may be personal data | Any later audience analysis | Operator's privacy function; **medium** | Not used, as now |
| Request: purchase time and price | Not in the specification | Booking curves, revenue, mid-week reaction (later stages) | Ticketing export; **low** | Weekly plan, admissions only |
| `[ASSUMPTION]` a screening total equal to a hall size is a sell-out | Records carry no hall | Flags lower-bound evidence | Screening log (above) | A screening that sells exactly a hall size without selling out is misread (rare); the demo flags 120 of 420 screenings (29%) |
| `[ASSUMPTION]` demand of a film-time is stable over the history window, screenings are independent, one spread $r$ fits all films | Keeps the estimate simple and the objective separable | Opening weeks, ageing, holidays and similar films competing break it | Backtest on held-out weeks; `account_tag` overlap; release dates | Weekly backtest in Stage 1; limitation stated |
| `[ASSUMPTION]` Mon-Thu and Fri-Sun as day types, with a weekday index inside each | Enough evidence per cell from a few weeks | Friday may behave differently from Saturday | Backtest by weekday in Stage 1 | Weekday index keeps the per-day level |
| TBD: refunds, walk-up sales without account, the `play_day` of after-midnight shows | The brief says "completed purchase" only [A §2] | Demand and day-type bias | Data owner; medium | Document and exclude ambiguous rows; after-midnight shows are excluded |

**Main uncertainties, how they are examined, and when not to trust the plan.**
The records are censored by capacity and selected by past choices, so the data are thinnest exactly where an optimiser looks for gains: estimates for untried combinations are extrapolations of the pattern, and an optimiser seeks out the most optimistic ones ("the optimiser will exploit the surrogate wherever it is wrong", Lec 0, p. 25; illustrated in Lec 1, p. 31).
This is the most important feature of the problem.
In the default demo week the rule of thumb's 14 untried screenings are estimated at 688 tickets but would truly sell 268 (MOCK); at the same time sold-out totals make the estimate cautious where demand is high (the selected plan promises 7,385 and would truly sell 8,233).
The response is fourfold: a time index per audience group keeps family films out of the evening peak, the cautious value discounts the pattern part of every estimate (Section 2), sold-out evidence is flagged and the screening log is requested, and the trial deliberately tests a capped number of untried combinations to learn what the records cannot show (Section 6).
Their effect was examined in a mock study in four worlds (Section 4): with a new release in the slate, a plan without caution sells 161 ± 22 fewer true expected tickets per week, while where combinations were untried only by chance, full caution would lose 324 ± 52.
The recommendation should not be trusted when most of a plan relies on untried combinations or on a new release (the demo warns when this share exceeds 40%), when no hall information exists, in holiday or opening weeks, or when any exclusion of Section 1 is active.

## 4. Alternatives & Selected Approach

Methods were chosen by the course's criteria (Lec 0, pp. 10-12): the decision model is known and linear, it is one static decision per week, and demand must be learned from a fixed log.
That points to linear programming with a robust value and duality (Lec 1) for the decision, and Bayesian estimation with maximum likelihood (Lec 2) for demand; Lecture 4 supplies the later exploration stage.

| Approach | Mechanism and required information | Strengths, limitations, and effort | Selection and reason |
|---|---|---|---|
| A: Rule of thumb | Score = last history week's tickets per screening; shows in proportion to the score within min / max; fill the best-selling day-times first (by average tickets in the records), biggest hall first, with the highest-scoring film that has shows left, fits the slot and is not on elsewhere at that time; a film stranded below its minimum takes the least attractive show of a film above its minimum; leftover empty slots go to the best free film | Already optimises, but greedily: each cell gets the locally best choice and is never revisited, so a slot used early cannot go to a better match later; transparent, uses only the records; blind to each film's time-of-day fit; low effort | Baseline, labelled a proposed reference |
| B: Demand report only | Tables of tickets by film and time; the plan is made by hand | Simple; produces no plan, so the decision stays unsupported, and untried times stay invisible | Rejected for the first step; its tables are part of the demo |
| C: Plain averages + LP | Cell or film averages feed the same LP | Simple; no use of the pattern for thin or untried cells; mock study: own averages −569 ± 60, film averages −1,206 ± 110 tickets per week vs the selection | Rejected |
| D: Bayes estimate + cautious LP | Section 2: pattern by MLE with a time index per audience group, Poisson-Gamma update, fitted spread, negative-binomial expected sales, cautious value, LP with duality check | Exact for the stated formulation; certificate on every run; honest about thin data; assumes separable demand | **Selected** |
| A2: Repeat last week (second reference) | Same films at the same weekday and time as in the last recorded week, the best-selling one in the largest hall, then the minimums met with A's repair step | Uses only the records; inherits last week's good and bad choices; cannot place a new release well | Second reference plan |
| E: Gaussian-process prior or Bayesian optimisation (Lec 4) | GP over film x time cells (the v2 design), or trying whole schedules on the real venue with an acquisition function | GP: more hyperparameters and harder to explain for the same purpose; BO: each query is a real week and a schedule has hundreds of variables | Rejected for the first step on simplicity; the GP was not re-run in v3 (Section 7, discussion 2) |
| F: Test-and-learn (bandit, Lec 4) | Spend a few shows per week on untried combinations and update from sales | Learns what the records cannot; turns the problem into Feedback and needs weekly data flow | Stage 2+ add-on (Section 6) |

**Choices inside the selected approach.**
Protocol: the defaults ($c$, $k$) were tuned jointly on fictional histories with seeds 1-40 (grid $c \in \lbrace 0, 0.25, 0.5, 0.75, 1 \rbrace$, $k \in \lbrace 0.5, 1, 2, 4 \rbrace$, rule: best mean true expected tickets averaged over the worlds), and every figure below is reported on separate seeds 41-80, as true expected tickets per week and the paired difference to the selection with a 95% interval.
Worlds: "sensible" = the default generator (the past scheduler knew roughly what sells; 87% of combinations tried); "random" = past schedule close to random (all tried); "sparse" = random past schedule with one week of records (90% tried, untried only by chance); "new release" = sensible plus a film without records (74% tried).

| Part | Options | Evidence (seeds 41-80) | Decision |
|---|---|---|---|
| Estimate | film average; own cell average; pattern only; pattern + Bayes update | Sensible: −1,219 ± 102; −594 ± 58; −149 ± 25; selected. New release: −998 ± 121; −564 ± 39; −279 ± 33; selected. Backtest error (WAPE, sensible): 38.6%, 29.6%, 29.4%, **28.5%** | Pattern + Bayes update |
| Sold-out totals | as recorded; "at least the seats" correction | Correction: +13 ± 11 (sensible), +59 ± 20 (random), +12 ± 24 (sparse), −6 ± 13 (new release): a gain in one world only | As recorded and flagged, for simplicity; screening log requested |
| Pattern weight $k$ | 1, 2, 4, 8 | Sensible: −18 ± 10, −12 ± 9, selected, +2 ± 8; sparse: −94 ± 31, −35 ± 20, selected, −2 ± 19; new release: −100 ± 24, −56 ± 19, selected, −11 ± 22 | $k$ = 4 (tuned; flat beyond) |
| Caution $c$ | 0, 0.25, 0.5, 0.75, 1 | New release: −161 ± 22, −65 ± 16, selected, −5 ± 19, −33 ± 24. Sparse: +6 ± 33, +14 ± 23, selected, −90 ± 28, −324 ± 52. Sensible: −17 ± 9 for $c$ = 0, within ± 8 for the others | $c$ = 0.5, the balance |
| Caution on new releases | exempt; discounted like untried cells | New release: discounting the new film loses 523 ± 21 (it then gets only its minimum of 7 shows) | Exempt, flagged as a manual estimate |
| Solver | enumeration; greedy fill; LP | Enumeration: about $7^{105}$ weeks; greedy cannot trade one slot against another and gives no proof (it is the baseline); LP: exact for the formulation with a certificate | LP |

The selected approach beats repeating last week by 497 ± 38 and a simulated experienced scheduler (the fictional past scheduler, who knows the true demand up to judgement noise) by 624 ± 45 tickets per week in the sensible world, and reaches 99.0% (sensible) and 98.0% (new release) of an oracle that plans with the true demand; these benchmarks exist only in the mock world, whose demand has a related multiplicative structure, so they favour any model of that shape.

**Selected flow:** validate settings and rows → sum purchases per screening → flag sell-outs → fit the pattern → Bayes update per cell → fit the spread → expected sales per (film, hall, time) with the cautious value → LP → integrality and duality checks → the two reference plans on the same inputs → score all with the same function and the same rules.
**Tie-breaking and randomness:** the simplex uses fixed pivot rules (largest gain first, Bland's rule after a run of degenerate pivots), so equal-value plans are always broken the same way; randomness exists only in the fictional generator, through a seeded generator.
**Actual calculations:** everything above runs live in `demo.html`, including the mock study and a brute-force check of the optimiser on demand.
**Mock:** the hidden demand of the generator and the simulated scheduler, used only by the panels marked MOCK and by the study.
**Methods outside the lectures, named as such:** the simplex algorithm, the integrality argument, the iterative computation of the maximum-likelihood factors, moment matching of the predictive, WAPE as backtest metric and the switchback trial design are standard tools used to implement or evaluate the lecture methods.
**Not implemented:** approaches B, E and F as features, every item of the won't-have list in Section 1, and the exploration policy.
**Optimality claim:** the plan is optimal for the stated formulation and estimates on the planning value; it is not optimal with respect to anything the formulation omits, and its value is only as good as the estimates.

## 5. Demonstration & Evaluation

**How to use `demo.html`:** open it in a desktop browser (no server, internet or installation); it generates the fictional history from the default settings and runs once.
1. *Settings:* halls (seats, open next week), show-time grid with cleaning time, slate and min / max shows, a new release, caution and $k$, generator settings (seed, weeks of history, dispersion, past scheduler noise), and optional extra purchase rows in the six-field format.
2. *Run:* records (first 200 rows, CSV download, field-usage table, data-gap and data-contract notes) → demand map per film, time and day type (click a cell for prior, own evidence and posterior with checkable arithmetic) → both plans side by side per day or as a week overview (click a cell for the ranked alternatives, then pin or block it, which re-runs) → comparison: the greedy baseline explained, a week-at-the-cinema animation of both plans with a cumulative-tickets chart and a step control, certificate, rule prices, backtest, the robustness sweep and mock scoring, with buttons that re-run the 40-history study and a brute-force optimality check in the browser → "How it works": one animated figure per step, drawn from the current run (purchase sums, maximum-likelihood passes, Gamma prior to posterior with its weighted-average bar, predictive demand against each hall size, caution, a two-variable slice of the real LP, simplex value against the dual bound).
   Each film card shows its expected tickets gained or lost against the baseline.
   The "Run plan" button runs, jumps to the comparison and plays the week at the cinema: on a running clock the doors open, people walk in and sit, the lights dim during the film, the audience leaves, and people turned away by a full hall walk back out; a slider and a step field move through the 35 show-times while a small chart shows both plans' tickets so far.
   Each "How it works" figure is a narrated sequence (step counter, pause button) drawn from the current run.
   A "Randomize" button draws venue, grid, cleaning time, slate, minimums, history and generator settings at random (keeping caution and $k$) and runs again.
3. *Modify and repeat:* change a setting, press Run; while settings differ from the last run the results are dimmed and the headline says so, and when the rules cannot be met no plan is shown, with an explanation (the headline is replaced and older results are dimmed and labelled stale).
Settings live only in the page (the address stays clean, and a reload starts from the defaults); "Reset to defaults" restores them; identical settings give an identical plan.
Checked offline in Chromium (Playwright with network disabled: no requests, no console errors, no horizontal overflow at 1440, 1024 and 390 px; all seven test cases pass in the page; every animated figure draws and narrates; "Run plan" jumps to the comparison and plays; "Randomize" produces a valid run; the step field moves the cinema animation; the deck's controls appear on mouse movement and hide when idle) and in Firefox 149 (headless render of both files).
The core behaviour maps to Section 2: `expected-tickets` is the score shown per cell and per plan, and the four constraints are checked for both plans.

**Baseline, metrics, conditions:** approach A (and the second reference A2 in the comparison) and the selected approach use the same settings, records, estimate and expected-sales function, and are checked against the same rules.
Primary metric: expected tickets per week (caution 0).
Secondary: untried combinations used, expected turned-away demand, expected empty seats, rule violations, the planning value (caution applied).
Separate from the information used to decide, the MOCK panels score both plans against the generator's hidden demand, which real records never reveal.

**Default result (fictional, on the tool's own estimate):** optimised plan 7,385 vs rule of thumb 6,469 expected tickets (+916, +14.2%) and vs repeating last week 7,009 (+5.4%); untried combinations 0 vs 14; expected empty seats 6,615 vs 7,531; 0 rule violations.
An optimiser scored on its own estimate always looks good, which is why the mock scoring and the trial exist.
LP: 630 variables, 321 rules (105 hall-times, 210 film-times, 6 minimums), 438 simplex pivots; planning value 6,552.2 = dual bound 6,552.2.
Rule costs, re-solved: one more required show of Oppenhammer costs 12.7 expected tickets and one fewer gains 6.9; for Gigantic 5.9 and 0.0 (the LP is degenerate, so its dual prices hold in one direction only and are not quoted as costs).
MOCK: against the hidden demand 6,506 → 8,233 true expected tickets (+1,727, +26.5%), 99.4% of an oracle that plans with the true demand (8,284); repeating last week reaches 7,751 and the simulated scheduler 7,617.
The gap is larger under the hidden demand than under the estimate because the rule of thumb's 14 untried screenings are estimated at 688 tickets but truly sell 268, while the selected plan's estimate is cautious (7,385 promised, 8,233 true) since sold-out totals cap the evidence.
Backtest on the records (learn from three weeks, predict the 105 screenings of the fourth; a sold-out screening counts only when predicted below its seats): selected 27.7%, pattern only 27.2%, own averages 28.6%, film averages 39.0% on this seed; over 40 histories the selection is best (28.5%, Section 4).

**Mock study (`src/study.cjs` and `src/tune.cjs` in the repository; the reported study also runs in the demo's Compare section):** mean true expected tickets per week, seeds 41-80: sensible past - selected 8,198, repeat last week 7,701, simulated scheduler 7,574, rule of thumb 6,494, oracle 8,284 (99.0%); random past - selected 8,097, oracle 8,284; sparse - selected 7,953; new release - selected 8,746, oracle 8,922 (98.0%).
The study compares methods inside a world we built; it does not measure a real venue.

| Case | Inputs / reproduction steps | Expected result / pass criterion | Observed result and supported conclusion |
|---|---|---|---|
| Normal | Defaults, seed 437 (demo: Test cases → "Default week") | Plan found; 0 violations in both plans; duality certificate holds | Pass: 7,385 vs 6,469 expected tickets; 0 / 0 violations; 6,552.2 = 6,552.2 |
| Boundary | Add the new release *The Scavengers* (zero purchase rows), minimum 7 | Plan found; ≥ 7 shows; demand flagged as a manual estimate (no records) and planned without the caution discount (checked) | Pass: 35 shows (one per show-time), flagged as a manual estimate (no records); 0 violations in both plans |
| Boundary | Hall 3 closed next week (its past shows stay in the records) | Plan found with no screening in Hall 3; minimums met | Pass: 0 screenings in Hall 3; 5,503 vs 4,682 expected tickets |
| Boundary | Weeks of history = 1 | Plan found; backtest reported as not available instead of a misleading score | Pass: plan found, "Needs at least 2 weeks of records" |
| Failure | Hall 2 and Hall 3 closed (6 films x 7 minimum = 42 > 35 open slots) | No plan; names `one-film-per-hall`, the gap and a fix; earlier results stale | Pass: "Minimum shows add up to 42 but only 35 screen-slots are open (rule one-film-per-hall). Fix: reopen a hall, add show times, or lower minimums by 7 in total." |
| Failure | Slot length 170 min | No plan; names each film that no longer fits, `slot-fit`, the minutes needed and a fix | Pass: Avocado needs 177 min, Oppenhammer 173 min, Gigantic 180 min, each with a fix |
| Failure | Extra row `caterpillar-man,VENUE-01,2026-10-03,19:00,AC-00042,0` | No plan; line-specific validation message | Pass: "Extra row 1: passes_bought "0" must be a positive whole number of tickets." |

**Hand-checkable arithmetic (worked example, demo cell *Gigantic*, 10:00, Fri-Sun):** pattern $P$ = 42.16 tickets; two screenings sold 40 tickets with exposure $\sum w$ = 2.04 (own average 19.61); with $k$ = 4 the posterior mean is $(4 \cdot 42.16 + 40) / (4 + 2.04) = 208.64 / 6.04 = 34.54$, of which 34% comes from its own evidence; clicking that cell in the demo shows the same figures.
The simplex result was also compared with brute-force enumeration of every whole schedule on random one-day instances (up to 2 show-times, 2 halls and 3 films; repository tests and the demo's brute-force button), and the certificate is checked on every run.

**Robustness sweep (is the combination always better than the baseline?).**
`src/sweep.cjs` draws 300 random configurations (1-4 halls of 40-300 seats, 3-6 show-times, slot length, cleaning time 0-30 minutes, 3-8 films with or without a new release, random minimum shows, 1-8 weeks of history, demand spread, past-scheduler noise) and compares the selected plan with the baseline in each; all 300 are feasible.
Planning value: the selected plan is never below the baseline (300 of 300), which is guaranteed because the baseline is one feasible week and the LP returns the best one.
Expected tickets on the tool's estimate: 297 of 300.
Hidden true demand (MOCK): 289 of 300, mean gain +12.9%; 8 losses are within 1.5%, and the 3 larger ones (worst −16.4%) are single-hall venues or plans that rest mostly on untried combinations or a new release, all with one or two weeks of records.
"Always better" against unknown demand cannot be guaranteed by any method, so the demo instead warns when more than 40% of a plan's expected tickets rest on untried combinations or a new release; the warning covers the two largest losses and never fires on the default week.
The first sweep also exposed a flaw that the fixed-seed study could not: a film on the slate that the past schedule never showed was valued as an average film and exempt from caution, and on thin records the optimiser filled the week with it; such films are now cautioned (Section 2), which raised the share of configurations won from 285 to 289 of 300 without changing any study figure.
With caution and $k$ also drawn at random the result is similar (286 of 300).

**Established:** the mechanism works end to end offline; settings change the history and the plan through the stated calculations; the plan is optimal for the stated formulation; rules and failures are handled; results reproduce; in fictional worlds with known demand the selected combination beats each simpler alternative, repeating last week and a simulated experienced scheduler on average, including with a new release.
Repository tests (18, `node --test`) cover the shared cases, determinism, the six-field records, settings-driven history, fictional titles, brute-force optimality, sold-out flagging, the cautious value, the fitted spread, the backtest, extra rows, pins, re-solved rule costs, rule-abiding reference plans, cautioning of never-scheduled films and an 80-configuration sweep.
**Not established:** any effect on real admissions, that real records behave like the generator, the right caution level for a real venue, the operator's real rules and current performance, planning-time savings.

## 6. Client Proposal

1. **Stage 0 · data audit (one venue).** The operator provides the high-priority requests of Section 3 and one interview with the weekly scheduler; we report the data contract, sell-out share, zero-sale share (with the log), coverage of film-time combinations and week-to-week variability of admissions.
   *Continue* if hall seats and the show-time grid are confirmed and at least 8 recent weeks are usable `[PROPOSED]`; the screening log is strongly preferred, and without it the work continues with sell-outs flagged from totals and the zero-sale bias stated; *stop* at demand analytics if no hall information exists.
2. **Stage 1 · offline replay.** Rebuild past weeks; backtest the estimate on held-out weeks against film and slot averages; on the screenings a replayed plan shares with what was actually shown, compare promised with actual tickets (does the tool over-promise, as an optimiser on optimistic estimates would?); the weekly scheduler judges the tool's plans for operability.
   *Continue* if the estimate's error is at least 10% lower than the film-average error, over-promising on shared screenings stays below 10%, and the scheduler rates at least 8 of 10 replayed weeks operable with minor edits `[PROPOSED]`; *revise* once if not, then stop.
3. **Stage 2 · advisory trial.** Pairs of weeks at the same venue; a coin flip decides which week of each pair uses the tool-assisted plan (randomised switchback), excluding holiday and opening weeks, with a capped number of flagged test screenings of untried combinations (exploration, Lec 4, pp. 20-29) whose results calibrate the caution level.
   *Adopt* if tool weeks beat their paired own weeks on admissions per available seat (adjusted for the slate's national performance if available) by a margin agreed before the trial, with the interval above zero and no operational incidents; trial length follows from the variability measured in Stage 0 (TBD).

| Condition | When |
|---|---|
| Test | Stage 0 and Stage 1 gates pass; KPI and thresholds signed off by the sponsor before the first trial week |
| Adopt | Trial margin met; override rate below an agreed level; export stable for the whole trial |
| Revise | Frequent overrides (a missing rule such as staffing or distributor terms); flagged test screenings underperform (raise caution); over-promising grows; estimate drifts (holidays, ageing) |
| Stop | No hall information obtainable; estimate not better than averages after one revision; trial shows no gain or a loss; the data contract keeps changing |

These real-world criteria are separate from the functional checks of Section 5.
Metrics: admissions per available seat within randomised pairs (primary), sell-outs and turned-away estimates, empty seats in large halls, test-screening results, weekly forecast error and promised-vs-actual tickets, override share and planning time.
Thresholds marked `[PROPOSED]` are our suggestion for the sponsor to accept or change; the trial margin and length are TBD because they depend on variability not yet seen.

**Responsibilities:** the programming lead sponsors and signs off the KPI, thresholds and each gate; the data owner provides exports and confirms the data contract; the weekly scheduler gives the interview, enters weekly settings, judges replayed plans and runs the trial; the venue confirms halls, closures, grid and cleaning time; the proposing analyst (the author) delivers the audit report, the replay study, the tool, the trial analysis and a go / no-go recommendation.
**Cost, timeline and benefit:** not estimated yet; they depend on export speed and quality, which Stage 0 establishes, and a benefit can only be measured in Stage 2.
The +14.2% of the demo is a property of invented data, measured against a stated rule of thumb with the tool's own estimate (+5.4% against repeating last week), and is not an estimate for the operator.

**The proposal (`proposal.html`)** carries this argument in 12 slides, laid out like a streaming player (controls appear on mouse movement; the author line and the arrow keys sit in the bottom corners): slide 2 answers the six questions, slide 4 the records, the data contract and the gap, slide 5 the scope (must / should / could / won't), slide 6 the alternatives and the evidence, slide 7 every calculation step with the worked example, slide 8 the demonstration and the sweep, slide 9 the hidden-demand insight, slides 10-12 the stages, information requests, risks and the decision; every figure in it is computed from the same engine and defaults as this definition.

**Decision requested (approval required before proceeding):** Stage 0 and Stage 1 at one venue, with a named sponsor and data contact, the six-field export for at least 8 recent weeks, hall seats, the screening log with halls if it exists, and one interview with the weekly scheduler; not production use or a trial budget, which are decided at the Stage 1 gate.

## 7. LLM Review & Key Revisions

Tool: Claude Code with Claude Opus 5.5, in sessions on 2026-09-29 (v1), 2026-10-02 and 2026-10-05 (v2) and 2026-10-09 (v3 to v4.1, this version).
It read the brief and the lecture slides, role-played project-manager and client reviews, proposed methods, wrote the engine, UI, tests and the mock study, ran an independent grading review in a fresh context, and checked consistency across the three files.
I set the direction, rejected or narrowed suggestions, and verified them as recorded below; LLM output was never used as evidence for an external fact.

| Discussion / purpose | LLM suggestion | My assessment and verification evidence | Final decision or revision; location in the deliverables |
|---|---|---|---|
| 1: Fictional vs real films (v2 → v3) | v2: plan six films currently in Korean cinemas, real titles and runtimes from press sources, invented demand | I reversed it in v3: the brief asks for an "entirely fictional dataset ... inventing its aliases and values" [A §2]. I asked for recognisable parody titles so the slate reads naturally without being real; a test asserts that no real title appears in the slate | Invented parody titles (*Caterpillar-Man*, *Avocado*, *Gigantic*, ...); real-film citations removed. Header, demo, proposal |
| 2: Method complexity (v1 → v2 → v3) | v1: EM imputation, min-cost flow, subgradient check; v2: negative-binomial MLE, a Gaussian-process prior with kernel search, Bayes on a grid with a censored likelihood, per-step alternatives | v1 methods were rejected as not taught; in v3 I judged v2 over-engineered for the brief ("A justified simple method can receive full base credit" [A §1]; "complexity earns no credit by itself" [Ref §7]) and restricted methods to Lectures 0-4. The simpler estimate was checked against simpler alternatives in the mock study (99.0% of an oracle on held-out seeds, lowest backtest error); the GP itself was not re-run, so its rejection rests on simplicity, not on measured inferiority | Pattern + Poisson-Gamma update + negative-binomial expected sales + cautious LP (Sections 2, 4); GP listed as rejected approach E |
| 3: Caution level and pattern weight | Default caution 0.3 and $k$ = 2 as "moderate" values | Not accepted on intuition. A first study chose $c$ = 0.5, $k$ = 1, but the second review showed $k$ = 1 was contradicted by its own table and that tuning and reporting used the same seeds. Now tuned on seeds 1-40 and reported on 41-80: $c$ = 0.5 balances the new-release and sparse worlds, $k$ = 4 is best on average | Defaults $c$ = 0.5, $k$ = 4 (Sections 2, 4; demo Method settings) |
| 4: Information requests vs the six fields | v2 treated a screening log and hall seats as required inputs | Restricted: the mechanism must run on the six fields only, with halls and grid as labelled operating settings, and the operator must confirm the data contract. The demo was rebuilt so the generator follows the settings and the field-usage table shows what is used | "No additional record fields" and the data-contract request (Section 3); demo Records; proposal slide 4 |
| 5: Independent grading review (v3 → v3.1) | A fresh LLM agent graded v3 against the rubric (86 / 100) and found: the valuation ignored screening-to-screening spread although the text claimed it matched the generator; caution exempted new releases and treated one screening as full evidence; the sold-out correction was presented as MLE and never ablated; the screening log was a gate in one place and optional in another; a failure kept the old success headline; the worked example did not reproduce from the shown figures | I verified each point in the code before changing anything. Fixes: spread $r$ fitted by MLE and used in a moment-matched predictive; caution now discounts the pattern share of every estimate, new releases included; the correction was ablated (no consistent gain) and dropped; gate and fallbacks aligned; failure headline replaced; examples recomputed from two-decimal figures; a third study world and a simulated-programmer benchmark added | Sections 2-6, demo, proposal slides 2-12 |
| 5b: Second independent review (v3.1 → v3.2) | A second fresh agent graded v3.1 (86 / 100) and found: caution on films without records starved new releases (7 of 105 shows; −523 ± 21 tickets); the pattern let family films inherit the evening peak; defaults were tuned on the reporting seeds; dual prices were quoted as costs in the wrong units; gate wording still differed on two slides; real runtimes of the parodied films; the brute-force check was described as weeks | Verified each in the page's engine. Fixes: new releases exempt and flagged; time index per audience group with nearest-time extrapolation; tuning on seeds 1-40, reporting on 41-80 with a new-release world; re-solved ±1 rule costs; second reference plan (repeat last week); gate wording aligned; runtimes changed; labels corrected; results dim while settings are unsaved | Sections 2-6, demo, proposal |
| 6: Baseline robustness and backtest fairness (found by checks, v3) | The first v3 rule of thumb filled slots greedily; the first backtest scored only screenings not read as sold out | A sweep of 120 runs showed the baseline breaking a minimum in 59 of them once a new release joined; the backtest excluded exactly the high-demand screenings. Fixed with a repair step and a censoring-aware error; a test runs the baseline on 24 settings | Section 4 approach A; Section 5 backtest; demo |
| 7: Classification and baseline wording (v1, kept) | Classify `expected-tickets` as Formulation because the estimate only supplies a parameter; call the rule of thumb the operator's current practice | First accepted after checking [Ref §3]; second rejected because current practice is unspecified [A §2] | Section 2 component table; "proposed reference" in Sections 1, 4, demo and proposal |
| 8: My review of v3.2 (v3.2 → v4.0) | The LLM's v3.2 used a coined product name, an invented venue name, bracket labels without a legend, a technical prior-weight label, a direct client voice, two film rows, a static billboard image and a deck styled as episodes | I asked for a neutral name (Theater Optimization), no invented place (venue alias only), general rather than client-directed wording, a legend for the labels, a plain explanation of $k$ and the distributions, one film row with per-film gains, animated figures that follow the lecture graphics on the demo's own data, a streaming-player deck, MoSCoW scope, no responsibility matrix, and a multi-configuration check that the method beats the baseline. The sweep found the never-scheduled-film flaw (Section 5); I checked the fix on the sweep and on the unchanged study table. "Always better" could not be shown and is reported as measured | Demo, deck and Sections 1, 2, 5; responsibilities kept as one line per stage because the brief asks for them |
| 9: My review of v4.0 (v4.0 → v4.1) | v4.0 showed a "TOP 1" rank badge next to the gain, short animations with few distinct states (two screenings in the Bayes figure, three hall sizes, caution in steps of 0.05), a cinema animation without people leaving, a slide-7 calculation that skipped steps, and a short won't-have list | I asked to state the gain for the whole week without a badge, to make every animation smooth and self-explaining, to bring back the arrive-sit-leave cinema cycle with Run plan jumping to it, a randomizer for the settings, a longer won't-have list with practice ideas (social-media retention, cinema proximity and others), the full calculation on slide 7, my name and student number on both files, and a fixed-size slider. Checked in the browser: the narrated sequences, the step control, Run plan and Randomize are covered by `tools/verify.py`; the deck fits every window size | Demo (Compare, How it works, Settings, footer), deck slides 1, 5, 7 and the author line, Sections 1 and 5 |

Earlier LLM-assisted role-plays (a project-manager scope review and client questions such as "Will it suggest things we have never tried?" and "What happens if we cannot provide the schedule log?") shaped Sections 1, 3 and 6; they are working notes, not part of the submission.
