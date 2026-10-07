"""Soundtrack for the Peri film, synthesized with numpy and scipy.

    python3 peri/audio/synth.py        ->  peri/dist/soundtrack.wav

120 BPM, one bar is 2 s, 16 bars = 32 s. Every effect below is placed on a timestamp
from the animation (film.js), so the picture and the sound hit together.
"""
import os
import numpy as np
from scipy import signal
from scipy.io import wavfile

SR = 44100
DUR = 32.0
BPM = 120
BEAT = 60 / BPM
rng = np.random.default_rng(7)
N = int((DUR + 3) * SR)

dry = np.zeros((N, 2))      # drums, bass: stay tight
wet = np.zeros((N, 2))      # pads, plucks, fx: go through the reverb


def hz(note):               # midi note number to frequency
    return 440.0 * 2 ** ((note - 69) / 12)


NOTE = {n: i for i, n in enumerate(['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'])}


def m(name):                # 'C5' -> midi
    return NOTE[name[:-1]] + 12 * (int(name[-1]) + 1)


def put(bus, t, x, gain=1.0, pan=0.0):
    i = int(t * SR)
    if i < 0 or i >= N:
        return
    x = x[: N - i]
    a = (pan + 1) * np.pi / 4
    bus[i:i + len(x), 0] += x * gain * np.cos(a)
    bus[i:i + len(x), 1] += x * gain * np.sin(a)


def t_(d):
    return np.arange(int(d * SR)) / SR


def env_exp(d, k):
    t = t_(d)
    return np.exp(-t * k)


def lp(x, f, order=2):
    b, a = signal.butter(order, f / (SR / 2), 'low'); return signal.lfilter(b, a, x)


def hp(x, f, order=2):
    b, a = signal.butter(order, f / (SR / 2), 'high'); return signal.lfilter(b, a, x)


def bp(x, f0, f1, order=2):
    b, a = signal.butter(order, [f0 / (SR / 2), f1 / (SR / 2)], 'band'); return signal.lfilter(b, a, x)


def fade(x, a=0.004, r=0.01):
    n = len(x); na, nr = min(int(a * SR), n), min(int(r * SR), n)
    x = x.copy()
    x[:na] *= np.linspace(0, 1, na); x[n - nr:] *= np.linspace(1, 0, nr)
    return x


# ---------------- instruments ----------------
def kick(t, g=1.0):
    d = 0.42; tt = t_(d)
    f = 48 + 110 * np.exp(-tt * 28)
    x = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-tt * 9)
    x += 0.25 * np.sin(2 * np.pi * np.cumsum(f * 2) / SR) * np.exp(-tt * 40)
    put(dry, t, fade(x), 0.9 * g)


def clap(t, g=1.0):
    d = 0.22; n = rng.standard_normal(int(d * SR))
    x = bp(n, 1100, 4800) * (np.exp(-t_(d) * 24))
    for k in (0.0, 0.011, 0.023):
        put(dry, t + k, fade(x * 0.5), 0.45 * g, 0.12)


def hat(t, g=1.0, open_=False, pan=0.25):
    d = 0.22 if open_ else 0.05
    x = hp(rng.standard_normal(int(d * SR)), 7200) * np.exp(-t_(d) * (14 if open_ else 70))
    put(dry, t, fade(x), 0.22 * g, pan)


def bass(t, midi, d=0.46, g=1.0):
    tt = t_(d); f = hz(midi)
    x = np.sin(2 * np.pi * f * tt) + 0.35 * np.sin(2 * np.pi * 2 * f * tt) * np.exp(-tt * 7)
    x *= np.exp(-tt * 3.4) * np.minimum(1, tt * 400)
    put(dry, t, fade(lp(x, 900)), 0.5 * g)


def pluck(t, midi, d=0.7, g=1.0, pan=0.0, bright=1.0):
    tt = t_(d); f = hz(midi)
    x = (np.sin(2 * np.pi * f * tt) * np.exp(-tt * 5.5)
         + 0.4 * bright * np.sin(2 * np.pi * 2 * f * tt) * np.exp(-tt * 11)
         + 0.2 * bright * np.sin(2 * np.pi * 4.01 * f * tt) * np.exp(-tt * 26))
    put(wet, t, fade(x), 0.34 * g, pan)


def bell(t, midi, d=1.6, g=1.0, pan=0.0):
    tt = t_(d); f = hz(midi); x = np.zeros_like(tt)
    for r, a, k in [(1, 1, 2.6), (2.76, 0.45, 3.6), (5.4, 0.25, 6), (8.9, 0.1, 10)]:
        x += a * np.sin(2 * np.pi * f * r * tt) * np.exp(-tt * k)
    put(wet, t, fade(x), 0.26 * g, pan)


def pad(t, notes, d, g=1.0):
    tt = t_(d); x = np.zeros_like(tt)
    for i, n in enumerate(notes):
        f = hz(n)
        for det in (-0.07, 0.0, 0.08):
            x += np.sin(2 * np.pi * f * (1 + det * 0.01) * tt + i) / 3
        x += 0.25 * np.sin(2 * np.pi * 2 * f * tt)
    a = np.minimum(1, tt / 0.5) * np.minimum(1, (d - tt) / 0.8)
    x = lp(x * a, 2400)
    put(wet, t, x, 0.07 * g / max(1, len(notes) / 3), -0.1)
    put(wet, t, x, 0.0, 0.1)


def whoosh(t, d, up=True, g=1.0, pan=0.0):
    n = rng.standard_normal(int(d * SR)); tt = t_(d) / d
    out = np.zeros_like(n)
    for lo, hi in [(200, 700), (600, 2200), (1800, 7000)]:
        band = bp(n, lo, hi)
        c = (lo * hi) ** 0.5
        pos = (np.log(c) - np.log(200)) / (np.log(3500) - np.log(200))
        center = tt if up else 1 - tt
        out += band * np.exp(-((center - pos) ** 2) / 0.12)
    out *= np.sin(np.pi * np.minimum(1, tt * 1.0)) ** 1.5
    put(wet, t, fade(out, 0.02, 0.05), 0.5 * g, pan)


def riser(t, d, g=1.0, f0=250, f1=2400):
    tt = t_(d); k = tt / d
    f = f0 * (f1 / f0) ** k
    x = 0.5 * np.sin(2 * np.pi * np.cumsum(f) / SR) * k ** 1.5
    n = hp(rng.standard_normal(len(tt)), 2000) * k ** 2.2 * 0.5
    put(wet, t, fade(x + n, 0.02, 0.02), 0.33 * g)


def pop(t, f0=520, f1=980, g=1.0, pan=0.0, d=0.14):
    tt = t_(d); f = f0 + (f1 - f0) * np.minimum(1, tt / 0.045)
    x = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-tt * 28) * np.minimum(1, tt * 600)
    put(wet, t, fade(x), 0.55 * g, pan)


def thud(t, f=85, g=1.0, d=0.32):
    tt = t_(d); fr = f * (1 + 1.1 * np.exp(-tt * 40))
    x = np.sin(2 * np.pi * np.cumsum(fr) / SR) * np.exp(-tt * 14)
    put(dry, t, fade(lp(x, 400)), 0.8 * g)


def click(t, g=1.0, pan=0.0, f=2600):
    d = 0.03; tt = t_(d)
    x = np.sin(2 * np.pi * f * tt) * np.exp(-tt * 140) + 0.4 * hp(rng.standard_normal(len(tt)), 5000) * np.exp(-tt * 200)
    put(wet, t, fade(x), 0.4 * g, pan)


def boing(t, f0=320, f1=620, g=1.0, d=0.34):
    tt = t_(d)
    f = f0 + (f1 - f0) * np.sin(np.pi * np.minimum(1, tt / (d * 0.85))) * (1 - tt / d * 0.3) + 18 * np.sin(2 * np.pi * 18 * tt)
    x = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-tt * 7) + 0.25 * np.sin(2 * np.pi * np.cumsum(f * 2) / SR) * np.exp(-tt * 12)
    put(wet, t, fade(x), 0.5 * g)


def slide(t, f0, f1, d, g=1.0):                        # slide whistle for the periscope
    tt = t_(d); k = tt / d
    f = f0 * (f1 / f0) ** k + 14 * np.sin(2 * np.pi * 6 * tt) * k
    x = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.sin(np.pi * np.minimum(1, k * 1.05)) ** 0.7
    put(wet, t, fade(x * 0.6, 0.02, 0.04), 0.4 * g)


def sparkle(t, n=10, spread=0.5, base='C6', g=1.0):
    scale = [0, 2, 4, 7, 9, 12, 14, 16, 19]
    for i in range(n):
        tt = t + i * spread / n + rng.random() * 0.02
        bell(tt, m(base) + scale[int(rng.integers(0, len(scale)))], d=0.8, g=0.35 * g * (1 - i / n * 0.5), pan=float(rng.uniform(-0.7, 0.7)))


def sub_hit(t, g=1.0):
    thud(t, 52, g * 1.3, 0.9)
    whoosh(t - 0.05, 0.5, up=False, g=0.5 * g)


# ---------------- music ----------------
CH = {   # chord tones (midi)
    'C': [m('C4'), m('E4'), m('G4'), m('B4'), m('C5')],
    'Am': [m('A3'), m('C4'), m('E4'), m('G4'), m('A4')],
    'F': [m('F3'), m('A3'), m('C4'), m('E4'), m('F4')],
    'G': [m('G3'), m('B3'), m('D4'), m('F4'), m('G4')],
}
ROOT = {'C': m('C2'), 'Am': m('A1'), 'F': m('F2') - 12 + 12, 'G': m('G1')}
BARS = ['C', 'Am', 'F', 'G', 'C', 'Am', 'F', 'G', 'Am', 'F', 'G', 'C', 'Am', 'F', 'G', 'C']
PAT = [0, 2, 1, 3, 2, 4, 3, 1]


def groove(t0, t1, kick_on=True, hats=True, bass_on=True, arp=True, g=1.0, clap_on=True):
    b = int(round(t0 / BEAT))
    while b * BEAT < t1 - 1e-6:
        t = b * BEAT; bar = int(t // 2.0)
        if bar >= len(BARS): break
        ch = BARS[bar]
        if kick_on:
            kick(t, g)
        if clap_on and b % 2 == 1:
            clap(t, g * 0.9)
        if hats:
            hat(t + BEAT / 2, g, open_=(b % 2 == 0))
            hat(t, g * 0.4, pan=-0.2)
        if bass_on:
            bass(t, ROOT[ch], g=g)
            bass(t + BEAT * 0.75, ROOT[ch] + 12, d=0.2, g=0.6 * g)
        if arp:
            for k in range(2):
                tt = t + k * BEAT / 2
                idx = PAT[((b * 2 + k) % 8)]
                pluck(tt, CH[ch][idx] + 12, g=g * (0.8 + 0.2 * (k == 0)), pan=(-0.35 if (b * 2 + k) % 2 else 0.35))
        b += 1


def pads(t0, t1, g=1.0):
    bar0 = int(t0 // 2.0)
    for bar in range(bar0, min(len(BARS), int(np.ceil(t1 / 2.0)))):
        s = max(bar * 2.0, t0)
        pad(s, [n for n in CH[BARS[bar]][:4]] + [ROOT[BARS[bar]] + 24], min((bar + 1) * 2.0, t1) - s + 0.4, g)


def build():
    # ---- 0 to 1.6 intro: the wordmark spells itself with a little motif
    pads(0.0, 2.0, 0.8)
    for i, n in enumerate(['C5', 'E5', 'G5', 'A5']):
        pop(0.46 + 0.09 * i, hz(m(n)) * 0.9, hz(m(n)) * 1.08, 0.9, pan=-0.3 + i * 0.2)
        pluck(0.46 + 0.09 * i, m(n), g=0.5, pan=-0.3 + i * 0.2)
    thud(0.8, 70, 0.8); boing(0.8, 360, 520, 0.5, 0.3)
    riser(1.05, 0.55, 0.7); whoosh(1.45, 0.9, True, 0.9)
    bell(1.6, m('G5'), g=0.8)
    # ---- 2 to 8 montage: the groove starts on the downbeat of bar 2
    pads(2.0, 8.0, 1.0)
    groove(2.0, 7.0, hats=True, g=0.95)
    for c in (4.0, 5.5, 7.0):
        whoosh(c - 0.12, 0.3, True, 0.8, pan=0.3); click(c, 0.9)
    # snare-style roll into the drop
    for k in range(16):
        t = 7.0 + k * (BEAT / 2) * (1 - 0.02 * k)
        if t < 7.98: hat(t, 0.5 + k * 0.05, pan=(-1) ** k * 0.4); kick(t, 0.25) if k % 4 == 0 else None
    riser(7.0, 1.0, 1.0)
    # ---- 8 to 10 wide: sparse
    thud(8.34, 80, 1.0); boing(8.34, 300, 560, 0.7)
    whoosh(7.95, 0.4, False, 0.9)
    slide(8.6, 520, 1500, 0.5, 0.8); click(9.12, 0.8)
    for i, t in enumerate((9.0, 9.5)):
        click(t, 0.5, pan=(-0.4, 0.4)[i], f=3000)
    pads(8.0, 10.0, 1.1)
    for i, n in enumerate(['E5', 'G5', 'E5', 'D5']):
        pluck(8.5 + i * 0.5, m(n) + 12, g=0.7, pan=0.4 - 0.25 * i)
    # ping
    bell(10.0, m('E6'), g=1.1); bell(10.0, m('B6'), g=0.6); sparkle(10.02, 8, 0.5, 'E6', 0.9)
    pop(10.05, 700, 1300, 1.0, 0.3); pop(10.1, 900, 1700, 1.0, -0.1)
    boing(10.0, 280, 700, 0.8, 0.4); whoosh(9.95, 0.35, True, 0.8)
    pads(10.0, 12.4, 1.1)
    riser(10.6, 1.8, 1.0, 200, 2000)
    whoosh(10.8, 1.6, True, 0.9)
    # ---- 12.4 to 17: cards
    sub_hit(12.4, 0.6)
    groove(12.0, 17.0, g=1.0, kick_on=True, hats=True)
    pads(12.0, 17.2, 1.0)
    for t, n in [(12.45, 'C6'), (13.45, 'E6'), (14.45, 'G6')]:
        pop(t, 500, 1100, 1.0, 0.3); bell(t + 0.02, m(n), g=0.7, pan=0.3)
    pop(15.3, 450, 900, 0.9, 0.1)
    whoosh(15.9, 0.6, True, 0.45, pan=0.4)
    click(16.5, 1.3, f=1800)
    for i, n in enumerate(['C6', 'E6', 'G6', 'C7']):
        bell(16.55 + i * 0.06, m(n), g=0.9, pan=-0.3 + 0.2 * i)
    sparkle(16.6, 14, 0.8, 'C6', 1.0)
    for i in range(3): pop(16.55 + i * 0.1, 600 + i * 150, 1100 + i * 200, 0.8, 0.5 - i * 0.4)
    boing(16.62, 260, 640, 0.8, 0.4)
    whoosh(17.0, 0.55, False, 0.7)
    # ---- 17.2 to 18.4 dolly in
    riser(17.2, 1.2, 1.2, 150, 3200)
    whoosh(17.2, 1.2, True, 1.0)
    # ---- 18.4 to 20 tension: low drone, heartbeat, eye ticks
    sub_hit(18.4, 0.9)
    pad(18.4, [m('A2'), m('E3'), m('A3')], 1.8, 1.2)
    for b in range(int(18.5 / BEAT), int(20.0 / BEAT)):
        kick(b * BEAT, 0.5)
    for t, p in [(18.5, -0.8), (19.0, 0.8), (19.6, 0.0)]:
        click(t, 1.1, pan=p, f=3400); pop(t, 900, 1200, 0.3, p)
    click(19.78, 0.8, f=2000)
    riser(19.55, 0.45, 1.0, 400, 5000)
    # ---- 20 the check badge and the joy
    sub_hit(20.0, 1.0)
    for i, n in enumerate(['C5', 'E5', 'G5', 'B5', 'C6']):
        bell(20.0 + i * 0.02, m(n), g=0.9, pan=-0.4 + 0.2 * i)
    pad(20.0, [m('C4'), m('E4'), m('G4'), m('B4'), m('D5')], 2.2, 1.6)
    sparkle(20.05, 22, 1.2, 'C6', 1.0)
    clap(20.0, 1.0); kick(20.0, 1.1)
    boing(20.75, 360, 760, 0.7, 0.3)
    whoosh(20.95, 0.9, False, 0.9)
    # ---- 22 friends: full groove, melody, one pitch per landing
    groove(22.0, 27.5, g=1.0)
    pads(22.0, 27.6, 1.15)
    notes = ['C5', 'E5', 'G5', 'A5', 'C6']
    for i, t0 in enumerate([22.55, 23.05, 23.55, 24.05, 24.55]):
        slide(t0 + 0.02, 1400, 500, 0.32, 0.5)
        thud(t0 + 0.36, 80, 0.8)
        pop(t0 + 0.37, hz(m(notes[i])) * 0.9, hz(m(notes[i])) * 1.1, 1.0, pan=-0.6 + 0.3 * i)
        bell(t0 + 0.37, m(notes[i]) + 12, g=0.6, pan=-0.6 + 0.3 * i)
        pop(t0 + 0.52, 700 + 80 * i, 1200 + 90 * i, 0.6, 0.5 - 0.25 * i)
    for t, n in [(25.3, 'E5'), (25.45, 'G5'), (25.6, 'A5'), (25.9, 'C6')]:
        pluck(t, m(n), g=1.1, bright=1.4, pan=0.2)
    for i, n in enumerate(['C5', 'E5', 'G5', 'C6']):
        bell(26.3 + i * 0.03, m(n), g=0.9, pan=-0.3 + 0.2 * i)
    sparkle(26.4, 12, 0.7, 'G5', 0.9)
    # ---- 27.4 wipe into the waitlist
    whoosh(27.3, 0.65, True, 1.1, pan=-0.2)
    thud(27.95, 70, 0.9); clap(27.95, 0.8)
    groove(28.0, 30.4, g=0.85, clap_on=True)
    pads(27.6, 30.4, 1.1)
    for t in (28.0, 28.25):
        pop(t, 600, 1100, 0.9, 0.3); pluck(t, m('G5'), g=0.8)
    slide(28.5, 400, 1100, 0.3, 0.6); boing(28.7, 300, 560, 0.5, 0.25)
    pop(28.8, 450, 900, 0.9, -0.1)
    click(29.0, 1.2, f=1900)
    for i, n in enumerate(['E6', 'G6', 'C7']):
        bell(29.03 + i * 0.05, m(n), g=0.6, pan=0.2 * i)
    # ---- 30.4 iris closes, logo lockup, same four note motif as the start
    whoosh(30.35, 0.7, False, 1.0)
    riser(30.1, 0.5, 0.6, 300, 1800)
    thud(31.05, 70, 0.8)
    pad(30.4, [m('C4'), m('E4'), m('G4'), m('B4'), m('C5')], 2.6, 1.5)
    for i, n in enumerate(['C5', 'E5', 'G5', 'A5']):
        pop(30.78 + 0.09 * i, hz(m(n)) * 0.9, hz(m(n)) * 1.08, 0.9, pan=-0.3 + i * 0.2)
        pluck(30.78 + 0.09 * i, m(n), g=0.55, pan=-0.3 + i * 0.2)
    boing(31.2, 360, 520, 0.6, 0.3)
    slide(31.3, 1500, 420, 0.3, 0.6)
    bell(31.45, m('C7'), g=0.9); sparkle(31.45, 8, 0.5, 'G6', 0.7)
    bell(31.1, m('C6'), g=0.8, d=2.0); bell(31.1, m('G6'), g=0.5, d=2.0)


build()


def reverb(x, t=2.2, wetmix=1.0):
    n = int(t * SR); tt = np.arange(n) / SR
    ir = rng.standard_normal((n, 2)) * np.exp(-tt * 3.0)[:, None]
    ir = lp(ir.T, 5200).T
    ir[: int(0.012 * SR)] *= np.linspace(0, 1, int(0.012 * SR))[:, None]
    ir /= np.sqrt((ir ** 2).sum(0, keepdims=True)) * 1.0
    return np.stack([signal.fftconvolve(x[:, c], ir[:, c])[: len(x)] for c in range(2)], 1) * wetmix


rev = reverb(wet, 2.2, 0.55)
mix = dry * 0.9 + wet * 0.8 + rev * 0.9
mix = mix[: int(DUR * SR)]
# gentle glue and a tidy ending
mix = np.tanh(mix * 1.15) / np.tanh(1.15)
f = int(0.5 * SR); mix[-f:] *= np.linspace(1, 0, f)[:, None] ** 1.5
mix[: int(0.01 * SR)] *= np.linspace(0, 1, int(0.01 * SR))[:, None]
mix = mix / max(1e-9, np.abs(mix).max()) * 0.89
out = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'dist', 'soundtrack.wav')
os.makedirs(os.path.dirname(out), exist_ok=True)
wavfile.write(out, SR, (mix * 32767).astype(np.int16))
print('wrote', os.path.normpath(out), f'{len(mix) / SR:.1f}s  peak {np.abs(mix).max():.2f}')
