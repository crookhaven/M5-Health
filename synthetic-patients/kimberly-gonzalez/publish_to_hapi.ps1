# Publishes a synthetic patient bundle to a FHIR server as transactions (PUT
# with the bundle's own ids, so re-running updates in place), then reads the
# patient back to confirm the https links resolve.
# Large bundles are sent in batches: HAPI's public server rejects big requests
# (HTTP 413) and checks that referenced resources exist, so batches go in
# dependency order. Encounters and Conditions reference each other, so they
# always travel together.
param(
  [string]$Bundle = (Join-Path $PSScriptRoot 'GPX-SYN-0000000279-0_enriched.json'),
  [string]$Base = 'https://hapi.fhir.org/baseR4',
  [string]$TransactionOut = (Join-Path $PSScriptRoot 'GPX-SYN-0000000279-0_transaction.json'),
  [int]$MaxBatchBytes = 350000
)
$ErrorActionPreference = 'Stop'
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
Remove-TypeData System.Array -ErrorAction SilentlyContinue

$TIERS = @(
  @('Patient', 'Organization', 'Practitioner', 'Location', 'Binary'),
  @('PractitionerRole', 'RelatedPerson', 'Coverage'),
  @('Encounter', 'Condition'),
  @('AllergyIntolerance', 'MedicationRequest', 'MedicationStatement', 'Immunization', 'Procedure', 'Device', 'ServiceRequest', 'CareTeam', 'Medication'),
  @('Observation'),
  @('ImagingStudy'),
  @('DiagnosticReport'),
  @('DocumentReference', 'Composition'),
  @('ExplanationOfBenefit')
)

$b = [IO.File]::ReadAllText($Bundle) | ConvertFrom-Json
$baseRe = [regex]::Escape($Base)
if (-not ($b.entry | Where-Object { $_.fullUrl -match "^$baseRe/" })) { throw "Bundle fullUrls do not use $Base; rebuild with -FhirBase $Base" }

function EntryJson($e) {
  $r = $e.resource
  '{"fullUrl":' + (ConvertTo-Json $e.fullUrl) + ',"resource":' + ($r | ConvertTo-Json -Depth 60 -Compress) +
  ',"request":{"method":"PUT","url":' + (ConvertTo-Json "$($r.resourceType)/$($r.id)") + '}}'
}
function BundleJson($entryTexts) { '{"resourceType":"Bundle","type":"transaction","entry":[' + ($entryTexts -join ',') + ']}' }

$assigned = @{}
$batches = New-Object System.Collections.ArrayList
foreach ($tier in $TIERS + , @('*')) {
  $entries = @($b.entry | Where-Object { -not $assigned.ContainsKey($_.fullUrl) -and ($tier -contains $_.resource.resourceType -or $tier[0] -eq '*') })
  if ($entries.Count -eq 0) { continue }
  $current = New-Object System.Collections.ArrayList; $size = 0
  $mustStayTogether = $tier -contains 'Encounter'
  foreach ($e in $entries) {
    $assigned[$e.fullUrl] = $true
    $text = EntryJson $e
    if (-not $mustStayTogether -and $current.Count -gt 0 -and ($size + $text.Length) -gt $MaxBatchBytes) {
      [void]$batches.Add($current.ToArray()); $current = New-Object System.Collections.ArrayList; $size = 0
    }
    [void]$current.Add($text); $size += $text.Length
  }
  if ($current.Count) { [void]$batches.Add($current.ToArray()) }
}

$all = foreach ($batch in $batches) { $batch }
[IO.File]::WriteAllText($TransactionOut, (BundleJson $all), (New-Object Text.UTF8Encoding($false)))

"Uploading $(@($b.entry).Count) resources to $Base in $($batches.Count) batch(es) ..."
$statuses = @{}
$n = 0
foreach ($batch in $batches) {
  $n++
  $body = [Text.Encoding]::UTF8.GetBytes((BundleJson $batch))
  $resp = Invoke-RestMethod -Method Post -Uri $Base -ContentType 'application/fhir+json; charset=utf-8' `
    -Headers @{ Accept = 'application/fhir+json' } -Body $body -TimeoutSec 300
  foreach ($e in $resp.entry) { $statuses[$e.response.status] = 1 + [int]$statuses[$e.response.status] }
  '  batch {0}: {1} resources, {2} KB' -f $n, $batch.Count, [math]::Round($body.Length / 1KB)
}
$statuses.GetEnumerator() | ForEach-Object { '  {0,-14} {1}' -f $_.Key, $_.Value }

# read-back checks
$hdr = @{ Accept = 'application/fhir+json'; 'Cache-Control' = 'no-cache' }  # bypass HAPI's search cache
$patient = $b.entry | Where-Object { $_.resource.resourceType -eq 'Patient' } | Select-Object -First 1
$pid0 = $patient.resource.id
$p = Invoke-RestMethod "$Base/Patient/$pid0" -Headers $hdr
"Patient: $($p.name[0].given -join ' ') $($p.name[0].family) (versionId $($p.meta.versionId))"
$all = Invoke-RestMethod "$Base/Patient/$pid0/`$everything?_count=1000" -Headers $hdr
"Patient/`$everything returned $(@($all.entry).Count) resources"
$docs = Invoke-RestMethod "$Base/DocumentReference?patient=$pid0&_count=100" -Headers $hdr
$bad = 0
foreach ($d in $docs.entry) {
  $url = $d.resource.content[0].attachment.url
  if (-not $url -or $url -like 'shlink:/*') { continue }
  $r = Invoke-WebRequest $url -UseBasicParsing -Headers @{ Accept = 'text/plain' }
  if ($r.StatusCode -ne 200 -or $r.RawContentLength -ne $d.resource.content[0].attachment.size) { "  FAIL $url ($($r.StatusCode), $($r.RawContentLength) bytes)"; $bad++ }
}
"Note/report Binary links checked: $(@($docs.entry).Count), failures: $bad"
