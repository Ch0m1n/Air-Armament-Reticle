function Read-PublisherSettings([string]$Path) {
    foreach($candidate in @($Path,($Path+'.bak'))) {
        if(-not [IO.File]::Exists($candidate)){continue}
        try {
            $value=[IO.File]::ReadAllText($candidate,[Text.Encoding]::UTF8) | ConvertFrom-Json -ErrorAction Stop
            if($value -isnot [pscustomobject]){throw 'Invalid settings object'}
            return $value
        } catch {
            if($candidate -eq ($Path+'.bak')){throw 'Saved settings and backup could not be read.'}
        }
    }
    if([IO.File]::Exists($Path)){throw 'Saved settings could not be read.'}
    return $null
}
function Write-PublisherSettings([string]$Path,[hashtable]$Settings) {
    $Path=[IO.Path]::GetFullPath($Path)
    $folder=[IO.Path]::GetDirectoryName($Path)
    [IO.Directory]::CreateDirectory($folder) | Out-Null
    $temporary=Join-Path $folder ('.publisher-settings-'+[guid]::NewGuid().ToString('N')+'.tmp')
    try {
        $saved=@{}
        foreach($key in @('WOWS','KORABLI','game','version','wowsVersion','korabliVersion','workers','lastFolder')){$saved[$key]=[string]$Settings[$key]}
        [IO.File]::WriteAllText($temporary,($saved | ConvertTo-Json),[Text.UTF8Encoding]::new($false))
        if([IO.File]::Exists($Path)){
            # Keep the previous valid settings without replacing a useful backup with damaged JSON.
            try {$null=[IO.File]::ReadAllText($Path) | ConvertFrom-Json -ErrorAction Stop; [IO.File]::Copy($Path,($Path+'.bak'),$true)}catch{}
        }
        [IO.File]::Move($temporary,$Path,$true)
    } finally {if([IO.File]::Exists($temporary)){[IO.File]::Delete($temporary)}}
}
