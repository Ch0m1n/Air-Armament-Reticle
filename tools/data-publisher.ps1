#Requires -Version 7.0
param([switch]$ValidateOnly,[string]$SettingsPath)
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
[System.Windows.Forms.Application]::EnableVisualStyles()
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$settingsFolder = Join-Path ([Environment]::GetFolderPath('LocalApplicationData')) 'WoWS-Korabli-Air-Armament-Reticle'
$settingsFile = Join-Path $settingsFolder 'publisher-settings.json'
if($SettingsPath){$settingsFile=[IO.Path]::GetFullPath($SettingsPath)}
. (Join-Path $PSScriptRoot 'publisher-settings.ps1')
$script:loadingSettings=$true
$script:lastFolder=''
$script:preview = $null
$script:job = $null

$form = [System.Windows.Forms.Form]::new()
$form.Text = 'WoWS / Korabli - Data Publisher'
$form.Size = [Drawing.Size]::new(850,700)
$form.MinimumSize = [Drawing.Size]::new(750,650)
$form.StartPosition = 'CenterScreen'
$form.Font = [Drawing.Font]::new('Segoe UI',10)

function Add-Label($text,$x,$y,$width=170) {
    $control = [Windows.Forms.Label]::new()
    $control.Text=$text; $control.Location=[Drawing.Point]::new($x,$y); $control.Size=[Drawing.Size]::new($width,25)
    $form.Controls.Add($control); return $control
}
function Add-TextBox($x,$y,$width) {
    $control=[Windows.Forms.TextBox]::new(); $control.Location=[Drawing.Point]::new($x,$y); $control.Size=[Drawing.Size]::new($width,28)
    $form.Controls.Add($control); return $control
}
function Add-Button($text,$x,$y,$width) {
    $control=[Windows.Forms.Button]::new(); $control.Text=$text; $control.Location=[Drawing.Point]::new($x,$y); $control.Size=[Drawing.Size]::new($width,32)
    $form.Controls.Add($control); return $control
}
$null=Add-Label 'World of Warships JSON' 18 23
$wows=Add-TextBox 195 20 500; $wows.Anchor='Top,Left,Right'
$browseWows=Add-Button 'Browse...' 707 18 105; $browseWows.Anchor='Top,Right'
$null=Add-Label 'Korabli JSON' 18 66
$korabli=Add-TextBox 195 63 500; $korabli.Anchor='Top,Left,Right'
$browseKorabli=Add-Button 'Browse...' 707 61 105; $browseKorabli.Anchor='Top,Right'
$null=Add-Label 'Game' 18 115
$game=[Windows.Forms.ComboBox]::new(); $game.DropDownStyle='DropDownList'; $game.Items.AddRange(@('KORABLI','WOWS','BOTH')); $game.SelectedIndex=0
$game.Location=[Drawing.Point]::new(195,112); $game.Size=[Drawing.Size]::new(170,28); $form.Controls.Add($game)
$null=Add-Label 'WoWS version' 390 115 105
$version=Add-TextBox 500 112 195
$null=Add-Label 'Korabli version' 390 158 105
$korabliVersion=Add-TextBox 500 155 195
$null=Add-Label 'Scan workers' 18 158
$scanWorkers=[Windows.Forms.ComboBox]::new(); $scanWorkers.DropDownStyle='DropDownList'; $scanWorkers.Items.AddRange(@('1','2','4')); $scanWorkers.SelectedItem='2'
$scanWorkers.Location=[Drawing.Point]::new(195,155); $scanWorkers.Size=[Drawing.Size]::new(170,28); $form.Controls.Add($scanWorkers)
$replace=[Windows.Forms.CheckBox]::new(); $replace.Text='Replace existing version(s)'; $replace.Location=[Drawing.Point]::new(195,198); $replace.Size=[Drawing.Size]::new(350,28); $form.Controls.Add($replace)
$previewButton=Add-Button 'Preview files' 195 240 170
$publishButton=Add-Button 'Upload to GitHub' 380 240 200; $publishButton.Enabled=$false
$status=Add-Label 'Ready' 18 293 790; $status.Anchor='Top,Left,Right'
$progress=[Windows.Forms.ProgressBar]::new(); $progress.Location=[Drawing.Point]::new(18,324); $progress.Size=[Drawing.Size]::new(794,8); $progress.Anchor='Top,Left,Right'; $form.Controls.Add($progress)
$output=[Windows.Forms.TextBox]::new(); $output.Multiline=$true; $output.ReadOnly=$true; $output.ScrollBars='Vertical'; $output.WordWrap=$true
$output.Location=[Drawing.Point]::new(18,351); $output.Size=[Drawing.Size]::new(794,287); $output.Anchor='Top,Bottom,Left,Right'; $output.Font=[Drawing.Font]::new('Consolas',9)
$form.Controls.Add($output)

function Save-Settings {
    Write-PublisherSettings $settingsFile @{WOWS=$wows.Text; KORABLI=$korabli.Text; game=$game.Text; version=$version.Text; wowsVersion=$version.Text; korabliVersion=$korabliVersion.Text; workers=$scanWorkers.Text; lastFolder=$script:lastFolder}
}
$saveTimer=[Windows.Forms.Timer]::new(); $saveTimer.Interval=600
$saveTimer.Add_Tick({
    $saveTimer.Stop()
    try {Save-Settings} catch {$status.Text='Settings could not be saved.'; $output.Text=$_.Exception.Message}
})
function Queue-SettingsSave {
    if($script:loadingSettings -or $ValidateOnly){return}
    $saveTimer.Stop(); $saveTimer.Start()
}
function Invalidate-Preview {
    $script:preview=$null; $publishButton.Enabled=$false
}
function Select-Folder($target) {
    $dialog=[Windows.Forms.FolderBrowserDialog]::new(); $dialog.Description='Select a JSON version folder or the parent containing version folders.'; $dialog.UseDescriptionForTitle=$true
    if($target.Text -and (Test-Path -LiteralPath $target.Text -PathType Container)){$dialog.SelectedPath=$target.Text}
    elseif($script:lastFolder -and (Test-Path -LiteralPath $script:lastFolder -PathType Container)){$dialog.SelectedPath=$script:lastFolder}
    try {
        if($dialog.ShowDialog($form) -eq 'OK'){
            $target.Text=$dialog.SelectedPath; $script:lastFolder=$dialog.SelectedPath
            $saveTimer.Stop(); Save-Settings
        }
    } catch {$status.Text='Settings could not be saved.'; $output.Text=$_.Exception.Message}
    finally {$dialog.Dispose()}
}
$browseWows.Add_Click({Select-Folder $wows}); $browseKorabli.Add_Click({Select-Folder $korabli})
function Update-VersionFields {
    $version.Enabled=$game.Text -in @('WOWS','BOTH')
    $korabliVersion.Enabled=$game.Text -in @('KORABLI','BOTH')
}
foreach($inputControl in @($wows,$korabli,$version,$korabliVersion)){$inputControl.Add_TextChanged({Invalidate-Preview; Queue-SettingsSave})}
$game.Add_SelectedIndexChanged({Invalidate-Preview; Update-VersionFields; Queue-SettingsSave})
$scanWorkers.Add_SelectedIndexChanged({Invalidate-Preview; Queue-SettingsSave})

function Set-Busy($busy) {
    foreach($control in @($wows,$korabli,$version,$korabliVersion,$game,$scanWorkers,$replace,$browseWows,$browseKorabli,$previewButton)){$control.Enabled=-not $busy}
    if(-not $busy){Update-VersionFields}
    $publishButton.Enabled=(-not $busy -and $null -ne $script:preview)
    $progress.Style=if($busy){'Marquee'}else{'Blocks'}
}
function Update-PublisherProgress($job) {
    if(-not [IO.File]::Exists($job.progressFile)){return}
    try {$state=[IO.File]::ReadAllText($job.progressFile) | ConvertFrom-Json -ErrorAction Stop}catch{return}
    if($state.phase -eq 'scan' -and $state.total -gt 0){
        $percent=[Math]::Min(100,[Math]::Floor(100*$state.completed/$state.total))
        $progress.Style='Blocks'; $progress.Value=$percent
        $eta='Estimating...'
        if($null -ne $state.remainingSeconds){
            $seconds=[Math]::Max(0,[Math]::Ceiling($state.remainingSeconds))
            $eta=if($seconds -ge 60){"About $([Math]::Floor($seconds/60))m $($seconds%60)s remaining"}else{"About ${seconds}s remaining"}
        }
        $prefix=if($job.mode -eq 'publish'){'Rechecking files'}else{'Checking files'}
        $datasetLabel=if($state.datasetCount){"$($state.game) [$($state.datasetIndex)/$($state.datasetCount)] "}else{''}
        $status.Text="$datasetLabel$prefix`: $percent% ($($state.completed)/$($state.total) ships) - $eta"
    } else {
        $progress.Style='Marquee'
        $status.Text=switch($state.phase){
            'scan' {'Opening source folders...'}
            'finalize' {'Ship scan complete. Preparing file summary...'}
            'authenticate' {'Checking GitHub authentication...'}
            'clone' {'Downloading repository... (remaining time unavailable)'}
            'prepare' {'Preparing selected dataset...'}
            'validate' {'Running index, tests and build... (remaining time unavailable)'}
            'push' {'Uploading to GitHub... (remaining time unavailable)'}
            default {'Working...'}
        }
    }
}
function Start-Publisher($mode) {
    $progressFile=$null
    $batchFile=$null
    try {
        Save-Settings
        $node=(Get-Command node -ErrorAction Stop).Source
        if($mode -eq 'publish'){
            if(-not $script:preview){throw 'Run Preview first.'}
            $message="Upload to Ch0m1n/Air-Armament-Reticle (PUBLIC)?`n`n$($script:preview.destination)`nShips: $($script:preview.counts.Ships)`nAircraft: $($script:preview.counts.Aircraft)`nProjectiles: $($script:preview.counts.Projectiles)"
            if($replace.Checked){$message+="`n`nExisting files in this version will be replaced."}
            if([Windows.Forms.MessageBox]::Show($form,$message,'Confirm public upload','YesNo','Warning') -ne 'Yes'){return}
        }
        $start=[Diagnostics.ProcessStartInfo]::new(); $start.FileName=$node; $start.WorkingDirectory=$root
        $start.UseShellExecute=$false; $start.CreateNoWindow=$true; $start.RedirectStandardOutput=$true; $start.RedirectStandardError=$true
        $start.StandardOutputEncoding=[Text.UTF8Encoding]::new($false); $start.StandardErrorEncoding=[Text.UTF8Encoding]::new($false)
        $start.ArgumentList.Add((Join-Path $PSScriptRoot 'data-publisher.mjs')); $start.ArgumentList.Add($mode)
        $start.ArgumentList.Add('--workers'); $start.ArgumentList.Add($scanWorkers.Text)
        if($game.Text -eq 'BOTH'){
            $batchFile=Join-Path ([IO.Path]::GetTempPath()) ('air-reticle-batch-'+[guid]::NewGuid().ToString('N')+'.json')
            $batch=@{datasets=@(@{game='WOWS';source=$wows.Text;version=$version.Text.Trim()},@{game='KORABLI';source=$korabli.Text;version=$korabliVersion.Text.Trim()})}
            [IO.File]::WriteAllText($batchFile,($batch | ConvertTo-Json -Depth 4),[Text.UTF8Encoding]::new($false))
            $start.ArgumentList.Add('--batch-file'); $start.ArgumentList.Add($batchFile)
        } else {
            foreach($value in @('--source',$(if($game.Text -eq 'WOWS'){$wows.Text}else{$korabli.Text}),'--game',$game.Text,'--version',$(if($game.Text -eq 'WOWS'){$version.Text.Trim()}else{$korabliVersion.Text.Trim()}))){$start.ArgumentList.Add([string]$value)}
        }
        $progressFile=Join-Path ([IO.Path]::GetTempPath()) ('air-reticle-progress-'+[guid]::NewGuid().ToString('N')+'.json')
        $start.ArgumentList.Add('--progress-file'); $start.ArgumentList.Add($progressFile)
        if($mode -eq 'publish'){$start.ArgumentList.Add('--expected-hash'); $start.ArgumentList.Add($script:preview.manifestHash); if($replace.Checked){$start.ArgumentList.Add('--replace')}}
        $process=[Diagnostics.Process]::new(); $process.StartInfo=$start; $null=$process.Start()
        $script:job=@{process=$process; stdout=$process.StandardOutput.ReadToEndAsync(); stderr=$process.StandardError.ReadToEndAsync(); mode=$mode; progressFile=$progressFile; batchFile=$batchFile}
        $progress.Value=0
        Set-Busy $true; $status.Text=if($mode -eq 'preview'){'Checking references...'}else{'Uploading in an isolated Git checkout...'}
        $timer.Start()
    } catch {
        if($progressFile -and [IO.File]::Exists($progressFile)){[IO.File]::Delete($progressFile)}
        if($batchFile -and [IO.File]::Exists($batchFile)){[IO.File]::Delete($batchFile)}
        $output.Text=$_.Exception.Message; $status.Text='Failed'; Set-Busy $false
    }
}
$timer=[Windows.Forms.Timer]::new(); $timer.Interval=250
$timer.Add_Tick({
    if(-not $script:job){return}
    if(-not $script:job.process.HasExited){Update-PublisherProgress $script:job; return}
    $timer.Stop(); $job=$script:job; $script:job=$null
    try {
        $text=$job.stdout.GetAwaiter().GetResult(); $errorText=$job.stderr.GetAwaiter().GetResult()
        if($job.process.ExitCode -ne 0){try{$details=($errorText | ConvertFrom-Json).error}catch{$details=$errorText}; throw $details}
        $result=$text | ConvertFrom-Json
        if($job.mode -eq 'preview'){
            $script:preview=$result
            $output.Text="Repository: $($result.repository) (PUBLIC)`r`nSource: $($result.source)`r`nDestination: $($result.destination)`r`n`r`nShips: $($result.counts.Ships)`r`nAircraft: $($result.counts.Aircraft)`r`nProjectiles: $($result.counts.Projectiles)`r`nConfigurations: $($result.configurations)`r`nSize: $([Math]::Round($result.totalBytes/1MB,2)) MB`r`n`r`nSkipped ships: $($result.skippedShips)`r`nSkipped aircraft references: $($result.skippedAircraft)`r`n`r`n$($result.warnings -join "`r`n")"
            $included=@($result.shipDecisions | Where-Object included)
            $excluded=@($result.shipDecisions | Where-Object { -not $_.included })
            $output.AppendText("`r`n`r`nASW-only ships excluded: $($result.aswOnlyShips)`r`nSupported strike + ASW retained: $($result.mixedShips)`r`n`r`nINCLUDED SHIPS`r`n")
            foreach($ship in ($included | Select-Object -First 100)){$output.AppendText("$($ship.ship): $($ship.aircraft -join ', ')`r`n")}
            if($included.Count -gt 100){$output.AppendText("... and $($included.Count-100) more included ships`r`n")}
            $output.AppendText("`r`nEXCLUDED SHIPS`r`n")
            foreach($ship in ($excluded | Select-Object -First 60)){$output.AppendText("$($ship.ship): $($ship.reason)`r`n")}
            if($excluded.Count -gt 60){$output.AppendText("... and $($excluded.Count-60) more excluded ships`r`n")}
            $status.Text='Preview ready. No files uploaded.'
        } else {
            $output.Text="Status: $($result.status)`r`nCommit: $($result.commit)`r`n$($result.url)`r`n`r`nGitHub Actions: https://github.com/Ch0m1n/Air-Armament-Reticle/actions"
            $status.Text=if($result.status -eq 'unchanged'){'Already up to date.'}else{'Uploaded. GitHub Pages rebuild starts automatically.'}
        }
    } catch {$output.Text=$_.Exception.Message; $status.Text='Failed. See details below.'}
    finally {
        $job.process.Dispose(); Set-Busy $false
        $progress.Value=if($status.Text -like 'Failed*'){0}else{100}
        if([IO.File]::Exists($job.progressFile)){[IO.File]::Delete($job.progressFile)}
        if($job.batchFile -and [IO.File]::Exists($job.batchFile)){[IO.File]::Delete($job.batchFile)}
    }
})
$previewButton.Add_Click({Start-Publisher 'preview'}); $publishButton.Add_Click({Start-Publisher 'publish'})
$form.Add_FormClosing({param($sender,$eventArgs)
    if($script:job){$eventArgs.Cancel=$true; [Windows.Forms.MessageBox]::Show($form,'Wait for the current operation to finish.','Publisher','OK','Information') | Out-Null; return}
    $saveTimer.Stop()
    try {Save-Settings} catch {
        $eventArgs.Cancel=$true; $status.Text='Settings could not be saved.'; $output.Text=$_.Exception.Message
        [Windows.Forms.MessageBox]::Show($form,'Settings could not be saved. Check the details below before closing.','Publisher','OK','Warning') | Out-Null
    }
})
if(-not $ValidateOnly -or $SettingsPath){
    try {
        $saved=Read-PublisherSettings $settingsFile
        if($saved){
            $wows.Text=$saved.WOWS; $korabli.Text=$saved.KORABLI
            if($saved.game -in @('WOWS','KORABLI','BOTH')){$game.SelectedItem=$saved.game}
            $version.Text=if($saved.wowsVersion){$saved.wowsVersion}else{$saved.version}
            $korabliVersion.Text=if($saved.korabliVersion){$saved.korabliVersion}else{$saved.version}
            $script:lastFolder=[string]$saved.lastFolder
            if($saved.workers -in @('1','2','4')){$scanWorkers.SelectedItem=$saved.workers}
        }
    } catch {$status.Text='Settings could not be loaded.'; $output.Text='Saved settings could not be loaded. Select the folders again.'}
}
$script:loadingSettings=$false
Update-VersionFields
try{
    if($ValidateOnly){@{title=$form.Text; controls=$form.Controls.Count; previewEnabled=$previewButton.Enabled; publishEnabled=$publishButton.Enabled; settings=@{WOWS=$wows.Text; KORABLI=$korabli.Text; game=$game.Text; version=$version.Text; wowsVersion=$version.Text; korabliVersion=$korabliVersion.Text; workers=$scanWorkers.Text; lastFolder=$script:lastFolder}} | ConvertTo-Json -Depth 3}
    else{[Windows.Forms.Application]::Run($form)}
}finally{$saveTimer.Dispose(); $timer.Dispose(); $form.Dispose()}
