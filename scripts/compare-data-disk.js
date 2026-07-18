// Comparacion exhaustiva: datos del proyecto vs disco real.
// Para cada entrada de datos:
//   - resuelve la(s) ruta(s) a carpeta(s) reales del disco
//   - verifica que cada episodio listado exista con mismo nombre y tamano exacto
//   - detecta archivos en disco no listados en datos
//   - verifica totales de temporada y de media
// Tambien detecta carpetas del disco NO catalogadas en el proyecto.

const fs = require('fs')
const path = require('path')

const DATA_DIR = path.join(__dirname, '..', 'src', 'data')
const FILES = ['movies.ts', 'anime-movies.ts', 'anime-series.ts', 'series.ts']

const inv = JSON.parse(fs.readFileSync(path.join(__dirname, 'full-inventory.json'), 'utf-8'))
// Map: fullFolderPath -> folderInfo
const FOLDERS = new Map()
for (const f of inv.folders) FOLDERS.set(f.path, f)

// Map: lowercased basename (filename) -> [{path, size}] for global filename lookup
const FILE_INDEX = new Map()
for (const f of inv.folders) {
  for (const file of f.files) {
    const k = file.name.toLowerCase()
    if (!FILE_INDEX.has(k)) FILE_INDEX.set(k, [])
    FILE_INDEX.get(k).push({ folder: f.path, size: file.size })
  }
}

function formatBytes(bytes) {
  if (!bytes || bytes === 0) return '0 B'
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
  return (bytes / (1024 * 1024 * 1024)).toFixed(2) + ' GB'
}

// Resolve a raw path string from data to an actual disk folder path.
// Handles compound paths separated by ';', $1 placeholders, //, etc.
function resolveRawPath(rawPath) {
  const parts = rawPath.split(';').map(p => p.trim()).filter(Boolean)
  return parts.map(p => {
    let s = p
    s = s.replace(/\$1\/\//g, 'H:\\SERIES\\')
    s = s.replace(/\$1\\/g, 'H:\\SERIES\\')
    s = s.replace(/\/\/+/g, '\\')
    s = s.replace(/\//g, '\\')
    s = s.replace(/^([A-Za-z]):\\\\/, '$1:\\')
    s = s.replace(/[`'"]/g, '')
    s = s.trim()
    if (s.endsWith('\\')) s = s.slice(0, -1)
    return s
  })
}

// Try to find an actual disk folder for a wanted path.
function findFolder(wantedPath) {
  if (FOLDERS.has(wantedPath)) return wantedPath
  if (fs.existsSync(wantedPath) && fs.statSync(wantedPath).isDirectory()) return wantedPath

  const parent = path.dirname(wantedPath)
  const wantedBase = path.basename(wantedPath).toLowerCase().replace(/[^a-z0-9]/g, '')
  if (wantedBase && fs.existsSync(parent)) {
    try {
      const entries = fs.readdirSync(parent, { withFileTypes: true })
      let best = null
      let bestScore = 0
      for (const e of entries) {
        if (!e.isDirectory()) continue
        const en = e.name.toLowerCase().replace(/[^a-z0-9]/g, '')
        let score = 0
        if (en === wantedBase) score = 1
        else if (en.includes(wantedBase) || wantedBase.includes(en)) score = 0.8
        else {
          // Jaccard on chars
          const setA = new Set(en.split(''))
          const setB = new Set(wantedBase.split(''))
          const inter = [...setA].filter(x => setB.has(x)).length
          const union = new Set([...setA, ...setB]).size
          score = union ? inter / union : 0
        }
        if (score > bestScore) { bestScore = score; best = path.join(parent, e.name) }
      }
      if (bestScore >= 0.7) return best
    } catch {}
  }

  // Fuzzy search within same drive's indexed folders
  const drive = wantedPath.substring(0, 1).toUpperCase()
  let best = null
  let bestScore = 0
  for (const [p] of FOLDERS) {
    if (!p.startsWith(drive + ':')) continue
    const folderBase = path.basename(p).toLowerCase().replace(/[^a-z0-9]/g, '')
    let score = 0
    if (folderBase === wantedBase) score = 1
    else if (folderBase && wantedBase && (folderBase.includes(wantedBase) || wantedBase.includes(folderBase))) score = 0.85
    if (score > bestScore) { bestScore = score; best = p }
  }
  if (bestScore >= 0.7) return best
  return null
}

// Find the disk file matching an episode name within a set of candidate folders.
// Returns { folder, size } or null.
function findEpisodeFile(epName, candidateFolders) {
  const epBase = epName.replace(/\.[^.]+$/, '').toLowerCase()
  const epLower = epName.toLowerCase()
  // 1) Exact filename match inside candidate folders
  for (const folder of candidateFolders) {
    const info = FOLDERS.get(folder)
    if (!info) continue
    for (const f of info.files) {
      if (f.name.toLowerCase() === epLower) return { folder, size: f.size, name: f.name }
    }
  }
  // 2) Filename starts-with match inside candidate folders
  for (const folder of candidateFolders) {
    const info = FOLDERS.get(folder)
    if (!info) continue
    for (const f of info.files) {
      const fb = f.name.replace(/\.[^.]+$/, '').toLowerCase()
      if (fb.startsWith(epBase) || epBase.startsWith(fb)) return { folder, size: f.size, name: f.name }
    }
  }
  // 3) Global exact filename lookup (across all folders)
  if (FILE_INDEX.has(epLower)) {
    const candidates = FILE_INDEX.get(epLower)
    // Prefer one inside candidate folders
    for (const c of candidates) {
      if (candidateFolders.includes(c.folder)) return { folder: c.folder, size: c.size, name: epName }
    }
    return { folder: candidates[0].folder, size: candidates[0].size, name: epName }
  }
  // 4) Global starts-with lookup
  for (const [k, list] of FILE_INDEX) {
    const kb = k.replace(/\.[^.]+$/, '')
    if (kb.startsWith(epBase) || epBase.startsWith(kb)) {
      return { folder: list[0].folder, size: list[0].size, name: list[0] ? epName : epName }
    }
  }
  return null
}

// Parse a data file into an array of media entries with seasons and episode lists.
function parseDataFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8')
  const entries = []
  // Find each top-level object in the exported array: detect by 'id:' anchors
  const idRegex = /\n(\s*)id:\s*["'`]([^"'`]+)["'`]/g
  const positions = []
  let m
  while ((m = idRegex.exec(content)) !== null) {
    positions.push({ index: m.index, indent: m[1].length, id: m[2] })
  }
  for (let i = 0; i < positions.length; i++) {
    const start = positions[i].index
    const end = i + 1 < positions.length ? positions[i + 1].index : content.length
    const block = content.slice(start, end)

    const titleMatch = block.match(/title:\s*["'`]([^"'`]+)["'`]/)
    const typeMatch = block.match(/type:\s*["'`]([^"'`]+)["'`]/)
    const catMatch = block.match(/category:\s*["'`]([^"'`]+)["'`]/)
    const pathMatch = block.match(/path:\s*["'`]([^"'`]+)["'`]/)
    const sizeBytesMatch = block.match(/sizeBytes:\s*(\d+)/)
    const yearMatch = block.match(/year:\s*(\d+)/)

    const id = positions[i].id
    const title = titleMatch ? titleMatch[1] : ''
    const type = typeMatch ? typeMatch[1] : ''
    const category = catMatch ? catMatch[1] : ''
    const rawPath = pathMatch ? pathMatch[1] : ''
    const sizeBytes = sizeBytesMatch ? parseInt(sizeBytesMatch[1]) : null
    const year = yearMatch ? parseInt(yearMatch[1]) : null

    // Parse seasons: each season block starts with "{ number: N, episodes: M,"
    const seasons = []
    const seasonRegex = /\{\s*\n\s*number:\s*(\d+),\s*\n\s*episodes:\s*(\d+)([\s\S]*?)(\n\s*\}\,?|\n\s*\})\s*(?=\n\s*\{|\n\s*\]|,\s*\n\s*path:|\n\s*episodes:)/g
    let sm
    // Simpler: split by season openings
    const seasonStarts = []
    const sStartRegex = /\{\s*\n\s*number:\s*(\d+),\s*\n\s*episodes:\s*(\d+)/g
    while ((sm = sStartRegex.exec(block)) !== null) {
      seasonStarts.push({ index: sm.index, number: parseInt(sm[1]), episodes: parseInt(sm[2]) })
    }
    for (let j = 0; j < seasonStarts.length; j++) {
      const sStart = seasonStarts[j].index
      const sEnd = j + 1 < seasonStarts.length ? seasonStarts[j + 1].index : block.length
      const sBlock = block.slice(sStart, sEnd)
      const num = seasonStarts[j].number
      const eps = seasonStarts[j].episodes
      const sSizeMatch = sBlock.match(/sizeBytes:\s*(\d+)/)
      const seasonSize = sSizeMatch ? parseInt(sSizeMatch[1]) : null
      const notesMatch = sBlock.match(/notes:\s*["'`]([^"'`]+)["'`]/)
      // Parse episodesList
      const episodesList = []
      const epListMatch = sBlock.match(/episodesList:\s*\[([\s\S]*?)\]/)
      if (epListMatch) {
        const epRegex = /\{\s*name:\s*["'`]([^"'`]+)["'`]\s*,\s*format:\s*["'`]([^"'`]+)["'`]\s*,\s*sizeBytes:\s*(\d+)\s*,\s*sizeFormatted:\s*["'`]([^"'`]+)["'`]\s*\}/g
        let em
        while ((em = epRegex.exec(epListMatch[1])) !== null) {
          episodesList.push({ name: em[1], format: em[2], sizeBytes: parseInt(em[3]), sizeFormatted: em[4] })
        }
      }
      seasons.push({ number: num, episodes: eps, sizeBytes: seasonSize, notes: notesMatch ? notesMatch[1] : null, episodesList })
    }

    // Single-episode items (movies without seasons)
    let singleEps = null
    if (seasons.length === 0) {
      const epMatch = block.match(/episodes:\s*(\d+)/)
      singleEps = epMatch ? parseInt(epMatch[1]) : null
    }

    entries.push({ id, title, type, category, rawPath, sizeBytes, year, seasons, singleEps, file: path.basename(filePath) })
  }
  return entries
}

console.log('Cargando datos del proyecto...')
let allEntries = []
for (const f of FILES) {
  const fp = path.join(DATA_DIR, f)
  if (!fs.existsSync(fp)) continue
  const e = parseDataFile(fp)
  console.log('  ' + f + ': ' + e.length + ' entradas')
  allEntries.push(...e)
}
console.log('Total entradas en datos: ' + allEntries.length)
console.log('Carpetas en disco: ' + FOLDERS.size)

// Build the comparison
const results = []
const referencedFolders = new Set()

for (const entry of allEntries) {
  const wantedPaths = resolveRawPath(entry.rawPath)
  const resolvedFolders = []
  let allFound = true
  for (const wp of wantedPaths) {
    const found = findFolder(wp)
    if (found) {
      resolvedFolders.push(found)
      referencedFolders.add(found)
    } else {
      allFound = false
    }
  }

  const seasonsReport = []
  let mediaTotalFromDisk = 0
  let mediaTotalFromData = 0
  let totalEpsInData = 0
  let totalEpsOnDisk = 0

  // For each season, try to find a matching folder and compare episodes
  for (const s of entry.seasons) {
    totalEpsInData += s.episodes
    // Heuristic to pick the candidate folder for this season:
    // if multiple resolved folders, try to match by "T<num>", "Season <num>", "S<num>", "Temporada <num>"
    let seasonFolder = null
    if (resolvedFolders.length === 1) {
      seasonFolder = resolvedFolders[0]
    } else if (resolvedFolders.length > 1) {
      const patterns = [
        new RegExp('[Tt]' + s.number + '\\b'),
        new RegExp('[Ss]0?' + s.number + '\\b'),
        new RegExp('[Ss]eason\\s*0?' + s.number, 'i'),
        new RegExp('Temporada\\s*0?' + s.number, 'i'),
        new RegExp('\\bT' + s.number + '\\b'),
        new RegExp('\\b0?' + s.number + '\\b')
      ]
      let matched = resolvedFolders.find(p => patterns.some(rx => rx.test(path.basename(p))))
      seasonFolder = matched || resolvedFolders[Math.min(s.number - 1, resolvedFolders.length - 1)]
    }

    const diskFolderInfo = seasonFolder ? FOLDERS.get(seasonFolder) : null
    // Count disk files in the resolved folder(s)
    let diskFileCount = 0
    let diskSizeSum = 0
    const diskFiles = []
    if (diskFolderInfo) {
      diskFileCount = diskFolderInfo.files.length
      diskSizeSum = diskFolderInfo.directSize
      diskFiles.push(...diskFolderInfo.files.map(f => ({ name: f.name, size: f.size, folder: seasonFolder })))
    } else {
      // sum across all resolved folders
      for (const rf of resolvedFolders) {
        const info = FOLDERS.get(rf)
        if (info) {
          diskFileCount += info.files.length
          diskSizeSum += info.directSize
          diskFiles.push(...info.files.map(f => ({ name: f.name, size: f.size, folder: rf })))
        }
      }
    }
    totalEpsOnDisk += diskFileCount

    // Compare each listed episode
    const epIssues = []
    let seasonSizeFromData = 0
    for (const ep of s.episodesList) {
      seasonSizeFromData += ep.sizeBytes
      const found = findEpisodeFile(ep.name, seasonFolder ? [seasonFolder] : resolvedFolders)
      if (!found) {
        epIssues.push({ kind: 'ep-not-on-disk', name: ep.name, dataSize: ep.sizeBytes })
      } else {
        if (found.size !== ep.sizeBytes) {
          epIssues.push({ kind: 'size-mismatch', name: ep.name, dataSize: ep.sizeBytes, diskSize: found.size, diskFolder: found.folder })
        }
      }
    }
    // Files on disk not listed in data
    const listedNames = new Set(s.episodesList.map(e => e.name.toLowerCase()))
    const extraOnDisk = []
    for (const df of diskFiles) {
      if (!listedNames.has(df.name.toLowerCase())) {
        extraOnDisk.push({ name: df.name, size: df.size, folder: df.folder })
      }
    }
    const seasonSizeFromDisk = diskSizeSum
    mediaTotalFromDisk += seasonSizeFromDisk
    mediaTotalFromData += seasonSizeFromData

    seasonsReport.push({
      number: s.number,
      dataEpisodes: s.episodes,
      diskEpisodes: diskFileCount,
      dataSeasonSize: seasonSizeFromData,
      diskSeasonSize: seasonSizeFromDisk,
      dataSeasonSizeField: s.sizeBytes,
      epIssues,
      extraOnDisk,
      resolvedFolder: seasonFolder
    })
  }

  // For single-episode items (movies with no seasons): compare by folder
  if (entry.seasons.length === 0) {
    totalEpsInData = entry.singleEps || 0
    let diskFileCount = 0
    let diskSizeSum = 0
    for (const rf of resolvedFolders) {
      const info = FOLDERS.get(rf)
      if (info) {
        diskFileCount += info.files.length
        diskSizeSum += info.directSize
      }
    }
    totalEpsOnDisk = diskFileCount
    mediaTotalFromDisk = diskSizeSum
    mediaTotalFromData = entry.sizeBytes || 0
  }

  results.push({
    id: entry.id,
    title: entry.title,
    type: entry.type,
    category: entry.category,
    file: entry.file,
    rawPath: entry.rawPath,
    wantedPaths,
    resolvedFolders,
    folderFound: allFound,
    seasonsCount: entry.seasons.length,
    dataTotalEps: totalEpsInData,
    diskTotalEps: totalEpsOnDisk,
    dataMediaSize: entry.sizeBytes,
    dataMediaSizeFromEps: mediaTotalFromData,
    diskMediaSize: mediaTotalFromDisk,
    seasons: seasonsReport
  })
}

// Find uncataloged folders: disk folders with media not referenced by any data entry
const uncataloged = []
for (const [p, info] of FOLDERS) {
  if (!referencedFolders.has(p)) {
    uncataloged.push({
      name: info.name,
      path: p,
      drive: info.drive,
      depth: info.depth,
      fileCount: info.files.length,
      directSize: info.directSize,
      directSizeFormatted: info.directSizeFormatted,
      recursiveSize: info.recursiveSize,
      recursiveSizeFormatted: info.recursiveSizeFormatted,
      files: info.files.map(f => ({ name: f.name, ext: f.ext, size: f.size, sizeFormatted: formatBytes(f.size) }))
    })
  }
}

// Summary
let okCount = 0
let notFoundCount = 0
let epMismatchCount = 0
let sizeMismatchCount = 0
let extraFilesCount = 0
let mediaSizeMismatchCount = 0

for (const r of results) {
  let ok = r.folderFound
  for (const s of r.seasons) {
    if (s.epIssues.length > 0) ok = false
    if (s.extraOnDisk.length > 0) ok = false
    if (s.dataEpisodes !== s.diskEpisodes) ok = false
  }
  if (r.dataMediaSize && r.diskMediaSize && r.dataMediaSize !== r.diskMediaSize) ok = false
  if (r.dataTotalEps !== r.diskTotalEps) ok = false
  if (ok) okCount++
  if (!r.folderFound) notFoundCount++
  let hasEpIssue = false, hasSizeIssue = false, hasExtra = false, hasMediaSizeIssue = false
  for (const s of r.seasons) {
    if (s.epIssues.some(e => e.kind === 'ep-not-on-disk')) hasEpIssue = true
    if (s.epIssues.some(e => e.kind === 'size-mismatch')) hasSizeIssue = true
    if (s.extraOnDisk.length > 0) hasExtra = true
  }
  if (hasEpIssue) epMismatchCount++
  if (hasSizeIssue) sizeMismatchCount++
  if (hasExtra) extraFilesCount++
  if (r.dataMediaSize && r.diskMediaSize && r.dataMediaSize !== r.diskMediaSize) hasMediaSizeIssue = true
  if (hasMediaSizeIssue) mediaSizeMismatchCount++
}

const report = {
  scanDate: new Date().toISOString(),
  summary: {
    totalEntries: results.length,
    ok: okCount,
    folderNotFound: notFoundCount,
    episodeIssues: epMismatchCount,
    sizeMismatches: sizeMismatchCount,
    extraFilesOnDisk: extraFilesCount,
    mediaSizeMismatch: mediaSizeMismatchCount,
    uncatalogedFolders: uncataloged.length,
    diskFolders: FOLDERS.size,
    referencedFolders: referencedFolders.size
  },
  results,
  uncataloged
}

const outPath = path.join(__dirname, 'comparison-report.json')
fs.writeFileSync(outPath, JSON.stringify(report, null, 2))
console.log('\n=== RESUMEN COMPARACION ===')
console.log('  Entradas en datos:        ' + results.length)
console.log('  OK (sin diferencias):    ' + okCount)
console.log('  Carpeta no encontrada:    ' + notFoundCount)
console.log('  Episodios faltantes:      ' + epMismatchCount)
console.log('  Pesos distintos (ep):     ' + sizeMismatchCount)
console.log('  Archivos extra en disco:  ' + extraFilesCount)
console.log('  Tamano media distinto:    ' + mediaSizeMismatchCount)
console.log('  Carpetas en disco:        ' + FOLDERS.size)
console.log('  Carpetas referenciadas:   ' + referencedFolders.size)
console.log('  Carpetas NO catalogadas:  ' + uncataloged.length)
console.log('\nReporte guardado: ' + outPath)
