param(
  [int]$Port = 8080
)

node "$PSScriptRoot\server.js" $Port
