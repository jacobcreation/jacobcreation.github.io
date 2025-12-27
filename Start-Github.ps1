# Path to a file that stores the last pull date
$lastPullFile = "$PSScriptRoot\.lastpull"

# Get today's date (yyyy-MM-dd format)
$today = (Get-Date).ToString("yyyy-MM-dd")

# Check if we already pulled today
if (Test-Path $lastPullFile) {
    $lastPull = Get-Content $lastPullFile
} else {
    $lastPull = ""
}

if ($lastPull -ne $today) {
    Write-Host "Running git pull..."
    git pull
    $today | Out-File $lastPullFile -Force
} else {
    Write-Host "Already pulled today ($today). Skipping."
}

# Drop you into the repo folder
Set-Location $PSScriptRoot
