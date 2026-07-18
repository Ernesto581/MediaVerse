const fs = require('fs')
const p = require('path')

const MEDIA_EXT = new Set(['.mp4','.mkv','.avi','.mov','.wmv','.flv','.webm','.ts','.mpg','.m4v','.ogm','.rmvb','.mts'])

const moviesPath = p.join(__dirname, '..', 'src', 'data', 'movies.ts')
let c = fs.readFileSync(moviesPath, 'utf-8')

let u = 0
c = c.replace(/(path:\s*'E:\\\\Peliculas\\\\([^']+)')(\s*,?\s*\})/g, (match, prefix, fname) => {
  const fullPath = 'E:\\Peliculas\\' + fname
  let size = 0
  try { size = fs.statSync(fullPath).size } catch(e) {}
  if (size === 0) return match
  const gb = (size / (1024*1024*1024)).toFixed(2)
  u++
  return prefix + ',\n    sizeBytes: ' + size + ',\n    sizeFormatted: "' + gb + ' GB"\n  }'
})

fs.writeFileSync(moviesPath, c)
console.log('Peliculas actualizadas:', u)
