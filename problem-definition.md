# Problem Definition: Fill the Right Seats - Weekly Showtime Planning for One Venue

**IE437 Assignment 1 · Movie Programming - Problem Definition and Decision-Support Design**

Author / student ID or team: TBD (to be filled in before submission)  
Date / version: 2026-10-02 · v1.1  
Summary: A venue's programming manager decides every week which film plays in which hall at which time.
We form a Bayesian belief about demand per film, time slot and day type from purchase records, value each screening cautiously where evidence is thin, and solve the week as a linear program whose dual prices prove optimality.
Every method is taken from the IE437 lectures (Lec 1 optimization, Lec 2 Bayesian statistics).
On fictional data the plan sells 375 more expected tickets per week (+4.7%) than a rule-of-thumb baseline; real-world effects are untested.  
Files: `problem-definition.md`, `demo.html`, `proposal.html`  
LLM tools and use: Claude Code with Claude Opus 5.5 (2026-09-29, revised 2026-10-02): reading the brief, role-played project-manager and client reviews, checking methods against the course script, drafting, engine and UI code, tests. See Section 7.

Facts from the brief are cited as `[A §n]` (`assignment.md`, section n).
Everything numeric about the cinema is fictional and produced by `demo.html` with seed 437.

## 1. Decision, Scope & Problem Structure

The operator wants to use its records to understand its audience and improve movie-programming decisions, meaning which movies to screen, in which rooms, and at what times [A §1, §2].
Its current practices and decision rules are unknown [A §2].

> The venue's programming manager uses demand estimates from past purchase records, hall capacities and the confirmed film slate, before next week's schedule is published, to decide which film plays in which hall at each show slot, in order to increase expected tickets sold without breaking show commitments.

**Boundary:** one venue, one planning week (7 days × 5 fixed slots × 3 halls = 105 screen-slots), decided once before the week starts.
**Why this narrower first step:** it is the smallest scope that still contains the full programming decision (film, room, time), and the records support it only with the additional schedule log requested in Section 3.

**Exclusions and consequences:**
- Film acquisition and run length (the upstream booking decision): the film slate and per-film show limits are inputs, so we cannot say which films to book.
- Pricing, concessions, revenue: the objective is admissions, not money.
- Multi-venue coordination: sister venues competing for one audience are ignored.
- Mid-week changes: the plan cannot react to a flop inside the week.
- External signals (weather, holidays, trailers, and social-media or review comments): not in the records and excluded from this first step.
  A later add-on could classify comments as positive or negative and weight them by comment count as an early demand signal for new releases (Section 4, approach F).

**Current practice vs baseline:** current practice is unknown [A §2].
The baseline is a proposed rule of thumb (Section 4, approach A), not an observed process.

**Decisions:**

| ID | What is chosen | Who uses / approves |
|---|---|---|
| `weekly-plan` | Film (or none) for every hall × slot × day of the planning week | Programming manager approves before publication |

Dependencies: none inside the boundary.
The real upstream dependency `film-booking → weekly-plan: feasible region (available films, show limits)` lies outside the boundary and enters only as input.
The demand estimate is a supporting analysis, not a decision.
`evaluated_by`: N/A (no child decision).

| Object | Property | Classification (or unresolved status) | Structural evidence or question to resolve |
|---|---|---|---|
| Decision dependency graph | Decision Structure | Flat | One decision in scope; the parent `film-booking` is excluded. |
| `weekly-plan` | State Structure | Stateless | No state links decision epochs inside one week. `[ASSUMPTION]` slot demands are independent; if audience depletion across the week matters (people who saw a film Monday do not return Tuesday), a remaining-audience state would appear. Confirm with week-level repeat-viewing data (Section 3). |
| `weekly-plan` | Information Structure | Open-loop | The whole week is fixed before tickets go on sale. Basis: `operational-requirement` `[ASSUMPTION]` (schedules are published in advance); TBD: confirm publication lead time. Re-running the plan every week does not make it Feedback. |

Editing inputs and re-running in the demo before approval is interface behavior and does not add future observations.

## 2. Computable Problem

**Controllable variables:** $x_{fhds} \in \lbrace 0,1 \rbrace$, film $f$ in hall $h$ on day $d$ at slot $s$.
Slots: 10:00, 13:00, 16:00, 19:00, 22:00; day types: weekday (Mon-Thu), weekend (Fri-Sun) `[ASSUMPTION]`.

**Inputs and settings:** hall capacities (220 / 120 / 60 seats, fictional), slot length (180 min), cleaning time (20 min), film runtimes, per-film min/max shows per week, caution level κ in posterior standard deviations (default 1).

**Objective:** maximize expected tickets sold in the week.
The computed metric is expected admissions under our demand estimates; the business outcome it is meant to support is actual admissions, which only a trial can measure.

**Supporting analysis (not a component):** a demand belief per film × slot × day-type cell, built from three lecture tools.
1. Screening noise: tickets at one screening vary around the cell mean θ as a negative binomial with shape r; r̂ = 5.7 by maximum likelihood over a grid (Lec 2, MLE).
2. Pattern prior: ridge regression of log(1 + tickets) on film, slot and weekend, which is the MAP estimate under a Gaussian prior on each effect, λ = σ²/τ² = 0.24 with τ = 1 `[ASSUMPTION]` (Lec 2).
   It gives every cell a prior mean m, including the 30 of 60 cells never screened.
   The prior spread τ_c = 0.56 (log scale) is measured out of sample: each tried cell is left out, the ridge is refitted, and the miss is recorded (Section 3).
3. Belief: Bayes' rule evaluated on a 200-point grid of θ, prior × the likelihood of every past screening (Lec 2; exact enumeration, Lec 3).
   A sold-out screening enters through P(D ≥ seats | θ), so it raises the belief instead of capping it (81 of 420 fictional screenings).

| Component ID | Decision ID | Role: Cost / Constraint / State-transition | Model: Formulation / Simulation / Data-driven | Definition, units, and evidence / assumption / unknown |
|---|---|---|---|---|
| `expected-tickets` | `weekly-plan` | Cost (maximize) | Formulation | $\sum x_{fhds}\, v_{fhds}(\kappa)$, tickets, with $v(\kappa) = \sum_j p(\theta_j \mid \text{records})\, \mathbb{E}[\min(D, \text{seats}_h) \mid \theta_j - \kappa\sigma]$: the posterior predictive at κ = 0, its worst case within ±κ posterior sds otherwise (robust LP, Lec 1). The belief supplies parameters only, so the component stays Formulation [classification reference §3]. |
| `one-film-per-hall` | `weekly-plan` | Constraint | Formulation | $\sum_f x_{fhds} \le 1$. Hard. |
| `show-limits` | `weekly-plan` | Constraint | Formulation | $\min_f \le \sum_{h,d,s} x_{fhds} \le \max_f$. Hard. `[ASSUMPTION]` stands in for distributor commitments (TBD). |
| `no-self-clash` | `weekly-plan` | Constraint | Formulation | $\sum_h x_{fhds} \le 1$: a film never plays in two halls at once. Hard; keeps demand separable. |
| `slot-fit` | `weekly-plan` | Constraint | Formulation | $x_{fhds} = 0$ if runtime + cleaning > slot length. Hard. |

No State-transition component exists (Section 1).

**Invalid or infeasible input:** out-of-range numbers or malformed purchase rows block the run with a field- or line-specific message.
If the rules cannot all be met (e.g. minimum shows exceed open screen-slots), no plan is shown; the violated constraint, the gap and a fix are reported, and earlier results are marked stale.
Empty or partial halls are allowed (value 0).

**Follow-up (Formulation):** decision variables, objective and hard constraints are above; there are no soft constraints.
The 0/1 requirement is relaxed to $x \ge 0$; the relaxation is exact here because every coefficient is 0 or 1 and the hall rows and the film rows each form nested groups, so every vertex is whole-numbered.
The tool checks integrality on every run and refuses to show a fractional plan.
Feasibility is checked before solving and verified after.
Simulation, Feedback, Stateful and Hierarchical follow-ups: N/A for this boundary.
The hidden generator used only to create fictional data and the mock check is not an evaluation component.

## 3. Information & Uncertainty

**Unit of record:** one completed purchase for one screening; date and time describe the screening, not the purchase [A §2].
Tickets per screening = sum of `passes_bought` per (`title_tag`, `venue_tag`, `play_day`, `curtain_time`).
All inputs are available before the plan is fixed; actual admissions of the planned week are later outcomes, used only for evaluation.

**Established from the records:** tickets per observed screening, weekday/weekend and time-of-day patterns for screenings that happened, group sizes, repeat buyers and shared audiences via `account_tag`.
**Not established:** hall, capacity, runtime, price, purchase time, current practice, dataset size and quality [A §2].
Three consequences follow from the record design itself:
1. A sold-out screening records capacity, not demand (81 of 420 fictional screenings).
2. A screening with zero purchases leaves no row (3 fictional screenings vanish without the schedule log).
3. Only film-time combinations someone chose to screen are observed (50% of fictional combinations were never tried).

| Fact / assumption / unknown or request | Evidence or reason for current treatment | Why it matters | How to confirm or obtain it; priority | Fallback or limit until confirmed |
|---|---|---|---|---|
| Request: screening log (film, hall, date, time) | Not in the record spec [A §2] | Reveals zero-sale screenings and sell-outs | Operator's scheduling system export; **high** | Demand analytics only; no hall assignment. Demo boundary case shows the bias. |
| Request: seats per hall | Not in the spec | Sell-out detection; value of big vs small halls | Operator facility data; **high** | Operator estimate, flagged `[ASSUMPTION]` |
| Request: runtimes, slot grid, cleaning time | Not in the spec | Feasibility (`slot-fit`) | Programming manager; **high** | Manager-supplied defaults |
| Request: min/max show commitments | Unknown contract terms | Hard constraints (`show-limits`) | Programming manager / distributor terms; **high** | Manager enters weekly |
| Request: purchase time, price | Not in the spec | Booking curves, revenue objective | Ticketing export; **medium** | Stay with admissions and a fixed weekly plan |
| `[ASSUMPTION]` venues are independent | Keeps the decision flat | Sister venues may split one audience | Share of `account_tag`s buying at ≥2 venues; medium | Single-venue scope only |
| `[ASSUMPTION]` similar films do not steal each other's audience | Keeps the objective separable and exact | Plan may overstate tickets when similar films clash | Shared-audience overlap by `account_tag`; medium | Report as limitation |
| `[ASSUMPTION]` demand stable over the 4-week history | No release dates | Films early/late in their run are mis-estimated | Request release dates; medium | Use recent weeks only |
| TBD: refunds, walk-up sales without account, midnight `play_day` convention | Brief says "completed purchase" only [A §2] | Demand and day-type bias | Clarify with data owner; medium | Document and exclude ambiguous rows |
| TBD: admissions vs revenue as the managed KPI | No price data | Wrong objective | Ask the sponsor; high | Admissions |

**Main uncertainty and when not to trust the plan:** beliefs for untried combinations are extrapolations of a pattern model, and an optimizer seeks out exactly the most optimistic of them (Lec 5: the optimizer is an adversary of its own model).
The spread of tried cells around the pattern understates this: in-sample it is 0.33 on the log scale, but leaving each tried cell out and refitting gives 0.56, so the prior uses the held-out value.
The caution level κ values each screening at its belief shifted down by κ posterior standard deviations, which penalizes untried combinations most (they lose 55% of their value at κ = 1, tried cells 12%).
We examined its effect with a sweep (Section 5).
Even so, 25 planned screenings use untried combinations (14 of them in the 60-seat hall, where a miss costs least), for example the family film at 22:00, which the records cannot rule out; the demo flags them for the manager.
The recommendation should not be trusted where most of the plan relies on untried combinations, when the schedule log is missing, or when any exclusion in Section 1 is active (e.g. a holiday week).

## 4. Alternatives & Selected Approach

Methods were chosen from the IE437 algorithm atlas (course script), using its three questions: the model of the decision is known (linear rules), it is a single static decision per week, and demand is learned only from a fixed log.
That points to Lec 1 (LP, duality, robust LP) for the decision and Lec 2 (Bayesian estimation) for the belief, with Lec 5's warning about optimizing a learned model.

| Approach | Mechanism and required information | Strengths, limitations, and effort | Selection and reason |
|---|---|---|---|
| A: Rule of thumb | Score = last history week's tickets; quota = open screen-slots × score share, rounded, clipped to min-max, leftovers to the top-scoring films below their max; fill 19:00, 22:00, 16:00, 13:00, 10:00, largest hall first, with the top-scoring film that has quota left, fits, and is not on elsewhere at that time | Transparent; blind to time-of-day fit and hall size; low effort | Baseline, labeled a proposed reference |
| B: Bayesian belief + cautious LP | Belief (Section 2: MLE, ridge = MAP, Bayes on a grid) → robust value (Lec 1) → LP by two-phase simplex → duality certificate and shadow prices (Lec 1) | Exact for the stated formulation; proof of optimality; prices every limit; honest about thin data; assumes separable demand | **Selected** |
| C: Same LP, full trust (κ = 0) | Plan on the posterior predictive without caution | Promises most; chases untried guesses | Rejected after the mock sweep (6,867 vs 7,579 sold) |
| D: Genetic algorithm or local search (Lec 5) | Population or neighbourhood search over schedules | Any objective; no optimality proof, no prices, many settings | Rejected: the problem is an LP, so an exact method exists |
| E: Bandit testing (Thompson sampling, UCB; Lec 4) | Spend a few slots per week testing untried combinations, update beliefs from sales | Learns exactly what the records cannot; changes the problem to Feedback and needs weekly data flow | Stage 2+ add-on for the flagged untried screenings |
| F: MDP / reinforcement learning (Lec 7-8) | Sequential policy across days | Mid-week reaction; no state links decisions inside the boundary, data-hungry | Rejected for the first step |
| G: Social-media sentiment; multi-venue coordination | Comments × count as a prior for new releases; venues coordinated by prices | External data, unproven link; only if venues share customers | Roadmap |

**Concrete benefit of each component (fictional data, default inputs):**

| Weakness | Lecture method | Benefit observed in the demo |
|---|---|---|
| 30 of 60 cells never screened | Ridge regression = MAP (Lec 2) | Every cell gets a starting belief; GLASS MERIDIAN (no data) falls back to the average film |
| Sold-out screenings cap recorded tickets | Bayes' rule with the likelihood P(D ≥ seats) (Lec 2) | NEON TIDE Mon-Thu 22:00: plain average 78, belief 102 ± 14 (9 of 16 sold out) |
| Optimizer chases untried guesses (Lec 5) | Robust value, κ posterior sds (Lec 1); held-out prior spread | Mock: full trust sells 6,867, κ = 1 sells 7,579, rule of thumb 6,689 |
| About $7^{105} \approx 10^{88}$ weeks; greedy cannot trade | LP by two-phase simplex (Lec 1) | Exact optimum in 366 pivots; +375 expected tickets (+4.7%) |
| Is it the best? What do limits cost? | LP duality and KKT (Lec 1) | Dual bound 6,991 = plan 6,991; shadow prices below |

**Formulation:** maximize $\sum v_{fhds}(\kappa) x_{fhds}$ subject to one film per hall and time, never two halls at once, $\min_f \le \sum x_{f\cdot} \le \max_f$, and $x \ge 0$ (630 variables with default inputs).
Locked cells are fixed before solving: their hall-time and film-time are removed and the film's limits shrink by one.

**Simplex (Lec 1):** Phase 1 maximizes minus the sum of artificial variables until every minimum is met (166 pivots for the 42 minimum shows).
Phase 2 computes reduced costs $\bar c_j = v_j - y^\top A_j$, enters the column with the largest $\bar c_j$, chooses the leaving row by the ratio test, and stops when no $\bar c_j > 0$ (200 pivots).
Each pivot moves to a neighbouring vertex, which here is a whole schedule: one screening in, one out.
Dantzig's rule is used, with Bland's rule after 60 degenerate pivots to prevent cycling.

**Certificate and shadow prices (duality, KKT; Lec 1):** the dual prices are read from the final tableau: one price per hall-time, per film-time and per show limit.
No screening is worth more than the prices of the three resources it uses (all reduced costs ≤ 0), so the sum of all prices bounds every feasible week from above (weak duality).
It equals the plan, 6,991 = 6,991, which proves optimality for the stated formulation.
Scheduled screenings pay their prices exactly (complementary slackness), which is how the demo explains each cell.
Shadow prices with default inputs: one more PAPER LANTERNS show (cap 28) adds 9.5 cautious tickets; each required QUIET HARBOR show costs 3.4; a second 220-seat hall on Fri 19:00 would add about 130; all other limits are slack and free.
They are valid for small changes only.

All five components and the baseline can be replayed step by step in `demo.html`.

**Selected flow:** validate inputs → sum purchases per screening → demand belief per film × slot × day type → value each (film, hall, slot) → solve the LP by simplex → verify integrality, constraints and the duality certificate → compare with approach A on the same inputs and the same value function.
The simplex optimum was checked against brute-force enumeration on 200 random small instances, and the duality certificate is checked on every run.
It is not optimal with respect to anything the formulation omits, and its value depends on the beliefs.
The simplex is deterministic (fixed pivot rules), so results are reproducible.
Randomness only generates the fictional history (seeded PRNG, seed 437).
Actual calculations: all of the above.
Mock: the hidden generator used to score the caution sweep.
Not implemented: approaches C-G as alternatives, pricing, holidays, film ageing, mid-week changes, two halls showing one film at once.

## 5. Demonstration & Evaluation

**How to use `demo.html`:** open it in a desktop browser (no server or internet).
It loads the fictional data and runs once.
"Watch the week" plays both plans side by side on a clock with day and time: every expected ticket is a person who walks in, takes a seat, watches and leaves, and people turned away from a full hall walk back out; counters fill as people sit down.
"Why this is an optimization" shows the biggest win, an accepted loss, week totals and the untried screenings ("calculated bets").
Click any schedule cell to see the ranked alternatives; for the optimized plan the drawer shows each film's value against the dual prices of hall, film-time and show.
"How the optimized plan is built" shows the five components with their live benefit, and the player animates each: the pattern prior filling the cells, the belief updating screening by screening for any cell, κ pulling untried cells down, the rule-of-thumb greedy fill, every simplex pivot as a schedule, and the duality check slot by slot until the bound meets the plan.
Change hall seats, slot length, cleaning time, film limits, the schedule-log switch, κ or the seed, press Run, and compare again.
The run fingerprint (default `33827616`) is identical for identical inputs; "Reset" restores the defaults.
Checked in Chromium (Playwright, offline context): no network requests, no console errors, no horizontal overflow at 1440, 1024 and 390 px.
Firefox: Not run.

**Baseline, metrics, conditions:** approach A and B use the same inputs and the same value function.
Metric: expected tickets per week (posterior predictive, κ = 0).
Secondary: expected turned-away customers and empty seats, and the decision value the optimizer maximizes (κ = 1).
The mock check scores plans against the fictional generator and is kept apart from the belief that drives the decision.

**Default result (fictional):** optimized 8,390 vs rule of thumb 8,015 expected tickets (+375, +4.7%).
Decision value 6,991 vs 6,036; expected turned away 2,972 → 1,753; expected empty seats 5,985 → 5,610; 0 rules broken in both.
Biggest single change: Sat 10:00 (+127), where the rule put the blockbuster ORBITFALL in Hall 1 and the optimizer gives that hall to the family film PAPER LANTERNS.
Accepted loss: Mon 19:00 (−32), traded for larger gains elsewhere under the shared show limits.

**Caution sweep (mock):** at κ = 0 the model promises 8,890 tickets, but the simulated cinema sells 6,867, barely above the rule of thumb's 6,689.
At κ = 1 it sells 7,579, at κ = 2 7,482, at κ = 3 7,573.
This shows the mechanism (an optimizer exploiting guesses about untried combinations) in a world where the truth is known; it does not calibrate κ for a real venue, which is a Stage 1 task.

| Case | Inputs / reproduction steps | Expected result / pass criterion | Observed result and supported conclusion |
|---|---|---|---|
| Normal | Defaults (Test cases: "Default week") | Feasible; 0 violations in both plans; proposed ≥ baseline on the decision value | Pass: decision value 6,991 vs 6,036 (+955), 0 violations; dual bound equals the plan |
| Boundary | Add GLASS MERIDIAN, a new release with zero purchase rows, 5-21 shows | Valid plan; ≥ 5 shows; its demand is prior-only and flagged | Pass: 5 shows, no evidence cells, prior-only warning shown |
| Boundary | Hall 3 capacity 0 | Valid plan without Hall 3 | Pass: 0 screenings in Hall 3 |
| Boundary | Schedule log not provided | Plan with fallback warning; no sell-outs detected | Pass: 417 of 420 screenings visible, 0 sell-outs detected, warning shown |
| Failure | Hall 2 and Hall 3 closed | No plan; reports the `one-film-per-hall` capacity gap (42 vs 35) | Pass: "Minimum shows add up to 42 but only 35 screen-slots are open", fix suggested, results marked stale |
| Failure | ORBITFALL runtime 175 min | No plan; explains `slot-fit` | Pass: "needs 195 min ... slots are 180 min, so its minimum of 14 shows cannot be met" |
| Failure | Purchase row with `passes_bought` = 0 | No plan; line-numbered validation error | Pass: "Extra row 1: passes_bought "0" must be a positive whole number of tickets" (engine test and demo test case) |

**Established:** the mechanism works end to end on fictional data, the plan is optimal for the stated formulation (duality certificate), constraints and failures are handled, and results are reproducible.
Automated tests (15, `node --test`) cover a textbook LP with known duals, brute-force optimality, the certificate, integral vertices, the sold-out belief and the caution effect.
**Not established:** any effect on real admissions, the right caution level, or whether the assumptions hold for the operator.

## 6. Client Proposal

1. **Stage 0 · data audit (one venue).** Operator provides the high-priority requests of Section 3 and one interview with the programming manager; we report sell-out share, zero-sale share and coverage.
Continue if the screening log with halls and seats exists; otherwise stop and fall back to demand analytics.
2. **Stage 1 · offline replay.** Rebuild past weeks and compare tool plans with actual screenings on the slots both chose, and check estimates against held-out weeks.
Continue if estimates beat simple averages and overlap is large enough to judge; otherwise revise the model or stop.
3. **Stage 2 · advisory trial.** Alternate weeks between the manager's own plan and the tool-assisted plan; track admissions per show, sell-outs and overrides.
Adopt if tool weeks beat own weeks by a margin agreed before the trial; revise or stop otherwise.

These real-world criteria are separate from the functional checks in Section 5.
Thresholds and trial length are TBD: they depend on week-to-week variability, which Stage 0 measures.
Cost, timeline and benefit estimates are not justified yet and follow the audit.

**Responsibilities:** operator provides data extracts, a data contact, a manager interview and a sponsor; we deliver the audit report, the replay study and a go/no-go recommendation.

**Decision requested:** approve the data audit and offline replay for one venue, with a named data contact and one manager interview (not production adoption).

## 7. LLM Review & Key Revisions

| Discussion / purpose | LLM suggestion | Your assessment and verification evidence | Final decision or revision; location in the deliverables |
|---|---|---|---|
| 1: Make the caution level meaningful | First model: Gamma-Poisson posterior with the prior worth k pseudo-screenings | Rejected after a test run: an untried cell got sd ≈ 7 on a mean of 143, so caution changed almost nothing, and the plan kept a family film at 22:00 where the fictional truth is 6-10 tickets. Revised to include screening-to-screening overdispersion. In the lecture-based version (discussion 2) the same problem returned: the prior spread estimated from tried cells (0.33) let a family film keep 22:00 slots. Following Lec 5 (spread on the data says little off the data), the spread is now measured by leaving each tried cell out (0.56), and the sweep shows the intended effect (6,867 → 7,579). | Section 2 belief; Section 3; Section 5 sweep; demo caution tab; proposal slide 13 |
| 2: Methods must come from the course | First version: EM imputation for sell-outs, an iterative pattern fit, a min-cost flow solved by shortest paths, and a subgradient Lagrangian check | Rejected on review against the IE437 algorithm atlas: none of these is taught. Replaced by lecture methods with the same role: Bayes' rule with a sold-out likelihood (Lec 2), ridge = MAP (Lec 2), LP by simplex and duality (Lec 1). Verified: brute force on 200 random instances, a textbook LP with known duals, dual = primal on every run; a test also caught a lock above a film's maximum being accepted, fixed before acceptance | Sections 2 and 4; demo player and pipeline; proposal slides 9-15 |
| 3: Classifying the ticket objective and wording the baseline | Classify `expected-tickets` as Formulation because the forecast only supplies a parameter; describe the rule of thumb as the operator's current practice | First accepted after checking the classification reference §3; second rejected because current practice is unspecified [A §2] | Section 2 component table; baseline labeled "proposed reference" in Sections 1 and 4, demo and proposal |

Other LLM-assisted reviews (a project-manager scope review and role-played client questions) informed Sections 1, 3 and 6 but are not part of the submission.
