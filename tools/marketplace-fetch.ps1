# Fetches a few Marketplace plans for a MADE-UP household and saves them as a file
# the M5 Health "Compare plans" tab can load.
# Your API key is typed here, sent only to the CMS Marketplace API, and never saved.

$base = 'https://marketplace.api.healthcare.gov/api/v1'
$zip = Read-Host 'ZIP code (press Enter for 48201)'
if (-not $zip) { $zip = '48201' }
$secure = Read-Host 'API key' -AsSecureString
$key = [System.Net.NetworkCredential]::new('', $secure).Password
$age = 41
$year = 2026
$maxPlans = 60

try {
  Write-Host 'Looking up the county for that ZIP code...'
  $counties = Invoke-RestMethod -Uri "$base/counties/by/zip/$zip`?apikey=$key"
  $county = $counties.counties[0]
  if (-not $county) { throw 'No county found for that ZIP code.' }

  # The API returns at most 10 plans per request, so ask page by page.
  $plans = @(); $result = $null; $offset = 0
  do {
    $body = @{
      household = @{ income = 52000; people = @(@{ age = $age; gender = 'Female'; uses_tobacco = $false; is_pregnant = $false; has_mec = $false; aptc_eligible = $true }) }
      place = @{ countyfips = $county.fips; state = $county.state; zipcode = $zip }
      market = 'Individual'; year = $year; limit = 10; offset = $offset; order = 'asc'; sort = 'premium'; filter = @{}
    } | ConvertTo-Json -Depth 8
    $raw = Invoke-WebRequest -Uri "$base/plans/search?apikey=$key" -Method Post -ContentType 'application/json' -Body $body -UseBasicParsing
    $page = [System.Text.Encoding]::UTF8.GetString($raw.RawContentStream.ToArray()) | ConvertFrom-Json
    if (-not $result) { $result = $page }
    $plans += @($page.plans)
    $offset += 10
    Write-Host "Fetched $($plans.Count) of $($result.total) plans..."
  } while ($offset -lt $result.total -and $plans.Count -lt $maxPlans -and @($page.plans).Count -gt 0)
  $result.plans = $plans

  $result | Add-Member -NotePropertyName _household -NotePropertyValue ([pscustomobject]@{ label = 'Synthetic demo household'; age = $age; gender = 'Female'; uses_tobacco = $false; zipcode = $zip; countyfips = $county.fips; state = $county.state; source = 'Made-up household for a demo. Real plans from the CMS Marketplace API.' }) -Force

  # Optional: check the patient's medicines. Paste a line like  $rxcuis = '29046','83367'  first.
  if ($rxcuis -and $result.plans) {
    try {
      Write-Host 'Checking medicine coverage...'
      $ids = @($result.plans | ForEach-Object { $_.id })
      $coverage = @()
      for ($i = 0; $i -lt $ids.Count; $i += 20) {
        $chunk = ($ids[$i..([Math]::Min($i + 19, $ids.Count - 1))]) -join ','
        $r = Invoke-RestMethod -Uri "$base/drugs/covered?drugs=$($rxcuis -join ',')&planids=$chunk&year=$year&apikey=$key"
        $coverage += @($r.coverage)
      }
      $result | Add-Member -NotePropertyName _drug_coverage -NotePropertyValue ([pscustomobject]@{ coverage = $coverage }) -Force
    } catch {
      Write-Host "Medicine check did not work, saving plans without it: $($_.Exception.Message)" -ForegroundColor Yellow
    }
  }

  # Optional: SBC links and example costs from the CMS Plan Attributes file (national, one file for the plan year).
  try {
    Write-Host 'Getting SBC links from the CMS Plan Attributes file (a large download, it may take a few minutes)...'
    $zipPath = Join-Path $env:TEMP "plan-attributes-puf-$year.zip"
    $oldProgress = $ProgressPreference; $ProgressPreference = 'SilentlyContinue'
    Invoke-WebRequest -Uri "https://download.cms.gov/marketplace-puf/$year/plan-attributes-puf.zip" -OutFile $zipPath -UseBasicParsing
    $ProgressPreference = $oldProgress
    Add-Type -AssemblyName System.IO.Compression.FileSystem
    $archive = [System.IO.Compression.ZipFile]::OpenRead($zipPath)
    $entry = $archive.Entries | Where-Object { $_.Name -like '*.csv' } | Sort-Object Length -Descending | Select-Object -First 1
    $reader = New-Object System.IO.StreamReader($entry.Open(), [System.Text.Encoding]::UTF8)
    $names = ($reader.ReadLine().TrimStart([char]0xFEFF) -split ',') | ForEach-Object { $_.Trim('"') }
    $wanted = @($result.plans | ForEach-Object { $_.id })
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
    $result | Add-Member -NotePropertyName _sbc -NotePropertyValue ([pscustomobject]$sbc) -Force
    Write-Host "Found SBC information for $($sbc.Count) of $($wanted.Count) plans."
    if ($sbc.Count -eq 0) {
      Write-Host 'No plans matched. Column names in the CMS file that mention SBC, URL or plan IDs:' -ForegroundColor Yellow
      ($names | Where-Object { $_ -match 'SBC|URL|StandardComponent|PlanId' }) -join ', ' | Write-Host
    }
  } catch {
    Write-Host "The SBC step did not work, saving plans without it: $($_.Exception.Message)" -ForegroundColor Yellow
  }

  $out = Join-Path ([Environment]::GetFolderPath('UserProfile')) "Downloads\marketplace_plans_$zip.json"
  [System.IO.File]::WriteAllText($out, ($result | ConvertTo-Json -Depth 30), (New-Object System.Text.UTF8Encoding($false)))
  Write-Host "Done. Saved $($result.plans.Count) of $($result.total) plans to:"
  Write-Host $out
} catch { Write-Host "Something went wrong: $($_.Exception.Message)" -ForegroundColor Red }
