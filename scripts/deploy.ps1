# Deploy the repair escrow contract to Stellar testnet, then write the contract
# ID into web\.env.local so the frontend can call it.
#
# Prereqs: Rust + the wasm32v1-none target, and the Stellar CLI.
#
# Usage: .\scripts\deploy.ps1 [identityName]   (default identity: workshop)

param([string]$Identity = "workshop")

$ErrorActionPreference = "Stop"
$Network = "testnet"
$Root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$Wasm = "target\wasm32v1-none\release\savings_goal.wasm"
$EnvFile = Join-Path $Root "web\.env.local"

Set-Location $Root

# 1. Ensure a funded testnet identity exists.
$keys = stellar keys ls
if ($keys -notcontains $Identity) {
  Write-Host "Creating and funding testnet identity '$Identity'..."
  stellar keys generate $Identity --network $Network --fund
}

# 2. Build the contract to wasm.
Write-Host "Building contract..."
stellar contract build

# 3. Deploy to testnet.
Write-Host "Deploying to $Network..."
$ContractId = (stellar contract deploy --wasm $Wasm --source-account $Identity --network $Network).Trim()
Write-Host "Deployed contract ID: $ContractId"

# 4. Initialise the repair escrow admin. Ignore error if already initialised.
$Admin = (stellar keys address $Identity).Trim()
Write-Host "Initialising repair escrow admin: $Admin"
try {
  stellar contract invoke --id $ContractId --source-account $Identity --network $Network -- init --admin $Admin
} catch {
  Write-Host "(init skipped - contract may already be initialised)"
}

# 5. Write NEXT_PUBLIC_CONTRACT_ID into web\.env.local.
if (Test-Path $EnvFile) {
  (Get-Content $EnvFile) | Where-Object { $_ -notmatch '^NEXT_PUBLIC_CONTRACT_ID=' } | Set-Content $EnvFile
}
Add-Content $EnvFile "NEXT_PUBLIC_CONTRACT_ID=$ContractId"
Write-Host ""
Write-Host "Wrote NEXT_PUBLIC_CONTRACT_ID=$ContractId to web\.env.local"
Write-Host "Restart 'npm run dev' to pick up the new contract ID."
