#!/usr/bin/env pwsh
# Windows-native build script (bypasses bash script PATH issues)

$ErrorActionPreference = "Stop"

$ROOT_DIR = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$HASH_FILE = "$ROOT_DIR\src\canvas-host\a2ui\.bundle.hash"
$OUTPUT_FILE = "$ROOT_DIR\src\canvas-host\a2ui\a2ui.bundle.js"
$A2UI_RENDERER_DIR = "$ROOT_DIR\vendor\a2ui\renderers\lit"
$A2UI_APP_DIR = "$ROOT_DIR\apps\shared\OpenClawKit\Tools\CanvasA2UI"

# Check if bundle is up to date
if (Test-Path $OUTPUT_FILE -PathType Leaf) {
    Write-Host "A2UI bundle already exists; skipping bundling."
} else {
    Write-Host "A2UI bundle missing, building..."
    & pnpm -s exec tsc -p "$A2UI_RENDERER_DIR\tsconfig.json"
    & pnpm exec rolldown -c "$A2UI_APP_DIR\rolldown.config.mjs"
}

# Continue with the rest of the build
Write-Host "Running build steps..."
& node "$ROOT_DIR\scripts\tsdown-build.mjs"
& node "$ROOT_DIR\scripts\runtime-postbuild.mjs"
& node "$ROOT_DIR\scripts\build-stamp.mjs"
& pnpm build:plugin-sdk:dts
& node --import tsx "$ROOT_DIR\scripts\write-plugin-sdk-entry-dts.ts"
& node --import tsx "$ROOT_DIR\scripts\canvas-a2ui-copy.ts"
& node --import tsx "$ROOT_DIR\scripts\copy-hook-metadata.ts"
& node --import tsx "$ROOT_DIR\scripts\copy-export-html-templates.ts"
& node --import tsx "$ROOT_DIR\scripts\write-build-info.ts"
& node --import tsx "$ROOT_DIR\scripts\write-cli-startup-metadata.ts"
& node --import tsx "$ROOT_DIR\scripts\write-cli-compat.ts"

Write-Host "Build completed successfully!"
