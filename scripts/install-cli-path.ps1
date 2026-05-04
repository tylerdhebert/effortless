param(
  [string]$InstallDir = (Join-Path $PSScriptRoot '..\release\0.0.0\win-unpacked')
)

$ErrorActionPreference = 'Stop'

if ([System.IO.Path]::IsPathRooted($InstallDir)) {
  $resolvedInstallDir = [System.IO.Path]::GetFullPath($InstallDir)
} else {
  $resolvedInstallDir = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot $InstallDir))
}
$cliPath = Join-Path $resolvedInstallDir 'efl.cmd'

if (-not (Test-Path -LiteralPath $cliPath)) {
  throw "efl.cmd was not found at '$cliPath'. Pass -InstallDir with the folder that contains efl.cmd."
}

$currentPath = [Environment]::GetEnvironmentVariable('Path', 'User')
if ($null -eq $currentPath) {
  $currentPath = ''
}
$entries = $currentPath -split ';' | Where-Object { $_ -ne '' }
$alreadyPresent = $entries | Where-Object {
  [string]::Equals(
    [System.IO.Path]::GetFullPath($_).TrimEnd('\'),
    $resolvedInstallDir.TrimEnd('\'),
    [System.StringComparison]::OrdinalIgnoreCase
  )
}

if ($alreadyPresent) {
  Write-Host "efl is already on the user PATH:"
  Write-Host $resolvedInstallDir
  exit 0
}

$nextPath = if ($currentPath.Trim()) {
  "$currentPath;$resolvedInstallDir"
} else {
  $resolvedInstallDir
}

[Environment]::SetEnvironmentVariable('Path', $nextPath, 'User')

Write-Host "Added efl to the user PATH:"
Write-Host $resolvedInstallDir
Write-Host ''
Write-Host 'Open a new terminal before running efl from PATH.'
