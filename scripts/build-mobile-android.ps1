param(
  [string]$TempDir = "D:\tmp\pb-android",
  [string]$OutputAab = "",
  [string]$OutputApk = "",
  [switch]$Apk,
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

function Set-GradleProperty([string]$FilePath, [string]$Name, [string]$Value) {
  $lines = Get-Content -LiteralPath $FilePath
  $updated = $false
  $lines = $lines | ForEach-Object {
    if ($_ -match "^\s*$([regex]::Escape($Name))=") {
      $updated = $true
      "$Name=$Value"
    } else {
      $_
    }
  }

  if (-not $updated) {
    $lines += "$Name=$Value"
  }

  Set-Content -LiteralPath $FilePath -Value $lines
}

function Remove-DirectoryWithRetry([string]$Path, [switch]$BestEffort) {
  for ($attempt = 1; $attempt -le 5; $attempt++) {
    try {
      Remove-Item -LiteralPath $Path -Recurse -Force
      return
    } catch {
      if ($attempt -eq 5) {
        if ($BestEffort) {
          Write-Warning "Could not remove $Path because files are still locked: $($_.Exception.Message)"
          return
        }

        throw
      }

      Start-Sleep -Seconds 2
    }
  }
}

$scriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$repoRoot = Resolve-FullPath (Join-Path $scriptRoot "..")
$mobileRoot = Join-Path $repoRoot "apps\mobile"

if ([string]::IsNullOrWhiteSpace($OutputAab)) {
  $OutputAab = Join-Path $mobileRoot "dist\paisa-buddy-release.aab"
}

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
  Remove-DirectoryWithRetry $tempRoot
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

$gradlePropertiesFile = Join-Path $tempMobileRoot "android\gradle.properties"
Set-GradleProperty $gradlePropertiesFile "org.gradle.jvmargs" "-Xmx4096m -XX:MaxMetaspaceSize=1024m"
Set-GradleProperty $gradlePropertiesFile "android.enableMinifyInReleaseBuilds" "true"
Set-GradleProperty $gradlePropertiesFile "android.enableShrinkResourcesInReleaseBuilds" "true"
Set-GradleProperty $gradlePropertiesFile "android.enableBundleCompression" "true"
Set-GradleProperty $gradlePropertiesFile "reactNativeArchitectures" "armeabi-v7a,arm64-v8a"

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

if ($Apk) {
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
  $outputApkFile = Get-Item -LiteralPath $OutputApk
  Write-Host "APK written to $($outputApkFile.FullName) ($([math]::Round($outputApkFile.Length / 1MB, 2)) MB)"
} else {
  Invoke-Checked ".\gradlew.bat" @("clean", "bundleRelease") $androidRoot

  $builtAab = Join-Path $androidRoot "app\build\outputs\bundle\release\app-release.aab"
  if (-not (Test-Path -LiteralPath $builtAab)) {
    throw "Build completed but AAB was not found at $builtAab"
  }

  $outputDir = Split-Path -Parent (Resolve-FullPath $OutputAab)
  if (-not (Test-Path -LiteralPath $outputDir)) {
    New-Item -ItemType Directory -Path $outputDir | Out-Null
  }

  Copy-Item -LiteralPath $builtAab -Destination $OutputAab -Force
  $aab = Get-Item -LiteralPath $OutputAab
  Write-Host "AAB written to $($aab.FullName) ($([math]::Round($aab.Length / 1MB, 2)) MB)"
}

if (-not $KeepTemp) {
  Write-Host "Removing temp build directory: $tempRoot"
  Remove-DirectoryWithRetry $tempRoot -BestEffort
}
