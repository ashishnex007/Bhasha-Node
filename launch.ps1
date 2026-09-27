# Bhasha Node production launcher. All services stay on 127.0.0.1.
$ErrorActionPreference = 'Stop'
$root = $PSScriptRoot
$serverDir = Join-Path $root 'server'
$runtime = Join-Path $root 'runtime\python.exe'
if (-not (Test-Path -LiteralPath $runtime)) {
    $runtime = Join-Path $serverDir 'venv\Scripts\python.exe' # developer checkout
}
$dataRoot = Join-Path $env:LOCALAPPDATA 'BhashaNode'
$logDir = Join-Path $dataRoot 'logs'
New-Item -ItemType Directory -Path $logDir -Force | Out-Null
$log = Join-Path $logDir 'backend.log'
$err = Join-Path $logDir 'backend-error.log'

function Show-Failure([string]$detail) {
    Add-Type -AssemblyName System.Windows.Forms
    [System.Windows.Forms.MessageBox]::Show(
        "Bhasha Node could not start its local service. $detail`n`nDiagnostics: $err",
        'Bhasha Node', 'OK', 'Error') | Out-Null
}

try {
    if (-not (Test-Path -LiteralPath $runtime)) { throw 'The bundled Python runtime is missing.' }
    if (-not (Test-Path -LiteralPath (Join-Path $root 'client\dist\index.html'))) { throw 'The frontend build is missing.' }
    $env:BHASHA_DATA_DIR = $dataRoot
    $env:BHASHA_INSTALLED = '1'
    $env:HF_HOME = Join-Path $serverDir 'models\huggingface'
    $env:HF_HUB_OFFLINE = '1'
    $env:TRANSFORMERS_OFFLINE = '1'
    $env:HF_DATASETS_OFFLINE = '1'
    $env:PYTHONUTF8 = '1'
    $env:PYTHONIOENCODING = 'utf-8'
    $env:TESSDATA_PREFIX = Join-Path $root 'tools\tesseract\tessdata'

    $seed = Join-Path $root 'seed-data'
    $userData = Join-Path $dataRoot 'data'
    New-Item -ItemType Directory -Path $userData -Force | Out-Null
    foreach ($name in @('kb.faiss', 'kb_meta.json')) {
        $destination = Join-Path $userData $name
        $source = Join-Path $seed $name
        if (-not (Test-Path -LiteralPath $destination) -and (Test-Path -LiteralPath $source)) {
            Copy-Item -LiteralPath $source -Destination $destination
        }
    }
    if (Test-Path -LiteralPath (Join-Path $root 'runtime\python.exe')) {
        $validation = & $runtime (Join-Path $serverDir 'validate_install.py') | ConvertFrom-Json
        if (-not $validation.ready) {
            $missing = @($validation.checks.PSObject.Properties | Where-Object { -not $_.Value } | Select-Object -ExpandProperty Name)
            throw "Required offline components are missing: $($missing -join ', ')"
        }
    }

    $ready = $false
    try {
        $response = Invoke-RestMethod 'http://127.0.0.1:8000/api/capabilities' -TimeoutSec 2
        $ready = $null -ne $response.languages
    } catch {}

    if (-not $ready) {
        $process = Start-Process -FilePath $runtime -ArgumentList @('-m','uvicorn','main:app','--host','127.0.0.1','--port','8000') `
            -WorkingDirectory $serverDir -RedirectStandardOutput $log -RedirectStandardError $err `
            -WindowStyle Hidden -PassThru
        for ($attempt = 0; $attempt -lt 180; $attempt++) {
            if ($process.HasExited) { throw 'The local service exited during startup.' }
            try {
                $response = Invoke-RestMethod 'http://127.0.0.1:8000/api/capabilities' -TimeoutSec 2
                if ($null -ne $response.languages) { $ready = $true; break }
            } catch {}
            Start-Sleep -Seconds 2
        }
    }
    if (-not $ready) { throw 'The local service did not become ready in time.' }
    Start-Process 'http://127.0.0.1:8000/app/'
} catch {
    $_ | Out-String | Add-Content -LiteralPath $err
    Show-Failure $_.Exception.Message
    exit 1
}
