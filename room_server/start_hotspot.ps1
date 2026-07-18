# Bat Mobile Hotspot KHONG CAN INTERNET (nguon = vEthernet Default Switch cua Hyper-V)
# Dung cho demo offline: chay script nay -> dien thoai join Wi-Fi cua laptop
# -> mo https://192.168.137.1:8443
Add-Type -AssemblyName System.Runtime.WindowsRuntime
$null = [Windows.Networking.Connectivity.NetworkInformation,Windows.Networking.Connectivity,ContentType=WindowsRuntime]
$null = [Windows.Networking.NetworkOperators.NetworkOperatorTetheringManager,Windows.Networking.NetworkOperators,ContentType=WindowsRuntime]

$profiles = [Windows.Networking.Connectivity.NetworkInformation]::GetConnectionProfiles()
$src = $profiles | Where-Object { $_.ProfileName -eq "vEthernet (Default Switch)" } | Select-Object -First 1
if ($null -eq $src) {
    # khong co Hyper-V Default Switch -> thu profile internet (neu co)
    $src = [Windows.Networking.Connectivity.NetworkInformation]::GetInternetConnectionProfile()
}
if ($null -eq $src) { Write-Host "Khong tim thay profile nguon nao."; exit 1 }

$mgr = [Windows.Networking.NetworkOperators.NetworkOperatorTetheringManager]::CreateFromConnectionProfile($src)
$cfg = $mgr.GetCurrentAccessPointConfiguration()
Write-Host "Nguon    : $($src.ProfileName)"
Write-Host "Wi-Fi    : $($cfg.Ssid)"
Write-Host "Mat khau : $($cfg.Passphrase)"

if ($mgr.TetheringOperationalState -ne 1) {
    $op = $mgr.StartTetheringAsync()
    while ($op.Status -eq 'Started') { Start-Sleep -Milliseconds 300 }
    Start-Sleep -Seconds 2
}
if ($mgr.TetheringOperationalState -eq 1) {
    Write-Host "Hotspot: DANG PHAT"
    Write-Host "Dien thoai join Wi-Fi tren roi mo: https://192.168.137.1:8443"
} else {
    Write-Host "Khong bat duoc hotspot. Fallback: dung dien thoai phat hotspot, laptop join vao."
}
