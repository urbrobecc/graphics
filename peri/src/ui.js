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
    tent(ctx, s) {
      for (let k = 0; k < 6; k++) { ctx.fillStyle = k % 2 ? '#fff' : '#ff6f8d'; ctx.beginPath(); ctx.moveTo(0, -s * 0.42); ctx.lineTo(-s * 0.42 + k * s * 0.14, -s * 0.02); ctx.lineTo(-s * 0.42 + (k + 1) * s * 0.14, -s * 0.02); ctx.fill(); }
      ctx.fillStyle = '#fff'; P.rrect(ctx, -s * 0.34, -s * 0.02, s * 0.68, s * 0.4, s * 0.06); ctx.fill();
      ctx.fillStyle = '#ffc34d'; P.rrect(ctx, -s * 0.12, s * 0.12, s * 0.24, s * 0.26, s * 0.05); ctx.fill();
    },
    mango(ctx, s) {
      ctx.save(); ctx.rotate(-0.5);
      const g = ctx.createLinearGradient(-s * 0.3, -s * 0.3, s * 0.3, s * 0.3); g.addColorStop(0, '#ffe36a'); g.addColorStop(0.6, '#ffae3d'); g.addColorStop(1, '#ff7a4a');
      ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(0, 0, s * 0.3, s * 0.4, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.55)'; ctx.beginPath(); ctx.ellipse(-s * 0.1, -s * 0.16, s * 0.07, s * 0.14, 0.3, 0, TAU); ctx.fill();
      ctx.fillStyle = '#3fbf7f'; ctx.beginPath(); ctx.ellipse(s * 0.12, -s * 0.4, s * 0.2, s * 0.09, -0.6, 0, TAU); ctx.fill();
      ctx.restore();
    },
    note(ctx, s) {
      ctx.fillStyle = '#fff'; ctx.strokeStyle = '#fff'; ctx.lineWidth = s * 0.08; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.ellipse(-s * 0.14, s * 0.26, s * 0.17, s * 0.12, -0.4, 0, TAU); ctx.fill();
      ctx.beginPath(); ctx.moveTo(s * 0.0, s * 0.22); ctx.lineTo(s * 0.0, -s * 0.34); ctx.quadraticCurveTo(s * 0.04, -s * 0.2, s * 0.28, -s * 0.16); ctx.stroke();
    },
  };
  const tile = { tent: ['#ffd6e4', '#ff8fb5'], mango: ['#fff0b8', '#ffc65a'], note: ['#9ee9ff', '#4cc0f5'] };

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
      P.text(ctx, 'saved', o.w / 2 + 28, o.h / 2 + 13, { font: P.font(700, 40), color: '#06361f', align: 'center', alpha: s });
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
    const p = spring(age, 2.4, 0.4), font = o.font || P.font(700, o.size || 40);
    const tw = P.measure(ctx, text, font), w = tw + 56, h = (o.size || 40) + 44;
    ctx.save(); ctx.translate(x, y); ctx.scale(lerp(0.2, 1, p), lerp(0.2, 1, p)); ctx.globalAlpha *= clamp(age / 0.08) * (o.alpha === undefined ? 1 : o.alpha);
    ctx.rotate((o.rot || 0) * Math.PI / 180);
    const bx = -w * (o.tail === undefined ? 0.28 : o.tail), by = -h - 26;
    ctx.shadowColor = 'rgba(30,110,160,0.25)'; ctx.shadowBlur = 30; ctx.shadowOffsetY = 12;
    ctx.fillStyle = o.fill || '#fff';
    P.rrect(ctx, bx, by, w, h, h / 2); ctx.fill();
    ctx.beginPath(); ctx.moveTo(-16, by + h - 4); ctx.lineTo(0, 0); ctx.lineTo(18, by + h - 4); ctx.closePath(); ctx.fill();
    ctx.shadowColor = 'transparent';
    P.text(ctx, text, bx + w / 2, by + h / 2 + (o.size || 40) * 0.34, { font, color: o.color || C.ink, align: 'center' });
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
    // island
    ctx.fillStyle = C.ink; P.rrect(ctx, 150, 22, 100, 30, 15); ctx.fill();
    P.text(ctx, 'tonight', 28, 120, { font: P.font(700, 46), color: C.ink });
    P.text(ctx, 'near you', 28, 156, { font: P.font(500, 24), color: C.inkSoft });
    // hero card with the market scene inside
    ctx.save(); P.rrect(ctx, 24, 190, 352, 330, 34); ctx.clip(); ctx.translate(200, 355);
    P.scenes.market(ctx, t * 0.6, 260); ctx.restore();
    ctx.fillStyle = 'rgba(110,215,255,0.22)'; P.rrect(ctx, 24, 190, 352, 330, 34); ctx.fill();
    const fade = ctx.createLinearGradient(0, 400, 0, 520); fade.addColorStop(0, 'rgba(8,30,60,0)'); fade.addColorStop(1, 'rgba(8,30,60,0.78)');
    ctx.save(); P.rrect(ctx, 24, 190, 352, 330, 34); ctx.clip(); ctx.fillStyle = fade; ctx.fillRect(24, 400, 352, 120); ctx.restore();
    P.text(ctx, 'night market', 48, 480, { font: P.font(700, 36), color: '#fff' });
    P.text(ctx, '7:00pm · pier 4', 48, 508, { font: P.font(500, 22), color: 'rgba(255,255,255,0.9)' });
    // friends
    const cols = ['#ff9ac7', '#7fd5ff', '#ffd777', '#b9a4ff', '#ffa88c'];
    for (let i = 0; i < 5; i++) U.avatar(ctx, 54 + i * 33, 590, 21, cols[i]);
    P.text(ctx, 'you + 5 going', 236, 598, { font: P.font(700, 22), color: C.ink });
    // action
    const pr = o.press || 0, g = ctx.createLinearGradient(0, 650, 0, 722); g.addColorStop(0, '#7cf0a5'); g.addColorStop(1, '#27c874');
    ctx.save(); ctx.translate(200, 686); ctx.scale(1 - 0.05 * pr, 1 - 0.05 * pr); ctx.translate(-200, -686);
    P.rrect(ctx, 24, 650, 352, 72, 36); ctx.fillStyle = g; ctx.fill();
    P.text(ctx, "i'm in", 200, 698, { font: P.font(700, 34), color: '#06361f', align: 'center' }); ctx.restore();
    ctx.restore();
    ctx.restore();
  };
  const lin = (ctx, x0, y0, x1, y1, stops) => { const g = ctx.createLinearGradient(x0, y0, x1, y1); stops.forEach(([o, c]) => g.addColorStop(o, c)); return g; };

  // ---- wordmark ---------------------------------------------------------------------
  // draws "peri" with the i dotted by a mint ball. letters drop in one by one.
  U.wordmark = (ctx, cx, baseY, size, age, o = {}) => {
    const font = P.font(700, size), letters = ['p', 'e', 'r', 'ı'];
    ctx.save(); ctx.font = font; ctx.letterSpacing = (-size * 0.02) + 'px';
    const ws = letters.map(l => ctx.measureText(l).width), total = ws.reduce((a, b) => a + b, 0);
    let x = cx - total / 2, dot = null;
    letters.forEach((l, i) => {
      const k = clamp((age - (o.delay || 0) - i * 0.09) / 0.55), p = P.ease.outBack(k, 2.2);
      ctx.save(); ctx.globalAlpha *= clamp(k * 4) * (o.alpha === undefined ? 1 : o.alpha);
      ctx.translate(x + ws[i] / 2, baseY); ctx.scale(lerp(1.25, 1, p), lerp(0.7, 1, p)); ctx.translate(0, (1 - p) * -size * 0.5);
      ctx.fillStyle = o.color || C.ink; ctx.textAlign = 'center'; ctx.fillText(l, 0, 0); ctx.restore();
      if (i === 3) dot = { x: x + ws[i] / 2, y: baseY - size * 0.70 };
      x += ws[i];
    });
    ctx.restore();
    return dot;
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
