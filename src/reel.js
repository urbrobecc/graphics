/*
 * CLAUDE / MOTION REEL 2026
 * A 15 second, beat-locked motion graphics showreel.
 *
 * Everything is a pure function of time: render(t) always draws the same
 * frame for the same t. That lets the offline renderer supersample each frame
 * for real motion blur and lets the preview scrub freely.
 *
 * Timing is built on a 128 BPM grid. 32 beats at 128 BPM is exactly 15.0 s,
 * so every cut, hit and wipe lands on the music.
 */
(function () {
  'use strict';

  // ---------------------------------------------------------------- constants
  const W = 1920, H = 1080, FPS = 60;
  const BPM = 128, BEAT = 60 / BPM, BAR = BEAT * 4, DUR = BAR * 8;
  const CX = W / 2, CY = H / 2, TAU = Math.PI * 2;

  const C = {
    ink: '#0B0B10', paper: '#F3EEE4', orange: '#FF4A1C', blue: '#2F55FF',
    lime: '#D4FF3A', pink: '#FF3FA4', violet: '#6C3BFF', deep: '#140B2B',
  };
  const F = {
    sg: (w, s) => `${w} ${s}px "Space Grotesk"`,
    is: (s, it = true) => `${it ? 'italic ' : ''}400 ${s}px "Instrument Serif"`,
    jb: (w, s) => `${w} ${s}px "JetBrains Mono"`,
  };
  const SECTIONS = [
    'IGNITION', 'KINETIC TYPE', 'SHAPE LAYERS', 'PARTICLE SYSTEMS',
    '3D SPACE', 'LIQUID FX', 'CHARACTER + UI', 'SIGNATURE',
  ];

  // ------------------------------------------------------------------- math
  const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
  const lerp = (a, b, t) => a + (b - a) * t;
  const prog = (t, a, b) => clamp((t - a) / (b - a));
  const E = {
    lin: t => t,
    inQuad: t => t * t,
    outQuad: t => 1 - (1 - t) * (1 - t),
    inCubic: t => t * t * t,
    outCubic: t => 1 - Math.pow(1 - t, 3),
    inOutCubic: t => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2,
    outQuart: t => 1 - Math.pow(1 - t, 4),
    inQuart: t => t * t * t * t,
    inOutQuart: t => t < 0.5 ? 8 * t ** 4 : 1 - Math.pow(-2 * t + 2, 4) / 2,
    outExpo: t => t >= 1 ? 1 : 1 - Math.pow(2, -10 * t),
    inExpo: t => t <= 0 ? 0 : Math.pow(2, 10 * t - 10),
    inOutExpo: t => t <= 0 ? 0 : t >= 1 ? 1 : t < 0.5
      ? Math.pow(2, 20 * t - 10) / 2 : (2 - Math.pow(2, -20 * t + 10)) / 2,
    outBack: t => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); },
    inBack: t => { const c1 = 1.70158, c3 = c1 + 1; return c3 * t * t * t - c1 * t * t; },
    outElastic: t => t <= 0 ? 0 : t >= 1 ? 1
      : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * (TAU / 3)) + 1,
  };
  function rng(seed) {
    return function () {
      seed |= 0; seed = seed + 0x6D2B79F5 | 0;
      let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  const noise = (x, y) => (Math.sin(x * 1.7 + y * 0.3) + Math.sin(x * 0.9 - y * 1.3 + 1.7)
    + 0.5 * Math.sin(x * 2.3 + y * 2.1 + 4.1)) / 2.5;

  const hex = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
  const mix = (a, b, t) => { const A = hex(a), B = hex(b); return `rgb(${A.map((v, i) => Math.round(lerp(v, B[i], t))).join(',')})`; };
  const rgba = (h, a) => { const A = hex(h); return `rgba(${A[0]},${A[1]},${A[2]},${a})`; };
  const RAMP = [C.blue, C.violet, C.pink, C.orange, C.lime].map(hex);
  function ramp(t) {
    t = clamp(t) * (RAMP.length - 1);
    const i = Math.min(RAMP.length - 2, Math.floor(t)), f = t - i;
    return RAMP[i].map((v, k) => Math.round(lerp(v, RAMP[i + 1][k], f)));
  }

  // ---------------------------------------------------------------- drawing
  function fill(ctx, col) { ctx.fillStyle = col; ctx.fillRect(-50, -50, W + 100, H + 100); }
  function circle(ctx, x, y, r) { ctx.beginPath(); ctx.arc(x, y, Math.max(0, r), 0, TAU); }
  function rrect(ctx, x, y, w, h, r) {
    ctx.beginPath(); ctx.roundRect(x, y, Math.max(0, w), Math.max(0, h), Math.max(0, Math.min(r, w / 2, h / 2)));
  }

  const layCache = new Map();
  function lay(ctx, text, font, spacing = 0) {
    const key = text + '|' + font + '|' + spacing;
    let L = layCache.get(key);
    if (L) return L;
    ctx.save(); ctx.font = font; ctx.letterSpacing = '0px';
    const chars = [...text];
    const ws = chars.map(ch => ctx.measureText(ch).width);
    ctx.restore();
    const total = ws.reduce((a, b) => a + b, 0) + spacing * (chars.length - 1);
    let x = -total / 2;
    const letters = chars.map((ch, i) => { const l = { ch, x: x + ws[i] / 2, w: ws[i] }; x += ws[i] + spacing; return l; });
    L = { letters, total };
    layCache.set(key, L);
    return L;
  }
  function text(ctx, str, x, y, font, col, align = 'center', ls = 0) {
    ctx.font = font; ctx.fillStyle = col; ctx.textAlign = align; ctx.textBaseline = 'alphabetic';
    ctx.letterSpacing = ls + 'px';
    ctx.fillText(str, x, y);
    ctx.letterSpacing = '0px';
  }

  // ------------------------------------------------------------ impacts/fx
  // [time, shake px, chroma px, flash]
  const HITS = [
    [0.0, 4, 2, 0], [BAR, 24, 10, 0.25],
    [BAR + BEAT, 14, 7, 0], [BAR + BEAT * 2, 14, 7, 0], [BAR + BEAT * 3, 12, 6, 0],
    [BAR * 2, 16, 8, 0], [BAR * 2 + BEAT, 5, 3, 0], [BAR * 2 + BEAT * 2, 5, 3, 0], [BAR * 2 + BEAT * 3, 5, 3, 0],
    [BAR * 3, 28, 14, 0.55], [BAR * 4, 18, 9, 0.2], [BAR * 5, 14, 7, 0.1],
    [BAR * 6, 10, 5, 0], [BAR * 7, 32, 16, 0.6],
  ];
  function hitSum(t, idx, decay) {
    let s = 0;
    for (const h of HITS) { const d = t - h[0]; if (d >= 0 && d < 1.2) s += h[idx] * Math.exp(-d * decay); }
    return s;
  }

  // ------------------------------------------------------------ assets/init
  let P = [];        // particle table shared by scenes 3 and 4
  let grain = null;  // grain tile
  let goo = null;    // metaball buffers
  function init() {
    // Sample the particle target word.
    const oc = document.createElement('canvas'); oc.width = W; oc.height = H;
    const o = oc.getContext('2d');
    o.fillStyle = '#fff'; o.font = F.sg(700, 560); o.textAlign = 'center'; o.letterSpacing = '24px';
    o.fillText('FLOW', CX, CY + 200);
    const data = o.getImageData(0, 0, W, H).data;
    const pts = [];
    const step = 8;
    for (let y = 0; y < H; y += step) for (let x = 0; x < W; x += step) {
      if (data[(y * W + x) * 4 + 3] > 128) pts.push([x, y]);
    }
    const r = rng(7);
    for (let i = pts.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [pts[i], pts[j]] = [pts[j], pts[i]]; }
    let minx = Infinity, maxx = -Infinity;
    pts.forEach(p => { minx = Math.min(minx, p[0]); maxx = Math.max(maxx, p[0]); });
    P = pts.map(([tx, ty]) => {
      const c = ramp((tx - minx) / (maxx - minx));
      return {
        tx: tx + (r() - 0.5) * 3, ty: ty + (r() - 0.5) * 3,
        a: r() * TAU, R: 120 + Math.pow(r(), 0.7) * 1000, d: r(), spin: r() * 2 - 1,
        sz: 2.2 + r() * 2.2, col: c, css: `rgb(${c.join(',')})`,
      };
    });

    // Grain tile.
    grain = document.createElement('canvas'); grain.width = grain.height = 256;
    const g = grain.getContext('2d'); const id = g.createImageData(256, 256); const gr = rng(99);
    for (let i = 0; i < id.data.length; i += 4) { const v = gr() * 255; id.data[i] = id.data[i + 1] = id.data[i + 2] = v; id.data[i + 3] = 255; }
    g.putImageData(id, 0, 0);

    // Goo buffers (half res).
    const mk = () => { const c = document.createElement('canvas'); c.width = W / 2; c.height = H / 2; return c; };
    goo = { a: mk(), b: mk() };
  }

  // ======================================================================
  // SCENE 0 : IGNITION. A dot becomes a line, the line becomes a title,
  // the title gets swallowed by an orange slab.
  // ======================================================================
  function s0(ctx, u) {
    fill(ctx, C.ink);

    // faint design grid
    const ga = E.outCubic(prog(u, 0.25, 1.2)) * 0.09;
    if (ga > 0) {
      ctx.fillStyle = rgba(C.paper, ga);
      for (let y = 30; y < H; y += 60) for (let x = 30; x < W; x += 60) {
        const d = Math.hypot(x - CX, y - CY);
        const k = clamp(1.3 - d / 900);
        ctx.fillRect(x - 1.2, y - 1.2, 2.4 * k + 0.4, 2.4 * k + 0.4);
      }
    }

    const pop = E.outBack(prog(u, 0.0, 0.3));
    const str = E.inOutExpo(prog(u, BEAT * 0.85, BEAT * 1.75));
    const slab = E.inOutExpo(prog(u, BEAT * 3.1, BAR));
    const d = 28 * pop;
    let w = lerp(d, 1480, str), h = lerp(d, 4, str);
    h = lerp(h, H + 60, slab); w = lerp(w, W + 60, slab);

    // shockwave on the first hit
    const rp = prog(u, 0.02, 0.8);
    if (rp > 0 && rp < 1) {
      ctx.strokeStyle = rgba(C.paper, (1 - rp) * 0.7); ctx.lineWidth = 3 * (1 - rp) + 0.5;
      circle(ctx, CX, CY, lerp(14, 300, E.outExpo(rp))); ctx.stroke();
    }

    const top = CY - h / 2, bot = CY + h / 2;
    // CLAUDE rises out of the line
    ctx.save(); ctx.beginPath(); ctx.rect(0, 0, W, top); ctx.clip();
    const L = lay(ctx, 'CLAUDE', F.sg(700, 210), 14);
    ctx.font = F.sg(700, 210); ctx.fillStyle = C.paper; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    L.letters.forEach((l, i) => {
      const s = BEAT * 1.8 + i * 0.04;
      const p = E.outExpo(prog(u, s, s + 0.6));
      ctx.fillText(l.ch, CX + l.x, top - 34 + (1 - p) * 240);
    });
    ctx.restore();

    // MOTION DESIGNER drops out of the line
    ctx.save(); ctx.beginPath(); ctx.rect(0, bot, W, H - bot); ctx.clip();
    const M = lay(ctx, 'MOTION DESIGNER', F.jb(700, 34), 22);
    ctx.font = F.jb(700, 34); ctx.fillStyle = C.paper;
    M.letters.forEach((l, i) => {
      const s = BEAT * 2.15 + i * 0.018;
      const p = E.outExpo(prog(u, s, s + 0.5));
      ctx.fillText(l.ch, CX + l.x, bot + 66 - (1 - p) * 90);
    });
    ctx.restore();

    // line end tags
    const tg = E.outExpo(prog(u, BEAT * 2.5, BEAT * 3.1)) * (1 - slab);
    if (tg > 0) {
      ctx.globalAlpha = tg;
      text(ctx, 'SHOWREEL', CX - 740 + (1 - tg) * 40, top - 14, F.jb(400, 18), C.paper, 'left', 4);
      text(ctx, '2026', CX + 740 - (1 - tg) * 40, top - 14, F.jb(400, 18), C.paper, 'right', 4);
      text(ctx, '00', CX - 740, bot + 30, F.jb(400, 18), C.orange, 'left', 4);
      text(ctx, '15s', CX + 740, bot + 30, F.jb(400, 18), C.orange, 'right', 4);
      ctx.globalAlpha = 1;
    }

    // the line itself
    ctx.fillStyle = mix(C.paper, C.orange, E.outCubic(prog(u, BEAT * 2.9, BEAT * 3.5)));
    rrect(ctx, CX - w / 2, CY - h / 2, w, h, Math.min(w, h) / 2 * (1 - slab));
    ctx.fill();
  }

  // ======================================================================
  // SCENE 1 : KINETIC TYPE. One word per beat, four different techniques.
  // ======================================================================
  function s1(ctx, u) {
    const b = Math.min(3, Math.floor(u / BEAT)), v = u - b * BEAT;
    fill(ctx, [C.orange, C.ink, C.blue, C.paper][b]);
    const punch = 1 + 0.08 * (1 - E.outExpo(clamp(v / 0.4)));
    ctx.save(); ctx.translate(CX, CY); ctx.scale(punch, punch);
    ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';

    if (b === 0) {
      // letters drop in with overshoot
      const size = 340, L = lay(ctx, 'I MAKE', F.sg(700, size), 4);
      ctx.font = F.sg(700, size); ctx.fillStyle = C.ink;
      L.letters.forEach((l, i) => {
        const p = prog(v, i * 0.03, i * 0.03 + 0.34);
        ctx.save();
        ctx.translate(l.x, lerp(-1000, 0, E.outBack(p)) + size * 0.36);
        ctx.rotate((1 - E.outCubic(p)) * (i % 2 ? 0.6 : -0.6));
        ctx.fillText(l.ch, 0, 0);
        ctx.restore();
      });
      // subtle underline sweep
      const q = E.outExpo(prog(v, 0.18, 0.45));
      ctx.fillStyle = C.ink; ctx.fillRect(-L.total / 2, size * 0.36 + 36, L.total * q, 12);
    } else if (b === 1) {
      // repeater echoes + center-out scale
      const size = 360, L = lay(ctx, 'THINGS', F.sg(700, size), 0);
      const ex = E.outExpo(prog(v, 0.05, 0.42));
      ctx.font = F.sg(700, size);
      for (let k = 6; k >= 1; k--) {
        ctx.strokeStyle = rgba(k % 2 ? C.orange : C.pink, 0.85 * (1 - k / 7) * ex);
        ctx.lineWidth = 3;
        const s = 1 + k * 0.1 * ex;
        ctx.save(); ctx.scale(s, s);
        L.letters.forEach(l => ctx.strokeText(l.ch, l.x, size * 0.36));
        ctx.restore();
      }
      ctx.fillStyle = C.paper;
      const n = L.letters.length;
      L.letters.forEach((l, i) => {
        const dl = Math.abs(i - (n - 1) / 2) * 0.04;
        const p = E.outBack(prog(v, dl, dl + 0.3));
        ctx.save(); ctx.translate(l.x, 0); ctx.scale(p, p);
        ctx.fillText(l.ch, 0, size * 0.36);
        ctx.restore();
      });
    } else if (b === 2) {
      // sliced text
      const size = 400; ctx.font = F.sg(700, size); ctx.letterSpacing = '10px';
      const capH = size * 0.72, n = 9, top = -capH / 2 - 16, sh = (capH + 32) / n;
      for (let k = 0; k < n; k++) {
        const p = E.outExpo(prog(v, k * 0.02, k * 0.02 + 0.38));
        const dx = (k % 2 ? 1 : -1) * (1 - p) * 1500;
        ctx.save(); ctx.beginPath(); ctx.rect(-W, top + k * sh, W * 2, sh + 0.6); ctx.clip();
        ctx.fillStyle = C.lime; ctx.fillText('MOVE.', dx, capH / 2);
        ctx.restore();
        if (p < 0.98) {
          ctx.fillStyle = rgba(C.lime, (1 - p) * 0.8);
          const sx = dx + (k % 2 ? 1 : -1) * 520;
          ctx.fillRect(sx - 700 * (1 - p) * (k % 2 ? 0 : 1), top + k * sh + sh / 2 - 2, 700 * (1 - p), 4);
        }
      }
      ctx.letterSpacing = '0px';
    } else {
      // handwritten serif reveal + swash
      const size = 300; ctx.font = F.is(size); ctx.fillStyle = C.ink;
      const tw = ctx.measureText('with intent.').width;
      const p = E.outExpo(prog(v, 0.0, 0.32));
      ctx.save(); ctx.beginPath(); ctx.rect(-tw / 2 - 60, -400, (tw + 120) * p, 800); ctx.clip();
      ctx.fillText('with intent.', 0, size * 0.25);
      ctx.restore();
      const q = E.inOutCubic(prog(v, 0.08, 0.4));
      ctx.strokeStyle = C.orange; ctx.lineWidth = 16; ctx.lineCap = 'round';
      const len = tw * 1.15;
      ctx.setLineDash([len, len]); ctx.lineDashOffset = len * (1 - q);
      ctx.beginPath(); ctx.moveTo(-tw / 2, size * 0.42);
      ctx.bezierCurveTo(-tw / 6, size * 0.34, tw / 6, size * 0.58, tw / 2, size * 0.4);
      ctx.stroke(); ctx.setLineDash([]);
    }
    ctx.restore();

    // diagonal slab wipe into the next scene
    [C.orange, C.lime, C.ink].forEach((c, i) => {
      const p = E.inOutExpo(prog(u, BEAT * 3 + 0.12 + i * 0.05, BAR - (2 - i) * 0.03));
      if (p <= 0) return;
      const x = lerp(W + 320, -560, p);
      ctx.fillStyle = c; ctx.beginPath();
      ctx.moveTo(x, -20); ctx.lineTo(W + 1000, -20); ctx.lineTo(W + 1000, H + 20); ctx.lineTo(x - 340, H + 20);
      ctx.closePath(); ctx.fill();
    });
  }

  // ======================================================================
  // SCENE 2 : SHAPE LAYERS. Path morphing, echo repeater, radial repeater,
  // orbiters, and an After Effects style selection box for flavour.
  // ======================================================================
  const NS = 200;
  function polyVerts(n, rot, inner) {
    const m = inner ? n * 2 : n, v = [];
    for (let k = 0; k < m; k++) { const a = rot + k * TAU / m, r = inner && k % 2 ? inner : 1; v.push([Math.cos(a) * r, Math.sin(a) * r]); }
    return v;
  }
  function sampleShape(verts, scale) {
    const pts = [];
    for (let j = 0; j < NS; j++) {
      const th = j / NS * TAU - Math.PI / 2, dx = Math.cos(th), dy = Math.sin(th);
      let best = Infinity;
      for (let k = 0; k < verts.length; k++) {
        const a = verts[k], b = verts[(k + 1) % verts.length], ex = b[0] - a[0], ey = b[1] - a[1];
        const den = dx * ey - dy * ex; if (Math.abs(den) < 1e-9) continue;
        const t = (a[0] * ey - a[1] * ex) / den, s = (a[0] * dy - a[1] * dx) / den;
        if (t > 0 && s >= -1e-9 && s <= 1 + 1e-9 && t < best) best = t;
      }
      pts.push([dx * best * scale, dy * best * scale]);
    }
    return pts;
  }
  const SHAPES = (() => {
    const circ = []; for (let j = 0; j < NS; j++) { const th = j / NS * TAU - Math.PI / 2; circ.push([Math.cos(th), Math.sin(th)]); }
    return [circ, sampleShape(polyVerts(4, Math.PI / 4), 1.15), sampleShape(polyVerts(3, -Math.PI / 2), 1.35), sampleShape(polyVerts(5, -Math.PI / 2, 0.46), 1.35)];
  })();
  const SHAPE_NAMES = ['ellipse', 'rect', 'polygon', 'star'];

  function shapeAt(u) {
    const b = clamp(Math.floor(u / BEAT), 0, 3), v = u - b * BEAT;
    const from = SHAPES[Math.max(0, b - 1)], to = SHAPES[b];
    const p = b === 0 ? 1 : E.outExpo(prog(v, 0, 0.34));
    let rot = u * 0.25;
    for (let k = 1; k <= b; k++) rot += (k < b ? 1 : E.outBack(prog(v, 0, 0.42))) * Math.PI / 2 * (k % 2 ? 1 : -1);
    const appear = E.outBack(prog(u, 0, 0.36));
    const pulse = Math.exp(-v * 7);
    const shrink = 1 - 0.95 * E.inExpo(prog(u, BEAT * 3.45, BAR - 0.02));
    const R = 215 * appear * (1 + 0.07 * pulse) * shrink;
    const cr = Math.cos(rot), sr = Math.sin(rot);
    return from.map((a, j) => {
      const x = lerp(a[0], to[j][0], p) * R, y = lerp(a[1], to[j][1], p) * R;
      return [CX + x * cr - y * sr, CY + x * sr + y * cr];
    });
  }
  function pathPts(ctx, pts) { ctx.beginPath(); pts.forEach((p, i) => i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])); ctx.closePath(); }

  function s2(ctx, u) {
    fill(ctx, C.ink);
    const b = clamp(Math.floor(u / BEAT), 0, 3), v = u - b * BEAT;
    const out = 1 - E.inExpo(prog(u, BEAT * 3.3, BAR));

    // shockwaves
    for (let k = 0; k <= b; k++) {
      const rp = prog(u, k * BEAT, k * BEAT + 0.8);
      if (rp <= 0 || rp >= 1) continue;
      ctx.strokeStyle = rgba([C.lime, C.blue, C.pink, C.orange][k], (1 - rp) * 0.55);
      ctx.lineWidth = 2 + 8 * (1 - rp);
      circle(ctx, CX, CY, lerp(230, 1000, E.outExpo(rp))); ctx.stroke();
    }

    // radial repeater
    const ra = E.outCubic(prog(u, 0.08, 0.5)) * out;
    if (ra > 0) {
      ctx.lineCap = 'round'; ctx.lineWidth = 6;
      for (let i = 0; i < 72; i++) {
        const a = i / 72 * TAU + u * 0.5;
        const len = (12 + 80 * (0.5 + 0.5 * Math.sin(i * 0.8 + u * 9)) * (0.35 + 0.65 * Math.exp(-v * 4))) * ra;
        const r0 = 380 * (0.8 + 0.2 * ra);
        ctx.strokeStyle = i % 9 === 0 ? C.lime : rgba(C.paper, 0.8);
        ctx.beginPath(); ctx.moveTo(CX + Math.cos(a) * r0, CY + Math.sin(a) * r0);
        ctx.lineTo(CX + Math.cos(a) * (r0 + len), CY + Math.sin(a) * (r0 + len)); ctx.stroke();
      }
    }

    // orbiters with trails
    const orb = [[560, 170, 0.3, 2.2, C.pink], [480, 280, -0.5, -1.7, C.blue], [640, 120, 0.9, 1.4, C.orange]];
    const oa = E.outCubic(prog(u, 0.15, 0.6)) * out;
    if (oa > 0) orb.forEach(([rx, ry, tilt, sp, col], k) => {
      for (let j = 14; j >= 0; j--) {
        const tt = u - j * 0.014, a = tt * sp + k * 2;
        const x = Math.cos(a) * rx * oa, y = Math.sin(a) * ry * oa;
        const X = CX + x * Math.cos(tilt) - y * Math.sin(tilt), Y = CY + x * Math.sin(tilt) + y * Math.cos(tilt);
        ctx.fillStyle = rgba(col, (1 - j / 15) * oa);
        circle(ctx, X, Y, 14 * (1 - j / 16)); ctx.fill();
      }
    });

    // echo repeater
    const cols = [C.blue, C.pink, C.orange];
    ctx.lineJoin = 'round';
    for (let k = 6; k >= 1; k--) {
      const pts = shapeAt(Math.max(0, u - k * 0.04));
      const s = 1 + k * 0.06;
      ctx.save(); ctx.translate(CX, CY); ctx.scale(s, s); ctx.translate(-CX, -CY);
      ctx.strokeStyle = rgba(cols[k % 3], 0.9 * (1 - k / 7)); ctx.lineWidth = 3 / s;
      pathPts(ctx, pts); ctx.stroke(); ctx.restore();
    }
    const pts = shapeAt(u);
    ctx.fillStyle = C.lime; pathPts(ctx, pts); ctx.fill();

    // selection box and anchor point
    const sa = E.outExpo(prog(u, 0.3, 0.6)) * (1 - prog(u, BEAT * 3.3, BEAT * 3.5));
    if (sa > 0) {
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      pts.forEach(([x, y]) => { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); });
      const pad = 26; x0 -= pad; y0 -= pad; x1 += pad; y1 += pad;
      ctx.globalAlpha = sa;
      ctx.strokeStyle = C.paper; ctx.lineWidth = 1.5; ctx.setLineDash([8, 6]); ctx.lineDashOffset = -u * 40;
      ctx.strokeRect(x0, y0, x1 - x0, y1 - y0); ctx.setLineDash([]);
      [[x0, y0], [(x0 + x1) / 2, y0], [x1, y0], [x1, (y0 + y1) / 2], [x1, y1], [(x0 + x1) / 2, y1], [x0, y1], [x0, (y0 + y1) / 2]].forEach(([x, y]) => {
        ctx.fillStyle = C.ink; ctx.fillRect(x - 7, y - 7, 14, 14);
        ctx.strokeStyle = C.paper; ctx.lineWidth = 2; ctx.strokeRect(x - 7, y - 7, 14, 14);
      });
      ctx.strokeStyle = C.ink; ctx.lineWidth = 3;
      circle(ctx, CX, CY, 9); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(CX - 18, CY); ctx.lineTo(CX + 18, CY); ctx.moveTo(CX, CY - 18); ctx.lineTo(CX, CY + 18); ctx.stroke();
      text(ctx, 'Shape Layer 1', x0, y0 - 16, F.jb(700, 18), C.paper, 'left');
      text(ctx, `path: ${SHAPE_NAMES[b]}`, x1, y0 - 16, F.jb(400, 18), C.lime, 'right');
      ctx.globalAlpha = 1;
    }
  }

  // ======================================================================
  // SCENE 3 : PARTICLE SYSTEMS. Burst, swirl, assemble into a word,
  // then hand every particle to the 3D scene.
  // ======================================================================
  function particlePos(i, u) {
    const p = P[i];
    const bp = E.outExpo(prog(u, 0, 0.75));
    const ang = p.a + (1 - bp) * 2.8 + u * 0.35 * p.spin;
    const br = p.R * bp + u * 26;
    let x = CX + Math.cos(ang) * br, y = CY + Math.sin(ang) * br * 0.6;
    x += noise(p.a * 3 + u * 0.9, i * 0.01) * 50 * bp;
    y += noise(i * 0.013, u * 0.9 + p.a) * 50 * bp;
    const q = E.inOutCubic(prog(u, 0.42 + p.d * 0.3, 0.98 + p.d * 0.3));
    x = lerp(x, p.tx + Math.sin(u * 7 + i) * 1.4, q);
    y = lerp(y, p.ty + Math.cos(u * 6 + i) * 1.4, q);
    const s = E.inOutExpo(prog(u, 1.36 + p.d * 0.14, BAR));
    if (s > 0) { const sp = project3d(i, 0); x = lerp(x, sp[0], s); y = lerp(y, sp[1], s); }
    return [x, y, q, s];
  }

  function s3(ctx, u) {
    fill(ctx, C.ink);
    // center flare from the collapsed dot
    const fl = 1 - prog(u, 0, 0.5);
    if (fl > 0) {
      const g = ctx.createRadialGradient(CX, CY, 0, CX, CY, 600 * (1 - fl * 0.5));
      g.addColorStop(0, rgba(C.lime, 0.9 * fl)); g.addColorStop(0.3, rgba(C.pink, 0.35 * fl)); g.addColorStop(1, rgba(C.ink, 0));
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    }
    const scan = lerp(-300, W + 300, E.inOutCubic(prog(u, 1.0, 1.5)));
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < P.length; i++) {
      const p = P[i];
      const [x, y, q, s] = particlePos(i, u);
      const boost = Math.max(0, 1 - Math.abs(x - scan) / 140) * q;
      const sz = p.sz * (1 - s * 0.4) + boost * 2;
      if (boost > 0.05) ctx.fillStyle = `rgb(${p.col.map(c => Math.round(lerp(c, 255, boost))).join(',')})`;
      else ctx.fillStyle = p.css;
      ctx.fillRect(x - sz / 2, y - sz / 2, sz, sz);
    }
    ctx.globalCompositeOperation = 'source-over';

    // counter
    const ca = E.outExpo(prog(u, 0.3, 0.7)) * (1 - prog(u, 1.4, 1.6));
    if (ca > 0) {
      ctx.globalAlpha = ca;
      const n = Math.round(P.length * E.outCubic(prog(u, 0, 0.9)));
      text(ctx, `emitter.count = ${n.toLocaleString('en-US')}`, CX, H - 150, F.jb(400, 22), C.paper, 'center', 2);
      ctx.globalAlpha = 1;
    }
  }

  // ======================================================================
  // SCENE 4 : 3D SPACE. The same particles as a point cloud that morphs
  // sphere > torus > wave terrain over a synthwave floor.
  // ======================================================================
  const GOLD = Math.PI * (3 - Math.sqrt(5));
  function shape3d(i, u) {
    const N = P.length, p = P[i];
    const y = 1 - 2 * (i + 0.5) / N, r = Math.sqrt(1 - y * y), th = i * GOLD;
    const sph = [r * Math.cos(th), y, r * Math.sin(th)];
    const phi = TAU * ((i * 0.6180339887) % 1), psi = TAU * (i / N) * 29;
    const tR = 0.82, tr = 0.34;
    const tor = [(tR + tr * Math.cos(psi)) * Math.cos(phi), tr * Math.sin(psi), (tR + tr * Math.cos(psi)) * Math.sin(phi)];
    const side = Math.ceil(Math.sqrt(N));
    const gx = (i % side) / (side - 1) * 2.8 - 1.4, gz = Math.floor(i / side) / (side - 1) * 2.8 - 1.4;
    const wav = [gx, 0.3 * Math.sin(2.4 * gx + u * 5) * Math.cos(2.2 * gz + u * 2.5) + 0.15, gz];
    const m1 = E.inOutExpo(prog(u, BEAT * 1.1 + p.d * 0.22, BEAT * 1.1 + 0.5 + p.d * 0.22));
    const m2 = E.inOutExpo(prog(u, BEAT * 2.3 + p.d * 0.22, BEAT * 2.3 + 0.5 + p.d * 0.22));
    return [0, 1, 2].map(k => lerp(lerp(sph[k], tor[k], m1), wav[k], m2));
  }
  function cam(u) {
    const col = E.inExpo(prog(u, BEAT * 3.35, BAR));
    return {
      yaw: 0.5 + u * 0.95, pitch: 0.28 + 0.14 * Math.sin(u * 1.4) + 0.2 * E.inOutCubic(prog(u, BEAT * 2.3, BEAT * 3)),
      sc: 330 * (1 - col) * (1 + 0.04 * Math.exp(-(u % BEAT) * 6)), col,
    };
  }
  function proj(v, c) {
    let [x, y, z] = v;
    const cy = Math.cos(c.yaw), sy = Math.sin(c.yaw);
    [x, z] = [x * cy - z * sy, x * sy + z * cy];
    const cp = Math.cos(c.pitch), sp = Math.sin(c.pitch);
    [y, z] = [y * cp - z * sp, y * sp + z * cp];
    const f = 3.4 / (z + 3.4);
    return [CX + x * c.sc * f, CY - 20 + y * c.sc * f, z];
  }
  function project3d(i, u) { return proj(shape3d(i, u), cam(u)); }

  function s4(ctx, u) {
    fill(ctx, C.ink);
    const c = cam(u);
    const fa = E.outCubic(prog(u, 0, 0.5)) * (1 - c.col);

    // floor
    if (fa > 0) {
      const hz = H * 0.66;
      const g = ctx.createLinearGradient(0, hz - 160, 0, hz + 40);
      g.addColorStop(0, rgba(C.violet, 0)); g.addColorStop(0.8, rgba(C.violet, 0.35 * fa)); g.addColorStop(1, rgba(C.pink, 0.5 * fa));
      ctx.fillStyle = g; ctx.fillRect(0, hz - 160, W, 200);
      ctx.save(); ctx.beginPath(); ctx.rect(0, hz, W, H - hz); ctx.clip();
      ctx.lineWidth = 1.5;
      for (let k = 0; k < 18; k++) {
        const z = 0.4 + ((k + u * 2.6) % 18);
        const y = hz + 420 / z;
        ctx.strokeStyle = rgba(C.violet, fa * clamp(1.4 - z / 14) * 0.8);
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
      }
      for (let k = -16; k <= 16; k++) {
        ctx.strokeStyle = rgba(C.violet, fa * 0.6);
        ctx.beginPath(); ctx.moveTo(CX, hz); ctx.lineTo(CX + k * 260, H + 20); ctx.stroke();
      }
      ctx.restore();
    }

    // orbit rings
    if (fa > 0) {
      [[1.55, 0.5, 0.2], [1.8, -0.35, 1.1]].forEach(([R, tilt, off]) => {
        ctx.strokeStyle = rgba(C.paper, 0.35 * fa); ctx.lineWidth = 1.5; ctx.beginPath();
        let sat = null;
        for (let j = 0; j <= 96; j++) {
          const a = j / 96 * TAU;
          const v = [Math.cos(a) * R, Math.sin(a) * R * Math.sin(tilt), Math.sin(a) * R * Math.cos(tilt)];
          const s = proj(v, c);
          j ? ctx.lineTo(s[0], s[1]) : ctx.moveTo(s[0], s[1]);
        }
        ctx.stroke();
        const a = u * 2 + off;
        sat = proj([Math.cos(a) * R, Math.sin(a) * R * Math.sin(tilt), Math.sin(a) * R * Math.cos(tilt)], c);
        ctx.fillStyle = C.lime; circle(ctx, sat[0], sat[1], 7 * fa); ctx.fill();
      });
    }

    // point cloud
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < P.length; i++) {
      const s = proj(shape3d(i, u), c);
      const near = clamp((1.6 - s[2]) / 3.2);
      const sz = 1.2 + 3.4 * near;
      ctx.globalAlpha = 0.3 + 0.7 * near;
      ctx.fillStyle = P[i].css;
      ctx.fillRect(s[0] - sz / 2, s[1] - sz / 2, sz, sz);
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';

    // collapse flare
    if (c.col > 0) {
      ctx.fillStyle = rgba(C.pink, c.col);
      circle(ctx, CX, CY - 20, 60 * E.outBack(c.col)); ctx.fill();
    }

    // coordinate readout
    const ta = E.outExpo(prog(u, 0.2, 0.5)) * (1 - c.col);
    if (ta > 0) {
      ctx.globalAlpha = ta;
      text(ctx, `rotY ${(c.yaw * 57.3 % 360).toFixed(1).padStart(5, '0')}°   rotX ${(c.pitch * 57.3).toFixed(1)}°   fov 38`, CX, H - 150, F.jb(400, 20), C.paper, 'center', 2);
      ctx.globalAlpha = 1;
    }
  }

  // ======================================================================
  // SCENE 5 : LIQUID FX. Metaballs (blur + alpha threshold) with a living
  // gradient, over huge outlined serif type.
  // ======================================================================
  function blobs(u) {
    const b = [];
    const grow = E.outBack(prog(u, 0, 0.45));
    b.push([CX, CY, 170 * grow * (1 + 0.08 * Math.exp(-(u % BEAT) * 5))]);
    for (let k = 0; k < 7; k++) {
      const em = E.outCubic(prog(u, 0.12 + k * 0.035, 0.7 + k * 0.035));
      const breathe = 0.62 + 0.38 * (0.5 - 0.5 * Math.cos(TAU * (u / BEAT) + k * 0.4));
      const orbit = (250 + 110 * Math.sin(u * 2.1 + k * 1.3)) * breathe * em;
      const a = k / 7 * TAU + u * (0.7 + 0.08 * k);
      b.push([CX + Math.cos(a) * orbit * 1.35, CY + Math.sin(a) * orbit * 0.85, (48 + 26 * Math.sin(k * 2.3 + u * 3)) * grow]);
    }
    // droplet flicked out on each beat
    const beatN = Math.floor(u / BEAT), v = u - beatN * BEAT;
    const fp = E.outCubic(clamp(v / BEAT));
    const fa = -0.6 + beatN * 2.1;
    const dist = 170 + Math.sin(fp * Math.PI) * 420;
    b.push([CX + Math.cos(fa) * dist, CY + Math.sin(fa) * dist * 0.7, 44 * grow]);
    return b;
  }

  function s5(ctx, u) {
    fill(ctx, C.deep);
    // outlined type behind
    const ta = E.outCubic(prog(u, 0, 0.5));
    ctx.save();
    ctx.font = F.is(560); ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    ctx.strokeStyle = rgba(C.paper, 0.22 * ta); ctx.lineWidth = 2;
    ctx.strokeText('liquid', CX + 260 - u * 120, CY + 170);
    ctx.restore();

    // bubbles
    const br = rng(3);
    for (let k = 0; k < 26; k++) {
      const x = br() * W, sp = 80 + br() * 160, ph = br() * H, r = 3 + br() * 9;
      const y = H + 40 - ((ph + u * sp) % (H + 80));
      ctx.strokeStyle = rgba(C.paper, 0.35 * ta); ctx.lineWidth = 1.5;
      circle(ctx, x + Math.sin(u * 3 + k) * 12, y, r); ctx.stroke();
    }

    // goo
    const a = goo.a.getContext('2d'), g = goo.b.getContext('2d');
    a.clearRect(0, 0, W / 2, H / 2); a.fillStyle = '#fff';
    blobs(u).forEach(([x, y, r]) => { circle(a, x / 2, y / 2, r / 2); a.fill(); });
    g.clearRect(0, 0, W / 2, H / 2);
    g.filter = 'url(#goo)'; g.drawImage(goo.a, 0, 0); g.filter = 'none';
    g.globalCompositeOperation = 'source-in';
    const ang = u * 0.9;
    const gr = g.createLinearGradient(W / 4 - Math.cos(ang) * 400, H / 4 - Math.sin(ang) * 300, W / 4 + Math.cos(ang) * 400, H / 4 + Math.sin(ang) * 300);
    gr.addColorStop(0, C.pink); gr.addColorStop(0.5, C.orange); gr.addColorStop(1, C.lime);
    g.fillStyle = gr; g.fillRect(0, 0, W / 2, H / 2);
    g.globalCompositeOperation = 'source-atop';
    const hl = g.createRadialGradient(W / 4 - 70, H / 4 - 80, 0, W / 4 - 70, H / 4 - 80, 260);
    hl.addColorStop(0, 'rgba(255,255,255,0.22)'); hl.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = hl; g.fillRect(0, 0, W / 2, H / 2);
    g.globalCompositeOperation = 'source-over';
    ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(goo.b, 0, 0, W, H);

    // caption
    const ca = E.outExpo(prog(u, 0.35, 0.7));
    if (ca > 0) {
      ctx.globalAlpha = ca;
      text(ctx, 'feGaussianBlur  +  alpha threshold', CX, H - 150, F.jb(400, 20), C.paper, 'center', 2);
      ctx.globalAlpha = 1;
    }
  }

  // ======================================================================
  // SCENE 6 : CHARACTER + UI. A 3x3 wall of tiny loops, each one a
  // different craft skill, then a push into the centre tile.
  // ======================================================================
  const TW = 576, TH = 300, GAP = 28;
  const TILES = [
    { bg: C.blue, label: 'SQUASH & STRETCH', fg: C.paper, draw: tBall },
    { bg: C.ink, label: 'DATA VIZ', fg: C.paper, draw: tBars },
    { bg: C.lime, label: 'UI MOTION', fg: C.ink, draw: tUI },
    { bg: C.ink, label: 'WAVEFORMS', fg: C.paper, draw: tWaves },
    { bg: C.ink, label: 'TIMING', fg: C.paper, draw: tPendulum },
    { bg: C.paper, label: 'CHARTS', fg: C.ink, draw: tLine },
    { bg: C.pink, label: 'OFFSET', fg: C.ink, draw: tOffset },
    { bg: C.ink, label: 'EASING', fg: C.paper, draw: tCode },
    { bg: C.violet, label: 'PATTERN', fg: C.paper, draw: tDots },
  ];

  function tBall(ctx, u) {
    const floor = 80, per = BEAT;
    const ph = ((u + per * 0.5) % per) / per;
    const hgt = 4 * ph * (1 - ph);
    const x = -220 + ((u * 260) % 440);
    const y = floor - 36 - hgt * 120;
    const vy = Math.abs(1 - 2 * ph);
    const contact = Math.max(0, 1 - hgt * 8);
    const sx = 1 + 0.35 * contact - 0.12 * vy * (1 - contact), sy = 1 - 0.35 * contact + 0.2 * vy * (1 - contact);
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath(); ctx.ellipse(x, floor, 40 * (1 - hgt * 0.5), 8 * (1 - hgt * 0.5), 0, 0, TAU); ctx.fill();
    ctx.strokeStyle = rgba(C.paper, 0.5); ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(-250, floor); ctx.lineTo(250, floor); ctx.stroke();
    ctx.save(); ctx.translate(x, y + 36 * (1 - sy)); ctx.scale(sx, sy);
    ctx.fillStyle = C.lime; circle(ctx, 0, 0, 36); ctx.fill();
    ctx.restore();
  }
  function tBars(ctx, u) {
    const vals = [0.35, 0.55, 0.42, 0.7, 0.62, 0.95];
    vals.forEach((v, i) => {
      const p = E.outBack(prog(u, 0.25 + i * 0.07, 0.65 + i * 0.07));
      const h = v * 150 * p;
      ctx.fillStyle = i === 5 ? C.orange : rgba(C.paper, 0.85);
      rrect(ctx, -250 + i * 38, 95 - h, 26, h, 6); ctx.fill();
    });
    const n = Math.round(248 * E.outCubic(prog(u, 0.3, 1.2)));
    text(ctx, `+${n}%`, 240, 30, F.sg(700, 76), C.paper, 'right');
    text(ctx, 'growth, yoy', 240, 66, F.jb(400, 18), C.orange, 'right');
  }
  function tUI(ctx, u) {
    const on = Math.floor((u + 0.2) / BEAT) % 2 === 1;
    const tp = E.outBack(clamp((((u + 0.2) % BEAT)) / 0.25));
    const k = on ? tp : 1 - tp;
    rrect(ctx, -220, -70, 120, 64, 32); ctx.fillStyle = mix(C.ink, C.blue, clamp(k)); ctx.fill();
    ctx.fillStyle = C.paper; circle(ctx, -188 + 56 * k, -38, 24); ctx.fill();
    // progress ring
    const pr = (u * 0.7) % 1;
    ctx.lineWidth = 12; ctx.strokeStyle = 'rgba(0,0,0,0.15)'; circle(ctx, 160, -38, 48); ctx.stroke();
    ctx.strokeStyle = C.ink; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.arc(160, -38, 48, -Math.PI / 2, -Math.PI / 2 + TAU * E.inOutCubic(pr)); ctx.stroke();
    // button + cursor click
    const cp = (u % (BEAT * 2)) / (BEAT * 2);
    const press = Math.exp(-Math.max(0, cp - 0.5) * 30) * (cp > 0.5 ? 1 : 0);
    ctx.save(); ctx.translate(-60, 70); ctx.scale(1 - press * 0.06, 1 - press * 0.06);
    rrect(ctx, -110, -30, 220, 60, 30); ctx.fillStyle = C.ink; ctx.fill();
    text(ctx, 'Hire me', 0, 9, F.sg(700, 26), C.lime);
    ctx.restore();
    if (cp > 0.5) { const rp = (cp - 0.5) * 2; ctx.strokeStyle = rgba(C.ink, 1 - rp); ctx.lineWidth = 3; circle(ctx, -20, 80, 10 + rp * 60); ctx.stroke(); }
    const mx = lerp(120, -20, E.inOutCubic(clamp(cp * 2))), my = lerp(150, 80, E.inOutCubic(clamp(cp * 2)));
    ctx.fillStyle = C.ink; ctx.beginPath();
    ctx.moveTo(mx, my); ctx.lineTo(mx, my + 34); ctx.lineTo(mx + 9, my + 26); ctx.lineTo(mx + 22, my + 28); ctx.closePath(); ctx.fill();
  }
  function tWaves(ctx, u) {
    [C.pink, C.blue, C.lime, C.orange].forEach((col, k) => {
      ctx.strokeStyle = col; ctx.lineWidth = 4; ctx.beginPath();
      for (let x = -260; x <= 260; x += 6) {
        const y = Math.sin(x * 0.02 + u * 6 + k * 0.8) * 60 * Math.sin((x + 260) / 520 * Math.PI) + (k - 1.5) * 12;
        x === -260 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      ctx.stroke();
    });
  }
  function tPendulum(ctx, u) {
    const n = 15;
    for (let i = 0; i < n; i++) {
      const f = (18 + i) / 18;
      const x = Math.sin(u * f * 4.4) * 200;
      const y = -105 + i * 15;
      ctx.fillStyle = i % 5 === 0 ? C.orange : C.paper;
      circle(ctx, x, y, 6.5); ctx.fill();
    }
  }
  function tLine(ctx, u) {
    const p = E.inOutCubic(prog(u, 0.2, 1.3));
    ctx.strokeStyle = rgba(C.ink, 0.15); ctx.lineWidth = 1;
    for (let k = 0; k < 5; k++) { ctx.beginPath(); ctx.moveTo(-240, -90 + k * 45); ctx.lineTo(240, -90 + k * 45); ctx.stroke(); }
    const fy = x => 60 - (x + 240) / 480 * 120 - Math.sin(x * 0.03) * 30;
    const xe = -240 + 480 * p;
    ctx.beginPath(); ctx.moveTo(-240, 100);
    for (let x = -240; x <= xe; x += 4) ctx.lineTo(x, fy(x));
    ctx.lineTo(xe, 100); ctx.closePath(); ctx.fillStyle = rgba(C.orange, 0.2); ctx.fill();
    ctx.strokeStyle = C.ink; ctx.lineWidth = 4; ctx.lineJoin = 'round'; ctx.beginPath();
    for (let x = -240; x <= xe; x += 4) x === -240 ? ctx.moveTo(x, fy(x)) : ctx.lineTo(x, fy(x));
    ctx.stroke();
    ctx.fillStyle = C.orange; circle(ctx, xe, fy(xe), 10); ctx.fill();
  }
  function tOffset(ctx, u) {
    ctx.lineWidth = 5; ctx.strokeStyle = C.ink;
    for (let k = 7; k >= 0; k--) {
      const r = E.inOutCubic((Math.sin(u * 3.2 - k * 0.22) + 1) / 2) * Math.PI / 2;
      const s = 26 + k * 16;
      ctx.save(); ctx.rotate(r); ctx.strokeRect(-s, -s, s * 2, s * 2); ctx.restore();
    }
  }
  function tCode(ctx, u) {
    const lines = [
      [['const ', C.pink], ['ease', C.lime], [' = t =>', C.paper]],
      [['  t < .5 ? ', C.paper], ['4*t*t*t', C.orange]],
      [['  : 1 - (-2*t+2)**3/2;', C.paper]],
    ];
    const total = Math.floor(clamp((u - 0.2) / 0.9) * 62);
    let n = 0;
    ctx.font = F.jb(400, 20); ctx.textAlign = 'left';
    lines.forEach((ln, li) => {
      let x = -250;
      ln.forEach(([s, col]) => {
        const vis = s.slice(0, Math.max(0, total - n)); n += s.length;
        ctx.fillStyle = col; ctx.fillText(vis, x, -50 + li * 34);
        x += ctx.measureText(s).width;
      });
    });
    if (Math.floor(u * 4) % 2 === 0) { ctx.fillStyle = C.lime; ctx.fillRect(-250 + ctx.measureText('  : 1 - (-2*t+2)**3/2;').width * clamp((total - 40) / 22) + 4, 0, 11, 24); }
    // curve preview
    ctx.strokeStyle = rgba(C.paper, 0.3); ctx.lineWidth = 1.5; ctx.strokeRect(-250, 50, 90, 70);
    ctx.strokeStyle = C.lime; ctx.lineWidth = 3; ctx.beginPath();
    for (let k = 0; k <= 30; k++) { const t = k / 30, x = -250 + t * 90, y = 120 - E.inOutCubic(t) * 70; k ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
    ctx.stroke();
    const t = (u * 0.9) % 1;
    ctx.fillStyle = C.orange; circle(ctx, -250 + t * 90, 120 - E.inOutCubic(t) * 70, 6); ctx.fill();
    circle(ctx, -120 + E.inOutCubic(t) * 360, 85, 14); ctx.fill();
  }
  function tDots(ctx, u) {
    for (let y = 0; y < 6; y++) for (let x = 0; x < 13; x++) {
      const px = -240 + x * 40, py = -100 + y * 40;
      const d = Math.hypot(px, py);
      const s = 0.5 + 0.5 * Math.sin(d * 0.03 - u * 7);
      ctx.fillStyle = s > 0.7 ? C.lime : C.paper;
      circle(ctx, px, py, 3 + 11 * s); ctx.fill();
    }
  }

  function s6(ctx, u) {
    fill(ctx, C.paper);
    const zp = E.inOutExpo(prog(u, BEAT * 3.1, BAR));
    const sc = lerp(lerp(0.82, 0.9, E.outCubic(prog(u, 0, BEAT * 3))), 4.1, zp);
    const rot = lerp(-0.03, 0, E.outCubic(prog(u, 0, BEAT * 3))) * (1 - zp);
    ctx.save(); ctx.translate(CX, CY); ctx.rotate(rot); ctx.scale(sc, sc);
    TILES.forEach((T, idx) => {
      const r = Math.floor(idx / 3), c = idx % 3;
      const dl = (Math.abs(r - 1) + Math.abs(c - 1)) * 0.07 + 0.3;
      const p = E.outBack(prog(u, dl, dl + 0.42));
      if (p <= 0) return;
      const x = (c - 1) * (TW + GAP), y = (r - 1) * (TH + GAP);
      ctx.save(); ctx.translate(x, y); ctx.scale(p, p);
      rrect(ctx, -TW / 2, -TH / 2, TW, TH, 22); ctx.fillStyle = T.bg; ctx.fill();
      if (T.bg === C.paper) { ctx.strokeStyle = rgba(C.ink, 0.15); ctx.lineWidth = 2; ctx.stroke(); }
      ctx.save(); rrect(ctx, -TW / 2, -TH / 2, TW, TH, 22); ctx.clip();
      const fade = idx === 4 ? 1 - zp : 1;
      ctx.globalAlpha = fade;
      T.draw(ctx, u - dl);
      text(ctx, T.label, -TW / 2 + 24, -TH / 2 + 38, F.jb(700, 15), T.fg, 'left', 2);
      text(ctx, String(idx + 1).padStart(2, '0'), TW / 2 - 24, -TH / 2 + 38, F.jb(400, 15), T.fg, 'right', 2);
      ctx.globalAlpha = 1;
      ctx.restore(); ctx.restore();
    });
    ctx.restore();
  }

  // ======================================================================
  // SCENE 7 : SIGNATURE. The end card, then everything folds back into
  // the dot we started with.
  // ======================================================================
  function s7(ctx, u) {
    fill(ctx, C.ink);
    const fold = E.inExpo(prog(u, 1.36, 1.7));
    const sc = 1 - fold;
    ctx.save(); ctx.translate(CX, CY); ctx.scale(sc, sc); ctx.translate(-CX, -CY);

    // shockwave rings
    for (let k = 0; k < 3; k++) {
      const rp = prog(u, k * 0.08, k * 0.08 + 1.1);
      if (rp <= 0 || rp >= 1) continue;
      ctx.strokeStyle = rgba(k === 1 ? C.lime : C.orange, (1 - rp) * 0.8); ctx.lineWidth = 12 * (1 - rp) + 1;
      circle(ctx, CX, CY, lerp(100, 1300, E.outExpo(rp))); ctx.stroke();
    }
    // sun disc
    const dr = 330 * E.outElastic(prog(u, 0.0, 0.9)) * (1 + 0.02 * Math.sin(u * 8));
    ctx.fillStyle = C.orange; circle(ctx, CX, CY - 30, dr); ctx.fill();

    // name, masked rise, drawn with difference
    ctx.save();
    ctx.globalCompositeOperation = 'difference';
    const L = lay(ctx, 'CLAUDE', F.sg(700, 250), 10);
    ctx.font = F.sg(700, 250); ctx.fillStyle = C.paper; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    const base = CY + 40;
    ctx.beginPath(); ctx.rect(0, 0, W, base + 10); ctx.clip();
    L.letters.forEach((l, i) => {
      const s = 0.06 + i * 0.045, p = E.outExpo(prog(u, s, s + 0.7));
      ctx.fillText(l.ch, CX + l.x, base + (1 - p) * 250);
    });
    ctx.restore();

    // subtitle
    const sp = E.outExpo(prog(u, 0.35, 0.95));
    if (sp > 0) {
      ctx.globalAlpha = sp;
      text(ctx, 'Motion Designer', CX, base + 110 + (1 - sp) * 40, F.is(92), C.paper, 'center', lerp(20, 0, sp));
      ctx.globalAlpha = 1;
    }
    // skills line
    const skills = 'KINETIC TYPE  •  3D  •  PARTICLES  •  LIQUID  •  CHARACTER  •  UI';
    const kp = prog(u, 0.55, 1.05);
    if (kp > 0) {
      const nch = Math.floor(skills.length * E.outCubic(kp));
      text(ctx, skills.slice(0, nch), CX, base + 190, F.jb(400, 20), rgba(C.paper, 0.75), 'center', 3);
    }

    // rotating badge
    const bp = E.outBack(prog(u, 0.45, 0.85));
    if (bp > 0) {
      const bx = CX + 470, by = CY - 290;
      ctx.save(); ctx.translate(bx, by); ctx.scale(bp, bp); ctx.rotate(u * 1.2);
      ctx.fillStyle = C.lime; circle(ctx, 0, 0, 104); ctx.fill();
      const msg = 'AVAILABLE FOR WORK • AVAILABLE FOR WORK • ';
      ctx.font = F.jb(700, 15); ctx.fillStyle = C.ink; ctx.textAlign = 'center';
      [...msg].forEach((ch, i) => {
        ctx.save(); ctx.rotate(i / msg.length * TAU); ctx.fillText(ch, 0, -80); ctx.restore();
      });
      ctx.rotate(-u * 1.2);
      ctx.fillStyle = C.ink; ctx.beginPath(); ctx.moveTo(-16, -22); ctx.lineTo(26, 0); ctx.lineTo(-16, 22); ctx.closePath(); ctx.fill();
      ctx.restore();
    }
    ctx.restore();

    // the dot, bookending the opening
    const da = prog(u, 1.55, 1.62), dz = E.inBack(prog(u, 1.72, BAR - 0.04));
    if (da > 0 && dz < 1) {
      ctx.fillStyle = C.paper; circle(ctx, CX, CY, 14 * E.outBack(da) * (1 - dz)); ctx.fill();
    }
  }

  const SCENES = [s0, s1, s2, s3, s4, s5, s6, s7];

  // ------------------------------------------------------------ scene pass
  function drawScene(ctx, t) {
    t = clamp(t, 0, DUR - 1e-6);
    const i = Math.min(7, Math.floor(t / BAR));
    const u = t - i * BAR;
    ctx.save();
    const sh = hitSum(t, 1, 11);
    if (sh > 0.1) ctx.translate(noise(t * 40, 1) * sh, noise(3, t * 43) * sh);
    if (i === 6 && u < 0.46) {
      // iris transition from liquid into the grid
      s5(ctx, u + BAR);
      const r = 1250 * E.inOutExpo(prog(u, 0, 0.46));
      ctx.save(); circle(ctx, CX, CY, r); ctx.clip(); s6(ctx, u); ctx.restore();
      ctx.strokeStyle = C.lime; ctx.lineWidth = 14; circle(ctx, CX, CY, r); ctx.stroke();
    } else {
      SCENES[i](ctx, u);
    }
    ctx.restore();
  }

  // ------------------------------------------------------------ post + HUD
  let bufs = null;
  function buffers() {
    if (bufs) return bufs;
    const mk = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
    bufs = { scene: mk(W, H), acc: mk(W, H), bloom: mk(W / 6, H / 6), r: mk(W, H), g: mk(W, H), b: mk(W, H), tmp: mk(W, H) };
    return bufs;
  }

  function chroma(ctx, amt) {
    const B = buffers();
    B.tmp.getContext('2d').drawImage(ctx.canvas, 0, 0);
    [['r', '#ff0000', -amt], ['g', '#00ff00', 0], ['b', '#0000ff', amt]].forEach(([k, col]) => {
      const c = B[k].getContext('2d');
      c.globalCompositeOperation = 'source-over'; c.drawImage(B.tmp, 0, 0);
      c.globalCompositeOperation = 'multiply'; c.fillStyle = col; c.fillRect(0, 0, W, H);
    });
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
    ctx.globalCompositeOperation = 'lighter';
    ctx.drawImage(B.r, -amt, 0); ctx.drawImage(B.g, 0, 0); ctx.drawImage(B.b, amt, 0);
    ctx.restore();
  }

  function hud(ctx, t) {
    const a = E.outCubic(prog(t, 0.45, 0.9)) * (1 - E.inCubic(prog(t, DUR - 0.9, DUR - 0.5)));
    if (a <= 0) return;
    ctx.save();
    ctx.globalCompositeOperation = 'difference';
    ctx.globalAlpha = a;
    const col = '#E8E8E8', m = 56;
    ctx.strokeStyle = col; ctx.lineWidth = 2;
    [[m, m, 1, 1], [W - m, m, -1, 1], [m, H - m, 1, -1], [W - m, H - m, -1, -1]].forEach(([x, y, sx, sy]) => {
      ctx.beginPath(); ctx.moveTo(x, y + sy * 28); ctx.lineTo(x, y); ctx.lineTo(x + sx * 28, y); ctx.stroke();
    });
    text(ctx, 'CLAUDE', m + 44, m + 30, F.jb(700, 17), col, 'left', 3);
    text(ctx, 'MOTION REEL ’26', m + 142, m + 30, F.jb(400, 17), col, 'left', 3);

    // section label with slot roll
    const i = Math.min(7, Math.floor(t / BAR)), u = t - i * BAR;
    const roll = E.outExpo(prog(u, 0, 0.35));
    ctx.save(); ctx.beginPath(); ctx.rect(W - m - 520, m + 6, 480, 34); ctx.clip();
    const lbl = k => `${String(k + 1).padStart(2, '0')} / ${SECTIONS[k]}`;
    text(ctx, lbl(i), W - m - 44, m + 30 + (1 - roll) * 32, F.jb(700, 17), col, 'right', 3);
    if (i > 0 && roll < 1) text(ctx, lbl(i - 1), W - m - 44, m + 30 - roll * 32, F.jb(700, 17), col, 'right', 3);
    ctx.restore();

    // timecode
    const f = Math.floor(t * FPS + 1e-6);
    const tc = `00:00:${String(Math.floor(f / FPS)).padStart(2, '0')}:${String(f % FPS).padStart(2, '0')}`;
    text(ctx, 'TC ' + tc, m + 44, H - m - 16, F.jb(400, 17), col, 'left', 2);

    // beat meter
    const beat = Math.floor(t / BEAT) % 4;
    for (let k = 0; k < 4; k++) {
      const x = W - m - 44 - (3 - k) * 22 - 14;
      if (k === beat) { const fl = Math.exp(-(t % BEAT) * 6); ctx.fillStyle = col; ctx.globalAlpha = a * (0.5 + 0.5 * fl); ctx.fillRect(x, H - m - 30, 14, 14); ctx.globalAlpha = a; }
      else { ctx.strokeRect(x + 1, H - m - 29, 12, 12); }
    }
    text(ctx, '128 BPM', W - m - 44 - 4 * 22 - 14, H - m - 16, F.jb(400, 17), col, 'right', 2);

    // progress
    const pw = 240, px = CX - pw / 2, py = H - m - 22;
    ctx.fillStyle = col; ctx.globalAlpha = a * 0.35; ctx.fillRect(px, py, pw, 2);
    ctx.globalAlpha = a; ctx.fillRect(px, py, pw * (t / DUR), 2);
    ctx.restore();
  }

  function post(ctx, t, frame) {
    const B = buffers();
    // bloom
    const bc = B.bloom.getContext('2d');
    bc.filter = 'blur(5px)'; bc.clearRect(0, 0, W / 6, H / 6);
    bc.drawImage(ctx.canvas, 0, 0, W / 6, H / 6); bc.filter = 'none';
    ctx.save(); ctx.globalCompositeOperation = 'screen'; ctx.globalAlpha = 0.28;
    ctx.imageSmoothingEnabled = true; ctx.drawImage(B.bloom, 0, 0, W, H); ctx.restore();

    const ch = hitSum(t, 2, 14);
    if (ch > 0.6) chroma(ctx, ch);

    const fl = hitSum(t, 3, 16);
    if (fl > 0.01) { ctx.fillStyle = `rgba(255,255,255,${Math.min(0.9, fl)})`; ctx.fillRect(0, 0, W, H); }

    hud(ctx, t);

    // vignette
    const vg = ctx.createRadialGradient(CX, CY, H * 0.45, CX, CY, H * 1.05);
    vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.38)');
    ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);

    // grain
    const r = rng(frame * 7 + 1);
    ctx.save(); ctx.globalCompositeOperation = 'overlay'; ctx.globalAlpha = 0.07;
    const pat = ctx.createPattern(grain, 'repeat');
    ctx.translate(Math.floor(r() * 256), Math.floor(r() * 256));
    ctx.fillStyle = pat; ctx.fillRect(-256, -256, W + 512, H + 512);
    ctx.restore();

    // fade to black on the final frames
    const end = prog(t, DUR - 0.06, DUR - 1 / FPS);
    if (end > 0) { ctx.fillStyle = `rgba(0,0,0,${end})`; ctx.fillRect(0, 0, W, H); }
  }

  /**
   * Render one output frame. `subs` temporal samples are averaged across a
   * 180 degree shutter for motion blur.
   */
  function renderFrame(ctx, frame, subs = 1, shutter = 0.5) {
    const B = buffers();
    const t0 = frame / FPS;
    if (subs <= 1) {
      drawScene(ctx, t0);
    } else {
      const sc = B.scene.getContext('2d'), ac = B.acc.getContext('2d');
      for (let k = 0; k < subs; k++) {
        const ts = Math.max(0, t0 + ((k + 0.5) / subs - 0.5) * shutter / FPS);
        sc.setTransform(1, 0, 0, 1, 0, 0);
        drawScene(sc, ts);
        ac.globalAlpha = 1 / (k + 1); ac.drawImage(B.scene, 0, 0);
      }
      ac.globalAlpha = 1;
      ctx.drawImage(B.acc, 0, 0);
    }
    post(ctx, t0, frame);
  }

  window.Reel = { W, H, FPS, DUR, BPM, init, renderFrame, frames: Math.round(DUR * FPS) };
})();
