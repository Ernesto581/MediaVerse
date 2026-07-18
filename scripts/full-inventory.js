// Escaneo exhaustivo: genera inventario completo de archivos de video
// con nombres exactos y pesos exactos, organizado por carpeta.
// Tambien calcula el tamano total recursivo de cada carpeta que contiene
// archivos de video directamente (carpeta "hoja" de media).

const fs = require('fs')
const path = require('path')

const ROOTS = ['D:\\', 'E:\\Doramas', 'E:\\Peliculas', 'F:\\', 'H:\\SERIES']
const MEDIA_EXT = new Set([
  '.mp4', '.mkv', '.avi', '.mov', '.wmv', '.flv', '.webm',
  '.ts', '.mpg', '.mpeg', '.m4v', '.ogm', '.rmvb', '.mts'
])

function formatBytes(bytes) {
  if (!bytes || bytes === 0) return '0 B'
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
  return (bytes / (1024 * 1024 * 1024)).toFixed(2) + ' GB'
}

// Map: fullFolderPath -> { name, path, drive, files: [{name, ext, size}], directSize, recursiveSize }
const folders = new Map()
let totalFiles = 0
let totalSize = 0

function recursiveSize(dirPath) {
  let total = 0
  let entries
  try { entries = fs.readdirSync(dirPath, { withFileTypes: true }) } catch { return 0 }
  for (const e of entries) {
    try {
      const full = path.join(dirPath, e.name)
      if (e.isFile() && MEDIA_EXT.has(path.extname(e.name).toLowerCase())) {
        total += fs.statSync(full).size
      } else if (e.isDirectory()) {
        total += recursiveSize(full)
      }
    } catch {}
  }
  return total
}

function scan(dir, depth, drive) {
  if (depth > 8) return
  let entries
  try { entries = fs.readdirSync(dir, { withFileTypes: true }) } catch { return }

  const mediaFiles = []
  for (const e of entries) {
    try {
      const full = path.join(dir, e.name)
      if (e.isDirectory()) {
        scan(full, depth + 1, drive)
      } else if (e.isFile() && MEDIA_EXT.has(path.extname(e.name).toLowerCase())) {
        const size = fs.statSync(full).size
        mediaFiles.push({
          name: e.name,
          ext: path.extname(e.name).toLowerCase().replace('.', ''),
          size
        })
        totalFiles++
        totalSize += size
      }
    } catch {}
  }

  if (mediaFiles.length > 0) {
    const directSize = mediaFiles.reduce((s, f) => s + f.size, 0)
    folders.set(dir, {
      name: depth === 0 ? path.basename(path.dirname(dir)) : path.basename(dir),
      path: dir,
      drive,
      depth,
      isRoot: depth === 0,
      files: mediaFiles.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' })),
      directSize,
      directSizeFormatted: formatBytes(directSize),
      recursiveSize: 0,
      recursiveSizeFormatted: ''
    })
  }
}

console.log('Escaneando discos...\n')
for (const root of ROOTS) {
  if (!fs.existsSync(root)) { console.log('  SKIP (no existe): ' + root); continue }
  const before = folders.size
  process.stdout.write('  ' + root + ' ... ')
  scan(root, 0, root.substring(0, 1))
  console.log((folders.size - before) + ' carpetas con media')
}

// Calcular recursiveSize para cada carpeta
console.log('\nCalculando tamanos recursivos...')
for (const [p, info] of folders) {
  const r = recursiveSize(p)
  info.recursiveSize = r
  info.recursiveSizeFormatted = formatBytes(r)
}

console.log('\n=== RESUMEN INVENTARIO ===')
console.log('  Carpetas con media (hojas): ' + folders.size)
console.log('  Archivos de video totales: ' + totalFiles)
console.log('  Tamano total: ' + formatBytes(totalSize))

const out = {
  scanDate: new Date().toISOString(),
  roots: ROOTS,
  stats: {
    foldersWithMedia: folders.size,
    totalVideoFiles: totalFiles,
    totalSize,
    totalSizeFormatted: formatBytes(totalSize)
  },
  folders: Array.from(folders.values())
}

const outPath = path.join(__dirname, 'full-inventory.json')
fs.writeFileSync(outPath, JSON.stringify(out, null, 2))
console.log('\nInventario guardado: ' + outPath)
