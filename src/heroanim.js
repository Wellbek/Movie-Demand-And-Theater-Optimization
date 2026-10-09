// Background animation for the demo's hero and the deck's title slide: the week's plan being
// placed cell by cell (highest planning value first), held, then cleared and replayed.
// Drawn on a canvas; the page blurs it and lays a gradient on top.
// data = { days: ['Mon', ...], times: ['10:00', ...], halls: [{ name, seats }], cells: [{ d, s, h, title, hue, v }] }
(function (root) {
  'use strict';
  function start(canvas, data) {
    if (canvas._heroStop) canvas._heroStop();
    const ctx = canvas.getContext('2d');
    const reduce = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    const order = (data.cells || []).slice().sort((a, b) => b.v - a.v);
    const FILL = 7000, HOLD = 2500, FADE = 900, LOOP = FILL + HOLD + FADE;
    let raf = 0, t0 = 0, visible = true, W = 0, H = 0;
    function size() {
      const r = canvas.getBoundingClientRect();
      const dpr = Math.min(2, root.devicePixelRatio || 1);
      W = Math.max(1, r.width); H = Math.max(1, r.height);
      canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    function frame(now) {
      if (!t0) t0 = now - FILL; // open on the full plan, then clear and replay
      draw(reduce ? FILL + 1 : (now - t0) % LOOP);
      if (!reduce && visible) raf = requestAnimationFrame(frame);
    }
    function draw(t) {
      ctx.clearRect(0, 0, W, H);
      const nD = (data.days || []).length, nS = (data.times || []).length, nH = (data.halls || []).length;
      if (!nD || !nS || !nH) return;
      // the grid fills the right two thirds, slightly rotated like a poster wall
      const gx = W * 0.3, gy = H * 0.1, gw = W * 0.68, gh = H * 0.82;
      const colW = gw / nD, rowH = gh / (nS * (nH + 0.6));
      ctx.save();
      ctx.translate(gx + gw / 2, gy + gh / 2);
      ctx.rotate(-0.06);
      ctx.translate(-gw / 2, -gh / 2);
      ctx.font = '700 ' + Math.max(9, Math.min(15, rowH * 0.42)) + 'px Helvetica Neue, Arial, sans-serif';
      ctx.textBaseline = 'middle';
      for (let d = 0; d < nD; d++) for (let s = 0; s < nS; s++) for (let h = 0; h < nH; h++) {
        ctx.fillStyle = 'rgba(255,255,255,0.05)';
        ctx.fillRect(d * colW + 4, (s * (nH + 0.6) + h) * rowH + 2, colW - 8, rowH - 4);
      }
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      for (let d = 0; d < nD; d++) ctx.fillText(data.days[d].toUpperCase(), d * colW + 8, -12);
      const fade = t > FILL + HOLD ? 1 - (t - FILL - HOLD) / FADE : 1;
      const per = FILL / Math.max(1, order.length);
      order.forEach((c, k) => {
        const appear = k * per;
        if (t < appear) return;
        const e = 1 - Math.pow(1 - Math.min(1, (t - appear) / 450), 3);
        const x = c.d * colW + 4, y = (c.s * (nH + 0.6) + c.h) * rowH + 2 - (1 - e) * rowH * 1.6;
        ctx.globalAlpha = e * fade;
        ctx.fillStyle = 'hsl(' + c.hue + ',62%,' + (34 + 10 * (1 - e)) + '%)';
        ctx.fillRect(x, y, colW - 8, rowH - 4);
        ctx.fillStyle = 'rgba(255,255,255,0.92)';
        ctx.fillText(c.title.length > 14 ? c.title.split(/[ :-]/)[0] : c.title, x + 6, y + (rowH - 4) / 2, colW - 20);
      });
      ctx.globalAlpha = 1;
      ctx.restore();
    }
    size();
    const onResize = () => { size(); draw(FILL + 1); };
    root.addEventListener('resize', onResize);
    let io = null;
    if (typeof IntersectionObserver === 'function') {
      io = new IntersectionObserver((es) => {
        const v = es.some((e) => e.isIntersecting);
        if (v && !visible) { visible = true; cancelAnimationFrame(raf); raf = requestAnimationFrame(frame); }
        visible = v;
      });
      io.observe(canvas);
    }
    raf = requestAnimationFrame(frame);
    canvas._heroStop = () => { cancelAnimationFrame(raf); root.removeEventListener('resize', onResize); if (io) io.disconnect(); };
  }
  root.HeroAnim = { start };
})(typeof self !== 'undefined' ? self : this);
