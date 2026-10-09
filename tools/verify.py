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
        if width == 1440:
            note = page.inner_text('#runAllNote')
            check('7 of 7 cases pass' in note, 'demo: all 7 test cases pass in the page (' + note + ')')
            fp0 = page.evaluate('SLOTWISE.result.fingerprint')
            check(fp0 == page.inner_text('#fpDefault'), 'demo: default fingerprint shown in "What is real" matches the run')
            # input -> run -> inspect -> modify -> run again
            page.fill('#seed', '438'); page.click('#run'); page.wait_for_timeout(600)
            fp1 = page.evaluate('SLOTWISE.result.fingerprint')
            check(fp1 != fp0, 'demo: changing the seed and pressing Run changes the result')
            check('438' in page.url, 'demo: settings are kept in the page address')
            page.reload(); page.wait_for_timeout(1000)
            check(page.evaluate('SLOTWISE.result.fingerprint') == fp1, 'demo: reload with the same address reproduces the same fingerprint')
            page.click('#reset'); page.wait_for_timeout(800)
            check(page.evaluate('SLOTWISE.result.fingerprint') == fp0, 'demo: Reset restores the default fingerprint')
            rows0 = page.evaluate('SLOTWISE.result.rowCount')
            page.fill('#slots', '4'); page.click('#run'); page.wait_for_timeout(600)
            check(page.evaluate('SLOTWISE.result.rowCount') != rows0 and page.evaluate('SLOTWISE.result.times.length') == 4, 'demo: fewer show-times regenerate the history and the grid')
            page.click('#reset'); page.wait_for_timeout(600)
            # failure: close halls 2 and 3 -> no plan, explanation, stale
            page.uncheck('[data-open="1"]'); page.uncheck('[data-open="2"]'); page.click('#run'); page.wait_for_timeout(500)
            txt = page.inner_text('#heroAlert')
            check('42 but only 35' in txt and 'stale' in page.evaluate('document.body.className'), 'demo: infeasible settings show the explanation and mark results stale')
            desc = page.inner_text('#heroDesc')
            check('No plan is shown' in desc and 'No other week scores higher' not in desc, 'demo: on failure the headline no longer shows the previous success claim')
            page.click('#reset'); page.wait_for_timeout(600)
            check('stale' not in page.evaluate('document.body.className'), 'demo: a valid run clears the stale state')
            # inspect a plan cell, pin a film, re-run
            page.click('#planB [data-pc]', timeout=3000); page.wait_for_timeout(300)
            check(page.locator('#modalBody table').count() >= 1, 'demo: clicking a plan cell opens ranked alternatives')
            pin = page.locator('#modalBody [data-pin]').first
            if pin.count():
                pin.click(); page.wait_for_timeout(700)
                check(len(page.evaluate('Object.keys(SLOTWISE.settings.pins)')) == 1 and page.evaluate('SLOTWISE.result.proposed.certificateOk'), 'demo: pinning a film re-runs and keeps a certified plan')
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
            if ov[0] > 0 or not ov[1]: overflow.append(i + 1)
            page.keyboard.press('ArrowRight'); page.wait_for_timeout(80)
        check(8 <= n <= 13, f'[{w}x{h}] deck has {n} slides')
        check(not overflow, f'[{w}x{h}] every slide fits the window without clipped content {overflow}')
        check(not errs and not reqs, f'[{w}x{h}] deck: no console errors or network requests {errs[:2]} {reqs[:2]}')
        if w == 1600:
            page.keyboard.press('Home'); page.wait_for_timeout(200)
            href = page.get_attribute('.slide.on a.btn.play', 'href')
            check(href == 'demo.html', 'deck: first slide links to demo.html relatively')
            page.click('.slide.on a.btn.play'); page.wait_for_timeout(1200)
            check(page.url.endswith('/demo.html') or 'demo.html' in page.url, 'deck: the demo link opens demo.html offline')
            check(page.locator('#heroMeta .match').count() == 1, 'deck: the linked demo runs')
        ctx.close()
    b.close()

# text checks on the sources of truth
md = (root / 'problem-definition.md').read_text()
for h in ['## 1. Decision, Scope & Problem Structure', '## 2. Computable Problem', '## 3. Information & Uncertainty', '## 4. Alternatives & Selected Approach', '## 5. Demonstration & Evaluation', '## 6. Client Proposal', '## 7. LLM Review & Key Revisions']:
    check(h in md, 'definition keeps heading ' + h)
for f in ('problem-definition.md', 'demo.html', 'proposal.html'):
    t = (root / f).read_text()
    check('—' not in t, f + ': no em dash')
import json
N = json.loads((root / 'src' / 'numbers.json').read_text())
for k in ('propTickets', 'baseTickets', 'gainTickets', 'gainPct', 'truthProp', 'truthBase', 'oracle', 'fingerprint', 'objective', 'baseUntriedEst', 'baseUntriedTrue', 'progTruth', 'stSel', 'stProg', 'exPost', 'exAlpha', 'exBeta', 'lpPivots', 'oraclePct', 'truthPct'):
    check(N[k] in md, f'definition quotes {k} = {N[k]} as computed by the engine')
print('\n' + ('ALL CHECKS PASSED' if not fails else f'{len(fails)} CHECK(S) FAILED'))
sys.exit(1 if fails else 0)
