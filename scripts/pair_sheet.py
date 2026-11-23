"""ORIGINAL | NEW side by side for the map-camera renders (+ 2x crop of the centre).
Usage: python scripts/pair_sheet.py <name> -> screens/compare/full_<name>_map.jpg"""
import sys, json
from PIL import Image, ImageDraw, ImageFont
n = sys.argv[1]
rep = json.load(open('build/full_report.json')).get(n, {})
a = Image.open(f'build/cmp/map_{n}_orig.png').convert('RGB'); b = Image.open(f'build/cmp/map_{n}_full.png').convert('RGB')
W, H = 800, 600
crop = (300, 220, 660, 490)
CH = int(W * (crop[3] - crop[1]) / (crop[2] - crop[0]))
s = Image.new('RGB', (W * 2, 34 + H + CH), (30, 23, 18)); d = ImageDraw.Draw(s)
try: f = ImageFont.truetype('arial.ttf', 18)
except Exception: f = ImageFont.load_default()
for i, (im, label) in enumerate([(a, f"ORIGINAL Meshy  {rep.get('before', 0):,} tris, 4k maps"), (b, f"NEW export  {rep.get('after', 0):,} tris, {rep.get('tex')} maps, {rep.get('mb')} MB")]):
    s.paste(im.resize((W, H)), (i * W, 34)); s.paste(im.crop(crop).resize((W, CH)), (i * W, 34 + H))
    d.text((i * W + 10, 8), label, fill=(235, 197, 122), font=f)
s.save(f'screens/compare/full_{n}_map.jpg', quality=90); print('wrote', f'screens/compare/full_{n}_map.jpg')
