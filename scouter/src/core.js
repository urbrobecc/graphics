// Shared helpers for the film: math, easing, text, backgrounds, asset loading.
// Everything the film draws is a pure function of time, so any frame can be
// rendered on its own (the offline renderer relies on that).
(function () {
  const P = (window.P = {});
  P.W = 1920; P.H = 1080; P.FPS = 24; P.DUR = 32; P.BPM = 120;
  P.BEAT = 60 / P.BPM; P.BAR = P.BEAT * 4;
  const TAU = (P.TAU = Math.PI * 2);

  const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
  const lerp = (a, b, t) => a + (b - a) * t;
  const seg = (t, a, b) => clamp((t - a) / (b - a));           // 0..1 progress of t inside [a, b]
  const remap = (x, a, b, c, d) => c + (d - c) * clamp((x - a) / (b - a));
  Object.assign(P, { clamp, lerp, seg, remap });

  P.ease = {
    lin: t => t,
    in2: t => t * t,
    out2: t => 1 - (1 - t) * (1 - t),
    out3: t => 1 - Math.pow(1 - t, 3),
    out4: t => 1 - Math.pow(1 - t, 4),
    io2: t => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2),
    io3: t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
    io5: t => (t < 0.5 ? 16 * Math.pow(t, 5) : 1 - Math.pow(-2 * t + 2, 5) / 2),
    outBack: (t, s = 1.70158) => 1 + (s + 1) * Math.pow(t - 1, 3) + s * Math.pow(t - 1, 2),
    outElastic: t => (t === 0 ? 0 : t === 1 ? 1 : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * (TAU / 3)) + 1),
    outBounce: t => {
      const n = 7.5625, d = 2.75;
      if (t < 1 / d) return n * t * t;
      if (t < 2 / d) return n * (t -= 1.5 / d) * t + 0.75;
      if (t < 2.5 / d) return n * (t -= 2.25 / d) * t + 0.9375;
      return n * (t -= 2.625 / d) * t + 0.984375;
    },
  };
  // damped spring: 0 -> 1 with overshoot. f = frequency (hz), z = damping ratio
  P.spring = (t, f = 2.2, z = 0.32) => {
    if (t <= 0) return 0;
    const w = TAU * f, wd = w * Math.sqrt(1 - z * z);
    return 1 - Math.exp(-z * w * t) * (Math.cos(wd * t) + (z * w / wd) * Math.sin(wd * t));
  };

  // small deterministic random
  P.rng = seed => () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
  P.hash = n => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
  P.noise = (x, s = 0) => {                   // smooth 1d value noise, -1..1
    const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f);
    return lerp(P.hash(i + s * 57.3), P.hash(i + 1 + s * 57.3), u) * 2 - 1;
  };

  // ---------- palette ----------
  P.C = {
    ink: '#0d2f45', inkSoft: '#2b5a76', cyan0: '#5fd0fb', cyan1: '#8fe2ff', cyan2: '#c9f3ff', cyan3: '#e9fbff',
    white: '#ffffff', mint: '#b9f3c2', mintDeep: '#5fd98a', green: '#34d27a', pink: '#ff7eb6', amber: '#ffc34d',
    floor0: '#f7fbfd', floor1: '#e3eef5',
  };

  // ---------- text ----------
  P.font = (w, size, fam = 'Space Grotesk', style = '') => `${style} ${w} ${size}px "${fam}"`.trim();
  P.text = (ctx, str, x, y, o = {}) => {
    ctx.save();
    ctx.font = o.font || P.font(700, o.size || 64);
    ctx.fillStyle = o.color || P.C.ink;
    ctx.textAlign = o.align || 'left';
    ctx.textBaseline = o.base || 'alphabetic';
    if (o.ls !== undefined) ctx.letterSpacing = o.ls + 'px';
    if (o.alpha !== undefined) ctx.globalAlpha *= o.alpha;
    ctx.fillText(str, x, y);
    ctx.restore();
  };
  P.measure = (ctx, str, font, ls = 0) => {
    ctx.save(); ctx.font = font; ctx.letterSpacing = ls + 'px';
    const w = ctx.measureText(str).width; ctx.restore(); return w;
  };

  // ---------- shape helpers ----------
  P.rrect = (ctx, x, y, w, h, r) => { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); };
  P.circle = (ctx, x, y, r) => { ctx.beginPath(); ctx.arc(x, y, Math.max(0, r), 0, TAU); };

  // frosted glass card (what the UI in the film is made of)
  P.glass = (ctx, x, y, w, h, r = 36, a = 0.78) => {
    ctx.save();
    ctx.shadowColor = 'rgba(30,110,160,0.22)'; ctx.shadowBlur = 50; ctx.shadowOffsetY = 18;
    P.rrect(ctx, x, y, w, h, r);
    const g = ctx.createLinearGradient(0, y, 0, y + h);
    g.addColorStop(0, `rgba(255,255,255,${a + 0.14})`); g.addColorStop(1, `rgba(236,250,255,${a})`);
    ctx.fillStyle = g; ctx.fill();
    ctx.shadowColor = 'transparent';
    ctx.lineWidth = 2.5; ctx.strokeStyle = 'rgba(255,255,255,0.95)'; ctx.stroke();
    ctx.restore();
  };

  // ---------- assets ----------
  P.img = {};
  P.meta = null;
  P.load = async function (base = 'assets/') {
    const load = src => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error('missing ' + src)); i.src = src; });
    P.meta = await (await fetch(base + 'sprites.json')).json();
    const jobs = [];
    for (const v of P.meta.variants) for (const part of ['base', 'top', 'mid']) {
      jobs.push(load(`${base}${v}_${part}.png`).then(i => { P.img[`${v}_${part}`] = i; }));
    }
    await Promise.all(jobs);
  };

  // ---------- backgrounds ----------
  const R = P.rng(7);
  const squares = Array.from({ length: 16 }, () => ({ x: R() * 1920, y: R() * 1080, s: 50 + R() * 90, ph: R() * TAU, sp: 0.1 + R() * 0.25, a: 0.18 + R() * 0.3, rot: (R() - 0.5) * 0.6 }));
  const rings = [{ x: 1700, y: 190, r: 150, w: 34 }, { x: 140, y: 880, r: 120, w: 26 }, { x: 1530, y: 860, r: 70, w: 18 }, { x: 330, y: 250, r: 54, w: 14 }, { x: 960, y: 120, r: 40, w: 10 }];

  P.deco = function (ctx, t, o = {}) {
    const k = o.amount === undefined ? 1 : o.amount, px = o.px || 0, py = o.py || 0;
    ctx.save();
    for (const s of squares) {
      const x = ((s.x + t * s.sp * 40 + px * 0.4) % 2100) - 90, y = s.y + Math.sin(t * s.sp * 3 + s.ph) * 24 + py * 0.4;
      ctx.save(); ctx.translate(x, y); ctx.rotate(s.rot + Math.sin(t * s.sp + s.ph) * 0.15);
      P.rrect(ctx, -s.s / 2, -s.s / 2, s.s, s.s, s.s * 0.28);
      ctx.fillStyle = `rgba(255,255,255,${s.a * k})`; ctx.fill(); ctx.restore();
    }
    for (const r of rings) {
      const br = 1 + Math.sin(t * 1.2 + r.x) * 0.04, x = r.x + px * 0.7, y = r.y + py * 0.7;
      ctx.lineWidth = r.w; ctx.strokeStyle = `rgba(255,255,255,${0.7 * k})`;
      P.circle(ctx, x, y, r.r * br); ctx.stroke();
      ctx.lineWidth = r.w * 0.55; ctx.strokeStyle = `rgba(255,255,255,${0.45 * k})`;
      P.circle(ctx, x, y, r.r * br * 0.55); ctx.stroke();
      P.circle(ctx, x, y, r.r * br * 0.2); ctx.fillStyle = `rgba(255,255,255,${0.65 * k})`; ctx.fill();
    }
    ctx.restore();
  };

  // open sky, no floor (montage, closeups)
  P.skyBg = function (ctx, t, o = {}) {
    const g = ctx.createLinearGradient(0, 0, 0, P.H);
    g.addColorStop(0, o.top || P.C.cyan0); g.addColorStop(0.55, o.mid || P.C.cyan1); g.addColorStop(1, o.bot || P.C.cyan3);
    ctx.fillStyle = g; ctx.fillRect(0, 0, P.W, P.H);
    const gl = ctx.createRadialGradient(P.W * 0.72, P.H * 0.78, 0, P.W * 0.72, P.H * 0.78, 900);
    gl.addColorStop(0, 'rgba(255,255,255,0.7)'); gl.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = gl; ctx.fillRect(0, 0, P.W, P.H);
    P.deco(ctx, t, o);
  };

  // sky + glossy floor. horizon is the y of the floor edge
  P.worldBg = function (ctx, t, horizon = 800, o = {}) {
    const g = ctx.createLinearGradient(0, 0, 0, horizon);
    g.addColorStop(0, o.top || '#74d7fd'); g.addColorStop(0.7, o.mid || '#bdeeff'); g.addColorStop(1, o.bot || '#f1fbff');
    ctx.fillStyle = g; ctx.fillRect(0, 0, P.W, horizon + 2);
    P.deco(ctx, t, { amount: o.amount === undefined ? 0.8 : o.amount, px: o.px, py: o.py });
    const f = ctx.createLinearGradient(0, horizon, 0, P.H);
    f.addColorStop(0, '#f4fafd'); f.addColorStop(0.15, '#eaf4f9'); f.addColorStop(1, '#d9e8f1');
    ctx.fillStyle = f; ctx.fillRect(0, horizon, P.W, P.H - horizon);
    const s = ctx.createLinearGradient(0, horizon - 30, 0, horizon + 50);
    s.addColorStop(0, 'rgba(255,255,255,0)'); s.addColorStop(0.5, 'rgba(255,255,255,0.95)'); s.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = s; ctx.fillRect(0, horizon - 30, P.W, 80);
  };

  P.flash = (ctx, a, color = '255,255,255') => { if (a > 0.003) { ctx.fillStyle = `rgba(${color},${a})`; ctx.fillRect(0, 0, P.W, P.H); } };
})();
