// Add missing direct movie folders from D:\ to movies.ts
const fs = require('fs')
const path = require('path')

const DATA_FILE = path.join(__dirname, '..', 'src', 'data', 'movies.ts')
const MEDIA_EXT = new Set(['mp4','mkv','avi','mov','wmv','flv','webm','ts','mpg','mpeg','m4v','ogm','rmvb','mts'])

function formatBytes(b) {
  if (!b) return '0 B'
  if (b < 1024) return b + ' B'
  if (b < 1048576) return (b / 1024).toFixed(1) + ' KB'
  if (b < 1073741824) return (b / 1048576).toFixed(1) + ' MB'
  return (b / 1073741824).toFixed(2) + ' GB'
}

function titleFromFolderName(name) {
  let t = name
    .replace(/^\[.*?\]\s*/, '')
    .replace(/\[.*?\]/g, '')
    .replace(/\(.*?\)/g, '')
    .replace(/\d{4}.*$/, '')
    .replace(/\.\w{2,4}$/, '')
    .replace(/^[._!]+/, '')
    .replace(/\s+/g, ' ').trim()
  if (!t) t = name
  return t.replace(/\b\w/g, c => c.toUpperCase())
}

function sanitizeId(name) {
  let id = name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '-')
  id = id.replace(/-+/g, '-').replace(/^-|-$/g, '')
  if (id.length > 80) id = id.substring(0, 80)
  return id
}

// Get all existing IDs from movies.ts
const content = fs.readFileSync(DATA_FILE, 'utf-8')
const usedIds = new Set()
const idMatches = content.matchAll(/^\s*id:\s*'([^']+)'/gm)
for (const m of idMatches) usedIds.add(m[1])

// Get all existing paths
const usedPaths = new Set()
const pathMatch = content.matchAll(/path:\s*'([^']+)'/g)
for (const m of pathMatch) usedPaths.add(m[1])

// Scan D:\ direct children for media
const D_ROOT = 'D:\\'
const entries = []
const entriesDir = fs.readdirSync(D_ROOT, { withFileTypes: true })

for (const entry of entriesDir) {
  if (!entry.isDirectory()) continue
  const fullPath = path.join(D_ROOT, entry.name)
  const dataPath = 'D://' + entry.name

  // Skip if already in data
  if (usedPaths.has(dataPath)) continue
  // Skip category folders
  const lowerName = entry.name.toLowerCase()
  if (lowerName.includes('saga de') || lowerName.includes('ciclo de') ||
      lowerName.includes('peliculas [ sagas') || lowerName.includes('peliculas [ por sagas') ||
      lowerName.includes('- animadas') || lowerName.includes('peliculas ciclo') ||
      lowerName.startsWith('-') || lowerName.includes('$recycle') ||
      lowerName.includes('system volume')) continue

  // Find media files directly in this folder
  const mediaFiles = []
  let subdirs = []
  try {
    const items = fs.readdirSync(fullPath, { withFileTypes: true })
    for (const item of items) {
      if (item.isFile() && MEDIA_EXT.has(path.extname(item.name).toLowerCase().replace('.',''))) {
        try {
          const stat = fs.statSync(path.join(fullPath, item.name))
          mediaFiles.push({ name: item.name, ext: path.extname(item.name).toLowerCase().replace('.',''), size: stat.size })
        } catch {}
      } else if (item.isDirectory()) {
        subdirs.push(item.name)
      }
    }
  } catch { continue }

  if (mediaFiles.length === 0 && subdirs.length === 0) continue

  let title = titleFromFolderName(entry.name)
  let id = sanitizeId(entry.name)
  let n = 2
  while (usedIds.has(id)) { id = sanitizeId(entry.name) + '-' + n; n++ }
  usedIds.add(id)

  if (mediaFiles.length === 1 && subdirs.length === 0) {
    // Single movie
    const f = mediaFiles[0]
    entries.push({
      id, title, type: 'movie', category: 'movie',
      path: dataPath, sizeBytes: f.size,
      singleFile: { name: f.name, format: f.ext, sizeBytes: f.size }
    })
  } else if (mediaFiles.length > 1 && subdirs.length === 0) {
    // Multiple files - could be a saga or series
    const totalSize = mediaFiles.reduce((s, f) => s + f.size, 0)
    const seasons = mediaFiles.map((f, i) => ({
      number: i + 1, episodes: 1, formats: [f.ext.toUpperCase()],
      sizeBytes: f.size, sizeFormatted: formatBytes(f.size),
      episodesList: [{ name: f.name, format: f.ext, sizeBytes: f.size, sizeFormatted: formatBytes(f.size) }]
    }))
    entries.push({
      id, title, type: 'movie', category: 'movie-saga',
      path: dataPath, sizeBytes: totalSize, seasons
    })
  } else if (subdirs.length > 0 && mediaFiles.length === 0) {
    // Only subdirs - check if subdirs have media
    const subMedia = []
    for (const sub of subdirs) {
      const subPath = path.join(fullPath, sub)
      try {
        const subItems = fs.readdirSync(subPath, { withFileTypes: true })
        for (const si of subItems) {
          if (si.isFile() && MEDIA_EXT.has(path.extname(si.name).toLowerCase().replace('.',''))) {
            try {
              const stat = fs.statSync(path.join(subPath, si.name))
              subMedia.push({ name: si.name, ext: path.extname(si.name).toLowerCase().replace('.',''), size: stat.size, subfolder: sub })
            } catch {}
          }
        }
      } catch {}
    }
    if (subMedia.length === 0) continue
    if (subMedia.length === 1) {
      const f = subMedia[0]
      entries.push({
        id, title, type: 'movie', category: 'movie',
        path: dataPath, sizeBytes: f.size,
        singleFile: { name: f.name, format: f.ext, sizeBytes: f.size }
      })
    } else {
      // Saga - each subfolder is a movie
      const totalSize = subMedia.reduce((s, f) => s + f.size, 0)
      const seasons = subMedia.map((f, i) => ({
        number: i + 1, episodes: 1, formats: [f.ext.toUpperCase()],
        sizeBytes: f.size, sizeFormatted: formatBytes(f.size),
        episodesList: [{ name: f.name, format: f.ext, sizeBytes: f.size, sizeFormatted: formatBytes(f.size) }]
      }))
      entries.push({
        id, title, type: 'movie', category: 'movie-saga',
        path: dataPath, sizeBytes: totalSize, seasons
      })
    }
  } else if (subdirs.length > 0 && mediaFiles.length > 0) {
    // Both direct files and subdirs - treat direct files as movies, subdirs as more
    const allMedia = []
    for (const f of mediaFiles) allMedia.push(f)
    for (const sub of subdirs) {
      const subPath = path.join(fullPath, sub)
      try {
        const subItems = fs.readdirSync(subPath, { withFileTypes: true })
        for (const si of subItems) {
          if (si.isFile() && MEDIA_EXT.has(path.extname(si.name).toLowerCase().replace('.',''))) {
            try {
              const stat = fs.statSync(path.join(subPath, si.name))
              allMedia.push({ name: si.name, ext: path.extname(si.name).toLowerCase().replace('.',''), size: stat.size })
            } catch {}
          }
        }
      } catch {}
    }
    if (allMedia.length === 1) {
      const f = allMedia[0]
      entries.push({
        id, title, type: 'movie', category: 'movie',
        path: dataPath, sizeBytes: f.size,
        singleFile: { name: f.name, format: f.ext, sizeBytes: f.size }
      })
    } else {
      const totalSize = allMedia.reduce((s, f) => s + f.size, 0)
      const seasons = allMedia.map((f, i) => ({
        number: i + 1, episodes: 1, formats: [f.ext.toUpperCase()],
        sizeBytes: f.size, sizeFormatted: formatBytes(f.size),
        episodesList: [{ name: f.name, format: f.ext, sizeBytes: f.size, sizeFormatted: formatBytes(f.size) }]
      }))
      entries.push({
        id, title, type: 'movie', category: 'movie-saga',
        path: dataPath, sizeBytes: totalSize, seasons
      })
    }
  }
}

console.log('Entradas nuevas a agregar: ' + entries.length)
for (const e of entries.slice(0, 20)) {
  console.log('  ' + e.title + ' (' + formatBytes(e.sizeBytes) + ')')
}
console.log('  ...')

// Generate TS code for new entries
function tsStr(s) {
  if (s === null || s === undefined) return "''"
  s = String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'")
  return "'" + s + "'"
}

let code = '\n  // PELICULAS NUEVAS (D: directas)\n'
for (const e of entries) {
  code += '  {\n'
  code += '    id: ' + tsStr(e.id) + ',\n'
  code += '    title: ' + tsStr(e.title) + ',\n'
  code += '    type: ' + "'movie'" + ',\n'
  code += '    category: ' + tsStr(e.category) + ',\n'
  if (e.singleFile) {
    code += '    format: ' + tsStr(e.singleFile.format.toUpperCase()) + ',\n'
  }
  code += '    path: ' + tsStr(e.path) + ',\n'
  code += '    sizeBytes: ' + e.sizeBytes + ',\n'
  code += '    sizeFormatted: ' + tsStr(formatBytes(e.sizeBytes)) + ',\n'
  if (e.seasons) {
    code += '    seasons: [\n'
    for (const s of e.seasons) {
      code += '    {\n'
      code += '      number: ' + s.number + ',\n'
      code += '      episodes: 1,\n'
      code += '      formats: ' + (s.formats[0] ? "[ '" + s.formats[0] + "' ]" : '[]') + ',\n'
      code += '      sizeBytes: ' + s.sizeBytes + ',\n'
      code += '      sizeFormatted: ' + tsStr(s.sizeFormatted) + ',\n'
      code += '      episodesList: [\n'
      for (const ep of s.episodesList) {
        code += '        { name: ' + tsStr(ep.name) + ', format: ' + tsStr(ep.format) + ', sizeBytes: ' + ep.sizeBytes + ', sizeFormatted: ' + tsStr(ep.sizeFormatted) + ' },\n'
      }
      code += '      ],\n'
      code += '    },\n'
    }
    code += '    ],\n'
  }
  code += '  },\n'
}

// Insert before the closing ]
const insertPos = content.lastIndexOf('\n]')
const newContent = content.slice(0, insertPos) + code + content.slice(insertPos)
fs.writeFileSync(DATA_FILE, newContent, 'utf-8')
console.log('\nAgregadas ' + entries.length + ' entradas a movies.ts')
