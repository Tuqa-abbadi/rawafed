#!/usr/bin/env python3
"""
Rawafed — generate the 16 prototype assets (17 models) with the Meshy API and save them
into the project's assets/ folders.

Usage (from the project root, Python 3.9+, no extra packages needed):
    1) Put your key in .env :   MESHY_API_KEY=msy_xxxxxxxx
    2) keep the reference crops in refs/ (they drive image-to-3D for the hero buildings + reciter)
    3) python meshy_generate.py            # generate everything
       python meshy_generate.py --dry-run  # list what will be generated
       python meshy_generate.py --only reciters library   # just some items

Re-running is safe: files that already exist are skipped.
Output:  assets/<folder>/<name>_v<n>.glb  (+ a .png thumbnail next to each)
Log:     assets/meshy_tasks.json
"""
import argparse, base64, json, os, sys, threading, time, urllib.request, urllib.error
from concurrent.futures import ThreadPoolExecutor, as_completed

API = "https://api.meshy.ai/openapi"
NO_BASE = ", no base, no ground"

# name, folder, variants, polycount, prompt, optional reference image (image-to-3D)
JOBS = [
    # ---------- hero buildings: built from YOUR reference images (refs/) ----------
    ("reciters", "buildings", 2, 80000,
     "Monumental white Islamic palace with large central dome, tall pointed golden-lit arch entrance, ivory carved stone facade" + NO_BASE + ", building only",
     "refs/reciters.jpg"),
    ("library", "buildings", 1, 80000,
     "Futuristic Arabic library, golden geometric lattice glass dome over sweeping white stone arches" + NO_BASE + ", building only",
     "refs/library.png"),
    ("learning", "buildings", 1, 80000,
     "Modern Arabic learning center with wave-shaped roof and golden mashrabiya facade, glass walls" + NO_BASE + ", building only",
     "refs/learning.png"),
    ("community", "buildings", 1, 80000,
     "Islamic courtyard complex surrounded by white arched colonnades, small domes at the corners, central garden and fountain" + NO_BASE + ", building only",
     "refs/community.jpg"),
    # ---------- repeatable filler buildings (copied many times around the island) ----------
    ("domed_hall", "buildings", 1, 30000,
     "White Islamic hall with one large central dome and smaller corner domes, arched windows" + NO_BASE + ", building only",
     "refs/domed_hall.jpg"),
    ("pavilion_small", "buildings", 1, 15000,
     "Small white Islamic pavilion with three domes and arched openings" + NO_BASE + ", building only",
     "refs/pavilion_small.jpg"),
    ("gateway", "buildings", 1, 40000,
     "Monumental modern Arabic gateway, giant pointed arch frame, tall carved ivory stone pillars with golden mashrabiya lattice panels, Dubai luxury architecture, ivory and gold" + NO_BASE + ", no floor, gateway structure only", None),
    # ---------- reciter: one body, heads swapped later ----------
    ("reciter", "characters", 1, 40000,
     "Arab man seated cross-legged reading an open Quran, white thobe, black bisht with gold trim, white shemagh with black agal, grey beard" + NO_BASE + ", character only",
     "refs/reciter.jpg"),
    ("head_2", "characters", 1, 10000,
     "Head and shoulders of an Arab man wearing white shemagh and black agal, short black beard, calm expression, facing forward, realistic, no base", None),
    ("head_3", "characters", 1, 10000,
     "Head and shoulders of a young Arab man wearing white shemagh and black agal, light brown short beard, calm expression, facing forward, realistic, no base", None),
    # ---------- skyline: 2 towers, repeated 40-60 times in code ----------
    ("tower_landmark", "skyline", 1, 15000,
     "Iconic supertall modern skyscraper, slender stepped tapering form, glass and silver metal facade, tall spire at the top, Gulf futuristic architecture" + NO_BASE + ", building only", None),
    ("tower_glass", "skyline", 1, 6000,
     "Modern glass skyscraper, slightly twisting tower form, reflective silver-blue glass curtain wall, Dubai style, simple clean geometry, game-ready" + NO_BASE, None),
    # ---------- props: each one repeated many times ----------
    ("palm", "props", 1, 4000,
     "Tall date palm tree, realistic trunk texture, lush green fronds, low poly game-ready" + NO_BASE + ", no pot", None),
    ("lantern", "props", 1, 3000,
     "Ornate Arabic brass lantern with geometric cut-out patterns, warm glowing light inside, game-ready, no base, no chain", None),
    ("rehal", "props", 1, 5000,
     "Wooden Quran stand rehal, X-shaped folding carved wood with Islamic geometric engraving, holding an open book, game-ready, no base", None),
    # ---------- reciters hall ----------
    ("hall_arch", "hall", 1, 30000,
     "Interior wall of an Arabic reading hall, one large pointed arch opening in the center, carved ivory marble with golden geometric mashrabiya panels on both sides, elegant and calm, wall section only, no floor, no base", None),
]

LOCK = threading.Lock()
LOG_PATH = os.path.join("assets", "meshy_tasks.json")


def load_key():
    key = os.environ.get("MESHY_API_KEY")
    if not key and os.path.exists(".env"):
        for line in open(".env", encoding="utf-8"):
            if line.strip().startswith("MESHY_API_KEY="):
                key = line.split("=", 1)[1].strip().strip('"').strip("'")
    if not key:
        sys.exit("MESHY_API_KEY not found. Add it to .env as MESHY_API_KEY=... ")
    return key


def req(method, path, key, body=None, retries=5):
    url = path if path.startswith("http") else API + path
    data = json.dumps(body).encode() if body is not None else None
    for attempt in range(retries):
        r = urllib.request.Request(url, data=data, method=method,
                                   headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"})
        try:
            with urllib.request.urlopen(r, timeout=60) as resp:
                return json.loads(resp.read().decode())
        except urllib.error.HTTPError as e:
            msg = e.read().decode(errors="ignore")
            if e.code == 429 or e.code >= 500:          # rate limit / server: wait and retry
                time.sleep(10 * (attempt + 1)); continue
            raise RuntimeError(f"HTTP {e.code} on {path}: {msg}")
        except urllib.error.URLError:
            time.sleep(5 * (attempt + 1))
    raise RuntimeError(f"Failed after {retries} tries: {path}")


def poll(kind, task_id, key, label):
    last = -1
    while True:
        t = req("GET", f"{kind}/{task_id}", key)
        st, pr = t.get("status"), t.get("progress", 0)
        if pr != last and pr % 20 == 0:
            print(f"  [{label}] {st} {pr}%", flush=True); last = pr
        if st == "SUCCEEDED":
            return t
        if st in ("FAILED", "CANCELED"):
            raise RuntimeError(f"[{label}] {st}: {t.get('task_error')}")
        time.sleep(8)


def download(url, path):
    with urllib.request.urlopen(url, timeout=300) as r, open(path, "wb") as f:
        while True:
            chunk = r.read(1 << 20)
            if not chunk: break
            f.write(chunk)


def log(entry):
    with LOCK:
        data = json.load(open(LOG_PATH)) if os.path.exists(LOG_PATH) else []
        data.append(entry)
        json.dump(data, open(LOG_PATH, "w"), indent=2, ensure_ascii=False)


def run_one(job, variant, key):
    name, folder, _, poly, prompt, image = job
    os.makedirs(os.path.join("assets", folder), exist_ok=True)
    out = os.path.join("assets", folder, f"{name}_v{variant}.glb")
    label = f"{name}_v{variant}"
    if os.path.exists(out):
        return f"skip {out} (exists)", 0
    credits = 0
    if image and os.path.exists(image):
        ext = os.path.splitext(image)[1].lstrip(".").lower().replace("jpg", "jpeg")
        uri = f"data:image/{ext};base64," + base64.b64encode(open(image, "rb").read()).decode()
        tid = req("POST", "/v1/image-to-3d", key, {
            "image_url": uri, "should_remesh": True, "target_polycount": poly,
            "should_texture": True, "enable_pbr": True, "target_formats": ["glb"]})["result"]
        print(f"[{label}] image-to-3D task {tid}", flush=True)
        t = poll("/v1/image-to-3d", tid, key, label)
        credits += t.get("consumed_credits", 0) or 0
    else:
        pid = req("POST", "/v2/text-to-3d", key, {
            "mode": "preview", "prompt": prompt[:800], "should_remesh": True,
            "target_polycount": poly, "target_formats": ["glb"]})["result"]
        print(f"[{label}] preview task {pid}", flush=True)
        p = poll("/v2/text-to-3d", pid, key, label + " preview")
        credits += p.get("consumed_credits", 0) or 0
        rid = req("POST", "/v2/text-to-3d", key, {
            "mode": "refine", "preview_task_id": pid, "enable_pbr": True,
            "target_formats": ["glb"]})["result"]
        print(f"[{label}] refine task {rid}", flush=True)
        t = poll("/v2/text-to-3d", rid, key, label + " texture")
        credits += t.get("consumed_credits", 0) or 0
    glb = (t.get("model_urls") or {}).get("glb")
    if not glb:
        raise RuntimeError(f"[{label}] no GLB in result")
    download(glb, out)
    if t.get("thumbnail_url"):
        try: download(t["thumbnail_url"], out.replace(".glb", ".png"))
        except Exception: pass
    log({"name": label, "file": out, "task_id": t.get("id"), "credits": credits, "prompt": prompt})
    return f"saved {out}", credits


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--only", nargs="*", help="names to generate, e.g. reciters library")
    ap.add_argument("--workers", type=int, default=8, help="parallel tasks (Pro: up to 10, Premium: up to 30)")
    a = ap.parse_args()
    jobs = [j for j in JOBS if not a.only or j[0] in a.only]
    tasks = [(j, v) for j in jobs for v in range(1, j[2] + 1)]
    print(f"{len(tasks)} models to generate:")
    for j, v in tasks:
        src = "image" if (j[5] and os.path.exists(j[5])) else "text"
        print(f"  assets/{j[1]}/{j[0]}_v{v}.glb  ({src}, {j[3]} tris)")
    if a.dry_run:
        return
    key = load_key()
    os.makedirs("assets", exist_ok=True)
    total, failed = 0, []
    with ThreadPoolExecutor(max_workers=a.workers) as ex:
        futs = {ex.submit(run_one, j, v, key): f"{j[0]}_v{v}" for j, v in tasks}
        for f in as_completed(futs):
            try:
                msg, c = f.result(); total += c; print(msg, flush=True)
            except Exception as e:
                failed.append(futs[f]); print(f"FAILED {futs[f]}: {e}", flush=True)
    print(f"\nDone. Credits used: {total}. Failed: {failed or 'none'}")
    if failed:
        print("Re-run the same command to retry only the failed ones.")


if __name__ == "__main__":
    main()
