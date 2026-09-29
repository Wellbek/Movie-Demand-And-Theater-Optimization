# Problem Definition: Fill the Right Seats - Weekly Showtime Planning for One Venue

**IE437 Assignment 1 · Movie Programming - Problem Definition and Decision-Support Design**

Author / student ID or team: TBD (to be filled in before submission)  
Date / version: 2026-09-29 · v1.0  
Summary: A venue's programming manager decides every week which film plays in which hall at which time.
We estimate demand per film, time slot and day type from purchase records and compute the arrangement that maximizes expected tickets under hard scheduling rules.
On fictional data the plan sells 545 more expected tickets per week (+6.7%) than a rule-of-thumb baseline; real-world effects are untested.  
Files: `problem-definition.md`, `demo.html`, `proposal.html`  
LLM tools and use: Claude Code with Claude Opus 5.5 (2026-09-29): reading the brief, role-played project-manager and client reviews, drafting, engine and UI code, tests. See Section 7.

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

**Controllable variables:** `x[f,d,s,h] ∈ {0,1}`, film `f` in hall `h` on day `d` at slot `s`.
Slots: 10:00, 13:00, 16:00, 19:00, 22:00; day types: weekday (Mon-Thu), weekend (Fri-Sun) `[ASSUMPTION]`.

**Inputs and settings:** hall capacities (220 / 120 / 60 seats, fictional), slot length (180 min), cleaning time (20 min), film runtimes, per-film min/max shows per week, caution level κ (default 2), prior strength k (default 3).

**Objective:** maximize expected tickets sold in the week.
The computed metric is expected admissions under our demand estimates; the business outcome it is meant to support is actual admissions, which only a trial can measure.

**Supporting analysis (not a component):** a demand estimate per film × slot × day type, `λ̂ = (k·m + Σy) / (k + n)`.
Here `m` is a multiplicative pattern (film × slot × day type) fitted to all screenings, `y` are tickets per past screening and `n` their count.
Sold-out screenings enter as their expected demand given it reached capacity.
Uncertainty `sd` accounts for screening-to-screening noise (overdispersion estimated from the data, r̂ = 6.4).

| Component ID | Decision ID | Role: Cost / Constraint / State-transition | Model: Formulation / Simulation / Data-driven | Definition, units, and evidence / assumption / unknown |
|---|---|---|---|---|
| `expected-tickets` | `weekly-plan` | Cost (maximize) | Formulation | `Σ x[f,d,s,h] · E[min(D, cap_h)]`, tickets; D negative binomial with mean `max(λ̂ − κ·sd, 0)`. The learned λ̂ supplies a parameter only, so the component stays Formulation [classification reference §3]. |
| `one-film-per-hall` | `weekly-plan` | Constraint | Formulation | `Σ_f x[f,d,s,h] ≤ 1`. Hard. |
| `show-limits` | `weekly-plan` | Constraint | Formulation | `min_f ≤ Σ_{d,s,h} x[f,d,s,h] ≤ max_f`. Hard. `[ASSUMPTION]` stands in for distributor commitments (TBD). |
| `no-self-clash` | `weekly-plan` | Constraint | Formulation | `Σ_h x[f,d,s,h] ≤ 1`: a film never plays in two halls at once. Hard; keeps demand separable. |
| `slot-fit` | `weekly-plan` | Constraint | Formulation | `x = 0` if runtime + cleaning > slot length. Hard. |

No State-transition component exists (Section 1).

**Invalid or infeasible input:** out-of-range numbers or malformed purchase rows block the run with a field- or line-specific message.
If the rules cannot all be met (e.g. minimum shows exceed open screen-slots), no plan is shown; the violated constraint, the gap and a fix are reported, and earlier results are marked stale.
Empty or partial halls are allowed (value 0).

**Follow-up (Formulation):** decision variables, objective and hard constraints are above; there are no soft constraints.
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

**Main uncertainty and when not to trust the plan:** estimates for untried combinations are extrapolations of a pattern model, and an optimizer seeks out exactly the most optimistic of them.
The caution level κ lowers each estimate by κ standard deviations, which penalizes untried combinations most.
We examined its effect with a sweep (Section 5).
The recommendation should not be trusted where most of the plan relies on untried combinations, when the schedule log is missing, or when any exclusion in Section 1 is active (e.g. a holiday week).

## 4. Alternatives & Selected Approach

| Approach | Mechanism and required information | Strengths, limitations, and effort | Selection and reason |
|---|---|---|---|
| A: Rule of thumb | Score = last history week's tickets; quota = open screen-slots × score share, rounded, clipped to min-max, leftovers to the top-scoring films below their max; fill 19:00, 22:00, 16:00, 13:00, 10:00, largest hall first, with the top-scoring film that has quota left, fits, and is not on elsewhere at that time | Transparent; blind to time-of-day fit and hall size; low effort | Baseline, labeled a proposed reference |
| B: Estimate + exact optimization | Demand estimate (Section 2), then maximize `expected-tickets` under all constraints as a min-cost flow | Exact for the stated formulation; every value explainable; runs offline in a browser; assumes separable demand | **Selected**: simplest method that answers the full decision and can be verified |
| C: Local search with audience overlap | Adds a substitution term between films sharing buyers | Addresses the separability assumption; no optimality guarantee; weakly identified | Later stage, once overlap evidence exists |
| D: Self-learning policy (bandit / RL) | Adjusts the schedule from observed sales | Changes the problem to Feedback and Stateful; needs purchase timestamps and live testing | Rejected for the first step |
| E: Multi-agent coordination (venues as agents) | Venue plans coordinated by price signals | Relevant only for multi-venue scope; one operator is still one decision maker | Roadmap, triggered by the venue-overlap request |
| F: Social-media and review sentiment | Classify comments about a film as positive/negative and weight by comment count, e.g. `score = Σ sentiment × count`, as a prior for films without sales | Could help new releases; needs external data collection, platform terms, and a validated link to local admissions | Later add-on, after the trial |

**Graph:** each unit of flow is one screening and travels source → film (edge limits min_f..max_f) → film-at-a-time node (capacity 1, `no-self-clash`) → hall-at-a-time node (capacity 1, `one-film-per-hall`; edge value = expected tickets) → sink.
Because these capacity limits are nested, the flow polytope has integral vertices, so the best flow is a valid 0/1 schedule.
Enumeration is infeasible (about 7^105 ≈ 10^88 weeks), and a greedy fill cannot move a film out of a slot once placed.

**Convergence view (Lagrangian relaxation, as per lecture on duality):** the show limits are moved into the objective with a price per film, `p_f = μ_f − ν_f`, so each of the 35 time slots can be planned separately by enumeration.
The relaxed value is an upper bound on the best week (weak duality); repairing the relaxed plan into a valid schedule gives a lower bound.
Subgradient steps update the prices (`μ_f += step·(n_f − max_f)`, `ν_f += step·(min_f − n_f)`, projected to ≥ 0) until the bounds meet.
With default inputs the gap closes in 74 iterations at the exact flow value, 6,836 (strong duality holds because the flow formulation is integral).
The final prices are shadow prices: e.g. one more allowed PAPER LANTERNS show would add about 25 expected tickets.
The demo plays this sequence step by step.

**Selected flow:** validate inputs → sum purchases per screening → estimate demand per film × slot × day type → value each (film, hall, slot) as expected tickets → solve the min-cost flow → verify constraints → compare with approach A on the same inputs and the same value function.
The flow gives the true optimum of the stated formulation; this was checked against brute-force enumeration on 200 random small instances.
It is not optimal with respect to anything the formulation omits, and its value depends on the estimates.
Ties are resolved by a fixed edge order, so results are deterministic.
Randomness only generates the fictional history (seeded PRNG, seed 437).
Actual calculations: all of the above.
Mock: the hidden generator used to score the caution sweep.
Not implemented: approaches C-E, pricing, holidays, film ageing, mid-week changes, two halls showing one film at once.

## 5. Demonstration & Evaluation

**How to use `demo.html`:** open it in a desktop browser (no server or internet).
It loads the fictional data and runs once.
"Play the week" animates both plans screening by screening, filling seat maps with expected tickets and showing the running difference.
"Why this is an optimization" shows the biggest win, an accepted loss and week totals.
Click any schedule cell to see the ranked alternatives and why the film won.
"Every algorithm the tool runs" replays each algorithm step by step with its formula: the demand estimate converging, the rule-of-thumb greedy fill, the min-cost flow adding one screening per augmenting path until no path adds value, and the Lagrangian bounds closing on the optimum.
Change hall seats, slot length, cleaning time, film limits, the caution level or the seed, press Run, and compare again.
The run fingerprint (default `3cdeb67c`) is identical for identical inputs; "Reset" restores the defaults.
Checked in Chromium (Playwright, offline context): no network requests, no console errors, no horizontal overflow at 1440 and 1024 px.
Firefox: Not run.

**Baseline, metrics, conditions:** approach A and B use the same inputs and the same value function.
Metric: expected tickets per week (calculated).
Secondary: expected turned-away customers and empty seats.
The mock check scores plans against the fictional generator and is kept apart from the estimate that drives the decision.

**Default result (fictional):** optimized 8,636 vs rule of thumb 8,091 expected tickets (+545, +6.7%).
Expected turned away 2,222 → 1,491; expected empty seats 5,909 → 5,364; 0 rules broken in both.
Biggest single change: Sat 10:00, where the rule put the blockbuster ORBITFALL in Hall 1 and the optimizer gives that hall to the family film PAPER LANTERNS (+146).
Accepted loss: Mon 19:00 (−36), traded for larger gains elsewhere under the shared show limits.

**Caution sweep (mock):** at κ = 0 the model promises 8,965 tickets, but the simulated cinema sells 6,593, below the rule of thumb's 6,689.
At κ = 2 it sells 7,711.
This shows the mechanism (an optimizer exploiting guesses about untried combinations) in a world where the truth is known; it does not calibrate κ for a real venue.

| Case | Inputs / reproduction steps | Expected result / pass criterion | Observed result and supported conclusion |
|---|---|---|---|
| Normal | Defaults (Test cases: "Default week") | Feasible; 0 violations in both plans; proposed ≥ baseline on the decision value | Pass: decision value 6,836 vs 6,272 (+564), 0 violations |
| Boundary | Add GLASS MERIDIAN, a new release with zero purchase rows, 5-21 shows | Valid plan; ≥ 5 shows; its demand is prior-only and flagged | Pass: 5 shows, no evidence cells, prior-only warning shown |
| Boundary | Hall 3 capacity 0 | Valid plan without Hall 3 | Pass: 0 screenings in Hall 3 |
| Boundary | Schedule log not provided | Plan with fallback warning; no sell-outs detected | Pass: 417 of 420 screenings visible, 0 sell-outs detected, warning shown |
| Failure | Hall 2 and Hall 3 closed | No plan; reports the `one-film-per-hall` capacity gap (42 vs 35) | Pass: "Minimum shows add up to 42 but only 35 screen-slots are open", fix suggested, results marked stale |
| Failure | ORBITFALL runtime 175 min | No plan; explains `slot-fit` | Pass: "needs 195 min ... slots are 180 min, so its minimum of 14 shows cannot be met" |
| Failure | Purchase row with `passes_bought` = 0 | No plan; line-numbered validation error | Pass: "Extra row 1: passes_bought "0" must be a positive whole number of tickets" (engine test and demo test case) |

**Established:** the mechanism works end to end on fictional data, the plan is optimal for the stated formulation, constraints and failures are handled, and results are reproducible.
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
| 1: Make the caution level meaningful | First model: Gamma-Poisson posterior with the prior worth k pseudo-screenings | Rejected after a test run: an untried cell got sd ≈ 7 on a mean of 143, so caution changed almost nothing, and the plan kept a family film at 22:00 where the fictional truth is 6-10 tickets. Revised to include screening-to-screening overdispersion (r̂ = 6.4); untried cells now have sd ≈ 38-61 and the sweep shows the intended effect (6,593 → 7,711). | Section 2 estimate; Section 5 sweep; demo caution chart; proposal slide 8 |
| 2: Claim of optimality | Solve with a min-cost flow and call the plan optimal | Accepted only after brute-force enumeration on 200 random small instances; the first test run found a bug (an impossible lock silently dropped instead of reported), which was fixed before acceptance | Section 4 optimality statement limited to the formulation; automated test of the demo's calculation code |
| 3: Classifying the ticket objective and wording the baseline | Classify `expected-tickets` as Formulation because the forecast only supplies a parameter; describe the rule of thumb as the operator's current practice | First accepted after checking the classification reference §3; second rejected because current practice is unspecified [A §2] | Section 2 component table; baseline labeled "proposed reference" in Sections 1 and 4, demo and proposal |

Other LLM-assisted reviews (a project-manager scope review and role-played client questions) informed Sections 1, 3 and 6 but are not part of the submission.
