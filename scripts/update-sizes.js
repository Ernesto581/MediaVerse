const fs = require('fs')
const path = require('path')

const DATA_DIR = path.join(__dirname, '..', 'src', 'data')
const FILES = ['series.ts', 'anime-series.ts', 'anime-movies.ts', 'movies.ts']
const SIZE_MAP_RAW = JSON.parse(fs.readFileSync(path.join(__dirname, 'file-sizes.json'), 'utf-8'))

// Build an array of {name, size} for prefix matching
const FILE_LIST = Object.entries(SIZE_MAP_RAW).map(([name, size]) => ({ name, size }))
console.log(`Archivos en índice: ${FILE_LIST.length}`)

function formatBytes(bytes) {
  if (!bytes || bytes === 0) return '0 B'
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
  return (bytes / (1024 * 1024 * 1024)).toFixed(2) + ' GB'
}

function findRealSize(epName) {
  // Strip extension to get base name
  const baseName = epName.replace(/\.[^.]+$/, '').toLowerCase()
  // Find file on disk whose name starts with baseName (case-insensitive)
  for (const f of FILE_LIST) {
    if (f.name.toLowerCase().startsWith(baseName)) {
      return f.size
    }
  }
  return null
}

let grandTotal = 0
let notFound = 0
let foundCount = 0

function processFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf-8')
  let updated = 0
  let nf = 0

  // Match: { name: "...", format: "...", sizeBytes: N, sizeFormatted: "..." }
  const epRegex = /\{(\s*)name:\s*"([^"]+)",\s*format:\s*"([^"]*)",\s*sizeBytes:\s*(\d+),\s*sizeFormatted:\s*"[^"]*"\s*\}/g

  content = content.replace(epRegex, (match, spaces, name, fmt, oldSize) => {
    const realSize = findRealSize(name)
    if (!realSize) {
      nf++
      return match
    }
    if (realSize === parseInt(oldSize)) return match

    updated++
    const formatted = formatBytes(realSize)
    return `{${spaces}name: "${name}", format: "${fmt}", sizeBytes: ${realSize}, sizeFormatted: "${formatted}" }`
  })

  return { content, updated, notFound: nf }
}

function recalcSeasonTotals(content) {
  // For each season block, sum episode sizes and update season-level totals
  // Find season blocks: from "{ number:" to the closing "}" after episodesList
  let updated = content

  // Match a season from opening brace after "number:" through episodesList closing
  const seasonRegex = /(\{\s*\n\s*number:\s*\d+[\s\S]*?episodesList:\s*\[)([\s\S]*?)(\]\s*\n\s*\})/g

  updated = updated.replace(seasonRegex, (match, beforeEpisodes, episodesStr, afterEpisodes) => {
    // Sum all episode sizeBytes
    let total = 0
    const sizeRegex = /sizeBytes:\s*(\d+)/g
    let m
    while ((m = sizeRegex.exec(episodesStr)) !== null) {
      total += parseInt(m[1])
    }

    if (total === 0) return match

    const formatted = formatBytes(total)

    // Replace the season-level sizeBytes that appears BEFORE episodesList
    // It's in the "beforeEpisodes" part
    let before = beforeEpisodes.replace(
      /sizeBytes:\s*\d+/,
      'sizeBytes: ' + total
    )
    // Replace the season-level sizeFormatted (the first one, before episodesList)
    before = before.replace(
      /sizeFormatted:\s*"[^"]*"/,
      'sizeFormatted: "' + formatted + '"'
    )

    return before + episodesStr + afterEpisodes
  })

  return updated
}

function recalcMediaTotals(content) {
  // For each media item with seasons, sum all season sizeBytes and update media-level totals
  let updated = content

  // Match the media-level sizeBytes/sizeFormatted that comes after seasons array
  const mediaRegex = /(seasons:\s*\[[\s\S]*?\]\s*,\s*\n\s*path:[^\n]*\n\s*sizeBytes:\s*)(\d+)(,\s*\n\s*sizeFormatted:\s*")([^"]*)(")/g

  updated = updated.replace(mediaRegex, (match, prefix, oldTotal, fmtPrefix, oldFmt, suffix) => {
    let total = 0
    // Match each season's sizeBytes: it appears on the line after "formats: [...]" and before "episodesList:"
    // Pattern: formats: ... \n\s*sizeBytes: NNN
    const szRegex = /formats:[^\n]*\n\s*sizeBytes:\s*(\d+)/g
    let m
    while ((m = szRegex.exec(match)) !== null) {
      total += parseInt(m[1])
    }

    if (total === 0 || total === parseInt(oldTotal)) return match

    const formatted = formatBytes(total)
    return prefix + total + fmtPrefix + formatted + suffix
  })

  return updated
}

// Process each data file
for (const file of FILES) {
  const filePath = path.join(DATA_DIR, file)
  if (!fs.existsSync(filePath)) {
    console.log(`SKIP: ${file} (no existe)`)
    continue
  }

  console.log(`\nProcesando: ${file}`)

  const { content: updatedEps, updated, notFound: nf } = processFile(filePath)
  notFound += nf
  foundCount += updated
  console.log(`  Episodios con peso real: ${updated}`)
  console.log(`  No encontrados en disco: ${nf}`)

  if (updated === 0) {
    console.log(`  Sin cambios, saltando...`)
    continue
  }

  // Recalculate season totals
  let finalContent = recalcSeasonTotals(updatedEps)
  // Recalculate media totals
  finalContent = recalcMediaTotals(finalContent)

  fs.writeFileSync(filePath, finalContent, 'utf-8')
  console.log(`  Guardado.`)
}

console.log(`\n=== RESUMEN ===`)
console.log(`Episodios actualizados: ${foundCount}`)
console.log(`No encontrados en disco: ${notFound}`)
console.log(`Total procesado.`)
