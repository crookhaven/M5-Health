# Publishes the enriched Kimberly Gonzalez bundle to a FHIR server as a
# transaction (PUT with the bundle's own ids, so re-running updates in place),
# then reads resources back to confirm the https links resolve.
param(
  [string]$Bundle = (Join-Path $PSScriptRoot 'GPX-SYN-0000000279-0_enriched.json'),
  [string]$Base = 'https://hapi.fhir.org/baseR4',
  [string]$TransactionOut = (Join-Path $PSScriptRoot 'GPX-SYN-0000000279-0_transaction.json')
)
$ErrorActionPreference = 'Stop'
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

$text = [IO.File]::ReadAllText($Bundle)
$baseRe = [regex]::Escape($Base)
if (-not [regex]::IsMatch($text, "`"fullUrl`": `"$baseRe/")) { throw "Bundle fullUrls do not use $Base; rebuild with -Base $Base" }

# collection -> transaction, and a PUT request on every entry
$text = ([regex]'"type": "collection"').Replace($text, '"type": "transaction"', 1)
$text = [regex]::Replace($text, "(?m)^(\s*)`"fullUrl`": `"$baseRe/([A-Za-z]+)/([^`"]+)`",",
  { param($m) $i = $m.Groups[1].Value; "$($m.Value)`n$i`"request`": { `"method`": `"PUT`", `"url`": `"$($m.Groups[2].Value)/$($m.Groups[3].Value)`" }," })
[IO.File]::WriteAllText($TransactionOut, $text, (New-Object Text.UTF8Encoding($false)))

$entryCount = ($text | ConvertFrom-Json).entry.Count
"Uploading $entryCount resources to $Base ..."
$resp = Invoke-RestMethod -Method Post -Uri $Base -ContentType 'application/fhir+json; charset=utf-8' `
  -Headers @{ Accept = 'application/fhir+json' } -Body ([Text.Encoding]::UTF8.GetBytes($text)) -TimeoutSec 300
$resp.entry | Group-Object { $_.response.status } | ForEach-Object { '  {0,-14} {1}' -f $_.Name, $_.Count }

# read-back checks
$hdr = @{ Accept = 'application/fhir+json' }
$p = Invoke-RestMethod "$Base/Patient/GPX-SYN-0000000279-0" -Headers $hdr
"Patient: $($p.name[0].given[0]) $($p.name[0].family) (versionId $($p.meta.versionId))"
$all = Invoke-RestMethod "$Base/Patient/GPX-SYN-0000000279-0/`$everything?_count=500" -Headers $hdr
"Patient/`$everything returned $(@($all.entry).Count) resources"
$docs = Invoke-RestMethod "$Base/DocumentReference?patient=GPX-SYN-0000000279-0&_count=50" -Headers $hdr
$bad = 0
foreach ($d in $docs.entry) {
  $url = $d.resource.content[0].attachment.url
  $r = Invoke-WebRequest $url -UseBasicParsing -Headers @{ Accept = 'text/plain' }
  if ($r.StatusCode -ne 200 -or $r.RawContentLength -ne $d.resource.content[0].attachment.size) { "  FAIL $url ($($r.StatusCode), $($r.RawContentLength) bytes)"; $bad++ }
}
"Note/report Binary links checked: $(@($docs.entry).Count), failures: $bad"
