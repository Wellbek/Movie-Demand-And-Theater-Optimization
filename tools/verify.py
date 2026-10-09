# End-to-end check of the two submitted HTML files, offline, as a user would use them.
# Usage: python tools/verify.py   (from the repository root; needs Python Playwright + Chromium)
import pathlib, sys, re
from playwright.sync_api import sync_playwright

root = pathlib.Path(__file__).resolve().parent.parent
demo, deck = (root / 'demo.html').as_uri(), (root / 'proposal.html').as_uri()
fails = []
def check(cond, msg):
    print(('PASS ' if cond else 'FAIL ') + msg)
    if not cond: fails.append(msg)

with sync_playwright() as p:
    b = p.chromium.launch()
    for width in (1440, 1024, 390):
        ctx = b.new_context(viewport={'width': width, 'height': 900}, offline=True, accept_downloads=True)
        page = ctx.new_page()
        errs, reqs = [], []
        page.on('console', lambda m: errs.append(m.text) if m.type in ('error', 'warning') else None)
        page.on('pageerror', lambda e: errs.append(str(e)))
        page.on('request', lambda r: reqs.append(r.url) if not r.url.startswith(('file:', 'data:', 'blob:')) else None)
        page.goto(demo); page.wait_for_timeout(1200)
        check(page.locator('#heroMeta .match').count() == 1, f'[{width}] demo runs on open (hero shows a result)')
        check(page.evaluate('document.documentElement.scrollWidth - document.documentElement.clientWidth') <= 0, f'[{width}] demo has no horizontal page scroll')
        check(page.evaluate("document.getElementById('heroTitle').getBoundingClientRect().top >= document.getElementById('nav').getBoundingClientRect().bottom"), f'[{width}] demo: the title is not under the navigation bar')
        if width == 1440:
            note = page.inner_text('#runAllNote')
            check('7 of 7 cases pass' in note, 'demo: all 7 test cases pass in the page (' + note + ')')
            KEY = 'JSON.stringify([APP.result.proposed.plan, APP.result.baseline.plan, APP.result.rowCount])'
            fp0 = page.evaluate(KEY)
            # input -> run -> inspect -> modify -> run again
            page.fill('#seed', '438'); page.click('#run'); page.wait_for_timeout(600)
            fp1 = page.evaluate(KEY)
            check(fp1 != fp0, 'demo: changing the seed and pressing Run changes the result')
            check('#' not in page.url and '438' not in page.url, 'demo: settings are not written into the page address')
            page.fill('#seed', '438'); page.click('#run'); page.wait_for_timeout(600)
            check(page.evaluate(KEY) == fp1, 'demo: the same settings run again give the same plans')
            page.reload(); page.wait_for_timeout(1000)
            check(page.evaluate(KEY) == fp0 and page.input_value('#seed') == '437', 'demo: a reload starts from the default settings')
            rows0 = page.evaluate('APP.result.rowCount')
            page.fill('#slots', '4'); page.click('#run'); page.wait_for_timeout(600)
            check(page.evaluate('APP.result.rowCount') != rows0 and page.evaluate('APP.result.times.length') == 4, 'demo: fewer show-times regenerate the history and the grid')
            page.click('#reset'); page.wait_for_timeout(600)
            check(page.evaluate(KEY) == fp0, 'demo: Reset restores the default plans')
            # failure: close halls 2 and 3 -> no plan, explanation, stale
            page.uncheck('[data-open="1"]'); page.uncheck('[data-open="2"]'); page.click('#run'); page.wait_for_timeout(500)
            txt = page.inner_text('#heroAlert')
            check('42 but only 35' in txt and 'stale' in page.evaluate('document.body.className'), 'demo: infeasible settings show the explanation and mark results stale')
            desc = page.inner_text('#heroDesc')
            check('No plan for these settings' in desc and 'duality check' not in desc, 'demo: on failure the headline no longer shows the previous success claim')
            page.click('#reset'); page.wait_for_timeout(600)
            check('stale' not in page.evaluate('document.body.className'), 'demo: a valid run clears the stale state')
            # inspect a plan cell, pin a film, re-run
            page.click('#planB [data-pc]', timeout=3000); page.wait_for_timeout(300)
            check(page.locator('#modalBody table').count() >= 1, 'demo: clicking a plan cell opens ranked alternatives')
            pin = page.locator('#modalBody [data-pin]').first
            if pin.count():
                pin.click(); page.wait_for_timeout(700)
                check(len(page.evaluate('Object.keys(APP.settings.pins)')) == 1 and page.evaluate('APP.result.proposed.certificateOk'), 'demo: pinning a film re-runs and keeps a certified plan')
            page.click('#clearPins'); page.wait_for_timeout(500)
            # demand cell explanation
            page.click('#heat [data-cell]'); page.wait_for_timeout(300)
            check('posterior mean' in page.inner_text('#modalBody').lower(), 'demo: a demand cell shows prior, evidence and posterior')
            page.keyboard.press('Escape')
            # CSV download
            with page.expect_download() as dl:
                page.click('#dlCsv')
            path = dl.value.path()
            head = open(path).readline().strip()
            check(head == 'title_tag,venue_tag,play_day,curtain_time,account_tag,passes_bought', 'demo: CSV download has exactly the six teaching fields')
            # one title row, per-film gain vs baseline, figures drawn, cinema step control
            check(page.locator('#slateRow .card').count() == page.evaluate('APP.result.slate.length') and page.locator('#top10').count() == 0, 'demo: a single title row with one card per film')
            check(page.locator('#slateRow .card .delta').first.inner_text().endswith('tickets vs baseline'), 'demo: film cards show tickets vs baseline')
            blank = page.evaluate("""() => ['heroArt','figAgg','figMle','figBayes','figPred','figCaution','figLp','figDual','simCanvas','simChart'].filter(id => { const c = document.getElementById(id); if (!c || !c.width) return true; const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; for (let i = 3; i < d.length; i += 16) if (d[i]) return false; return true; })""")
            check(not blank, 'demo: every animated figure draws something ' + str(blank))
            page.fill('#simStep', '20'); page.press('#simStep', 'Enter'); page.wait_for_timeout(400)
            check('step 20 of 35' in page.inner_text('#simWhen') and page.input_value('#simSlider') == '20', 'demo: typing step 20 moves the cinema animation and the slider')
            check('Now showing' in page.inner_text('#simWhen'), 'demo: a chosen step shows the screening in progress')
            check(page.locator('.narr .ntext').count() == 7 and all(t.strip() for t in page.locator('.narr .ntext').all_inner_texts()), 'demo: every How-it-works figure has a narration line')
            check('TOP' not in page.inner_text('#heroTop') and 'whole week' in page.inner_text('#heroTop'), 'demo: headline states the whole-week gain, no rank badge')
            check(page.inner_text('footer .byline') == 'Louis Wellmeyer - 20264059' and 'Companion files' not in page.inner_text('footer'), 'demo: footer shows name and student number only')
            page.evaluate('window.scrollTo(0, 0)'); page.click('#runTop'); page.wait_for_timeout(1500)
            check(page.evaluate("Math.abs(document.getElementById('compare').getBoundingClientRect().top) < 140") and page.evaluate('Figures.sim.playing'), 'demo: Run plan jumps to the comparison and plays the week')
            page.click('#randomize'); page.wait_for_timeout(1200)
            check(page.evaluate('APP.result.status') == 'ok' and page.evaluate('APP.settings.caution') == 0.5, 'demo: Randomize draws new settings, keeps caution, and runs')
            page.click('#reset'); page.wait_for_timeout(800)
            # mock comparison button
            page.click('#scoreAlt'); page.wait_for_timeout(1500)
            check('Rule of thumb' in page.inner_text('#altTable'), 'demo: alternatives can be re-scored in the browser')
            page.click('#bruteBtn'); page.wait_for_timeout(1500)
            note = page.inner_text('#studyNote')
            m = re.search(r'Brute force: (\d+) of (\d+)', note)
            check(bool(m) and m.group(1) == m.group(2) and int(m.group(2)) > 30, 'demo: brute-force check agrees with the simplex in the browser (' + note[:70] + ')')
        check(not errs, f'[{width}] demo: no console errors {errs[:2]}')
        check(not reqs, f'[{width}] demo: no network requests {reqs[:2]}')
        ctx.close()

    # short windows: the billboard grows instead of pushing the title under the navigation bar
    for (w, h) in ((1280, 720), (1366, 640), (1920, 1080)):
        ctx = b.new_context(viewport={'width': w, 'height': h}, offline=True)
        page = ctx.new_page(); page.goto(demo); page.wait_for_timeout(900)
        check(page.evaluate("document.getElementById('heroTitle').getBoundingClientRect().top >= document.getElementById('nav').getBoundingClientRect().bottom"), f'[{w}x{h}] demo: the title is not under the navigation bar')
        ctx.close()

    # proposal
    for (w, h) in ((1600, 900), (1280, 720), (1920, 1080), (1024, 768)):
        ctx = b.new_context(viewport={'width': w, 'height': h}, offline=True)
        page = ctx.new_page()
        errs, reqs = [], []
        page.on('console', lambda m: errs.append(m.text) if m.type in ('error', 'warning') else None)
        page.on('pageerror', lambda e: errs.append(str(e)))
        page.on('request', lambda r: reqs.append(r.url) if not r.url.startswith(('file:', 'data:', 'blob:')) else None)
        page.goto(deck); page.wait_for_timeout(500)
        n = page.evaluate("document.querySelectorAll('.slide').length")
        overflow = []
        for i in range(n):
            ov = page.evaluate("""() => { const s = document.querySelector('.slide.on'); const r = s.getBoundingClientRect(); const sc = r.width / 1600; let worst = 0;
              s.querySelectorAll('*').forEach(el => { if (el.closest('.art')) return; const q = el.getBoundingClientRect(); if (!q.width || !q.height) return; worst = Math.max(worst, (q.bottom - r.bottom) / sc, (q.right - r.right) / sc); });
              s.querySelectorAll('.card,.stage-card,.kpi,.box').forEach(c => { worst = Math.max(worst, c.scrollHeight - c.clientHeight - 2); });
              const stage = document.getElementById('stage').getBoundingClientRect();
              return [worst, stage.left >= -1 && stage.top >= -1 && stage.right <= innerWidth + 1 && stage.bottom <= innerHeight + 1]; }""")
            if ov[0] > 0.5 or not ov[1]: overflow.append(i + 1)  # sub-pixel rounding tolerated
            page.keyboard.press('ArrowRight'); page.wait_for_timeout(80)
        check(8 <= n <= 13, f'[{w}x{h}] deck has {n} slides')
        check(not overflow, f'[{w}x{h}] every slide fits the window without clipped content {overflow}')
        check(not errs and not reqs, f'[{w}x{h}] deck: no console errors or network requests {errs[:2]} {reqs[:2]}')
        if w == 1600:
            page.keyboard.press('Home'); page.wait_for_timeout(300)
            check(not page.evaluate("document.body.classList.contains('chrome-on')"), 'deck: player controls hidden until the mouse moves')
            page.mouse.move(800, 450); page.mouse.move(810, 460); page.wait_for_timeout(300)
            check(page.evaluate("document.body.classList.contains('chrome-on')") and 'Slide 1:' in page.inner_text('#ttl'), 'deck: controls appear on mouse movement with the slide title')
            page.wait_for_timeout(2900)
            check(not page.evaluate("document.body.classList.contains('chrome-on')"), 'deck: controls fade out when the mouse is still')
            check(page.evaluate("document.querySelectorAll('.slide .sn').length") == n and page.inner_text('.slide.on .sn') == 'Slide 1', 'deck: slides are numbered "Slide n"')
            check(page.evaluate("document.querySelectorAll('.slide .byl').length") == n and page.inner_text('.slide.on .byl') == 'Louis Wellmeyer - 20264059' and page.locator('.slide.on .keys kbd').count() == 2, 'deck: every slide shows the name and student number and the arrow keys')
        ctx.close()
    b.close()

# text checks on the sources of truth
md = (root / 'problem-definition.md').read_text()
for h in ['## 1. Decision, Scope & Problem Structure', '## 2. Computable Problem', '## 3. Information & Uncertainty', '## 4. Alternatives & Selected Approach', '## 5. Demonstration & Evaluation', '## 6. Client Proposal', '## 7. LLM Review & Key Revisions']:
    check(h in md, 'definition keeps heading ' + h)
for f in ('problem-definition.md', 'demo.html', 'proposal.html'):
    t = (root / f).read_text()
    check('—' not in t, f + ': no em dash')
    for bad in ('SLOTWISE', 'RIVERSIDE', 'fingerprint', 'programming manager', 'Your six') + (('Episode',) if f != 'problem-definition.md' else ()):
        check(bad.lower() not in t.lower(), f + ': no "' + bad + '"')
for f in ('demo.html', 'proposal.html'):
    t = (root / f).read_text()
    check('[ASSUMPTION]' not in t and 'href="demo.html"' not in t if f == 'proposal.html' else '[ASSUMPTION]' not in t, f + ': no bare [ASSUMPTION] labels' + (' and no demo link' if f == 'proposal.html' else ''))
import json
N = json.loads((root / 'src' / 'numbers.json').read_text())
for k in ('propTickets', 'baseTickets', 'gainTickets', 'gainPct', 'truthProp', 'truthBase', 'oracle', 'objective', 'swTruthWins', 'swMeanGain', 'swWorst', 'baseUntriedEst', 'baseUntriedTrue', 'progTruth', 'stSel', 'stProg', 'exPost', 'exAlpha', 'exBeta', 'lpPivots', 'oraclePct', 'truthPct'):
    check(N[k] in md.replace('\u2212', '-'), f'definition quotes {k} = {N[k]} as computed by the engine')
print('\n' + ('ALL CHECKS PASSED' if not fails else f'{len(fails)} CHECK(S) FAILED'))
sys.exit(1 if fails else 0)
