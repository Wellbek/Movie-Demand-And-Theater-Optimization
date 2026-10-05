# Problem Definition: Fill the Right Seats - Weekly Showtime Planning for One Venue

**IE437 Assignment 1 · Movie Programming - Problem Definition and Decision-Support Design**

Author / student ID or team: TBD (to be filled in before submission)  
Date / version: 2026-10-05 · v2.0  
Summary: A venue's programming manager decides every week which film plays in which hall at which time.
We form a belief about demand per film, time slot and day type from purchase records (a Gaussian-process prior and Bayes' rule), value each screening cautiously where evidence is thin, and solve the week as a linear program whose dual prices prove optimality.
Every method is taken from the IE437 lectures (Lec 1 optimization, Lec 2 Bayesian statistics, Lec 3 exact inference, Lec 4 Gaussian processes), and every step was compared with its lecture alternatives (Section 4).
On fictional data the plan sells 825 more expected tickets per week (+11.2%) than a rule-of-thumb baseline; real-world effects are untested.  
Files: `problem-definition.md`, `demo.html`, `proposal.html`  
LLM tools and use: Claude Code with Claude Opus 5.5 (2026-09-29, revised 2026-10-02 and 2026-10-05): reading the brief and the lecture slides, role-played project-manager and client reviews, checking methods against the slides, looking up the current film slate, drafting, engine and UI code, tests, the mock study. See Section 7.

Facts from the brief are cited as `[A §n]` (`assignment.md`, section n); lecture results as Lec n (IE437 slides 00-04 and the course script's algorithm atlas).
Everything numeric about the cinema is fictional and produced by `demo.html` with seed 437.

> **Disclaimer.** The demonstration plans six films that are in Korean cinemas in early October 2026, so that the slate, runtimes and release dates are realistic.
> Titles, runtimes and release dates are real and cited below.
> The venue RIVERSIDE, its halls, every purchase, every account and every demand number are invented; they do not reflect how these films actually sell.
> In the purchase records the films appear only under fictional aliases (`TT-101` ...), as the record specification requires [A §2].

**Film slate (checked 2026-10-05):**

| Film (demo label, alias) | Runtime | Opened in Korea | Source |
|---|---|---|---|
| The Assassin(s) (`TT-101`) | 130 min | 2026-09-23 | [Tenasia](https://www.tenasia.co.kr/article/2026091684014) |
| The Odyssey (`TT-102`) | 172 min | before the history window (8th weekend on 25-27 Sep) | runtime: [Film Stories, citing AMC](https://filmstories.co.uk/news/the-odyssey-christopher-nolan-epic-has-a-runtime-of-172-minutes/); weekend: [Screen Daily](https://www.screendaily.com/news/the-assassins-rules-koreas-chuseok-holiday-box-office-with-40-share/5220810.article) |
| Tazza: The Song of Beelzebub (`TT-103`) | 129 min | 2026-09-23 | [Cine21](https://cine21.com/movie/info/?movie_id=63246) |
| Octonauts: Above & Beyond - Heart-pounding Great Nature Adventure (`TT-104`) | 57 min | 2026-09-23 | [Cine21](https://cine21.com/movie/info/?movie_id=63372) |
| The Intern, Korean remake (`TT-105`) | 132 min | 2026-09-16 | [Geumgang Ilbo](https://www.ggilbo.com/news/articleView.html?idxno=1181861) |
| Possible Love (`TT-106`) | 164 min | 2026-09-23 | runtime: [SBS Star](https://sbsstar.net/article/N1008618169/lee-changdongs-possible-love-rated-restricted-running-time-is-164-minutes); date: [YTN](https://www.ytn.co.kr/_ln/0106_202607281124105453) |
| Furious (`TT-107`, boundary case only) | 113 min | 2026-10-07 | [BJJ Magazine](https://www.bjjmagazine.co.kr/archives/11357) |

The six films are the top-ranked current titles of the 25-27 Sep Korean weekend chart [Screen Daily, link above], plus the family title from the same chart.
Before a film opened, its slot in the fictional history held an outgoing title (Spider-Man: Brand New Day, Obsession; both on the same chart) whose rows the estimator ignores.

## 1. Decision, Scope & Problem Structure

The operator wants to use its records to understand its audience and improve movie-programming decisions, meaning which movies to screen, in which rooms, and at what times [A §1, §2].
Its current practices and decision rules are unknown [A §2].

> The venue's programming manager uses demand estimates from past purchase records, hall capacities and the confirmed film slate, before next week's schedule is published, to decide which film plays in which hall at each show slot, in order to increase expected tickets sold without breaking show commitments.

**Boundary:** one venue, one planning week (7 days × 5 fixed slots × 3 halls = 105 screen-slots), decided once before the week starts.
In the demo the records run from Mon 14 Sep to Sun 4 Oct 2026, the week of 5 Oct is already published `[ASSUMPTION]`, and the plan is for 12-18 Oct.
**Why this narrower first step:** it is the smallest scope that still contains the full programming decision (film, room, time), and the records support it only with the additional schedule log requested in Section 3.

**Exclusions and consequences:**
- Film acquisition and run length (the upstream booking decision): the film slate and per-film show limits are inputs, so we cannot say which films to book.
- Pricing, concessions, revenue: the objective is admissions, not money.
- Multi-venue coordination: sister venues competing for one audience are ignored.
- Mid-week changes: the plan cannot react to a flop inside the week.
- External signals (weather, holidays, trailers, and social-media or review comments): not in the records and excluded from this first step.
  The demo history includes the Chuseok holiday (24-26 Sep 2026), which the fictional generator does not model; real data would need a holiday flag (Section 3).
  A later add-on could classify comments as positive or negative and weight them by comment count as an early demand signal for new releases (Section 4, approach G).

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
Slots: 09:00, 12:20, 15:40, 19:00, 22:20 (200-minute slots, because The Odyssey runs 172 min and needs 192 min with cleaning); day types: weekday (Mon-Thu), weekend (Fri-Sun) `[ASSUMPTION]`.

**Inputs and settings:** hall capacities (220 / 120 / 60 seats, fictional), slot length (200 min), cleaning time (20 min), film runtimes (real, above), per-film min/max shows per week (fictional), the slate's alias-to-film mapping, caution level κ in posterior standard deviations (default 1).

**Objective:** maximize expected tickets sold in the week.
The computed metric is expected admissions under our demand estimates; the business outcome it is meant to support is actual admissions, which only a trial can measure.

**Supporting analysis (not a component):** a demand belief per film × slot × day-type cell, built in three steps (each animated in the demo's flowchart).
1. Screening noise: tickets at one screening vary around the cell mean θ as a negative binomial with shape r, i.e. a Poisson whose rate is Gamma distributed (Lec 2 conjugate table); r̂ = 8.6 by maximum likelihood over a grid (Lec 2, MLE).
2. Pattern prior: a Gaussian process over the 60 cells on $z = \log(1 + \text{tickets})$ (Lec 4).
   Its kernel is a sum (Lec 4: "$k_1 + k_2$ adds independent processes") of film, slot and weekend effects with variance τ² = 1 `[ASSUMPTION]` and a film-by-slot curve that is smooth across neighbouring slots: $v\,[f{=}f']\,e^{-(s-s')^2/2\ell^2}(\rho + (1-\rho)[t{=}t'])$.
   $\ell$, $v$, $\rho$ maximize the marginal likelihood on a grid (Lec 4); on the default data ℓ = 1.5 slots, v = 0.5, ρ = 1, from 30 tried cells.
   Each cell's prior mean and spread are the GP prediction from all *other* cells, so its own screenings are counted only once, in step 3.
   It gives every cell a prior, including the 30 of 60 cells never screened.
3. Belief: Bayes' rule evaluated on a 200-point grid of θ, prior × the likelihood of every past screening (Lec 2; exact enumeration, Lec 3).
   A sold-out screening enters through P(D ≥ seats | θ), so it raises the belief instead of capping it (53 of 212 fictional screenings).

| Component ID | Decision ID | Role: Cost / Constraint / State-transition | Model: Formulation / Simulation / Data-driven | Definition, units, and evidence / assumption / unknown |
|---|---|---|---|---|
| `expected-tickets` | `weekly-plan` | Cost (maximize) | Formulation | $\sum x_{fhds}\, v_{fhds}(\kappa)$, tickets, with $v(\kappa) = \sum_j p(\theta_j \mid \text{records})\, \mathbb{E}[\min(D, \text{seats}_h) \mid \theta_j - \kappa\sigma]$: the posterior predictive at κ = 0, its worst case within ±κ posterior sds otherwise (robust LP, Lec 1). The belief supplies parameters only, so the component stays Formulation [classification reference §3]. |
| `one-film-per-hall` | `weekly-plan` | Constraint | Formulation | $\sum_f x_{fhds} \le 1$. Hard. |
| `show-limits` | `weekly-plan` | Constraint | Formulation | $\min_f \le \sum_{h,d,s} x_{fhds} \le \max_f$. Hard. `[ASSUMPTION]` stands in for distributor commitments (TBD). |
| `no-self-clash` | `weekly-plan` | Constraint | Formulation | $\sum_h x_{fhds} \le 1$: a film never plays in two halls at once. Hard; keeps demand separable. |
| `slot-fit` | `weekly-plan` | Constraint | Formulation | $x_{fhds} = 0$ if runtime + cleaning > slot length. Hard. With 3-hour slots The Odyssey (192 min) and Possible Love (184 min) could not be shown at all (demo failure case). |

No State-transition component exists (Section 1).

**Invalid or infeasible input:** out-of-range numbers or malformed purchase rows block the run with a field- or line-specific message.
If the rules cannot all be met (e.g. minimum shows exceed open screen-slots), no plan is shown; the violated constraint, the gap and a fix are reported, and earlier results are marked stale.
Empty or partial halls are allowed (value 0).

**Follow-up (Formulation):** decision variables, objective and hard constraints are above; there are no soft constraints.
The 0/1 requirement is relaxed to $x \ge 0$; the relaxation is exact here because every coefficient is 0 or 1 and the hall rows and the film rows each form nested groups, so every vertex is whole-numbered (as for the assignment polytope in Lec 1).
The tool checks integrality on every run and refuses to show a fractional plan.
Feasibility is checked before solving and verified after.
Simulation, Feedback, Stateful and Hierarchical follow-ups: N/A for this boundary.
The hidden generator used only to create fictional data and the mock checks is not an evaluation component.

## 3. Information & Uncertainty

**Unit of record:** one completed purchase for one screening; date and time describe the screening, not the purchase [A §2].
Tickets per screening = sum of `passes_bought` per (`title_tag`, `venue_tag`, `play_day`, `curtain_time`); `title_tag` is an alias that the manager's slate maps to a film.
All inputs are available before the plan is fixed; actual admissions of the planned week are later outcomes, used only for evaluation.

**Established from the records:** tickets per observed screening, weekday/weekend and time-of-day patterns for screenings that happened, group sizes, repeat buyers and shared audiences via `account_tag`.
**Not established:** hall, capacity, runtime, price, purchase time, current practice, dataset size and quality [A §2].
Three consequences follow from the record design itself (Lec 0: a decision "changes the world it is scored in, and you never see what the alternatives would have given"):
1. A sold-out screening records capacity, not demand (53 of 212 fictional screenings).
2. A screening with zero purchases leaves no row (4 fictional screenings vanish without the schedule log).
3. Only film-time combinations someone chose to screen are observed (50% of fictional combinations were never tried).

| Fact / assumption / unknown or request | Evidence or reason for current treatment | Why it matters | How to confirm or obtain it; priority | Fallback or limit until confirmed |
|---|---|---|---|---|
| Request: screening log (film, hall, date, time) | Not in the record spec [A §2] | Reveals zero-sale screenings and sell-outs | Operator's scheduling system export; **high** | Demand analytics only; no hall assignment. Demo boundary case shows the bias. |
| Request: seats per hall | Not in the spec | Sell-out detection; value of big vs small halls | Operator facility data; **high** | Operator estimate, flagged `[ASSUMPTION]` |
| Request: runtimes, slot grid, cleaning time | Not in the spec | Feasibility (`slot-fit`); real runtimes up to 172 min break a 3-hour grid | Programming manager; **high** | Manager-supplied defaults (demo: 200-minute slots, 20 min cleaning) |
| Request: min/max show commitments | Unknown contract terms | Hard constraints (`show-limits`) | Programming manager / distributor terms; **high** | Manager enters weekly |
| Request: alias-to-film slate | Records carry aliases only [A §2] | Runtimes and limits attach to films | Programming manager with the weekly slate; **high** | No plan for an unmapped alias (its rows are ignored with a warning) |
| Request: purchase time, price | Not in the spec | Booking curves, revenue objective | Ticketing export; **medium** | Stay with admissions and a fixed weekly plan |
| Request: release dates and holiday calendar | Not in the spec; the demo history contains Chuseok (24-26 Sep) | Films age; holidays inflate demand | Manager / public calendar; **medium** | Use recent non-holiday weeks only |
| `[ASSUMPTION]` venues are independent | Keeps the decision flat | Sister venues may split one audience | Share of `account_tag`s buying at ≥2 venues; medium | Single-venue scope only |
| `[ASSUMPTION]` similar films do not steal each other's audience | Keeps the objective separable and exact | Plan may overstate tickets when similar films clash | Shared-audience overlap by `account_tag`; medium | Report as limitation |
| `[ASSUMPTION]` demand stable over the 3-week history | Films are early in their run | Films in their opening week are mis-estimated | Release dates (request above); medium | Use recent weeks only |
| TBD: refunds, walk-up sales without account, midnight `play_day` convention | Brief says "completed purchase" only [A §2] | Demand and day-type bias | Clarify with data owner; medium | Document and exclude ambiguous rows |
| TBD: admissions vs revenue as the managed KPI | No price data | Wrong objective | Ask the sponsor; high | Admissions |

**Main uncertainty and when not to trust the plan:** beliefs for untried combinations are extrapolations, and an optimizer seeks out exactly the most optimistic of them ("the optimiser will exploit the surrogate wherever it is wrong", Lec 0; the heater-layout example in Lec 1).
The GP makes the extrapolation as good as the data allow: for OCTONAUTS (a family film never screened after 15:40) its Mon-Thu 22:20 prior is 62 tickets, where the additive ridge pattern would say 166 because evening slots are strong for the other films.
It cannot make the extrapolation certain.
The caution level κ values each screening at its belief shifted down by κ posterior standard deviations, which penalizes untried combinations most (they lose 56% of their value at κ = 1, tried cells 11%).
We examined its effect with a sweep and a 40-history study (Section 5).
Even so, 18 planned screenings use untried combinations (4 of them in the 60-seat hall, where a miss costs least); the demo flags them for the manager.
The rule of thumb uses 39 such combinations without noticing.
The recommendation should not be trusted where most of the plan relies on untried combinations, when the schedule log is missing, or when any exclusion in Section 1 is active (e.g. a holiday week).

## 4. Alternatives & Selected Approach

Methods were chosen with the course's three questions (Lec 0): the model of the decision is known (linear rules), it is a single static decision per week, and demand is learned only from a fixed log.
That points to Lec 1 (LP, duality, robust LP) for the decision and Lec 2-4 (Bayesian estimation, exact inference, Gaussian processes) for the belief.
The comparison was made at two levels: whole approaches, and alternatives inside each step of the selected approach.

**Whole approaches:**

| Approach | Mechanism and required information | Strengths, limitations, and effort | Selection and reason |
|---|---|---|---|
| A: Rule of thumb | Score = last history week's tickets; quota = open screen-slots × score share, rounded, clipped to min-max, leftovers to the top-scoring films below their max; fill 19:00, 22:20, 15:40, 12:20, 09:00, largest hall first, with the top-scoring film that has quota left, fits, and is not on elsewhere at that time | Transparent; blind to time-of-day fit and hall size; low effort | Baseline, labeled a proposed reference |
| B: Belief + cautious LP | Noise by MLE (Lec 2) → GP prior (Lec 4) → Bayes on a grid (Lec 2-3) → robust value (Lec 1) → LP by two-phase simplex → duality certificate and shadow prices (Lec 1) | Exact for the stated formulation; proof of optimality; prices every limit; honest about thin data; assumes separable demand | **Selected** |
| C: Same, full trust (κ = 0) | Plan on the posterior predictive (maximum expected utility, Lec 3) | The right choice if the belief were unbiased; promises most | Rejected: mock study −271 ± 62 tickets in the homework world, −541 ± 145 with a sensible past manager |
| D: Bayesian optimisation of the schedule | Try whole schedules on the real cinema, GP over schedules, acquisition by EI/UCB (Lec 4) | Needs no demand model | Rejected: each "query" is a real week; 630 variables, far beyond the 10-20 parameters BO handles (Lec 4) |
| E: Bandit testing (UCB, Thompson sampling; Lec 4 and atlas) | Spend a few slots per week testing untried combinations, update beliefs from sales | Learns exactly what the records cannot; changes the problem to Feedback and needs weekly data flow | Stage 2+ add-on for the flagged untried screenings |
| F: MDP / reinforcement learning (course roadmap, Lec 7-8) | Sequential policy across days | Mid-week reaction; no state links decisions inside the boundary, data-hungry | Rejected for the first step |
| G: Social-media sentiment; multi-venue coordination | Comments × count as a prior for new releases; venues coordinated by prices | External data, unproven link; only if venues share customers | Roadmap |

**Alternatives inside approach B, step by step.**
For each step, the options are lecture methods; evidence marked "mock study" comes from `HW01/src/study.cjs`, which re-runs the whole pipeline with one step swapped on 40 fictional histories in each of three worlds and scores each plan against the hidden demand (Section 5).
Differences are tickets per week versus the selected method, with 95% intervals, in the order homework world, sensible manager, random history.

| Step | Option (lecture) | For | Against, with evidence | Decision |
|---|---|---|---|---|
| 1 Noise | Poisson (Lec 2, Example 2.1) | One parameter; the lecture's count model | Variance = mean; the data are e^213 times less likely at r = 200 (practically Poisson) than at r̂ = 8.6 | Rejected |
| 1 Noise | Negative binomial, r by MLE (Lec 2: Poisson-Gamma predictive; MLE) | Lets screenings swing more than Poisson | One r for all films and times | **Selected** |
| 2 Prior | None (flat) | Assumes nothing | 30 untried cells get no estimate, so they cannot be ranked; "when data is scarce the prior is doing most of the work" (Lec 2) | Rejected |
| 2 Prior | Ridge = MAP with a Gaussian prior (Lec 2) | Simple; regularisation is a prior | Effects only add up; one spread for all cells; the cell's own data counted twice. Mock study: −308 ± 53, −224 ± 119, +81 ± 120 | Rejected (it was v1's choice) |
| 2 Prior | Full Bayesian linear regression (Lec 2, backup 3) | Per-cell width from $\Sigma_w$ | Equals the GP with ℓ = 0: no curve over the day per film. Mock study: −216 ± 39, −22 ± 45, −38 ± 86 | Rejected |
| 2 Prior | Gaussian process, kernel by marginal likelihood (Lec 4) | Per-cell mean and width; neighbouring times of one film inform each other; the data choose the kernel | O(n³) in tried cells (30 here, trivial) | **Selected** |
| 3 Belief | Plain average | Simple | Sold-out screenings cap it; untried cells have none | Rejected |
| 3 Belief | Conjugate Gamma-Poisson update (Lec 2) | Closed form | Only exact counts are conjugate; the sold-out likelihood P(D ≥ seats) leaves the family | Rejected |
| 3 Belief | Sampling: rejection, likelihood weighting, Gibbs (Lec 3) | Any likelihood | Approximate; unnecessary for one unknown per cell | Rejected |
| 3 Belief | Exact enumeration on a 200-point grid (Lec 2 + Lec 3) | Any likelihood, exact up to the grid | Grid resolution | **Selected** |
| 4 Caution | Full trust, κ = 0 (Lec 2 posterior predictive, Lec 3 maximum expected utility) | Correct if the belief were unbiased | Mock study: −271 ± 62, −541 ± 145, but +313 ± 133 with a random past schedule (see below) | Rejected |
| 4 Caution | Mean-variance LP, $\bar c^\top x + \gamma x^\top \Sigma x$ (Lec 1) | Convex for γ ≥ 0 | A risk preference, not a guard against optimistic errors; repeated screenings of one cell share θ, so Σ is not diagonal and the exact form is a QP. Mock study (diagonal version, γ = 0.03): −61 ± 35, −90 ± 62, −1 ± 96. On seed 437 alone it sells more (7,836 vs 7,768), which the study shows is not typical | Rejected |
| 4 Caution | Chance constraint / ellipsoidal robust row (Lec 1, SOCP, η ≥ ½) | Protects the week total | Second-order cone loses the whole-numbered vertices; the risk sits in individual choices, not the total | Rejected |
| 4 Caution | Optimism, UCB μ + κσ (Lec 4) | Learns by trying | Needs feedback across weeks | Later stage (approach E) |
| 4 Caution | Robust box: belief − κ sd (Lec 1 robust LP) | Hits untried guesses hardest; stays an LP, since with x ≥ 0 the worst case of a box is its lower corner | κ is a policy setting, calibrated only by a trial | **Selected** |
| 5 Solver | Enumeration (Lec 3) | Exact | About 7^105 ≈ 10^88 weeks | Rejected (used on tiny instances in the tests) |
| 5 Solver | Greedy fill | Fast | Cannot trade one slot against another; no proof | Rejected (it is the baseline) |
| 5 Solver | Successive convexification / trust region (Lec 1) | Non-convex problems | Not needed: the problem is already an LP | Rejected |
| 5 Solver | LP by two-phase simplex (Lec 1, atlas) | Exact; whole-numbered vertices; dual prices for free | Assumes demand adds up across screenings | **Selected** |
| 6 Proof | Trust the solver | No work | No evidence for the manager | Rejected |
| 6 Proof | Duality certificate and shadow prices (Lec 1, KKT) | A proof on every run; explains each cell | Valid for the stated formulation and small changes | **Selected** |

**Why caution is kept although full trust wins in random-history worlds:** caution helps only when the never-tried combinations were skipped for a reason.
A real programmer skips family films at 22:20 because they sell badly, so the untried cells are worse than the pattern suggests, and the optimizer would be lured into them.
When the past schedule was random, untried cells are no worse than tried ones, and caution only costs tickets.
Real schedules are chosen deliberately, so the sensible-manager world is the relevant one; the trial (Section 6) checks this.

**Concrete benefit of each component (fictional data, default inputs):**

| Weakness | Lecture method | Benefit observed in the demo |
|---|---|---|
| Screening counts swing more than Poisson | Negative binomial, MLE (Lec 2) | r̂ = 8.6; Poisson would understate the spread of every screening |
| 30 of 60 cells never screened | Gaussian process prior (Lec 4) | Every cell gets a mean and a width; OCTONAUTS Mon-Thu 22:20 starts at 62 tickets, not ridge's 166; FURIOUS (no rows) falls back to the average film |
| Sold-out screenings cap recorded tickets | Bayes' rule with the likelihood P(D ≥ seats) (Lec 2) | THE ODYSSEY Fri-Sun 19:00: all 9 screenings sold out in the 60-seat hall; plain average 67, belief 111 ± 13 |
| Optimizer chases untried guesses (Lec 0, Lec 1) | Robust value, κ posterior sds (Lec 1) | Mock: full trust sells 7,411, κ = 1 sells 7,768, rule of thumb 6,269 |
| About $7^{105} \approx 10^{88}$ weeks; greedy cannot trade | LP by two-phase simplex (Lec 1) | Exact optimum in 363 pivots; +825 expected tickets (+11.2%) |
| Is it the best? What do limits cost? | LP duality and KKT (Lec 1) | Dual bound 6,645 = plan 6,645; shadow prices below |

**Formulation:** maximize $\sum v_{fhds}(\kappa) x_{fhds}$ subject to one film per hall and time, never two halls at once, $\min_f \le \sum x_{f\cdot} \le \max_f$, and $x \ge 0$ (630 variables with default inputs).
Locked cells are fixed before solving: their hall-time and film-time are removed and the film's limits shrink by one.

**Simplex (Lec 1 and atlas):** the LP optimum sits at a vertex, and the simplex method walks from vertex to neighbouring vertex.
Phase 1 maximizes minus the sum of artificial variables until every minimum is met (168 pivots for the 41 minimum shows).
Phase 2 enters the screening whose value most exceeds the prices of the resources it uses (its reduced cost $\bar c_j = v_j - y^\top A_j$), chooses the leaving row by the ratio test, and stops when no $\bar c_j > 0$, i.e. when no feasible direction improves the objective (Lec 1 optimality condition); 195 pivots.
Each pivot moves to a neighbouring vertex, which here is a whole schedule: one screening in, one out.
Dantzig's rule is used, with Bland's rule after 60 degenerate pivots to prevent cycling.

**Certificate and shadow prices (duality, KKT; Lec 1):** the dual prices are read from the final tableau: one price per hall-time, per film-time and per show limit.
No screening is worth more than the prices of the three resources it uses (all reduced costs ≤ 0), so the sum of all prices bounds every feasible week from above (weak duality).
It equals the plan, 6,645 = 6,645, which proves optimality for the stated formulation.
Scheduled screenings pay their prices exactly (complementary slackness), which is how the demo explains each cell.
Shadow prices with default inputs: each required POSSIBLE LOVE show costs 4.3 cautious tickets; a second 220-seat hall on Fri 19:00 would add about 135; no show maximum binds, so all other limits are slack and free.
They are valid for small changes only.

All steps and the baseline can be replayed step by step in `demo.html` (clickable flowchart, Section 5).

**Selected flow:** validate inputs → map aliases to films and sum purchases per screening → screening noise → GP prior per cell → Bayes belief per cell → robust value of each (film, hall, slot) → solve the LP by simplex → verify integrality, constraints and the duality certificate → compare with approach A on the same inputs and the same value function.
The simplex optimum was checked against brute-force enumeration on 200 random small instances, and the duality certificate is checked on every run.
It is not optimal with respect to anything the formulation omits, and its value depends on the beliefs.
The simplex is deterministic (fixed pivot rules) and the GP kernel search is a fixed grid, so results are reproducible.
Randomness only generates the fictional history (seeded PRNG, seed 437).
Actual calculations: all of the above.
Mock: the hidden generator used to score the caution sweep, the alternatives scoreboard and the study.
Not implemented: approaches C-G as production features (C and the step alternatives run only inside the comparison), pricing, holidays, film ageing, mid-week changes, two halls showing one film at once.

## 5. Demonstration & Evaluation

**How to use `demo.html`:** open it in a desktop browser (no server or internet).
It loads the fictional data and runs once.
"Watch the week" plays both plans side by side on a clock with day and time: every expected ticket is a person who walks in, takes a seat, watches and leaves, and people turned away from a full hall walk back out; counters fill as people sit down.
"Why this is an optimization" shows the biggest win, an accepted loss, week totals and the untried screenings ("calculated bets").
Click any schedule cell to see the ranked alternatives; for the optimized plan the drawer shows each film's value against the dual prices of hall, film-time and show.
"How the plan is found" is a clickable flowchart: the rule of thumb in its own lane, and SLOTWISE's six steps in the other, joined by the input and a comparison box.
Each box opens an animation on the current data (purchase rows summed into a screening, the likelihood curve over r, the GP conditioned cell by cell with its marginal-likelihood grid, the belief updated screening by screening, κ pulling untried cells down, the greedy fill, every simplex pivot as a schedule, the duality check slot by slot), the lecture result it uses quoted as taught, how it was applied, and its alternatives with evidence.
The comparison box re-runs every alternative on the current inputs against the hidden truth and shows the 40-history study; one column can be re-run in the browser.
Change hall seats, slot length, cleaning time, film limits, the schedule-log switch, κ, the pattern prior (GP, full Bayesian regression, ridge), the caution rule (robust, mean-variance), extra purchase rows or the seed, press Run, and compare again.
The run fingerprint (default `98822f30`) is identical for identical inputs; "Reset" restores the defaults.
Checked in Chromium (Playwright, offline context): no network requests, no console errors, no horizontal overflow at 1440, 1024 and 390 px; all seven test cases pass in the page.
Firefox: Not run.

**Baseline, metrics, conditions:** approach A and B use the same inputs and the same value function.
Metric: expected tickets per week (posterior predictive, κ = 0).
Secondary: expected turned-away customers and empty seats, the decision value the optimizer maximizes (κ = 1), and the number of untried combinations each plan relies on.
The mock checks score plans against the fictional generator and are kept apart from the belief that drives the decision.

**Default result (fictional):** optimized 8,209 vs rule of thumb 7,384 expected tickets (+825, +11.2%).
Decision value 6,645 vs 5,327; expected turned away 1,133 → 774; expected empty seats 6,616 → 5,791; 0 rules broken in both.
Biggest single change: Fri 09:00 (+94).
Accepted loss: Fri 22:20 (−22), traded for larger gains elsewhere under the shared show limits.

**Caution sweep (mock, seed 437):** at κ = 0 the model promises 8,316 tickets, but the simulated cinema sells 7,411.
At κ = 0.5 and κ = 1 it sells 7,768, at κ = 2 7,464, at κ = 3 7,437; the rule of thumb sells 6,269.
This shows the mechanism (an optimizer exploiting guesses about untried combinations) in a world where the truth is known; it does not calibrate κ for a real venue, which is a Stage 1-2 task.

**Mock study of the alternatives (`node HW01/src/study.cjs`, 40 histories per world):** expected tickets sold, mean, with the gap to the oracle that plans with the true demand in brackets.

| Method | Homework world | Sensible manager | Random history |
|---|---|---|---|
| Rule of thumb | 6,429 (19.9%) | 7,545 (20.8%) | 7,030 (26.2%) |
| Ridge prior + robust κ = 1 | 7,512 (6.4%) | 8,814 (7.4%) | 7,969 (16.3%) |
| Full Bayesian regression + robust κ = 1 | 7,603 (5.3%) | 9,015 (5.3%) | 7,850 (17.5%) |
| GP prior, full trust κ = 0 | 7,548 (6.0%) | 8,497 (10.7%) | 8,201 (13.9%) |
| GP prior + mean-variance γ = 0.03 | 7,758 (3.4%) | 8,948 (6.0%) | 7,888 (17.1%) |
| **GP prior + robust κ = 1 (selected)** | **7,820 (2.6%)** | **9,038 (5.1%)** | 7,888 (17.1%) |
| Oracle (true demand known) | 8,028 | 9,520 | 9,520 |

Homework world: the demo's hidden demand, data seeds 1-40.
Sensible manager: random hidden demand per world, past schedule chosen by a noisy but sensible programmer.
Random history: the same demand, random past schedule.
The selected method is best or tied-best in the first two worlds; in the third, full trust is better (+313 ± 133), for the reason given in Section 4.

| Case | Inputs / reproduction steps | Expected result / pass criterion | Observed result and supported conclusion |
|---|---|---|---|
| Normal | Defaults (Test cases: "Default week") | Feasible; 0 violations in both plans; proposed ≥ baseline on the decision value | Pass: decision value 6,645 vs 5,327 (+1,318), 0 violations; dual bound equals the plan |
| Boundary | Add FURIOUS, which opened 7 Oct after the records end (zero purchase rows), 5-21 shows | Valid plan; ≥ 5 shows; its demand is prior-only and flagged | Pass: 5 shows, no evidence cells, prior-only warning shown |
| Boundary | Hall 3 capacity 0 | Valid plan without Hall 3 | Pass: 0 screenings in Hall 3 |
| Boundary | Schedule log not provided | Plan with fallback warning; no sell-outs detected | Pass: 208 of 212 slate screenings visible, 0 sell-outs detected, warning shown |
| Failure | Hall 2 and Hall 3 closed | No plan; reports the `one-film-per-hall` capacity gap (41 vs 35) | Pass: "Minimum shows add up to 41 but only 35 screen-slots are open", fix suggested, results marked stale |
| Failure | Slot length 180 min (a 3-hour grid) | No plan; explains `slot-fit` for the two long films | Pass: "THE ODYSSEY needs 192 min (172 runtime + 20 changeover) but slots are 180 min ..." and the same for POSSIBLE LOVE (184 min) |
| Failure | Purchase row `TT-106,RIVERSIDE,2026-10-03,19:00,AC-0042,0` | No plan; line-numbered validation error | Pass: "Extra row 1: passes_bought "0" must be a positive whole number of tickets" (engine test and demo test case) |

**Established:** the mechanism works end to end on fictional data, the plan is optimal for the stated formulation (duality certificate), constraints and failures are handled, results are reproducible, and in simulated cinemas with known demand the selected combination beats each lecture alternative on average where the past schedule was chosen sensibly.
Automated tests (20, `node --test`) cover a textbook LP with known duals, brute-force optimality, the certificate, integral vertices, the sold-out likelihood, the GP's kernel choice and leave-own-cell-out prior, aliases-only records, the caution effect and the alternatives scoreboard.
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
| 1: Make the caution level meaningful | First model: Gamma-Poisson posterior with the prior worth k pseudo-screenings | Rejected after a test run: untried cells got tiny spreads, so caution changed almost nothing and the plan kept a family film late at night. v1 then measured one prior spread by leaving each tried cell out. | Superseded by discussion 2: the GP gives each cell its own spread from the marginal likelihood. Section 2; demo caution step; proposal caution slide |
| 2: Methods must come from the course, and be the best the course offers | v1: EM imputation, min-cost flow and a subgradient check, then (after review) ridge = MAP. On 2026-10-05, after re-reading slides 00-04: replace the ridge prior by a Gaussian process (Lec 4) and compare every step with its lecture alternatives | EM, flows and subgradients were rejected as not taught. For the GP: checked each formula against the Lec 4 slides; ran the 40-history study in three worlds (Section 5: +308 ± 53 tickets over ridge in the homework world, +224 ± 119 with a sensible manager, not significant with a random history); tests for the kernel choice and the leave-own-cell-out prior. The same review found that v1's showcase cell (belief 102 against a hidden truth of 70) was misleading | GP prior selected; ridge and full Bayesian regression kept as switchable alternatives; per-step alternatives in Section 4, the demo flowchart and proposal slides 10 and 19 |
| 3: Use real films | Replace the invented titles with films now showing (CGV / Korean box office) | Accepted with limits: the brief requires fictional aliases in `title_tag` and an invented dataset [A §2]. Titles, runtimes and dates verified against the cited pages; real titles appear only in the manager's slate, demand stays invented, disclaimer in all three files. A test asserts no real title appears in the records. Introducing aliases broke the rule of thumb (all scores became 1); it was found because the study's baseline numbers were identical across two worlds, fixed, and covered by a test | Slate table above; Section 2 slot grid (The Odyssey's 172 min forced 200-minute slots, which became a failure case); demo and proposal disclaimers |
| 4: Classifying the ticket objective and wording the baseline | Classify `expected-tickets` as Formulation because the forecast only supplies a parameter; describe the rule of thumb as the operator's current practice | First accepted after checking the classification reference §3; second rejected because current practice is unspecified [A §2] | Section 2 component table; baseline labeled "proposed reference" in Sections 1 and 4, demo and proposal |

Other LLM-assisted reviews (a project-manager scope review and role-played client questions) informed Sections 1, 3 and 6 but are not part of the submission.
