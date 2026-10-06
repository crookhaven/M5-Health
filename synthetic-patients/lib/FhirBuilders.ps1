# Shared building blocks for synthetic patient generators. Dot-source after
# setting $PatId (patient resource id) and $Base (FHIR base URL for fullUrls):
#   $PatId = 'X'; $Base = 'https://hapi.fhir.org/baseR4'; . "$PSScriptRoot\..\lib\FhirBuilders.ps1"
# Generators call Add for each resource, then Write-Bundle.

Add-Type -AssemblyName System.Numerics

$TZ = '-05:00'
$SCT = 'http://snomed.info/sct'
$LOINC = 'http://loinc.org'
$RX = 'http://www.nlm.nih.gov/research/umls/rxnorm'
$CPT = 'http://www.ama-assn.org/go/cpt'
$HCPCS = 'https://www.cms.gov/Medicare/Coding/HCPCSReleaseCodeSets'
$CDT = 'http://www.ada.org/cdt'
$ICD = 'http://hl7.org/fhir/sid/icd-10-cm'
$PCS = 'http://www.cms.gov/Medicare/Coding/ICD10'
$CVX = 'http://hl7.org/fhir/sid/cvx'
$NDC = 'http://hl7.org/fhir/sid/ndc'
$DCM = 'http://dicom.nema.org/resources/ontology/DCM'
$NUCC = 'http://nucc.org/provider-taxonomy'
$UCUM = 'http://unitsofmeasure.org'
$POS = 'https://www.cms.gov/Medicare/Coding/place-of-service-codes/Place_of_Service_Code_Set'
$C4BB = 'http://hl7.org/fhir/us/carin-bb/CodeSystem'
$C4BBSD = 'http://hl7.org/fhir/us/carin-bb/StructureDefinition'
$UC = 'http://hl7.org/fhir/us/core/StructureDefinition'
$UCV = '|6.1.0'
$OBSCAT = 'http://terminology.hl7.org/CodeSystem/observation-category'

# ---------- JSON writer (2-space, ordered; drops nulls and empty arrays) ----------
function Esc([string]$s) {
  '"' + ($s -replace '\\', '\\' -replace '"', '\"' -replace "`r", '\r' -replace "`n", '\n' -replace "`t", '\t') + '"'
}
function J($o, [int]$l = 0) {
  $pad = '  ' * $l; $pad1 = '  ' * ($l + 1)
  if ($null -eq $o) { return 'null' }
  if ($o -is [string]) { return Esc $o }
  if ($o -is [bool]) { if ($o) { return 'true' } else { return 'false' } }
  if ($o -is [int] -or $o -is [long] -or $o -is [double] -or $o -is [decimal]) {
    return ([IFormattable]$o).ToString($null, [Globalization.CultureInfo]::InvariantCulture)
  }
  if ($o -is [Collections.IDictionary]) {
    $keys = @($o.Keys | Where-Object {
      $v = $o[$_]
      -not ($null -eq $v -or ($v -isnot [string] -and $v -isnot [Collections.IDictionary] -and $v -is [Collections.IEnumerable] -and @($v).Count -eq 0))
    })
    if ($keys.Count -eq 0) { return '{}' }
    $parts = foreach ($k in $keys) { $pad1 + (Esc $k) + ': ' + (J $o[$k] ($l + 1)) }
    return "{`n" + ($parts -join ",`n") + "`n$pad}"
  }
  if ($o -is [Collections.IEnumerable]) {
    $items = @($o)
    if ($items.Count -eq 0) { return '[]' }
    $parts = foreach ($x in $items) { $pad1 + (J $x ($l + 1)) }
    return "[`n" + ($parts -join ",`n") + "`n$pad]"
  }
  throw "Unsupported type $($o.GetType())"
}

# ---------- ids (deterministic, so re-runs keep the same ids and links) ----------
$IDS = @{}
$SHA1 = [Security.Cryptography.SHA1]::Create()
function NewUuid([string]$key) {
  $h = $SHA1.ComputeHash([Text.Encoding]::UTF8.GetBytes("$PatId|$key"))
  $h[6] = ($h[6] -band 0x0f) -bor 0x50
  $h[8] = ($h[8] -band 0x3f) -bor 0x80
  $x = ($h[0..15] | ForEach-Object { $_.ToString('x2') }) -join ''
  '{0}-{1}-{2}-{3}-{4}' -f $x.Substring(0, 8), $x.Substring(8, 4), $x.Substring(12, 4), $x.Substring(16, 4), $x.Substring(20, 12)
}
function Id([string]$key) { if (-not $IDS.ContainsKey($key)) { $IDS[$key] = NewUuid $key }; $IDS[$key] }
function DicomUid([string]$key) {
  $hex = (NewUuid "dicom|$key") -replace '-', ''
  '2.25.' + [System.Numerics.BigInteger]::Parse('0' + $hex, 'AllowHexSpecifier').ToString()
}

# ---------- small builders ----------
$HTEST = [ordered]@{ system = 'http://terminology.hl7.org/CodeSystem/v3-ActReason'; code = 'HTEST'; display = 'test health data' }
function Meta($profile) { if ($profile) { [ordered]@{ profile = @($profile); tag = @($HTEST) } } else { [ordered]@{ tag = @($HTEST) } } }
function Coding($sys, $code, $disp) { [ordered]@{ system = $sys; code = $code; display = $disp } }
function CC($sys, $code, $disp, $text) { $t = $text; if (-not $t) { $t = $disp }; [ordered]@{ coding = @(Coding $sys $code $disp); text = $t } }
# Several codings for one concept: CCn 'text' @($SCT,'1','A') @($ICD,'X','B')
function CCn($text) { [ordered]@{ coding = @($args | ForEach-Object { Coding $_[0] $_[1] $_[2] }); text = $text } }
function TextCC($text) { [ordered]@{ text = $text } }
function Ref($type, $key, $display) { $r = [ordered]@{ reference = "$type/$(Id $key)" }; if ($display) { $r.display = $display }; $r }
function PatRef { [ordered]@{ reference = "Patient/$PatId" } }
function Money($v) { [ordered]@{ value = [decimal]$v; currency = 'USD' } }
function Qty($v, $unit, $code) { if (-not $code) { $code = $unit }; [ordered]@{ value = $v; unit = $unit; system = $UCUM; code = $code } }
function Ts($date, $time) { if ($time) { "${date}T${time}:00$TZ" } else { "${date}T09:00:00$TZ" } }

$ENTRIES = New-Object System.Collections.ArrayList
function Add($r) { [void]$ENTRIES.Add([ordered]@{ fullUrl = "$Base/$($r.resourceType)/$($r.id)"; resource = $r }) }

# ---------- attachments: text kept in a Binary, referenced by https URL ----------
$ATTACH = @{}
function Attach($key, $text, $title, $creation) {
  if (-not $ATTACH.ContainsKey($key)) {
    $bytes = [Text.Encoding]::UTF8.GetBytes($text)
    Add ([ordered]@{
      resourceType = 'Binary'; id = (Id $key); meta = (Meta $null)
      contentType = 'text/plain;charset=utf-8'; securityContext = (PatRef)
      data = [Convert]::ToBase64String($bytes)
    })
    $ATTACH[$key] = [ordered]@{
      contentType = 'text/plain;charset=utf-8'; language = 'en-US'
      url = "$Base/Binary/$(Id $key)"; size = $bytes.Length
      hash = [Convert]::ToBase64String($SHA1.ComputeHash($bytes))
      title = $title; creation = $creation
    }
  }
  $ATTACH[$key]
}

function Write-Bundle($path) {
  $bundle = [ordered]@{ resourceType = 'Bundle'; type = 'collection'; entry = @($ENTRIES) }
  [IO.File]::WriteAllText($path, (J $bundle) + "`n", (New-Object Text.UTF8Encoding($false)))
}

# Every reference in the bundle resolves, and no id is used twice.
function Test-Bundle($path) {
  $check = [IO.File]::ReadAllText($path) | ConvertFrom-Json
  $known = @{}
  foreach ($e in $check.entry) { $known["$($e.resource.resourceType)/$($e.resource.id)"] = $true }
  $refs = [regex]::Matches([IO.File]::ReadAllText($path), '"reference": "([^"]+)"') | ForEach-Object { $_.Groups[1].Value } | Select-Object -Unique
  $broken = @($refs | Where-Object { -not $known.ContainsKey($_) })
  $dupes = @($check.entry | Group-Object { "$($_.resource.resourceType)/$($_.resource.id)" } | Where-Object Count -gt 1)
  "Entries: $(@($check.entry).Count)"
  $check.entry | Group-Object { $_.resource.resourceType } | Sort-Object Name | ForEach-Object { '  {0,-22} {1}' -f $_.Name, $_.Count }
  "Unresolved references: $($broken.Count) $($broken -join ', ')"
  "Duplicate ids: $($dupes.Count)"
  if ($broken.Count -or $dupes.Count) { throw 'Bundle check failed' }
}
