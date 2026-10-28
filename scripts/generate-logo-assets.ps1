# Regenerates every in-app logo asset from the newest brand logo (logo.jpeg).
# Outputs:
#   public/logo.png                     - square badge (sidebar, welcome screens)
#   android/.../drawable/gymathome_logo_round.png - round badge (notification large icon)
#   android/.../drawable/ic_gymathome_stat.png    - white silhouette (status bar small icon)
#   android/.../drawable/splash.png     - branded launch screen
Add-Type -AssemblyName System.Drawing

$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
$srcPath = Join-Path $root 'logo.jpeg'
$hiq = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic

function Save-Png($bmp, $path) {
    $dir = Split-Path $path -Parent
    if (-not (Test-Path $dir)) { New-Item -ItemType Directory -Path $dir | Out-Null }
    if (Test-Path $path) { Remove-Item $path -Force }
    $bmp.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
}

# The banner has the wordmark on the left and the house+figure mark on the right.
# Walk columns from the right edge inwards; the first long empty gap = wordmark start.
function Find-MarkBbox($bmp) {
    $w = $bmp.Width; $h = $bmp.Height
    $minScanX = [int]($w * 0.40)
    $seenDark = $false
    $emptyRun = 0
    $markLeft = $minScanX
    for ($x = $w - 1; $x -ge $minScanX; $x--) {
        $hasDark = $false
        for ($y = 0; $y -lt $h; $y += 2) {
            $p = $bmp.GetPixel($x, $y)
            $lum = 0.299 * $p.R + 0.587 * $p.G + 0.114 * $p.B
            if ($lum -lt 110) { $hasDark = $true; break }
        }
        if ($hasDark) { $seenDark = $true; $emptyRun = 0; $markLeft = $x }
        elseif ($seenDark) {
            $emptyRun += 1
            if ($emptyRun -ge 20) { break }
        }
    }
    $minX = $w; $maxX = 0; $minY = $h; $maxY = 0
    for ($y = 0; $y -lt $h; $y++) {
        for ($x = $markLeft; $x -lt $w; $x++) {
            $p = $bmp.GetPixel($x, $y)
            $lum = 0.299 * $p.R + 0.587 * $p.G + 0.114 * $p.B
            if ($lum -lt 110) {
                if ($x -lt $minX) { $minX = $x }
                if ($x -gt $maxX) { $maxX = $x }
                if ($y -lt $minY) { $minY = $y }
                if ($y -gt $maxY) { $maxY = $y }
            }
        }
    }
    return @{ X = $minX; Y = $minY; W = ($maxX - $minX + 1); H = ($maxY - $minY + 1) }
}

$src = [System.Drawing.Image]::FromFile($srcPath)
$srcBmp = New-Object System.Drawing.Bitmap $src
$bg = $srcBmp.GetPixel(5, 5)
Write-Host "Source: $($srcBmp.Width)x$($srcBmp.Height)  bg=RGB($($bg.R),$($bg.G),$($bg.B))"

$bbox = Find-MarkBbox $srcBmp
Write-Host "Mark bbox: x=$($bbox.X) y=$($bbox.Y) w=$($bbox.W) h=$($bbox.H)"

# Crop the mark with a small padding
$padX = [int]($bbox.W * 0.04); $padY = [int]($bbox.H * 0.04)
$cx = [Math]::Max(0, $bbox.X - $padX)
$cy = [Math]::Max(0, $bbox.Y - $padY)
$cw = [Math]::Min($srcBmp.Width - $cx, $bbox.W + 2 * $padX)
$ch = [Math]::Min($srcBmp.Height - $cy, $bbox.H + 2 * $padY)
$mark = $srcBmp.Clone((New-Object System.Drawing.Rectangle $cx, $cy, $cw, $ch), $srcBmp.PixelFormat)
Write-Host "Mark crop: ${cw}x${ch}"

# --- 1. public/logo.png : square badge, light-green bg + centered mark ---
$size = 512
$canvas = New-Object System.Drawing.Bitmap -ArgumentList $size, $size, ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$g = [System.Drawing.Graphics]::FromImage($canvas)
$g.SmoothingMode = 'AntiAlias'; $g.InterpolationMode = $hiq; $g.PixelOffsetMode = 'HighQuality'
$g.Clear($bg)
$target = [int]($size * 0.74)
$ratio = [Math]::Min($target / $mark.Width, $target / $mark.Height)
$dw = [int]($mark.Width * $ratio); $dh = [int]($mark.Height * $ratio)
$g.DrawImage($mark, [int](($size - $dw) / 2), [int](($size - $dh) / 2), $dw, $dh)
$g.Dispose()
Save-Png $canvas (Join-Path $root 'public\logo.png')
$canvas.Dispose()
Write-Host "Wrote public\logo.png (512x512)"

# --- 2. gymathome_logo_round.png : round badge (notification large icon) ---
$size = 192
$canvas = New-Object System.Drawing.Bitmap -ArgumentList $size, $size, ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$g = [System.Drawing.Graphics]::FromImage($canvas)
$g.SmoothingMode = 'AntiAlias'; $g.InterpolationMode = $hiq; $g.PixelOffsetMode = 'HighQuality'
$g.Clear([System.Drawing.Color]::Transparent)
$brush = New-Object System.Drawing.SolidBrush $bg
$g.FillEllipse($brush, 0, 0, $size, $size)
$target = [int]($size * 0.68)
$ratio = [Math]::Min($target / $mark.Width, $target / $mark.Height)
$dw = [int]($mark.Width * $ratio); $dh = [int]($mark.Height * $ratio)
$g.DrawImage($mark, [int](($size - $dw) / 2), [int](($size - $dh) / 2), $dw, $dh)
$g.Dispose()
$rad = $size / 2.0
for ($y = 0; $y -lt $size; $y++) {
    for ($x = 0; $x -lt $size; $x++) {
        $dx = $x - $rad + 0.5; $dy = $y - $rad + 0.5
        if (($dx * $dx + $dy * $dy) -gt ($rad * $rad)) {
            $p = $canvas.GetPixel($x, $y)
            $canvas.SetPixel($x, $y, [System.Drawing.Color]::FromArgb(0, $p.R, $p.G, $p.B))
        }
    }
}
Save-Png $canvas (Join-Path $root 'android\app\src\main\res\drawable\gymathome_logo_round.png')
$canvas.Dispose()
Write-Host "Wrote gymathome_logo_round.png (192x192 round)"

# --- 3. ic_gymathome_stat.png : white silhouette on transparent (status bar) ---
$size = 96
$canvas = New-Object System.Drawing.Bitmap -ArgumentList $size, $size, ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$g = [System.Drawing.Graphics]::FromImage($canvas)
$g.SmoothingMode = 'AntiAlias'; $g.InterpolationMode = $hiq; $g.PixelOffsetMode = 'HighQuality'
$g.Clear([System.Drawing.Color]::Transparent)
$target = [int]($size * 0.94)
$ratio = [Math]::Min($target / $mark.Width, $target / $mark.Height)
$dw = [int]($mark.Width * $ratio); $dh = [int]($mark.Height * $ratio)
$g.DrawImage($mark, [int](($size - $dw) / 2), [int](($size - $dh) / 2), $dw, $dh)
$g.Dispose()
for ($y = 0; $y -lt $size; $y++) {
    for ($x = 0; $x -lt $size; $x++) {
        $p = $canvas.GetPixel($x, $y)
        if ($p.A -eq 0) { continue }
        $lum = 0.299 * $p.R + 0.587 * $p.G + 0.114 * $p.B
        if ($lum -ge 150) {
            $canvas.SetPixel($x, $y, [System.Drawing.Color]::FromArgb(0, 255, 255, 255))
        } else {
            $a = [int](255 * (1.0 - $lum / 150.0))
            $canvas.SetPixel($x, $y, [System.Drawing.Color]::FromArgb($a, 255, 255, 255))
        }
    }
}
Save-Png $canvas (Join-Path $root 'android\app\src\main\res\drawable\ic_gymathome_stat.png')
$canvas.Dispose()
Write-Host "Wrote ic_gymathome_stat.png (96x96 white silhouette)"

# --- 4. splash.png : branded launch screen, same dimensions as the old one ---
$old = New-Object System.Drawing.Bitmap (Join-Path $root 'android\app\src\main\res\drawable\splash.png')
$sw = $old.Width; $sh = $old.Height
$old.Dispose()
$canvas = New-Object System.Drawing.Bitmap -ArgumentList $sw, $sh, ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$g = [System.Drawing.Graphics]::FromImage($canvas)
$g.SmoothingMode = 'AntiAlias'; $g.InterpolationMode = $hiq; $g.PixelOffsetMode = 'HighQuality'
$g.Clear($bg)
$target = [int]([Math]::Min($sw, $sh) * 0.26)
$ratio = [Math]::Min($target / $mark.Width, $target / $mark.Height)
$dw = [int]($mark.Width * $ratio); $dh = [int]($mark.Height * $ratio)
$g.DrawImage($mark, [int](($sw - $dw) / 2), [int](($sh - $dh) / 2), $dw, $dh)
$g.Dispose()
Save-Png $canvas (Join-Path $root 'android\app\src\main\res\drawable\splash.png')
$canvas.Dispose()
Write-Host "Wrote splash.png (${sw}x${sh})"

# --- 5. Launcher icons (home screen / app drawer) ---
# Square (legacy), round, and adaptive foreground per density
$launcherSizes = [ordered]@{ 'mdpi' = 48; 'hdpi' = 72; 'xhdpi' = 96; 'xxhdpi' = 144; 'xxxhdpi' = 192 }
foreach ($d in $launcherSizes.Keys) {
    $size = $launcherSizes[$d]
    $mipDir = Join-Path $root "android\app\src\main\res\mipmap-$d"

    # Square icon (legacy devices / fallback): bg + centered mark
    $canvas = New-Object System.Drawing.Bitmap -ArgumentList $size, $size, ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $g = [System.Drawing.Graphics]::FromImage($canvas)
    $g.SmoothingMode = 'AntiAlias'; $g.InterpolationMode = $hiq; $g.PixelOffsetMode = 'HighQuality'
    $g.Clear($bg)
    $target = [int]($size * 0.72)
    $ratio = [Math]::Min($target / $mark.Width, $target / $mark.Height)
    $dw = [int]($mark.Width * $ratio); $dh = [int]($mark.Height * $ratio)
    $g.DrawImage($mark, [int](($size - $dw) / 2), [int](($size - $dh) / 2), $dw, $dh)
    $g.Dispose()
    Save-Png $canvas (Join-Path $mipDir 'ic_launcher.png')
    $canvas.Dispose()

    # Round icon: circular bg badge + mark, transparent corners
    $canvas = New-Object System.Drawing.Bitmap -ArgumentList $size, $size, ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $g = [System.Drawing.Graphics]::FromImage($canvas)
    $g.SmoothingMode = 'AntiAlias'; $g.InterpolationMode = $hiq; $g.PixelOffsetMode = 'HighQuality'
    $g.Clear([System.Drawing.Color]::Transparent)
    $brush = New-Object System.Drawing.SolidBrush $bg
    $g.FillEllipse($brush, 0, 0, $size, $size)
    $target = [int]($size * 0.66)
    $ratio = [Math]::Min($target / $mark.Width, $target / $mark.Height)
    $dw = [int]($mark.Width * $ratio); $dh = [int]($mark.Height * $ratio)
    $g.DrawImage($mark, [int](($size - $dw) / 2), [int](($size - $dh) / 2), $dw, $dh)
    $g.Dispose()
    $rad = $size / 2.0
    for ($y = 0; $y -lt $size; $y++) {
        for ($x = 0; $x -lt $size; $x++) {
            $dx = $x - $rad + 0.5; $dy = $y - $rad + 0.5
            if (($dx * $dx + $dy * $dy) -gt ($rad * $rad)) {
                $p = $canvas.GetPixel($x, $y)
                if ($p.A -ne 0) { $canvas.SetPixel($x, $y, [System.Drawing.Color]::FromArgb(0, $p.R, $p.G, $p.B)) }
            }
        }
    }
    Save-Png $canvas (Join-Path $mipDir 'ic_launcher_round.png')
    $canvas.Dispose()

    # Adaptive foreground (mipmap-anydpi-v26 icon XML): round badge, corners
    # transparent so the launcher background color shows through the mask
    $canvas = New-Object System.Drawing.Bitmap -ArgumentList $size, $size, ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $g = [System.Drawing.Graphics]::FromImage($canvas)
    $g.SmoothingMode = 'AntiAlias'; $g.InterpolationMode = $hiq; $g.PixelOffsetMode = 'HighQuality'
    $g.Clear([System.Drawing.Color]::Transparent)
    $brush = New-Object System.Drawing.SolidBrush $bg
    $g.FillEllipse($brush, 0, 0, $size, $size)
    $target = [int]($size * 0.66)
    $ratio = [Math]::Min($target / $mark.Width, $target / $mark.Height)
    $dw = [int]($mark.Width * $ratio); $dh = [int]($mark.Height * $ratio)
    $g.DrawImage($mark, [int](($size - $dw) / 2), [int](($size - $dh) / 2), $dw, $dh)
    $g.Dispose()
    Save-Png $canvas (Join-Path $mipDir 'ic_launcher_foreground.png')
    $canvas.Dispose()
}
Write-Host "Wrote launcher icons (mdpi/hdpi/xhdpi/xxhdpi/xxxhdpi)"

# --- 6. Splash density variants (portrait + landscape) ---
# Regenerate every density-specific splash at its native size (these override
# the base drawable/splash.png on device, so they must carry the new logo too)
$splashFolders = Get-ChildItem (Join-Path $root 'android\app\src\main\res') -Directory |
    Where-Object { $_.Name -like 'drawable-port-*' -or $_.Name -like 'drawable-land-*' }
foreach ($folder in $splashFolders) {
    $splashPath = Join-Path $folder.FullName 'splash.png'
    if (-not (Test-Path $splashPath)) { continue }
    $old = New-Object System.Drawing.Bitmap $splashPath
    $sw = $old.Width; $sh = $old.Height
    $old.Dispose()
    $canvas = New-Object System.Drawing.Bitmap -ArgumentList $sw, $sh, ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $g = [System.Drawing.Graphics]::FromImage($canvas)
    $g.SmoothingMode = 'AntiAlias'; $g.InterpolationMode = $hiq; $g.PixelOffsetMode = 'HighQuality'
    $g.Clear($bg)
    $target = [int]([Math]::Min($sw, $sh) * 0.26)
    $ratio = [Math]::Min($target / $mark.Width, $target / $mark.Height)
    $dw = [int]($mark.Width * $ratio); $dh = [int]($mark.Height * $ratio)
    $g.DrawImage($mark, [int](($sw - $dw) / 2), [int](($sh - $dh) / 2), $dw, $dh)
    $g.Dispose()
    Save-Png $canvas $splashPath
    $canvas.Dispose()
    Write-Host "Wrote $($folder.Name)\splash.png (${sw}x${sh})"
}

$mark.Dispose()
$srcBmp.Dispose()
$src.Dispose()
Write-Host "Done."
