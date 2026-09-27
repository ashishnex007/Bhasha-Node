param(
    [Parameter(Mandatory=$true)][string]$PythonBase,
    [Parameter(Mandatory=$true)][string]$SitePackages,
    [Parameter(Mandatory=$true)][string]$CpuTorchWheel,
    [Parameter(Mandatory=$true)][string]$FFmpegDir,
    [Parameter(Mandatory=$true)][string]$PopplerDir,
    [Parameter(Mandatory=$true)][string]$TesseractDir,
    [Parameter(Mandatory=$true)][string]$HuggingFaceHub,
    [string]$InnoCompiler = 'C:\Program Files (x86)\Inno Setup 6\ISCC.exe'
)
$ErrorActionPreference = 'Stop'
$repo = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$bundle = Join-Path $PSScriptRoot 'bundle'
if (Test-Path -LiteralPath $bundle) { throw "Bundle already exists: $bundle. Remove it deliberately before rebuilding." }
$python = (Resolve-Path -LiteralPath $PythonBase).Path
$packages = (Resolve-Path -LiteralPath $SitePackages).Path
$wheel = (Resolve-Path -LiteralPath $CpuTorchWheel).Path
$ffmpeg = (Resolve-Path -LiteralPath $FFmpegDir).Path
$poppler = (Resolve-Path -LiteralPath $PopplerDir).Path
$tesseract = (Resolve-Path -LiteralPath $TesseractDir).Path
$hub = (Resolve-Path -LiteralPath $HuggingFaceHub).Path
foreach ($required in @(
    (Join-Path $python 'python.exe'), (Join-Path $python 'Lib'),
    (Join-Path $ffmpeg 'ffmpeg.exe'), (Join-Path $poppler 'pdftoppm.exe'),
    (Join-Path $tesseract 'tesseract.exe'),
    (Join-Path $repo 'client\dist\index.html'),
    (Join-Path $repo 'server\models\Qwen3-4B-Q4_K_M.gguf'),
    (Join-Path $repo 'server\models\lid.176.bin'),
    $wheel, $InnoCompiler
)) { if (-not (Test-Path -LiteralPath $required)) { throw "Required offline asset missing: $required" } }
foreach ($lang in @('eng', 'hin', 'mar')) {
    $pack = Join-Path $tesseract "tessdata\$lang.traineddata"
    if (-not (Test-Path -LiteralPath $pack)) { throw "OCR data missing: $pack" }
}
$models = @(
    'models--ai4bharat--indictrans2-en-indic-dist-200M',
    'models--ai4bharat--indictrans2-indic-en-dist-200M',
    'models--ai4bharat--indictrans2-indic-indic-dist-320M',
    'models--Systran--faster-whisper-small',
    'models--sentence-transformers--all-MiniLM-L6-v2',
    'models--facebook--mms-tts-eng', 'models--facebook--mms-tts-hin',
    'models--facebook--mms-tts-mar'
)
foreach ($model in $models) {
    foreach ($part in @('refs', 'snapshots')) {
        if (-not (Test-Path -LiteralPath (Join-Path $hub "$model\$part"))) { throw "Model cache missing: $model/$part" }
    }
}

$runtime = Join-Path $bundle 'runtime'
$targetPackages = Join-Path $runtime 'Lib\site-packages'
$tools = Join-Path $bundle 'tools'
New-Item -ItemType Directory -Force -Path $targetPackages, (Join-Path $tools 'ffmpeg\bin'),
    (Join-Path $tools 'poppler\bin'), (Join-Path $tools 'tesseract\tessdata'),
    (Join-Path $bundle 'server\models\huggingface\hub'), (Join-Path $bundle 'client'),
    (Join-Path $bundle 'seed-data') | Out-Null

# Ship a standalone Python interpreter and the already verified app packages.
Get-ChildItem -LiteralPath $python -File | Copy-Item -Destination $runtime
Copy-Item -LiteralPath (Join-Path $python 'DLLs') -Destination (Join-Path $runtime 'DLLs') -Recurse
Get-ChildItem -LiteralPath (Join-Path $python 'Lib') | Where-Object Name -ne 'site-packages' |
    Copy-Item -Destination (Join-Path $runtime 'Lib') -Recurse
Get-ChildItem -LiteralPath $packages | Where-Object {
    $_.Name -notmatch '^(torch|torchaudio|torchvision|torchgen|functorch)(-|$)'
} | Copy-Item -Destination $targetPackages -Recurse
& (Join-Path $python 'python.exe') -m pip install --no-deps --no-compile --target $targetPackages $wheel
if ($LASTEXITCODE -ne 0) { throw 'CPU PyTorch installation failed.' }

Copy-Item -LiteralPath (Join-Path $ffmpeg 'ffmpeg.exe') -Destination (Join-Path $tools 'ffmpeg\bin')
Copy-Item -LiteralPath (Join-Path $ffmpeg 'ffprobe.exe') -Destination (Join-Path $tools 'ffmpeg\bin')
Get-ChildItem -LiteralPath $poppler -File | Copy-Item -Destination (Join-Path $tools 'poppler\bin')
Get-ChildItem -LiteralPath $tesseract | Where-Object Name -ne 'tessdata' |
    Copy-Item -Destination (Join-Path $tools 'tesseract') -Recurse
foreach ($lang in @('eng', 'hin', 'mar')) {
    Copy-Item -LiteralPath (Join-Path $tesseract "tessdata\$lang.traineddata") -Destination (Join-Path $tools 'tesseract\tessdata')
}

Copy-Item -LiteralPath (Join-Path $repo 'client\dist') -Destination (Join-Path $bundle 'client\dist') -Recurse
foreach ($directory in @('db','routers','services','task_queue')) {
    Copy-Item -LiteralPath (Join-Path $repo "server\$directory") -Destination (Join-Path $bundle "server\$directory") -Recurse
}
foreach ($file in @('config.py','main.py','validate_install.py','quality_worker.py','requirements.txt')) {
    Copy-Item -LiteralPath (Join-Path $repo "server\$file") -Destination (Join-Path $bundle "server\$file")
}
foreach ($file in @('Qwen3-4B-Q4_K_M.gguf', 'lid.176.bin')) {
    Copy-Item -LiteralPath (Join-Path $repo "server\models\$file") -Destination (Join-Path $bundle 'server\models')
}
if (Test-Path -LiteralPath (Join-Path $repo 'server\models\indic-comet\checkpoints\model.ckpt')) {
    Copy-Item -LiteralPath (Join-Path $repo 'server\models\indic-comet') -Destination (Join-Path $bundle 'server\models\indic-comet') -Recurse
}
Copy-Item -LiteralPath (Join-Path $repo 'server\models\embeddings') -Destination (Join-Path $bundle 'server\models\embeddings') -Recurse
foreach ($model in $models) {
    $destination = Join-Path $bundle "server\models\huggingface\hub\$model"
    New-Item -ItemType Directory -Path $destination | Out-Null
    foreach ($part in @('refs', 'snapshots')) {
        Copy-Item -LiteralPath (Join-Path $hub "$model\$part") -Destination (Join-Path $destination $part) -Recurse
    }
}
foreach ($file in @('kb.faiss','kb_meta.json')) {
    Copy-Item -LiteralPath (Join-Path $repo "server\data\$file") -Destination (Join-Path $bundle 'seed-data')
}
Copy-Item -LiteralPath (Join-Path $repo 'launch.ps1') -Destination $bundle
Copy-Item -LiteralPath (Join-Path $repo 'icon.ico') -Destination $bundle

# Test the portable interpreter before compiling the installer.
$env:HF_HOME = Join-Path $bundle 'server\models\huggingface'
$env:BHASHA_INSTALLED = '1'
$env:BHASHA_DATA_DIR = Join-Path $env:TEMP 'BhashaNodeBuildValidation'
$env:HF_HUB_OFFLINE = '1'
$env:TRANSFORMERS_OFFLINE = '1'
$env:HF_DATASETS_OFFLINE = '1'
$validation = & (Join-Path $runtime 'python.exe') (Join-Path $bundle 'server\validate_install.py') | ConvertFrom-Json
if (-not $validation.ready) {
    $missing = @($validation.checks.PSObject.Properties | Where-Object { -not $_.Value } | Select-Object -ExpandProperty Name)
    throw "Offline bundle validation failed: $($missing -join ', ')"
}
& (Join-Path $runtime 'python.exe') -c 'import torch, fastapi, transformers, faster_whisper, faiss, llama_cpp; print(torch.__version__)'
if ($LASTEXITCODE -ne 0) { throw 'Portable Python import smoke test failed.' }

& $InnoCompiler (Join-Path $PSScriptRoot 'BhashaNode.iss')
if ($LASTEXITCODE -ne 0) { throw 'Inno Setup could not build the installer.' }
