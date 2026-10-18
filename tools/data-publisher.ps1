#Requires -Version 7.0
param([switch]$ValidateOnly)
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
[System.Windows.Forms.Application]::EnableVisualStyles()
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$settingsFolder = Join-Path ([Environment]::GetFolderPath('LocalApplicationData')) 'WoWS-Korabli-Air-Armament-Reticle'
$settingsFile = Join-Path $settingsFolder 'publisher-settings.json'
$script:preview = $null
$script:job = $null

$form = [System.Windows.Forms.Form]::new()
$form.Text = 'WoWS / Korabli - Data Publisher'
$form.Size = [Drawing.Size]::new(850,650)
$form.MinimumSize = [Drawing.Size]::new(750,600)
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
$game=[Windows.Forms.ComboBox]::new(); $game.DropDownStyle='DropDownList'; $game.Items.AddRange(@('KORABLI','WOWS')); $game.SelectedIndex=0
$game.Location=[Drawing.Point]::new(195,112); $game.Size=[Drawing.Size]::new(170,28); $form.Controls.Add($game)
$null=Add-Label 'Version' 390 115 70
$version=Add-TextBox 465 112 230
$replace=[Windows.Forms.CheckBox]::new(); $replace.Text='Replace existing version'; $replace.Location=[Drawing.Point]::new(195,155); $replace.Size=[Drawing.Size]::new(350,28); $form.Controls.Add($replace)
$previewButton=Add-Button 'Preview files' 195 197 170
$publishButton=Add-Button 'Upload to GitHub' 380 197 200; $publishButton.Enabled=$false
$status=Add-Label 'Ready' 18 250 790; $status.Anchor='Top,Left,Right'
$progress=[Windows.Forms.ProgressBar]::new(); $progress.Location=[Drawing.Point]::new(18,281); $progress.Size=[Drawing.Size]::new(794,8); $progress.Anchor='Top,Left,Right'; $form.Controls.Add($progress)
$output=[Windows.Forms.TextBox]::new(); $output.Multiline=$true; $output.ReadOnly=$true; $output.ScrollBars='Vertical'; $output.WordWrap=$true
$output.Location=[Drawing.Point]::new(18,308); $output.Size=[Drawing.Size]::new(794,280); $output.Anchor='Top,Bottom,Left,Right'; $output.Font=[Drawing.Font]::new('Consolas',9)
$form.Controls.Add($output)

function Save-Settings {
    [IO.Directory]::CreateDirectory($settingsFolder) | Out-Null
    @{WOWS=$wows.Text; KORABLI=$korabli.Text; game=$game.Text; version=$version.Text} | ConvertTo-Json | Set-Content -LiteralPath $settingsFile -Encoding utf8
}
function Invalidate-Preview {
    $script:preview=$null; $publishButton.Enabled=$false
}
function Select-Folder($target) {
    $dialog=[Windows.Forms.FolderBrowserDialog]::new(); $dialog.Description='Select a JSON version folder or the parent containing version folders.'; $dialog.UseDescriptionForTitle=$true
    if($target.Text -and (Test-Path -LiteralPath $target.Text -PathType Container)){$dialog.SelectedPath=$target.Text}
    if($dialog.ShowDialog($form) -eq 'OK'){$target.Text=$dialog.SelectedPath; Save-Settings}
    $dialog.Dispose()
}
$browseWows.Add_Click({Select-Folder $wows}); $browseKorabli.Add_Click({Select-Folder $korabli})
foreach($inputControl in @($wows,$korabli,$version)){$inputControl.Add_TextChanged({Invalidate-Preview})}
$game.Add_SelectedIndexChanged({Invalidate-Preview})

function Set-Busy($busy) {
    foreach($control in @($wows,$korabli,$version,$game,$replace,$browseWows,$browseKorabli,$previewButton)){$control.Enabled=-not $busy}
    $publishButton.Enabled=(-not $busy -and $null -ne $script:preview)
    $progress.Style=if($busy){'Marquee'}else{'Blocks'}
}
function Start-Publisher($mode) {
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
        foreach($value in @((Join-Path $PSScriptRoot 'data-publisher.mjs'),$mode,'--source',$(if($game.Text -eq 'WOWS'){$wows.Text}else{$korabli.Text}),'--game',$game.Text,'--version',$version.Text.Trim())){$start.ArgumentList.Add([string]$value)}
        if($mode -eq 'publish'){$start.ArgumentList.Add('--expected-hash'); $start.ArgumentList.Add($script:preview.manifestHash); if($replace.Checked){$start.ArgumentList.Add('--replace')}}
        $process=[Diagnostics.Process]::new(); $process.StartInfo=$start; $null=$process.Start()
        $script:job=@{process=$process; stdout=$process.StandardOutput.ReadToEndAsync(); stderr=$process.StandardError.ReadToEndAsync(); mode=$mode}
        Set-Busy $true; $status.Text=if($mode -eq 'preview'){'Checking references...'}else{'Uploading in an isolated Git checkout...'}
        $timer.Start()
    } catch {$output.Text=$_.Exception.Message; $status.Text='Failed'; Set-Busy $false}
}
$timer=[Windows.Forms.Timer]::new(); $timer.Interval=250
$timer.Add_Tick({
    if(-not $script:job -or -not $script:job.process.HasExited){return}
    $timer.Stop(); $job=$script:job; $script:job=$null
    try {
        $text=$job.stdout.GetAwaiter().GetResult(); $errorText=$job.stderr.GetAwaiter().GetResult()
        if($job.process.ExitCode -ne 0){try{$details=($errorText | ConvertFrom-Json).error}catch{$details=$errorText}; throw $details}
        $result=$text | ConvertFrom-Json
        if($job.mode -eq 'preview'){
            $script:preview=$result
            $output.Text="Repository: $($result.repository) (PUBLIC)`r`nSource: $($result.source)`r`nDestination: $($result.destination)`r`n`r`nShips: $($result.counts.Ships)`r`nAircraft: $($result.counts.Aircraft)`r`nProjectiles: $($result.counts.Projectiles)`r`nConfigurations: $($result.configurations)`r`nSize: $([Math]::Round($result.totalBytes/1MB,2)) MB`r`n`r`nSkipped ships: $($result.skippedShips)`r`nSkipped aircraft references: $($result.skippedAircraft)`r`n`r`n$($result.warnings -join "`r`n")"
            $status.Text='Preview ready. No files uploaded.'
        } else {
            $output.Text="Status: $($result.status)`r`nCommit: $($result.commit)`r`n$($result.url)`r`n`r`nGitHub Actions: https://github.com/Ch0m1n/Air-Armament-Reticle/actions"
            $status.Text=if($result.status -eq 'unchanged'){'Already up to date.'}else{'Uploaded. GitHub Pages rebuild starts automatically.'}
        }
    } catch {$output.Text=$_.Exception.Message; $status.Text='Failed. See details below.'}
    finally {$job.process.Dispose(); Set-Busy $false}
})
$previewButton.Add_Click({Start-Publisher 'preview'}); $publishButton.Add_Click({Start-Publisher 'publish'})
$form.Add_FormClosing({param($sender,$eventArgs)
    if($script:job){$eventArgs.Cancel=$true; [Windows.Forms.MessageBox]::Show($form,'Wait for the current operation to finish.','Publisher','OK','Information') | Out-Null; return}
    Save-Settings
})
if(-not $ValidateOnly -and (Test-Path -LiteralPath $settingsFile)){
    try {$saved=Get-Content -LiteralPath $settingsFile -Raw | ConvertFrom-Json; $wows.Text=$saved.WOWS; $korabli.Text=$saved.KORABLI; if($saved.game -in @('WOWS','KORABLI')){$game.SelectedItem=$saved.game}; $version.Text=$saved.version}catch{$output.Text='Saved settings could not be loaded. Select the folders again.'}
}
try{
    if($ValidateOnly){@{title=$form.Text; controls=$form.Controls.Count; previewEnabled=$previewButton.Enabled; publishEnabled=$publishButton.Enabled} | ConvertTo-Json}
    else{[Windows.Forms.Application]::Run($form)}
}finally{$timer.Dispose(); $form.Dispose()}
