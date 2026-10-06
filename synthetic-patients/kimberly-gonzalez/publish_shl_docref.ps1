# Publishes Kimberly Gonzalez's SMART Health Link to the FHIR server as a
# DocumentReference, so a receiving system (e.g., an EHR) can discover it with
#   GET {Base}/DocumentReference?patient=GPX-SYN-0000000279-0
# Run make_shl.ps1 first; this reads the link from shl-secret.json.
param(
  [string]$Base = 'https://hapi.fhir.org/baseR4',
  [string]$SecretFile = (Join-Path $PSScriptRoot 'shl-secret.json'),
  [string]$PatientId = 'GPX-SYN-0000000279-0',
  [string]$DocId = 'shl-GPX-SYN-0000000279-0'
)
$ErrorActionPreference = 'Stop'
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
Remove-TypeData System.Array -ErrorAction SilentlyContinue

$secret = [IO.File]::ReadAllText($SecretFile) | ConvertFrom-Json
$now = (Get-Date).ToString('yyyy-MM-ddTHH:mm:sszzz')
$doc = [ordered]@{
  resourceType = 'DocumentReference'
  id = $DocId
  meta = [ordered]@{ tag = @([ordered]@{ system = 'http://terminology.hl7.org/CodeSystem/v3-ActReason'; code = 'HTEST'; display = 'test health data' }) }
  identifier = @([ordered]@{ system = 'urn:ietf:rfc:3986'; value = $secret.shlink })
  status = 'current'
  type = [ordered]@{ text = 'SMART Health Link' }
  category = @([ordered]@{ text = 'SMART Health Link' })
  subject = [ordered]@{ reference = "Patient/$PatientId" }
  date = $now
  description = "SMART Health Link (flag U, no passcode) to $($secret.label). Decode the shlink, GET its url with ?recipient=, decrypt the JWE with its key."
  content = @(
    # the link itself: what a receiver scans or follows
    [ordered]@{ attachment = [ordered]@{
      contentType = 'text/plain'
      url = $secret.shlink
      data = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($secret.shlink))
      title = 'SMART Health Link (shlink:/ URI)'
      creation = $now
    } },
    # the encrypted file it points to
    [ordered]@{ attachment = [ordered]@{
      contentType = 'application/jose'
      url = $secret.url
      title = 'Encrypted SHL payload (JWE, FHIR Bundle inside)'
    } }
  )
}
$put = Invoke-WebRequest -Method Put -Uri "$Base/DocumentReference/$DocId" -UseBasicParsing `
  -ContentType 'application/fhir+json; charset=utf-8' -Headers @{ Accept = 'application/fhir+json' } `
  -Body ([Text.Encoding]::UTF8.GetBytes(($doc | ConvertTo-Json -Depth 10 -Compress)))
"PUT DocumentReference/$DocId -> $($put.StatusCode)"

# discover it the way the EHR would: search by patient, find the shlink
$found = Invoke-RestMethod "$Base/DocumentReference?patient=$PatientId&_count=100" -Headers @{ Accept = 'application/fhir+json' }
$hit = @($found.entry | Where-Object { $_.resource.content.attachment.url -like 'shlink:/*' })
"Search DocumentReference?patient=$PatientId -> $(@($found.entry).Count) results, $($hit.Count) with a SMART Health Link"
if ($hit.Count -ne 1 -or ($hit[0].resource.content.attachment.url | Where-Object { $_ -like 'shlink:/*' }) -ne $secret.shlink) { throw 'SHL not discoverable as expected' }
"Discovered link matches shl-secret.json"
