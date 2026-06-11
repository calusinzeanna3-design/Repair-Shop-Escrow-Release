# One-shot launcher for the frontend dev server.
# Usage:  .\dev.ps1
$ErrorActionPreference = "Stop"
Set-Location (Join-Path $PSScriptRoot "web")
if (-not (Test-Path "node_modules")) {
  Write-Host "Installing dependencies..."
  npm install
}
Write-Host "Starting dev server on http://localhost:3000 ..."
npm run dev
