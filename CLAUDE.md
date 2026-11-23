# Rawafed (روافد) — Interactive 3D Prototype

## Goal
A real, browser-based 3D prototype (NOT a video) to show the client tomorrow.
1. Scroll-driven landing story (see "Hero"): the walker stands in the gateway; scrolling walks him out along the shore colonnade and the camera rises into the aerial map.
2. The map: a 3D city with 4 clickable buildings; from here everything is click-driven.
3. Clicking a building plays a **predefined, animated cinematic camera transition** to that building (no free roaming).
4. **القرّاء is the hero flow:** the camera flies to the reciters building and continues INSIDE into a 3D reciters hall, where an **animated 3D reciter** sits facing the visitor with a Quran on a stand (رحل).
5. "العودة إلى المدينة" flies back to the map.

Visual target: warm golden-hour, ivory stone, gold accents, reflective water, modern Arabic architecture. Match the reference images in `refs/`.
**Primary reference: `refs/rawafed plan3-Bahr.mp4`** — match its scenes, order, camera moves, composition, colours and light as closely as possible. Frames every 2 s: `refs/video_frames/tNNNs.jpg`. At the end of every stage, put site screenshots side by side with the matching frames in `screens/compare/` (`python scripts/compare.py`), list differences, fix the biggest.
Quality bar: clean, cohesive and smooth. It does not need to match the AI videos exactly.

## Stack
- Next.js (App Router) + TypeScript. The 3D canvas is a client component loaded with `dynamic(..., { ssr: false })`; models load from `public/models/`.
- three, @react-three/fiber, @react-three/drei, @react-three/postprocessing
- gsap for all camera flights and UI animation
- lenis only for scrolling inside side panels / text pages (the 3D journey is click-driven, not scroll-driven)
- Blender: headless scripts (`blender -b -P scripts/<name>.py`) for the repeatable pipeline (decimate, clean, export); Blender MCP (blender-mcp) for live inspection, quick fixes and checking models visually
- gltf-transform CLI for compression (meshopt + 1k webp textures)

## Folders
```
refs/                 reference stills from the concept videos (read-only)
assets/buildings/     Meshy .glb hero + filler buildings, gateway, minaret, bridge, pergola, arcade bay
assets/hall/          reciters-hall pieces (hall arch wall)
assets/skyline/       Meshy .glb towers for the far skyline (instance with random scale/rotation)
assets/sea/           Meshy .glb boats (dhow, yacht) — animate a slow drift + bob in code
assets/props/         palms, olive tree, lanterns, fountain, rehal
assets/interiors/     majlis set, bookshelf, reading desk, classroom desk + tablets
assets/characters/    reciters (seated) and walker (rigged, has walk/run clips)
assets/hdri/          Poly Haven sunset HDRI
assets/textures/      Poly Haven marble / sandstone (2k)
scripts/              Blender Python scripts you write
public/models/        exported, compressed .glb files used by the site
src/                  website code
CREDITS.md            asset name, author, license, URL (keep updated)
```
Never edit files in `assets/` or `refs/`. Write all outputs to `public/models/`.

## Brand palette
| Use | Hex |
|---|---|
| Gold (primary) | #C9963F |
| Light gold (glow, edges) | #EBC57A |
| Sunset orange | #D9823F |
| Building stone | #EFE5D3 |
| Ivory (UI text; loading-screen background only) | #FAF5EC |
| Dark (text, night) | #1E1712 |
| Water | #2F7D80 |
Font: Alexandria (Google Fonts). All UI is Arabic-first, `dir="rtl"`.

## UI style (match the video: dark translucent glass everywhere)
- All UI over the 3D scene — side panels, reciter audio player, building cards, map labels/pills, buttons — is **dark glass**:
  warm dark tint `#1E1712` at 55–65% opacity + `backdrop-filter: blur(~20px)`, 1px light-gold border `#EBC57A` at ~25%,
  rounded corners, soft shadow.
- Text ivory `#FAF5EC`; titles, active states, buttons and icons gold `#C9963F`. Alexandria, RTL.
- Ivory backgrounds are used **only** for the loading screen (with the gold logo). No ivory panels anywhere else.
- Logo: `public/logo.svg` (white artwork) tinted via CSS mask — gold on ivory, white or gold over the scene.

## Asset files (already downloaded, exact names)
- buildings/: reciters.glb, community.glb, library.glb, learning.glb (wavy gold mashrabiya facade), courtyard_complex.glb (square courtyard + fountain), domed_hall.glb, pavilion_small.glb, gateway_portal.glb, gateway_interior.glb, minaret.glb, bridge.glb, pergola.glb, arcade_bay.glb
- hall/: hall_arch_wall.glb
- skyline/: tower_supertall.glb, tower_twist.glb, tower_slim.glb, tower_stepped.glb, tower_twin.glb, tower_residential.glb
- sea/: dhow.glb, yacht.glb
- props/: palm.glb, olive_tree.glb, lantern.glb, fountain.glb, rehal.glb
- interiors/: majlis.glb, bookshelf.glb, reading_desk.glb, class_desk.glb
- characters/: walker_rigged.glb (rigged, walk/run clips inside), reciter_old.glb, reciter_young.glb (seated, with rehal + Quran)
If a file name differs slightly, list assets/ and match by meaning — ask me if unsure.
Known clean-up: learning.glb has small baked-in people figures in front — remove them. courtyard_complex.glb has its own grass base — trim it to the building footprint.

## Scene layout (world units ≈ meters) — mirror the map frames in refs/
Island on the water with a palm-lined promenade, lush gardens, paths and reflecting pools; skyline across the water.
- Island centred at (0, 0, -80), about 180 × 130, garden ground + marble paths (Poly Haven textures), rock edge to the water.
- Water all around (reflective, animated, #2F7D80 tint). Skyline across the bay at z ≈ -300 to -450.
- Hero buildings (scale so heights look like the reference; القرّاء is clearly the biggest):
  - القرّاء `reciters.glb` — centre-back (0, 0, -100), long reflecting pool + fountains in front of it toward the camera.
  - التعليم `courtyard_complex.glb` — left (-58, 0, -80), rotated ≈ +0.35 rad toward centre; `learning.glb` sits at its shore side as the modern entrance pavilion (the transition ends at learning.glb's facade).
  - المجتمع `community.glb` — right (55, 0, -72), rotated ≈ -0.35 rad, round plaza with `fountain.glb` in front.
  - المكتبة `library.glb` — front-left (-30, 0, -40).
- Repeat, don't regenerate (instancing, random rotation ±15°, scale 0.8–1.2):
  - `domed_hall.glb` ×2, `pavilion_small.glb` ×3–4, `minaret.glb` ×2, `pergola.glb` ×4, `bridge.glb` over canals ×3.
  - `palm.glb` 80–150 copies (promenade ring, paths, pools); `olive_tree.glb` ×10 near entrances.
  - `lantern.glb` 30–50 copies along paths (emissive glow, few real point lights near the camera).
  - Skyline: `tower_supertall.glb` ×1 (landmark), the other 5 towers mixed ×40–60 at different heights.
  - Sea: `dhow.glb` ×4–6 and `yacht.glb` ×3, slow drift + gentle bob/roll in code.
- Code-made (no Meshy): water, ground, paths, pools, fountain water, grass, rock edge, sky (HDRI), library hologram pillar, classroom screens.

## Hero — scroll-driven landing story (Lenis + GSAP ScrollTrigger, scrubbed, reversible)
Code: `src/lib/story.ts` (all poses as a pure function of scroll progress p), `src/components/StoryScroll.tsx`, `src/scene/hero/*`.
- p = 0 (on load): camera inside `gateway_interior.glb` looking through the arch to the sea and skyline at sunset; the walker (`walker_rigged.glb`) STANDS still inside the gateway facing the sea (standing pose = the walk clip's passing frame; there is no idle clip). Logo + "من منابع القرآن… إلى آفاق جديدة" + subtitle + a small scroll hint ("مرّر لتدخل المدينة"). Nothing moves except light ambience (water, sun).
- Scrolling drives everything: the walker walks forward (walk-clip time = distance walked, so he stops when the scroll stops and walks back when it reverses), the camera follows behind him.
- He turns left at the terrace edge and walks the shore colonnade: `arcade_bay.glb` ×11 in a row on a stone pier west of the gateway, each arch turned to face the direction of travel, the sea and the city glimpsed between the columns, the island on the other side.
- Past the last arch the camera rises, turns to the bay and skyline, and cranes back over the island into the exact aerial map pose; the walker fades out; the map UI (labels, top nav, map title) fades in → click-driven from here.
- Scrolling back up reverses the journey while still in the story. Once the map takes over, the scroll story is switched off (page scroll locked, progress frozen) so only the click flights drive the camera; الرئيسية (top nav) rewinds to p = 0 and re-enables it. "تخطي" (skip) jumps straight to the map. The walker stops under the last arch; the rise to the city starts there.
- Page scroll is paused while visiting a building. Debug: `?story=0..1` pins the progress.

## Map + predefined transitions
- Aerial camera ≈ position (0, 112, 46), target (0, 0, -90).
- 4 HTML labels anchored above buildings (drei `<Html>`), hover/focus = highlight building (emissive gold) + short description card.
- Click a label OR the building → a fixed camera path (CatmullRom spline, 3–4 s, eased) to that building's entrance view → show a dark-glass side panel (see UI style): name, one line, CTA.
- "العودة إلى المدينة" → reverse path back to the aerial view. Esc does the same.
- No OrbitControls, no free camera.
- Small interior vignettes after arriving (later step): library = `bookshelf.glb` ring + `reading_desk.glb` + hologram pillar; learning = rows of `class_desk.glb` + screen; community = `majlis.glb` under arches.

## Reciters hall + animated reciters (priority)
- Transition: map → fly to القرّاء entrance → continue through the arch into the hall (one continuous spline, 5–6 s).
- Hall: `hall_arch_wall.glb` repeated in a row behind the reciter, view to the water and skyline through the arches, marble floor, red rug (textured plane), `lantern.glb` on both sides.
- Reciters: `reciter_old.glb`, `reciter_young.glb` (seated with rehal + Quran) facing the camera. Static meshes → animate in code: breathing (subtle chest/shoulder scale), slow head movement, jaw/head motion driven by the recitation audio loudness (Web Audio AnalyserNode). Try Meshy/Mixamo rig only if code animation looks wrong.
- Switching reciter = crossfade between models.
- UI (dark-glass side panel + dark-glass audio player, RTL — see UI style): reciter name, short bio, reciter list, surah list, audio player (play/pause, seek). User starts audio. Label demo names/audio as placeholders.

## Look
- HDRI sunset as environment + a warm directional sun with soft shadows (shadow map only on the hero area).
- Fog matching the horizon colour, Bloom (subtle, threshold high), ACES tone mapping, slight vignette.
- Glowing lattice/arches: emissive gold material on window/arch fills.

## Performance budget
- Total initial download < 15 MB; each building < 3 MB after compression.
- Decimate Meshy buildings to ≤ 60k triangles each (skyline towers ≤ 8k, props ≤ 5k, characters ≤ 20k) in Blender before export.
- Detect low-end/mobile → lower DPR, disable shadows and bloom.
- LOD for the 4 hero buildings (incl. courtyard_complex) + gateway_interior + hall_arch_wall: LOW in `public/models/` (map budget, 1k maps) and HIGH in `public/models/hi/` (~300k tris, 2k maps, all PBR maps kept), both simplified error-first with meshopt lockBorder (`node scripts/build_lod.mjs`). HIGH loads only on demand (flight start, label hover, hero portal after the map) and swaps in by distance (drei `<Detailed>`). Initial load may exceed 15 MB if needed; HIGH never loads up front.
- Show a loading screen with the Rawafed logo while models load.

## Working rules
- Work in small steps. After each step, run the site and take a Playwright screenshot to `screens/` and check it before moving on.
- Ask before deleting or replacing any asset.
- Keep CREDITS.md current for every downloaded asset (name, author, license, URL).
- Meshy API key is in `.env` as MESHY_API_KEY. Never print or commit it.

## Done = 
The القرّاء flow works end to end (map → flight into hall → animated reciter + playback → back). Site runs with `npm run dev` (Next.js), builds with `npm run build`, deployed to a public URL; all 4 transitions work and return; works on a phone (lite mode).

## Blender
Use exactly: `D:\blender.exe` (Blender 5.3.0, full install at the root of D:, data folder `D:\5.3\`).
Headless: `"D:\blender.exe" -b --factory-startup -P scripts/<name>.py -- <args>`
(Do not use `C:\Program Files\Blender Foundation\Blender 4.3\` — empty folder, no exe. `D:\araak-blender-temp\...` is another project's copy.)
