// ============================================================================
// rebuild-data.js
// Reconstruye los 4 archivos de datos del proyecto desde el disco real:
//  - Para cada entrada existente: encuentra su carpeta real en disco,
//    reconstruye episodesList con nombres y pesos exactos, actualiza path,
//    totales de temporada y de media. Preserva metadatos (id, title, year,
//    studio, genres, poster, notes, category, type, etc.).
//  - Para carpetas en disco no referenciadas: crea entradas nuevas con
//    categorizacion automatica segun la ruta.
// Genera: movies.ts, anime-movies.ts, anime-series.ts, series.ts
// ============================================================================

const fs = require('fs')
const path = require('path')

const DATA_DIR = path.join(__dirname, '..', 'src', 'data')
const TREE = JSON.parse(fs.readFileSync(path.join(__dirname, 'disk-tree.json'), 'utf-8'))

const MEDIA_EXT = new Set(['mp4','mkv','avi','mov','wmv','flv','webm','ts','mpg','mpeg','m4v','ogm','rmvb','mts'])

// ---- Disk tree index ----
const NODES = new Map()       // fullPath -> node
const ALL_NODES = []          // all nodes for fuzzy matching
for (const f of TREE.folders) {
  NODES.set(f.path, f)
  ALL_NODES.push(f)
}

function formatBytes(b) {
  if (!b || b === 0) return '0 B'
  if (b < 1024) return b + ' B'
  if (b < 1048576) return (b / 1024).toFixed(1) + ' KB'
  if (b < 1073741824) return (b / 1048576).toFixed(1) + ' MB'
  return (b / 1073741824).toFixed(2) + ' GB'
}

// ---- Normalization ----
function norm(s) {
  return s.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // quitar acentos
    .replace(/[^a-z0-9]/g, '')
}

function normTokens(s) {
  return s.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .filter(t => t.length > 1)
}

// ---- Path resolution ----
function resolveRawPath(rawPath) {
  if (!rawPath) return []
  const parts = rawPath.split(';').map(p => p.trim()).filter(Boolean)
  return parts.map(p => {
    let s = p
    s = s.replace(/\$1\/\//g, 'H:\\SERIES\\').replace(/\$1\\/g, 'H:\\SERIES\\')
    s = s.replace(/\/\/+/g, '\\').replace(/\//g, '\\')
    s = s.replace(/^([A-Za-z]):\\\\/, '$1:\\')
    s = s.replace(/[`'"]/g, '').trim()
    if (s.endsWith('\\')) s = s.slice(0, -1)
    return s
  })
}

const ROOTS_SET = new Set(['D:\\', 'E:\\Doramas', 'E:\\Peliculas', 'F:\\', 'H:\\SERIES'])
const COMMON_WORDS = new Set(['the','a','an','of','and','or','el','la','los','las','de','del','y','en','saga','series','serie','movie','pelicula','peli','peliculas','cap','capitulo','temp','temporada','season','part','hd','dual','audio','latino','español','espanol','acc','ave','1080p','720p','480p','bluray','webrip','web','rip','mkv','mp4','avi','new','nuevos','nuevo','complete','coleccion','collection','trilogy','trilogia','ciclo','clasicos','filmes','animadas','animada','persona','personajes','completar'])

// ---- Explicit overrides for entries that fuzzy matching can't resolve ----
// (Spanish/Japanese names, file paths, special structures)
// Each value: { folder: '...' } or { file: '...' } or { merge: true, folder: '...' }
const OVERRIDES = {
  // Sagas with Spanish folder names
  'friday-the-13th-saga': { folder: 'D:\\Peliculas [ Sagas [HD]  Viernes 13]' },
  'marvel-cinematic-universe': { folder: 'D:\\Saga de Marvel' },
  'how-to-train-your-dragon': { folder: 'D:\\- Animadas\\! Ciclo de Sagas [Como Entrenar A Tu Dragon]' },
  'dragons-dawn-of-the-dragon-racers': { folder: 'D:\\- Animadas\\! Ciclo de Sagas [Como Entrenar A Tu Dragon]\\Dragones El Origen De Las Carreras De Dragones (2014)' },
  // Animated movies with Spanish names
  '101-dalmatians': { folder: 'D:\\- Animadas\\101 Dalmatas [1961]' },
  'ballerina': { folder: 'D:\\- Animadas\\Bailarina' },
  'the-iron-giant': { folder: 'D:\\- Animadas\\El Gigante de Hierro (1999)' },
  'the-lion-king': { file: 'D:\\- Animadas\\El Rey Leon\\The Lion King [1994] [720p].mp4' },
  'the-lion-king-2': { folder: 'D:\\- Animadas\\El Rey Leon\\El Rey Leon 2 El Tesoro de Simba [1998]' },
  'the-lion-king-3': { folder: 'D:\\- Animadas\\El Rey Leon\\El Rey Leon 3 Hakuna Matata [2004]' },
  'brother-bear': { folder: 'D:\\- Animadas\\Hermano Oso (2003)' },
  'the-little-mermaid': { folder: 'D:\\- Animadas\\La Sirenita\\La Sirenita (1989)' },
  'the-little-mermaid-2': { folder: 'D:\\- Animadas\\La Sirenita\\La Sirenita II. Regreso al oceano [2000]' },
  'a-turtles-tale': { folder: 'D:\\- Animadas\\Las Aventuras De Sammy I Un Viaje Extraordinario (2010)' },
  'spongebob-patricio-esponja': { folder: 'D:\\- Animadas\\Bob Esponja - Patricio Esponja' },
  'the-emoji-movie': { folder: 'D:\\- Animadas\\Emoji [2017]' },
  // Single movie files at drive root
  'madame-web': { file: 'D:\\Madame_Web-high.mp4' },
  'wish-dragon': { file: 'D:\\Wish Dragon [2021] [720p] [Dual Audio].mkv' },
  // Anime movies with Japanese disk names
  'josee-the-tiger-and-the-fish': { folder: 'F:\\Pelis\\Josee to Tora to Sakana tachi' },
  'the-tunnel-to-summer-the-exit-of-goodbyes': { folder: 'F:\\Pelis\\Natsu e no Tunnel, Sayonara no Deguchi' },
  'japan-sinks': { folder: 'F:\\Japón se hunde' },
  // Spider-Man Raimi - point to parent
  'spider-man-raimi-trilogy': { folder: 'D:\\Spiderman viejo' },
  // Sagas that matched to a sub-folder instead of parent
  'pirates-of-the-caribbean-saga': { folder: 'D:\\Peliculas [ Sagas [HD]  Piratas del Caribe]' },
  'resident-evil-saga': { folder: 'D:\\Peliculas [ Sagas [HD]  Resident Evil]' },
}

function keyTokens(s) {
  const toks = normTokens(s)
  return toks.filter(t => t.length >= 3 && !COMMON_WORDS.has(t))
}

function scoreNameMatch(queryNorm, folderNorm, queryTokens, folderTokens) {
  if (!folderNorm || folderNorm.length < 3) return 0
  if (queryNorm === folderNorm) return 1.0
  let score = 0
  if (queryNorm.length >= 4 && folderNorm.includes(queryNorm)) score = Math.max(score, 0.86)
  if (queryNorm.length >= 4 && folderNorm.length >= 4 && queryNorm.includes(folderNorm)) score = Math.max(score, 0.82)
  // Key token overlap
  const qKey = new Set(queryTokens.filter(t => !COMMON_WORDS.has(t) && t.length >= 3))
  const fKey = new Set(folderTokens.filter(t => !COMMON_WORDS.has(t) && t.length >= 3))
  if (qKey.size > 0 && fKey.size > 0) {
    let common = 0
    for (const t of qKey) if (fKey.has(t)) common++
    if (common > 0) {
      const union = qKey.size + fKey.size - common
      const jaccard = common / union
      // Reward high overlap
      const tokenScore = 0.5 + jaccard * 0.35
      if (tokenScore > score) score = tokenScore
      // If all query key tokens are in folder, boost
      if (common === qKey.size) score = Math.max(score, 0.80 + jaccard * 0.1)
    }
  }
  return score
}

// ---- Find disk folder for a data entry ----
function findDiskFolder(rawPath, title) {
  const wanted = resolveRawPath(rawPath)
  const candidates = []
  const titleNorm = norm(title)
  const titleTokens = normTokens(title)
  const rawDrive = wanted.length > 0 ? wanted[0][0].toUpperCase() : ''

  // 1) Exact path match (or file path -> single file entry)
  for (const w of wanted) {
    if (ROOTS_SET.has(w) || w.length <= 3) continue  // skip bare drive roots
    if (NODES.has(w)) {
      candidates.push({ path: w, score: 1.0, reason: 'exact-path' })
      continue
    }
    if (fs.existsSync(w)) {
      try {
        const stat = fs.statSync(w)
        if (stat.isDirectory()) {
          candidates.push({ path: w, score: 0.98, reason: 'fs-exists-dir' })
        } else {
          // It's a file - mark as single file. Only use parent if parent is NOT a root drive.
          const parent = path.dirname(w)
          if (!ROOTS_SET.has(parent) && parent.length > 3) {
            candidates.push({ path: parent, score: 0.96, reason: 'file-parent' })
          }
          // Also mark the file itself for single-file handling
          candidates.push({ path: w, score: 0.97, reason: 'single-file', isFile: true, fileSize: stat.size })
        }
      } catch {}
    }
  }

  // 2) Parent + basename fuzzy: search direct children of each wanted path's parent
  for (const w of wanted) {
    const parent = path.dirname(w)
    const wantedBase = path.basename(w)
    const wantedBaseNorm = norm(wantedBase)
    const wantedBaseTokens = normTokens(wantedBase)
    if (wantedBaseNorm.length >= 2 && fs.existsSync(parent)) {
      try {
        const entries = fs.readdirSync(parent, { withFileTypes: true })
        for (const e of entries) {
          if (!e.isDirectory()) continue
          const en = norm(e.name)
          if (en.length < 2) continue
          let score = 0
          if (en === wantedBaseNorm) score = 0.95
          else score = scoreNameMatch(wantedBaseNorm, en, wantedBaseTokens, normTokens(e.name))
          if (score > 0.7) candidates.push({ path: path.join(parent, e.name), score: score - 0.05, reason: 'parent-fuzzy' })
        }
      } catch {}
    }
  }

  // 3) Global search by rawPath basename (catches nested folders)
  for (const w of wanted) {
    const wantedBase = path.basename(w)
    const wantedBaseNorm = norm(wantedBase)
    const wantedBaseTokens = normTokens(wantedBase)
    if (wantedBaseNorm.length < 3) continue
    for (const node of ALL_NODES) {
      if (ROOTS_SET.has(node.path)) continue
      const folderNorm = norm(node.name)
      if (folderNorm.length < 3) continue
      const score = scoreNameMatch(wantedBaseNorm, folderNorm, wantedBaseTokens, normTokens(node.name))
      if (score > 0.7) {
        let s = score - 0.03 // slight penalty vs parent-fuzzy
        if (rawDrive && node.path.startsWith(rawDrive + ':')) s += 0.03
        candidates.push({ path: node.path, score: s, reason: 'basename-global:' + node.name })
      }
    }
  }

  // 4) Global search by title
  for (const node of ALL_NODES) {
    if (ROOTS_SET.has(node.path)) continue
    const folderNorm = norm(node.name)
    if (folderNorm.length < 3) continue
    const score = scoreNameMatch(titleNorm, folderNorm, titleTokens, normTokens(node.name))
    if (score > 0.7) {
      let s = score - 0.06 // title match is weaker than path match
      if (rawDrive && node.path.startsWith(rawDrive + ':')) s += 0.03
      candidates.push({ path: node.path, score: s, reason: 'title-global:' + node.name })
    }
  }

  if (candidates.length === 0) return null
  // Deduplicate by path keeping best score
  const byPath = new Map()
  for (const c of candidates) {
    // Skip root drives as candidates
    if (ROOTS_SET.has(c.path) || c.path.length <= 3) continue
    if (!byPath.has(c.path) || byPath.get(c.path).score < c.score) byPath.set(c.path, c)
  }
  const unique = Array.from(byPath.values())
  if (unique.length === 0) return null
  unique.sort((a, b) => b.score - a.score)
  return unique[0]
}

// ---- Season number extraction ----
function extractSeasonNumber(name) {
  const patterns = [
    /[Ss]\s*0*(\d+)\b\s*[Ee]/, // S01E
    /[Ss]\s*0*(\d+)\b/,        // S01
    /[Tt]\s*0*(\d+)\b/,        // T01
    /Season\s*0*(\d+)/i,
    /Temporada\s*0*(\d+)/i,
    /0*(\d+)\s*[Xx]\s*\d/,     // 1x01
  ]
  for (const p of patterns) {
    const m = name.match(p)
    if (m) return parseInt(m[1])
  }
  // First standalone number 1-99
  const m = name.match(/\b0*(\d{1,2})\b/)
  if (m) return parseInt(m[1])
  return null
}

function extractEpisodeNumber(name) {
  const patterns = [
    /[Ss]\d+[Ee]\s*0*(\d+)/,
    /0*(\d+)\s*[Xx]\s*0*(\d+)/,
    /[Ee][Pp]?\s*0*(\d+)/,
    /[Cc]ap[ií]tulo\s*0*(\d+)/i,
    /\b0*(\d+)\b/,
  ]
  for (const p of patterns) {
    const m = name.match(p)
    if (m) return parseInt(m[m.length - 1])
  }
  return null
}

// ---- Build seasons from a disk folder ----
// Returns: { seasons: [{ number, episodes, formats, sizeBytes, episodesList, folder, notes? }], totalSize }
function buildSeasonsFromFolder(folderNode, isMovieType) {
  const seasons = []

  // Gather media sub-folders (children that have media)
  const mediaSubdirs = []
  for (const sub of folderNode.subdirs) {
    const subNode = NODES.get(sub.path)
    if (subNode && (subNode.hasMedia || subNode.hasMediaDescendant)) {
      mediaSubdirs.push(subNode)
    }
  }

  // Sort sub-folders by season number, then by name
  mediaSubdirs.sort((a, b) => {
    const sa = extractSeasonNumber(a.name) ?? 999
    const sb = extractSeasonNumber(b.name) ?? 999
    if (sa !== sb) return sa - sb
    return a.name.localeCompare(b.name, undefined, { numeric: true })
  })

  const directFiles = folderNode.files

  if (isMovieType) {
    // For movies/sagas: each file is its own "season" (1 episode = 1 movie)
    // Sub-folders are also each one movie (1 season)
    let num = 1
    // First, direct files (each is a movie)
    for (const f of directFiles) {
      seasons.push(buildSeasonFromFiles([f], num, folderNode.path))
      num++
    }
    // Then, sub-folders (each is a movie)
    for (const sub of mediaSubdirs) {
      // If sub-folder has its own sub-sub-folders with media, flatten
      const subSubs = []
      for (const ss of sub.subdirs) {
        const ssNode = NODES.get(ss.path)
        if (ssNode && (ssNode.hasMedia || ssNode.hasMediaDescendant)) subSubs.push(ssNode)
      }
      if (subSubs.length > 0 && sub.files.length === 0) {
        subSubs.sort((a, b) => {
          const sa = extractSeasonNumber(a.name) ?? 999
          const sb = extractSeasonNumber(b.name) ?? 999
          if (sa !== sb) return sa - sb
          return a.name.localeCompare(b.name, undefined, { numeric: true })
        })
        for (const sss of subSubs) {
          seasons.push(buildSeasonFromSingleFolder(sss, num, true))
          num++
        }
      } else {
        seasons.push(buildSeasonFromSingleFolder(sub, num, true))
        num++
      }
    }
  } else if (mediaSubdirs.length > 0 && directFiles.length === 0) {
    // Series: all media is in sub-folders -> each sub-folder is a season
    let num = 1
    for (const sub of mediaSubdirs) {
      const subSubs = []
      for (const ss of sub.subdirs) {
        const ssNode = NODES.get(ss.path)
        if (ssNode && (ssNode.hasMedia || ssNode.hasMediaDescendant)) subSubs.push(ssNode)
      }
      if (subSubs.length > 0 && sub.files.length === 0) {
        subSubs.sort((a, b) => {
          const sa = extractSeasonNumber(a.name) ?? 999
          const sb = extractSeasonNumber(b.name) ?? 999
          if (sa !== sb) return sa - sb
          return a.name.localeCompare(b.name, undefined, { numeric: true })
        })
        for (const sss of subSubs) {
          seasons.push(buildSeasonFromSingleFolder(sss, num, false))
          num++
        }
      } else {
        seasons.push(buildSeasonFromSingleFolder(sub, num, false))
        num++
      }
    }
  } else if (mediaSubdirs.length > 0 && directFiles.length > 0) {
    // Series with both direct files and sub-folders
    if (directFiles.length > 1) {
      seasons.push(buildSeasonFromFiles(directFiles, 1, folderNode.path))
    } else {
      seasons.push(buildSeasonFromFiles(directFiles, 1, folderNode.path))
    }
    let num = 2
    for (const sub of mediaSubdirs) {
      seasons.push(buildSeasonFromSingleFolder(sub, num, false))
      num++
    }
  } else {
    // Only direct files -> single season
    seasons.push(buildSeasonFromSingleFolder(folderNode, 1, false, directFiles))
  }

  // Renumber seasons sequentially
  seasons.forEach((s, i) => { s.number = i + 1 })

  const totalSize = seasons.reduce((t, s) => t + s.sizeBytes, 0)
  return { seasons, totalSize }
}

function buildSeasonFromSingleFolder(folderNode, number, isMovieType, overrideFiles) {
  // If folder has sub-folders with media but also we want to use direct files only,
  // use overrideFiles. Otherwise gather all media recursively? No - use direct files
  // of this folder only (sub-folders are separate seasons).
  const files = overrideFiles || folderNode.files
  return buildSeasonFromFiles(files, number, folderNode.path)
}

function buildSeasonFromFiles(files, number, folderPath) {
  const sorted = [...files].sort((a, b) => {
    const ea = extractEpisodeNumber(a.name) ?? 9999
    const eb = extractEpisodeNumber(b.name) ?? 9999
    if (ea !== eb) return ea - eb
    return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' })
  })
  const episodesList = sorted.map(f => ({
    name: f.name,
    format: f.ext,
    sizeBytes: f.size,
    sizeFormatted: formatBytes(f.size)
  }))
  const formats = [...new Set(sorted.map(f => f.ext.toUpperCase()))]
  const sizeBytes = sorted.reduce((t, f) => t + f.size, 0)
  return {
    number,
    episodes: sorted.length,
    formats,
    sizeBytes,
    sizeFormatted: formatBytes(sizeBytes),
    episodesList,
    folder: folderPath
  }
}

// ---- Path formatting (for data files) ----
function formatPathForData(fullPath) {
  // D:\Folder\Sub -> D://Folder//Sub
  return fullPath.replace(/\\/g, '//')
}

// ---- Parse existing data files ----
function parseDataFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8')
  const entries = []
  const idRegex = /\n(\s*)id:\s*["'`]([^"'`]+)["'`]/g
  const positions = []
  let m
  while ((m = idRegex.exec(content)) !== null) {
    // Find the opening '{' before this id: (search backwards)
    let braceStart = m.index
    for (let i = m.index; i >= 0; i--) {
      if (content[i] === '{') { braceStart = i; break }
    }
    positions.push({ index: braceStart, idIndex: m.index, id: m[2] })
  }
  for (let i = 0; i < positions.length; i++) {
    const start = positions[i].index
    const end = i + 1 < positions.length ? positions[i + 1].index : content.length
    const block = content.slice(start, end)

    // Regex that matches string values including escaped quotes.
    const SQ = "'((?:[^'\\\\]|\\\\.)*)'"
    const DQ = '"((?:[^"\\\\]|\\\\.)*)"'
    const BT = '`((?:[^`\\\\]|\\\\.)*)`'
    const STR = '(?:' + SQ + '|' + DQ + '|' + BT + ')'

    function getField(fieldName) {
      const re = new RegExp(fieldName + ':\\s*' + STR)
      const m = block.match(re)
      if (!m) return null
      let raw = null
      for (let g = 1; g <= 3; g++) { if (m[g] !== undefined) { raw = m[g]; break } }
      if (raw === null) return null
      return raw.replace(/\\(['"`])/g, '$1').replace(/\\\\/g, '\\')
    }
    const getNum = (re) => { const m = block.match(re); return m ? parseInt(m[1]) : null }

    const id = positions[i].id
    const title = getField('title')
    const type = getField('type')
    const category = getField('category')
    const rawPath = getField('path')
    const year = getNum(/year:\s*(\d+)/)
    const studio = getField('studio')
    const poster = getField('poster')
    const format = getField('format')
    const resolution = getField('resolution')
    const audio = getField('audio')
    const episodes = getNum(/^\s*episodes:\s*(\d+)/m)

    // Entry-level notes: only those that appear BEFORE 'seasons:' keyword
    const seasonsPos = block.search(/\n\s*seasons:\s*\[/)
    const beforeSeasons = seasonsPos >= 0 ? block.slice(0, seasonsPos) : block
    const notesMatch = beforeSeasons.match(new RegExp('notes:\\s*' + STR))
    const notes = notesMatch ? (notesMatch[1] || notesMatch[2] || notesMatch[3]).replace(/\\(['"`])/g, '$1').replace(/\\\\/g, '\\') : null

    // genres array
    let genres = null
    const genresMatch = block.match(/genres:\s*\[([^\]]*)\]/)
    if (genresMatch) {
      genres = genresMatch[1].split(',').map(g => g.trim().replace(/["'`]/g, '')).filter(Boolean)
    }

    // season notes (preserve curated notes per season number)
    const seasonNotes = {}
    const seasonStarts = []
    const sStartRegex = /\{\s*number:\s*(\d+)/g
    let sm
    while ((sm = sStartRegex.exec(block)) !== null) {
      seasonStarts.push({ index: sm.index, number: parseInt(sm[1]) })
    }
    for (let j = 0; j < seasonStarts.length; j++) {
      const sStart = seasonStarts[j].index
      const sEnd = j + 1 < seasonStarts.length ? seasonStarts[j + 1].index : block.length
      const sBlock = block.slice(sStart, sEnd)
      const sNotesMatch = sBlock.match(new RegExp('notes:\\s*' + STR))
      if (sNotesMatch) {
        const sn = sNotesMatch[1] || sNotesMatch[2] || sNotesMatch[3]
        if (sn) seasonNotes[seasonStarts[j].number] = sn.replace(/\\(['"`])/g, '$1').replace(/\\\\/g, '\\')
      }
    }
    const seasonCount = seasonStarts.length

    entries.push({
      id, title, type, category, rawPath, year, studio, poster, notes,
      format, resolution, audio, episodes, genres, seasonNotes, seasonCount,
      file: path.basename(filePath),
      rawBlock: block.replace(/\]\s*$/, '').trim()
    })
  }
  return entries
}

// ============================================================================
// MAIN
// ============================================================================
console.log('Cargando datos del proyecto...')
let allEntries = []
for (const f of ['movies.ts', 'anime-movies.ts', 'anime-series.ts', 'series.ts']) {
  const fp = path.join(DATA_DIR, f)
  if (!fs.existsSync(fp)) continue
  const e = parseDataFile(fp)
  console.log('  ' + f + ': ' + e.length + ' entradas')
  allEntries.push(...e)
}
console.log('Total: ' + allEntries.length + ' entradas')

// Match and rebuild each entry
const referencedFolders = new Set()
const rebuilt = []
const notMatched = []
const matchLog = []

for (const entry of allEntries) {
  // Check explicit override first
  const override = OVERRIDES[entry.id]

  if (override && override.file) {
    // Single file override -> single movie (no seasons)
    if (fs.existsSync(override.file)) {
      try {
        const stat = fs.statSync(override.file)
        if (stat.isFile()) {
          const ext = path.extname(override.file).toLowerCase().replace('.', '')
          if (MEDIA_EXT.has(ext)) {
            const fileName = path.basename(override.file)
            const size = stat.size
            referencedFolders.add(path.dirname(override.file))
            matchLog.push({ id: entry.id, title: entry.title, matchedTo: override.file, score: 1.0, reason: 'override-file', seasons: 0 })
            rebuilt.push({
              entry,
              diskFolder: { path: path.dirname(override.file), name: path.basename(path.dirname(override.file)), files: [], subdirs: [], hasMedia: false, hasMediaDescendant: false },
              seasons: null,  // single movie: no seasons
              totalSize: size,
              isSingleFile: true,
              singleFile: { name: fileName, format: ext, sizeBytes: size }
            })
            continue
          }
        }
      } catch {}
    }
  }

  let match = null
  if (override && override.folder) {
    // Folder override
    if (NODES.has(override.folder)) {
      match = { path: override.folder, score: 1.0, reason: 'override-folder' }
    } else if (fs.existsSync(override.folder) && fs.statSync(override.folder).isDirectory()) {
      match = { path: override.folder, score: 1.0, reason: 'override-folder-fs' }
    }
  }

  if (!match) {
    match = findDiskFolder(entry.rawPath, entry.title)
  }

  if (!match) {
    notMatched.push(entry)
    rebuilt.push({ entry, diskFolder: null, seasons: null, totalSize: null })
    continue
  }

  // Handle single-file match -> single movie (no seasons)
  if (match.isFile) {
    const filePath = match.path
    const ext = path.extname(filePath).toLowerCase().replace('.', '')
    if (MEDIA_EXT.has(ext)) {
      const fileName = path.basename(filePath)
      const size = match.fileSize || fs.statSync(filePath).size
      referencedFolders.add(path.dirname(filePath))
      matchLog.push({ id: entry.id, title: entry.title, matchedTo: filePath, score: match.score, reason: match.reason, seasons: 0 })
      rebuilt.push({
        entry,
        diskFolder: { path: path.dirname(filePath), name: path.basename(path.dirname(filePath)), files: [], subdirs: [], hasMedia: false, hasMediaDescendant: false },
        seasons: null,  // single movie: no seasons
        totalSize: size,
        isSingleFile: true,
        singleFile: { name: fileName, format: ext, sizeBytes: size }
      })
      continue
    }
  }

  const folderNode = NODES.get(match.path) || buildSyntheticNode(match.path)

  if (!folderNode || ROOTS_SET.has(match.path)) {
    notMatched.push(entry)
    rebuilt.push({ entry, diskFolder: null, seasons: null, totalSize: null })
    continue
  }

  const isMovieType = entry.type === 'movie' || entry.type === 'anime-movie'

  // Count total media files (direct + in sub-folders)
  let totalMediaCount = folderNode.files.length
  for (const sub of folderNode.subdirs) {
    const subNode = NODES.get(sub.path)
    if (subNode && (subNode.hasMedia || subNode.hasMediaDescendant)) totalMediaCount += subNode.files.length
  }
  // Also count deeper for sagas where each movie is in its own subfolder
  function countAllMedia(node) {
    let c = node.files.length
    for (const sub of node.subdirs) {
      const subNode = NODES.get(sub.path)
      if (subNode) c += countAllMedia(subNode)
    }
    return c
  }
  totalMediaCount = countAllMedia(folderNode)

  // For movie types: if only 1 media file total -> single movie (no seasons)
  if (isMovieType && totalMediaCount === 1) {
    // Find the single media file (could be direct or in a sub-folder)
    let singleFile = null
    let singleFolder = folderNode.path
    if (folderNode.files.length === 1) {
      singleFile = folderNode.files[0]
    } else {
      // Search sub-folders for the single media file
      function findSingle(node) {
        if (node.files.length === 1) return { file: node.files[0], folder: node.path }
        for (const sub of node.subdirs) {
          const subNode = NODES.get(sub.path)
          if (subNode && (subNode.hasMedia || subNode.hasMediaDescendant)) {
            const r = findSingle(subNode)
            if (r) return r
          }
        }
        return null
      }
      const r = findSingle(folderNode)
      if (r) { singleFile = r.file; singleFolder = r.folder }
    }
    if (singleFile) {
      referencedFolders.add(singleFolder)
      markReferenced(folderNode, referencedFolders)
      matchLog.push({ id: entry.id, title: entry.title, matchedTo: match.path, score: match.score, reason: match.reason, seasons: 0 })
      rebuilt.push({
        entry,
        diskFolder: folderNode,
        seasons: null,  // single movie: no seasons
        totalSize: singleFile.size,
        isSingleFile: true,
        singleFile: { name: singleFile.name, format: singleFile.ext, sizeBytes: singleFile.size }
      })
      continue
    }
  }

  const { seasons, totalSize } = buildSeasonsFromFolder(folderNode, isMovieType)

  // Preserve season notes: try to match by content (year or key tokens in file name)
  const usedNotes = new Set()
  const origNoteList = Object.entries(entry.seasonNotes).map(([num, note]) => ({ num: parseInt(num), note }))
  seasons.forEach((s, idx) => {
    // 1) Try exact index match first
    const origNumber = idx + 1
    if (entry.seasonNotes[origNumber] && !usedNotes.has(origNumber)) {
      // Check if the file name roughly matches the note
      const fileStr = (s.episodesList || []).map(e => e.name).join(' ').toLowerCase()
      const noteLower = entry.seasonNotes[origNumber].toLowerCase()
      const noteYear = noteLower.match(/\((\d{4})\)/)
      if (noteYear && fileStr.includes(noteYear[1])) {
        s.notes = entry.seasonNotes[origNumber]
        usedNotes.add(origNumber)
        return
      }
    }
    // 2) Try matching by year extracted from file name
    const fileStr = (s.episodesList || []).map(e => e.name).join(' ')
    const yearMatch = fileStr.match(/(?:19|20)\d{2}/)
    if (yearMatch) {
      const year = yearMatch[0]
      const match = origNoteList.find(n => !usedNotes.has(n.num) && n.note.includes(year))
      if (match) {
        s.notes = match.note
        usedNotes.add(match.num)
        return
      }
    }
    // 3) Try matching by key tokens
    const fileTokens = new Set(normTokens(fileStr))
    let bestMatch = null
    let bestScore = 0
    for (const n of origNoteList) {
      if (usedNotes.has(n.num)) continue
      const noteTokens = new Set(normTokens(n.note))
      let common = 0
      for (const t of noteTokens) if (fileTokens.has(t)) common++
      const score = noteTokens.size > 0 ? common / noteTokens.size : 0
      if (score > bestScore) { bestScore = score; bestMatch = n }
    }
    if (bestMatch && bestScore > 0.3) {
      s.notes = bestMatch.note
      usedNotes.add(bestMatch.num)
      return
    }
    // 4) Fallback: use index match if available
    if (entry.seasonNotes[origNumber] && !usedNotes.has(origNumber)) {
      s.notes = entry.seasonNotes[origNumber]
      usedNotes.add(origNumber)
    }
  })

  referencedFolders.add(folderNode.path)
  markReferenced(folderNode, referencedFolders)

  matchLog.push({ id: entry.id, title: entry.title, matchedTo: match.path, score: match.score, reason: match.reason, seasons: seasons.length })

  rebuilt.push({ entry, diskFolder: folderNode, seasons, totalSize })
}

function buildSyntheticNode(dirPath) {
  if (!fs.existsSync(dirPath) || !fs.statSync(dirPath).isDirectory()) return null
  const node = { path: dirPath, name: path.basename(dirPath), files: [], subdirs: [], hasMedia: false, hasMediaDescendant: false, recursiveSize: 0 }
  try {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true })
    for (const e of entries) {
      const full = path.join(dirPath, e.name)
      if (e.isDirectory()) {
        const child = NODES.get(full) || buildSyntheticNode(full)
        if (child && (child.hasMedia || child.hasMediaDescendant)) {
          node.hasMediaDescendant = true
          node.subdirs.push({ name: e.name, path: full })
          node.recursiveSize += child.recursiveSize
        }
      } else if (e.isFile() && MEDIA_EXT.has(path.extname(e.name).toLowerCase().replace('.', ''))) {
        try {
          const size = fs.statSync(full).size
          node.files.push({ name: e.name, ext: path.extname(e.name).toLowerCase().replace('.', ''), size })
          node.hasMedia = true
          node.recursiveSize += size
        } catch {}
      }
    }
    node.files.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }))
  } catch {}
  return node
}

function markReferenced(folderNode, refSet) {
  refSet.add(folderNode.path)
  for (const sub of folderNode.subdirs) {
    const subNode = NODES.get(sub.path)
    if (subNode) markReferenced(subNode, refSet)
  }
}

// Summary
let matchedCount = rebuilt.filter(r => r.diskFolder).length
console.log('\n=== MATCHING ===')
console.log('  Matched: ' + matchedCount + '/' + allEntries.length)
console.log('  No matcheadas: ' + notMatched.length)
console.log('  Carpetas referenciadas: ' + referencedFolders.size)

// Detect duplicate folders: folders whose normalized name matches the title of
// an already-matched entry, or that are inside a matched folder. Mark them as
// referenced to avoid creating duplicate entries (the matched entry wins).
const matchedTitles = new Map()  // normTitle -> entryId
for (const r of rebuilt) {
  if (r.entry && r.diskFolder) {
    matchedTitles.set(norm(r.entry.title), r.entry.id)
  }
}
const matchedFolderNames = new Set()
for (const r of rebuilt) {
  if (r.diskFolder) matchedFolderNames.add(norm(path.basename(r.diskFolder.path)))
}
const matchedSagas = new Map()  // normTitle -> entryId, only for sagas (movie/anime-movie with multiple files)
for (const r of rebuilt) {
  if (r.entry && r.diskFolder && (r.entry.type === 'movie' || r.entry.type === 'anime-movie') && r.seasons && r.seasons.length > 1) {
    // Use both title and folder basename for matching
    matchedSagas.set(norm(r.entry.title), r.entry.id)
    matchedSagas.set(norm(path.basename(r.diskFolder.path)), r.entry.id)
  }
}

let duplicatesSkipped = 0
for (const node of ALL_NODES) {
  if (ROOTS_SET.has(node.path)) continue
  if (referencedFolders.has(node.path)) continue
  const nodeNorm = norm(node.name)
  const parentName = norm(path.basename(path.dirname(node.path)))
  let isDup = false
  if (matchedTitles.has(nodeNorm)) isDup = true
  if (matchedTitles.has(parentName)) isDup = true
  if (matchedFolderNames.has(nodeNorm)) isDup = true
  if (matchedFolderNames.has(parentName)) isDup = true
  // For sagas only: "Step Up 1" contains saga title "Step Up" -> duplicate
  if (!isDup) {
    for (const [titleNorm] of matchedSagas) {
      if (titleNorm.length >= 4 && (nodeNorm.startsWith(titleNorm) || parentName.startsWith(titleNorm))) {
        isDup = true
        break
      }
    }
  }
  if (!isDup) {
    for (const r of rebuilt) {
      if (!r.diskFolder) continue
      if (node.path.startsWith(r.diskFolder.path + '\\')) { isDup = true; break }
    }
  }
  if (isDup) {
    referencedFolders.add(node.path)
    duplicatesSkipped++
  }
}
if (duplicatesSkipped > 0) {
  console.log('  Duplicados omitidos: ' + duplicatesSkipped)
}

// ============================================================================
// Find uncataloged folders (media leaf folders not referenced by any entry)
// Group by parent to form new entries.
// ============================================================================
const uncatalogedLeafs = []
for (const node of ALL_NODES) {
  if (ROOTS_SET.has(node.path)) continue
  if (!node.hasMedia) continue  // only leaf folders with direct media
  if (referencedFolders.has(node.path)) continue
  uncatalogedLeafs.push(node)
}

// Group by parent
const uncatalogedByParent = new Map()  // parentPath -> { parent, leafs: [] }
for (const leaf of uncatalogedLeafs) {
  const parentPath = path.dirname(leaf.path)
  if (!uncatalogedByParent.has(parentPath)) {
    uncatalogedByParent.set(parentPath, { parent: parentPath, leafs: [] })
  }
  uncatalogedByParent.get(parentPath).leafs.push(leaf)
}

// But some parents might themselves be uncataloged ancestors (no media directly,
// only sub-folders). And some parents are already referenced (part of existing entry).
// A parent is "available for new entry" if it's not in referencedFolders.
// Also, if the parent is a root or already-referenced, the leafs are standalone items.

function categorizeByPath(folderPath) {
  const p = folderPath
  if (p.startsWith('E:\\Doramas\\')) return { type: 'kdrama', category: 'kdrama', file: 'series.ts' }
  if (p.startsWith('E:\\Peliculas')) return { type: 'movie', category: 'movie', file: 'movies.ts' }
  if (p.startsWith('H:\\SERIES\\(Animadas\\')) return { type: 'animated-series', category: 'animated-series', file: 'series.ts' }
  if (p.startsWith('H:\\SERIES\\(Persona\\')) return { type: 'series', category: 'live-series', file: 'series.ts' }
  if (p.startsWith('H:\\SERIES\\Completar\\')) return { type: 'series', category: 'incomplete', file: 'series.ts' }
  if (p.startsWith('H:\\SERIES\\')) return { type: 'series', category: 'live-series', file: 'series.ts' }
  if (p.startsWith('D:\\- Animadas\\')) return { type: 'movie', category: 'movie-animated', file: 'movies.ts' }
  if (p.match(/D:\\.*Saga/i) || p.match(/D:\\.*Ciclo/i)) return { type: 'movie', category: 'movie-saga', file: 'movies.ts' }
  if (p.startsWith('F:\\Pelis\\1. Ghibli\\')) return { type: 'anime-movie', category: 'anime-movie-ghibli', file: 'anime-movies.ts' }
  if (p.startsWith('F:\\Pelis\\2. Makoto Shinkai\\')) return { type: 'anime-movie', category: 'anime-movie-shinkai', file: 'anime-movies.ts' }
  if (p.startsWith('F:\\Pelis\\')) return { type: 'anime-movie', category: 'anime-movie', file: 'anime-movies.ts' }
  if (p.startsWith('F:\\Nuevos\\')) return { type: 'anime', category: 'anime-series-new', file: 'anime-series.ts' }
  if (p.startsWith('F:\\')) return { type: 'anime', category: 'anime-series', file: 'anime-series.ts' }
  if (p.startsWith('D:\\')) return { type: 'movie', category: 'movie', file: 'movies.ts' }
  return { type: 'movie', category: 'movie', file: 'movies.ts' }
}

function sanitizeId(name) {
  let id = name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '-')
  id = id.replace(/-+/g, '-').replace(/^-|-$/g, '')
  if (id.length > 80) id = id.substring(0, 80)
  return id
}

function titleFromFolderName(name) {
  // Clean up folder name to make a readable title
  let t = name
    .replace(/^\[.*?\]\s*/, '') // remove [Serie] prefix
    .replace(/\[.*?\]/g, '')     // remove [..] tags
    .replace(/\(.*?\)/g, '')     // remove (..) tags
    .replace(/\d{4}.*$/, '')     // remove year and after
    .replace(/\.\w{2,4}$/, '')   // remove extension
    .replace(/^[._!]+/, '')      // remove leading punctuation
    .replace(/\s+/g, ' ').trim()
  if (!t) t = name
  // Title case
  return t.replace(/\b\w/g, c => c.toUpperCase())
}

// Check if a set of sub-folders look like seasons of the same series
// (share a common prefix and differ by season indicators)
function looksLikeSeasons(leafs) {
  if (leafs.length <= 1) return false

  // If ALL leaf names match a season pattern (Temporada N, Season N, SNN, TNN),
  // they are seasons of the parent series.
  const seasonPattern = /^(temporada|season|temp)\s*0*\d+/i
  const allSeasonNamed = leafs.every(l => seasonPattern.test(l.name.trim()) ||
    /^\s*0*\d+\s*$/.test(l.name.trim()) || /^s\s*0*\d+/i.test(l.name.trim()) || /^t\s*0*\d+/i.test(l.name.trim()))
  if (allSeasonNamed) return true

  // Extract the "base" name (without season indicators) for each leaf
  const bases = leafs.map(l => {
    let n = norm(l.name)
    n = n.replace(/s0*\d+e\d+/g, '').replace(/s0*\d+/g, '').replace(/t0*\d+/g, '')
    n = n.replace(/season0*\d+/g, '').replace(/temporada0*\d+/g, '')
    n = n.replace(/\d+x\d+/g, '')
    n = n.replace(/^0*\d+/, '').replace(/0*\d+$/, '')
    return n
  })
  const first = bases[0]
  if (first.length < 3) return false
  if (bases.every(b => b === first)) return true
  // Long common prefix
  const avgLen = bases.reduce((s, b) => s + b.length, 0) / bases.length
  let commonPrefix = 0
  const minLen = Math.min(...bases.map(b => b.length))
  for (let i = 0; i < minLen; i++) {
    if (bases.every(b => b[i] === first[i])) commonPrefix++
    else break
  }
  if (commonPrefix >= 6 && commonPrefix >= avgLen * 0.4) return true
  return false
}

// Category/container folders that should NOT group their children
function isCategoryFolder(name, folderPath) {
  const n = name.toLowerCase()
  const categoryNames = ['(animadas', '(persona', 'completar', '- animadas', 'pelis', 'nuevos', 'saga de', 'ciclo de', 'peliculas [ sagas', 'posters', '$recycle.bin', 'system volume']
  for (const c of categoryNames) {
    if (n.includes(c)) return true
  }
  // If it's a root-level folder on D:\ with many (>15) sub-folders, likely a category
  if (folderPath.startsWith('D:\\') && !folderPath.includes('\\', 3)) {
    // direct child of D:\
    if (n.includes('saga') || n.includes('peliculas') || n.includes('animadas')) return true
  }
  return false
}

// Build a new entry object from a disk folder, deciding:
//  - single movie (no seasons, format + sizeBytes)
//  - saga of movies (seasons = list of movies)
//  - series/anime (seasons = list of seasons with episodes)
function buildEntryFromFolder(folderNode, type, category, id, title, file, isExisting, entryMeta) {
  const isMovieType = type === 'movie' || type === 'anime-movie'

  // Count total media files recursively
  function countAllMedia(node) {
    let c = node.files.length
    for (const sub of node.subdirs) {
      const subNode = NODES.get(sub.path)
      if (subNode) c += countAllMedia(subNode)
    }
    return c
  }
  const totalMediaCount = countAllMedia(folderNode)

  // Single movie: 1 media file total
  if (isMovieType && totalMediaCount === 1) {
    let singleFile = null
    if (folderNode.files.length === 1) {
      singleFile = folderNode.files[0]
    } else {
      function findSingle(node) {
        if (node.files.length === 1) return node.files[0]
        for (const sub of node.subdirs) {
          const subNode = NODES.get(sub.path)
          if (subNode && (subNode.hasMedia || subNode.hasMediaDescendant)) {
            const r = findSingle(subNode)
            if (r) return r
          }
        }
        return null
      }
      singleFile = findSingle(folderNode)
    }
    if (singleFile) {
      return {
        id, title, type, category, file,
        path: formatPathForData(folderNode.path),
        seasons: null,
        totalSize: singleFile.size,
        isSingleFile: true,
        singleFile: { name: singleFile.name, format: singleFile.ext, sizeBytes: singleFile.size },
        entryFolder: folderNode.path,
        isNew: !isExisting,
        ...entryMeta
      }
    }
  }

  // Saga or series: build seasons
  const { seasons, totalSize } = buildSeasonsFromFolder(folderNode, isMovieType)
  return {
    id, title, type, category, file,
    path: formatPathForData(folderNode.path),
    seasons, totalSize,
    isSingleFile: false,
    entryFolder: folderNode.path,
    isNew: !isExisting,
    ...entryMeta
  }
}

// Build new entries from uncataloged folders
const newEntries = []
const usedIds = new Set(allEntries.map(e => e.id))

for (const [parentPath, group] of uncatalogedByParent) {
  const parentNode = NODES.get(parentPath)
  const parentReferenced = referencedFolders.has(parentPath)
  const leafs = group.leafs

  const cat = categorizeByPath(parentPath)
  const isMovieType = cat.type === 'movie' || cat.type === 'anime-movie'

  // Decide grouping:
  // Group into one multi-season entry ONLY if:
  //  - parent is not referenced
  //  - parent has no direct media
  //  - parent is NOT a category folder
  //  - leafs look like seasons of the same series
  const shouldGroup = !parentReferenced
    && parentNode
    && !parentNode.hasMedia
    && !isCategoryFolder(parentNode.name, parentPath)
    && looksLikeSeasons(leafs)

  if (shouldGroup) {
    const entryFolder = parentNode
    const title = titleFromFolderName(entryFolder.name)
    let id = sanitizeId(entryFolder.name)
    let n = 2
    while (usedIds.has(id)) { id = sanitizeId(entryFolder.name) + '-' + n; n++ }
    usedIds.add(id)

    referencedFolders.add(entryFolder.path)
    markReferenced(entryFolder, referencedFolders)

    const ne = buildEntryFromFolder(entryFolder, cat.type, cat.category, id, title, cat.file, false)
    newEntries.push(ne)
  } else {
    // Each leaf is its own entry
    for (const leaf of leafs) {
      if (referencedFolders.has(leaf.path)) continue
      // Skip if leaf is a sub-folder of a category folder and itself looks like a category
      if (isCategoryFolder(leaf.name, leaf.path) && !leaf.hasMedia) continue
      const leafCat = categorizeByPath(leaf.path)

      // If this leaf has media sub-folders (is a parent), recurse to build multi-season
      if (leaf.hasMediaDescendant && !leaf.hasMedia && !isCategoryFolder(leaf.name, leaf.path)) {
        const subLeafs = []
        for (const sub of leaf.subdirs) {
          const subNode = NODES.get(sub.path)
          if (subNode && subNode.hasMedia && !referencedFolders.has(sub.path)) subLeafs.push(subNode)
        }
        if (subLeafs.length > 0 && looksLikeSeasons(subLeafs)) {
          const title = titleFromFolderName(leaf.name)
          let id = sanitizeId(leaf.name)
          let n = 2
          while (usedIds.has(id)) { id = sanitizeId(leaf.name) + '-' + n; n++ }
          usedIds.add(id)
          referencedFolders.add(leaf.path)
          markReferenced(leaf, referencedFolders)
          const ne = buildEntryFromFolder(leaf, leafCat.type, leafCat.category, id, title, leafCat.file, false)
          newEntries.push(ne)
          continue
        }
      }

      const title = titleFromFolderName(leaf.name)
      let id = sanitizeId(leaf.name)
      let n = 2
      while (usedIds.has(id)) { id = sanitizeId(leaf.name) + '-' + n; n++ }
      usedIds.add(id)

      referencedFolders.add(leaf.path)
      const ne = buildEntryFromFolder(leaf, leafCat.type, leafCat.category, id, title, leafCat.file, false)
      newEntries.push(ne)
    }
  }
}

console.log('  Carpetas NO catalogadas (hojas): ' + uncatalogedLeafs.length)
console.log('  Entradas nuevas creadas: ' + newEntries.length)

// Save intermediate state for inspection
const state = {
  scanDate: new Date().toISOString(),
  matched: matchLog,
  notMatched: notMatched.map(e => ({ id: e.id, title: e.title, type: e.type, file: e.file, rawPath: e.rawPath })),
  newEntries: newEntries.map(e => ({ id: e.id, title: e.title, type: e.type, category: e.category, file: e.file, path: e.path, seasons: e.seasons ? e.seasons.length : 0, single: !!e.isSingleFile, size: formatBytes(e.totalSize) }))
}
fs.writeFileSync(path.join(__dirname, 'rebuild-state.json'), JSON.stringify(state, null, 2))
console.log('Estado guardado: scripts/rebuild-state.json')

// ============================================================================
// FILE GENERATION
// ============================================================================
function tsStr(s) {
  if (s === null || s === undefined) return "''"
  s = String(s)
  // Use single quotes; escape backslash and single quote
  s = s.replace(/\\/g, '\\\\').replace(/'/g, "\\'")
  return "'" + s + "'"
}

function tsArr(arr) {
  if (!arr || arr.length === 0) return '[]'
  return '[' + arr.map(tsStr).join(', ') + ']'
}

function indent(n) { return '  '.repeat(n) }

function formatSeason(s, depth) {
  const sp = indent(depth)
  const sp1 = indent(depth + 1)
  const sp2 = indent(depth + 2)
  let out = sp + '{\n'
  out += sp1 + 'number: ' + s.number + ',\n'
  out += sp1 + 'episodes: ' + s.episodes + ',\n'
  out += sp1 + 'formats: ' + tsArr(s.formats) + ',\n'
  if (s.notes) out += sp1 + 'notes: ' + tsStr(s.notes) + ',\n'
  out += sp1 + 'sizeBytes: ' + s.sizeBytes + ',\n'
  out += sp1 + 'sizeFormatted: ' + tsStr(s.sizeFormatted) + ',\n'
  if (s.episodesList && s.episodesList.length > 0) {
    out += sp1 + 'episodesList: [\n'
    for (const ep of s.episodesList) {
      out += sp2 + '{ name: ' + tsStr(ep.name) + ', format: ' + tsStr(ep.format) + ', sizeBytes: ' + ep.sizeBytes + ', sizeFormatted: ' + tsStr(ep.sizeFormatted) + ' },\n'
    }
    out += sp1 + '],\n'
  }
  out += sp + '},\n'
  return out
}

function formatEntry(e, seasons, totalSize, opts) {
  opts = opts || {}
  const sp = indent(1)
  const sp1 = indent(2)
  let out = sp + '{\n'
  out += sp1 + 'id: ' + tsStr(e.id) + ',\n'
  out += sp1 + 'title: ' + tsStr(e.title) + ',\n'
  out += sp1 + 'type: ' + tsStr(e.type) + ',\n'
  out += sp1 + 'category: ' + tsStr(e.category) + ',\n'
  if (e.year) out += sp1 + 'year: ' + e.year + ',\n'
  if (e.studio) out += sp1 + 'studio: ' + tsStr(e.studio) + ',\n'
  if (e.poster) out += sp1 + 'poster: ' + tsStr(e.poster) + ',\n'
  if (e.notes) out += sp1 + 'notes: ' + tsStr(e.notes) + ',\n'
  if (e.genres && e.genres.length > 0) out += sp1 + 'genres: ' + tsArr(e.genres) + ',\n'
  // For single movies (no seasons): use format field
  if (!seasons) {
    if (opts.singleFile) {
      out += sp1 + 'format: ' + tsStr(opts.singleFile.format.toUpperCase()) + ',\n'
    } else if (e.format) {
      out += sp1 + 'format: ' + tsStr(e.format) + ',\n'
    }
  }
  if (e.resolution) out += sp1 + 'resolution: ' + tsStr(e.resolution) + ',\n'
  if (e.audio) out += sp1 + 'audio: ' + tsStr(e.audio) + ',\n'
  if (!seasons && e.episodes) out += sp1 + 'episodes: ' + e.episodes + ',\n'
  // path
  const pathVal = opts.path || formatPathForData(e.entryFolder || (e.diskFolder && e.diskFolder.path) || '')
  out += sp1 + 'path: ' + tsStr(pathVal) + ',\n'
  if (totalSize !== null && totalSize !== undefined) {
    out += sp1 + 'sizeBytes: ' + totalSize + ',\n'
    out += sp1 + 'sizeFormatted: ' + tsStr(formatBytes(totalSize)) + ',\n'
  }
  if (seasons && seasons.length > 0) {
    out += sp1 + 'seasons: [\n'
    for (const s of seasons) {
      out += formatSeason(s, 2)
    }
    out += sp1 + '],\n'
  }
  out += sp + '},\n'
  return out
}

// Category section headers
const CATEGORY_LABELS = {
  'movie': '// PELICULAS',
  'movie-saga': '// SAGAS DE PELICULAS',
  'movie-animated': '// PELICULAS ANIMADAS',
  'anime-movie': '// PELICULAS ANIME',
  'anime-movie-ghibli': '// STUDIO GHIBLI',
  'anime-movie-shinkai': '// MAKOTO SHINKAI',
  'anime-series': '// ANIME SERIES',
  'anime-series-new': '// ANIME SERIES (NUEVAS)',
  'live-series': '// SERIES LIVE-ACTION',
  'animated-series': '// SERIES ANIMADAS',
  'kdrama': '// K-DRAMAS',
  'incomplete': '// PENDIENTES / INCOMPLETAS',
}

function generateFile(fileName, useFormatBytesHelper) {
  // Collect entries for this file
  const existingForFile = rebuilt.filter(r => r.entry.file === fileName)
  const newForFile = newEntries.filter(e => e.file === fileName)

  // Build a list of { category, code } for each entry
  const allItems = []

  for (const r of existingForFile) {
    if (r.diskFolder) {
      // Matched: use rebuilt data (could be single movie, saga, or series)
      allItems.push({
        category: r.entry.category,
        code: formatEntry(r.entry, r.seasons, r.totalSize, {
          path: r.diskFolder ? formatPathForData(r.diskFolder.path) : undefined,
          singleFile: r.singleFile
        })
      })
    } else {
      // Not matched: use raw block from original file (already includes { ... },)
      allItems.push({ category: r.entry.category, code: indent(1) + r.entry.rawBlock + '\n', raw: true })
    }
  }

  for (const ne of newForFile) {
    allItems.push({
      category: ne.category,
      code: formatEntry(ne, ne.seasons, ne.totalSize, { singleFile: ne.singleFile })
    })
  }

  // Group by category, preserving order within each category
  const byCategory = new Map()
  for (const item of allItems) {
    if (!byCategory.has(item.category)) byCategory.set(item.category, [])
    byCategory.get(item.category).push(item)
  }

  // Order categories
  const categoryOrder = ['movie-saga','movie','movie-animated','anime-movie-ghibli','anime-movie-shinkai','anime-movie','anime-series','anime-series-new','animated-series','live-series','kdrama','incomplete']
  const orderedCategories = [...categoryOrder, ...Array.from(byCategory.keys()).filter(c => !categoryOrder.includes(c))]

  let content = ''
  content += "import { MediaItem } from '@/lib/types'\n"
  if (useFormatBytesHelper) {
    content += '\n'
    content += 'function formatBytes(bytes: number): string {\n'
    content += "  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'\n"
    content += "  if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB'\n"
    content += "  return (bytes / (1024 * 1024 * 1024)).toFixed(2) + ' GB'\n"
    content += '}\n'
  }
  content += '\n'
  const exportName = fileName.replace('.ts', '')
  const arrName = exportName.replace(/-/g, '')
  // Determine array variable name from original files
  const arrNames = { 'movies.ts': 'movies', 'anime-movies.ts': 'animeMovies', 'anime-series.ts': 'animeSeries', 'series.ts': 'series' }
  content += 'export const ' + arrNames[fileName] + ': MediaItem[] = [\n'

  for (const cat of orderedCategories) {
    if (!byCategory.has(cat)) continue
    const items = byCategory.get(cat)
    const label = CATEGORY_LABELS[cat] || ('// ' + cat.toUpperCase())
    content += '\n  ' + label + '\n'
    for (const item of items) {
      content += item.code
    }
  }

  content += ']\n'

  return content
}

console.log('\nGenerando archivos de datos...')
const FILES_TO_GENERATE = [
  { name: 'movies.ts', helper: true },
  { name: 'anime-movies.ts', helper: true },
  { name: 'anime-series.ts', helper: false },
  { name: 'series.ts', helper: false },
]

for (const f of FILES_TO_GENERATE) {
  const content = generateFile(f.name, f.helper)
  const outPath = path.join(DATA_DIR, f.name)
  fs.writeFileSync(outPath, content, 'utf-8')
  const lines = content.split('\n').length
  console.log('  ' + f.name + ': ' + lines + ' lineas')
}

console.log('\n=== GENERACION COMPLETA ===')
console.log('Archivos escritos en src/data/')
