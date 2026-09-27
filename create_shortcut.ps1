# =============================================================================
#  Bhasha Node — Desktop Shortcut Creator
#  Run this ONCE to place a "Bhasha Node" icon on your Desktop.
#  After that, just double-click the Desktop icon to launch everything.
# =============================================================================

$ROOT      = $PSScriptRoot
$PS_FILE  = "$ROOT\launch.ps1"
$ICO_FILE  = "$ROOT\icon.ico"
$DESKTOP   = [Environment]::GetFolderPath("Desktop")
$SHORTCUT  = "$DESKTOP\Bhasha Node.lnk"

# ── Sanity checks ─────────────────────────────────────────────────────────────
if (-not (Test-Path $PS_FILE)) {
    Write-Host "ERROR: Cannot find launch.ps1 at $PS_FILE" -ForegroundColor Red
    Read-Host "Press ENTER to exit"
    exit 1
}

# ── Create the WScript shortcut ───────────────────────────────────────────────
$WScriptShell = New-Object -ComObject WScript.Shell
$sc = $WScriptShell.CreateShortcut($SHORTCUT)

# Point directly at powershell.exe — most reliable from a desktop shortcut
$sc.TargetPath       = "C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe"
$sc.Arguments        = "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$PS_FILE`""
$sc.WorkingDirectory = $ROOT
$sc.WindowStyle      = 7          # Minimized; launcher shows diagnostics in a dialog.
$sc.Description      = "Launch Bhasha Node (AI translation assistant)"

if (Test-Path $ICO_FILE) {
    $sc.IconLocation = "$ICO_FILE,0"
} else {
    $sc.IconLocation = "C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe,0"
}

$sc.Save()

Write-Host ""
Write-Host "  OK  Desktop shortcut created:" -ForegroundColor Green
Write-Host "     $SHORTCUT" -ForegroundColor Cyan
Write-Host ""
Write-Host "  Double-click Bhasha Node on your Desktop to launch." -ForegroundColor Green
Write-Host ""

Start-Sleep -Seconds 2
