# Refresh application code in the existing offline bundle, then rebuild Setup.
param(
    [ValidatePattern('^\d+\.\d+\.\d+(\.\d+)?$')][string]$Version = '2.1.1',
    [string]$InnoCompiler = ''
)
$ErrorActionPreference = 'Stop'
$repo = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..')).Path
$bundle = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot 'bundle')).Path
$python = Join-Path $bundle 'runtime\python.exe'
if (-not (Test-Path -LiteralPath $python)) {
    throw 'The offline bundle is missing. Run build_offline.ps1 first; see installer/README.md.'
}
if (-not $InnoCompiler) {
    $candidates = @(
        (Join-Path $env:LOCALAPPDATA 'Programs\Inno Setup 6\ISCC.exe'),
        (Join-Path ${env:ProgramFiles(x86)} 'Inno Setup 6\ISCC.exe')
    )
    $InnoCompiler = $candidates | Where-Object { Test-Path -LiteralPath $_ } | Select-Object -First 1
    if (-not $InnoCompiler) {
        $command = Get-Command ISCC.exe -ErrorAction SilentlyContinue
        if ($command) { $InnoCompiler = $command.Source }
    }
}
if (-not $InnoCompiler -or -not (Test-Path -LiteralPath $InnoCompiler)) {
    throw 'Inno Setup compiler not found. Supply -InnoCompiler with the full path to ISCC.exe.'
}
if (Get-CimInstance Win32_Process | Where-Object {
    $_.Name -in @('python.exe', 'pythonw.exe') -and $_.CommandLine -like "*$bundle*"
}) { throw 'The offline bundle is running. Stop its backend before updating the bundle.' }

$requirements = Join-Path $repo 'server\requirements.txt'
$bundledRequirements = Join-Path $bundle 'server\requirements.txt'
if ((Get-FileHash -LiteralPath $requirements).Hash -ne (Get-FileHash -LiteralPath $bundledRequirements).Hash) {
    throw 'Python requirements changed. Rebuild/update the offline runtime with build_offline.ps1 first; see installer/README.md.'
}

# Only these generated application directories may be replaced. Models,
# dependencies, tools, seed data and installed user data are outside this list.
$directories = @('client\dist', 'server\db', 'server\routers', 'server\services', 'server\task_queue')
$allowedTargets = @($directories | ForEach-Object { [IO.Path]::GetFullPath((Join-Path $bundle $_)) })
function Sync-AppDirectory([string]$relative) {
    $source = Join-Path $repo $relative
    $target = [IO.Path]::GetFullPath((Join-Path $bundle $relative))
    if ($allowedTargets -notcontains $target -or -not $target.StartsWith($bundle + '\', [StringComparison]::OrdinalIgnoreCase)) {
        throw "Refusing to replace a directory outside the application bundle: $target"
    }
    if (-not (Test-Path -LiteralPath $source -PathType Container)) { throw "Source directory missing: $source" }
    if (Test-Path -LiteralPath $target) { Remove-Item -LiteralPath $target -Recurse -Force }
    New-Item -ItemType Directory -Path $target -Force | Out-Null
    foreach ($file in Get-ChildItem -LiteralPath $source -Recurse -File) {
        if ($file.FullName -match '[\\/]__pycache__[\\/]' -or $file.Extension -eq '.pyc') { continue }
        $destination = Join-Path $target $file.FullName.Substring($source.Length + 1)
        New-Item -ItemType Directory -Path (Split-Path -Parent $destination) -Force | Out-Null
        Copy-Item -LiteralPath $file.FullName -Destination $destination -Force
    }
}

Push-Location (Join-Path $repo 'client')
try {
    & npm.cmd run build
    if ($LASTEXITCODE -ne 0) { throw 'Frontend build failed; installer was not rebuilt.' }
} finally { Pop-Location }
foreach ($relative in $directories) { Sync-AppDirectory $relative }
$rootFiles = @('launch.ps1', 'icon.ico')
$serverFiles = @('config.py', 'main.py', 'validate_install.py', 'quality_worker.py', 'requirements.txt')
foreach ($file in $rootFiles) {
    Copy-Item -LiteralPath (Join-Path $repo $file) -Destination (Join-Path $bundle $file) -Force
}
foreach ($file in $serverFiles) {
    Copy-Item -LiteralPath (Join-Path $repo "server\$file") -Destination (Join-Path $bundle "server\$file") -Force
}

# Compare every refreshed file so Setup cannot silently ship stale app code.
$files = @($rootFiles) + @($serverFiles | ForEach-Object { "server\$_" })
foreach ($relative in $directories) {
    $source = Join-Path $repo $relative
    $files += @(Get-ChildItem -LiteralPath $source -Recurse -File | Where-Object {
        $_.FullName -notmatch '[\\/]__pycache__[\\/]' -and $_.Extension -ne '.pyc'
    } | ForEach-Object { $_.FullName.Substring($repo.Length + 1) })
}
$hashes = [ordered]@{}
foreach ($relative in $files) {
    $sourceHash = (Get-FileHash -LiteralPath (Join-Path $repo $relative)).Hash
    if ($sourceHash -ne (Get-FileHash -LiteralPath (Join-Path $bundle $relative)).Hash) {
        throw "Bundle does not match current code: $relative"
    }
    $hashes[$relative] = $sourceHash
}

$environmentNames = @('HF_HOME', 'BHASHA_INSTALLED', 'BHASHA_DATA_DIR', 'HF_HUB_OFFLINE', 'TRANSFORMERS_OFFLINE', 'HF_DATASETS_OFFLINE', 'PYTHONDONTWRITEBYTECODE')
$savedEnvironment = @{}
foreach ($name in $environmentNames) { $savedEnvironment[$name] = [Environment]::GetEnvironmentVariable($name, 'Process') }
try {
    $env:HF_HOME = Join-Path $bundle 'server\models\huggingface'
    $env:BHASHA_INSTALLED = '1'
    $env:BHASHA_DATA_DIR = Join-Path $env:TEMP 'BhashaNodeBuildValidation'
    $env:HF_HUB_OFFLINE = '1'
    $env:TRANSFORMERS_OFFLINE = '1'
    $env:HF_DATASETS_OFFLINE = '1'
    $env:PYTHONDONTWRITEBYTECODE = '1'
    $validationText = & $python (Join-Path $bundle 'server\validate_install.py')
    if ($LASTEXITCODE -ne 0) { throw 'Offline validation did not run successfully.' }
    $validation = $validationText | ConvertFrom-Json
    if (-not $validation.ready) { throw "Offline bundle validation failed: $validationText" }
    & $python -c 'import torch, fastapi, transformers, faster_whisper, faiss, llama_cpp; print(torch.__version__)'
    if ($LASTEXITCODE -ne 0) { throw 'Portable runtime import check failed.' }
    Write-Host "Offline assets ready. IndicCOMET available: $($validation.quality_available)"
} finally {
    foreach ($name in $environmentNames) { [Environment]::SetEnvironmentVariable($name, $savedEnvironment[$name], 'Process') }
}

Write-Host 'Compiling BhashaNode-Setup into installer/release-final...'
& $InnoCompiler /Qp "/DAppVersion=$Version" (Join-Path $PSScriptRoot 'BhashaNode.iss')
if ($LASTEXITCODE -ne 0) { throw 'Installer compilation failed.' }
$release = Join-Path $PSScriptRoot 'release-final'
$buildInfo = [ordered]@{
    setup_version = $Version
    built_at_utc = [DateTime]::UtcNow.ToString('o')
    note = 'Snapshot of the current working files, including uncommitted changes. Runtime and models reused from installer/bundle.'
    app_file_sha256 = $hashes
}
$buildInfo | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath (Join-Path $release 'BUILD-INFO.json') -Encoding UTF8
Get-ChildItem -LiteralPath $release -File | Where-Object { $_.Name -like 'BhashaNode-Setup*' } | Select-Object Name, Length
Write-Host "Updated installer: $release. Distribute Setup.exe with ALL Setup-*.bin files."
