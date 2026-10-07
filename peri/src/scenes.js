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
  const hills = (ctx, R, y0, amp, off, color, f = 0.004, seed = 0) => {
    ctx.beginPath(); ctx.moveTo(-R, R);
    for (let x = -R; x <= R + 20; x += 20) ctx.lineTo(x, y0 + noise((x + off) * f, seed) * amp + Math.sin((x + off) * f * 2.3) * amp * 0.4);
    ctx.lineTo(R, R); ctx.closePath(); ctx.fillStyle = color; ctx.fill();
  };

  // 1. sunrise over hills
  S.sunrise = (ctx, lt, R) => {
    ctx.fillStyle = lin(ctx, 0, -R, 0, R, [[0, '#ff8fb4'], [0.5, '#ffd0a0'], [1, '#fff1cf']]); ctx.fillRect(-R, -R, 2 * R, 2 * R);
    const sy = R * 0.12 - lt * 46;
    glow(ctx, 0, sy, R * 1.1, '255,236,170', 0.8);
    ctx.fillStyle = '#fff6d8'; P.circle(ctx, 0, sy, R * 0.2); ctx.fill();
    for (let i = 0; i < 4; i++) {          // soft clouds
      const x = ((i * 420 + lt * 30 * (1 + i * 0.3)) % (2 * R + 300)) - R - 150, y = -R * 0.45 + i * 70;
      ctx.fillStyle = 'rgba(255,255,255,0.55)';
      for (let k = 0; k < 4; k++) { ctx.beginPath(); ctx.ellipse(x + k * 46, y + (k % 2) * 10, 70, 28, 0, 0, TAU); ctx.fill(); }
    }
    hills(ctx, R, R * 0.28, 50, lt * 12, '#f59ab0', 0.003, 1);
    hills(ctx, R, R * 0.42, 60, lt * 30, '#cc78b4', 0.004, 2);
    hills(ctx, R, R * 0.6, 70, lt * 62, '#7c64b6', 0.005, 3);
    ctx.strokeStyle = '#4a3a86'; ctx.lineWidth = 5; ctx.lineCap = 'round';   // birds
    for (let i = 0; i < 5; i++) {
      const x = -R + ((lt * 130 + i * 190) % (2 * R + 200)), y = -R * 0.2 + Math.sin(lt * 3 + i) * 18 - i * 26, f = Math.sin(lt * 9 + i) * 8;
      ctx.beginPath(); ctx.moveTo(x - 18, y + f); ctx.quadraticCurveTo(x - 8, y - 8, x, y); ctx.quadraticCurveTo(x + 8, y - 8, x + 18, y + f); ctx.stroke();
    }
  };

  // 2. rain on a window, city bokeh
  S.rain = (ctx, lt, R) => {
    ctx.fillStyle = lin(ctx, 0, -R, 0, R, [[0, '#16415c'], [1, '#0a2233']]); ctx.fillRect(-R, -R, 2 * R, 2 * R);
    const cols = ['255,210,120', '255,126,182', '127,230,255', '190,170,255'];
    for (let i = 0; i < 26; i++) {
      const x = (hash(i) * 2 - 1) * R * 1.1 + Math.sin(lt * 0.8 + i) * 16, y = (hash(i + 50) * 1.1 - 0.35) * R + Math.cos(lt * 0.6 + i) * 12;
      glow(ctx, x, y, 40 + hash(i + 9) * 70, cols[i % 4], 0.5 + 0.25 * Math.sin(lt * 2 + i));
    }
    // umbrella walking by
    const ux = -R + ((lt * 170) % (2 * R + 500)) - 100;
    ctx.fillStyle = 'rgba(8,24,36,0.9)';
    ctx.beginPath(); ctx.arc(ux, R * 0.45, 130, Math.PI, 0); ctx.closePath(); ctx.fill();
    ctx.fillRect(ux - 4, R * 0.45, 8, 120); ctx.fillRect(ux - 38, R * 0.45 + 120, 76, R);
    // streaks and drops
    ctx.lineCap = 'round';
    for (let i = 0; i < 70; i++) {
      const sp = 500 + hash(i + 3) * 500, x = (hash(i) * 2.2 - 1.1) * R, y = (((hash(i + 20) * 2 * R + lt * sp) % (2 * R + 200)) - R - 100);
      ctx.strokeStyle = `rgba(190,235,255,${0.25 + hash(i + 7) * 0.4})`; ctx.lineWidth = 2 + hash(i + 11) * 2;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - 12, y + 60 + hash(i) * 50); ctx.stroke();
    }
    for (let i = 0; i < 14; i++) {      // drops stuck to the glass
      const x = (hash(i + 70) * 2 - 1) * R, y = (hash(i + 90) * 2 - 1) * R + ((lt * 18 * hash(i)) % 80), r = 10 + hash(i + 31) * 16;
      ctx.fillStyle = 'rgba(210,240,255,0.18)'; ctx.beginPath(); ctx.ellipse(x, y, r, r * 1.35, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.8)'; ctx.beginPath(); ctx.arc(x - r * 0.3, y - r * 0.5, r * 0.22, 0, TAU); ctx.fill();
    }
  };

  // 3. harbor at sunset, lighthouse sweeping
  S.harbor = (ctx, lt, R) => {
    ctx.fillStyle = lin(ctx, 0, -R, 0, R * 0.1, [[0, '#7a6ad6'], [0.55, '#ff93a8'], [1, '#ffd49a']]); ctx.fillRect(-R, -R, 2 * R, R * 1.1);
    glow(ctx, -R * 0.3, R * 0.05, R * 0.9, '255,230,170', 0.7);
    ctx.fillStyle = '#ffe9b8'; P.circle(ctx, -R * 0.3, R * 0.02, R * 0.12); ctx.fill();
    const sea = lin(ctx, 0, R * 0.1, 0, R, [[0, '#ff9ea6'], [0.25, '#7b7fd0'], [1, '#2f3f94']]);
    ctx.fillStyle = sea; ctx.fillRect(-R, R * 0.1, 2 * R, R);
    for (let i = 0; i < 40; i++) {       // shimmering sun path
      const y = R * 0.12 + i * 22 + (i % 3) * 3, w = 40 + i * 5 * hash(i) + 30, x = -R * 0.3 + Math.sin(lt * 2 + i * 1.7) * (14 + i * 1.5);
      ctx.fillStyle = `rgba(255,240,200,${0.65 - i * 0.012})`; ctx.fillRect(x - w / 2, y, w, 4);
    }
    // lighthouse
    const lx = R * 0.55, ly = -R * 0.05;
    ctx.save(); ctx.translate(lx, ly); ctx.rotate(Math.sin(lt * 1.3) * 0.5);
    const bg = ctx.createLinearGradient(0, 0, -R, 0); bg.addColorStop(0, 'rgba(255,250,210,0.75)'); bg.addColorStop(1, 'rgba(255,250,210,0)');
    ctx.fillStyle = bg; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-R * 1.1, -90); ctx.lineTo(-R * 1.1, 90); ctx.fill(); ctx.restore();
    ctx.fillStyle = '#fff3f0'; ctx.beginPath(); ctx.moveTo(lx - 34, R * 0.42); ctx.lineTo(lx - 20, ly + 30); ctx.lineTo(lx + 20, ly + 30); ctx.lineTo(lx + 34, R * 0.42); ctx.fill();
    ctx.fillStyle = '#ff6f8d'; for (let i = 0; i < 3; i++) ctx.fillRect(lx - 30 + i * 3, ly + 70 + i * 92, 60 - i * 6, 34);
    ctx.fillStyle = '#4a3a86'; ctx.fillRect(lx - 26, ly + 6, 52, 28); ctx.fillStyle = '#ffe9a0'; ctx.fillRect(lx - 16, ly + 12, 32, 16);
    // sailboat
    const bx = -R * 0.1 + Math.sin(lt * 0.7) * 50, by = R * 0.34 + Math.sin(lt * 2.1) * 8;
    ctx.save(); ctx.translate(bx, by); ctx.rotate(Math.sin(lt * 2.1) * 0.05);
    ctx.fillStyle = '#fff8f2'; ctx.beginPath(); ctx.moveTo(0, -150); ctx.lineTo(0, -8); ctx.lineTo(80, -8); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#ffd9d0'; ctx.beginPath(); ctx.moveTo(-8, -120); ctx.lineTo(-8, -8); ctx.lineTo(-62, -8); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#3b2f7a'; ctx.beginPath(); ctx.moveTo(-90, 0); ctx.lineTo(100, 0); ctx.lineTo(70, 34); ctx.lineTo(-62, 34); ctx.closePath(); ctx.fill();
    ctx.restore();
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 4; ctx.lineCap = 'round';
    for (let i = 0; i < 3; i++) {
      const x = ((lt * 90 + i * 260) % (2 * R + 200)) - R - 100, y = -R * 0.35 + i * 40 + Math.sin(lt * 4 + i) * 10;
      ctx.beginPath(); ctx.moveTo(x - 16, y + 6); ctx.quadraticCurveTo(x - 6, y - 8, x, y); ctx.quadraticCurveTo(x + 6, y - 8, x + 16, y + 6); ctx.stroke();
    }
  };

  // 4. night market: the one Peri cares about
  S.market = (ctx, lt, R) => {
    ctx.fillStyle = lin(ctx, 0, -R, 0, R, [[0, '#262b72'], [0.5, '#b35a9e'], [0.8, '#ff9a78'], [1, '#2b1d5c']]); ctx.fillRect(-R, -R, 2 * R, 2 * R);
    // stars
    for (let i = 0; i < 30; i++) { ctx.fillStyle = `rgba(255,255,255,${0.35 + 0.4 * Math.sin(lt * 3 + i * 2)})`; ctx.fillRect((hash(i) * 2 - 1) * R, -R + hash(i + 5) * R * 0.5, 3, 3); }
    // string lights
    for (let s = 0; s < 3; s++) {
      const y0 = -R * 0.5 + s * 90, sag = 70 + s * 14;
      ctx.strokeStyle = 'rgba(40,20,70,0.8)'; ctx.lineWidth = 3; ctx.beginPath();
      for (let x = -R; x <= R; x += 20) { const u = (x + R) / (2 * R); const y = y0 + Math.sin(u * Math.PI) * sag + Math.sin(lt * 1.4 + u * 6 + s) * 5; x === -R ? ctx.moveTo(x, y) : ctx.lineTo(x, y); }
      ctx.stroke();
      for (let b = 0; b < 14; b++) {
        const u = (b + 0.5) / 14, x = -R + u * 2 * R, y = y0 + Math.sin(u * Math.PI) * sag + Math.sin(lt * 1.4 + u * 6 + s) * 5 + 12;
        const tw = 0.7 + 0.3 * Math.sin(lt * 5 + b * 1.9 + s);
        glow(ctx, x, y, 46, '255,214,120', 0.7 * tw);
        ctx.fillStyle = '#fff2c4'; P.circle(ctx, x, y, 8); ctx.fill();
      }
    }
    // stalls
    for (let i = 0; i < 4; i++) {
      const x = -R * 0.8 + i * R * 0.54, y = R * 0.18, w = R * 0.46;
      ctx.fillStyle = 'rgba(255,214,140,0.9)'; ctx.fillRect(x, y + 60, w, R * 0.5);
      glow(ctx, x + w / 2, y + 140, w * 0.7, '255,200,120', 0.5);
      for (let k = 0; k < 6; k++) { ctx.fillStyle = k % 2 ? '#fff' : ['#ff6f8d', '#5fd0fb', '#ffc34d', '#7fe1a8'][i]; ctx.beginPath(); ctx.moveTo(x + k * w / 6, y); ctx.lineTo(x + (k + 1) * w / 6, y); ctx.lineTo(x + (k + 1) * w / 6 + 4, y + 66); ctx.lineTo(x + k * w / 6 - 4, y + 66); ctx.fill(); }
    }
    // crowd
    for (let i = 0; i < 12; i++) {
      const x = -R + ((i * 175 + lt * (16 + (i % 3) * 8)) % (2 * R + 160)) - 80 * 0, h = 120 + hash(i) * 70, bob = Math.abs(Math.sin(lt * 4 + i)) * 6;
      ctx.fillStyle = 'rgba(30,14,60,0.95)'; ctx.beginPath(); ctx.arc(x, R * 0.62 - h - bob, 24, 0, TAU); ctx.fill();
      P.rrect(ctx, x - 34, R * 0.62 - h + 20 - bob, 68, h, 28); ctx.fill();
    }
    ctx.fillStyle = '#1d1344'; ctx.fillRect(-R, R * 0.72, 2 * R, R);
    for (let i = 0; i < 9; i++) { // floating lanterns
      const x = (hash(i + 3) * 2 - 1) * R * 0.9, y = R * 0.5 - ((lt * (30 + hash(i) * 30) + hash(i + 8) * 600) % (R * 1.5));
      glow(ctx, x, y, 40, '255,170,110', 0.8); ctx.fillStyle = '#ffcf9a'; P.rrect(ctx, x - 9, y - 12, 18, 24, 7); ctx.fill();
    }
  };

  S.list = ['sunrise', 'rain', 'harbor', 'market'];
  S.labels = ['06:42  sunrise', 'rain, again', 'pier 4  low tide', 'night market'];

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
