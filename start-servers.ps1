$ErrorActionPreference = 'Continue'
$root = 'C:\Users\Pc\UrOwnMenu'

# ---- stop anything old ----------------------------------------------------
& powershell -ExecutionPolicy Bypass -File (Join-Path $root 'stop-servers.ps1') | Out-Null

# ---- start the API (Hono Worker + local D1) ------------------------------
$apiOut = Join-Path $root 'api.log'
$apiErr = Join-Path $root 'api.err.log'
Remove-Item $apiOut, $apiErr -ErrorAction SilentlyContinue

$apiProc = Start-Process -FilePath 'cmd.exe' `
    -ArgumentList ('/c', ('npx wrangler dev --port 8787 > "' + $apiOut + '" 2>&1')) `
    -WorkingDirectory (Join-Path $root 'apps\api') `
    -WindowStyle Hidden -PassThru
Write-Host ("API root PID: {0}" -f $apiProc.Id)

# ---- start the web app (Vite) --------------------------------------------
$webOut = Join-Path $root 'web.log'
$webErr = Join-Path $root 'web.err.log'
Remove-Item $webOut, $webErr -ErrorAction SilentlyContinue

$webProc = Start-Process -FilePath 'cmd.exe' `
    -ArgumentList ('/c', ('npx vite dev --port 5173 > "' + $webOut + '" 2>&1')) `
    -WorkingDirectory (Join-Path $root 'apps\web') `
    -WindowStyle Hidden -PassThru
Write-Host ("Web root PID: {0}" -f $webProc.Id)

# ---- wait for readiness --------------------------------------------------
function Test-Url([string]$u) {
    try {
        $null = Invoke-WebRequest $u -UseBasicParsing -TimeoutSec 3
        return $true
    } catch {
        return $false
    }
}

$apiUp = $false
$webUp = $false
for ($i = 0; $i -lt 45; $i++) {
    Start-Sleep -Seconds 2
    if (-not $apiUp) { $apiUp = Test-Url 'http://127.0.0.1:8787/health' }
    if (-not $webUp) { $webUp = Test-Url 'http://localhost:5173/' }
    if ($apiUp -and $webUp) { break }
}

Write-Host ''
Write-Host ("API ready: {0}   Web ready: {1}" -f $apiUp, $webUp)

if (-not $apiUp) {
    Write-Host '--- api.log (tail) ---'
    if (Test-Path $apiOut) { Get-Content $apiOut -Tail 30 }
}
if (-not $webUp) {
    Write-Host '--- web.log (tail) ---'
    if (Test-Path $webOut) { Get-Content $webOut -Tail 30 }
}

if (-not ($apiUp -and $webUp)) { exit 1 }
Write-Host 'Both servers are running.'
exit 0
