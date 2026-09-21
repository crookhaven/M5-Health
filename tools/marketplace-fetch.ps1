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
$limit = 50

try {
  Write-Host 'Looking up the county for that ZIP code...'
  $counties = Invoke-RestMethod -Uri "$base/counties/by/zip/$zip`?apikey=$key"
  $county = $counties.counties[0]
  if (-not $county) { throw 'No county found for that ZIP code.' }

  $body = @{
    household = @{
      income = 52000
      people = @(@{ age = $age; gender = 'Female'; uses_tobacco = $false; is_pregnant = $false; has_mec = $false; aptc_eligible = $true })
    }
    place = @{ countyfips = $county.fips; state = $county.state; zipcode = $zip }
    market = 'Individual'
    year = $year
    limit = $limit
    offset = 0
    order = 'asc'
    sort = 'premium'
    filter = @{}
  } | ConvertTo-Json -Depth 8

  Write-Host 'Fetching plans...'
  $raw = Invoke-WebRequest -Uri "$base/plans/search?apikey=$key" -Method Post -ContentType 'application/json' -Body $body -UseBasicParsing
  $result = [System.Text.Encoding]::UTF8.GetString($raw.RawContentStream.ToArray()) | ConvertFrom-Json
  $result | Add-Member -NotePropertyName _household -NotePropertyValue ([pscustomobject]@{
    label = 'Synthetic demo household'; age = $age; gender = 'Female'; uses_tobacco = $false
    zipcode = $zip; countyfips = $county.fips; state = $county.state
    source = 'Made-up household for a demo. Real plans from the CMS Marketplace API.'
  }) -Force

  # Optional: check the patient's medicines. Paste a line like  $rxcuis = '29046','83367'  first.
  if ($rxcuis -and $result.plans) {
    try {
      Write-Host 'Checking medicine coverage...'
      $planIds = ($result.plans | ForEach-Object { $_.id }) -join ','
      $drugs = Invoke-RestMethod -Uri "$base/drugs/covered?drugs=$($rxcuis -join ',')&planids=$planIds&year=$year&apikey=$key"
      $result | Add-Member -NotePropertyName _drug_coverage -NotePropertyValue $drugs -Force
    } catch {
      Write-Host "Medicine check did not work, saving plans without it: $($_.Exception.Message)" -ForegroundColor Yellow
    }
  }
  $out = Join-Path (Get-Location) "marketplace_plans_$zip.json"
  [System.IO.File]::WriteAllText($out, ($result | ConvertTo-Json -Depth 30), (New-Object System.Text.UTF8Encoding($false)))
  Write-Host "Done. Saved $($result.plans.Count) of $($result.total) plans to:"
  Write-Host $out
} catch {
  Write-Host "Something went wrong: $($_.Exception.Message)" -ForegroundColor Red
}
