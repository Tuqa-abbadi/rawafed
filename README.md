# Rawafed (روافد) — 3D prototype

A browser-based 3D journey through the Rawafed city: a scroll-driven landing, an aerial map of
the four buildings (القرّاء، المكتبة، التعليم، المجتمع) and their interiors. Arabic by default (RTL),
with an AR | EN switch.

Built with Next.js, React Three Fiber, three.js, GSAP and Lenis.

## Run locally

Requires Node.js 20 or newer.

```bash
npm install
npm run dev        # development server: http://localhost:3000
```

## Build

```bash
npm run build      # static export into out/ (no server needed)
npx serve out      # preview the production build: http://localhost:3000
```

Always judge smoothness on this production build. The dev server is much slower.

## Deploy

The build is a plain static folder (`out/`), so any static host works:

- **Vercel:** run `npx vercel --prod`. `vercel.json` sets the build command, `out/` and cache headers.
- **Netlify:** connect the repo. `netlify.toml` builds with `npm run build` and publishes `out`.
- **Cloudflare Pages:** set the build command to `npm run build` and the output directory to `out`.

Long-term cache headers for `/models`, `/textures`, `/audio` and `/env` come from
`public/_headers` (Netlify, Cloudflare) and `vercel.json` (Vercel).

`assets/` (the original Meshy models) and `refs/` stay on disk but are never committed or
deployed.

## Adding recitations (audio)

Put MP3 files here:

```
public/audio/<reciter>/<surah>.mp3
```

- `<reciter>` is `old` (القارئ الأول) or `young` (القارئ الثاني).
- `<surah>` is `fatiha`, `baqarah`, `yasin` or `mulk`.

Then register the file in `src/lib/recitation.ts`, in the `AVAILABLE` list. For example,
`old: ['fatiha', 'yasin']`.

Next, set the credit line shown under the player in `src/i18n/ar.json` and `src/i18n/en.json`,
under `reciters.<reciter>.credit`. There is one credit line per reciter. Surahs not listed in
`AVAILABLE` show «قريبًا» / "Coming soon" and play nothing.

To add a new surah, add its id to `SURAHS` in `src/lib/recitation.ts`. Then add its name under
`surahs` in both language files.

## Text and translations

All interface text is in `src/i18n/ar.json` and `src/i18n/en.json`.

## Credits

See `CREDITS.md` for models, textures, fonts and recitations.
