param(
  [string]$TempDir = "D:\tmp\pb-android",
  [string]$OutputApk = "",
  [switch]$KeepTemp
)

$ErrorActionPreference = "Stop"

function Resolve-FullPath([string]$Path) {
  return [System.IO.Path]::GetFullPath($Path)
}

function Invoke-Checked([string]$FilePath, [string[]]$Arguments, [string]$WorkingDirectory) {
  Write-Host "> $FilePath $($Arguments -join ' ')"
  Push-Location $WorkingDirectory
  try {
    & $FilePath @Arguments
    if ($LASTEXITCODE -ne 0) {
      throw "$FilePath exited with code $LASTEXITCODE"
    }
  } finally {
    Pop-Location
  }
}

$scriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$repoRoot = Resolve-FullPath (Join-Path $scriptRoot "..")
$mobileRoot = Join-Path $repoRoot "apps\mobile"

if ([string]::IsNullOrWhiteSpace($OutputApk)) {
  $OutputApk = Join-Path $mobileRoot "dist\paisa-buddy-release.apk"
}

$tempRoot = Resolve-FullPath $TempDir
$repoRootNormalized = $repoRoot.TrimEnd("\")
$tempRootNormalized = $tempRoot.TrimEnd("\")

if ($tempRootNormalized -ieq $repoRootNormalized -or $tempRootNormalized.StartsWith($repoRootNormalized + "\", [System.StringComparison]::OrdinalIgnoreCase)) {
  throw "TempDir must be outside the repo because it is removed before each build: $tempRoot"
}

$tempParent = Split-Path -Parent $tempRoot
if (-not (Test-Path -LiteralPath $tempParent)) {
  New-Item -ItemType Directory -Path $tempParent | Out-Null
}

if (Test-Path -LiteralPath $tempRoot) {
  Write-Host "Removing existing temp build directory: $tempRoot"
  Remove-Item -LiteralPath $tempRoot -Recurse -Force
}

Write-Host "Copying source to short-path build directory: $tempRoot"
robocopy $repoRoot $tempRoot /E /XD .git node_modules .next .turbo .expo .gradle build dist android /XF *.apk *.aab | Out-Host
if ($LASTEXITCODE -gt 7) {
  throw "robocopy failed with code $LASTEXITCODE"
}

Set-Content -LiteralPath (Join-Path $tempRoot ".npmrc") -Value "node-linker=hoisted" -NoNewline

Invoke-Checked "pnpm" @("install", "--frozen-lockfile") $tempRoot

$tempMobileRoot = Join-Path $tempRoot "apps\mobile"
Invoke-Checked "pnpm" @("exec", "expo", "prebuild", "--platform", "android", "--no-install") $tempMobileRoot

$gradleFile = Join-Path $tempMobileRoot "android\app\build.gradle"
$gradleText = Get-Content -LiteralPath $gradleFile -Raw
$generatedEntry = '    entryFile = file(["node", "-e", "require(''expo/scripts/resolveAppEntry'')", projectRoot, "android", "absolute"].execute(null, rootDir).text.trim())'
$fixedEntry = @"
    root = file("../..")
    entryFile = file("`$projectRoot/index.ts")
"@.TrimEnd()

if ($gradleText.Contains($generatedEntry)) {
  $gradleText = $gradleText.Replace($generatedEntry, $fixedEntry)
  Set-Content -LiteralPath $gradleFile -Value $gradleText -NoNewline
} elseif (-not $gradleText.Contains('entryFile = file("$projectRoot/index.ts")')) {
  throw "Could not find the expected Expo-generated entryFile line in $gradleFile"
}

Set-Content -LiteralPath (Join-Path $tempRoot "index.ts") -Value "import './apps/mobile/index'" -NoNewline

$androidRoot = Join-Path $tempMobileRoot "android"
$env:NODE_ENV = "production"
Invoke-Checked ".\gradlew.bat" @("clean", "assembleRelease") $androidRoot

$builtApk = Join-Path $androidRoot "app\build\outputs\apk\release\app-release.apk"
if (-not (Test-Path -LiteralPath $builtApk)) {
  throw "Build completed but APK was not found at $builtApk"
}

$outputDir = Split-Path -Parent (Resolve-FullPath $OutputApk)
if (-not (Test-Path -LiteralPath $outputDir)) {
  New-Item -ItemType Directory -Path $outputDir | Out-Null
}

Copy-Item -LiteralPath $builtApk -Destination $OutputApk -Force
$apk = Get-Item -LiteralPath $OutputApk
Write-Host "APK written to $($apk.FullName) ($([math]::Round($apk.Length / 1MB, 2)) MB)"

if (-not $KeepTemp) {
  Write-Host "Removing temp build directory: $tempRoot"
  Remove-Item -LiteralPath $tempRoot -Recurse -Force
}
