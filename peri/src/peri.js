// The character rig. The sprites come from the supplied art; the face is redrawn
// as vectors so the eyes can blink, dart, squint and stay sharp in close ups.
(function () {
  const { TAU, clamp, lerp } = P;
  // source space anchors (pixels of the original artwork)
  const FEET = { x: 470, y: 1003 };
  const EYE_L = { x: 625, y: 680, a: 28.5, b: 43.5 };
  const EYE_R = { x: 765, y: 669, a: 22.5, b: 43.5 };
  const HINGE = { x: 980, y: 560 };
  const INK = '#09090c';

  function eye(ctx, e, o, side) {
    const k = side === 'L' ? 1 : 0.82;
    const wow = o.mood === 'wow' ? 1.2 : o.mood === 'worry' ? 1.05 : 1;
    let sy = 1 - clamp(o.blink || 0);
    if (o.mood === 'smirk' && side === 'R') sy = Math.min(sy, 0.62);
    const cx = e.x + (o.lookX || 0) * 11 * k, cy = e.y + (o.lookY || 0) * 9 * k;
    const a = e.a * wow, b = e.b * wow;
    ctx.save();
    if (o.mood === 'happy' || sy < 0.12) {
      // closed or smiling eye: an arc
      ctx.strokeStyle = INK; ctx.lineWidth = 8.5; ctx.lineCap = 'round';
      ctx.beginPath();
      const up = o.mood === 'happy' ? 1 : 0.0;
      ctx.moveTo(cx - a * 0.95, cy + 8);
      ctx.quadraticCurveTo(cx, cy - 36 * up + 6 * (1 - up), cx + a * 0.95, cy + 8);
      ctx.stroke();
      ctx.restore();
      return;
    }
    ctx.translate(cx, cy); ctx.scale(1, Math.max(0.1, sy));
    const g = ctx.createRadialGradient(5, 16, 4, 0, 0, b * 1.1);
    g.addColorStop(0, '#2f3541'); g.addColorStop(0.35, '#15171d'); g.addColorStop(1, INK);
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.ellipse(0, 0, a, b, 0, 0, TAU); ctx.fill();
    // gloss: one big highlight and a small bounce light, they stay put while the eye moves
    const hx = (o.lookX || 0) * -6 * k, hy = (o.lookY || 0) * -5 * k;
    ctx.fillStyle = 'rgba(255,255,255,0.97)';
    ctx.beginPath(); ctx.arc(a * 0.3 + hx, -b * 0.5 + hy, a * 0.4 * (o.sparkle ? 1.35 : 1), 0, TAU); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.beginPath(); ctx.arc(-a * 0.32 + hx * 0.4, b * 0.52 + hy * 0.4, a * 0.15, 0, TAU); ctx.fill();
    if (o.sparkle) {            // star glints for the happy beat
      ctx.fillStyle = 'rgba(255,255,255,0.95)';
      const s = a * 0.5 * o.sparkle;
      ctx.beginPath();
      for (let i = 0; i < 8; i++) { const r = i % 2 ? s * 0.25 : s; const an = i * Math.PI / 4; ctx.lineTo(-a * 0.2 + Math.cos(an) * r, b * 0.2 + Math.sin(an) * r); }
      ctx.closePath(); ctx.fill();
    }
    ctx.restore();
  }

  function mouth(ctx, o) {
    const m = o.mouth || (o.mood === 'happy' ? 'open' : o.mood === 'wow' ? 'o' : o.mood === 'worry' ? 'flat' : 'smile');
    ctx.save();
    ctx.strokeStyle = INK; ctx.fillStyle = INK; ctx.lineWidth = 6.5; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    const x = 704 + (o.lookX || 0) * 5, y = 706;
    if (m === 'smile') {
      ctx.beginPath(); ctx.moveTo(x - 24, y - 1); ctx.quadraticCurveTo(x, y + 44, x + 24, y - 1); ctx.stroke();
    } else if (m === 'open') {
      ctx.beginPath(); ctx.moveTo(x - 30, y - 4); ctx.quadraticCurveTo(x, y + 6, x + 30, y - 4);
      ctx.quadraticCurveTo(x + 24, y + 50, x, y + 50); ctx.quadraticCurveTo(x - 24, y + 50, x - 30, y - 4); ctx.fill();
      ctx.fillStyle = '#ff8aa6'; ctx.beginPath(); ctx.ellipse(x, y + 41, 15, 9, 0, 0, TAU); ctx.fill();
    } else if (m === 'o') {
      ctx.beginPath(); ctx.ellipse(x, y + 14, 11, 15, 0, 0, TAU); ctx.fill();
    } else if (m === 'flat') {
      ctx.beginPath(); ctx.moveTo(x - 16, y + 12); ctx.quadraticCurveTo(x, y + 6, x + 16, y + 12); ctx.stroke();
    } else if (m === 'grin') {
      ctx.beginPath(); ctx.moveTo(x - 22, y + 2); ctx.quadraticCurveTo(x + 6, y + 36, x + 28, y - 8); ctx.stroke();
    }
    ctx.restore();
  }

  // o: x,y = feet position, s = scale (1 = artwork size), v = colour variant
  //    ext = periscope extension (artwork px), scope = periscope tilt (deg)
  //    sq = squash (+ squashes, - stretches), rot = body rotation (deg), flip = face left
  //    lookX/lookY -1..1, blink 0..1, mood idle|happy|wow|worry|smirk, mouth override
  P.drawPeri = function (ctx, o) {
    const v = o.v || 'mint', M = P.meta, img = P.img;
    const base = img[v + '_base'], top = img[v + '_top'], mid = img[v + '_mid'];
    const [bx, by] = M.box, ext = o.ext || 0, sq = o.sq || 0;
    ctx.save();
    if (o.alpha !== undefined) ctx.globalAlpha *= o.alpha;
    ctx.translate(o.x, o.y);
    ctx.rotate((o.rot || 0) * Math.PI / 180);
    ctx.scale((o.flip ? -1 : 1) * o.s * (1 + sq), o.s * (1 - sq * 0.92));
    ctx.translate(-FEET.x, -FEET.y);
    ctx.drawImage(base, bx, by);
    // periscope: stretchable straight section and the lens elbow, hinged at the base
    ctx.save();
    ctx.translate(HINGE.x, HINGE.y); ctx.rotate((o.scope || 0) * Math.PI / 180); ctx.translate(-HINGE.x, -HINGE.y);
    const [mx0, my0, mx1] = M.parts.mid;
    ctx.drawImage(mid, mx0, 400 - ext, mx1 - mx0, 168 + ext);
    const [tx0, ty0] = M.parts.top;
    ctx.drawImage(top, tx0, ty0 - ext);
    if (o.lensGlow) {                     // lens flashing when it "sees" something
      const g = ctx.createRadialGradient(1105, 262 - ext, 6, 1105, 262 - ext, 120);
      g.addColorStop(0, `rgba(255,255,255,${0.9 * o.lensGlow})`); g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g; ctx.fillRect(950, 100 - ext, 330, 330);
    }
    ctx.restore();
    // face
    eye(ctx, EYE_L, o, 'L'); eye(ctx, EYE_R, o, 'R'); mouth(ctx, o);
    if (o.cheeks) {
      const blush = (x, y, rx, ry) => {
        ctx.save(); ctx.translate(x, y); ctx.scale(1, ry / rx);
        const g = ctx.createRadialGradient(0, 0, 0, 0, 0, rx);
        g.addColorStop(0, `rgba(255,128,160,${0.5 * o.cheeks})`); g.addColorStop(1, 'rgba(255,128,160,0)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, rx, 0, TAU); ctx.fill(); ctx.restore();
      };
      blush(586, 738, 34, 22); blush(780, 726, 26, 18);
    }
    ctx.restore();
  };

  // floor shadow + mirror reflection, then the character itself
  P.drawPeriOnFloor = function (ctx, o, floorY) {
    const w = 520 * o.s, lift = clamp((floorY - o.y) / 220);
    ctx.save();
    ctx.translate(o.x, floorY);
    ctx.scale(1, 0.14);
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, w * 0.6);
    g.addColorStop(0, `rgba(20,90,130,${0.32 * (1 - lift * 0.6)})`); g.addColorStop(1, 'rgba(20,90,130,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, w * (0.6 + lift * 0.2), 0, TAU); ctx.fill();
    ctx.restore();
    if (o.reflect !== false) {
      // reflect into a scratch canvas, fade it out with a mask, then lay it on the floor
      const c = P.scratch || (P.scratch = Object.assign(document.createElement('canvas'), { width: P.W, height: P.H }));
      const k = c.getContext('2d');
      k.setTransform(1, 0, 0, 1, 0, 0); k.globalCompositeOperation = 'source-over'; k.globalAlpha = 1; k.clearRect(0, 0, P.W, P.H);
      k.save(); k.translate(0, floorY * 2); k.scale(1, -1);
      P.drawPeri(k, Object.assign({}, o, { alpha: (o.alpha === undefined ? 1 : o.alpha) }));
      k.restore();
      const reach = 560 * o.s + 70;
      k.globalCompositeOperation = 'destination-in';
      const f = k.createLinearGradient(0, floorY, 0, floorY + reach);
      f.addColorStop(0, 'rgba(0,0,0,0.30)'); f.addColorStop(1, 'rgba(0,0,0,0)');
      k.fillStyle = f; k.fillRect(0, floorY, P.W, reach);
      k.globalCompositeOperation = 'source-over';
      ctx.save(); ctx.beginPath(); ctx.rect(0, floorY, P.W, P.H - floorY); ctx.clip();
      ctx.drawImage(c, 0, 0); ctx.restore();
    }
    P.drawPeri(ctx, o);
  };

  // handy idle motion so a standing character never freezes
  P.idle = function (t, seed = 0, o = {}) {
    const bl = (() => { const c = (t + seed * 1.7) % 3.4; return c < 0.14 ? Math.sin(c / 0.14 * Math.PI) : 0; })();
    return Object.assign({
      sq: Math.sin(t * TAU / 2.4 + seed) * 0.014,
      scope: Math.sin(t * 1.3 + seed) * 4,
      lookX: Math.sin(t * 0.9 + seed * 2) * 0.5, lookY: Math.sin(t * 0.7 + seed) * 0.2,
      blink: bl, rot: Math.sin(t * 1.1 + seed) * 0.6,
    }, o);
  };
})();
