"""
Procedural soundtrack for the reel. 128 BPM, A minor, exactly 15.0 s.

Every hit is placed on the same beat grid the visuals use (src/reel.js), so the
audio is synced by construction rather than by hand.

    python3 audio/synth.py            -> dist/soundtrack.wav
"""
import os
import wave

import numpy as np
from scipy.signal import butter, lfilter, sosfilt, fftconvolve

SR = 48000
BPM = 128
BEAT = 60 / BPM
BAR = BEAT * 4
DUR = BAR * 8
N = int(round(DUR * SR))
rng = np.random.default_rng(128)

L = np.zeros(N)
R = np.zeros(N)
send = np.zeros((2, N))  # reverb bus
duck = np.ones(N)        # sidechain envelope


def midi(m):
    return 440.0 * 2 ** ((m - 69) / 12)


def tt(dur):
    return np.arange(int(dur * SR)) / SR


def add(sig, t0, gain=1.0, pan=0.0, rev=0.0):
    i0 = int(round(t0 * SR))
    if i0 >= N:
        return
    if i0 < 0:
        sig = sig[-i0:]
        i0 = 0
    sig = sig[: N - i0]
    gl = gain * np.cos((pan + 1) * np.pi / 4)
    gr = gain * np.sin((pan + 1) * np.pi / 4)
    L[i0:i0 + len(sig)] += sig * gl
    R[i0:i0 + len(sig)] += sig * gr
    if rev:
        send[0, i0:i0 + len(sig)] += sig * gl * rev
        send[1, i0:i0 + len(sig)] += sig * gr * rev


def bp(x, lo, hi, order=2):
    return sosfilt(butter(order, [lo, hi], 'bandpass', fs=SR, output='sos'), x)


def hp(x, f, order=2):
    return sosfilt(butter(order, f, 'highpass', fs=SR, output='sos'), x)


def lp(x, f, order=2):
    return sosfilt(butter(order, f, 'lowpass', fs=SR, output='sos'), x)


def sweep_filter(x, f0, f1, kind='bandpass', q=1.2, block=256):
    """Time-varying filter: cutoff moves exponentially from f0 to f1."""
    out = np.zeros_like(x)
    zi = np.zeros(2)
    n = len(x)
    for s in range(0, n, block):
        k = s / max(1, n - 1)
        f = f0 * (f1 / f0) ** k
        w = 2 * np.pi * f / SR
        alpha = np.sin(w) / (2 * q)
        if kind == 'bandpass':
            b = np.array([alpha, 0, -alpha])
        else:  # lowpass
            b = np.array([(1 - np.cos(w)) / 2, 1 - np.cos(w), (1 - np.cos(w)) / 2])
        a = np.array([1 + alpha, -2 * np.cos(w), 1 - alpha])
        seg, zi = lfilter(b / a[0], a / a[0], x[s:s + block], zi=zi)
        out[s:s + block] = seg
    return out


# ------------------------------------------------------------------ voices
def kick(t0, g=1.0, sub=False):
    t = tt(0.5 if sub else 0.34)
    f = 44 + 120 * np.exp(-t * 32)
    ph = 2 * np.pi * np.cumsum(f) / SR
    body = np.sin(ph) * np.exp(-t * (5 if sub else 9))
    click = hp(rng.standard_normal(len(t)), 3000) * np.exp(-t * 300) * 0.3
    add(np.tanh((body + click) * 1.6) * 0.9, t0, g)
    i0 = int(t0 * SR)
    d = tt(BEAT * 0.9)
    env = 1 - 0.65 * np.exp(-d * 9)
    seg = duck[i0:i0 + len(env)]
    duck[i0:i0 + len(env)] = np.minimum(seg, env[:len(seg)])


def clap(t0, g=0.5):
    t = tt(0.25)
    n = rng.standard_normal(len(t))
    env = np.zeros(len(t))
    for k, o in enumerate([0, 0.011, 0.022]):
        env += np.exp(-np.maximum(0, t - o) * (160 if k < 2 else 22)) * (t >= o)
    add(bp(n, 900, 3200) * env * 0.7, t0, g, 0.05, rev=0.35)


def snare(t0, g=0.4):
    t = tt(0.18)
    n = bp(rng.standard_normal(len(t)), 1200, 7000) * np.exp(-t * 26)
    tone = np.sin(2 * np.pi * 190 * t) * np.exp(-t * 30) * 0.5
    add(n + tone, t0, g, 0.0, rev=0.2)


def hat(t0, g=0.12, open_=False, pan=0.25):
    t = tt(0.25 if open_ else 0.05)
    n = hp(rng.standard_normal(len(t)), 7500) * np.exp(-t * (14 if open_ else 90))
    add(n, t0, g, pan)


def bass(t0, m, dur, g=0.32, cutoff=900, wob=0.0):
    t = tt(dur)
    f = midi(m)
    saw = 2 * ((t * f) % 1) - 1 + 0.5 * (2 * ((t * f * 1.005) % 1) - 1)
    sub = np.sin(2 * np.pi * f * t)
    x = saw * 0.5 + sub
    if wob:
        x = sweep_filter(x, cutoff * (1 + wob), cutoff * 0.4, 'lowpass', q=2.5)
    else:
        x = lp(x, cutoff)
    env = np.minimum(1, t / 0.004) * np.exp(-t * 2.5)
    env[-200:] *= np.linspace(1, 0, 200)
    add(np.tanh(x * env * 1.3), t0, g)


def pad(t0, notes, dur, g=0.06, cutoff=2400):
    t = tt(dur)
    x = np.zeros(len(t))
    for m in notes:
        for det in (-0.08, 0.0, 0.09):
            f = midi(m + det)
            x += 2 * ((t * f + rng.random()) % 1) - 1
    x = lp(x, cutoff, 3)
    env = np.minimum(1, t / 0.25) * np.minimum(1, (dur - t) / 0.3)
    add(x * env, t0, g, -0.2, rev=0.5)
    add(x * env * 0.9, t0 + 0.012, g, 0.3)


def pluck(t0, m, g=0.1, pan=0.0, decay=16, rev=0.4):
    t = tt(0.4)
    f = midi(m)
    x = (np.sin(2 * np.pi * f * t) + 0.3 * np.sin(4 * np.pi * f * t) + 0.12 * np.sin(6 * np.pi * f * t))
    add(x * np.exp(-t * decay) * np.minimum(1, t / 0.002), t0, g, pan, rev)


def blip(t0, f0, f1, dur=0.12, g=0.2, pan=0.0):
    t = tt(dur)
    f = f0 * (f1 / f0) ** (t / dur)
    add(np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 18) * np.minimum(1, t / 0.002), t0, g, pan, rev=0.3)


def whoosh(t0, dur, f0=300, f1=6000, g=0.25, pan_from=-0.7, pan_to=0.7, reverse=False):
    t = tt(dur)
    n = sweep_filter(rng.standard_normal(len(t)), f0, f1, q=1.4)
    env = np.sin(np.pi * t / dur) ** 2 if not reverse else (t / dur) ** 3
    x = n * env
    # pan sweep: split in two halves
    h = len(x) // 2
    add(x[:h], t0, g, pan_from, rev=0.3)
    add(x[h:], t0 + h / SR, g, pan_to, rev=0.3)


def riser(t0, dur, g=0.22):
    t = tt(dur)
    n = sweep_filter(rng.standard_normal(len(t)), 400, 9000, q=2.0)
    f = 110 * 2 ** (3 * t / dur)
    tone = (2 * ((np.cumsum(f) / SR) % 1) - 1) * 0.15
    env = (t / dur) ** 2.2
    add((n + lp(tone, 3000)) * env, t0, g, 0, rev=0.4)


def impact(t0, g=0.8, tail=2.0):
    t = tt(tail)
    f = 30 + 80 * np.exp(-t * 12)
    boom = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 2.2)
    n = lp(rng.standard_normal(len(t)), 1800) * np.exp(-t * 7) * 0.6
    add(np.tanh((boom + n) * 1.8) * 0.8, t0, g, 0, rev=0.25)


def crash(t0, g=0.18, tail=2.5):
    t = tt(tail)
    n = hp(rng.standard_normal(len(t)), 4500) * np.exp(-t * 1.7)
    add(n, t0, g, -0.3, rev=0.4)
    add(hp(rng.standard_normal(len(t)), 4500) * np.exp(-t * 1.7), t0, g, 0.3)


def suck(t0, dur, g=0.3):
    t = tt(dur)
    n = sweep_filter(rng.standard_normal(len(t)), 8000, 300, q=1.2)
    add(n * (t / dur) ** 3, t0, g, 0, rev=0.1)


def tick(t0, g=0.08, pan=0.0):
    t = tt(0.02)
    add(hp(rng.standard_normal(len(t)), 5000) * np.exp(-t * 400), t0, g, pan)


# ---------------------------------------------------------------- arrange
b = lambda k: k * BEAT  # beat -> seconds
CHORDS = {
    'Am': [57, 60, 64], 'F': [53, 57, 60], 'C': [55, 60, 64], 'G': [55, 59, 62],
}
ROOT = {'Am': 33, 'F': 29, 'C': 36, 'G': 31}
PROG = [None, 'Am', 'Am', 'F', 'C', 'G', 'F', 'Am']

# Bar 0 : ignition
kick(0.0, 0.9, sub=True)
blip(0.0, 2200, 900, 0.1, 0.15)
pad(0.0, [45, 57, 64], BAR, 0.035, 900)
whoosh(b(0.8), 0.45, 200, 5000, 0.22, -0.8, 0.8)
for i in range(6):
    tick(b(1.8) + i * 0.04, 0.12, -0.5 + i * 0.2)
for i in range(15):
    tick(b(2.15) + i * 0.018, 0.05, -0.7 + i * 0.1)
kick(b(2), 0.45)
kick(b(3), 0.55)
riser(b(2.2), BAR - b(2.2), 0.24)
suck(b(3.1), BAR - b(3.1), 0.25)

# Bars 1..6 : the groove
for bar in range(1, 7):
    t0 = bar * BAR
    ch = PROG[bar]
    pad(t0, CHORDS[ch], BAR, 0.05 if bar != 5 else 0.04, 1800 + bar * 250)
    for k in range(4):
        kick(t0 + b(k), 1.0)
        hat(t0 + b(k + 0.5), 0.12, open_=(k % 2 == 1), pan=0.3)
        for s in (0.25, 0.75):
            hat(t0 + b(k + s), 0.05, pan=-0.3)
    clap(t0 + b(1)); clap(t0 + b(3))
    # bass: 8ths, octave jumps
    root = ROOT[ch]
    pattern = [0, 12, 0, 0, 12, 0, 7, 12]
    for k, o in enumerate(pattern):
        wob = 1.6 if bar == 5 else 0.0
        bass(t0 + b(k * 0.5), root + o, BEAT * 0.48, 0.3, 700 if not wob else 1400, wob)

# Kinetic type: each word gets a thud + whoosh
for k in range(4):
    impact(BAR + b(k), 0.35 if k else 0.7, 0.8)
    whoosh(BAR + b(k) - 0.12, 0.3, 500, 7000, 0.14, 0.8 if k % 2 else -0.8, 0.0)
crash(BAR, 0.14, 1.6)
# the slab wipe
whoosh(BAR + b(3.2), 0.28 + BEAT * 0.5, 300, 8000, 0.26, -0.9, 0.9)

# Shape layers: morph zaps on beats
for k in range(4):
    blip(2 * BAR + b(k), 1800 - k * 200, 120, 0.2, 0.22, [-0.4, 0.4, -0.2, 0.2][k])
suck(2 * BAR + b(3.3), b(0.7), 0.35)

# Particles: burst + sparkle arp
impact(3 * BAR, 0.95, 1.8)
crash(3 * BAR, 0.2)
whoosh(3 * BAR, 0.9, 6000, 400, 0.2, 0, 0)
arp = [69, 72, 76, 81, 76, 72, 69, 64]
for k in range(16):
    pluck(3 * BAR + b(k * 0.25), arp[k % 8] + 12, 0.07, (k % 2) * 1.2 - 0.6, 18)
for k in range(10):
    tick(3 * BAR + 1.0 + k * 0.05, 0.05, -0.8 + k * 0.16)  # scanline
suck(3 * BAR + 1.36, BAR - 1.36, 0.18)

# 3D: bigger arp, orbit hum
impact(4 * BAR, 0.6, 1.2)
arp3 = [67, 71, 74, 79, 74, 71, 67, 62]
for k in range(16):
    pluck(4 * BAR + b(k * 0.25), arp3[k % 8], 0.075, np.sin(k) * 0.7, 14, 0.5)
for k in (1.1, 2.3):
    whoosh(4 * BAR + b(k) - 0.05, 0.55, 250, 3000, 0.16, -0.5, 0.5)
suck(4 * BAR + b(3.35), BAR - b(3.35), 0.3)

# Liquid: bubble blips
impact(5 * BAR, 0.45, 1.0)
for k in range(4):
    blip(5 * BAR + b(k) + 0.02, 1400, 380, 0.12, 0.2, 0.5 - k * 0.3)
    blip(5 * BAR + b(k + 0.5) + 0.02, 900, 300, 0.09, 0.1, -0.3)
for k, tt0 in enumerate(rng.uniform(0, BAR, 10)):
    blip(5 * BAR + tt0, 2600 + 400 * rng.random(), 900, 0.05, 0.05, rng.uniform(-0.8, 0.8))

# Grid: iris whoosh, tile pops, zoom whoosh, snare fill
whoosh(6 * BAR - 0.05, 0.5, 300, 5000, 0.22, 0.0, 0.0)
pops = [(0.3, 4)] + [(0.37, i) for i in (1, 3, 5, 7)] + [(0.44, i) for i in (0, 2, 6, 8)]
notes = [76, 79, 81, 84, 88, 81, 84, 88, 91]
for j, (d, idx) in enumerate(pops):
    blip(6 * BAR + d + j * 0.004, midi(notes[j]) * 2, midi(notes[j]), 0.06, 0.14, ((idx % 3) - 1) * 0.7)
for k in range(8):
    snare(6 * BAR + b(2) + b(k * 0.25), 0.12 + 0.05 * k)
riser(6 * BAR + b(1.5), BAR - b(1.5), 0.3)
whoosh(6 * BAR + b(3.1), BAR - b(3.1) + 0.05, 200, 9000, 0.3, 0, 0, reverse=True)

# Bar 7 : the signature hit
T = 7 * BAR
kick(T, 1.1, sub=True)
impact(T, 1.0, 2.2)
crash(T, 0.26, 2.2)
pad(T, [45, 57, 60, 64, 71], BAR, 0.07, 2600)
bass(T, 33, BAR * 0.9, 0.35, 500)
for k, m in enumerate([81, 84, 88, 93]):
    pluck(T + 0.06 + k * 0.07, m, 0.09, -0.6 + k * 0.4, 6, 0.6)
suck(T + 1.2, 0.5, 0.2)
blip(T + 1.55, 3000, 1800, 0.08, 0.14)   # the dot appears
blip(T + 1.8, 1200, 200, 0.07, 0.16)     # and blinks out

# ------------------------------------------------------------------ mixdown
L *= duck
R *= duck
ir_t = tt(2.4)
ir = np.stack([rng.standard_normal(len(ir_t)), rng.standard_normal(len(ir_t))]) * np.exp(-ir_t * 3.2)
ir = lp(ir, 5000)
ir /= np.sqrt((ir ** 2).sum(axis=1, keepdims=True))
wet = np.stack([fftconvolve(send[0], ir[0])[:N], fftconvolve(send[1], ir[1])[:N]])
mixL = L + wet[0] * 0.5
mixR = R + wet[1] * 0.5
mix = np.stack([mixL, mixR])
mix = hp(mix, 25)
mix = np.tanh(mix * 1.1)
mix /= np.abs(mix).max() / 0.89
fade = int(0.05 * SR)
mix[:, -fade:] *= np.linspace(1, 0, fade)
mix[:, :64] *= np.linspace(0, 1, 64)

out = os.path.join(os.path.dirname(__file__), '..', 'dist', 'soundtrack.wav')
os.makedirs(os.path.dirname(out), exist_ok=True)
with wave.open(out, 'wb') as w:
    w.setnchannels(2)
    w.setsampwidth(2)
    w.setframerate(SR)
    w.writeframes((mix.T * 32767).astype('<i2').tobytes())
print('wrote', os.path.normpath(out), f'{DUR:.3f}s')
