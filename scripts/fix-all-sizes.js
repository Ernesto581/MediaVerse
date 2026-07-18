const fs = require('fs')
const path = require('path')

const DATA_DIR = path.join(__dirname, '..', 'src', 'data')
const FILES = ['movies.ts', 'anime-movies.ts', 'anime-series.ts', 'series.ts']
const MEDIA_EXT = new Set(['.mp4','.mkv','.avi','.mov','.wmv','.flv','.webm','.ts','.mpg','.m4v','.ogm','.rmvb','.mts'])

function resolvePath(raw) {
  let p = raw.replace(/\$1\/\//g, 'H:\\SERIES\\').replace(/\/\/+/g, '\\').replace(/\//g, '\\')
  p = p.replace(/^([A-Z]):\\\\/, '$1:\\').replace(/^([A-Z]):\\/, '$1:\\')
  p = p.replace(/[`'"]/g, '').trim()
  if (p.endsWith('\\')) p = p.slice(0, -1)
  return p
}

function formatBytes(bytes) {
  if (!bytes || bytes === 0) return '0 B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
  return (bytes / (1024 * 1024 * 1024)).toFixed(2) + ' GB'
}

function findFolder(rawPath) {
  const base = resolvePath(rawPath)
  if (fs.existsSync(base)) return base

  // Try parent directory matching for compound paths (; separated)
  const parts = rawPath.split(';').map(p => resolvePath(p.trim()))
  for (const p of parts) {
    if (fs.existsSync(p)) return p
    // Try parent
    const parent = path.dirname(p)
    if (fs.existsSync(parent)) {
      // Find closest match
      try {
        const entries = fs.readdirSync(parent, { withFileTypes: true })
        const search = path.basename(p).toLowerCase().replace(/[^a-z0-9]/g, '')
        for (const e of entries) {
          if (!e.isDirectory()) continue
          const en = e.name.toLowerCase().replace(/[^a-z0-9]/g, '')
          if (en.includes(search) || search.includes(en)) return path.join(parent, e.name)
        }
      } catch {}
    }
  }

  // Fuzzy search in D:\ and H:\SERIES subfolders
  const name = path.basename(base).toLowerCase().replace(/[^a-z0-9]/g, '')
  const drive = base.substring(0, 3)

  const searchDirs = [drive]
  if (drive === 'H:\\') {
    searchDirs.push('H:\\SERIES\\(Animadas', 'H:\\SERIES\\(Persona', 'H:\\SERIES\\Completar')
  }
  if (drive === 'D:\\') {
    try {
      const d = fs.readdirSync('D:\\', { withFileTypes: true })
      for (const e of d) {
        if (e.isDirectory() && (e.name.includes('Saga') || e.name.includes('Animadas') || e.name.includes('Peliculas'))) {
          searchDirs.push(path.join('D:\\', e.name))
        }
      }
    } catch {}
  }

  for (const sd of searchDirs) {
    try {
      const entries = fs.readdirSync(sd, { withFileTypes: true })
      for (const e of entries) {
        if (!e.isDirectory()) continue
        const en = e.name.toLowerCase().replace(/[^a-z0-9]/g, '')
        if (en.includes(name) || name.includes(en)) return path.join(sd, e.name)
      }
    } catch {}
  }

  return null
}

function countTotalSize(dirPath) {
  if (!dirPath || !fs.existsSync(dirPath)) return 0
  let total = 0
  try {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true })
    for (const e of entries) {
      try {
        const full = path.join(dirPath, e.name)
        if (e.isFile() && MEDIA_EXT.has(path.extname(e.name).toLowerCase())) {
          total += fs.statSync(full).size
        } else if (e.isDirectory()) {
          total += countTotalSize(full)
        }
      } catch {}
    }
  } catch {}
  return total
}

console.log('Calculando tamaños de disco para todas las entradas...\n')

let grandTotal = 0
let notFound = 0
let updated = 0

for (const file of FILES) {
  const filePath = path.join(DATA_DIR, file)
  if (!fs.existsSync(filePath)) continue

  let content = fs.readFileSync(filePath, 'utf-8')
  let fileUpdated = 0
  let fileNotFound = 0

  // Extract all path entries
  const pathRegex = /path:\s*["'`]([^"'`]+)["'`]/g
  const replacements = []
  let pm
  while ((pm = pathRegex.exec(content)) !== null) {
    const rawPath = pm[1]
    const folder = findFolder(rawPath)
    const totalSize = folder ? countTotalSize(folder) : 0

    if (!folder || totalSize === 0) {
      fileNotFound++
      continue
    }

    // Find the sizeBytes/sizeFormatted after this path
    const afterPath = content.substring(pm.index + pm[0].length)
    const existingSizeMatch = afterPath.match(/^\s*,\s*\n\s*sizeBytes:\s*(\d+)/)
    const existingSize = existingSizeMatch ? parseInt(existingSizeMatch[1]) : null

    if (existingSize === totalSize) continue

    if (existingSizeMatch) {
      const fullMatch = afterPath.substring(0, afterPath.indexOf('\n', afterPath.indexOf('sizeFormatted')) + 1)
      const formatted = formatBytes(totalSize)
      const newBlock = `,\n    sizeBytes: ${totalSize},\n    sizeFormatted: formatBytes(${totalSize})`
      // Replace from after path until end of sizeFormatted line
      const endOfSizeLine = afterPath.indexOf('\n', afterPath.indexOf('sizeFormatted'))
      const toReplace = afterPath.substring(0, endOfSizeLine === -1 ? existingSizeMatch.index + 40 : endOfSizeLine)
      content = content.substring(0, pm.index + pm[0].length) + 
                afterPath.replace(toReplace, newBlock) +
                (endOfSizeLine !== -1 ? afterPath.substring(endOfSizeLine) : '')
      fileUpdated++
    }
  }

  if (fileUpdated > 0 || fileNotFound > 0) {
    console.log(`${file}: ${fileUpdated} actualizados, ${fileNotFound} no encontrados`)
  }
  grandTotal += fileNotFound
  updated += fileUpdated
}

console.log(`\nTotal: ${updated} actualizados, ${notFound} no encontrados en disco`)
