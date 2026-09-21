# Adds SBC (Summary of Benefits and Coverage) links and example costs to a plans file you already saved.
# It needs no API key. It downloads the public CMS Plan Attributes file (a large download).
# Edit $path or $year below if your file has a different ZIP code or plan year.

$year = 2026
$path = Join-Path $env:USERPROFILE 'Downloads\marketplace_plans_48201.json'

try {
  Write-Host "Reading $path ..."
  $j = [System.IO.File]::ReadAllText($path) | ConvertFrom-Json
  $wanted = @($j.plans | ForEach-Object { $_.id })
  if ($wanted.Count -eq 0) { throw 'No plans found in that file.' }

  Write-Host 'Downloading the CMS Plan Attributes file (large, it may take a few minutes)...'
  $zipPath = Join-Path $env:TEMP "plan-attributes-puf-$year.zip"
  $oldProgress = $ProgressPreference; $ProgressPreference = 'SilentlyContinue'
  Invoke-WebRequest -Uri "https://download.cms.gov/marketplace-puf/$year/plan-attributes-puf.zip" -OutFile $zipPath -UseBasicParsing
  $ProgressPreference = $oldProgress

  Add-Type -AssemblyName System.IO.Compression.FileSystem
  $archive = [System.IO.Compression.ZipFile]::OpenRead($zipPath)
  $entry = $archive.Entries | Where-Object { $_.Name -like '*.csv' } | Sort-Object Length -Descending | Select-Object -First 1
  $reader = New-Object System.IO.StreamReader($entry.Open(), [System.Text.Encoding]::UTF8)
  $names = ($reader.ReadLine().TrimStart([char]0xFEFF) -split ',') | ForEach-Object { $_.Trim('"') }
  $idPattern = [regex]('(' + (($wanted | ForEach-Object { [regex]::Escape($_) }) -join '|') + ')')
  $sbc = @{}
  while ($null -ne ($line = $reader.ReadLine())) {
    if (-not $idPattern.IsMatch($line)) { continue }
    $row = $line | ConvertFrom-Csv -Header $names
    $sid = $row.StandardComponentId
    if (-not $sid -or $wanted -notcontains $sid) { continue }
    if ($sbc.ContainsKey($sid) -and $row.PlanId -notmatch '-00$') { continue }
    $examples = @{}
    foreach ($p in $row.PSObject.Properties) {
      if ($p.Name -match '^SBCHaving(a)?(Baby|Diabetes|SimpleFracture)(Deductible|Copayment|Coinsurance|Limit)$') {
        $scenario = $Matches[2].ToLower(); $field = $Matches[3].ToLower()
        if (-not $examples.ContainsKey($scenario)) { $examples[$scenario] = @{} }
        $examples[$scenario][$field] = $p.Value
      }
    }
    $sbc[$sid] = [pscustomobject]@{ url = $row.URLForSummaryOfBenefitsCoverage; examples = $examples }
  }
  $reader.Close(); $archive.Dispose()

  Write-Host "Found SBC information for $($sbc.Count) of $($wanted.Count) plans."
  if ($sbc.Count -eq 0) {
    Write-Host 'No plans matched, so the file was not changed. Column names in the CMS file that mention SBC, URL or plan IDs:' -ForegroundColor Yellow
    ($names | Where-Object { $_ -match 'SBC|URL|StandardComponent|PlanId' }) -join ', ' | Write-Host
  } else {
    $j | Add-Member -NotePropertyName _sbc -NotePropertyValue ([pscustomobject]$sbc) -Force
    [System.IO.File]::WriteAllText($path, ($j | ConvertTo-Json -Depth 30), (New-Object System.Text.UTF8Encoding($false)))
    Write-Host "Done. SBC links added to $path"
  }
} catch { Write-Host "Something went wrong: $($_.Exception.Message)" -ForegroundColor Red }
