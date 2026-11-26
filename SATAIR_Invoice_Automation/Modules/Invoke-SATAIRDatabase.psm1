#Requires -Version 5.1
<#
.SYNOPSIS
    CSV-based file tracking and per-line-item deduplication for SATAIR Invoice Tracker.
.DESCRIPTION
    Replaces SQLite with two lightweight CSV files:
      <db_path>_files.csv  — processed file registry (sha256, path, status, rows)
      <db_path>_items.csv  — per-line-item dedup keys
#>

Set-StrictMode -Version Latest

# ── internal helpers ──────────────────────────────────────────────────────────

function _GetFilesPath([string]$DbPath) { "${DbPath}_files.csv" }
function _GetItemsPath([string]$DbPath) { "${DbPath}_items.csv" }

function _EnsureCsv([string]$Path, [string[]]$Headers) {
    if (-not (Test-Path $Path)) {
        $dir = Split-Path $Path -Parent
        if ($dir -and -not (Test-Path $dir)) {
            # Fix 21: -ErrorAction Stop so failures terminate loudly
            try {
                New-Item -ItemType Directory -Path $dir -Force -ErrorAction Stop | Out-Null
            } catch {
                throw "Failed to create directory '$dir': $_"
            }
        }
        # Fix 21: -ErrorAction Stop so failures terminate loudly
        try {
            $Headers -join ',' | Set-Content -Path $Path -Encoding UTF8 -ErrorAction Stop
        } catch {
            throw "Failed to create CSV '$Path': $_"
        }
    }
}

function _ReadCsv([string]$Path) {
    if (Test-Path $Path) {
        # Fix 22: wrap Import-Csv in try/catch; return empty array on error
        try {
            return Import-Csv -Path $Path -Encoding UTF8
        } catch {
            Write-Warning "Could not read CSV '$Path': $_"
            return @()
        }
    }
    return @()
}

# ── public functions ──────────────────────────────────────────────────────────

# Fix 20: renamed from Initialize-Database to Initialize-CsvTrackers
function Initialize-CsvTrackers {
    <#
    .SYNOPSIS Creates the two tracking CSV files if they do not exist.
    #>
    param([Parameter(Mandatory)][string]$DbPath)

    _EnsureCsv (_GetFilesPath $DbPath) @('sha256','file_path','status','rows_written','registered_at','updated_at','error_msg')
    _EnsureCsv (_GetItemsPath $DbPath) @('dedup_key','file_sha256','invoice_no','po_no','awb','part_number','qty','inserted_at')
}

function Get-FileSha256 {
    <#
    .SYNOPSIS Returns the SHA-256 hex digest of a file.
    #>
    param([Parameter(Mandatory)][string]$FilePath)

    # Fix 23: wrap Get-FileHash in try/catch; return $null and warn on error
    try {
        $hash = Get-FileHash -Path $FilePath -Algorithm SHA256
        return $hash.Hash.ToLower()
    } catch {
        Write-Warning "Get-FileSha256: could not hash '$FilePath': $_"
        return $null
    }
}

function Test-FileProcessed {
    <#
    .SYNOPSIS Returns $true if the sha256 already exists in the files CSV with status 'done'.
    #>
    param(
        [Parameter(Mandatory)][string]$DbPath,
        [Parameter(Mandatory)][string]$Sha256
    )

    $rows = _ReadCsv (_GetFilesPath $DbPath)
    $match = $rows | Where-Object { $_.sha256 -eq $Sha256 -and $_.status -eq 'done' }
    return ($null -ne $match)
}

function Register-File {
    <#
    .SYNOPSIS Inserts a new row for this file with status 'pending'.
    #>
    param(
        [Parameter(Mandatory)][string]$DbPath,
        [Parameter(Mandatory)][string]$FilePath,
        [Parameter(Mandatory)][string]$Sha256
    )

    $now = (Get-Date -Format 'yyyy-MM-dd HH:mm:ss')
    $csvPath = _GetFilesPath $DbPath
    $rows = _ReadCsv $csvPath

    # Idempotent: skip if sha256 already registered
    if ($rows | Where-Object { $_.sha256 -eq $Sha256 }) { return }

    $newRow = [PSCustomObject]@{
        sha256        = $Sha256
        file_path     = $FilePath
        status        = 'pending'
        rows_written  = '0'
        registered_at = $now
        updated_at    = $now
        error_msg     = ''
    }
    $rows += $newRow
    # Fix 24: atomic write — Export-Csv to .tmp then Move-Item to replace
    $rows | Export-Csv -Path "$csvPath.tmp" -NoTypeInformation -Encoding UTF8
    Move-Item -Path "$csvPath.tmp" -Destination $csvPath -Force
}

function Set-FileDone {
    <#
    .SYNOPSIS Updates the file record to status 'done' with the row count written.
    #>
    param(
        [Parameter(Mandatory)][string]$DbPath,
        [Parameter(Mandatory)][string]$Sha256,
        [Parameter(Mandatory)][int]$RowsWritten
    )

    $now = (Get-Date -Format 'yyyy-MM-dd HH:mm:ss')
    $csvPath = _GetFilesPath $DbPath
    $rows = _ReadCsv $csvPath

    foreach ($row in $rows) {
        if ($row.sha256 -eq $Sha256) {
            $row.status       = 'done'
            $row.rows_written = $RowsWritten.ToString()
            $row.updated_at   = $now
            $row.error_msg    = ''
        }
    }
    # Fix 24: atomic write — Export-Csv to .tmp then Move-Item to replace
    $rows | Export-Csv -Path "$csvPath.tmp" -NoTypeInformation -Encoding UTF8
    Move-Item -Path "$csvPath.tmp" -Destination $csvPath -Force
}

function Set-FileError {
    <#
    .SYNOPSIS Updates the file record to status 'error' with a message.
    #>
    param(
        [Parameter(Mandatory)][string]$DbPath,
        [Parameter(Mandatory)][string]$Sha256,
        [Parameter(Mandatory)][string]$ErrorMsg
    )

    $now = (Get-Date -Format 'yyyy-MM-dd HH:mm:ss')
    $csvPath = _GetFilesPath $DbPath
    $rows = _ReadCsv $csvPath

    foreach ($row in $rows) {
        if ($row.sha256 -eq $Sha256) {
            $row.status     = 'error'
            $row.updated_at = $now
            $row.error_msg  = $ErrorMsg
        }
    }
    # Fix 24: atomic write — Export-Csv to .tmp then Move-Item to replace
    $rows | Export-Csv -Path "$csvPath.tmp" -NoTypeInformation -Encoding UTF8
    Move-Item -Path "$csvPath.tmp" -Destination $csvPath -Force
}

function Build-DedupKey {
    <#
    .SYNOPSIS Builds a per-line-item deduplication key.
    #>
    param(
        [string]$InvoiceNo,
        [string]$PoNo,
        [string]$Awb,
        [string]$PartNumber,
        [int]$Index
    )

    return "$InvoiceNo|$PoNo|$Awb|$PartNumber|$Index"
}

function Test-LineItemDuplicate {
    <#
    .SYNOPSIS Returns $true if the dedup key already exists in the items CSV.
    #>
    param(
        [Parameter(Mandatory)][string]$DbPath,
        [Parameter(Mandatory)][string]$DedupKey
    )

    $rows = _ReadCsv (_GetItemsPath $DbPath)
    $match = $rows | Where-Object { $_.dedup_key -eq $DedupKey }
    return ($null -ne $match)
}

function Add-LineItem {
    <#
    .SYNOPSIS Records a processed line item to prevent future duplicates.
    #>
    param(
        [Parameter(Mandatory)][string]$DbPath,
        [Parameter(Mandatory)][string]$FileSha256,
        [Parameter(Mandatory)][string]$InvoiceNo,
        [Parameter(Mandatory)][string]$PoNo,
        [Parameter(Mandatory)][string]$Awb,
        [Parameter(Mandatory)][string]$PartNumber,
        [Parameter(Mandatory)][string]$Qty,
        [Parameter(Mandatory)][string]$DedupKey
    )

    $now = (Get-Date -Format 'yyyy-MM-dd HH:mm:ss')
    $csvPath = _GetItemsPath $DbPath

    $rows = _ReadCsv $csvPath

    $newRow = [PSCustomObject]@{
        dedup_key   = $DedupKey
        file_sha256 = $FileSha256
        invoice_no  = $InvoiceNo
        po_no       = $PoNo
        awb         = $Awb
        part_number = $PartNumber
        qty         = $Qty
        inserted_at = $now
    }
    $rows += $newRow
    # Fix 24: atomic write — Export-Csv to .tmp then Move-Item to replace
    $rows | Export-Csv -Path "$csvPath.tmp" -NoTypeInformation -Encoding UTF8
    Move-Item -Path "$csvPath.tmp" -Destination $csvPath -Force
}

function Get-AllProcessedPaths {
    <#
    .SYNOPSIS Returns a HashSet of file paths that have status 'done'.
    #>
    param([Parameter(Mandatory)][string]$DbPath)

    $rows = _ReadCsv (_GetFilesPath $DbPath)
    $paths = [System.Collections.Generic.HashSet[string]]::new([System.StringComparer]::OrdinalIgnoreCase)
    foreach ($row in ($rows | Where-Object { $_.status -eq 'done' })) {
        [void]$paths.Add($row.file_path)
    }
    return $paths
}

Export-ModuleMember -Function @(
    'Initialize-CsvTrackers',
    'Get-FileSha256',
    'Test-FileProcessed',
    'Register-File',
    'Set-FileDone',
    'Set-FileError',
    'Build-DedupKey',
    'Test-LineItemDuplicate',
    'Add-LineItem',
    'Get-AllProcessedPaths'
)
