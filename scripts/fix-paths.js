// Genera las correcciones necesarias para paths y episode counts
const fs = require('fs')
const path = require('path')

const DATA_DIR = path.join(__dirname, '..', 'src', 'data')
const FILES = ['movies.ts', 'anime-movies.ts', 'anime-series.ts', 'series.ts']
const MEDIA_EXT = new Set(['.mp4','.mkv','.avi','.mov','.wmv','.flv','.webm','.ts','.mpg','.m4v','.ogm','.rmvb','.mts'])

function resolveBase(rawPath) {
  let p = rawPath
  p = p.replace(/\$1\/\//g, 'H:\\SERIES\\')
  p = p.replace(/\/\/+/g, '\\')
  p = p.replace(/\//g, '\\')
  p = p.replace(/^([A-Z]):\\\\/, '$1:\\')
  p = p.replace(/^([A-Z]):\\/, '$1:\\')
  p = p.replace(/[`'"]/g, '')
  p = p.trim()
  if (p.endsWith('\\')) p = p.slice(0, -1)
  return p
}

function findRealFolder(wantedPath) {
  // Try exact match first
  if (fs.existsSync(wantedPath)) return wantedPath
  
  // For H:\SERIES items, try subdirs
  if (wantedPath.startsWith('H:\\SERIES\\')) {
    const name = wantedPath.slice('H:\\SERIES\\'.length)
    const subdirs = ['(Animadas', '(Persona', 'Completar']
    for (const sub of subdirs) {
      const tryPath = path.join('H:\\SERIES', sub, name)
      if (fs.existsSync(tryPath)) return tryPath
      // Try name matching
      try {
        const subPath = path.join('H:\\SERIES', sub)
        if (fs.existsSync(subPath)) {
          const entries = fs.readdirSync(subPath, { withFileTypes: true })
          for (const e of entries) {
            if (e.isDirectory()) {
              const sim = similarity(e.name.toLowerCase(), name.toLowerCase())
              if (sim > 0.7) return path.join(subPath, e.name)
            }
          }
        }
      } catch {}
    }
  }
  
  // For D:\ items, try fuzzy matching
  const drive = wantedPath.slice(0, 3)
  const rest = wantedPath.slice(3)
  if (fs.existsSync(drive)) {
    try {
      const entries = fs.readdirSync(drive, { withFileTypes: true })
      for (const e of entries) {
        if (e.isDirectory()) {
          const sim = similarity(e.name.toLowerCase(), rest.toLowerCase())
          if (sim > 0.7) return path.join(drive, e.name)
          // Also check if the path is a subfolder match
          if (rest.includes(e.name.toLowerCase()) || e.name.toLowerCase().includes(rest.toLowerCase())) {
            return path.join(drive, e.name)
          }
        }
      }
      // Try in subdirectories like D:\- Animadas
      for (const e of entries) {
        if (e.isDirectory() && (e.name.includes('Animadas') || e.name.includes('Saga') || e.name.includes('Peliculas'))) {
          const sub = path.join(drive, e.name)
          try {
            const subEntries = fs.readdirSync(sub, { withFileTypes: true })
            for (const se of subEntries) {
              if (se.isDirectory()) {
                const sim = similarity(se.name.toLowerCase(), rest.toLowerCase())
                if (sim > 0.7) return path.join(sub, se.name)
              }
            }
          } catch {}
        }
      }
    } catch {}
  }
  
  return null
}

function similarity(a, b) {
  // Simple Jaccard-like similarity
  a = a.replace(/[^a-z0-9]/g, '')
  b = b.replace(/[^a-z0-9]/g, '')
  if (!a || !b) return 0
  const setA = new Set(a.split(''))
  const setB = new Set(b.split(''))
  const intersection = new Set([...setA].filter(x => setB.has(x)))
  const union = new Set([...setA, ...setB])
  return intersection.size / union.size
}

function countMedia(dirPath) {
  if (!dirPath || !fs.existsSync(dirPath)) return 0
  let count = 0
  try {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true })
    for (const e of entries) {
      if (e.isFile() && MEDIA_EXT.has(path.extname(e.name).toLowerCase())) count++
      else if (e.isDirectory()) count += countMedia(path.join(dirPath, e.name))
    }
  } catch {}
  return count
}

// Process all files
const corrections = []

for (const file of FILES) {
  const filePath = path.join(DATA_DIR, file)
  let content = fs.readFileSync(filePath, 'utf-8')
  let updated = 0
  
  // Match path: "..." or path: '...'
  const pathRegex = /path:\s*["'`]([^"'`]+)["'`]/g
  let pm
  while ((pm = pathRegex.exec(content)) !== null) {
    const rawPath = pm[1]
    const base = resolveBase(rawPath)
    const realFolder = findRealFolder(base)
    
    if (!realFolder) continue
    
    // Check if path needs updating
    const newPath = realFolder.replace(/\\/g, '//')
    if (newPath !== rawPath) {
      corrections.push({
        file,
        oldPath: rawPath,
        newPath: newPath,
        realFolder
      })
    }
    
    // Count files
    const count = countMedia(realFolder)
    if (count > 0) {
      // Find and fix episode count
      const blockStart = pm.index
      const searchBlock = content.slice(Math.max(0, blockStart - 200), blockStart + 100)
    }
  }
}

console.log(`Correcciones de paths necesarias: ${corrections.length}`)
for (const c of corrections.slice(0, 30)) {
  console.log(`  ${c.file}: ${c.oldPath} -> ${c.newPath}`)
}

// Save corrections
fs.writeFileSync(path.join(__dirname, 'path-corrections.json'), JSON.stringify(corrections, null, 2))
console.log('\nGuardado en path-corrections.json')
