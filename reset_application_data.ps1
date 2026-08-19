# AMS/WMS Application Data Reset Script
# This script wipes all operational data from both Business and Auth databases.

Write-Host "!!! WARNING: This will permanently delete ALL operational data in the backend !!!" -ForegroundColor Red
$confirmation = Read-Host "Are you sure you want to proceed? (Type 'YES' to confirm)"

if ($confirmation -ne "YES") {
    Write-Host "Operation cancelled."
    exit
}

$ProjectRoot = Get-Location
$BackendDir = Join-Path $ProjectRoot "backend"
$BusinessServiceDir = Join-Path $BackendDir "business-service"
$AuthServiceDir = Join-Path $BackendDir "auth-service"

# 1. Clear Media Uploads
Write-Host "`n[1/4] Clearing media uploads..." -ForegroundColor Cyan
$MediaDirs = @(
    Join-Path $ProjectRoot "media_uploads",
    Join-Path $BackendDir "media_uploads"
)

foreach ($dir in $MediaDirs) {
    if (Test-Path $dir) {
        Write-Host "Cleaning $dir"
        Remove-Item -Path "$dir\*" -Recurse -Force -ErrorAction SilentlyContinue
    }
}

# 2. Wipe Business Data (Python)
Write-Host "`n[2/4] Wiping Business Database data..." -ForegroundColor Cyan
if (Test-Path "$BusinessServiceDir\.venv\Scripts\python.exe") {
    $PyExe = "$BusinessServiceDir\.venv\Scripts\python.exe"
} else {
    $PyExe = "python"
}

# Run the python wipe script (auto-confirm if we want, but it has its own prompt)
# Here we just run it directly.
& $PyExe "$BusinessServiceDir\scripts\wipe_business_data.py"

# 3. Wipe Auth Data (SQL via psql)
Write-Host "`n[3/4] Wiping Auth Database data..." -ForegroundColor Cyan
$env:PGPASSWORD = "ams_auth"
& psql -h localhost -p 5432 -U ams_auth -d ams_auth -f "$AuthServiceDir\wipe_auth_data.sql"

if ($LASTEXITCODE -ne 0) {
    Write-Host "Warning: Failed to wipe Auth data via psql. Ensure psql is in your PATH and the database is reachable on port 5432." -ForegroundColor Yellow
}

# 4. Sync Migrations
Write-Host "`n[4/4] Ensuring migrations are up to date..." -ForegroundColor Cyan
Set-Location $BusinessServiceDir
& $PyExe -m alembic upgrade head
Set-Location $ProjectRoot

Write-Host "`n====================================================" -ForegroundColor Green
Write-Host "Backend Data Reset Complete!" -ForegroundColor Green
Write-Host "Default Admin: admin / ChangeMe123!" -ForegroundColor Green
Write-Host "====================================================" -ForegroundColor Green
