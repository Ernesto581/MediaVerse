// Construye un arbol completo del disco:
//  - Todas las carpetas que contienen archivos de video directamente (hojas)
//  - Todos los ancestros de esas carpetas (para poder matchear series por titulo padre)
// Para cada carpeta guarda: archivos directos, sub-carpetas (nombre + ruta), tamano recursivo.

const fs = require('fs')
const path = require('path')

const ROOTS = ['D:\\', 'E:\\Doramas', 'E:\\Peliculas', 'F:\\', 'H:\\SERIES']
const MEDIA_EXT = new Set([
  '.mp4', '.mkv', '.avi', '.mov', '.wmv', '.flv', '.webm',
  '.ts', '.mpg', '.mpeg', '.m4v', '.ogm', '.rmvb', '.mts'
])

function formatBytes(b) {
  if (!b) return '0 B'
  if (b < 1024) return b + ' B'
  if (b < 1048576) return (b / 1024).toFixed(1) + ' KB'
  if (b < 1073741824) return (b / 1048576).toFixed(1) + ' MB'
  return (b / 1073741824).toFixed(2) + ' GB'
}

// Map: fullFolderPath -> node
const NODES = new Map()

function ensureNode(dirPath) {
  if (!NODES.has(dirPath)) {
    NODES.set(dirPath, {
      path: dirPath,
      name: path.basename(dirPath),
      files: [],
      subdirs: [],          // [{name, path}]
      hasMedia: false,      // has media files directly
      hasMediaDescendant: false,
      recursiveSize: 0,
      recursiveSizeFormatted: ''
    })
  }
  return NODES.get(dirPath)
}

function scan(dir, depth) {
  if (depth > 10) return null
  const node = ensureNode(dir)
  let entries
  try { entries = fs.readdirSync(dir, { withFileTypes: true }) } catch { return node }

  let dirSize = 0
  for (const e of entries) {
    try {
      const full = path.join(dir, e.name)
      if (e.isDirectory()) {
        const child = scan(full, depth + 1)
        if (child && (child.hasMedia || child.hasMediaDescendant)) {
          node.hasMediaDescendant = true
          node.subdirs.push({ name: e.name, path: full })
          dirSize += child.recursiveSize
        }
      } else if (e.isFile() && MEDIA_EXT.has(path.extname(e.name).toLowerCase())) {
        const size = fs.statSync(full).size
        node.files.push({ name: e.name, ext: path.extname(e.name).toLowerCase().replace('.', ''), size })
        node.hasMedia = true
        dirSize += size
      }
    } catch {}
  }
  node.files.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }))
  node.recursiveSize = dirSize
  node.recursiveSizeFormatted = formatBytes(dirSize)
  return node
}

console.log('Construyendo arbol completo del disco...\n')
for (const root of ROOTS) {
  if (!fs.existsSync(root)) { console.log('  SKIP: ' + root); continue }
  const before = NODES.size
  scan(root, 0)
  console.log('  ' + root + ' -> ' + (NODES.size - before) + ' carpetas en arbol')
}

// Mark root nodes that have media descendants as part of the tree
let leaves = 0
let withMedia = 0
let ancestors = 0
for (const n of NODES.values()) {
  if (n.hasMedia) { leaves++; withMedia++ }
  else if (n.hasMediaDescendant) ancestors++
}

console.log('\n=== RESUMEN ARBOL ===')
console.log('  Total carpetas en arbol: ' + NODES.size)
console.log('  Carpetas con media directa: ' + withMedia)
console.log('  Ancestros (sin media directa): ' + ancestors)

const out = {
  scanDate: new Date().toISOString(),
  roots: ROOTS,
  stats: { totalFolders: NODES.size, withMedia, ancestors },
  folders: Array.from(NODES.values())
}

const outPath = path.join(__dirname, 'disk-tree.json')
fs.writeFileSync(outPath, JSON.stringify(out, null, 2))
console.log('\nArbol guardado: ' + outPath)
