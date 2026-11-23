"""Side-by-side comparison: site screenshot (left) vs video frame (right) -> screens/compare/<name>.jpg
Usage: python scripts/compare.py <name> <site.png> <video_frame.jpg> [note]"""
import os, sys
from PIL import Image, ImageDraw, ImageFont

name, site, frame = sys.argv[1], sys.argv[2], sys.argv[3]
note = sys.argv[4] if len(sys.argv) > 4 else ""
W, H, BAR = 960, 540, 34
out = Image.new("RGB", (W * 2 + 8, H + BAR), (30, 23, 18))
for i, (path, label) in enumerate([(site, "SITE  " + os.path.basename(site)), (frame, "VIDEO  " + os.path.basename(frame))]):
    im = Image.open(path).convert("RGB")
    # cover-fit to 16:9
    s = max(W / im.width, H / im.height)
    im = im.resize((round(im.width * s), round(im.height * s)), Image.LANCZOS)
    l, t = (im.width - W) // 2, (im.height - H) // 2
    out.paste(im.crop((l, t, l + W, t + H)), (i * (W + 8), BAR))
    ImageDraw.Draw(out).text((i * (W + 8) + 10, 10), label, fill=(235, 197, 122))
if note:
    ImageDraw.Draw(out).text((W - 200, 10), note, fill=(250, 245, 236))
os.makedirs("screens/compare", exist_ok=True)
dst = os.path.join("screens/compare", name + ".jpg")
out.save(dst, quality=88)
print("wrote", dst)
