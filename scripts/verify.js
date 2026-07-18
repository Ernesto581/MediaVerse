const fs = require('fs')
const path = require('path')

const DATA_DIR = path.join(__dirname, '..', 'src', 'data')
const FILES = ['movies.ts', 'anime-movies.ts', 'anime-series.ts', 'series.ts']
const MEDIA_EXT = new Set(['.mp4','.mkv','.avi','.mov','.wmv','.flv','.webm','.ts','.mpg','.m4v','.ogm','.rmvb','.mts'])

function resolvePath(rawPath) {
  let p = rawPath
  p = p.replace(/\$1\/\//g, 'H:/SERIES/')
  p = p.replace(/\/\/+/g, '/')
  p = p.replace(/\//g, '\\')
  // Fix double drives like D:\\ -> D:\
  p = p.replace(/^([A-Z]):\\\\/, '$1:\\')
  p = p.replace(/^([A-Z]):\\/, '$1:\\')
  // Handle unclosed quotes/backticks
  p = p.replace(/[`'"]/g, '')
  p = p.trim()
  if (p.endsWith('\\')) p = p.slice(0, -1)
  return p
}

function countMediaFiles(dirPath) {
  if (!fs.existsSync(dirPath)) return { exists: false, count: 0, totalSize: 0 }
  let count = 0
  let totalSize = 0
  try {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true })
    for (const e of entries) {
      if (e.isFile() && MEDIA_EXT.has(path.extname(e.name).toLowerCase())) {
        try { const sz = fs.statSync(path.join(dirPath, e.name)).size; totalSize += sz } catch {}
        count++
      } else if (e.isDirectory()) {
        const sub = countMediaFiles(path.join(dirPath, e.name))
        count += sub.count
        totalSize += sub.totalSize
      }
    }
  } catch {}
  return { exists: true, count, totalSize }
}

function formatBytes(bytes) {
  if (!bytes || bytes === 0) return '0 B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
  return (bytes / (1024 * 1024 * 1024)).toFixed(2) + ' GB'
}

// Extract all entries from data files
const allEntries = []

for (const file of FILES) {
  const content = fs.readFileSync(path.join(DATA_DIR, file), 'utf-8')
  const sourceFile = file

  // Find each media item
  let pos = 0
  while (true) {
    const idMatch = content.slice(pos).match(/\n\s*id:\s*["']([^"']+)["']/)
    if (!idMatch) break
    const idStart = pos + idMatch.index
    const id = idMatch[1]

    // Get the block between this id and the next id or end
    const nextIdMatch = content.slice(idStart + 10).match(/\n\s*id:\s*["']/)
    const blockEnd = nextIdMatch ? idStart + 10 + nextIdMatch.index : content.length
    const block = content.slice(idStart, blockEnd)

    const titleMatch = block.match(/title:\s*["']([^"']+)["']/)
    const title = titleMatch ? titleMatch[1] : ''

    const typeMatch = block.match(/type:\s*["']([^"']+)["']/)
    const type = typeMatch ? typeMatch[1] : ''

    const catMatch = block.match(/category:\s*["']([^"']+)["']/)
    const category = catMatch ? catMatch[1] : ''

    const pathMatch = block.match(/path:\s*["'`]([^"'`]+)["'`]/)
    const rawPath = pathMatch ? pathMatch[1] : ''

    // Extract season episodes
    const seasonRegex = /\{\s*\n\s*number:\s*(\d+),\s*\n\s*episodes:\s*(\d+)/g
    const seasons = []
    let sm
    while ((sm = seasonRegex.exec(block)) !== null) {
      seasons.push({ number: parseInt(sm[1]), episodes: parseInt(sm[2]) })
    }

    // Also handle single-episode entries
    const epMatch = block.match(/episodes:\s*(\d+)/)
    const singleEps = epMatch ? parseInt(epMatch[1]) : 0

    const dataTotalEps = seasons.length > 0
      ? seasons.reduce((s, e) => s + e.episodes, 0)
      : singleEps

    const resolvedPath = resolvePath(rawPath)

    allEntries.push({
      id, title, type, category,
      rawPath, resolvedPath,
      seasons, dataTotalEps,
      file: sourceFile
    })

    pos = idStart + 10
  }
}

console.log(`Entradas en datos: ${allEntries.length}`)

// Verify each entry
const notFound = []
const countMismatch = []
const ok = []
let totalChecked = 0

for (const entry of allEntries) {
  const rp = entry.resolvedPath
  if (!rp) continue

  const disk = countMediaFiles(rp)
  totalChecked++

  if (!disk.exists) {
    notFound.push({ ...entry, diskCount: 0 })
  } else if (disk.count !== entry.dataTotalEps && entry.dataTotalEps > 0) {
    countMismatch.push({
      ...entry,
      diskCount: disk.count,
      diskSize: disk.totalSize,
      diff: disk.count - entry.dataTotalEps
    })
  } else {
    ok.push({ ...entry, diskCount: disk.count })
  }
}

// Output results
console.log(`\n=== RESULTADOS DE VERIFICACION ===`)
console.log(`Total verificado: ${totalChecked}`)
console.log(`  OK (coinciden): ${ok.length}`)
console.log(`  NO ENCONTRADO en disco: ${notFound.length}`)
console.log(`  EPISODIOS DIFERENTES: ${countMismatch.length}`)

console.log(`\n--- NO ENCONTRADOS (posiblemente eliminados) ---`)
for (const e of notFound) {
  console.log(`  ELIMINAR? ${e.title} (${e.type}) -> ${e.resolvedPath} [datos: ${e.dataTotalEps} eps]`)
}

console.log(`\n--- DIFERENCIA DE EPISODIOS ---`)
for (const e of countMismatch) {
  const sign = e.diff > 0 ? '+' : ''
  console.log(`  ACTUALIZAR: ${e.title} (${e.type}) -> disco: ${e.diskCount} | datos: ${e.dataTotalEps} | ${sign}${e.diff}`)
}

// Save detailed report
const report = {
  summary: { total: totalChecked, ok: ok.length, notFound: notFound.length, mismatch: countMismatch.length },
  notFound: notFound.map(e => ({ id: e.id, title: e.title, type: e.type, path: e.resolvedPath, dataEps: e.dataTotalEps })),
  mismatch: countMismatch.map(e => ({
    id: e.id, title: e.title, type: e.type, path: e.resolvedPath,
    dataEps: e.dataTotalEps, diskEps: e.diskCount, diff: e.diff,
    diskSize: e.diskSize, diskSizeFormatted: formatBytes(e.diskSize)
  }))
}

const outPath = path.join(__dirname, 'verification.json')
fs.writeFileSync(outPath, JSON.stringify(report, null, 2))
console.log(`\nReporte guardado: ${outPath}`)
