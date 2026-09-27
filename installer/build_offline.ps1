param(
    [Parameter(Mandatory=$true)][string]$RuntimeDir,
    [Parameter(Mandatory=$true)][string]$ToolsDir,
    [Parameter(Mandatory=$true)][string]$HuggingFaceHub,
    [string]$InnoCompiler = 'C:\Program Files (x86)\Inno Setup 6\ISCC.exe'
)
$ErrorActionPreference = 'Stop'
$repo = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$bundle = Join-Path $PSScriptRoot 'bundle'
if (Test-Path -LiteralPath $bundle) { throw "Bundle already exists: $bundle. Remove it deliberately before rebuilding." }
$runtime = (Resolve-Path -LiteralPath $RuntimeDir).Path
$tools = (Resolve-Path -LiteralPath $ToolsDir).Path
$hub = (Resolve-Path -LiteralPath $HuggingFaceHub).Path
foreach ($required in @(
    (Join-Path $runtime 'python.exe'),
    (Join-Path $tools 'ffmpeg\bin\ffmpeg.exe'),
    (Join-Path $tools 'poppler\bin\pdftoppm.exe'),
    (Join-Path $tools 'tesseract\tesseract.exe'),
    (Join-Path $repo 'client\dist\index.html'),
    (Join-Path $repo 'server\models\Qwen3-4B-Q4_K_M.gguf'),
    (Join-Path $repo 'server\models\lid.176.bin'),
    (Join-Path $repo 'server\models\indic-comet\checkpoints\model.ckpt'),
    (Join-Path $repo 'server\models\indic-comet\hparams.yaml'),
    (Join-Path $runtime 'Lib\site-packages\comet'),
    (Join-Path $tools 'tesseract\tessdata\eng.traineddata'),
    (Join-Path $tools 'tesseract\tessdata\hin.traineddata'),
    (Join-Path $tools 'tesseract\tessdata\mar.traineddata'),
    $InnoCompiler
)) { if (-not (Test-Path -LiteralPath $required)) { throw "Required offline asset missing: $required" } }
foreach ($model in @(
    'models--ai4bharat--indictrans2-en-indic-dist-200M',
    'models--ai4bharat--indictrans2-indic-en-dist-200M',
    'models--ai4bharat--indictrans2-indic-indic-dist-320M',
    'models--Systran--faster-whisper-small',
    'models--sentence-transformers--all-MiniLM-L6-v2',
    'models--facebook--mms-tts-eng', 'models--facebook--mms-tts-hin',
    'models--facebook--mms-tts-mar'
)) { if (-not (Test-Path -LiteralPath (Join-Path $hub "$model\snapshots"))) { throw "Model cache missing: $model" } }

New-Item -ItemType Directory -Force -Path (Join-Path $bundle 'server\models\huggingface\hub'), (Join-Path $bundle 'client'), (Join-Path $bundle 'seed-data') | Out-Null
Copy-Item -LiteralPath $runtime -Destination (Join-Path $bundle 'runtime') -Recurse
Copy-Item -LiteralPath $tools -Destination (Join-Path $bundle 'tools') -Recurse
Copy-Item -LiteralPath (Join-Path $repo 'client\dist') -Destination (Join-Path $bundle 'client\dist') -Recurse
foreach ($directory in @('db','routers','services','task_queue')) {
    Copy-Item -LiteralPath (Join-Path $repo "server\$directory") -Destination (Join-Path $bundle "server\$directory") -Recurse
}
foreach ($file in @('config.py','main.py','validate_install.py','quality_worker.py','requirements.txt')) {
    Copy-Item -LiteralPath (Join-Path $repo "server\$file") -Destination (Join-Path $bundle "server\$file")
}
Copy-Item -LiteralPath (Join-Path $repo 'server\models\Qwen3-4B-Q4_K_M.gguf') -Destination (Join-Path $bundle 'server\models')
Copy-Item -LiteralPath (Join-Path $repo 'server\models\lid.176.bin') -Destination (Join-Path $bundle 'server\models')
Copy-Item -LiteralPath (Join-Path $repo 'server\models\indic-comet') -Destination (Join-Path $bundle 'server\models\indic-comet') -Recurse
Copy-Item -LiteralPath (Join-Path $repo 'server\models\embeddings') -Destination (Join-Path $bundle 'server\models\embeddings') -Recurse
Copy-Item -Path (Join-Path $hub '*') -Destination (Join-Path $bundle 'server\models\huggingface\hub') -Recurse
foreach ($file in @('kb.faiss','kb_meta.json')) {
    Copy-Item -LiteralPath (Join-Path $repo "server\data\$file") -Destination (Join-Path $bundle 'seed-data')
}
Copy-Item -LiteralPath (Join-Path $repo 'launch.ps1') -Destination $bundle
Copy-Item -LiteralPath (Join-Path $repo 'icon.ico') -Destination $bundle
& $InnoCompiler (Join-Path $PSScriptRoot 'BhashaNode.iss')
if ($LASTEXITCODE -ne 0) { throw 'Inno Setup could not build the installer.' }
