$buildId = "5a420f12-da4b-4a6d-892c-ee5be68248a5"
Set-Location "C:\Users\mauri\OneDrive - Indiana University\LifeOrganizerSimple"

while ($true) {
    $output = npx eas build:view $buildId 2>&1 | Out-String

    if ($output -match "Status\s+finished") {
        Write-Host "Build finished! Submitting to TestFlight..."
        npx eas submit --platform ios --id $buildId --non-interactive
        Write-Host "Done!"
        break
    }
    elseif ($output -match "Status\s+errored") {
        Write-Host "Build FAILED!"
        break
    }
    elseif ($output -match "Status\s+canceled") {
        Write-Host "Build was canceled"
        break
    }
    else {
        $time = Get-Date -Format "HH:mm:ss"
        Write-Host "$time - Build still in progress..."
    }

    Start-Sleep -Seconds 30
}
