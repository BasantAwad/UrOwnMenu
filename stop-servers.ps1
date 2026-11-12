$ErrorActionPreference = 'SilentlyContinue'

# Kill from the ROOT of each tree (cmd.exe wrapper) so nothing respawns.
$roots = Get-CimInstance Win32_Process -ErrorAction SilentlyContinue |
    Where-Object {
        $_.Name -eq 'cmd.exe' -and
        ($_.CommandLine -match 'wrangler dev' -or $_.CommandLine -match 'vite dev')
    }

foreach ($r in $roots) {
    Write-Host "Killing tree rooted at PID $($r.ProcessId): $($r.CommandLine)"
    cmd /c "taskkill /T /F /PID $($r.ProcessId)" | Out-Null
}

Start-Sleep -Seconds 2

# Second pass: anything still holding the ports or matching our project
foreach ($port in 8787, 5173) {
    $conns = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue
    foreach ($c in $conns) {
        Write-Host "Port $port held by PID $($c.OwningProcess) - killing tree"
        cmd /c "taskkill /T /F /PID $($c.OwningProcess)" | Out-Null
    }
}

Start-Sleep -Seconds 3

$still = Get-NetTCPConnection -State Listen -ErrorAction SilentlyContinue |
    Where-Object { $_.LocalPort -in 5173, 8787 }
if ($still) {
    Write-Host 'STILL LISTENING:'
    $still | Select-Object LocalPort, OwningProcess | Format-Table -AutoSize
    exit 1
} else {
    Write-Host 'All clear - ports 5173 and 8787 are free.'
}
