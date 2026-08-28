$ErrorActionPreference = 'Stop'

Push-Location (Join-Path $PSScriptRoot '..')
try {
    $python = Join-Path $PWD 'venv\Scripts\python.exe'
    if (-not (Test-Path $python)) {
        throw "Bot virtual environment not found at $python"
    }

    & $python manage.py check
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

    & $python manage.py test
    exit $LASTEXITCODE
}
finally {
    Pop-Location
}
