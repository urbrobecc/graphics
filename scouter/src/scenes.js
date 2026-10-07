// The little worlds Peri sees through its periscope. Each one is drawn inside a
// square [-R, R] around the origin and is a pure function of its local time.
(function () {
  const { TAU, clamp, lerp, hash, noise } = P;
  const S = (P.scenes = {});

  const lin = (ctx, x0, y0, x1, y1, stops) => {
    const g = ctx.createLinearGradient(x0, y0, x1, y1);
    stops.forEach(([o, c]) => g.addColorStop(o, c)); return g;
  };
  const glow = (ctx, x, y, r, rgb, a) => {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, `rgba(${rgb},${a})`); g.addColorStop(1, `rgba(${rgb},0)`);
    ctx.fillStyle = g; ctx.fillRect(x - r, y - r, r * 2, r * 2);
  };

  const mono = (w, size) => P.font(w, size, 'JetBrains Mono');
  const grid = (ctx, R, lt, a = 0.12) => {
    ctx.strokeStyle = `rgba(150,170,255,${a})`; ctx.lineWidth = 2;
    for (let k = -6; k <= 6; k++) { ctx.beginPath(); ctx.moveTo(-R, k * 90); ctx.lineTo(R, k * 90); ctx.stroke(); }
    for (let k = -8; k <= 8; k++) { const x = k * 90 - ((lt * 40) % 90); ctx.beginPath(); ctx.moveTo(x, -R); ctx.lineTo(x, R); ctx.stroke(); }
  };

  // 1. crypto market: live candles, a spinning coin
  const PRICE = (() => { const a = [0]; for (let i = 1; i < 700; i++) a.push(a[i - 1] + (hash(i * 1.7) - 0.45) * 26); return a; })();
  const coin = (ctx, x, y, r, ang, alpha = 1) => {
    const sx = Math.cos(ang), ax = Math.max(0.1, Math.abs(sx));
    ctx.save(); ctx.globalAlpha *= alpha; ctx.translate(x, y); ctx.scale(ax, 1);
    const g = ctx.createLinearGradient(-r, -r, r, r); g.addColorStop(0, '#fff0a8'); g.addColorStop(0.5, '#ffc83d'); g.addColorStop(1, '#e8901c');
    ctx.fillStyle = g; P.circle(ctx, 0, 0, r); ctx.fill();
    ctx.lineWidth = r * 0.12; ctx.strokeStyle = '#d98a14'; P.circle(ctx, 0, 0, r * 0.92); ctx.stroke();
    ctx.lineWidth = r * 0.04; ctx.strokeStyle = 'rgba(255,255,255,0.6)'; P.circle(ctx, 0, 0, r * 0.7); ctx.stroke();
    if (ax > 0.3) {
      ctx.fillStyle = '#a8630a'; ctx.font = P.font(700, r * 1.1); ctx.textAlign = 'center'; ctx.fillText('B', 0, r * 0.38);
      ctx.fillRect(-r * 0.12, -r * 0.62, r * 0.07, r * 0.2); ctx.fillRect(r * 0.05, -r * 0.62, r * 0.07, r * 0.2);
      ctx.fillRect(-r * 0.12, r * 0.42, r * 0.07, r * 0.2); ctx.fillRect(r * 0.05, r * 0.42, r * 0.07, r * 0.2);
    }
    ctx.fillStyle = 'rgba(255,255,255,0.55)'; ctx.beginPath(); ctx.ellipse(-r * 0.35, -r * 0.5, r * 0.28, r * 0.12, -0.6, 0, TAU); ctx.fill();
    ctx.restore();
  };
  S.crypto = (ctx, lt, R) => {
    ctx.fillStyle = lin(ctx, 0, -R, 0, R, [[0, '#0b1236'], [1, '#2a1670']]); ctx.fillRect(-R, -R, 2 * R, 2 * R);
    glow(ctx, R * 0.3, -R * 0.3, R, '120,90,255', 0.35);
    grid(ctx, R, lt);
    const sp = 46, scroll = lt * 80, i0 = Math.floor(scroll / sp) + 40, n = Math.ceil(2 * R / sp) + 3;
    let lo = 1e9, hi = -1e9;
    for (let k = 0; k <= n; k++) { lo = Math.min(lo, PRICE[i0 + k] - 12); hi = Math.max(hi, PRICE[i0 + k] + 12); }
    const Y = v => R * 0.62 - (v - lo) / (hi - lo) * R * 1.0;
    const pts = [];
    for (let k = 0; k < n; k++) {
      const x = -R + k * sp - (scroll % sp), o = PRICE[i0 + k], c = PRICE[i0 + k + 1], up = c >= o;
      const wh = Math.max(o, c) + hash(k + i0) * 9, wl = Math.min(o, c) - hash(k + i0 + 9) * 9, col = up ? '#2de58a' : '#ff5b7f';
      ctx.strokeStyle = col; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(x, Y(wh)); ctx.lineTo(x, Y(wl)); ctx.stroke();
      ctx.fillStyle = col; P.rrect(ctx, x - 12, Math.min(Y(o), Y(c)), 24, Math.max(6, Math.abs(Y(o) - Y(c))), 5); ctx.fill();
      pts.push([x, Y((o + c) / 2)]);
    }
    ctx.save(); ctx.strokeStyle = '#7fe6ff'; ctx.lineWidth = 5; ctx.shadowColor = '#7fe6ff'; ctx.shadowBlur = 18; ctx.beginPath();
    pts.forEach(([x, y], k) => (k ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.stroke(); ctx.restore();
    // coins
    for (let i = 0; i < 6; i++) {
      const x = (hash(i + 4) * 2 - 1) * R * 0.85, y = R * 0.9 - ((lt * (50 + hash(i) * 40) + hash(i + 8) * 800) % (R * 2));
      coin(ctx, x, y, 22 + hash(i + 2) * 10, lt * 3 + i, 0.8);
    }
    coin(ctx, R * 0.28, -R * 0.32 + Math.sin(lt * 2) * 10, R * 0.2, lt * 2.4);
    const chip = (x, y, a, b, col) => {
      ctx.fillStyle = 'rgba(8,10,40,0.75)'; P.rrect(ctx, x, y, 330, 56, 28); ctx.fill();
      P.text(ctx, a, x + 24, y + 37, { font: mono(700, 26), color: '#fff' }); P.text(ctx, b, x + 306, y + 37, { font: mono(700, 26), color: col, align: 'right' });
    };
    chip(-R * 0.74, -R * 0.52, 'BTC', '+2.4%', '#2de58a'); chip(-R * 0.66, -R * 0.52 + 70, 'NEW CHAIN', 'LIVE', '#ffd166');
  };

  // 2. podcast: mic, rings, a transcript with the ticker highlighted
  S.podcast = (ctx, lt, R) => {
    ctx.fillStyle = lin(ctx, 0, -R, 0, R, [[0, '#2c1766'], [0.55, '#c34b8f'], [1, '#ffb48a']]); ctx.fillRect(-R, -R, 2 * R, 2 * R);
    glow(ctx, 0, -R * 0.05, R * 0.85, '255,210,235', 0.55);
    for (let i = 0; i < 4; i++) {
      const a = (lt * 0.6 + i / 4) % 1;
      ctx.strokeStyle = `rgba(255,255,255,${(1 - a) * 0.55})`; ctx.lineWidth = 7 * (1 - a) + 1; P.circle(ctx, 0, -R * 0.05, R * 0.2 + a * R * 0.75); ctx.stroke();
    }
    ctx.save(); ctx.translate(0, -R * 0.02 + Math.sin(lt * 2) * 7);
    ctx.strokeStyle = '#f2f4ff'; ctx.lineWidth = 16; ctx.lineCap = 'round'; ctx.beginPath(); ctx.arc(0, 0, 118, 0.12, Math.PI - 0.12); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, 118); ctx.lineTo(0, 188); ctx.stroke();
    ctx.fillStyle = '#f2f4ff'; P.rrect(ctx, -78, 184, 156, 24, 12); ctx.fill();
    const mg = ctx.createLinearGradient(-70, 0, 70, 0); mg.addColorStop(0, '#9aa3d4'); mg.addColorStop(0.35, '#ffffff'); mg.addColorStop(1, '#a3abd9');
    ctx.fillStyle = mg; P.rrect(ctx, -70, -190, 140, 250, 70); ctx.fill();
    ctx.strokeStyle = 'rgba(60,70,140,0.35)'; ctx.lineWidth = 4;
    for (let k = -4; k <= 4; k++) { ctx.beginPath(); ctx.moveTo(k * 14, -170); ctx.lineTo(k * 14, 40); ctx.stroke(); }
    for (let k = 0; k < 6; k++) { ctx.beginPath(); ctx.moveTo(-66, -150 + k * 36); ctx.lineTo(66, -150 + k * 36); ctx.stroke(); }
    ctx.restore();
    // waveform
    for (let i = -11; i <= 11; i++) {
      const h = 24 + Math.abs(noise(lt * 3.2 + i * 0.4, 3)) * 130 * (1 - Math.abs(i) / 16);
      const g = ctx.createLinearGradient(0, R * 0.62 - h, 0, R * 0.62 + h); g.addColorStop(0, 'rgba(255,255,255,0.95)'); g.addColorStop(1, 'rgba(255,170,210,0.7)');
      ctx.fillStyle = g; P.rrect(ctx, i * 26 - 8, R * 0.62 - h, 16, h * 2, 8); ctx.fill();
    }
    // transcript card
    const ca = P.ease.out3(clamp(lt / 0.6)), cy = -R * 0.74 + (1 - ca) * -40;
    ctx.save(); ctx.globalAlpha *= ca;
    ctx.shadowColor = 'rgba(40,10,80,0.35)'; ctx.shadowBlur = 30; ctx.shadowOffsetY = 12;
    ctx.fillStyle = 'rgba(255,255,255,0.92)'; P.rrect(ctx, -300, cy, 470, 120, 30); ctx.fill(); ctx.shadowColor = 'transparent';
    P.text(ctx, 'ep 214 · transcript', -272, cy + 36, { font: mono(700, 20), color: '#8a5aa8', ls: 1 });
    const f34 = P.font(700, 34), pre = P.measure(ctx, 'honestly ', f34), mw = P.measure(ctx, 'MRVL', f34);
    ctx.fillStyle = '#ffe27a'; P.rrect(ctx, -272 + pre - 8, cy + 56, mw + 16, 46, 10); ctx.fill();
    P.text(ctx, 'honestly MRVL keeps', -272, cy + 90, { font: f34, color: '#2c1766' });
    ctx.restore();
    // mention counter
    const n = Math.min(6, Math.floor(lt * 2.2)), pop = 1 + 0.12 * Math.exp(-((lt * 2.2) % 1) * 7) * (n < 6 ? 1 : 0);
    ctx.save(); ctx.translate(R * 0.46, R * 0.12); ctx.scale(pop, pop);
    ctx.fillStyle = '#fff'; P.circle(ctx, 0, 0, 74); ctx.fill();
    P.text(ctx, String(n), 0, 22, { font: P.font(700, 78), color: '#c34b8f', align: 'center' });
    P.text(ctx, 'mentions', 0, 108, { font: mono(700, 22), color: '#fff', align: 'center', ls: 1 }); ctx.restore();
  };

  // 3. stock market: ticker tape and a live chart
  const TICK = ['NVDA', 'MRVL', 'AMD', 'AAPL', 'TSLA', 'META', 'MSFT', 'AVGO'];
  S.stocks = (ctx, lt, R) => {
    ctx.fillStyle = lin(ctx, 0, -R, 0, R, [[0, '#04121c'], [1, '#0b2c3c']]); ctx.fillRect(-R, -R, 2 * R, 2 * R);
    grid(ctx, R, lt, 0.07);
    const pulse = 0.55 + 0.45 * Math.sin(lt * 5);
    ctx.fillStyle = `rgba(56,242,160,${pulse})`; P.circle(ctx, -R * 0.42, -R * 0.78, 10); ctx.fill();
    P.text(ctx, 'MARKET OPEN', -R * 0.42 + 24, -R * 0.78 + 9, { font: mono(700, 26), color: '#c8fff0', ls: 3 });
    for (let row = 0; row < 4; row++) {
      const dir = row % 2 ? 1 : -1, off = (lt * 70 * dir) % 330, y = -R * 0.58 + row * 62;
      for (let k = -6; k < 8; k++) {
        const idx = (k + row * 3 + 80) % TICK.length, sym = TICK[idx], h = hash(idx + row * 5 + Math.floor(lt * 0.8 + k) * 0.13);
        const up = sym === 'MRVL' ? true : h > 0.42, pc = sym === 'MRVL' ? 4.3 : (1 + h * 4).toFixed(1), x = k * 330 + off;
        if (sym === 'MRVL') { ctx.fillStyle = 'rgba(255,226,122,0.18)'; P.rrect(ctx, x - 12, y - 34, 300, 50, 12); ctx.fill(); }
        P.text(ctx, sym, x, y, { font: mono(700, 30), color: '#e8f6ff' });
        P.text(ctx, (up ? '+' : '-') + pc + '%', x + 120, y, { font: mono(700, 30), color: up ? '#38f2a0' : '#ff6b8b' });
      }
    }
    // chart
    const N = 70, sc = 14, base = R * 0.62, pts = [];
    for (let k = 0; k <= N; k++) {
      const u = k / N, v = noise(k * 0.35 + lt * 1.2, 7) * 52 + noise(k * 0.9 + lt * 1.2, 8) * 20 + u * -190;
      pts.push([-R + u * 2 * R, base + v - 40]);
    }
    ctx.beginPath(); pts.forEach(([x, y], k) => (k ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.lineTo(R, R); ctx.lineTo(-R, R); ctx.closePath();
    ctx.fillStyle = lin(ctx, 0, base - 260, 0, R, [[0, 'rgba(56,242,160,0.55)'], [1, 'rgba(56,242,160,0)']]); ctx.fill();
    ctx.save(); ctx.strokeStyle = '#38f2a0'; ctx.lineWidth = 8; ctx.lineJoin = 'round'; ctx.shadowColor = '#38f2a0'; ctx.shadowBlur = 24;
    ctx.beginPath(); pts.forEach(([x, y], k) => (k ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.stroke(); ctx.restore();
    const [ex, ey] = pts[pts.length - 1];
    glow(ctx, ex - 60, ey, 90, '56,242,160', 0.5 + 0.3 * Math.sin(lt * 6));
    ctx.fillStyle = '#fff'; P.circle(ctx, ex - 60, pts[pts.length - 8][1], 11); ctx.fill();
  };

  S.list = ['crypto', 'podcast', 'stocks'];
  S.labels = ['crypto  live', 'podcasts  today', 'stocks  open'];

  // glass lens: clips an inside painter, then adds vignette, tint, highlights and rim
  S.lens = function (ctx, cx, cy, R, t, inside, o = {}) {
    ctx.save();
    ctx.shadowColor = 'rgba(20,110,170,0.35)'; ctx.shadowBlur = 90; ctx.shadowOffsetY = 30;
    P.circle(ctx, cx, cy, R + 8); ctx.fillStyle = 'rgba(255,255,255,0.65)'; ctx.fill();
    ctx.restore();
    ctx.save();
    P.circle(ctx, cx, cy, R); ctx.clip();
    ctx.translate(cx, cy);
    inside(ctx, R);
    // cyan grade
    ctx.fillStyle = `rgba(110,215,255,${o.tint === undefined ? 0.34 : o.tint})`; ctx.fillRect(-R, -R, 2 * R, 2 * R);
    const v = ctx.createRadialGradient(0, 0, R * 0.55, 0, 0, R);
    v.addColorStop(0, 'rgba(10,70,120,0)'); v.addColorStop(1, 'rgba(10,70,120,0.55)');
    ctx.fillStyle = v; ctx.fillRect(-R, -R, 2 * R, 2 * R);
    // glass sheen
    const sh = ctx.createLinearGradient(-R, -R, R * 0.2, R * 0.4);
    sh.addColorStop(0, 'rgba(255,255,255,0.5)'); sh.addColorStop(0.5, 'rgba(255,255,255,0.08)'); sh.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = sh; ctx.beginPath(); ctx.ellipse(-R * 0.18, -R * 0.42, R * 0.62, R * 0.4, -0.55, 0, TAU); ctx.fill();
    ctx.restore();
    ctx.save(); ctx.translate(cx, cy);
    ctx.lineWidth = Math.max(4, R * 0.022); ctx.strokeStyle = 'rgba(255,255,255,0.92)';
    ctx.beginPath(); ctx.arc(0, 0, R, 0, TAU); ctx.stroke();
    ctx.lineWidth = Math.max(3, R * 0.018); ctx.lineCap = 'round'; ctx.strokeStyle = 'rgba(255,255,255,0.8)';
    ctx.beginPath(); ctx.arc(0, 0, R * 0.9, Math.PI * 1.12, Math.PI * 1.42); ctx.stroke();
    ctx.beginPath(); ctx.arc(0, 0, R * 0.9, Math.PI * 0.05, Math.PI * 0.14); ctx.stroke();
    ctx.restore();
  };

  // reticle brackets + readouts, drawn over a lens
  S.reticle = function (ctx, cx, cy, R, t, label, o = {}) {
    ctx.save(); ctx.translate(cx, cy);
    ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.lineWidth = 5; ctx.lineCap = 'round';
    const b = R * 0.74, l = R * 0.14;
    for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      ctx.beginPath(); ctx.moveTo(sx * b, sy * (b - l)); ctx.lineTo(sx * b, sy * b); ctx.lineTo(sx * (b - l), sy * b); ctx.stroke();
    }
    ctx.lineWidth = 3; ctx.globalAlpha = 0.6;
    ctx.beginPath(); ctx.moveTo(-20, 0); ctx.lineTo(20, 0); ctx.moveTo(0, -20); ctx.lineTo(0, 20); ctx.stroke();
    ctx.globalAlpha = 1;
    const chip = (x, y, text, align, dot) => {
      const font = P.font(700, 27, 'JetBrains Mono'), w = P.measure(ctx, text, font, 2) + 44 + (dot ? 30 : 0);
      const x0 = align === 'left' ? x : x - w;
      ctx.fillStyle = 'rgba(8,40,70,0.55)'; P.rrect(ctx, x0, y - 24, w, 48, 24); ctx.fill();
      if (dot && Math.floor(t * 2) % 2 === 0) { ctx.fillStyle = '#ff5b7f'; P.circle(ctx, x0 + 26, y, 8); ctx.fill(); }
      P.text(ctx, text, x0 + 22 + (dot ? 26 : 0), y + 9, { font, color: '#fff', ls: 2 });
    };
    chip(-b * 0.9, R * 0.78, label, 'left', false);
    chip(b * 0.9, -R * 0.78, 'REC', 'right', true);
    ctx.restore();
  };
})();
