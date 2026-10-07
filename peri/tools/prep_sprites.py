"""Cuts the character art into animatable sprites.

  python3 peri/tools/prep_sprites.py

Reads  peri/assets/source.png  (character on a black background)
Writes peri/assets/<variant>_{base,top,mid}.png and peri/assets/sprites.json

Parts
  base  body + socket ring + lower pipe, with the painted face removed
  top   upper elbow and lens (moves up when the periscope extends)
  mid   a thin slice of straight pipe that gets stretched to any length
Friends are hue shifted copies of the same parts.
"""
import json, os, colorsys
import numpy as np
from PIL import Image
from scipy import ndimage as ndi

HERE = os.path.dirname(os.path.abspath(__file__))
A = os.path.join(HERE, '..', 'assets')
src = np.array(Image.open(os.path.join(A, 'source.png')).convert('RGB')).astype(np.float32)
H, W, _ = src.shape
mx = src.max(2)

# ---- matte -----------------------------------------------------------------
solid = ndi.binary_fill_holes(mx > 26)
solid = ndi.binary_opening(solid, structure=np.ones((3, 3)), iterations=2)
lab0, n0 = ndi.label(solid)
sizes = ndi.sum(solid, lab0, range(1, n0 + 1))
solid = np.isin(lab0, 1 + np.nonzero(sizes > 2000)[0])
solid = ndi.binary_fill_holes(solid)
inner = ndi.binary_erosion(solid, iterations=3)
soft = ndi.gaussian_filter(ndi.binary_erosion(solid, iterations=1).astype(np.float32), 1.7)
u = np.clip((soft - 0.3) / 0.4, 0, 1)
alpha = u * u * (3 - 2 * u)
alpha[inner] = 1.0
# edge colour: borrow from the nearest inner pixel so there is no dark fringe
_, (iy, ix) = ndi.distance_transform_edt(~inner, return_indices=True)
rgb = src.copy()
edge = ~inner
rgb[edge] = src[iy[edge], ix[edge]]

# ---- face: measure then erase ------------------------------------------------
face_box = (560, 590, 800, 775)  # x0,y0,x1,y1, stops short of the socket ring
x0, y0, x1, y1 = face_box
lum = src.max(2)
dark = np.zeros((H, W), bool)
dark[y0:y1, x0:x1] = lum[y0:y1, x0:x1] < 150
dark &= inner
lab, n = ndi.label(dark)
parts = []
for i in range(1, n + 1):
    ys, xs = np.nonzero(lab == i)
    if len(ys) < 60: continue
    parts.append(dict(id=i, n=len(ys), cx=float(xs.mean()), cy=float(ys.mean()),
                      x0=int(xs.min()), x1=int(xs.max()), y0=int(ys.min()), y1=int(ys.max())))
parts.sort(key=lambda p: p['cx'])
print('face parts', json.dumps(parts, indent=1))
# highlights inside the eyes
face = {}
for name, p in zip(['eyeL', 'mouth', 'eyeR'], parts):
    m = lab == p['id']
    filled = ndi.binary_fill_holes(m)
    hl = filled & ~m
    hlab, hn = ndi.label(hl)
    hls = []
    for j in range(1, hn + 1):
        ys, xs = np.nonzero(hlab == j)
        if len(ys) > 6: hls.append(dict(cx=float(xs.mean()), cy=float(ys.mean()), r=float(np.sqrt(len(ys) / np.pi))))
    ys, xs = np.nonzero(filled)
    cov = np.cov(np.vstack([xs, ys]))
    ev, evec = np.linalg.eigh(cov)
    ang = float(np.degrees(np.arctan2(evec[1, 1], evec[0, 1])))
    face[name] = dict(cx=float(xs.mean()), cy=float(ys.mean()), w=float(xs.max() - xs.min() + 1), h=float(ys.max() - ys.min() + 1),
                      rx=float(2 * np.sqrt(ev[1])), ry=float(2 * np.sqrt(ev[0])), ang=ang, hl=hls)
    p['mask'] = filled
print(json.dumps(face, indent=1))

mask = np.zeros((H, W), bool)
for p in parts: mask |= ndi.binary_dilation(p['mask'], iterations=5)
import cv2
m8 = (mask * 255).astype(np.uint8)
rgb = cv2.inpaint(np.clip(rgb, 0, 255).astype(np.uint8), m8, 9, cv2.INPAINT_TELEA).astype(np.float32)
# soften the repaired patch so no texture seam is left behind
blur = cv2.GaussianBlur(rgb, (0, 0), 6)
soft = cv2.GaussianBlur(m8.astype(np.float32) / 255, (0, 0), 3)[..., None]
rgb = rgb * (1 - soft) + blur * soft
rgb = np.clip(rgb, 0, 255)

# ---- parts ---------------------------------------------------------------------
def crop(img_rgb, a, box, name, out_rgb_only=False):
    x0, y0, x1, y1 = box
    out = np.dstack([img_rgb[y0:y1, x0:x1], a[y0:y1, x0:x1] * 255]).astype(np.uint8)
    Image.fromarray(out, 'RGBA').save(os.path.join(A, name))

# bounds of everything
ys, xs = np.nonzero(solid)
BOX = (int(xs.min()) - 4, int(ys.min()) - 4, int(xs.max()) + 5, int(ys.max()) + 5)
CUT_X, TOP_Y, MID0, MID1 = 880, 400, 440, 480
print('bounds', BOX)

def variant(name, hue_deg, sat_mul, val_mul=1.0):
    img = rgb.copy()
    if hue_deg is not None:
        flat = img.reshape(-1, 3) / 255.0
        mxc = flat.max(1); mnc = flat.min(1)
        s = np.where(mxc > 0, (mxc - mnc) / np.maximum(mxc, 1e-6), 0)
        greenish = (s > 0.04) & (mxc > 0.45)  # skin, not the black rings
        h = np.zeros(len(flat)); 
        idx = np.nonzero(greenish)[0]
        hs = np.array([colorsys.rgb_to_hsv(*flat[i])[0] for i in idx]) if False else None
        # vectorised rgb->hsv for the selected pixels
        r, g, b = flat[idx].T
        mxv = flat[idx].max(1); d = mxv - flat[idx].min(1) + 1e-9
        hh = np.where(mxv == r, ((g - b) / d) % 6, np.where(mxv == g, (b - r) / d + 2, (r - g) / d + 4)) / 6.0
        ss = np.clip(d / (mxv + 1e-9) * sat_mul, 0, 1)
        vv = np.clip(mxv * val_mul, 0, 1)
        hh = (hh + hue_deg / 360.0) % 1.0
        i6 = (hh * 6).astype(int) % 6; f = hh * 6 - np.floor(hh * 6)
        p = vv * (1 - ss); q = vv * (1 - f * ss); t = vv * (1 - (1 - f) * ss)
        sel = [np.stack(c, 1) for c in [(vv, t, p), (q, vv, p), (p, vv, t), (p, q, vv), (t, p, vv), (vv, p, q)]]
        out = np.zeros((len(idx), 3))
        for k in range(6):
            m = i6 == k
            out[m] = sel[k][m]
        flat[idx] = out
        img = (flat.reshape(H, W, 3) * 255)
    # base: remove the periscope above the cut
    a_base = alpha.copy(); a_base[:560, CUT_X:] = 0
    crop(img, a_base, BOX, f'{name}_base.png')
    a_top = alpha.copy(); a_top[:, :CUT_X] = 0; a_top[TOP_Y:, :] = 0
    tx0, ty0, tx1, ty1 = 900, BOX[1], BOX[2], TOP_Y
    crop(img, a_top, (tx0, ty0, tx1, ty1), f'{name}_top.png')
    # mid: slice of straight pipe
    a_mid = alpha.copy()
    mx0, mx1 = 920, 1040
    crop(img, a_mid, (mx0, MID0, mx1, MID1), f'{name}_mid.png')
    return dict(top=[tx0, ty0, tx1, ty1], mid=[mx0, MID0, mx1, MID1])

VARIANTS = {'mint': (None, 1, 1), 'rose': (212, 1.25, 1.0), 'sky': (92, 1.45, 1.0), 'lemon': (-62, 1.5, 1.0),
            'lilac': (150, 1.25, 1.0), 'peach': (-95, 1.35, 1.0)}
info = {}
for k, (h, s, v) in VARIANTS.items():
    info = variant(k, h, s, v)
meta = dict(box=list(BOX), face=face, cut=dict(x=CUT_X, topY=TOP_Y, midY0=MID0, midY1=MID1, baseCutY=560), parts=info,
            socket=[842, 665], variants=list(VARIANTS))
json.dump(meta, open(os.path.join(A, 'sprites.json'), 'w'), indent=1)

# preview sheet
sheet = Image.new('RGB', (BOX[2] - BOX[0], (BOX[3] - BOX[1])), (200, 220, 235))
print('done')
