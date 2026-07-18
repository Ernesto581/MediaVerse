const fs = require('fs')
const path = require('path')

const DATA_DIR = path.join(__dirname, '..', 'src', 'data')
const FILES = ['movies.ts', 'series.ts']
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
  return total
}

for (const file of FILES) {
  const filePath = path.join(DATA_DIR, file)
  let content = fs.readFileSync(filePath, 'utf-8')
  let updated = 0

  // Find entries with E:\ paths that don't have sizeBytes
  const entries = content.match(/id:\s*['"]([^'"]+)['"],[\s\S]*?path:\s*['"]E:\\([^'"]+)['"]/g)
  if (!entries) { console.log(`${file}: sin entradas E:`); continue }

  // Process each E:\ entry
  const lines = content.split('\n')
  let result = ''

  for (let i = 0; i < lines.length; i++) {
    result += lines[i] + '\n'
    
    // Detect an E:\ path line without sizeBytes after it
    if (/path:\s*['"]E:\\/.test(lines[i])) {
      // Check if next lines already have sizeBytes
      let hasSize = false
      for (let j = i + 1; j < Math.min(i + 5, lines.length); j++) {
        if (/sizeBytes:/.test(lines[j])) { hasSize = true; break }
        if (/^\s*\},?\s*$/.test(lines[j]) || /^\s*\]/.test(lines[j])) break
      }
      
      if (!hasSize) {
        const pathMatch = lines[i].match(/path:\s*['"]E:\\([^'"]+)['"]/)
        if (pathMatch) {
          const relPath = pathMatch[1]
          const fullPath = 'E:\\' + relPath
          let size = 0
          
          if (fs.existsSync(fullPath)) {
            const stat = fs.statSync(fullPath)
            if (stat.isFile() && MEDIA_EXT.has(path.extname(fullPath).toLowerCase())) {
              size = stat.size
            } else if (stat.isDirectory()) {
              size = getFolderSize(fullPath)
            }
          }
          
          if (size > 0) {
            const formatted = formatBytes(size)
            const indent = lines[i].match(/^(\s*)/)[1]
            // Insert after path line
            result = result.trimEnd() + '\n'
            result += `${indent}sizeBytes: ${size},\n`
            result += `${indent}sizeFormatted: "${formatted}"`
            // Check what comes next
            const nextLine = lines[i + 1] || ''
            if (nextLine.trim().startsWith('seasons:') || nextLine.trim().startsWith('}') || nextLine.trim() === '},') {
              result += ','
            }
            result += '\n'
            updated++
          }
        }
      }
    }
  }
  
  if (updated > 0) {
    fs.writeFileSync(filePath, result)
    console.log(`${file}: ${updated} tamaños agregados`)
  } else {
    console.log(`${file}: sin cambios necesarios`)
  }
}

console.log('\nListo.')
