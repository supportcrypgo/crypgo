param(
    [Parameter(Mandatory = $true)]
    [string]$PythonExe,
    [Parameter(Mandatory = $true)]
    [string]$DjangoDirectory,
    [Parameter(Mandatory = $true)]
    [string]$LogDirectory
)

$ErrorActionPreference = 'Stop'

if (-not (Test-Path -LiteralPath $PythonExe -PathType Leaf)) {
    throw "Python executable not found: $PythonExe"
}
if (-not (Test-Path -LiteralPath $DjangoDirectory -PathType Container)) {
    throw "Django directory not found: $DjangoDirectory"
}
if (-not (Test-Path -LiteralPath $LogDirectory -PathType Container)) {
    New-Item -ItemType Directory -Path $LogDirectory | Out-Null
}

$scheduler = Get-CimInstance Win32_Process -Filter "Name = 'python.exe'" |
    Where-Object {
        $_.CommandLine -and
        $_.CommandLine.Contains('process_due_card_cancellations')
    } |
    Select-Object -First 1

if ($scheduler) {
    Write-Output 'Card cancellation scheduler is already running.'
    exit 0
}

Start-Process `
    -FilePath $PythonExe `
    -ArgumentList @('manage.py', 'process_due_card_cancellations', '--loop', '--interval', '60') `
    -WorkingDirectory $DjangoDirectory `
    -RedirectStandardOutput (Join-Path $LogDirectory 'card-cancellation-scheduler.log') `
    -RedirectStandardError (Join-Path $LogDirectory 'card-cancellation-scheduler-error.log') `
    -WindowStyle Hidden | Out-Null

Write-Output 'Started the card cancellation scheduler.'
