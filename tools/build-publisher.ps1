#Requires -Version 7.0
$ErrorActionPreference='Stop'
$root=Split-Path -Parent $PSScriptRoot
$compiler=Join-Path $env:WINDIR 'Microsoft.NET/Framework64/v4.0.30319/csc.exe'
if(-not (Test-Path -LiteralPath $compiler)){throw 'The Windows .NET Framework C# compiler is not available.'}
$output=Join-Path $root 'Data-Publisher.exe'
& $compiler /nologo /target:winexe /optimize+ "/out:$output" /reference:System.Windows.Forms.dll (Join-Path $PSScriptRoot 'publisher-launcher.cs')
if($LASTEXITCODE -ne 0){throw 'Publisher launcher build failed.'}
Write-Output "Built: $output"
