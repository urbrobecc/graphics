// "peri" launch film. 32 s at 24 fps, 120 BPM (one bar = 2 s).
//
//   0.0  intro        wordmark, the dot of the i grows into a lens
//   1.6  lens         four tiny worlds seen through the periscope, the last is a night market
//   8.0  wide         Peri drops in, the lens floats off as an orb, then it pings
//  10.6  push in      camera dollies in, cards appear in Peri's line of sight, it saves them
//  17.2  eyes         dolly into the face, a check badge, joy
//  21.0  friends      pull back, five friends drop in with the tagline
//  27.5  waitlist     phone + call to action, iris closes on the logo lockup
(function () {
  const { W, H, FPS, DUR, TAU, clamp, lerp, seg, ease, spring, C } = P;
  const U = P.ui, S = P.scenes;
  const PX = 560, FLOOR = 820, S0 = 0.34;       // Peri's home in world space
  const R0 = 500;                               // lens radius at full size
  const CUT = [1.6, 4.0, 5.5, 7.0, 8.0];        // montage cuts (all on beats)

  // ---------- small helpers ----------
  const track = (t, keys) => {                  // smooth interpolation through [time, value] keys
    if (t <= keys[0][0]) return keys[0][1];
    for (let i = 1; i < keys.length; i++) if (t < keys[i][0]) {
      const [a, va] = keys[i - 1], [b, vb] = keys[i]; return lerp(va, vb, ease.io3(seg(t, a, b)));
    }
    return keys[keys.length - 1][1];
  };
  const drop = (t, t0, h = 700, fall = 0.34) => {   // fall from above and squash on landing
    const d = t - t0; if (d < 0) return { dy: -h * 2, sq: 0, on: false };
    if (d < fall) return { dy: -h * (1 - ease.in2(d / fall)), sq: -0.16 * (d / fall), on: false };
    const a = d - fall; return { dy: 0, sq: 0.2 * Math.exp(-a * 8) * Math.cos(a * 17), on: true };
  };
  const jump = (t, t0, dur = 0.5, h = 100) => {     // anticipation, flight, landing
    const d = t - t0;
    if (d < -0.14) return { dy: 0, sq: 0 };
    if (d < 0) return { dy: 0, sq: 0.14 * ease.out2((d + 0.14) / 0.14) };
    if (d < dur) { const u = d / dur; return { dy: -h * 4 * u * (1 - u), sq: -0.1 * Math.sin(u * Math.PI) }; }
    const a = d - dur; return { dy: 0, sq: 0.16 * Math.exp(-a * 9) * Math.cos(a * 18) };
  };
  const blink = (t, seed = 0) => { const c = (t * 1 + seed * 1.9) % 3.1; return c < 0.15 ? Math.sin(c / 0.15 * Math.PI) : 0; };
  const toScreen = (c, wx, wy) => [(wx - c.x) * c.s + W / 2, (wy - c.y) * c.s + H / 2];
  const withCam = (ctx, c, fn) => { ctx.save(); ctx.translate(W / 2, H / 2); ctx.scale(c.s, c.s); ctx.translate(-c.x, -c.y); fn(); ctx.restore(); };
  const lensWorld = (ext = 0) => [PX + (1105 - 470) * S0, FLOOR + (262 - ext - 1003) * S0];

  // ---------- camera ----------
  const FACE = [636.5, 708.5];                  // between the eyes, world space
  function camera(t) {
    const base = { s: 1, x: 960, y: 540 };
    if (t < 8.6) return base;
    if (t < 10.6) return { s: 1 + 0.015 * seg(t, 8.6, 10.6), x: 960 - 24 * ease.io2(seg(t, 8.6, 10.6)), y: 540 };
    const A = { s: 1.015, x: 936, y: 540 }, B = { s: 2.35, x: 785, y: 640 };
    if (t < 12.4) { const e = ease.io3(seg(t, 10.6, 12.4)); return { s: Math.exp(lerp(Math.log(A.s), Math.log(B.s), e)), x: lerp(A.x, B.x, e), y: lerp(A.y, B.y, e) }; }
    if (t < 17.2) { const k = seg(t, 12.4, 17.2); return { s: B.s * (1 + 0.04 * k), x: B.x + 8 * k, y: B.y }; }
    const B2 = { s: B.s * 1.04, x: B.x + 8, y: B.y };
    if (t < 18.5) { const e = ease.io5(seg(t, 17.2, 18.5)); return { s: Math.exp(lerp(Math.log(B2.s), Math.log(11.5), e)), x: lerp(B2.x, FACE[0], e), y: lerp(B2.y, FACE[1], e) }; }
    if (t < 21.0) { const k = seg(t, 18.5, 21.0); return { s: 11.5 + 0.5 * k, x: FACE[0] + Math.sin(t * 1.3) * 0.6, y: FACE[1] + Math.cos(t * 1.1) * 0.5 }; }
    const C0 = { s: 12, x: FACE[0], y: FACE[1] }, C1 = { s: 1.05, x: 640, y: 640 };
    if (t < 22.5) { const e = ease.io3(seg(t, 21.0, 22.5)); return { s: Math.exp(lerp(Math.log(C0.s), Math.log(C1.s), e)), x: lerp(C0.x, C1.x, e), y: lerp(C0.y, C1.y, e) }; }
    const k = seg(t, 22.5, 28); return { s: 1.05 + 0.06 * k, x: 640 + 14 * k, y: 640 };
  }

  // ---------- main character ----------
  function mainPeri(t) {
    const o = { x: PX, y: FLOOR, s: S0, v: 'mint', mood: 'idle', ext: 120 };
    const id = P.idle(t, 0.3);
    Object.assign(o, id);
    // enter
    const d = drop(t, 8.0);
    o.y += d.dy; o.sq = d.sq + (d.on ? id.sq : 0);
    o.ext = track(t, [[8.0, 0], [8.6, 0], [9.1, 150], [10.0, 150], [10.25, 230], [12.0, 215], [16.5, 215], [17.0, 190]]);
    o.scope = id.scope * (t < 10 ? 1 : 0.5);
    o.lookX = 0.2; o.lookY = 0;
    // look around, then at the orb
    o.lookX = track(t, [[8.6, 0.0], [9.0, -0.8], [9.5, 0.9], [10.0, 0.9], [10.3, 1], [12.4, 1], [14.6, 1], [17.0, 0.8]]);
    o.lookY = track(t, [[8.6, 0], [10.0, -0.2], [10.3, -0.6], [12.6, -0.6], [13.6, -0.35], [14.4, 0.1], [15.2, 0.55], [15.9, 0.0], [16.5, -0.2]]);
    o.blink = blink(t);
    if (t > 8.6 && t < 8.9) o.blink = Math.sin(seg(t, 8.6, 8.9) * Math.PI);
    // reactions
    if (t >= 10.0 && t < 10.9) {
      const j = jump(t, 10.0, 0.5, 130); o.y += j.dy; o.sq = j.sq; o.mood = 'wow';
    } else if (t >= 10.9 && t < 14.2) { o.mood = 'idle'; if (t > 12.3) o.mood = 'wow'; }
    if (t >= 14.2 && t < 16.5) o.mood = 'smirk';
    if (t >= 16.5 && t < 17.5) o.mood = 'happy';
    if (t >= 17.5 && t < 18.0) { o.mood = 'idle'; o.cheeks = 0; }
    if (t >= 16.5 && t < 17.6) { const j = jump(t, 16.62, 0.5, 90); o.y += j.dy; o.sq = j.sq; o.cheeks = 1; }
    // card beats make the lens flash
    const flashes = [12.4, 13.4, 14.4];
    o.lensGlow = Math.max(0, ...flashes.map(f => (t > f ? Math.exp(-(t - f) * 5) : 0)));
    // the close up: eyes
    if (t >= 18.0 && t < 21.4) {
      o.mood = 'idle'; o.cheeks = 0;
      o.lookX = track(t, [[18.0, 0.7], [18.5, -1], [18.9, -1], [19.0, 1], [19.5, 1], [19.6, 0.1], [20.0, 0.1], [20.2, 0.0], [20.6, 0.0]]);
      o.lookY = track(t, [[18.0, 0], [19.5, 0], [19.6, 0.7], [19.95, 0.7], [20.1, -0.9], [20.8, -0.9]]);
      o.blink = t > 19.75 && t < 19.9 ? Math.sin(seg(t, 19.75, 19.9) * Math.PI) : 0;
      if (t > 20.05) { o.mood = 'wow'; o.sparkle = clamp((t - 20.05) / 0.2); }
      if (t > 20.75) { o.mood = 'happy'; o.sparkle = 0; o.cheeks = 1; }
    }
    if (t >= 21.4) { o.mood = 'happy'; o.cheeks = 1; o.lookX = 0.4; o.lookY = 0; }
    if (t >= 22.5) {
      o.ext = 150 + 40 * Math.sin(t * 2.2);
      o.mood = 'happy'; o.lookX = Math.sin(t * 1.6) * 0.9; o.lookY = -0.1;
      o.v = 'mint';
      for (const f of FRIENDS) { const j = jump(t, f.t + 0.42, 0.34, 34); o.y += j.dy * 0.6; o.sq += j.sq * 0.5; }
    }
    return o;
  }

  // ---------- friends ----------
  const FRIENDS = [
    { v: 'rose', x: 30, y: FLOOR, s: 0.31, t: 22.55, ext: 110, text: 'me too!', col: '#ff6fae', flip: false, by: 0 },
    { v: 'sky', x: 250, y: FLOOR + 6, s: 0.33, t: 23.05, ext: 190, text: 'count me in', col: '#2fa9e6', flip: false, by: 95 },
    { v: 'peach', x: 820, y: FLOOR + 60, s: 0.35, t: 23.55, ext: 60, text: 'save me a seat', col: '#f4714a', flip: true, by: 0 },
    { v: 'lemon', x: 1010, y: FLOOR + 6, s: 0.31, t: 24.05, ext: 150, text: "i'll bring snacks", col: '#e0a010', flip: true, by: 100 },
    { v: 'lilac', x: 1190, y: FLOOR, s: 0.3, t: 24.55, ext: 230, text: 'finally!', col: '#7a58e8', flip: true, by: 0 },
  ];
  function friendPeri(f, i, t) {
    const d = drop(t, f.t, 760 + i * 40, 0.36);
    const id = P.idle(t, i * 1.7 + 2);
    const o = Object.assign({}, id, { x: f.x, y: f.y + d.dy, s: f.s, v: f.v, flip: f.flip, ext: f.ext * clamp(0.3 + (t - f.t) * 2) + 30 * Math.sin(t * 2 + i), mood: 'happy', cheeks: 1, reflect: true });
    o.sq = d.sq + (d.on ? id.sq : 0);
    o.lookX = 0.5; o.lookY = 0; o.scope = Math.sin(t * 2.4 + i) * 7;
    const wave = t - f.t - 0.5;
    if (wave > 0) o.mood = Math.floor((t * 1.2 + i) % 2) ? 'happy' : 'idle';
    o.alpha = t >= f.t - 0.9 ? 1 : 0;
    return o;
  }

  // ---------- scenes ----------
  function lensContent(ctx, t, R, scale = 1) {
    // montage: scenes whip past each other on the cuts
    let idx = 0; for (let i = 1; i < CUT.length - 1; i++) if (t >= CUT[i] - 0.09) idx = i;
    const names = S.list;
    const drawScene = (i, off) => {
      ctx.save(); ctx.translate(off * R0 * 2.1, 0);
      const lt = t - CUT[i] + 1.6;
      ctx.scale(1.0 + 0.05 * (t - CUT[i]) / 1.5, 1.0 + 0.05 * (t - CUT[i]) / 1.5);
      S[names[i]](ctx, Math.max(lt, 0) + i * 3.1, R0); ctx.restore();
    };
    ctx.save(); ctx.scale(R / R0, R / R0);
    const nxt = idx + 1 < names.length ? idx + 1 : -1;
    const cutT = nxt >= 0 ? CUT[nxt] : 99, w = ease.io3(seg(t, cutT - 0.09, cutT + 0.09));
    if (t >= CUT[CUT.length - 1] - 0.0 || nxt < 0) drawScene(3, 0);
    else if (w <= 0) drawScene(idx, 0);
    else { drawScene(idx, -w); drawScene(nxt, 1 - w); }
    ctx.restore();
  }

  function introContent(ctx, t) {
    const size = 330, baseY = 650;
    const dot = U.wordmark(ctx, W / 2, baseY, size, t, { delay: 0.3, alpha: 1 - seg(t, 1.45, 1.8) });
    // the dot of the i falls in, lands, then grows into the lens
    const fall = ease.in2(clamp((t - 0.15) / 0.65)), by = lerp(-80, dot.y, fall);
    const sq = t < 0.8 ? -0.1 * fall : 0.22 * Math.exp(-(t - 0.8) * 9) * Math.cos((t - 0.8) * 20);
    if (t < 1.75) { ctx.save(); ctx.globalAlpha = 1 - seg(t, 1.6, 1.75); U.ball(ctx, dot.x, by, 36, 1 + sq, 1 - sq); ctx.restore(); }
  }

  function lensStage(ctx, t, dotPos) {
    // lens grows out of the dot, then settles in the middle of the screen
    const g = ease.io3(seg(t, 1.5, 2.3));
    const cx = lerp(dotPos[0], W / 2, g), cy = lerp(dotPos[1], H / 2, g), R = lerp(30, R0, ease.out3(seg(t, 1.5, 2.3)));
    const pulse = CUT.slice(1, 4).reduce((a, c) => a + (t > c ? 0.07 * Math.exp(-(t - c) * 9) : 0), 0);
    S.lens(ctx, cx, cy, R * (1 + pulse), t, (c, r) => lensContent(c, t, r));
    return [cx, cy, R];
  }

  function worldToOrb(t) {
    const k = ease.io3(seg(t, 8.0, 8.8));
    const bob = Math.sin(t * 1.7) * 9;
    const ping = t > 10.0 ? Math.exp(-(t - 10.0) * 5) * 0.14 * Math.cos((t - 10.0) * 14) : 0;
    return { x: lerp(W / 2, 1330, k), y: lerp(H / 2, 370 + bob, k), R: lerp(R0, 300, k) * (1 + ping) };
  }

  // ---------- cards (screen space) ----------
  const CARDS = [
    { t: 12.45, x: 1030, y: 120, w: 700, h: 176, rot: -2, kind: 'tent', title: 'night market', sub: 'tonight · 7pm · pier 4', pill: { text: 'tonight', color: '#ff7eb6' } },
    { t: 13.45, x: 1100, y: 336, w: 700, h: 176, rot: 1.5, kind: 'mango', title: 'mango stand', sub: 'fresh cut, row C', pill: { text: '40 left', color: '#ffb02e' } },
    { t: 14.45, x: 1040, y: 552, w: 700, h: 176, rot: -1, kind: 'note', title: 'live jazz', sub: '8:30pm · main stage', pill: { text: 'free', color: '#34c47c' } },
  ];
  const BTN = { t: 15.3, x: 1230, y: 792, w: 440, h: 112 };
  function cards(ctx, t) {
    const out = ease.io3(seg(t, 17.0, 17.55));
    ctx.save(); ctx.translate(out * 260, 0); ctx.globalAlpha *= 1 - out;
    // beam from the lens to the cards
    const c = camera(t), [lx, ly] = toScreen(c, ...lensWorld(mainPeri(t).ext));
    const beamA = clamp((t - 12.3) / 0.4) * 0.55;
    const g = ctx.createLinearGradient(lx, 0, 1750, 0); g.addColorStop(0, `rgba(255,255,255,${beamA})`); g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(lx + 40, ly); ctx.lineTo(1800, 60); ctx.lineTo(1800, 800); ctx.closePath(); ctx.fill();
    const saveT = 16.55;
    CARDS.forEach((k, i) => {
      U.card(ctx, Object.assign({ age: t - k.t }, k, { rot: k.rot + Math.sin(t * 1.4 + i) * 0.5, y: k.y + Math.sin(t * 1.8 + i * 2) * 6 }));
      if (t > saveT + i * 0.1) U.badge(ctx, k.x + k.w - 14, k.y + k.h - 10 + Math.sin(t * 1.8 + i * 2) * 6, 76, t - saveT - i * 0.1, { rot: 0.1 });
    });
    const press = t > 16.5 ? Math.exp(-(t - 16.5) * 14) : 0;
    U.button(ctx, Object.assign({ age: t - BTN.t, label: 'save all 3', saved: ease.out3(seg(t, 16.55, 16.8)), press }, BTN, { y: BTN.y + Math.sin(t * 1.6) * 5 }));
    // cursor glides to the button, taps
    if (t > 15.9) {
      const k = ease.io3(seg(t, 15.9, 16.5)), cx = lerp(1850, BTN.x + BTN.w * 0.9, k), cy = lerp(1060, BTN.y + BTN.h * 0.62, k);
      U.cursor(ctx, cx, cy, t > 16.5 ? Math.exp(-(t - 16.5) * 12) : 0, t - 16.5);
    }
    ctx.restore();
    U.burst(ctx, BTN.x + BTN.w / 2, BTN.y + BTN.h / 2, t - 16.55, { n: 30, speed: 900, seed: 3 });
  }

  // ---------- sections ----------
  function wide(ctx, t) {
    const c = camera(t);
    const horizon = (FLOOR - 14 - c.y) * c.s + H / 2;
    P.worldBg(ctx, t, horizon, { px: -(c.x - 960) * 0.2, py: 0, amount: 0.8 });
    if (t < 8.55) {                       // cover: sky still fading into the world
      ctx.save(); ctx.globalAlpha = 1 - ease.out2(seg(t, 8.0, 8.5)); P.skyBg(ctx, t); ctx.restore();
    }
    // orb (the lens, now floating)
    if (t < 12.4) {
      const orb = worldToOrb(t);
      withCam(ctx, c, () => {
        ctx.save(); ctx.translate(orb.x - 960, orb.y - 540);                   // orb lives in world space, centred on the stage
        ctx.translate(960, 540);
        S.lens(ctx, 0, 0, orb.R, t, (cc, r) => lensContent(cc, t, r));
        if (t > 8.9) S.reticle(ctx, 0, 0, orb.R * 0.9, t, 'night market');
        // ping rings
        for (let i = 0; i < 3; i++) {
          const a = t - 10.0 - i * 0.18; if (a < 0 || a > 1.0) continue;
          ctx.strokeStyle = `rgba(255,255,255,${0.9 * (1 - a)})`; ctx.lineWidth = 12 * (1 - a) + 2; P.circle(ctx, 0, 0, orb.R + 30 + a * 300); ctx.stroke();
        }
        ctx.restore();
        // "new" chip
        const ca = t - 10.0;
        if (ca > 0) {
          ctx.save(); ctx.translate(orb.x + orb.R * 0.55, orb.y - orb.R * 0.9); const p = spring(ca, 2.4, 0.4); ctx.scale(p, p);
          ctx.fillStyle = '#ff5b8d'; P.rrect(ctx, -70, -26, 140, 52, 26); ctx.fill();
          P.text(ctx, 'just in', 0, 9, { font: P.font(700, 28), color: '#fff', align: 'center' }); ctx.restore();
        }
      });
    }
    withCam(ctx, c, () => {
      if (t >= 8.0 - 0.9) P.drawPeriOnFloor(ctx, mainPeri(t), FLOOR);
      // exclamation
      if (t > 10.1 && t < 11.7) U.bubble(ctx, ...(() => { const l = lensWorld(mainPeri(t).ext); return [l[0] + 6, l[1] - 18]; })(), '!', t - 10.1, { size: 54, fill: '#fff', color: '#ff5b8d', tail: 0.5 });
    });
    if (t >= 12.3 && t < 17.7) cards(ctx, t);
  }

  function eyes(ctx, t) {                // 17.2 to 22: the face fills the screen
    const c = camera(t);
    const horizon = (FLOOR - 14 - c.y) * c.s + H / 2;
    P.worldBg(ctx, t, horizon, { px: 0, py: 0, amount: 0.8 });
    withCam(ctx, c, () => P.drawPeriOnFloor(ctx, Object.assign(mainPeri(t), { reflect: false }), FLOOR));
    if (t > 20.0) {
      const age = t - 20.0, out = ease.io3(seg(t, 21.0, 21.6));
      ctx.save(); ctx.translate(out * 900, -out * 600); ctx.globalAlpha *= 1 - out;
      U.badge(ctx, W / 2 + 4, 250 + Math.sin(t * 3) * 6, 330, age);
      ctx.restore();
      U.burst(ctx, W / 2, 250, age - 0.05, { n: 34, speed: 1300, seed: 8, size: 20 });
      for (let i = 0; i < 3; i++) { const a = age - i * 0.14; if (a < 0 || a > 0.8) continue; ctx.strokeStyle = `rgba(255,255,255,${0.9 * (1 - a / 0.8)})`; ctx.lineWidth = 14 * (1 - a); P.circle(ctx, W / 2, 250, 200 + a * 700); ctx.stroke(); }
    }
    // beat flashes
    for (const f of [18.5, 19.0, 20.0]) if (t > f && t < f + 0.2) P.flash(ctx, 0.18 * (1 - (t - f) / 0.2));
  }

  function friends(ctx, t) {
    const c = camera(t);
    const horizon = (FLOOR - 14 - c.y) * c.s + H / 2;
    P.worldBg(ctx, t, horizon, { px: -(c.x - 960) * 0.2, py: 0, amount: 0.9 });
    withCam(ctx, c, () => {
      // draw back to front
      const all = [{ f: null, y: FLOOR }, ...FRIENDS.map((f, i) => ({ f, i, y: f.y }))].sort((a, b) => a.y - b.y);
      for (const it of all) {
        if (!it.f) { P.drawPeriOnFloor(ctx, mainPeri(t), FLOOR); continue; }
        const o = friendPeri(it.f, it.i, t); if (o.alpha === 0) continue;
        P.drawPeriOnFloor(ctx, o, it.f.y);
      }
      for (const [i, f] of FRIENDS.entries()) {
        const land = t - f.t - 0.36;
        if (land < 0) continue;
        const hx = f.x + (f.flip ? -10 : 10), hy = f.y - 500 * f.s - f.by;
        U.bubble(ctx, hx, hy, f.text, land - 0.15, { size: 34, tail: f.flip ? 0.2 : 0.8, color: f.col, rot: f.flip ? 2 : -2 });
        U.tag(ctx, f.x + (f.flip ? 40 : -40), f.y - 300 * f.s, '+1', land, f.col);
        U.burst(ctx, f.x, f.y - 60, land, { n: 12, speed: 380, seed: i * 7, size: 11, colors: [f.col, '#fff', '#ffe27a'] });
      }
    });
    // tagline
    const words = [['good', 25.3], ['finds', 25.45], ['are', 25.6], ['better', 25.9]];
    const out = ease.in2(seg(t, 27.1, 27.5));
    ctx.save(); ctx.translate(0, -out * 80); ctx.globalAlpha *= 1 - out;
    const font = P.font(700, 112);
    const line1 = 'good finds are better', w1 = P.measure(ctx, line1, font, -2);
    let x = (W - (w1 + P.measure(ctx, ' together.', P.font(400, 124, 'Instrument Serif', 'italic')) + 20)) / 2;
    for (const [w, tt] of words) {
      const a = clamp((t - tt) / 0.5), p = ease.outBack(a, 1.8);
      ctx.save(); ctx.beginPath(); ctx.rect(0, 70, W, 170); ctx.clip();
      P.text(ctx, w, x, 190 + (1 - p) * 120, { font, color: C.ink, ls: -2, alpha: clamp(a * 3) });
      ctx.restore(); x += P.measure(ctx, w + ' ', font, -2);
    }
    const a2 = clamp((t - 26.3) / 0.6), p2 = ease.outBack(a2, 1.8);
    ctx.save(); ctx.beginPath(); ctx.rect(0, 70, W, 190); ctx.clip();
    P.text(ctx, 'together.', x, 192 + (1 - p2) * 140, { font: P.font(400, 124, 'Instrument Serif', 'italic'), color: '#14a55b', alpha: clamp(a2 * 3) });
    ctx.restore(); ctx.restore();
    if (t > 26.3) U.burst(ctx, x + 200, 150, t - 26.4, { n: 14, speed: 420, seed: 21, size: 12, gravity: 0.2 });
  }

  function waitlist(ctx, t) {
    P.skyBg(ctx, t, { px: Math.sin(t * 0.4) * 20 });
    const a = t - 27.6;
    // phone
    const pp = spring(a, 1.7, 0.5), py = lerp(H + 520, 560, clamp(pp, 0, 1.12));
    ctx.save(); ctx.translate(560, py); ctx.rotate(lerp(-0.14, -0.045, clamp(pp)) + Math.sin(t * 1.2) * 0.008); ctx.translate(-560, -py);
    U.phone(ctx, 560, py, 840, { t, press: t > 29.0 ? Math.exp(-(t - 29.0) * 10) : 0 });
    ctx.restore();
    if (t > 28.95) U.cursor(ctx, 640, py + 270, t > 29.0 ? Math.exp(-(t - 29.0) * 10) : 0, t - 29.0);
    // copy
    const lines = [['join the', 28.0, 0], ['waitlist.', 28.25, 1]];
    for (const [s, tt, i] of lines) {
      const k = clamp((t - tt) / 0.55), p = ease.outBack(k, 1.6);
      ctx.save(); ctx.beginPath(); ctx.rect(960, 230 + i * 190, 960, 190); ctx.clip();
      P.text(ctx, s, 1010, 380 + i * 190 + (1 - p) * 200, { font: P.font(700, 178), color: C.ink, ls: -5, alpha: clamp(k * 3) });
      ctx.restore();
    }
    const bt = t - 28.8;
    if (bt > 0) {
      const p = spring(bt, 2.0, 0.45);
      ctx.save(); ctx.translate(1010 + 270, 790 + 55); ctx.scale(p, p); ctx.translate(-270, -55);
      const g = ctx.createLinearGradient(0, 0, 0, 110); g.addColorStop(0, '#7cf0a5'); g.addColorStop(1, '#27c874');
      ctx.shadowColor = 'rgba(40,190,110,0.5)'; ctx.shadowBlur = 36; ctx.shadowOffsetY = 14;
      P.rrect(ctx, 0, 0, 540, 110, 55); ctx.fillStyle = g; ctx.fill(); ctx.shadowColor = 'transparent';
      ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.lineWidth = 3; ctx.stroke();
      P.text(ctx, 'get early access', 270, 72, { font: P.font(700, 44), color: '#06361f', align: 'center' });
      ctx.restore();
      P.text(ctx, 'coming soon', 1014, 760, { font: P.font(700, 26, 'JetBrains Mono'), color: C.inkSoft, ls: 4, alpha: clamp(bt * 2) });
    }
    // Peri peeks in from the bottom right
    const pk = spring(t - 28.5, 1.8, 0.5);
    P.drawPeri(ctx, Object.assign(P.idle(t, 5), { x: 1590, y: lerp(1400, 1156, clamp(pk, 0, 1.1)), s: 0.43, ext: 190 + 20 * Math.sin(t * 2), mood: 'happy', cheeks: 1, lookX: 0.1, lookY: -0.4, scope: -6 + Math.sin(t * 1.5) * 6 }));
  }

  function endCard(ctx, t) {
    const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#f6fafc'); g.addColorStop(1, '#e4eef4'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    const a = t - 30.7;
    const dot = U.wordmark(ctx, 1190, 650, 300, a, { delay: 0.05, color: C.ink });
    const pop = spring(a - 0.5, 2, 0.4);
    U.ball(ctx, dot.x, dot.y, 33 * clamp(pop, 0, 1.1));
    const d = drop(t, 30.75, 600, 0.3);
    const o = Object.assign(P.idle(t, 9), { x: 620, y: 700 + d.dy, s: 0.5, ext: track(t, [[30.7, 190], [31.3, 190], [31.6, 40]]), mood: 'happy', cheeks: 1, lookX: 0.6, lookY: 0, sq: d.sq });
    P.drawPeriOnFloor(ctx, o, 700);
    if (t > 31.45) { const p = t - 31.45; U.star(ctx, 1190 + 340, 360, 30 * Math.sin(clamp(p / 0.4) * Math.PI), p * 3, '#34d27a'); }
  }

  // ---------- frame ----------
  let dotCache = null;
  function introDot() {
    if (!dotCache) { const d = U.wordmark(document.createElement('canvas').getContext('2d'), W / 2, 650, 330, 99, { delay: 0 }); dotCache = [d.x, d.y]; }
    return dotCache;
  }
  const montageLabel = t => { let i = 0; for (let k = 1; k < CUT.length - 1; k++) if (t >= CUT[k]) i = k; return S.labels[i]; };

  function renderAt(ctx, t) {
    if (t < 8.0) {
      P.skyBg(ctx, t);
      if (t < 1.8) introContent(ctx, t);
      if (t >= 1.5) {
        const [cx, cy, R] = lensStage(ctx, t, introDot());
        if (t > 2.3) S.reticle(ctx, cx, cy, R, t, montageLabel(t));
      }
      for (const c of CUT.slice(1, 4)) if (t > c - 0.02 && t < c + 0.2) P.flash(ctx, 0.35 * (1 - (t - c) / 0.2));
    } else if (t < 18.4) wide(ctx, t);
    else if (t < 22.5) eyes(ctx, t);
    else if (t < 27.9) friends(ctx, t);
    if (t >= 27.4 && t < 30.4) {
      // slanted slab wipe into the waitlist screen
      const k = ease.io3(seg(t, 27.4, 27.95)), wx = lerp(-300, W + 500, k);
      ctx.save(); ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(wx + 260, 0); ctx.lineTo(wx - 260, H); ctx.lineTo(0, H); ctx.closePath(); ctx.clip();
      waitlist(ctx, t); ctx.restore();
    }
    if (t >= 30.4) {
      // iris closes on the waitlist and reveals the logo lockup behind it
      const k = ease.io3(seg(t, 30.4, 31.0)), r = lerp(1250, 0, k);
      endCard(ctx, t);
      if (r > 1) {
        ctx.save(); P.circle(ctx, W / 2, H / 2, r); ctx.clip(); waitlist(ctx, 30.4); ctx.restore();
        ctx.save(); ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.lineWidth = 10; P.circle(ctx, W / 2, H / 2, r); ctx.stroke(); ctx.restore();
      }
    }
  }

  // ---------- public ----------
  const acc = document.createElement('canvas'); acc.width = W; acc.height = H;
  function renderFrame(ctx, frame, subs = 1) {
    if (subs <= 1) { renderAt(ctx, frame / FPS); return; }
    const k = acc.getContext('2d');
    ctx.clearRect(0, 0, W, H);
    for (let i = 0; i < subs; i++) {
      const t = (frame + ((i + 0.5) / subs - 0.5) * 0.5) / FPS;
      k.setTransform(1, 0, 0, 1, 0, 0); k.globalAlpha = 1; k.globalCompositeOperation = 'source-over'; k.clearRect(0, 0, W, H);
      renderAt(k, Math.max(0, t));
      ctx.globalAlpha = 1 / (i + 1); ctx.drawImage(acc, 0, 0);
    }
    ctx.globalAlpha = 1;
  }
  window.Film = { W, H, FPS, DUR, init() {}, renderFrame, frames: Math.round(DUR * FPS) };
})();
