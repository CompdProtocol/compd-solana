# Source in a PowerShell development shell. Changes only this shell's environment.
$compdRoot = Split-Path -Parent $PSScriptRoot
$compdVc = Join-Path $compdRoot '.tooling/msvc/VC/Tools/MSVC/14.44.35207'
$env:CARGO_HOME = Join-Path $compdRoot '.tooling/cargo'
$env:RUSTUP_HOME = Join-Path $compdRoot '.tooling/rustup'
$env:RUSTUP_TOOLCHAIN = '1.89.0'
$env:CARGO_TARGET_DIR = Join-Path $compdRoot 'target'
$env:PATH = "$compdVc/bin/Hostx64/x64;$compdRoot/.tooling/cargo/bin;$compdRoot/.tooling/solana-release/bin;$compdRoot/.tooling;" + $env:PATH
$env:LIB = "$compdVc/lib/x64;$compdVc/lib/onecore/x64;$compdRoot/.tooling/windows-sdk/c/um/x64;$compdRoot/.tooling/windows-sdk/c/ucrt/x64"
$env:INCLUDE = "$compdVc/include"
# No wallet is loaded and no transaction is signed by this setup script.
