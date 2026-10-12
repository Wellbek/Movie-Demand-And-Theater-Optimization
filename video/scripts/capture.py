# Captures the real product screens used by the video, offline, at 1920x1080.
# Usage (from the repository root): python video/scripts/capture.py
import pathlib
from playwright.sync_api import sync_playwright

root = pathlib.Path(__file__).resolve().parents[2]
out = root / 'video' / 'public'; out.mkdir(parents=True, exist_ok=True)

def top(page, sel, pad=70):
    page.evaluate("([s, p]) => scrollTo(0, document.querySelector(s).getBoundingClientRect().top + scrollY - p)", [sel, pad])
    page.wait_for_timeout(900)

with sync_playwright() as p:
    b = p.chromium.launch()
    ctx = b.new_context(viewport={'width': 1920, 'height': 1080}, device_scale_factor=1.5, offline=True)
    page = ctx.new_page()
    page.goto((root / 'demo.html').as_uri()); page.wait_for_timeout(2500)
    shot = lambda name: page.screenshot(path=str(out / f'{name}.png'))
    shot('demo-hero')
    page.click('#runTop'); page.wait_for_timeout(1500)
    for sel, name in [('#settings', 'demo-settings'), ('#records', 'demo-records'), ('#demand', 'demo-demand')]:
        top(page, sel); shot(name)
    top(page, '#plan'); page.click('#dayTabs button:nth-child(6)'); page.wait_for_timeout(900); shot('demo-plan')
    page.locator('#planB [data-pc]').nth(10).click(); page.wait_for_timeout(1200); shot('demo-cell')
    page.keyboard.press('Escape'); page.wait_for_timeout(600)
    top(page, '#compare', -150); page.click('#simPlay'); page.wait_for_timeout(7000); shot('demo-sim')
    page.click('#simPlay'); top(page, '#kpis', 20); shot('demo-kpis')
    top(page, '#certPanel', 20); shot('demo-cert')
    top(page, '#sweepPanel', 20); shot('demo-sweep')
    top(page, '#how'); page.wait_for_timeout(3000); shot('demo-how')
    top(page, '#checks'); shot('demo-checks')
    page.goto((root / 'proposal.html').as_uri()); page.wait_for_timeout(2000)
    for i in range(1, 13):
        if i in (1, 2, 3, 5, 8, 9, 10): shot(f'deck-{i:02d}')
        page.keyboard.press('ArrowRight'); page.wait_for_timeout(1200)
    b.close()
print('captured to', out)
