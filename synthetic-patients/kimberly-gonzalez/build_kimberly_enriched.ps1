# Enriches synthetic patient Kimberly Gonzalez (GPX-SYN-0000000279-0) with
# practitioners, encounters, referrals, imaging, reports, clinical notes,
# medications and CARIN BB claims (ExplanationOfBenefit).
# The source bundle is read-only; output is written to a new file.
# IDs are deterministic (UUID v5-style from a key) so re-runs are stable.
param(
  [string]$Source = 'C:\Users\mroberts\Downloads\GPX-SYN-0000000279-0.json',
  [string]$Output = (Join-Path $PSScriptRoot 'GPX-SYN-0000000279-0_enriched.json'),
  # FHIR base for fullUrls and Binary links; must be a server that actually serves them
  [string]$Base = 'https://hapi.fhir.org/baseR4'
)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Numerics

$PatId = 'GPX-SYN-0000000279-0'
$TZ    = '-05:00'

# ---------- code systems ----------
$SCT   = 'http://snomed.info/sct'
$LOINC = 'http://loinc.org'
$RX    = 'http://www.nlm.nih.gov/research/umls/rxnorm'
$CPT   = 'http://www.ama-assn.org/go/cpt'
$HCPCS = 'https://www.cms.gov/Medicare/Coding/HCPCSReleaseCodeSets'
$ICD   = 'http://hl7.org/fhir/sid/icd-10-cm'
$DCM   = 'http://dicom.nema.org/resources/ontology/DCM'
$NUCC  = 'http://nucc.org/provider-taxonomy'
$UCUM  = 'http://unitsofmeasure.org'
$POS   = 'https://www.cms.gov/Medicare/Coding/place-of-service-codes/Place_of_Service_Code_Set'
$C4BB  = 'http://hl7.org/fhir/us/carin-bb/CodeSystem'
$UC    = 'http://hl7.org/fhir/us/core/StructureDefinition'
$UCV   = '|6.1.0'
$C4BBP = 'http://hl7.org/fhir/us/carin-bb/StructureDefinition/C4BB-ExplanationOfBenefit-Professional-NonClinician|2.0.0'

# ---------- JSON writer (2-space, ordered) ----------
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
    # FHIR forbids null and empty arrays, so drop those keys
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

# ---------- ids ----------
$IDS = @{}
function NewUuid([string]$key) {
  $sha = [Security.Cryptography.SHA1]::Create()
  $h = $sha.ComputeHash([Text.Encoding]::UTF8.GetBytes("$PatId|$key"))
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
function B64([string]$s) { [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($s)) }

# ---------- builders ----------
$HTEST = [ordered]@{ system = 'http://terminology.hl7.org/CodeSystem/v3-ActReason'; code = 'HTEST'; display = 'test health data' }
function Meta($profile) {
  if ($profile) { [ordered]@{ profile = @($profile); tag = @($HTEST) } } else { [ordered]@{ tag = @($HTEST) } }
}
function Coding($sys, $code, $disp) { [ordered]@{ system = $sys; code = $code; display = $disp } }
function CC($sys, $code, $disp, $text) {
  $t = $text; if (-not $t) { $t = $disp }
  [ordered]@{ coding = @(Coding $sys $code $disp); text = $t }
}
function TextCC($text) { [ordered]@{ text = $text } }
function Ref($type, $key, $display) {
  $r = [ordered]@{ reference = "$type/$(Id $key)" }
  if ($display) { $r.display = $display }
  $r
}
function PatRef { [ordered]@{ reference = "Patient/$PatId" } }
function Money($v) { [ordered]@{ value = [decimal]$v; currency = 'USD' } }
function Qty($v, $unit, $code) { [ordered]@{ value = $v; unit = $unit; system = $UCUM; code = $code } }

$entries = New-Object System.Collections.ArrayList
function Add($r) { [void]$entries.Add([ordered]@{ fullUrl = "$Base/$($r.resourceType)/$($r.id)"; resource = $r }) }

# ---------- load source and map existing ids ----------
$srcText = [IO.File]::ReadAllText($Source)
# Source fullUrls use parkerapex.com/atlas/fhir, which returns 404; rebase them
$srcText = $srcText.Replace('https://parkerapex.com/atlas/fhir/', "$Base/")

# Correct RxNorm codes in the source medications (verified against RxNav):
#   197361 is amlodipine 5 MG Oral Tablet -> lisinopril 10 MG Oral Tablet is 314076
#   860975 is 24 HR metformin 500 MG ER   -> metformin 500 MG Oral Tablet is 861007
foreach ($fix in @(
    @('("code":\s*)"197361"(,\s*"display":\s*"Lisinopril 10 MG Oral Tablet")', '314076'),
    @('("code":\s*)"860975"(,\s*"display":\s*"Metformin 500 MG Oral Tablet")', '861007'))) {
  $fixRe = [regex]$fix[0]
  $n = $fixRe.Matches($srcText).Count
  if ($n -ne 1) { throw "Expected 1 match for $($fix[0]), found $n" }
  $srcText = $fixRe.Replace($srcText, "`${1}`"$($fix[1])`"`${2}")
}
$bundle = $srcText | ConvertFrom-Json
function FindId($type, [scriptblock]$pred) {
  $m = @($bundle.entry | Where-Object { $_.resource.resourceType -eq $type -and (& $pred $_.resource) })
  if ($m.Count -ne 1) { throw "Expected one $type match, found $($m.Count)" }
  $m[0].resource.id
}
$IDS['cond_htn'] = FindId 'Condition' { param($r) $r.code.text -like 'Essential hypertension*' }
$IDS['cond_dm']  = FindId 'Condition' { param($r) $r.code.text -like 'Diabetes mellitus*' }
$IDS['cond_ckd'] = FindId 'Condition' { param($r) $r.code.text -like 'Diabetic chronic kidney disease*' }
$IDS['cond_ret'] = FindId 'Condition' { param($r) $r.code.text -like 'Retinopathy due to diabetes*' }
$IDS['coverage'] = FindId 'Coverage' { param($r) $true }
$IDS['payer']    = FindId 'Organization' { param($r) $r.name -eq 'Medicare Fee-for-Service' }
$IDS['enc_dm08']  = '39ef7251-ec8a-5658-a5a8-63e8d4f6f192'
$IDS['enc_ckd18'] = '3d14a0b3-d891-5de3-8af9-58c0d6fd8576'
$IDS['enc_ret18'] = '6f8ba7f8-02d4-53db-a0bf-765a02017b2b'
$IDS['enc_cu26']  = 'f8adb6f4-5427-567e-bb7a-0aa4b2cd81cf'
foreach ($k in 'enc_dm08', 'enc_ckd18', 'enc_ret18', 'enc_cu26') {
  if (-not ($bundle.entry | Where-Object { $_.resource.id -eq $IDS[$k] })) { throw "Missing existing encounter $k" }
}

# =====================================================================
# Organizations
# =====================================================================
function Org($key, $name, $ident) {
  Add ([ordered]@{
    resourceType = 'Organization'; id = (Id $key); meta = (Meta "$UC/us-core-organization$UCV")
    identifier = @([ordered]@{ system = 'https://parkerapex.com/atlas/organization'; value = $ident })
    active = $true
    type = @(CC 'http://terminology.hl7.org/CodeSystem/organization-type' 'prov' 'Healthcare Provider')
    name = $name
  })
}
Org 'org_pcp'   'Atlas Community Primary Care'                       'ORG-PCP-0001'
Org 'org_neph'  'Atlas Kidney Associates'                            'ORG-NEPH-0001'
Org 'org_eye'   'Atlas Eye & Retina Center'                          'ORG-EYE-0001'
Org 'org_img'   'Atlas Imaging Center'                               'ORG-IMG-0001'
Org 'org_endo'  'Atlas Endocrine & Diabetes Clinic'                  'ORG-ENDO-0001'
Org 'org_lab'   'Atlas Reference Laboratory'                         'ORG-LAB-0001'
Org 'org_pod'   'Atlas Foot & Ankle Specialists'                     'ORG-POD-0001'
Org 'org_dsmes' 'Atlas Diabetes Self-Management Education Program'   'ORG-DSMES-0001'

# =====================================================================
# Practitioners + PractitionerRoles
# =====================================================================
function Prac($key, $given, $family, $suffix, $ident, $orgKey, $taxCode, $taxDisp) {
  Add ([ordered]@{
    resourceType = 'Practitioner'; id = (Id $key); meta = (Meta "$UC/us-core-practitioner$UCV")
    identifier = @([ordered]@{ system = 'https://parkerapex.com/atlas/practitioner'; value = $ident })
    active = $true
    name = @([ordered]@{ use = 'official'; family = $family; given = @($given); suffix = @($suffix) })
  })
  Add ([ordered]@{
    resourceType = 'PractitionerRole'; id = (Id "$key-role"); meta = (Meta "$UC/us-core-practitionerrole$UCV")
    active = $true
    practitioner = (Ref 'Practitioner' $key "$given $family, $suffix")
    organization = (Ref 'Organization' $orgKey)
    specialty = @(CC $NUCC $taxCode $taxDisp)
  })
}
Prac 'pr_pcp'  'Angela'  'Morris' 'MD'  'PRAC-10001' 'org_pcp'  '207R00000X' 'Internal Medicine'
Prac 'pr_neph' 'Rajesh'  'Patel'  'MD'  'PRAC-10002' 'org_neph' '207RN0300X' 'Nephrology'
Prac 'pr_eye'  'Elena'   'Ruiz'   'MD'  'PRAC-10003' 'org_eye'  '207W00000X' 'Ophthalmology'
Prac 'pr_rad'  'Thomas'  'Nguyen' 'MD'  'PRAC-10004' 'org_img'  '2085R0202X' 'Diagnostic Radiology'
Prac 'pr_endo' 'Grace'   'Okafor' 'MD'  'PRAC-10005' 'org_endo' '207RE0101X' 'Endocrinology, Diabetes & Metabolism'
Prac 'pr_pod'  'Marcus'  'Bell'   'DPM' 'PRAC-10006' 'org_pod'  '213E00000X' 'Podiatrist'

# =====================================================================
# Referrals and orders (ServiceRequest)
# =====================================================================
$CAT_REF = @('3457005', 'Patient referral')
$CAT_IMG = @('363679005', 'Imaging')
function SR($key, $date, $status, $cat, $code, $requester, $performers, $encKey, $reasons, $note) {
  $r = [ordered]@{
    resourceType = 'ServiceRequest'; id = (Id $key); meta = (Meta "$UC/us-core-servicerequest$UCV")
    identifier = @([ordered]@{ system = 'https://parkerapex.com/atlas/order'; value = "ORD-$($date -replace '-', '')-$($key.ToUpper())" })
    status = $status; intent = 'order'
    category = @(CC $SCT $cat[0] $cat[1])
    priority = 'routine'
    code = $code
    subject = (PatRef)
    encounter = (Ref 'Encounter' $encKey)
    authoredOn = $date
    requester = (Ref 'Practitioner' $requester)
    performer = @($performers)
    reasonReference = @($reasons | ForEach-Object { Ref 'Condition' $_ })
  }
  if ($note) { $r.note = @([ordered]@{ text = $note }) }
  Add $r
}
$REFER = { param($text) CC $SCT '103696004' 'Patient referral to specialist (procedure)' $text }

SR 'sr_neph18' '2018-07-14' 'completed' $CAT_REF (& $REFER 'Referral to nephrology') 'pr_pcp' @((Ref 'Practitioner' 'pr_neph'), (Ref 'Organization' 'org_neph')) 'enc_ckd18' @('cond_ckd') 'Newly identified CKD in setting of T2DM and HTN. eGFR 57 mL/min/1.73m2, UACR 74 mg/g. Please evaluate and co-manage.'
SR 'sr_eye18'  '2018-07-14' 'completed' $CAT_REF (& $REFER 'Referral to ophthalmology (retina)') 'pr_pcp' @((Ref 'Practitioner' 'pr_eye'), (Ref 'Organization' 'org_eye')) 'enc_ret18' @('cond_ret') 'Diabetic retinopathy noted on screening. Please evaluate and stage.'
SR 'sr_us18'   '2018-08-20' 'completed' $CAT_IMG (CC $CPT '76770' 'US retroperitoneal, complete' 'Renal ultrasound, complete') 'pr_neph' @(Ref 'Organization' 'org_img') 'enc_neph18' @('cond_ckd') 'CKD G3a/A2. Assess kidney size and echogenicity; exclude obstruction.'
SR 'sr_mammo24' '2024-07-12' 'completed' $CAT_IMG (CC $CPT '77067' 'Screening mammography, bilateral' 'Screening mammogram, bilateral') 'pr_pcp' @(Ref 'Organization' 'org_img') 'enc_awv24' @() 'Routine screening.'
SR 'sr_dexa24'  '2024-07-12' 'completed' $CAT_IMG (CC $CPT '77080' 'DXA bone density, axial skeleton' 'DXA bone density study') 'pr_pcp' @(Ref 'Organization' 'org_img') 'enc_awv24' @() 'Postmenopausal osteoporosis screening, age 66.'
SR 'sr_endo26'  '2026-07-12' 'completed' $CAT_REF (& $REFER 'Referral to endocrinology') 'pr_pcp' @((Ref 'Practitioner' 'pr_endo'), (Ref 'Organization' 'org_endo')) 'enc_cu26' @('cond_dm', 'cond_ckd') 'A1c 8.4% with hypoglycemia on glipizide; CKD G3a/A2 (eGFR 49). Please evaluate regimen, including SGLT2 inhibitor.'
SR 'sr_pod26'   '2026-07-12' 'active'    $CAT_REF (& $REFER 'Referral to podiatry') 'pr_pcp' @((Ref 'Practitioner' 'pr_pod'), (Ref 'Organization' 'org_pod')) 'enc_cu26' @('cond_dm') 'Diminished monofilament sensation at 2/10 sites left forefoot. Diabetic foot evaluation and preventive care.'
SR 'sr_dsmes26' '2026-07-12' 'active'    $CAT_REF (CC $HCPCS 'G0108' 'Diabetes outpatient self-management training services, individual, per 30 minutes' 'Diabetes self-management education and support (DSMES)') 'pr_pcp' @(Ref 'Organization' 'org_dsmes') 'enc_cu26' @('cond_dm') 'Initial DSMES, 10 hours. Focus: hypoglycemia recognition, carbohydrate awareness, sick-day rules.'
SR 'sr_mammo26' '2026-07-12' 'active'    $CAT_IMG (CC $CPT '77067' 'Screening mammography, bilateral' 'Screening mammogram, bilateral') 'pr_pcp' @(Ref 'Organization' 'org_img') 'enc_cu26' @() 'Annual screening; overdue (last 08/2024).'
SR 'sr_dexa26'  '2026-07-12' 'active'    $CAT_IMG (CC $CPT '77080' 'DXA bone density, axial skeleton' 'DXA bone density study') 'pr_pcp' @(Ref 'Organization' 'org_img') 'enc_cu26' @('cond_osteopenia') 'Follow-up of osteopenia (DXA 08/2024, femoral neck T-score -1.8).'

# =====================================================================
# New encounters
# =====================================================================
function Enc($key, $date, $typeCode, $typeDisp, $pracKey, $orgKey, $reasons, $basedOn) {
  $r = [ordered]@{
    resourceType = 'Encounter'; id = (Id $key); meta = (Meta "$UC/us-core-encounter$UCV")
    identifier = @([ordered]@{ system = 'https://parkerapex.com/atlas/encounter'; value = (Id $key) })
    status = 'finished'
    class = (Coding 'http://terminology.hl7.org/CodeSystem/v3-ActCode' 'AMB' 'ambulatory')
    type = @(CC $SCT $typeCode $typeDisp)
    subject = (PatRef)
  }
  if ($basedOn) { $r.basedOn = @($basedOn | ForEach-Object { Ref 'ServiceRequest' $_ }) }
  $r.participant = @([ordered]@{
    type = @(CC 'http://terminology.hl7.org/CodeSystem/v3-ParticipationType' 'PPRF' 'primary performer')
    individual = (Ref 'Practitioner' $pracKey)
  })
  $r.period = [ordered]@{ start = $date; end = $date }
  if ($reasons) { $r.reasonReference = @($reasons | ForEach-Object { Ref 'Condition' $_ }) }
  $r.serviceProvider = (Ref 'Organization' $orgKey)
  Add $r
}
Enc 'enc_neph18' '2018-08-20' '11429006'  'Consultation'           'pr_neph' 'org_neph' @('cond_ckd', 'cond_htn') @('sr_neph18')
Enc 'enc_us18'   '2018-08-28' '185347001' 'Encounter for problem'  'pr_rad'  'org_img'  @('cond_ckd') @('sr_us18')
Enc 'enc_eye18'  '2018-09-05' '11429006'  'Consultation'           'pr_eye'  'org_eye'  @('cond_ret') @('sr_eye18')
Enc 'enc_awv24'  '2024-07-12' '185349003' 'Encounter for check up' 'pr_pcp'  'org_pcp'  @('cond_dm', 'cond_ckd', 'cond_htn') $null
Enc 'enc_img24'  '2024-08-05' '185347001' 'Encounter for problem'  'pr_rad'  'org_img'  $null @('sr_mammo24', 'sr_dexa24')
Enc 'enc_eye26'  '2026-08-03' '390906007' 'Follow-up encounter'    'pr_eye'  'org_eye'  @('cond_ret') $null
Enc 'enc_endo26' '2026-08-18' '11429006'  'Consultation'           'pr_endo' 'org_endo' @('cond_dm', 'cond_ckd') @('sr_endo26')

# =====================================================================
# New condition: osteopenia (from DXA)
# =====================================================================
Add ([ordered]@{
  resourceType = 'Condition'; id = (Id 'cond_osteopenia'); meta = (Meta "$UC/us-core-condition-problems-health-concerns$UCV")
  clinicalStatus = (CC 'http://terminology.hl7.org/CodeSystem/condition-clinical' 'active' 'Active')
  verificationStatus = (CC 'http://terminology.hl7.org/CodeSystem/condition-ver-status' 'confirmed' 'Confirmed')
  category = @(CC 'http://terminology.hl7.org/CodeSystem/condition-category' 'problem-list-item' 'Problem List Item')
  code = [ordered]@{ coding = @((Coding $SCT '312894000' 'Osteopenia (disorder)'), (Coding $ICD 'M85.89' 'Other specified disorders of bone density and structure, multiple sites')); text = 'Osteopenia' }
  subject = (PatRef)
  encounter = (Ref 'Encounter' 'enc_img24')
  onsetDateTime = '2024-08-05'
  recordedDate = '2024-08-05'
  asserter = (Ref 'Practitioner' 'pr_rad')
})

# =====================================================================
# Medications
# =====================================================================
function Med($key, $date, $status, $rxCode, $rxDisp, $reasons, $reasonText, $requester, $encKey, $sig, $qty, $prn, $note) {
  $r = [ordered]@{
    resourceType = 'MedicationRequest'; id = (Id $key); meta = (Meta "$UC/us-core-medicationrequest$UCV")
    status = $status; intent = 'order'
    category = @(CC 'http://terminology.hl7.org/CodeSystem/medicationrequest-category' 'community' 'Community')
    reportedBoolean = $false
    medicationCodeableConcept = (CC $RX $rxCode $rxDisp)
    subject = (PatRef)
    encounter = (Ref 'Encounter' $encKey)
    authoredOn = $date
    requester = (Ref 'Practitioner' $requester)
  }
  if ($reasons) { $r.reasonReference = @($reasons | ForEach-Object { Ref 'Condition' $_ }) }
  if ($reasonText) { $r.reasonCode = @(TextCC $reasonText) }
  $dose = [ordered]@{ text = $sig; route = (CC $SCT '26643006' 'Oral route') }
  if ($prn) { $dose.asNeededBoolean = $true }
  $r.dosageInstruction = @($dose)
  $r.dispenseRequest = [ordered]@{
    numberOfRepeatsAllowed = 3
    quantity = [ordered]@{ value = $qty; unit = 'tablet'; system = 'http://terminology.hl7.org/CodeSystem/v3-orderableDrugForm'; code = 'TAB' }
    expectedSupplyDuration = [ordered]@{ value = 90; unit = 'days'; system = $UCUM; code = 'd' }
  }
  if ($note) { $r.note = @([ordered]@{ text = $note }) }
  Add $r
}
Med 'med_atorva' '2008-07-16' 'active'  '617310'  'atorvastatin 20 MG Oral Tablet' @('cond_dm') $null 'pr_pcp' 'enc_dm08' 'Take 1 tablet by mouth once daily at bedtime.' 90 $false 'Primary prevention of ASCVD in type 2 diabetes.'
Med 'med_glip'   '2018-07-14' 'stopped' '310490'  'glipizide 5 MG Oral Tablet' @('cond_dm') $null 'pr_pcp' 'enc_ckd18' 'Take 1 tablet by mouth once daily with breakfast.' 90 $false 'Discontinued 2026-08-18 by endocrinology (Dr. Okafor) after two hypoglycemic episodes (BG 62 and 65 mg/dL); replaced by empagliflozin.'
Med 'med_apap'   '2026-07-12' 'active'  '198440'  'acetaminophen 500 MG Oral Tablet' $null 'Musculoskeletal pain; NSAIDs avoided due to CKD' 'pr_pcp' 'enc_cu26' 'Take 1 tablet by mouth every 6 hours as needed for pain. Do not exceed 3,000 mg per day.' 120 $true $null
Med 'med_empa'   '2026-08-18' 'active'  '1545658' 'empagliflozin 10 MG Oral Tablet' @('cond_dm', 'cond_ckd') $null 'pr_endo' 'enc_endo26' 'Take 1 tablet by mouth once daily in the morning. Hold on days of acute illness or poor oral intake.' 90 $false 'Glycemic control with kidney and cardiovascular benefit. BMP in 4 weeks.'

# =====================================================================
# Labs 2026-07-12 (CMP, lipid panel, A1c, UACR)
# =====================================================================
$LAB_DATE = '2026-07-12'; $LAB_ISSUED = "2026-07-13T07:30:00$TZ"
$INTERP = 'http://terminology.hl7.org/CodeSystem/v3-ObservationInterpretation'
function Lab($key, $code, $disp, $val, $unit, $low, $high, $flag) {
  $r = [ordered]@{
    resourceType = 'Observation'; id = (Id $key); meta = (Meta "$UC/us-core-observation-lab$UCV")
    status = 'final'
    category = @(CC 'http://terminology.hl7.org/CodeSystem/observation-category' 'laboratory' 'Laboratory')
    code = (CC $LOINC $code $disp)
    subject = (PatRef)
    encounter = (Ref 'Encounter' 'enc_cu26')
    effectiveDateTime = $LAB_DATE
    issued = $LAB_ISSUED
    performer = @(Ref 'Organization' 'org_lab')
    valueQuantity = (Qty $val $unit $unit)
  }
  $flags = @{ H = 'High'; L = 'Low'; N = 'Normal' }
  $r.interpretation = @(CC $INTERP $flag $flags[$flag])
  $rr = [ordered]@{}
  if ($null -ne $low)  { $rr.low  = (Qty $low $unit $unit) }
  if ($null -ne $high) { $rr.high = (Qty $high $unit $unit) }
  $r.referenceRange = @($rr)
  Add $r
  $key
}
$cmp = @(
  (Lab 'lab_glu'  '2345-7'  'Glucose [Mass/volume] in Serum or Plasma' 168 'mg/dL' 70 99 'H'),
  (Lab 'lab_bun'  '3094-0'  'Urea nitrogen [Mass/volume] in Serum or Plasma' 24 'mg/dL' 8 23 'H'),
  (Lab 'lab_cr'   '2160-0'  'Creatinine [Mass/volume] in Serum or Plasma' 1.21 'mg/dL' 0.57 1.00 'H'),
  (Lab 'lab_egfr' '98979-8' 'Glomerular filtration rate [Volume Rate/Area] in Serum, Plasma or Blood by Creatinine-based formula (CKD-EPI 2021)/1.73 sq M' 49 'mL/min/{1.73_m2}' 60 $null 'L'),
  (Lab 'lab_na'   '2951-2'  'Sodium [Moles/volume] in Serum or Plasma' 139 'mmol/L' 136 145 'N'),
  (Lab 'lab_k'    '2823-3'  'Potassium [Moles/volume] in Serum or Plasma' 4.8 'mmol/L' 3.5 5.1 'N'),
  (Lab 'lab_cl'   '2075-0'  'Chloride [Moles/volume] in Serum or Plasma' 103 'mmol/L' 98 107 'N'),
  (Lab 'lab_co2'  '2028-9'  'Carbon dioxide, total [Moles/volume] in Serum or Plasma' 24 'mmol/L' 22 29 'N'),
  (Lab 'lab_ca'   '17861-6' 'Calcium [Mass/volume] in Serum or Plasma' 9.4 'mg/dL' 8.6 10.3 'N'),
  (Lab 'lab_alb'  '1751-7'  'Albumin [Mass/volume] in Serum or Plasma' 4.0 'g/dL' 3.5 5.2 'N'),
  (Lab 'lab_tp'   '2885-2'  'Protein [Mass/volume] in Serum or Plasma' 7.1 'g/dL' 6.0 8.3 'N'),
  (Lab 'lab_alt'  '1742-6'  'Alanine aminotransferase [Enzymatic activity/volume] in Serum or Plasma' 18 'U/L' 0 32 'N'),
  (Lab 'lab_ast'  '1920-8'  'Aspartate aminotransferase [Enzymatic activity/volume] in Serum or Plasma' 21 'U/L' 0 31 'N'),
  (Lab 'lab_alp'  '6768-6'  'Alkaline phosphatase [Enzymatic activity/volume] in Serum or Plasma' 74 'U/L' 35 104 'N'),
  (Lab 'lab_bili' '1975-2'  'Bilirubin.total [Mass/volume] in Serum or Plasma' 0.6 'mg/dL' 0.1 1.2 'N')
)
$lipid = @(
  (Lab 'lab_chol' '2093-3'  'Cholesterol [Mass/volume] in Serum or Plasma' 182 'mg/dL' $null 199 'N'),
  (Lab 'lab_tg'   '2571-8'  'Triglyceride [Mass/volume] in Serum or Plasma' 168 'mg/dL' $null 149 'H'),
  (Lab 'lab_hdl'  '2085-9'  'Cholesterol in HDL [Mass/volume] in Serum or Plasma' 46 'mg/dL' 40 $null 'N'),
  (Lab 'lab_ldl'  '13457-7' 'Cholesterol in LDL [Mass/volume] in Serum or Plasma by calculation' 102 'mg/dL' $null 99 'H')
)
[void](Lab 'lab_a1c'  '4548-4' 'Hemoglobin A1c/Hemoglobin.total in Blood' 8.4 '%' 4.0 5.6 'H')
[void](Lab 'lab_uacr' '9318-7' 'Albumin/Creatinine [Mass Ratio] in Urine' 142 'mg/g' $null 29 'H')

function LabDR($key, $code, $disp, $results) {
  Add ([ordered]@{
    resourceType = 'DiagnosticReport'; id = (Id $key); meta = (Meta "$UC/us-core-diagnosticreport-lab$UCV")
    status = 'final'
    category = @(CC 'http://terminology.hl7.org/CodeSystem/v2-0074' 'LAB' 'Laboratory')
    code = (CC $LOINC $code $disp)
    subject = (PatRef)
    encounter = (Ref 'Encounter' 'enc_cu26')
    effectiveDateTime = $LAB_DATE
    issued = $LAB_ISSUED
    performer = @(Ref 'Organization' 'org_lab')
    result = @($results | ForEach-Object { Ref 'Observation' $_ })
  })
}
LabDR 'dr_cmp26'   '24323-8' 'Comprehensive metabolic 2000 panel - Serum or Plasma' $cmp
LabDR 'dr_lipid26' '24331-1' 'Lipid 1996 panel - Serum or Plasma' $lipid

# =====================================================================
# Imaging studies + imaging reports
# =====================================================================
$SOP = @{
  US  = '1.2.840.10008.5.1.4.1.1.6.1'      # Ultrasound Image Storage
  MG  = '1.2.840.10008.5.1.4.1.1.1.2'      # Digital Mammography X-Ray Image Storage - For Presentation
  OPT = '1.2.840.10008.5.1.4.1.1.77.1.5.4' # Ophthalmic Tomography Image Storage
  OP  = '1.2.840.10008.5.1.4.1.1.77.1.5.1' # Ophthalmic Photography 8 Bit Image Storage
  BMD = '1.2.840.10008.5.1.4.1.1.7'        # Secondary Capture Image Storage
}
$MOD = @{ US = 'Ultrasound'; MG = 'Mammography'; OPT = 'Ophthalmic Tomography'; OP = 'Ophthalmic Photography'; BMD = 'Bone Mineral Densitometry' }
$LATERALITY = @{ R = @('24028007', 'Right'); L = @('7771000', 'Left'); B = @('51440002', 'Right and left') }

function Series($studyKey, $num, $modality, $desc, $bsCode, $bsDisp, $side, $started, $titles) {
  $s = [ordered]@{
    uid = (DicomUid "$studyKey|series|$num"); number = $num
    modality = (Coding $DCM $modality $MOD[$modality])
    description = $desc
    numberOfInstances = $titles.Count
    bodySite = (Coding $SCT $bsCode $bsDisp)
  }
  if ($side) { $s.laterality = (Coding $SCT $LATERALITY[$side][0] $LATERALITY[$side][1]) }
  $s.started = $started
  $i = 0
  $s.instance = @($titles | ForEach-Object {
    $i++
    [ordered]@{ uid = (DicomUid "$studyKey|series|$num|inst|$i"); sopClass = [ordered]@{ system = 'urn:ietf:rfc:3986'; code = "urn:oid:$($SOP[$modality])" }; number = $i; title = $_ }
  })
  $s
}
function Study($key, $started, $encKey, $srKeys, $referrer, $interpreter, $procs, $reasons, $desc, $series) {
  $mods = @($series | ForEach-Object { $_.modality.code } | Select-Object -Unique)
  Add ([ordered]@{
    resourceType = 'ImagingStudy'; id = (Id $key); meta = (Meta $null)
    identifier = @([ordered]@{ system = 'urn:dicom:uid'; value = "urn:oid:$(DicomUid "$key|study")" })
    status = 'available'
    modality = @($mods | ForEach-Object { Coding $DCM $_ $MOD[$_] })
    subject = (PatRef)
    encounter = (Ref 'Encounter' $encKey)
    started = $started
    basedOn = @($srKeys | ForEach-Object { Ref 'ServiceRequest' $_ })
    referrer = (Ref 'Practitioner' $referrer)
    interpreter = @(Ref 'Practitioner' $interpreter)
    numberOfSeries = @($series).Count
    numberOfInstances = [int](($series | ForEach-Object { $_.numberOfInstances }) | Measure-Object -Sum).Sum
    procedureCode = @($procs)
    reasonReference = @($reasons | ForEach-Object { Ref 'Condition' $_ })
    description = $desc
    series = @($series)
  })
}
# Report/note text lives in one Binary; DiagnosticReport.presentedForm and
# DocumentReference.content both point at its https URL (with size + SHA-1
# hash) so clients reading both resources can de-duplicate.
$SHA1 = [Security.Cryptography.SHA1]::Create()
$ATTACH = @{}
function Attach($key, $text, $title, $creation) {
  if (-not $ATTACH.ContainsKey($key)) {
    $bytes = [Text.Encoding]::UTF8.GetBytes($text)
    Add ([ordered]@{
      resourceType = 'Binary'; id = (Id $key); meta = (Meta $null)
      contentType = 'text/plain;charset=utf-8'
      securityContext = (PatRef)
      data = [Convert]::ToBase64String($bytes)
    })
    $ATTACH[$key] = [ordered]@{
      contentType = 'text/plain;charset=utf-8'; language = 'en-US'
      url = "$Base/Binary/$(Id $key)"
      size = $bytes.Length
      hash = [Convert]::ToBase64String($SHA1.ComputeHash($bytes))
      title = $title; creation = $creation
    }
  }
  $ATTACH[$key]
}
$DOC_CAT = 'http://hl7.org/fhir/us/core/CodeSystem/us-core-documentreference-category'
function DocRef($key, $dateTime, $type, $categories, $author, $org, $encKey, $title, $attachment, $relatedRef) {
  $ctx = [ordered]@{ encounter = @(Ref 'Encounter' $encKey); period = [ordered]@{ start = $dateTime.Substring(0, 10); end = $dateTime.Substring(0, 10) } }
  if ($relatedRef) { $ctx.related = @($relatedRef) }
  Add ([ordered]@{
    resourceType = 'DocumentReference'; id = (Id $key); meta = (Meta "$UC/us-core-documentreference$UCV")
    identifier = @([ordered]@{ system = 'urn:ietf:rfc:3986'; value = "urn:uuid:$(Id $key)" })
    status = 'current'; docStatus = 'final'
    type = $type
    category = @($categories)
    subject = (PatRef)
    date = $dateTime
    author = @(Ref 'Practitioner' $author)
    custodian = (Ref 'Organization' $org)
    description = $title
    content = @([ordered]@{
      attachment = $attachment
      format = (Coding 'http://ihe.net/fhir/ihe.formatcode.fhir/CodeSystem/formatcode' 'urn:ihe:iti:xds:2017:mimeTypeSufficient' 'mimeType Sufficient')
    })
    context = $ctx
  })
}

function ImgDR($key, $date, $issued, $encKey, $srKeys, $studyKeys, $code, $catText, $prac, $org, $title, $conclusion, $text) {
  $att = Attach "bin_$key" $text $title $issued
  # US Core: radiology reports exposed as DiagnosticReport are also exposed as DocumentReference
  DocRef "doc_$key" $issued $code @((CC $DOC_CAT 'clinical-note' 'Clinical Note'), (CC $LOINC 'LP29684-5' 'Radiology' $catText)) $prac $org $encKey $title $att (Ref 'DiagnosticReport' $key)
  Add ([ordered]@{
    resourceType = 'DiagnosticReport'; id = (Id $key); meta = (Meta "$UC/us-core-diagnosticreport-note$UCV")
    basedOn = @($srKeys | ForEach-Object { Ref 'ServiceRequest' $_ })
    status = 'final'
    category = @([ordered]@{ coding = @(Coding $LOINC 'LP29684-5' 'Radiology'); text = $catText })
    code = $code
    subject = (PatRef)
    encounter = (Ref 'Encounter' $encKey)
    effectiveDateTime = $date
    issued = $issued
    performer = @((Ref 'Practitioner' $prac), (Ref 'Organization' $org))
    resultsInterpreter = @(Ref 'Practitioner' $prac)
    imagingStudy = @($studyKeys | ForEach-Object { Ref 'ImagingStudy' $_ })
    conclusion = $conclusion
    presentedForm = @($att)
  })
}
$HDR = "Patient: Kimberly Gonzalez    DOB: 11/27/1957    MRN: $PatId"

# --- 2018 renal ultrasound ---
$t = "2018-08-28T10:15:00$TZ"
Study 'is_renal18' $t 'enc_us18' @('sr_us18') 'pr_neph' 'pr_rad' @(CC $CPT '76770' 'US retroperitoneal, complete' 'Renal ultrasound, complete') @('cond_ckd') 'US KIDNEYS BILATERAL' @(
  (Series 'is_renal18' 1 'US' 'Right kidney' '9846003' 'Right kidney structure' 'R' $t @('Right kidney long', 'Right kidney transverse', 'Right kidney color Doppler')),
  (Series 'is_renal18' 2 'US' 'Left kidney'  '18639004' 'Left kidney structure' 'L' $t @('Left kidney long', 'Left kidney transverse', 'Left lower pole cyst', 'Left kidney color Doppler')),
  (Series 'is_renal18' 3 'US' 'Urinary bladder' '89837001' 'Urinary bladder structure' $null $t @('Bladder pre-void', 'Bladder post-void'))
)
ImgDR 'dr_renal18' '2018-08-28' "2018-08-28T13:42:00$TZ" 'enc_us18' @('sr_us18') @('is_renal18') (CC $LOINC '18748-4' 'Diagnostic imaging study' 'US Kidneys bilateral') 'Ultrasound' 'pr_rad' 'org_img' 'US Kidneys Bilateral' 'Mildly increased bilateral renal cortical echogenicity consistent with medical renal disease; normal renal size; no hydronephrosis or calculi; 1.2 cm simple left renal cyst (Bosniak I).' @"
ATLAS IMAGING CENTER - DIAGNOSTIC RADIOLOGY REPORT
$HDR
Exam date: 08/28/2018    Accession: IMG-20180828-0412
Ordering provider: Rajesh Patel, MD (Nephrology)

EXAM: US RETROPERITONEAL, COMPLETE (KIDNEYS AND BLADDER)

CLINICAL INDICATION: Chronic kidney disease stage G3a/A2. Type 2 diabetes mellitus. Hypertension.

COMPARISON: None.

TECHNIQUE: Real-time grayscale and color Doppler sonography of both kidneys and the urinary bladder, with pre- and post-void bladder images.

FINDINGS:
Right kidney: 10.1 cm in length. Cortical thickness preserved. Mildly increased cortical echogenicity relative to the liver. No hydronephrosis. No calculus. No solid mass.
Left kidney: 10.4 cm in length. Cortical thickness preserved. Mildly increased cortical echogenicity. No hydronephrosis. No calculus. 1.2 x 1.1 x 1.1 cm anechoic lesion in the lower pole with imperceptible wall and posterior acoustic enhancement, no septation, calcification or internal flow.
Color Doppler: Normal symmetric intrarenal perfusion.
Bladder: Unremarkable when distended. Post-void residual 22 mL.

IMPRESSION:
1. Mildly increased bilateral renal cortical echogenicity, consistent with medical renal disease. Normal renal size.
2. No hydronephrosis or nephrolithiasis.
3. 1.2 cm simple cyst, left lower pole (Bosniak I). No follow-up imaging needed.

Electronically signed: Thomas Nguyen, MD - Diagnostic Radiology    08/28/2018 13:42
"@

# --- 2018 OCT + fundus photography ---
$t = "2018-09-05T09:40:00$TZ"
Study 'is_eye18' $t 'enc_eye18' @('sr_eye18') 'pr_pcp' 'pr_eye' @((CC $CPT '92134' 'Scanning computerized ophthalmic diagnostic imaging, retina' 'OCT retina, both eyes'), (CC $CPT '92250' 'Fundus photography with interpretation and report' 'Fundus photography')) @('cond_ret') 'OCT MACULA OU AND FUNDUS PHOTOGRAPHY' @(
  (Series 'is_eye18' 1 'OPT' 'Macular cube 512x128 OD' '5665001' 'Retinal structure' 'R' $t @('Macular cube OD', 'ETDRS thickness map OD')),
  (Series 'is_eye18' 2 'OPT' 'Macular cube 512x128 OS' '5665001' 'Retinal structure' 'L' $t @('Macular cube OS', 'ETDRS thickness map OS')),
  (Series 'is_eye18' 3 'OP'  'Color fundus photographs OU' '5665001' 'Retinal structure' 'B' $t @('Fundus OD field 1', 'Fundus OD field 2', 'Fundus OS field 1', 'Fundus OS field 2'))
)
ImgDR 'dr_eye18' '2018-09-05' "2018-09-05T11:05:00$TZ" 'enc_eye18' @('sr_eye18') @('is_eye18') (CC $LOINC '18748-4' 'Diagnostic imaging study' 'OCT macula both eyes and fundus photography') 'Ophthalmic imaging' 'pr_eye' 'org_eye' 'OCT Macula OU and Fundus Photography' 'Mild nonproliferative diabetic retinopathy both eyes without diabetic macular edema. Central subfield thickness 268 um OD, 272 um OS.' @"
ATLAS EYE & RETINA CENTER - OPHTHALMIC IMAGING REPORT
$HDR
Exam date: 09/05/2018

STUDIES: Spectral-domain OCT, macular cube, both eyes (CPT 92134); color fundus photography, both eyes (CPT 92250).
INDICATION: Diabetic retinopathy noted on primary care screening.

OCT FINDINGS:
OD: Normal foveal contour. No intraretinal or subretinal fluid. No epiretinal membrane. Central subfield thickness 268 um.
OS: Normal foveal contour. No intraretinal or subretinal fluid. Central subfield thickness 272 um.

FUNDUS PHOTOGRAPHY:
OU: Scattered microaneurysms in the posterior pole. No intraretinal hemorrhage in more than one quadrant, no venous beading, no IRMA. No neovascularization of the disc or elsewhere. Optic discs pink and sharp, C/D 0.3 OU.

INTERPRETATION:
Mild nonproliferative diabetic retinopathy, both eyes, without diabetic macular edema. Baseline images obtained for comparison.

Electronically signed: Elena Ruiz, MD - Ophthalmology    09/05/2018 11:05
"@

# --- 2024 screening mammogram ---
$t = "2024-08-05T08:30:00$TZ"
Study 'is_mammo24' $t 'enc_img24' @('sr_mammo24') 'pr_pcp' 'pr_rad' @(CC $CPT '77067' 'Screening mammography, bilateral' 'Screening mammogram, bilateral') @() 'MG SCREENING BILATERAL' @(
  (Series 'is_mammo24' 1 'MG' 'Right breast CC/MLO' '80248007' 'Right breast structure' 'R' $t @('R CC', 'R MLO')),
  (Series 'is_mammo24' 2 'MG' 'Left breast CC/MLO'  '80248007' 'Left breast structure' 'L' $t @('L CC', 'L MLO'))
)
ImgDR 'dr_mammo24' '2024-08-05' "2024-08-06T09:10:00$TZ" 'enc_img24' @('sr_mammo24') @('is_mammo24') (CC $LOINC '24606-6' 'MG Breast Screening') 'Mammography' 'pr_rad' 'org_img' 'Screening Mammogram, Bilateral' 'Negative screening mammogram. BI-RADS 1. Breast density B (scattered fibroglandular). Annual screening recommended.' @"
ATLAS IMAGING CENTER - DIAGNOSTIC RADIOLOGY REPORT
$HDR
Exam date: 08/05/2024    Accession: IMG-20240805-0187
Ordering provider: Angela Morris, MD

EXAM: SCREENING MAMMOGRAM, BILATERAL, 2D DIGITAL WITH CAD

CLINICAL INDICATION: Routine screening. No breast complaints. No personal or family history of breast cancer.

COMPARISON: No prior studies available.

TECHNIQUE: Standard CC and MLO views of both breasts. Computer-aided detection applied.

BREAST COMPOSITION: B - There are scattered areas of fibroglandular density.

FINDINGS: No suspicious mass, architectural distortion, or suspicious calcification in either breast. Skin and nipples unremarkable. Benign-appearing axillary lymph nodes.

IMPRESSION: Negative.
BI-RADS ASSESSMENT CATEGORY 1: NEGATIVE.
RECOMMENDATION: Routine annual screening mammography.

A lay letter with these results has been sent to the patient.

Electronically signed: Thomas Nguyen, MD - Diagnostic Radiology    08/06/2024 09:10
"@

# --- 2024 DXA ---
$t = "2024-08-05T09:05:00$TZ"
Study 'is_dexa24' $t 'enc_img24' @('sr_dexa24') 'pr_pcp' 'pr_rad' @(CC $CPT '77080' 'DXA bone density, axial skeleton' 'DXA bone density study') @() 'DXA AXIAL SKELETON' @(
  (Series 'is_dexa24' 1 'BMD' 'AP lumbar spine L1-L4' '122496007' 'Lumbar spine structure' $null $t @('Lumbar spine image', 'Lumbar spine results')),
  (Series 'is_dexa24' 2 'BMD' 'Left proximal femur' '29836001' 'Hip region structure' 'L' $t @('Left hip image', 'Left hip results'))
)
ImgDR 'dr_dexa24' '2024-08-05' "2024-08-06T09:25:00$TZ" 'enc_img24' @('sr_dexa24') @('is_dexa24') (CC $LOINC '18748-4' 'Diagnostic imaging study' 'DXA bone density axial skeleton') 'Bone densitometry' 'pr_rad' 'org_img' 'DXA Bone Density' 'Osteopenia. Lowest T-score -1.8 at left femoral neck. FRAX 10-year probability: major osteoporotic fracture 9.8%, hip fracture 1.6%; below treatment thresholds.' @"
ATLAS IMAGING CENTER - BONE DENSITOMETRY REPORT
$HDR
Exam date: 08/05/2024    Accession: IMG-20240805-0191
Ordering provider: Angela Morris, MD

EXAM: DXA BONE DENSITY, AXIAL SKELETON (LUMBAR SPINE AND LEFT HIP)

CLINICAL INDICATION: Postmenopausal female, age 66. Osteoporosis screening. No prior fragility fracture. No glucocorticoid use.

COMPARISON: None.

RESULTS:
Region                 BMD (g/cm2)   T-score   Z-score
L1-L4                  0.912         -1.4      -0.3
Left femoral neck      0.701         -1.8      -0.6
Left total hip         0.812         -1.2      -0.2

FRAX (US-Black model, with femoral neck BMD):
10-year probability of major osteoporotic fracture: 9.8%
10-year probability of hip fracture: 1.6%

IMPRESSION:
1. Low bone mass (osteopenia) per WHO criteria; lowest T-score -1.8 at the left femoral neck.
2. FRAX probabilities are below NOF/BHOF treatment thresholds (20% / 3%).

RECOMMENDATIONS: Adequate calcium (1,200 mg/day, diet preferred) and vitamin D, weight-bearing exercise, fall-risk reduction. Repeat DXA in 2 years on the same scanner.

Electronically signed: Thomas Nguyen, MD - Diagnostic Radiology    08/06/2024 09:25
"@

# --- 2026 OCT follow-up ---
$t = "2026-08-03T14:10:00$TZ"
Study 'is_eye26' $t 'enc_eye26' @() 'pr_pcp' 'pr_eye' @(CC $CPT '92134' 'Scanning computerized ophthalmic diagnostic imaging, retina' 'OCT retina, both eyes') @('cond_ret') 'OCT MACULA OU' @(
  (Series 'is_eye26' 1 'OPT' 'Macular cube 512x128 OD' '5665001' 'Retinal structure' 'R' $t @('Macular cube OD', 'ETDRS thickness map OD', 'Change analysis OD vs 2018')),
  (Series 'is_eye26' 2 'OPT' 'Macular cube 512x128 OS' '5665001' 'Retinal structure' 'L' $t @('Macular cube OS', 'ETDRS thickness map OS', 'Change analysis OS vs 2018'))
)
ImgDR 'dr_eye26' '2026-08-03' "2026-08-03T15:20:00$TZ" 'enc_eye26' @() @('is_eye26') (CC $LOINC '18748-4' 'Diagnostic imaging study' 'OCT macula both eyes') 'Ophthalmic imaging' 'pr_eye' 'org_eye' 'OCT Macula OU' 'No diabetic macular edema either eye. Central subfield thickness 274 um OD (+6), 281 um OS (+9) compared with 09/2018.' @"
ATLAS EYE & RETINA CENTER - OPHTHALMIC IMAGING REPORT
$HDR
Exam date: 08/03/2026

STUDY: Spectral-domain OCT, macular cube, both eyes (CPT 92134).
INDICATION: Diabetic retinopathy follow-up.
COMPARISON: 09/05/2018.

FINDINGS:
OD: Preserved foveal contour. No intraretinal or subretinal fluid. Scattered hyperreflective foci temporal to fovea. Central subfield thickness 274 um (268 um in 2018).
OS: Preserved foveal contour. No intraretinal or subretinal fluid. Central subfield thickness 281 um (272 um in 2018).

INTERPRETATION:
No center-involved or non-center-involved diabetic macular edema in either eye. Minimal thickness increase since 2018 within test-retest variability.

Electronically signed: Elena Ruiz, MD - Ophthalmology    08/03/2026 15:20
"@

# =====================================================================
# Clinical notes (DocumentReference)
# =====================================================================
function Note($key, $dateTime, $typeCode, $typeDisp, $author, $org, $encKey, $title, $text) {
  $att = Attach "bin_$key" $text $title $dateTime
  DocRef $key $dateTime (CC $LOINC $typeCode $typeDisp) @(CC $DOC_CAT 'clinical-note' 'Clinical Note') $author $org $encKey $title $att $null
}

Note 'note_neph18' "2018-08-20T16:12:00$TZ" '11488-4' 'Consult note' 'pr_neph' 'org_neph' 'enc_neph18' 'Nephrology Consultation' @"
ATLAS KIDNEY ASSOCIATES - NEPHROLOGY CONSULTATION
$HDR
Date of service: 08/20/2018
Referring provider: Angela Morris, MD (Atlas Community Primary Care)
Reason for referral: Diabetic chronic kidney disease

HISTORY OF PRESENT ILLNESS
60-year-old woman with hypertension since 1990 and type 2 diabetes since 2008, referred for newly identified chronic kidney disease. Creatinine 1.00 mg/dL with eGFR 57 mL/min/1.73m2 on 07/14/2018; urine albumin-to-creatinine ratio 74 mg/g. No prior renal imaging. Denies gross hematuria, flank pain, edema, or foamy urine. Takes ibuprofen 400 mg a few times a week for low back pain. No family history of kidney disease. Diabetic retinopathy newly identified; ophthalmology consult scheduled 09/05/2018.

MEDICATIONS
- Lisinopril 10 mg daily
- Metformin 500 mg daily
- Glipizide 5 mg daily (started 07/14/2018)
- Atorvastatin 20 mg at bedtime
- Ibuprofen 400 mg as needed (OTC)

ALLERGIES: No known drug allergies.

PHYSICAL EXAM
BP 142/84, HR 76, BMI 21.0
General: Well-appearing, no distress.
CV: Regular rate and rhythm, no murmur. Lungs: Clear.
Abdomen: Soft, no bruit. Extremities: No edema.

DATA
07/14/2018: Creatinine 1.00 mg/dL, eGFR 57, K 4.6 mmol/L, A1c 8.1%, UACR 74 mg/g.

ASSESSMENT
1. CKD stage G3a/A2, most consistent with diabetic kidney disease with hypertensive contribution.
2. Hypertension, above goal for CKD with albuminuria.
3. Type 2 diabetes mellitus, suboptimally controlled.

PLAN
1. Renal ultrasound to assess kidney size and exclude obstruction (ordered).
2. BP goal <130/80. Continue lisinopril 10 mg; will uptitrate if above goal at follow-up after BMP check.
3. Stop ibuprofen; avoid all NSAIDs. Acetaminophen as needed for pain.
4. Metformin may continue at current dose while eGFR >45.
5. Repeat BMP and UACR in 3 months.
6. Return to nephrology clinic in 6 months.

Thank you for this referral. Letter sent to Dr. Morris.

Electronically signed: Rajesh Patel, MD - Nephrology    08/20/2018 16:12
"@

Note 'note_eye18' "2018-09-05T11:20:00$TZ" '11488-4' 'Consult note' 'pr_eye' 'org_eye' 'enc_eye18' 'Ophthalmology Consultation - Retina' @"
ATLAS EYE & RETINA CENTER - OPHTHALMOLOGY CONSULTATION
$HDR
Date of service: 09/05/2018
Referring provider: Angela Morris, MD
Reason for referral: Diabetic retinopathy on screening

HISTORY
60-year-old woman with type 2 diabetes for 10 years (A1c 8.1% 07/2018), hypertension, and CKD G3a. Retinopathy noted on primary care screening 07/14/2018. Denies blurred vision, floaters, flashes, or eye pain. Wears reading glasses only.

EXAMINATION
Visual acuity (cc): OD 20/20-1, OS 20/25
IOP (applanation): OD 16, OS 17 mmHg
Pupils: Equal, round, reactive; no APD
Anterior segment: Early nuclear sclerosis OU; otherwise unremarkable
Dilated fundus OU: Scattered microaneurysms in the posterior pole. No venous beading, IRMA, or neovascularization. No hard exudates in the macula. Discs pink and sharp, C/D 0.3.

IMAGING (see separate report)
OCT macula OU: No macular edema. CST 268 um OD, 272 um OS.
Fundus photographs OU obtained as baseline.

ASSESSMENT
1. Mild nonproliferative diabetic retinopathy without macular edema, both eyes.
2. Early nuclear sclerotic cataract OU, not visually significant.

PLAN
1. Glycemic and blood pressure control emphasized; findings communicated to PCP.
2. Return in 12 months for dilated exam and OCT, sooner with any change in vision.

Electronically signed: Elena Ruiz, MD - Ophthalmology    09/05/2018 11:20
"@

Note 'note_pcp26' "2026-07-13T17:45:00$TZ" '11506-3' 'Progress note' 'pr_pcp' 'org_pcp' 'enc_cu26' 'Annual Wellness Visit and Chronic Care Follow-up' @"
ATLAS COMMUNITY PRIMARY CARE - PROGRESS NOTE
$HDR
Date of service: 07/12/2026
Provider: Angela Morris, MD - Internal Medicine
Visit type: Medicare subsequent Annual Wellness Visit with chronic disease follow-up

SUBJECTIVE
68-year-old woman with type 2 diabetes complicated by CKD and retinopathy, hypertension, and osteopenia. Home fasting glucose 140-210 mg/dL. Two episodes of shakiness with glucose 62 and 65 mg/dL in the past month, both late morning after a light breakfast; resolved with juice. Occasional tingling in the left toes. Uses OTC ibuprofen a few times a month for knee and back aches. No chest pain, dyspnea, edema, or vision change. Did not complete a mammogram in 2025.

CURRENT MEDICATIONS
- Lisinopril 10 mg daily
- Metformin 500 mg daily
- Glipizide 5 mg daily with breakfast
- Atorvastatin 20 mg at bedtime

OBJECTIVE
BP 136/78 (initial), 118/78 (repeat after 5 minutes seated). BMI 20.4.
Foot exam: Skin intact, no ulceration or callus. Dorsalis pedis and posterior tibial pulses 2+ bilaterally. 10-g monofilament: absent at 2 of 10 sites, left forefoot; intact on right. Vibration reduced at left great toe.
Screening: PHQ-2 score 0. No falls in past year. Independent in ADLs/IADLs. Cognition: Mini-Cog normal.

LABS (drawn today, resulted 07/13/2026)
A1c 8.4% (H). Creatinine 1.21 mg/dL, eGFR 49 (CKD-EPI 2021) (L), K 4.8. UACR 142 mg/g (H).
Lipids: TC 182, TG 168, HDL 46, LDL 102 mg/dL.
Trend: eGFR 57 (2018) -> 49 (2026).

ASSESSMENT AND PLAN
1. Type 2 diabetes with diabetic CKD and retinopathy, above individualized goal (A1c 8.4%; goal <7.5%), with sulfonylurea-associated hypoglycemia.
   - Referral to endocrinology; requested evaluation for SGLT2 inhibitor given CKD with albuminuria.
   - Hypoglycemia recognition and treatment reviewed; continue current regimen until endocrinology visit.
   - Referral to DSMES program.
2. CKD G3a/A2, slowly progressive. Continue lisinopril. Stop ibuprofen; acetaminophen 500 mg as needed prescribed. Recommend nephrology follow-up (last seen 2019).
3. Loss of protective sensation, left forefoot; possible early diabetic peripheral neuropathy. Referral to podiatry. Daily foot inspection reviewed.
4. Hypertension, at goal on repeat measurement.
5. ASCVD risk: LDL 102 on atorvastatin 20 mg. Recommended increase to 40 mg; patient prefers to decide after endocrinology visit.
6. Diabetic retinopathy: retina follow-up scheduled 08/03/2026.
7. Osteopenia (DXA 08/2024): repeat DXA ordered. Calcium and vitamin D intake reviewed.
8. Health maintenance: Tdap administered today. Screening mammogram ordered (overdue). Advance directive materials provided.

Return in 3 months, sooner as needed.

Electronically signed: Angela Morris, MD    07/13/2026 17:45
"@

Note 'note_eye26' "2026-08-03T15:35:00$TZ" '11506-3' 'Progress note' 'pr_eye' 'org_eye' 'enc_eye26' 'Retina Follow-up' @"
ATLAS EYE & RETINA CENTER - PROGRESS NOTE
$HDR
Date of service: 08/03/2026
Provider: Elena Ruiz, MD - Ophthalmology

INTERVAL HISTORY
Last seen 09/05/2018 with mild NPDR OU; did not return for the scheduled 12-month follow-up. Recent A1c 8.4% (07/2026). Reports slightly blurrier near vision OS over the past year. No floaters, flashes, or distortion.

EXAMINATION
Visual acuity (cc): OD 20/25, OS 20/30
IOP: OD 15, OS 16 mmHg
Anterior segment: Mild nuclear sclerosis OU, progressed slightly since 2018.
Dilated fundus OU: Microaneurysms and dot-blot hemorrhages in three quadrants OU; two cotton-wool spots superotemporal arcade OS. No venous beading, no IRMA, no neovascularization.

IMAGING (see separate report)
OCT macula OU: No DME. CST 274 um OD, 281 um OS.

ASSESSMENT
1. Moderate nonproliferative diabetic retinopathy without macular edema, both eyes; progressed from mild NPDR (2018).
2. Nuclear sclerotic cataract OU, mild; contributes to reduced acuity OS.

PLAN
1. Return in 6 months with dilated exam and OCT; sooner with vision change.
2. Glycemic, BP, and lipid control; endocrinology visit on 08/18/2026 noted.
3. Cataract: monitor; not yet functionally limiting.
4. Importance of follow-up adherence discussed; front desk to schedule before patient leaves.

Electronically signed: Elena Ruiz, MD    08/03/2026 15:35
"@

Note 'note_endo26' "2026-08-18T16:30:00$TZ" '11488-4' 'Consult note' 'pr_endo' 'org_endo' 'enc_endo26' 'Endocrinology Consultation' @"
ATLAS ENDOCRINE & DIABETES CLINIC - ENDOCRINOLOGY CONSULTATION
$HDR
Date of service: 08/18/2026
Referring provider: Angela Morris, MD
Reason for referral: Uncontrolled type 2 diabetes with CKD; hypoglycemia on glipizide

HISTORY OF PRESENT ILLNESS
68-year-old woman with type 2 diabetes diagnosed 2008, complicated by CKD G3a/A2 and moderate NPDR. A1c history: 9.2% (07/2008), 8.5% (10/2008), 8.1% (07/2018), 8.4% (07/2026). On metformin 500 mg daily and glipizide 5 mg daily. Two documented hypoglycemic episodes in June 2026 (62 and 65 mg/dL). Home fasting glucose 140-210 mg/dL. Eats two to three meals daily, often skips lunch. Lean body habitus throughout course.

MEDICATIONS
Lisinopril 10 mg daily; metformin 500 mg daily; glipizide 5 mg daily; atorvastatin 20 mg at bedtime; acetaminophen 500 mg as needed.

EXAM
BP 128/76, HR 72, BMI 20.6. Thyroid not enlarged. Feet: as documented by PCP; podiatry referral pending.

DATA
07/12/2026: A1c 8.4%, creatinine 1.21 mg/dL, eGFR 49, K 4.8, UACR 142 mg/g, LDL 102 mg/dL.

ASSESSMENT
Type 2 diabetes, above individualized goal (A1c <7.5% given age, CKD, and hypoglycemia history), with sulfonylurea-related hypoglycemia. CKD with albuminuria is a strong indication for SGLT2 inhibition independent of glycemic effect.

PLAN
1. STOP glipizide (hypoglycemia; reduced clearance in CKD).
2. START empagliflozin 10 mg daily. Counseled on genital hygiene and mycotic infection risk, hydration, expected small initial eGFR dip, and sick-day rules (hold during acute illness, vomiting, or poor oral intake).
3. Continue metformin 500 mg daily; plan to increase to 500 mg twice daily at follow-up if A1c remains above goal (appropriate at eGFR >45).
4. BMP in 4 weeks after starting empagliflozin.
5. If A1c remains above goal at 3 months, consider adding a GLP-1 receptor agonist.
6. Agree with PCP recommendation to intensify atorvastatin to 40 mg.
7. DSMES referral confirmed; patient will enroll in September.
8. Return in 3 months with A1c.

Letter sent to Dr. Morris.

Electronically signed: Grace Okafor, MD - Endocrinology    08/18/2026 16:30
"@

# =====================================================================
# Claims (CARIN BB ExplanationOfBenefit, professional)
# =====================================================================
function Adj($sys, $code, $disp, $amt) { [ordered]@{ category = [ordered]@{ coding = @(Coding $sys $code $disp) }; amount = (Money $amt) } }
$ADJ = 'http://terminology.hl7.org/CodeSystem/adjudication'

# $dx: array of @(code, display); first is principal.
# $lines: array of hashtables { sys, code, disp, mod, charge, allowed, nocost (no patient cost share), dx }
function EOB($key, $dos, $created, $paid, $billOrg, $rendering, $renderingType, $referring, $posCode, $posDisp, $dx, $lines, $encKey) {
  if ($dx[0] -is [string]) { $dx = , $dx }  # @(x) flattens a lone code/display pair
  $claimNo = "CLM-$($dos -replace '-', '')-$($key.ToUpper() -replace '^CLM_', '')"
  $care = @([ordered]@{ sequence = 1; provider = (Ref $renderingType $rendering); role = (CC "$C4BB/C4BBClaimCareTeamRole" 'rendering' 'Rendering provider') })
  if ($referring) { $care += [ordered]@{ sequence = 2; provider = (Ref 'Practitioner' $referring); role = (CC "$C4BB/C4BBClaimCareTeamRole" 'referring' 'Referring') } }
  $i = 0
  $dxOut = @($dx | ForEach-Object {
    $i++
    $type = if ($i -eq 1) { Coding 'http://terminology.hl7.org/CodeSystem/ex-diagnosistype' 'principal' 'Principal Diagnosis' } else { Coding "$C4BB/C4BBClaimDiagnosisType" 'secondary' 'Secondary' }
    [ordered]@{ sequence = $i; diagnosisCodeableConcept = (CC $ICD $_[0] $_[1]); type = @([ordered]@{ coding = @($type) }) }
  })
  $tot = @{ sub = [decimal]0; elig = [decimal]0; prov = [decimal]0; pt = [decimal]0 }
  $seq = 0
  $items = @($lines | ForEach-Object {
    $seq++
    $allowed = [decimal]$_.allowed
    if ($_.nocost) { $paidAmt = $allowed } else { $paidAmt = [math]::Round($allowed * [decimal]0.8, 2) }
    $ptAmt = $allowed - $paidAmt
    $tot.sub += [decimal]$_.charge; $tot.elig += $allowed; $tot.prov += $paidAmt; $tot.pt += $ptAmt
    $it = [ordered]@{
      sequence = $seq
      careTeamSequence = @(1)
      diagnosisSequence = @($_.dx)
      productOrService = (CC $_.sys $_.code $_.disp)
    }
    if ($_.mod) { $it.modifier = @(CC $CPT $_.mod $_.modDisp) }
    $it.servicedDate = $dos
    $it.locationCodeableConcept = (CC $POS $posCode $posDisp)
    $it.quantity = [ordered]@{ value = 1 }
    $it.encounter = @(Ref 'Encounter' $encKey)
    $it.adjudication = @(
      (Adj $ADJ 'submitted' 'Submitted Amount' $_.charge),
      (Adj $ADJ 'eligible' 'Eligible Amount' $allowed),
      (Adj "$C4BB/C4BBAdjudication" 'paidtoprovider' 'Paid to provider' $paidAmt),
      (Adj "$C4BB/C4BBAdjudication" 'paidbypatient' 'Paid by patient' $ptAmt),
      [ordered]@{
        category = [ordered]@{ coding = @(Coding "$C4BB/C4BBAdjudicationDiscriminator" 'inoutnetwork' 'In or Out of Network') }
        reason = [ordered]@{ coding = @(Coding "$C4BB/C4BBPayerAdjudicationStatus" 'innetwork' 'In Network') }
      }
    )
    $it
  })
  Add ([ordered]@{
    resourceType = 'ExplanationOfBenefit'; id = (Id $key); meta = (Meta $C4BBP)
    identifier = @([ordered]@{ type = (CC "$C4BB/C4BBIdentifierType" 'uc' 'Unique Claim ID'); system = 'https://parkerapex.com/atlas/claim'; value = $claimNo })
    status = 'active'
    type = (CC 'http://terminology.hl7.org/CodeSystem/claim-type' 'professional' 'Professional')
    use = 'claim'
    patient = (PatRef)
    billablePeriod = [ordered]@{ start = $dos; end = $dos }
    created = "${created}T00:00:00$TZ"
    insurer = (Ref 'Organization' 'payer' 'Medicare Fee-for-Service')
    provider = (Ref 'Organization' $billOrg)
    outcome = 'complete'
    careTeam = @($care)
    supportingInfo = @(
      [ordered]@{ sequence = 1; category = (CC "$C4BB/C4BBSupportingInfoType" 'billingnetworkcontractingstatus' 'Billing Network Contracting Status'); code = (CC "$C4BB/C4BBPayerProviderContractingStatus" 'contracted' 'Contracted') },
      [ordered]@{ sequence = 2; category = (CC "$C4BB/C4BBSupportingInfoType" 'clmrecvddate' 'Claim Received Date'); timingDate = $created }
    )
    diagnosis = @($dxOut)
    insurance = @([ordered]@{ focal = $true; coverage = (Ref 'Coverage' 'coverage') })
    item = @($items)
    total = @(
      (Adj $ADJ 'submitted' 'Submitted Amount' $tot.sub),
      (Adj $ADJ 'eligible' 'Eligible Amount' $tot.elig),
      (Adj "$C4BB/C4BBAdjudication" 'paidtoprovider' 'Paid to provider' $tot.prov),
      (Adj "$C4BB/C4BBAdjudication" 'paidbypatient' 'Paid by patient' $tot.pt)
    )
    payment = [ordered]@{ type = (CC 'http://terminology.hl7.org/CodeSystem/ex-paymenttype' 'complete' 'Complete'); date = $paid; amount = (Money $tot.prov) }
  })
}
function L($sys, $code, $disp, $charge, $allowed, $dx, [switch]$NoCost, $mod, $modDisp) {
  @{ sys = $sys; code = $code; disp = $disp; charge = $charge; allowed = $allowed; dx = $dx; nocost = [bool]$NoCost; mod = $mod; modDisp = $modDisp }
}
$DX_E1122  = @('E11.22', 'Type 2 diabetes mellitus with diabetic chronic kidney disease')
$DX_N183   = @('N18.3', 'Chronic kidney disease, stage 3 (moderate)')
$DX_N1831  = @('N18.31', 'Chronic kidney disease, stage 3a')
$DX_I129   = @('I12.9', 'Hypertensive chronic kidney disease with stage 1 through stage 4 chronic kidney disease, or unspecified chronic kidney disease')
$DX_E11319 = @('E11.319', 'Type 2 diabetes mellitus with unspecified diabetic retinopathy without macular edema')
$DX_E113293 = @('E11.3293', 'Type 2 diabetes mellitus with mild nonproliferative diabetic retinopathy without macular edema, bilateral')
$DX_E113393 = @('E11.3393', 'Type 2 diabetes mellitus with moderate nonproliferative diabetic retinopathy without macular edema, bilateral')
$DX_E1165  = @('E11.65', 'Type 2 diabetes mellitus with hyperglycemia')
$DX_Z0001  = @('Z00.01', 'Encounter for general adult medical examination with abnormal findings')
$DX_Z1231  = @('Z12.31', 'Encounter for screening mammogram for malignant neoplasm of breast')
$DX_Z13820 = @('Z13.820', 'Encounter for screening for osteoporosis')
$DX_Z7984  = @('Z79.84', 'Long term (current) use of oral hypoglycemic drugs')
$DX_Z79899 = @('Z79.899', 'Other long term (current) drug therapy')

EOB 'clm_pcp18' '2018-07-14' '2018-07-20' '2018-08-03' 'org_pcp' 'pr_pcp' 'Practitioner' $null '11' 'Office' @($DX_E1122, $DX_N183, $DX_I129, $DX_E11319) @(
  (L $CPT '99214' 'Office/outpatient visit, established patient, moderate' 210 109.33 @(1, 2, 3, 4))
) 'enc_ckd18'
EOB 'clm_neph18' '2018-08-20' '2018-08-24' '2018-09-07' 'org_neph' 'pr_neph' 'Practitioner' 'pr_pcp' '11' 'Office' @($DX_E1122, $DX_N183, $DX_I129) @(
  (L $CPT '99204' 'Office/outpatient visit, new patient, moderate' 350 167.09 @(1, 2, 3))
) 'enc_neph18'
EOB 'clm_us18' '2018-08-28' '2018-08-31' '2018-09-14' 'org_img' 'pr_rad' 'Practitioner' 'pr_neph' '11' 'Office' @($DX_N183, $DX_E1122) @(
  (L $CPT '76770' 'US retroperitoneal, complete' 420 119.52 @(1, 2))
) 'enc_us18'
EOB 'clm_eye18' '2018-09-05' '2018-09-10' '2018-09-24' 'org_eye' 'pr_eye' 'Practitioner' 'pr_pcp' '11' 'Office' @($DX_E113293) @(
  (L $CPT '92004' 'Ophthalmological services, comprehensive, new patient' 260 141.50 @(1)),
  (L $CPT '92134' 'Scanning computerized ophthalmic diagnostic imaging, retina' 95 42.80 @(1)),
  (L $CPT '92250' 'Fundus photography with interpretation and report' 120 48.11 @(1))
) 'enc_eye18'
EOB 'clm_awv24' '2024-07-12' '2024-07-17' '2024-07-31' 'org_pcp' 'pr_pcp' 'Practitioner' $null '11' 'Office' @($DX_Z0001, $DX_E1122, $DX_N1831, $DX_I129, $DX_E113293) @(
  (L $HCPCS 'G0439' 'Annual wellness visit, subsequent' 240 134.17 @(1) -NoCost),
  (L $CPT '99214' 'Office/outpatient visit, established patient, moderate' 220 127.97 @(2, 3, 4, 5) -mod '25' -modDisp 'Significant, separately identifiable E/M service')
) 'enc_awv24'
EOB 'clm_img24' '2024-08-05' '2024-08-09' '2024-08-23' 'org_img' 'pr_rad' 'Practitioner' 'pr_pcp' '11' 'Office' @($DX_Z1231, $DX_Z13820) @(
  (L $CPT '77067' 'Screening mammography, bilateral' 285 138.37 @(1) -NoCost),
  (L $CPT '77080' 'DXA bone density, axial skeleton' 180 38.36 @(2) -NoCost)
) 'enc_img24'
EOB 'clm_awv26' '2026-07-12' '2026-07-16' '2026-07-30' 'org_pcp' 'pr_pcp' 'Practitioner' $null '11' 'Office' @($DX_Z0001, $DX_E1122, $DX_N1831, $DX_I129, $DX_E113293, $DX_Z7984) @(
  (L $HCPCS 'G0439' 'Annual wellness visit, subsequent' 245 136.61 @(1) -NoCost),
  (L $CPT '99214' 'Office/outpatient visit, established patient, moderate' 225 131.12 @(2, 3, 4, 5, 6) -mod '25' -modDisp 'Significant, separately identifiable E/M service')
) 'enc_cu26'
EOB 'clm_lab26' '2026-07-12' '2026-07-15' '2026-07-29' 'org_lab' 'org_lab' 'Organization' 'pr_pcp' '81' 'Independent Laboratory' @($DX_E1122, $DX_N1831, $DX_Z7984, $DX_Z79899) @(
  (L $CPT '80053' 'Comprehensive metabolic panel' 48 10.56 @(1, 2, 4) -NoCost),
  (L $CPT '83036' 'Hemoglobin; glycosylated (A1C)' 40 9.71 @(1, 3) -NoCost),
  (L $CPT '80061' 'Lipid panel' 55 13.39 @(1, 4) -NoCost),
  (L $CPT '82043' 'Albumin; urine, microalbumin, quantitative' 30 7.10 @(1, 2) -NoCost),
  (L $CPT '82570' 'Creatinine; other source' 25 5.24 @(1, 2) -NoCost)
) 'enc_cu26'
EOB 'clm_eye26' '2026-08-03' '2026-08-06' '2026-08-20' 'org_eye' 'pr_eye' 'Practitioner' $null '11' 'Office' @($DX_E113393) @(
  (L $CPT '92014' 'Ophthalmological services, comprehensive, established patient' 180 103.71 @(1)),
  (L $CPT '92134' 'Scanning computerized ophthalmic diagnostic imaging, retina' 95 38.94 @(1))
) 'enc_eye26'
EOB 'clm_endo26' '2026-08-18' '2026-08-21' '2026-09-04' 'org_endo' 'pr_endo' 'Practitioner' 'pr_pcp' '11' 'Office' @($DX_E1165, $DX_E1122, $DX_N1831) @(
  (L $CPT '99204' 'Office/outpatient visit, new patient, moderate' 360 173.86 @(1, 2, 3))
) 'enc_endo26'

# =====================================================================
# Splice new entries into the original bundle text and write
# =====================================================================
$newText = ($entries | ForEach-Object { '    ' + (J $_ 2) }) -join ",`n"
$m = [regex]::Match($srcText, '\s*\]\s*\}\s*$')
if (-not $m.Success) { throw 'Could not find end of entry array in source bundle' }
$outText = $srcText.Substring(0, $m.Index) + ",`n" + $newText + "`n  ]`n}`n"
[IO.File]::WriteAllText($Output, $outText, (New-Object Text.UTF8Encoding($false)))

# ---------- verify ----------
$check = [IO.File]::ReadAllText($Output) | ConvertFrom-Json
$known = @{}
foreach ($e in $check.entry) { $known["$($e.resource.resourceType)/$($e.resource.id)"] = $true }
$refs = [regex]::Matches(($check | ConvertTo-Json -Depth 50 -Compress), '"reference":"([^"]+)"') | ForEach-Object { $_.Groups[1].Value } | Select-Object -Unique
$broken = @($refs | Where-Object { -not $known.ContainsKey($_) })
$dupes = @($check.entry | Group-Object { "$($_.resource.resourceType)/$($_.resource.id)" } | Where-Object Count -gt 1)
"Wrote $Output"
"Entries: original $(@($bundle.entry).Count), added $($entries.Count), total $(@($check.entry).Count)"
$check.entry | Group-Object { $_.resource.resourceType } | Sort-Object Name | ForEach-Object { '  {0,-22} {1}' -f $_.Name, $_.Count }
"Unresolved references: $($broken.Count) $($broken -join ', ')"
"Duplicate ids: $($dupes.Count)"
