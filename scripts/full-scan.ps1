$ErrorActionPreference = "Continue"
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$projectDir = (Resolve-Path "$scriptDir\..").Path

$ROOTS = @(
  "D:\",
  "E:\Doramas",
  "E:\Peliculas",
  "F:\",
  "H:\SERIES"
)

$MEDIA_EXT = @('.mp4', '.mkv', '.avi', '.mov', '.wmv', '.flv', '.webm', '.ts', '.mpg', '.m4v', '.ogm', '.rmvb', '.mts')
$IMAGE_EXT = @('.jpg', '.jpeg', '.png', '.webp', '.gif', '.bmp', '.tiff')

$POSTERS_DIR = "$projectDir\public\posters"
$REPORT_PATH = "$projectDir\scripts\scan-report.json"
$NO_POSTER_PATH = "$projectDir\scripts\no-poster.json"
$SIZES_PATH = "$scriptDir\file-sizes.json"

if (-not (Test-Path $POSTERS_DIR)) {
  New-Item -ItemType Directory -Path $POSTERS_DIR -Force | Out-Null
}

# Global results
$global:allFolders = New-Object System.Collections.ArrayList
$global:allFiles = New-Object System.Collections.ArrayList
$global:imageMap = @{}
$global:fileSizes = @{}

function Sanitize-Id($name) {
  $id = $name.ToLower() -replace '[^a-z0-9]', '-'
  $id = $id -replace '-+', '-'
  $id = $id.Trim('-')
  if ($id.Length -gt 80) { $id = $id.Substring(0, 80) }
  return $id
}

function Get-NormalizedTitle($name) {
  $t = $name.ToLower()
  $t = $t -replace '\s*\(\d{4}\)\s*$', ''
  $t = $t -replace '\s*\[\d{4}\]\s*$', ''
  $t = $t -replace '\s+', ' '
  return $t.Trim()
}

# Check if a directory has media files directly (not subdirs)
function Has-MediaFiles($dirPath) {
  try {
    $files = Get-ChildItem -LiteralPath $dirPath -File -ErrorAction SilentlyContinue
    foreach ($f in $files) {
      if ($MEDIA_EXT -contains $f.Extension.ToLower()) {
        return $true
      }
    }
  } catch {}
  return $false
}

# Recursive scan
function Scan-Dir($dir, $depth = 0, $driveLetter = "") {
  if ($depth -gt 5) { return }

  $entries = $null
  try {
    $entries = Get-ChildItem -LiteralPath $dir -ErrorAction SilentlyContinue
  } catch {
    return
  }

  if (-not $entries) { return }

  $hasMediaHere = $false

  foreach ($entry in $entries) {
    try {
      $fullName = $entry.FullName
      $name = $entry.Name

      if ($entry -is [System.IO.DirectoryInfo]) {
        Scan-Dir $fullName ($depth + 1) $driveLetter
      } else {
        $ext = $entry.Extension.ToLower()

        if ($MEDIA_EXT -contains $ext) {
          $hasMediaHere = $true
          try {
            $global:fileSizes[$name] = $entry.Length
          } catch {}

          [void]$global:allFiles.Add(@{
            name = $name
            path = $fullName
            size = $entry.Length
            ext = $ext
            drive = $driveLetter
          })
        }

        if ($IMAGE_EXT -contains $ext) {
          if (-not $global:imageMap.ContainsKey($dir)) {
            $global:imageMap[$dir] = New-Object System.Collections.ArrayList
          }
          [void]$global:imageMap[$dir].Add(@{
            name = $name
            path = $fullName
            size = $entry.Length
            ext = $ext
          })
        }
      }
    } catch {}
  }

  # After processing entries, track this directory if it had media
  if ($hasMediaHere -and $depth -gt 0) {
    $dirName = Split-Path -Leaf $dir
    [void]$global:allFolders.Add(@{
      name = $dirName
      path = $dir
      drive = $driveLetter
      depth = $depth
    })
  }
}

Write-Host "========================================"
Write-Host "ESCANEO COMPLETO - MediaVerse"
Write-Host "========================================"
Write-Host ""

foreach ($root in $ROOTS) {
  if (-not (Test-Path -LiteralPath $root)) {
    Write-Host "  SKIP (no existe): $root"
    continue
  }
  Write-Host "  Escaneando: $root"
  $driveLetter = $root.Substring(0, 1)
  Scan-Dir $root 0 $driveLetter
}

Write-Host ""
Write-Host "RESULTADOS:"
Write-Host "  Carpetas con media directa: $($global:allFolders.Count)"
Write-Host "  Archivos de video: $($global:allFiles.Count)"
Write-Host "  Carpetas con imagenes: $($global:imageMap.Count)"
Write-Host "  Tamanios indexados: $($global:fileSizes.Count)"
Write-Host ""

# Find duplicates
$dupeMap = @{}
foreach ($folder in $global:allFolders) {
  $norm = Get-NormalizedTitle $folder.name
  if (-not $dupeMap.ContainsKey($norm)) {
    $dupeMap[$norm] = New-Object System.Collections.ArrayList
  }
  [void]$dupeMap[$norm].Add($folder.path)
}

$duplicates = @{}
foreach ($kv in $dupeMap.GetEnumerator()) {
  if ($kv.Value.Count -gt 1) {
    $duplicates[$kv.Key] = $kv.Value
  }
}

Write-Host "DUPLICADOS: $($duplicates.Count) grupos"
foreach ($kv in $duplicates.GetEnumerator()) {
  Write-Host "  [$($kv.Value.Count) copias] $($kv.Key)"
  foreach ($p in $kv.Value) {
    Write-Host "    - $p"
  }
}
Write-Host ""

# Copy posters
Write-Host "COPIANDO POSTERS..."
$copiedCount = 0
$noPosterFolders = New-Object System.Collections.ArrayList

foreach ($folder in $global:allFolders) {
  $folderPath = $folder.path
  $bestImg = $null

  # Check images in the same folder first
  if ($global:imageMap.ContainsKey($folderPath)) {
    $imgs = $global:imageMap[$folderPath]
    # Prefer folder.jpg, poster.jpg, cover.jpg
    foreach ($img in $imgs) {
      $imgName = $img.name.ToLower()
      if ($imgName -match 'folder|poster|cover|front' -and $img.ext -ne '.srt') {
        $bestImg = $img
        break
      }
    }
    if (-not $bestImg) {
      # Pick largest image
      $bestImg = $imgs | Sort-Object { $_.size } -Descending | Select-Object -First 1
    }
  }

  # If no image in folder, check parent
  if (-not $bestImg) {
    $parent = Split-Path -Parent $folderPath
    if ($global:imageMap.ContainsKey($parent)) {
      $pimgs = $global:imageMap[$parent]
      foreach ($img in $pimgs) {
        if ($img.name.ToLower() -match $folder.name.ToLower().Substring(0, [Math]::Min(10, $folder.name.Length))) {
          $bestImg = $img
          break
        }
      }
      if (-not $bestImg) {
        $bestImg = $pimgs | Sort-Object { $_.size } -Descending | Select-Object -First 1
      }
    }
  }

  if ($bestImg) {
    $mediaId = Sanitize-Id $folder.name
    $destExt = $bestImg.ext
    $destName = "$mediaId$destExt"
    $destPath = Join-Path $POSTERS_DIR $destName

    if (-not (Test-Path -LiteralPath $destPath)) {
      try {
        Copy-Item -LiteralPath $bestImg.path -Destination $destPath -Force -ErrorAction SilentlyContinue
        $copiedCount++
      } catch {}
    }
  } else {
    [void]$noPosterFolders.Add(@{
      name = $folder.name
      path = $folder.path
      drive = $folder.drive
    })
  }
}

Write-Host "  Posters copiados: $copiedCount"
Write-Host "  SIN poster: $($noPosterFolders.Count)"
Write-Host ""

# Show items without poster
foreach ($np in $noPosterFolders) {
  Write-Host "  SIN FOTO: $($np.name) [$($np.drive):]"
}
Write-Host ""

# Save reports
Write-Host "Guardando reportes..."

$report = @{
  scanDate = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
  roots = $ROOTS
  stats = @{
    totalFolders = $global:allFolders.Count
    totalVideoFiles = $global:allFiles.Count
    foldersWithImages = $global:imageMap.Count
    postersCopied = $copiedCount
    foldersWithoutPoster = $noPosterFolders.Count
    duplicateGroups = $duplicates.Count
    totalFileSizesIndexed = $global:fileSizes.Count
  }
  duplicates = $duplicates
  noPoster = $noPosterFolders | Select-Object -Property name,path,drive
  allFolders = $global:allFolders | Select-Object -First 3000 -Property name,path,drive,depth
}

$report | ConvertTo-Json -Depth 4 | Out-File -FilePath $REPORT_PATH -Encoding UTF8
$global:fileSizes | ConvertTo-Json -Depth 1 | Out-File -FilePath $SIZES_PATH -Encoding UTF8

$noPosterData = $noPosterFolders | Select-Object -Property name,path,drive
$noPosterData | ConvertTo-Json -Depth 2 | Out-File -FilePath $NO_POSTER_PATH -Encoding UTF8

Write-Host "  scan-report.json  -> $REPORT_PATH"
Write-Host "  file-sizes.json   -> $SIZES_PATH"
Write-Host "  no-poster.json    -> $NO_POSTER_PATH"
Write-Host ""
Write-Host "========================================"
Write-Host "RESUMEN FINAL:"
Write-Host "  Carpetas con media: $($global:allFolders.Count)"
Write-Host "  Archivos video: $($global:allFiles.Count)"
Write-Host "  Posters copiados: $copiedCount"
Write-Host "  SIN poster: $($noPosterFolders.Count)"
Write-Host "  Duplicados: $($duplicates.Count)"
Write-Host "  Tamanios: $($global:fileSizes.Count)"
Write-Host "========================================"
