const fs = require('fs')
const path = require('path')

const ROOTS = ['F:\\', 'D:\\', 'H:\\SERIES']
const MEDIA_EXT = new Set(['.mp4', '.mkv', '.avi', '.mov', '.wmv', '.flv', '.webm', '.ts'])

/** @type {Map<string, number>} */
const sizeMap = new Map()

function scan(dir, depth = 0) {
  if (depth > 5) return
  let entries
  try { entries = fs.readdirSync(dir, { withFileTypes: true }) } catch { return }
  for (const e of entries) {
    const full = path.join(dir, e.name)
    if (e.isDirectory()) {
      scan(full, depth + 1)
    } else if (e.isFile() && MEDIA_EXT.has(path.extname(e.name).toLowerCase())) {
      try { sizeMap.set(e.name, fs.statSync(full).size) } catch {}
    }
  }
}

console.log('Escaneando discos en busca de archivos de video...\n')
for (const root of ROOTS) {
  const before = sizeMap.size
  process.stdout.write(root + ' ... ')
  scan(root)
  console.log((sizeMap.size - before) + ' archivos (total: ' + sizeMap.size + ')')
}

console.log('\nGuardando índice de ' + sizeMap.size + ' archivos...')
fs.writeFileSync(
  path.join(__dirname, 'file-sizes.json'),
  JSON.stringify(Object.fromEntries(sizeMap), null, 2)
)
console.log('Listo: file-sizes.json')
