# Screenshot every slide of proposal.html offline and report content that leaves the 1600x900 slide.
# Usage: python tools/shoot_deck.py proposal.html outdir [width height]
import sys, pathlib
from playwright.sync_api import sync_playwright
src = pathlib.Path(sys.argv[1]).resolve(); out = pathlib.Path(sys.argv[2]); out.mkdir(parents=True, exist_ok=True)
W = int(sys.argv[3]) if len(sys.argv) > 3 else 1600; H = int(sys.argv[4]) if len(sys.argv) > 4 else 900
with sync_playwright() as p:
    b = p.chromium.launch(); ctx = b.new_context(viewport={'width': W, 'height': H}, offline=True); page = ctx.new_page()
    errs = []; page.on('console', lambda m: errs.append(m.text) if m.type in ('error', 'warning') else None); page.on('pageerror', lambda e: errs.append(str(e)))
    page.goto(src.as_uri()); page.wait_for_timeout(500)
    n = page.evaluate("document.querySelectorAll('.slide').length")
    bad = 0
    for i in range(n):
        page.keyboard.press('Home')
        for _ in range(i): page.keyboard.press('ArrowRight')
        page.wait_for_timeout(600)
        ov = page.evaluate("""() => { const s = document.querySelector('.slide.on'); const r = s.getBoundingClientRect(); const sc = r.width/1600; let worst = 0, who='';
          s.querySelectorAll('*').forEach(el => { if (el.closest('.art, .byl, .keys')) return; const q = el.getBoundingClientRect(); if (q.width===0||q.height===0) return;
            const over = Math.max(q.bottom - (r.bottom - 40*sc), q.right - r.right)/sc; if (over > worst) { worst = over; who = el.tagName + ' ' + (el.textContent||'').trim().slice(0,50); } });
          s.querySelectorAll('.card, .stage-card, .kpi, .box').forEach(c => { const o = (c.scrollHeight - c.clientHeight); if (o > 2 && o > worst) { worst = o; who = 'clipped inside ' + c.className + ': ' + (c.textContent||'').trim().slice(0,40); } });
          return [Math.round(worst), who]; }""")
        if ov[0] > 0: bad += 1
        print(i + 1, 'beyond bottom margin by', ov[0], 'px', ov[1] if ov[0] > 0 else '')
        page.screenshot(path=str(out / f'slide{i+1:02d}.png'))
    print('slides', n, 'with overflow', bad, 'errors', errs)
    b.close()
