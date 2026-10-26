$ErrorActionPreference = 'Stop'
$fieldworkRoot = $PSScriptRoot
$nodeCommand = Get-Command node -ErrorAction SilentlyContinue
if (-not $nodeCommand) { throw 'Install Node.js 20 or newer, then run this launcher again.' }
Write-Host 'Open http://127.0.0.1:8787 after the ready message.'
& $nodeCommand.Source (Join-Path $fieldworkRoot 'server.mjs')
