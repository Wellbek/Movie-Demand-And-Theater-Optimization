# Quick visual check: full-page and section screenshots of a built HTML file, offline.
# Usage: python tools/shoot.py demo.html outdir [width]
import sys, pathlib
from playwright.sync_api import sync_playwright
src = pathlib.Path(sys.argv[1]).resolve(); out = pathlib.Path(sys.argv[2]); out.mkdir(parents=True, exist_ok=True)
width = int(sys.argv[3]) if len(sys.argv) > 3 else 1440
with sync_playwright() as p:
    b = p.chromium.launch()
    ctx = b.new_context(viewport={'width': width, 'height': 900}, offline=True)
    page = ctx.new_page()
    errs, reqs = [], []
    page.on('console', lambda m: errs.append(m.type + ': ' + m.text) if m.type in ('error', 'warning') else None)
    page.on('pageerror', lambda e: errs.append('pageerror: ' + str(e)))
    page.on('request', lambda r: reqs.append(r.url) if not r.url.startswith(('file:', 'data:', 'blob:')) else None)
    page.goto(src.as_uri()); page.wait_for_timeout(1500)
    page.screenshot(path=str(out / f'full-{width}.png'), full_page=True)
    ids = page.evaluate("Array.from(document.querySelectorAll('section[id], header[id]')).map(e => e.id)")
    for i in ids:
        el = page.locator('#' + i)
        try: el.screenshot(path=str(out / f'{i}-{width}.png'))
        except Exception as e: print('shot fail', i, e)
    ow = page.evaluate("document.documentElement.scrollWidth - document.documentElement.clientWidth")
    print('errors', errs); print('external requests', reqs); print('horizontal overflow px', ow)
    b.close()
