#Requires -Version 7.0
$ErrorActionPreference='Stop'
$root=Split-Path -Parent $PSScriptRoot
. (Join-Path $root 'tools/publisher-settings.ps1')
$folder=Join-Path $root ('test-artifacts/publisher-settings-'+[guid]::NewGuid().ToString('N'))
$path=Join-Path $folder 'settings.json'
function Assert($condition,$message){if(-not $condition){throw $message}}
Assert ($null -eq (Read-PublisherSettings $path)) 'Missing settings must be empty.'
$unicode=[string][char]0xD568+[char]0xC120
$settings=@{WOWS="E:/Game files/$unicode/WoWS"; KORABLI='E:/Other files/Korabli'; game='WOWS'; version='15.10'; lastFolder="E:/Game files/$unicode"}
Write-PublisherSettings $path $settings
$saved=Read-PublisherSettings $path
foreach($key in $settings.Keys){Assert ($saved.$key -ceq $settings[$key]) "Roundtrip failed: $key"}
$pwsh=(Get-Command pwsh).Source
$result=& $pwsh -NoLogo -NoProfile -STA -File (Join-Path $root 'tools/data-publisher.ps1') -ValidateOnly -SettingsPath $path
Assert ($LASTEXITCODE -eq 0) 'GUI validation failed.'
$restored=$result | ConvertFrom-Json
foreach($key in $settings.Keys){Assert ($restored.settings.$key -ceq $settings[$key]) "Restart restore failed: $key"}
Assert (-not $restored.publishEnabled) 'Restored settings must not authorize uploading.'
$settings.version='15.11'
Write-PublisherSettings $path $settings
Assert ((Read-PublisherSettings $path).version -eq '15.11') 'New version not saved.'
[IO.File]::WriteAllText($path,'{broken')
Assert ((Read-PublisherSettings $path).version -eq '15.10') 'Backup fallback failed.'
Write-PublisherSettings $path $settings
Assert ((Read-PublisherSettings ($path+'.bak')).version -eq '15.10') 'Valid backup was lost.'
$settings.game='BOTH'; $settings.wowsVersion='15.10'; $settings.korabliVersion='26.11'; $settings.workers='4'
Write-PublisherSettings $path $settings
$restored=(& $pwsh -NoLogo -NoProfile -STA -File (Join-Path $root 'tools/data-publisher.ps1') -ValidateOnly -SettingsPath $path) | ConvertFrom-Json
Assert ($LASTEXITCODE -eq 0) 'Both-mode GUI validation failed.'
Assert ($restored.settings.game -eq 'BOTH') 'Both mode not restored.'
Assert ($restored.settings.workers -eq '4') 'Scan worker count not restored.'
Assert ($restored.settings.wowsVersion -eq '15.10' -and $restored.settings.korabliVersion -eq '26.11') 'Independent versions not restored.'
Write-Output 'PASS: settings roundtrip, separate-process GUI restore, backup recovery; no uploads.'
