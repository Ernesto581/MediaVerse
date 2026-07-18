const fs = require('fs')
const path = require('path')

const POSTERS_DIR = path.join(__dirname, '..', 'public', 'posters')
const DATA_DIR = path.join(__dirname, '..', 'src', 'data')
const FILES = ['movies.ts', 'anime-movies.ts', 'anime-series.ts', 'series.ts']

function sanitizeId(name) {
  let id = name.toLowerCase()
    .replace(/[^a-z0-9]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
  if (id.length > 80) id = id.substring(0, 80)
  return id
}

const posters = fs.readdirSync(POSTERS_DIR).filter(f => {
  const ext = path.extname(f).toLowerCase()
  return ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.bmp'].includes(ext)
})
const posterSet = new Set(posters)
console.log(`Posters encontrados: ${posters.length}`)

function findPoster(mediaTitle, id, seasonNotes) {
  // 1. Try exact data id
  for (const ext of ['.jpg', '.jpeg', '.png', '.webp']) {
    if (posterSet.has(id + ext)) return id + ext
  }

  // 2. Try sanitized title
  const titleId = sanitizeId(mediaTitle)
  for (const ext of ['.jpg', '.jpeg', '.png', '.webp']) {
    if (posterSet.has(titleId + ext)) return titleId + ext
  }

  // 3. Try season notes (for sagas)
  if (seasonNotes && seasonNotes.length > 0) {
    for (const note of seasonNotes) {
      const noteId = sanitizeId(note)
      for (const ext of ['.jpg', '.jpeg', '.png', '.webp']) {
        if (posterSet.has(noteId + ext)) return noteId + ext
      }
    }
  }

  // 4. Fuzzy: find poster that starts with titleId
  for (const p of posters) {
    const base = p.replace(/\.[^.]+$/, '')
    if (base.startsWith(titleId) || titleId.startsWith(base) ||
        base.includes(titleId.substring(0, 15))) {
      return p
    }
  }

  return null
}

function linkPostersInFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf-8')
  let updated = 0
  let alreadyHad = 0

  // Match id and title (handle both single and double quotes)
  // Pattern: id: 'xxx',\n      title: 'yyy',
  const itemRegex = /id:\s*"([^"]+)"\s*,\s*\n\s*title:\s*"([^"]+)"|id:\s*'([^']+)'\s*,\s*\n\s*title:\s*'([^']+)'/g
  
  const items = []
  let m
  while ((m = itemRegex.exec(content)) !== null) {
    const id = m[1] || m[3]
    const title = m[2] || m[4]
    items.push({ id, title, pos: m.index })
  }

  console.log(`  ${path.basename(filePath)}: ${items.length} items encontrados`)

  // Process items in reverse so positions don't shift
  for (let i = items.length - 1; i >= 0; i--) {
    const { id, title, pos } = items[i]

    // Skip if already has poster within this item block
    const itemEnd = content.indexOf('  },\n', pos)
    const itemBlock = content.substring(pos, itemEnd !== -1 ? itemEnd : pos + 5000)
    if (itemBlock.includes('poster:')) {
      alreadyHad++
      continue
    }

    // Extract season notes from this item block
    const noteRegex = /notes:\s*"(?:[^"\\]|\\.)*"|notes:\s*'(?:[^'\\]|\\.)*'/g
    const seasonNotes = []
    let nm
    while ((nm = noteRegex.exec(itemBlock)) !== null) {
      const noteStr = nm[0]
      const noteMatch = noteStr.match(/notes:\s*["'](.+)["']/)
      if (noteMatch) seasonNotes.push(noteMatch[1])
    }

    const posterFile = findPoster(title, id, seasonNotes)
    if (!posterFile) continue

    // Find the path line in this item block
    const pathMatch = itemBlock.match(/path:\s*["'][^"']*["']/)
    if (!pathMatch) continue

    const pathStr = pathMatch[0]
    const pathPos = pos + pathMatch.index + pathStr.length
    const afterPath = content.substring(pathPos)
    
    // Insert poster after path
    const commaMatch = afterPath.match(/^(\s*,\s*\n)(\s*)/)
    if (commaMatch) {
      const indent = commaMatch[2]
      const insert = `,\n${indent}poster: "${posterFile}"`
      content = content.substring(0, pathPos) + insert + afterPath.substring(commaMatch[0].length)
      updated++
    } else {
      // Path might be the last property before closing
      const closeMatch = afterPath.match(/^(\s*\n)(\s*)\}/)
      if (closeMatch) {
        const indent = closeMatch[2] || '  '
        const insert = `,\n${indent}poster: "${posterFile}"`
        content = content.substring(0, pathPos) + insert + afterPath.substring(closeMatch[0].length)
        updated++
      }
    }
  }

  if (updated > 0) {
    fs.writeFileSync(filePath, content, 'utf-8')
  }
  console.log(`  -> ${updated} posters enlazados, ${alreadyHad} ya tenian`)
  return updated
}

let total = 0
for (const file of FILES) {
  const filePath = path.join(DATA_DIR, file)
  if (!fs.existsSync(filePath)) {
    console.log(`SKIP: ${file} (no existe)`)
    continue
  }
  total += linkPostersInFile(filePath)
}

console.log(`\nTotal: ${total} posters enlazados`)
