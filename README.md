# Movie programming: weekly showtime planning (IE437 Assignment 1)

The submission is exactly three files at the repository root:

| File | What it is |
|---|---|
| `problem-definition.md` | Problem definition in the course's seven-section template |
| `demo.html` | Interactive demonstration (opens offline in a desktop browser) |
| `proposal.html` | Proposal deck for the fictional cinema operator (12 slides, links to `demo.html`) |

Both HTML files are build outputs; edit the sources in `src/` and rebuild.
Everything else in this repository is tooling and is not part of the submission.

## Build, test, verify

```sh
cd src && npm install          # KaTeX, used at build time only (formulas are pre-rendered)
node --test                    # engine tests
node study.cjs 40              # mock study over 40 fictional histories, writes study.json
node build.cjs                 # writes ../demo.html, ../proposal.html and numbers.json
cd .. && python tools/verify.py   # offline end-to-end browser checks (Playwright + Chromium)
tools/make_zip.sh <studentID> <name>   # packs the three deliverables
```

| Path | Purpose |
|---|---|
| `src/engine.js` | All calculations: fictional history generator, validation, demand estimate, LP solver, baseline, checks, test cases. Runs in the browser and in Node. |
| `src/app.js`, `src/demo.template.html` | Demo user interface |
| `src/proposal.template.html`, `src/numbers.cjs` | Deck; every number is computed from the engine at build time |
| `src/engine.test.cjs` | Node tests (brute-force optimality, determinism, record format, cases) |
| `src/study.cjs` | Mock study used to choose the estimate and its defaults |
| `tools/verify.py` | Offline browser checks of both HTML files at several window sizes |
| `tools/shoot.py`, `tools/shoot_deck.py` | Screenshots for visual review |

The build fails if a file references an external resource, contains an em dash or leaves a placeholder.
