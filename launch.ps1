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

    # Locate Hugging Face model cache (production installed bundle, local bundle, or user cache)
    $hfCandidates = @(
        (Join-Path $serverDir 'models\huggingface'),
        (Join-Path $root 'installer\bundle\server\models\huggingface'),
        (Join-Path $env:USERPROFILE '.cache\huggingface')
    )
    foreach ($cand in $hfCandidates) {
        if (Test-Path -LiteralPath (Join-Path $cand 'hub\models--ai4bharat--indictrans2-en-indic-dist-200M')) {
            $env:HF_HOME = $cand
            break
        }
    }

    $env:HF_HUB_OFFLINE = '1'
    $env:TRANSFORMERS_OFFLINE = '1'
    $env:HF_DATASETS_OFFLINE = '1'
    $env:PYTHONUTF8 = '1'
    $env:PYTHONIOENCODING = 'utf-8'

    # Locate Tesseract OCR data
    $tessCandidates = @(
        (Join-Path $root 'tools\tesseract\tessdata'),
        (Join-Path $root 'installer\bundle\tools\tesseract\tessdata'),
        'C:\Program Files\Tesseract-OCR\tessdata'
    )
    foreach ($cand in $tessCandidates) {
        if (Test-Path -LiteralPath $cand) {
            $env:TESSDATA_PREFIX = $cand
            break
        }
    }

    # Add tool directories to PATH if present
    $toolDirs = @(
        (Join-Path $root 'tools\ffmpeg\bin'),
        (Join-Path $root 'tools\poppler\bin'),
        (Join-Path $root 'tools\tesseract'),
        (Join-Path $root 'installer\bundle\tools\ffmpeg\bin'),
        (Join-Path $root 'installer\bundle\tools\poppler\bin'),
        (Join-Path $root 'installer\bundle\tools\tesseract')
    )
    foreach ($td in $toolDirs) {
        if (Test-Path -LiteralPath $td) {
            $env:PATH = "$td;$env:PATH"
        }
    }

    $seedCandidates = @(
        (Join-Path $root 'seed-data'),
        (Join-Path $root 'installer\bundle\seed-data'),
        (Join-Path $serverDir 'data')
    )
    $seed = $null
    foreach ($cand in $seedCandidates) {
        if (Test-Path -LiteralPath $cand) { $seed = $cand; break }
    }
    $userData = Join-Path $dataRoot 'data'
    New-Item -ItemType Directory -Path $userData -Force | Out-Null
    if ($seed) {
        foreach ($name in @('kb.faiss', 'kb_meta.json')) {
            $destination = Join-Path $userData $name
            $source = Join-Path $seed $name
            if (-not (Test-Path -LiteralPath $destination) -and (Test-Path -LiteralPath $source)) {
                Copy-Item -LiteralPath $source -Destination $destination
            }
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
