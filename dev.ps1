# Levanta el entorno de desarrollo completo: docker (timescale + api), frontend,
# landing y una sesion de Claude Code, cada uno en su propio panel de Windows Terminal.

$ErrorActionPreference = 'Continue'
$raiz = $PSScriptRoot

function Paso($msg)   { Write-Host "==> $msg" -ForegroundColor Cyan }
function Fallar($msg) { Write-Host "!!! $msg" -ForegroundColor Red; exit 1 }

# cmd /c para que el stderr de un exe nativo no se convierta en ErrorRecord.
function DockerVivo { cmd /c "docker info >nul 2>&1"; return ($LASTEXITCODE -eq 0) }

foreach ($cmd in 'docker', 'npm', 'claude', 'wt') {
  if (-not (Get-Command $cmd -ErrorAction SilentlyContinue)) { Fallar "No encuentro '$cmd' en el PATH" }
}
if (-not (Test-Path (Join-Path $raiz '.env'))) { Fallar "Falta .env en la raiz (copiar de .env.example)" }

Paso 'Docker'
if (-not (DockerVivo)) {
  $exe = Join-Path $env:ProgramFiles 'Docker\Docker\Docker Desktop.exe'
  if (-not (Test-Path $exe)) { Fallar 'Docker Desktop no responde y no encuentro el ejecutable' }
  Write-Host '    iniciando Docker Desktop' -NoNewline
  Start-Process $exe
  $limite = (Get-Date).AddMinutes(3)
  while (-not (DockerVivo)) {
    if ((Get-Date) -gt $limite) { Write-Host ''; Fallar 'Docker no levanto en 3 minutos' }
    Write-Host '.' -NoNewline
    Start-Sleep -Seconds 3
  }
  Write-Host ' listo'
}

foreach ($app in 'frontend', 'landing') {
  $dir = Join-Path $raiz $app
  if (-not (Test-Path (Join-Path $dir 'node_modules'))) {
    Paso "npm install en $app"
    Push-Location $dir
    npm install
    $codigo = $LASTEXITCODE
    Pop-Location
    if ($codigo -ne 0) { Fallar "npm install fallo en $app" }
  }
}

Paso 'Abriendo Windows Terminal'
$panes = @(
  "-w new new-tab --title servicios -d `"$raiz`" powershell -NoExit -Command `"docker compose up`"",
  "split-pane -V --title frontend -d `"$raiz\frontend`" powershell -NoExit -Command `"npm run dev`"",
  "split-pane -H --title landing -d `"$raiz\landing`" powershell -NoExit -Command `"npm run dev`"",
  "new-tab --title claude -d `"$raiz`" powershell -NoExit -Command claude"
) -join ' ; '
Start-Process wt.exe -ArgumentList $panes

Write-Host ''
Write-Host '  frontend  http://localhost:5173'
Write-Host '  landing   http://localhost:4321'
Write-Host '  api       http://localhost:8000/docs'
Write-Host '  postgres  localhost:5433'
