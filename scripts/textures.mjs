// Poly Haven 2k JPG maps in assets/textures/<id>/ -> 1k WebP in public/textures/<id>_<map>.webp
import sharp from 'sharp'
import { readdirSync, mkdirSync, statSync } from 'node:fs'

mkdirSync('public/textures', { recursive: true })
for (const id of readdirSync('assets/textures')) {
  const dir = `assets/textures/${id}`
  if (!statSync(dir).isDirectory()) continue
  for (const f of readdirSync(dir)) {
    const m = f.match(/_(diff|nor_gl|arm)_2k\.jpg$/)
    if (!m) continue
    const out = `public/textures/${id}_${m[1]}.webp`
    await sharp(`${dir}/${f}`).resize(1024, 1024).webp({ quality: m[1] === 'diff' ? 82 : 90 }).toFile(out)
    console.log(out, (statSync(out).size / 1024).toFixed(0), 'KB')
  }
}
