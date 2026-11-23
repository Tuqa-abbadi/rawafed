// Material fixes shared by compress.mjs and patch_materials.mjs.
// Meshy exports metallicFactor 1.0 x a metallic texture that marks much of the stone as metal,
// which renders as chrome mirroring the sky. Scale metalness per category (video: warm matte stone).
export function metalFactorFor(cfg) {
  if (cfg.metal !== undefined) return cfg.metal
  const [folder, file] = cfg.src.split('/')
  const name = cfg.out
  if (folder === 'characters') return 0
  if (name === 'palm' || name === 'olive_tree') return 0
  if (name.startsWith('lantern')) return 0.7
  if (name === 'rehal') return 0.2
  if (folder === 'skyline') return 0.6
  if (folder === 'sea') return 0.3
  return 0.1 // buildings, hall, interiors, fountain
}

export function applyMaterialFixes(doc, cfg) {
  const metal = metalFactorFor(cfg)
  for (const m of doc.getRoot().listMaterials()) m.setMetallicFactor(metal)
  return metal
}
