#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Bygger appens offline-resurser: bilder, kartrutor, ikoner, data.js och assets.json.

Körs efter extract.js, som skrivit itinerary.json och cities.json.
Kartberäkningarna måste vara identiska med appens, annars begär appen rutor
som inte finns nedladdade.
"""
import json, math, os, time, urllib.request, io
from PIL import Image, ImageDraw

HERE = os.path.dirname(os.path.abspath(__file__))
APP = os.path.join(HERE, '..', 'app')
UA = 'Reseguide/1.0 (privat reseapp)'

days = json.load(open(os.path.join(HERE, 'itinerary.json'), encoding='utf-8'))
cities = json.load(open(os.path.join(HERE, 'cities.json'), encoding='utf-8'))


def get(url, tries=3):
    for i in range(tries):
        try:
            req = urllib.request.Request(url, headers={'User-Agent': UA})
            return urllib.request.urlopen(req, timeout=40).read()
        except Exception:
            if i == tries - 1:
                raise
            time.sleep(1.5)


# ---------- 1. Bilder ----------
os.makedirs(os.path.join(APP, 'img'), exist_ok=True)
imgs = {}
for d in days:
    for a in d['acts']:
        if a.get('img'):
            imgs[a['img']] = a['src']
for c in cities:
    imgs[c['img']] = c['src']

print(f'Bilder: {len(imgs)}')
for slug, src in sorted(imgs.items()):
    out = os.path.join(APP, 'img', slug + '.jpg')
    if os.path.exists(out):
        continue
    liten = slug.startswith('stad-')          # stadsbilder visas bara som miniatyrer
    bredd = 420 if liten else 1000
    raw = get('https://commons.wikimedia.org/wiki/Special:FilePath/' + src + f'?width={bredd}')
    im = Image.open(io.BytesIO(raw))
    if im.mode in ('RGBA', 'P', 'LA'):
        bg = Image.new('RGB', im.size, (255, 255, 255))
        im = im.convert('RGBA')
        bg.paste(im, mask=im.split()[-1])
        im = bg
    else:
        im = im.convert('RGB')
    im.thumbnail((420, 420) if liten else (900, 900), Image.LANCZOS)
    im.save(out, 'JPEG', quality=80, optimize=True)
    print('  ', slug, f'{os.path.getsize(out)//1024} kB')
    time.sleep(0.2)


# ---------- 2. Kartrutor ----------
Z, W, H = 15, 440, 260


def world_px(lat, lng, z):
    n = 2 ** z * 256
    lr = math.radians(lat)
    return ((lng + 180) / 360 * n,
            (1 - math.log(math.tan(lr) + 1 / math.cos(lr)) / math.pi) / 2 * n)


def tiles_for(lat, lng):
    n = 2 ** Z
    x, y = world_px(lat, lng, Z)
    left, top = x - W / 2, y - H / 2
    out = []
    for tx in range(math.floor(left / 256), math.floor((left + W) / 256) + 1):
        for ty in range(math.floor(top / 256), math.floor((top + H) / 256) + 1):
            if 0 <= ty < n:
                out.append((Z, ((tx % n) + n) % n, ty))
    return out


need = set()
for d in days:
    for a in d['acts']:
        if a.get('lat') is not None:
            need.update(tiles_for(a['lat'], a['lng']))

# Översiktskartan: ett fast utsnitt runt alla orter. Samma konstanter i appen.
RZ, RPAD, RASPECT = 7, 64, 0.88
pts = [world_px(c['lat'], c['lng'], RZ) for c in cities]
xs, ys = [p[0] for p in pts], [p[1] for p in pts]
vw = max(xs) - min(xs) + RPAD * 2
vh = vw * RASPECT
ox = min(xs) - RPAD
oy = (min(ys) + max(ys)) / 2 - vh / 2
for tx in range(math.floor(ox / 256), math.floor((ox + vw) / 256) + 1):
    for ty in range(math.floor(oy / 256), math.floor((oy + vh) / 256) + 1):
        need.add((RZ, tx, ty))
print(f'Ruttöversikt: zoom {RZ}, utsnitt {int(vw)}×{int(vh)} px')

print(f'Kartrutor: {len(need)}')
nya = 0
for z, x, y in sorted(need):
    p = os.path.join(APP, 'tiles', str(z), str(x))
    os.makedirs(p, exist_ok=True)
    f = os.path.join(p, f'{y}.png')
    if os.path.exists(f):
        continue
    open(f, 'wb').write(get(f'https://tile.openstreetmap.org/{z}/{x}/{y}.png'))
    nya += 1
    time.sleep(0.12)      # var snäll mot OSM:s servrar
print(f'  {nya} nya rutor hämtade')


# ---------- 3. Ikoner ----------
os.makedirs(os.path.join(APP, 'icons'), exist_ok=True)


def icon(size):
    """Enkel platsmarkör i appens färger. Byt motiv per resa."""
    im = Image.new('RGB', (size, size), '#123c3a')
    d = ImageDraw.Draw(im)
    s = size / 100.0
    acc = '#e07a5f'
    d.ellipse([30 * s, 22 * s, 70 * s, 62 * s], fill=acc)
    d.polygon([(38 * s, 55 * s), (62 * s, 55 * s), (50 * s, 82 * s)], fill=acc)
    d.ellipse([43 * s, 35 * s, 57 * s, 49 * s], fill='#123c3a')
    return im


for sz in (180, 192, 512):
    icon(sz).save(os.path.join(APP, 'icons', f'icon-{sz}.png'), 'PNG')
print('Ikoner: 180, 192, 512')


# ---------- 4. data.js ----------
for d in days:
    for a in d['acts']:
        a.pop('src', None)
for c in cities:
    c.pop('src', None)
open(os.path.join(APP, 'data.js'), 'w', encoding='utf-8').write(
    'window.DAYS=' + json.dumps(days, ensure_ascii=False, separators=(',', ':')) + ';\n' +
    'window.CITIES=' + json.dumps(cities, ensure_ascii=False, separators=(',', ':')) + ';\n')
print('data.js skriven')


# ---------- 5. assets.json (förhandscachningslista för service workern) ----------
assets = ['./', './index.html', './app.js', './data.js', './manifest.webmanifest',
          './icons/icon-180.png', './icons/icon-192.png', './icons/icon-512.png']
for slug in sorted(imgs):
    assets.append(f'./img/{slug}.jpg')
for z, x, y in sorted(need):
    assets.append(f'./tiles/{z}/{x}/{y}.png')
json.dump(assets, open(os.path.join(APP, 'assets.json'), 'w'), indent=0)

total = sum(os.path.getsize(os.path.join(APP, a[2:])) for a in assets
            if os.path.exists(os.path.join(APP, a[2:])))
print(f'assets.json: {len(assets)} filer, {total / 1e6:.1f} MB offline')
