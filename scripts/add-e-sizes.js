const fs = require('fs')
const path = require('path')

const MEDIA_EXT = new Set(['.mp4','.mkv','.avi','.mov','.wmv','.flv','.webm','.ts','.mpg','.m4v','.ogm','.rmvb','.mts'])

function formatBytes(bytes) {
  if (!bytes || bytes === 0) return '0 B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
  return (bytes / (1024 * 1024 * 1024)).toFixed(2) + ' GB'
}

function getFolderSize(dirPath) {
  if (!fs.existsSync(dirPath)) return 0
  let total = 0
  try {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true })
    for (const e of entries) {
      try {
        if (e.isFile() && MEDIA_EXT.has(path.extname(e.name).toLowerCase())) {
          total += fs.statSync(path.join(dirPath, e.name)).size
        } else if (e.isDirectory()) {
          total += getFolderSize(path.join(dirPath, e.name))
        }
      } catch {}
    }
  } catch {}
  return total
}

// 1. Add sizes to E:\Peliculas entries in movies.ts
const moviesPath = path.join(__dirname, '..', 'src', 'data', 'movies.ts')
let content = fs.readFileSync(moviesPath, 'utf-8')

// Get file sizes from E:\Peliculas
const epDir = 'E:\\Peliculas'
const fileSizes = {}
if (fs.existsSync(epDir)) {
  const files = fs.readdirSync(epDir)
  for (const f of files) {
    const ext = path.extname(f).toLowerCase()
    if (MEDIA_EXT.has(ext)) {
      try { fileSizes[f] = fs.statSync(path.join(epDir, f)).size } catch {}
    }
  }
}

// For each E:\Peliculas entry without sizeBytes, add it
let updated = 0
for (const [fname, size] of Object.entries(fileSizes)) {
  // Find the entry with this path
  const escapedFname = fname.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const pathRegex = new RegExp(`(path:\\s*'E:\\\\Peliculas\\\\${escapedFname}')(\\s*,?\\s*})`, 'g')
  
  if (content.match(pathRegex)) {
    const formatted = formatBytes(size)
    content = content.replace(pathRegex, (match, p1, p2) => {
      return `${p1},\n    sizeBytes: ${size},\n    sizeFormatted: "${formatted}"\n  }`
    })
    updated++
  }
}

fs.writeFileSync(moviesPath, content)
console.log(`movies.ts: ${updated} peliculas E: actualizadas con tamaño`)

// 2. Add sizes to kdrama entries in series.ts
const seriesPath = path.join(__dirname, '..', 'src', 'data', 'series.ts')
content = fs.readFileSync(seriesPath, 'utf-8')

const doramasDir = 'E:\\Doramas'
const folderSizes = {}
if (fs.existsSync(doramasDir)) {
  const dirs = fs.readdirSync(doramasDir, { withFileTypes: true })
  for (const d of dirs) {
    if (!d.isDirectory()) continue
    const size = getFolderSize(path.join(doramasDir, d.name))
    if (size > 0) folderSizes[d.name] = size
  }
}

updated = 0
for (const [dname, size] of Object.entries(folderSizes)) {
  const escapedDname = dname.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const pathRegex = new RegExp(`(path:\\s*'E:\\\\Doramas\\\\${escapedDname}')(\\s*,?\\s*\\n\\s*seasons:)`, 'g')
  
  if (content.match(pathRegex)) {
    const formatted = formatBytes(size)
    content = content.replace(pathRegex, (match, p1) => {
      return `${p1},\n    sizeBytes: ${size},\n    sizeFormatted: "${formatted}",\n    seasons:`
    })
    updated++
  }
}

fs.writeFileSync(seriesPath, content)
console.log(`series.ts: ${updated} kdramas actualizados con tamaño`)
console.log('\nListo.')
