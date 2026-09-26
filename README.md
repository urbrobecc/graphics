# Claude / Motion Reel 2026

A 15 second, 1080p60 motion graphics showreel, built entirely in code.

![poster](dist/poster.jpg)

**Watch:** [`dist/showreel.mp4`](dist/showreel.mp4)

## What's in it

The piece is locked to a 128 BPM grid. 32 beats at 128 BPM is exactly 15.0 seconds, so every cut, wipe and hit lands on the music, and the music is generated from the same grid.

| Bar | Time | Section | Techniques |
| --- | --- | --- | --- |
| 1 | 0.00 | Ignition | dot to line to title, masked type reveals, slab wipe |
| 2 | 1.88 | Kinetic type | four words, four techniques: overshoot drop, echo repeater, sliced text, handwritten serif reveal, diagonal slab wipes |
| 3 | 3.75 | Shape layers | path morphing (circle, square, triangle, star), echo trails, radial repeater, orbiters, shockwaves, AE style selection box |
| 4 | 5.63 | Particle systems | 4k particle burst, swirl, assembly into type, scanline shimmer |
| 5 | 7.50 | 3D space | the same particles as a point cloud morphing sphere to torus to wave terrain, synthwave floor, orbit rings |
| 6 | 9.38 | Liquid FX | metaballs via blur and alpha threshold, living gradient, parallax type, bubbles |
| 7 | 11.25 | Character + UI | iris transition into a 3x3 wall: squash and stretch, data viz, UI states, waveforms, pendulum wave, charts, offset animation, live easing code, dot matrix |
| 8 | 13.13 | Signature | end card with difference blended type, rotating badge, then everything folds back into the opening dot |

Finishing passes: real motion blur (4 temporal samples across a 180 degree shutter), bloom, chromatic aberration and camera shake on hits, film grain, vignette, and a live HUD with timecode, section labels and a beat meter.

## Files

* `src/reel.js` is the whole animation. Every frame is a pure function of time.
* `index.html` is an interactive preview (play, pause, scrub, with sound).
* `audio/synth.py` synthesizes the soundtrack (kick, clap, hats, bass, pads, arps, risers, impacts, reverb) with numpy and scipy.
* `render/render.mjs` renders every frame in headless Chromium and encodes with ffmpeg.

## Rebuild

```sh
pip install numpy scipy
python3 audio/synth.py                 # dist/soundtrack.wav
node render/render.mjs                 # dist/showreel.mp4 (needs playwright + ffmpeg)
node render/render.mjs --stills 0,450  # single frames to dist/stills
```

To preview, serve the folder (`npx serve .`) and open `index.html`.
