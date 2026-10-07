// Interface pieces that float around the character: cards, buttons, bubbles, a phone.
(function () {
  const { TAU, clamp, lerp, hash, spring, C } = P;
  const U = (P.ui = {});

  U.star = (ctx, x, y, r, rot = 0, fill = '#fff') => {
    ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.fillStyle = fill; ctx.beginPath();
    for (let i = 0; i < 8; i++) { const rr = i % 2 ? r * 0.24 : r; const a = i * Math.PI / 4; ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); }
    ctx.closePath(); ctx.fill(); ctx.restore();
  };

  // confetti + sparkles from a point; age in seconds
  U.burst = (ctx, x, y, age, o = {}) => {
    if (age < 0 || age > 1.6) return;
    const n = o.n || 22, cols = o.colors || ['#5fd98a', '#ffc34d', '#ff7eb6', '#5fd0fb', '#ffffff'], sp = o.speed || 520;
    for (let i = 0; i < n; i++) {
      const a = hash(i + (o.seed || 0)) * TAU, v = sp * (0.35 + hash(i + 30) * 0.65), dr = 1 - Math.exp(-age * 3.2);
      const px = x + Math.cos(a) * v * dr * 0.5, py = y + Math.sin(a) * v * dr * 0.5 + 520 * age * age * 0.5 * (o.gravity === undefined ? 1 : o.gravity);
      const alpha = 1 - clamp((age - 0.6) / 1.0), c = cols[i % cols.length], sz = (o.size || 14) * (0.6 + hash(i + 60) * 0.8);
      ctx.save(); ctx.globalAlpha = alpha;
      if (i % 3 === 0) U.star(ctx, px, py, sz * 1.1, age * 4 + i, c);
      else if (i % 3 === 1) { ctx.fillStyle = c; P.circle(ctx, px, py, sz * 0.5); ctx.fill(); }
      else { ctx.translate(px, py); ctx.rotate(age * 7 + i); ctx.fillStyle = c; P.rrect(ctx, -sz / 2, -sz * 0.25, sz, sz * 0.5, 3); ctx.fill(); }
      ctx.restore();
    }
  };

  // tiny round avatar with a face, used in the phone and on pins
  U.avatar = (ctx, x, y, r, color, o = {}) => {
    ctx.save(); ctx.translate(x, y);
    ctx.fillStyle = '#fff'; P.circle(ctx, 0, 0, r + 4); ctx.fill();
    const g = ctx.createRadialGradient(-r * 0.3, -r * 0.4, r * 0.1, 0, 0, r); g.addColorStop(0, '#fff'); g.addColorStop(0.25, color); g.addColorStop(1, color);
    ctx.fillStyle = color; P.circle(ctx, 0, 0, r); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.beginPath(); ctx.ellipse(-r * 0.25, -r * 0.45, r * 0.45, r * 0.22, -0.4, 0, TAU); ctx.fill();
    ctx.fillStyle = '#09090c';
    ctx.beginPath(); ctx.ellipse(-r * 0.3, r * 0.05, r * 0.11, r * 0.17, 0, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.ellipse(r * 0.3, r * 0.05, r * 0.11, r * 0.17, 0, 0, TAU); ctx.fill();
    ctx.strokeStyle = '#09090c'; ctx.lineWidth = Math.max(2, r * 0.08); ctx.lineCap = 'round';
    ctx.beginPath(); ctx.arc(0, r * 0.22, r * 0.2, 0.2, Math.PI - 0.2); ctx.stroke();
    ctx.restore();
  };

  // ---- cards -------------------------------------------------------------
  const glyphs = {
    candles(ctx, s) {                       // three candles
      const c = [['#2de58a', -0.26, 0.1, 0.34, 0.5], ['#ff5b7f', 0.0, -0.18, 0.4, 0.36], ['#2de58a', 0.26, -0.3, 0.2, 0.46]];
      ctx.lineCap = 'round';
      for (const [col, x, y, h, wick] of c) {
        ctx.strokeStyle = col; ctx.lineWidth = s * 0.05; ctx.beginPath(); ctx.moveTo(x * s, (y - 0.14) * s); ctx.lineTo(x * s, (y + h + 0.1) * s); ctx.stroke();
        ctx.fillStyle = col; P.rrect(ctx, x * s - s * 0.08, y * s, s * 0.16, h * s, s * 0.04); ctx.fill();
      }
    },
    mic(ctx, s) {
      ctx.fillStyle = '#fff'; P.rrect(ctx, -s * 0.12, -s * 0.38, s * 0.24, s * 0.4, s * 0.12); ctx.fill();
      ctx.strokeStyle = '#fff'; ctx.lineWidth = s * 0.06; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.arc(0, -s * 0.06, s * 0.22, 0.1, Math.PI - 0.1); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, s * 0.16); ctx.lineTo(0, s * 0.34); ctx.moveTo(-s * 0.12, s * 0.34); ctx.lineTo(s * 0.12, s * 0.34); ctx.stroke();
    },
    trend(ctx, s) {
      ctx.strokeStyle = '#fff'; ctx.lineWidth = s * 0.07; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      ctx.beginPath(); ctx.moveTo(-s * 0.34, s * 0.22); ctx.lineTo(-s * 0.1, -s * 0.02); ctx.lineTo(s * 0.06, s * 0.1); ctx.lineTo(s * 0.32, -s * 0.24); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(s * 0.12, -s * 0.26); ctx.lineTo(s * 0.34, -s * 0.26); ctx.lineTo(s * 0.34, -s * 0.04); ctx.stroke();
    },
  };
  const tile = { candles: ['#ffe9a8', '#ffb02e'], mic: ['#d9c9ff', '#8c6cf0'], trend: ['#9af0be', '#25b870'] };

  // o: x,y (top left), w,h, age (s since appearing), kind, title, sub, pill {text,color}, rot
  U.card = (ctx, o) => {
    if (o.age < 0) return;
    const p = spring(o.age, 2.0, 0.42), a = clamp(o.age / 0.12);
    ctx.save();
    ctx.globalAlpha *= a * (o.alpha === undefined ? 1 : o.alpha);
    ctx.translate(o.x + o.w / 2, o.y + o.h / 2 + (1 - p) * 60); ctx.rotate((o.rot || 0) * Math.PI / 180 * p); ctx.scale(lerp(0.6, 1, p), lerp(0.6, 1, p));
    ctx.translate(-o.w / 2, -o.h / 2);
    P.glass(ctx, 0, 0, o.w, o.h, 38);
    const ts = o.h - 44;
    const g = ctx.createLinearGradient(0, 22, 0, 22 + ts); g.addColorStop(0, tile[o.kind][0]); g.addColorStop(1, tile[o.kind][1]);
    ctx.fillStyle = g; P.rrect(ctx, 22, 22, ts, ts, 28); ctx.fill();
    ctx.save(); ctx.translate(22 + ts / 2, 22 + ts / 2); glyphs[o.kind](ctx, ts); ctx.restore();
    P.text(ctx, o.title, 22 + ts + 28, o.h / 2 - 8, { font: P.font(700, 46), color: C.ink });
    P.text(ctx, o.sub, 22 + ts + 28, o.h / 2 + 40, { font: P.font(500, 29), color: C.inkSoft });
    if (o.pill) {
      const pw = P.measure(ctx, o.pill.text, P.font(700, 26)) + 44;
      ctx.fillStyle = o.pill.color; P.rrect(ctx, o.w - pw - 24, 26, pw, 48, 24); ctx.fill();
      P.text(ctx, o.pill.text, o.w - pw / 2 - 24, 59, { font: P.font(700, 26), color: o.pill.ink || '#fff', align: 'center' });
    }
    ctx.restore();
  };

  // ---- save button, tap ripple, cursor -------------------------------------------
  // saved: 0..1 morph from "save all 3" to "saved" ; press: 0..1 squish
  U.button = (ctx, o) => {
    const p = spring(o.age, 2.2, 0.45); if (o.age < 0) return;
    ctx.save(); ctx.translate(o.x + o.w / 2, o.y + o.h / 2); const sc = lerp(0.5, 1, p) * (1 - 0.06 * (o.press || 0)); ctx.scale(sc, sc); ctx.globalAlpha *= clamp(o.age / 0.1) * (o.alpha === undefined ? 1 : o.alpha);
    ctx.translate(-o.w / 2, -o.h / 2);
    ctx.shadowColor = 'rgba(40,190,110,0.5)'; ctx.shadowBlur = 40; ctx.shadowOffsetY = 14;
    const g = ctx.createLinearGradient(0, 0, 0, o.h); g.addColorStop(0, '#7cf0a5'); g.addColorStop(1, '#27c874');
    P.rrect(ctx, 0, 0, o.w, o.h, o.h / 2); ctx.fillStyle = g; ctx.fill(); ctx.shadowColor = 'transparent';
    ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.lineWidth = 3; ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.28)'; P.rrect(ctx, 14, 8, o.w - 28, o.h * 0.38, o.h * 0.2); ctx.fill();
    const s = o.saved || 0;
    P.text(ctx, o.label, o.w / 2, o.h / 2 + 13, { font: P.font(700, 40), color: '#06361f', align: 'center', alpha: 1 - s });
    if (s > 0) {
      ctx.save(); ctx.globalAlpha *= s; ctx.translate(o.w / 2 - 78, o.h / 2); ctx.strokeStyle = '#06361f'; ctx.lineWidth = 9; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      ctx.beginPath(); ctx.moveTo(-18, 2); ctx.lineTo(-5, 15); ctx.lineTo(19, -14); ctx.setLineDash([80, 80]); ctx.lineDashOffset = -80 * (1 - clamp(s * 1.4)); ctx.stroke(); ctx.restore();
      P.text(ctx, o.doneLabel || 'saved', o.w / 2 + 28, o.h / 2 + 13, { font: P.font(700, 40), color: '#06361f', align: 'center', alpha: s });
    }
    ctx.restore();
  };

  U.cursor = (ctx, x, y, press = 0, age = 9) => {
    if (age >= 0 && age < 0.7) {                       // ripple
      const k = age / 0.7; ctx.save(); ctx.strokeStyle = `rgba(255,255,255,${0.9 * (1 - k)})`; ctx.lineWidth = 8 * (1 - k) + 2;
      P.circle(ctx, x, y, 20 + k * 100); ctx.stroke(); ctx.restore();
    }
    ctx.save(); ctx.translate(x, y); ctx.scale(1 - 0.12 * press, 1 - 0.12 * press);
    ctx.shadowColor = 'rgba(10,60,100,0.4)'; ctx.shadowBlur = 20; ctx.shadowOffsetY = 10;
    ctx.fillStyle = '#fff'; ctx.strokeStyle = '#0d2f45'; ctx.lineWidth = 4; ctx.lineJoin = 'round';
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, 62); ctx.lineTo(16, 48); ctx.lineTo(28, 74); ctx.lineTo(42, 67); ctx.lineTo(30, 42); ctx.lineTo(52, 40); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.restore();
  };

  // ---- speech bubble --------------------------------------------------------
  // (x, y) is the tip of the tail
  U.bubble = (ctx, x, y, text, age, o = {}) => {
    if (age < 0) return;
    const p = spring(age, 2.4, 0.4), size = o.size || 40, font = o.font || P.font(700, size);
    const lines = text.split('\n'), lh = size * 1.2;
    const tw = Math.max(...lines.map(l => P.measure(ctx, l, font))), w = tw + 56, h = lines.length * lh + 30 + (lines.length > 1 ? 4 : 14);
    ctx.save(); ctx.translate(x, y); ctx.scale(lerp(0.2, 1, p), lerp(0.2, 1, p)); ctx.globalAlpha *= clamp(age / 0.08) * (o.alpha === undefined ? 1 : o.alpha);
    ctx.rotate((o.rot || 0) * Math.PI / 180);
    const bx = -w * (o.tail === undefined ? 0.28 : o.tail), by = -h - 26, rad = Math.min(h / 2, 46);
    ctx.shadowColor = 'rgba(30,110,160,0.25)'; ctx.shadowBlur = 30; ctx.shadowOffsetY = 12;
    ctx.fillStyle = o.fill || '#fff';
    P.rrect(ctx, bx, by, w, h, rad); ctx.fill();
    ctx.beginPath(); ctx.moveTo(-16, by + h - 4); ctx.lineTo(0, 0); ctx.lineTo(18, by + h - 4); ctx.closePath(); ctx.fill();
    ctx.shadowColor = 'transparent';
    lines.forEach((l, i) => P.text(ctx, l, bx + w / 2, by + 15 + lh * (i + 0.78) + (lines.length > 1 ? 0 : 7), { font, color: o.color || C.ink, align: 'center' }));
    ctx.restore();
  };

  // little "+1" style tags that drift up and fade
  U.tag = (ctx, x, y, text, age, color) => {
    if (age < 0 || age > 1.6) return;
    const k = age / 1.6;
    ctx.save(); ctx.globalAlpha = (1 - k) * clamp(age / 0.1); ctx.translate(x, y - 150 * P.ease.out3(k));
    const w = P.measure(ctx, text, P.font(700, 30)) + 34;
    ctx.fillStyle = color; P.rrect(ctx, -w / 2, -22, w, 44, 22); ctx.fill();
    P.text(ctx, text, 0, 10, { font: P.font(700, 30), color: '#fff', align: 'center' });
    ctx.restore();
  };

  // glossy check badge (the "got it" moment)
  U.badge = (ctx, x, y, size, age, o = {}) => {
    if (age < 0) return;
    const p = spring(age, 1.7, 0.36), s = size * p;
    ctx.save(); ctx.translate(x, y); ctx.rotate((1 - p) * -0.6 + (o.rot || 0));
    glow(ctx, 0, 0, s * 1.5, '110,240,160', 0.55 * clamp(p));
    ctx.shadowColor = 'rgba(30,190,110,0.55)'; ctx.shadowBlur = 80; ctx.shadowOffsetY = 30;
    const g = ctx.createLinearGradient(0, -s / 2, 0, s / 2); g.addColorStop(0, '#9bf7bb'); g.addColorStop(1, '#1fbf6c');
    P.rrect(ctx, -s / 2, -s / 2, s, s, s * 0.3); ctx.fillStyle = g; ctx.fill(); ctx.shadowColor = 'transparent';
    ctx.strokeStyle = 'rgba(255,255,255,0.85)'; ctx.lineWidth = s * 0.02; ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.3)'; ctx.beginPath(); ctx.ellipse(-s * 0.05, -s * 0.33, s * 0.38, s * 0.14, -0.1, 0, TAU); ctx.fill();
    ctx.strokeStyle = '#fff'; ctx.lineWidth = s * 0.12; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.beginPath(); ctx.moveTo(-s * 0.24, s * 0.02); ctx.lineTo(-s * 0.06, s * 0.2); ctx.lineTo(s * 0.26, -s * 0.16);
    ctx.setLineDash([s * 1.2, s * 1.2]); ctx.lineDashOffset = -s * 1.2 * (1 - clamp(age / 0.35)); ctx.stroke();
    ctx.restore();
  };
  function glow(ctx, x, y, r, rgb, a) {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, `rgba(${rgb},${a})`); g.addColorStop(1, `rgba(${rgb},0)`);
    ctx.fillStyle = g; ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }
  U.glow = glow;

  // ---- phone ---------------------------------------------------------------------
  U.phone = (ctx, cx, cy, h, o = {}) => {
    const w = h * 0.49, t = o.t || 0, r = w * 0.15;
    ctx.save(); ctx.translate(cx, cy);
    ctx.shadowColor = 'rgba(20,100,150,0.35)'; ctx.shadowBlur = 80; ctx.shadowOffsetY = 40;
    P.rrect(ctx, -w / 2, -h / 2, w, h, r); ctx.fillStyle = '#fff'; ctx.fill(); ctx.shadowColor = 'transparent';
    ctx.lineWidth = w * 0.035; ctx.strokeStyle = C.ink; ctx.stroke();
    ctx.save(); P.rrect(ctx, -w / 2 + 6, -h / 2 + 6, w - 12, h - 12, r - 6); ctx.clip();
    ctx.fillStyle = lin(ctx, 0, -h / 2, 0, h / 2, [[0, '#e9fbff'], [1, '#ffffff']]); ctx.fillRect(-w, -h, 2 * w, 2 * h);
    const u = w / 400;                          // 400 design px wide
    ctx.translate(-w / 2, -h / 2); ctx.scale(u, u);
    ctx.fillStyle = C.ink; P.rrect(ctx, 150, 22, 100, 30, 15); ctx.fill();
    P.text(ctx, 'today', 28, 122, { font: P.font(700, 50), color: C.ink });
    P.text(ctx, '3 new signals', 28, 160, { font: P.font(500, 24), color: C.inkSoft });
    const rows = [
      ['candles', 'robinhood chain', 'just launched', 'new', '#ff7eb6'],
      ['mic', 'MRVL', '6 podcast mentions', '+6', '#8c6cf0'],
      ['trend', 'X', 'sentiment down today', 'down', '#ff6b8b'],
    ];
    rows.forEach(([kind, title, sub, pill, col], i) => {
      const y = 196 + i * 132 + Math.sin(t * 1.6 + i) * 3;
      ctx.save(); ctx.shadowColor = 'rgba(30,110,160,0.18)'; ctx.shadowBlur = 20; ctx.shadowOffsetY = 8;
      P.rrect(ctx, 24, y, 352, 112, 30); ctx.fillStyle = '#fff'; ctx.fill(); ctx.restore();
      const g = ctx.createLinearGradient(0, y + 14, 0, y + 98); g.addColorStop(0, tile[kind][0]); g.addColorStop(1, tile[kind][1]);
      ctx.fillStyle = g; P.rrect(ctx, 38, y + 14, 84, 84, 24); ctx.fill();
      ctx.save(); ctx.translate(80, y + 56); glyphs[kind](ctx, 84); ctx.restore();
      P.text(ctx, title, 138, y + 62, { font: P.font(700, 26), color: C.ink });
      P.text(ctx, sub, 138, y + 90, { font: P.font(500, 20), color: C.inkSoft });
      const pw = P.measure(ctx, pill, P.font(700, 17)) + 22;
      ctx.fillStyle = col; P.rrect(ctx, 364 - pw, y + 10, pw, 26, 13); ctx.fill();
      P.text(ctx, pill, 364 - pw / 2, y + 29, { font: P.font(700, 17), color: '#fff', align: 'center' });
    });
    const cols = ['#ff9ac7', '#7fd5ff', '#ffd777', '#b9a4ff', '#ffa88c'];
    for (let i = 0; i < 5; i++) U.avatar(ctx, 54 + i * 33, 622, 21, cols[i]);
    P.text(ctx, '+5 scouting', 236, 630, { font: P.font(700, 21), color: C.ink });
    const pr = o.press || 0, g = ctx.createLinearGradient(0, 668, 0, 740); g.addColorStop(0, '#7cf0a5'); g.addColorStop(1, '#27c874');
    ctx.save(); ctx.translate(200, 704); ctx.scale(1 - 0.05 * pr, 1 - 0.05 * pr); ctx.translate(-200, -704);
    P.rrect(ctx, 24, 668, 352, 72, 36); ctx.fillStyle = g; ctx.fill();
    P.text(ctx, 'scout it', 200, 716, { font: P.font(700, 34), color: '#06361f', align: 'center' }); ctx.restore();
    ctx.restore();
    ctx.restore();
  };
  const lin = (ctx, x0, y0, x1, y1, stops) => { const g = ctx.createLinearGradient(x0, y0, x1, y1); stops.forEach(([o, c]) => g.addColorStop(o, c)); return g; };

  // ---- wordmark ---------------------------------------------------------------------
  // draws the wordmark letter by letter. one letter slot (o.ball) is left empty for the mint ball,
  // and its centre and radius are returned so the caller can drop the ball in.
  U.wordmark = (ctx, cx, baseY, size, age, o = {}) => {
    const text = o.text || 'scouter', ball = o.ball === undefined ? 2 : o.ball, st = o.stagger || 0.06;
    const font = P.font(700, size), letters = text.split('');
    ctx.save(); ctx.font = font; ctx.letterSpacing = (-size * 0.02) + 'px';
    const ws = letters.map(l => ctx.measureText(l).width), total = ws.reduce((a, b) => a + b, 0);
    let x = cx - total / 2, slot = null;
    letters.forEach((l, i) => {
      if (i === ball) { slot = { x: x + ws[i] / 2, y: baseY - size * 0.262, r: size * 0.262 }; x += ws[i]; return; }
      const k = clamp((age - (o.delay || 0) - i * st) / 0.55), p = P.ease.outBack(k, 2.2);
      ctx.save(); ctx.globalAlpha *= clamp(k * 4) * (o.alpha === undefined ? 1 : o.alpha);
      ctx.translate(x + ws[i] / 2, baseY); ctx.scale(lerp(1.25, 1, p), lerp(0.7, 1, p)); ctx.translate(0, (1 - p) * -size * 0.5);
      ctx.fillStyle = o.color || C.ink; ctx.textAlign = 'center'; ctx.fillText(l, 0, 0); ctx.restore();
      x += ws[i];
    });
    ctx.restore();
    return slot;
  };

  // glossy mint ball (the dot)
  U.ball = (ctx, x, y, r, sx = 1, sy = 1) => {
    ctx.save(); ctx.translate(x, y); ctx.scale(sx, sy);
    ctx.shadowColor = 'rgba(60,200,120,0.4)'; ctx.shadowBlur = r * 0.8; ctx.shadowOffsetY = r * 0.25;
    const g = ctx.createRadialGradient(-r * 0.3, -r * 0.35, r * 0.1, 0, 0, r); g.addColorStop(0, '#f2fff4'); g.addColorStop(0.45, '#b9f3c2'); g.addColorStop(1, '#6fdc92');
    ctx.fillStyle = g; P.circle(ctx, 0, 0, r); ctx.fill(); ctx.shadowColor = 'transparent';
    ctx.fillStyle = 'rgba(255,255,255,0.85)'; ctx.beginPath(); ctx.ellipse(-r * 0.32, -r * 0.42, r * 0.28, r * 0.15, -0.6, 0, TAU); ctx.fill();
    ctx.restore();
  };
})();
