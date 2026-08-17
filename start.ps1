$port = 3051
$root = if ($PSScriptRoot) { $PSScriptRoot } else { (Get-Location).Path }

$already = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue
if (-not $already) {
  Start-Process -FilePath "node" -ArgumentList "`"$root\server.js`"" -WindowStyle Minimized
  Start-Sleep -Milliseconds 1500
}
Start-Process "http://localhost:$port"
