# Peri launch film

A 32 second, 1080p24 launch film starring the periscope blob, built in code like the showreel next door.

**Watch:** [`dist/peri.mp4`](dist/peri.mp4)

![poster](dist/poster.jpg)

## The story

Peri lives alone in a quiet pastel world and spots things through its periscope. A lens montage (sunrise, rain, harbor, night market) settles on a night market. Peri gets pinged, pushes in, finds a few things worth saving, and taps save. Then five friends drop in and the line lands: good finds are better together. It ends on a waitlist screen and the logo lockup, with the same four note motif as the opening.

| Time | Beat |
| --- | --- |
| 0.0 | Wordmark spells itself, the dot of the i grows into a lens |
| 1.6 | Lens montage, four small illustrated worlds |
| 8.0 | Peri drops in, the lens floats off as an orb and pings |
| 10.6 | Camera pushes in, cards appear in Peri's line of sight, save and confetti |
| 17.2 | Dolly into the face, eyes dart, check badge, joy |
| 21.0 | Pull back, five friends arrive, tagline |
| 27.5 | Waitlist screen, iris closes on the logo |

## How it works

* `tools/prep_sprites.py` cuts the supplied character art into a body, a stretchable periscope and recolored friends. The face is removed from the art and redrawn as vectors, so the eyes can blink, dart and stay sharp in close ups.
* `src/` is the whole animation. Every frame is a pure function of time (`core.js` helpers, `peri.js` character rig, `scenes.js` the lens worlds, `ui.js` cards and phone, `film.js` the timeline and camera).
* `audio/synth.py` synthesizes the soundtrack on the same 120 BPM grid, with effects placed on the on screen beats.
* `render.mjs` renders every frame in headless Chromium with temporal motion blur and encodes with ffmpeg.

## Rebuild

```sh
pip install numpy scipy pillow opencv-python-headless
python3 peri/tools/prep_sprites.py      # only if the art changes
python3 peri/audio/synth.py             # peri/dist/soundtrack.wav
node peri/render.mjs                    # peri/dist/peri.mp4 (needs playwright + ffmpeg)
node peri/render.mjs --stills 0,300     # single frames to peri/dist/stills
```

To preview with sound, serve the repo root (`npx serve .`) and open `peri/index.html`.
