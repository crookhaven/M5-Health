# Resource builders shared by the synthetic patient generators (Encounter,
# Condition, MedicationRequest, Observation, reports, notes, claims...).
# Dot-source after lib\FhirBuilders.ps1. Set $IdPrefix first to make organization
# and practitioner identifiers unique per patient (HAPI rejects duplicates).

if (-not $IdPrefix) { $IdPrefix = 'MDM' }

function Each($list, [scriptblock]$fn) {
  $out = New-Object System.Collections.ArrayList
  foreach ($x in @($list)) { if ($null -ne $x) { [void]$out.Add((& $fn $x)) } }
  , $out.ToArray()
}

function Org($key, $name, $type = 'prov', $typeDisp = 'Healthcare Provider') {
  Add ([ordered]@{
    resourceType = 'Organization'; id = (Id $key); meta = (Meta "$UC/us-core-organization$UCV")
    identifier = @([ordered]@{ system = 'https://parkerapex.com/atlas/organization'; value = "ORG-$IdPrefix-$($key.ToUpper())" })
    active = $true
    type = @(CC 'http://terminology.hl7.org/CodeSystem/organization-type' $type $typeDisp)
    name = $name
    address = @([ordered]@{ line = @('1 Atlas Medical Plaza'); city = 'Springfield'; state = 'IL'; postalCode = '62702' })
  })
}

$PRAC = @{}

function Prac($key, $given, $family, $suffix, $org, $taxCode, $taxDisp) {
  $PRAC[$key] = "$given $family, $suffix"
  Add ([ordered]@{
    resourceType = 'Practitioner'; id = (Id $key); meta = (Meta "$UC/us-core-practitioner$UCV")
    identifier = @([ordered]@{ system = 'https://parkerapex.com/atlas/practitioner'; value = "PRAC-$IdPrefix-$($key.ToUpper())" })
    active = $true
    name = @([ordered]@{ use = 'official'; family = $family; given = @($given); suffix = @($suffix) })
  })
  Add ([ordered]@{
    resourceType = 'PractitionerRole'; id = (Id "$key-role"); meta = (Meta "$UC/us-core-practitionerrole$UCV")
    active = $true
    practitioner = (Ref 'Practitioner' $key $PRAC[$key])
    organization = (Ref 'Organization' $org)
    specialty = @(CC $NUCC $taxCode $taxDisp)
  })
}

function Coverage($key, $payer, $typeCode, $typeDisp, $plan, $group, $start, $subscriberId = 'AHP-778-48-1978', $memberSuffix = '48') {
  Add ([ordered]@{
    resourceType = 'Coverage'; id = (Id $key); meta = (Meta "$UC/us-core-coverage$UCV")
    identifier = @([ordered]@{ type = (CC 'http://terminology.hl7.org/CodeSystem/v2-0203' 'MB' 'Member Number'); system = 'https://parkerapex.com/atlas/member'; value = "AHP-$($key.ToUpper())-$memberSuffix" })
    status = 'active'
    type = (CC 'http://terminology.hl7.org/CodeSystem/v3-ActCode' $typeCode $typeDisp)
    subscriber = (PatRef); subscriberId = $subscriberId
    beneficiary = (PatRef)
    relationship = (CC 'http://terminology.hl7.org/CodeSystem/subscriber-relationship' 'self' 'Self')
    period = [ordered]@{ start = $start }
    payor = @(Ref 'Organization' $payer)
    class = @(
      [ordered]@{ type = (CC 'http://terminology.hl7.org/CodeSystem/coverage-class' 'group' 'Group'); value = 'LEGION-VETS-01'; name = $group },
      [ordered]@{ type = (CC 'http://terminology.hl7.org/CodeSystem/coverage-class' 'plan' 'Plan'); value = $plan.ToUpper().Replace(' ', '-'); name = $plan })
  })
}

$CLASSES = @{ AMB = 'ambulatory'; EMER = 'emergency'; IMP = 'inpatient encounter'; VR = 'virtual' }

$ENC_TYPES = @{
  checkup = @('185349003', 'Encounter for check up'); consult = @('11429006', 'Consultation'); followup = @('390906007', 'Follow-up encounter')
  problem = @('185347001', 'Encounter for problem'); er = @('50849002', 'Emergency room admission'); admit = @('32485007', 'Hospital admission')
  tele = @('448337001', 'Telemedicine consultation with patient')
}

function Enc($key, $start, $end, $class, $type, $prac, $org, $reasons, $label) {
  $t = $ENC_TYPES[$type]
  $typeCC = CC $SCT $t[0] $t[1] $(if ($label) { $label } else { $t[1] })
  $r = [ordered]@{
    resourceType = 'Encounter'; id = (Id $key); meta = (Meta "$UC/us-core-encounter$UCV")
    identifier = @([ordered]@{ system = 'https://parkerapex.com/atlas/encounter'; value = (Id $key) })
    status = 'finished'
    class = (Coding 'http://terminology.hl7.org/CodeSystem/v3-ActCode' $class $CLASSES[$class])
    type = @($typeCC)
    subject = (PatRef)
    participant = @([ordered]@{ type = @(CC 'http://terminology.hl7.org/CodeSystem/v3-ParticipationType' 'PPRF' 'primary performer'); individual = (Ref 'Practitioner' $prac) })
    period = [ordered]@{ start = $start; end = $end }
    reasonReference = (Each $reasons { param($c) Ref 'Condition' $c })
    serviceProvider = (Ref 'Organization' $org)
  }
  if ($class -eq 'IMP') {
    $r.hospitalization = [ordered]@{
      admitSource = (CC 'http://terminology.hl7.org/CodeSystem/admit-source' 'emd' 'From accident/emergency department')
      dischargeDisposition = (CC 'http://terminology.hl7.org/CodeSystem/discharge-disposition' 'home' 'Home')
    }
  }
  Add $r
}

function Cond($key, $text, $sctCode, $sctDisp, $icdCode, $icdDisp, $onset, $enc, $status = 'active', $abated, $cat = 'problem-list-item') {
  $codings = @()
  if ($sctCode) { $codings += (Coding $SCT $sctCode $sctDisp) }
  $codings += (Coding $ICD $icdCode $icdDisp)
  $r = [ordered]@{
    resourceType = 'Condition'; id = (Id $key); meta = (Meta "$UC/us-core-condition-problems-health-concerns$UCV")
    clinicalStatus = (CC 'http://terminology.hl7.org/CodeSystem/condition-clinical' $status ((Get-Culture).TextInfo.ToTitleCase($status)))
    verificationStatus = (CC 'http://terminology.hl7.org/CodeSystem/condition-ver-status' 'confirmed' 'Confirmed')
    category = @(CC 'http://terminology.hl7.org/CodeSystem/condition-category' $cat $(if ($cat -eq 'encounter-diagnosis') { 'Encounter Diagnosis' } else { 'Problem List Item' }))
    code = [ordered]@{ coding = $codings; text = $text }
    subject = (PatRef)
    onsetDateTime = $onset
    recordedDate = $onset
  }
  if ($enc) { $r.encounter = (Ref 'Encounter' $enc) }
  if ($abated) { $r.abatementDateTime = $abated }
  Add $r
}

function Allergy($key, $code, $type, $category, $criticality, $onset, $manifest, $severity, $note) {
  Add ([ordered]@{
    resourceType = 'AllergyIntolerance'; id = (Id $key); meta = (Meta "$UC/us-core-allergyintolerance$UCV")
    clinicalStatus = (CC 'http://terminology.hl7.org/CodeSystem/allergyintolerance-clinical' 'active' 'Active')
    verificationStatus = (CC 'http://terminology.hl7.org/CodeSystem/allergyintolerance-verification' 'confirmed' 'Confirmed')
    type = $type; category = @($category); criticality = $criticality
    code = $code
    patient = (PatRef)
    onsetDateTime = $onset
    recordedDate = $onset
    reaction = @([ordered]@{ manifestation = @($manifest); severity = $severity; onset = $onset })
    note = (Each $note { param($t) [ordered]@{ text = $t } })
  })
}

$ROUTES = @{ oral = @('26643006', 'Oral route'); sc = @('34206005', 'Subcutaneous route'); inh = @('447694001', 'Respiratory tract route'); eye = @('54485002', 'Ophthalmic route'); top = @('6064005', 'Topical route'); sl = @('37839007', 'Sublingual route') }

function Med($key, $rxcui, $name, $route, $sig, $date, $status, $prac, $enc, $reasons, $qty, $unit, $doseVal, $doseUnit, $note, $prn) {
  $rt = $ROUTES[$route]
  $dose = [ordered]@{ text = $sig; route = (CC $SCT $rt[0] $rt[1]) }
  if ($prn) { $dose.asNeededBoolean = $true }
  if ($doseVal) { $dose.doseAndRate = @([ordered]@{ doseQuantity = [ordered]@{ value = $doseVal; unit = $doseUnit } }) }
  Add ([ordered]@{
    resourceType = 'MedicationRequest'; id = (Id $key); meta = (Meta "$UC/us-core-medicationrequest$UCV")
    status = $status; intent = 'order'
    category = @(CC 'http://terminology.hl7.org/CodeSystem/medicationrequest-category' 'community' 'Community')
    reportedBoolean = $false
    medicationCodeableConcept = (CC $RX $rxcui $name)
    subject = (PatRef)
    encounter = $(if ($enc) { Ref 'Encounter' $enc } else { $null })
    authoredOn = $date
    requester = (Ref 'Practitioner' $prac)
    reasonReference = (Each $reasons { param($c) Ref 'Condition' $c })
    dosageInstruction = @($dose)
    dispenseRequest = [ordered]@{ numberOfRepeatsAllowed = 3; quantity = [ordered]@{ value = $qty; unit = $unit } }
    note = (Each $note { param($t) [ordered]@{ text = $t } })
  })
}

function Immz($key, $cvxCode, $name, $date, $lot, $site, $prac) {
  Add ([ordered]@{
    resourceType = 'Immunization'; id = (Id $key); meta = (Meta "$UC/us-core-immunization$UCV")
    status = 'completed'
    vaccineCode = (CC $CVX $cvxCode $name)
    patient = (PatRef)
    occurrenceDateTime = $date
    primarySource = $true
    lotNumber = $lot
    site = (CC 'http://terminology.hl7.org/CodeSystem/v3-ActSite' $site $(if ($site -eq 'LA') { 'left arm' } else { 'right arm' }))
    route = (CC 'http://terminology.hl7.org/CodeSystem/v3-RouteOfAdministration' 'IM' 'Injection, intramuscular')
    performer = @([ordered]@{ actor = (Ref 'Practitioner' $prac) })
  })
}

$INTERP = 'http://terminology.hl7.org/CodeSystem/v3-ObservationInterpretation'

$FLAGS = @{ H = 'High'; L = 'Low'; N = 'Normal'; HH = 'Critical high' }

function Obs($o) {
  $cat = $o.cat
  $catDisp = @{ laboratory = 'Laboratory'; 'vital-signs' = 'Vital Signs'; exam = 'Exam'; survey = 'Survey'; 'social-history' = 'Social History'; imaging = 'Imaging' }[$cat]
  $profile = @{ laboratory = "$UC/us-core-observation-lab$UCV"; 'vital-signs' = "$UC/us-core-vital-signs$UCV"; survey = "$UC/us-core-observation-screening-assessment$UCV"; 'social-history' = "$UC/us-core-smokingstatus$UCV" }[$cat]
  if (-not $profile) { $profile = "$UC/us-core-simple-observation$UCV" }
  if ($o.profile) { $profile = $o.profile }
  $r = [ordered]@{
    resourceType = 'Observation'; id = (Id $o.k); meta = (Meta $profile)
    status = 'final'
    category = @(CC $OBSCAT $cat $catDisp)
    code = (CC $LOINC $o.code $o.disp $o.text)
    subject = (PatRef)
    encounter = (Ref 'Encounter' $o.e)
    effectiveDateTime = $o.date
    issued = $(if ($o.issued) { $o.issued } else { $null })
    performer = @(Ref $(if ($o.perfType) { $o.perfType } else { 'Organization' }) $o.perf)
  }
  if ($null -ne $o.v) { $r.valueQuantity = (Qty $o.v $o.u $o.ucum) }
  if ($o.vs) { $r.valueString = $o.vs }
  if ($o.vcc) { $r.valueCodeableConcept = $o.vcc }
  if ($o.comp) { $r.component = $o.comp }
  if ($o.site) { $r.bodySite = $o.site }
  if ($o.flag) { $r.interpretation = @(CC $INTERP $o.flag $FLAGS[$o.flag]) }
  if ($null -ne $o.lo -or $null -ne $o.hi) {
    $rr = [ordered]@{}
    if ($null -ne $o.lo) { $rr.low = (Qty $o.lo $o.u $o.ucum) }
    if ($null -ne $o.hi) { $rr.high = (Qty $o.hi $o.u $o.ucum) }
    $r.referenceRange = @($rr)
  }
  Add $r
  $o.k
}

function LabSet($prefix, $date, $issued, $enc, $rows) {
  Each $rows { param($row) Obs @{ k = "$prefix-$($row[0])"; cat = 'laboratory'; code = $row[0]; disp = $row[1]; v = $row[2]; u = $row[3]; lo = $row[4]; hi = $row[5]; flag = $row[6]; date = $date; issued = $issued; e = $enc; perf = 'org_lab' } }
}

function LabReport($key, $code, $disp, $date, $issued, $enc, $obsKeys, $requester) {
  Add ([ordered]@{
    resourceType = 'DiagnosticReport'; id = (Id $key); meta = (Meta "$UC/us-core-diagnosticreport-lab$UCV")
    status = 'final'
    category = @(CC 'http://terminology.hl7.org/CodeSystem/v2-0074' 'LAB' 'Laboratory')
    code = (CC $LOINC $code $disp)
    subject = (PatRef); encounter = (Ref 'Encounter' $enc)
    effectiveDateTime = $date; issued = $issued
    performer = @(Ref 'Organization' 'org_lab')
    resultsInterpreter = @(Ref 'Practitioner' 'pr_path')
    result = (Each $obsKeys { param($k) Ref 'Observation' $k })
  })
}

$CMP_NAMES = @{
  '2345-7' = 'Glucose [Mass/volume] in Serum or Plasma'; '3094-0' = 'Urea nitrogen [Mass/volume] in Serum or Plasma'; '2160-0' = 'Creatinine [Mass/volume] in Serum or Plasma'
  '98979-8' = 'Glomerular filtration rate [Volume Rate/Area] in Serum, Plasma or Blood by Creatinine-based formula (CKD-EPI 2021)/1.73 sq M'
  '2951-2' = 'Sodium [Moles/volume] in Serum or Plasma'; '2823-3' = 'Potassium [Moles/volume] in Serum or Plasma'; '2075-0' = 'Chloride [Moles/volume] in Serum or Plasma'
  '2028-9' = 'Carbon dioxide, total [Moles/volume] in Serum or Plasma'; '17861-6' = 'Calcium [Mass/volume] in Serum or Plasma'; '1751-7' = 'Albumin [Mass/volume] in Serum or Plasma'
  '2885-2' = 'Protein [Mass/volume] in Serum or Plasma'; '1742-6' = 'Alanine aminotransferase [Enzymatic activity/volume] in Serum or Plasma'
  '1920-8' = 'Aspartate aminotransferase [Enzymatic activity/volume] in Serum or Plasma'; '6768-6' = 'Alkaline phosphatase [Enzymatic activity/volume] in Serum or Plasma'; '1975-2' = 'Bilirubin.total [Mass/volume] in Serum or Plasma'
}

function Row($code, $v, $u, $lo, $hi, $flag, $disp) { if (-not $disp) { $disp = $CMP_NAMES[$code] }; , @($code, $disp, $v, $u, $lo, $hi, $flag) }

function Vitals($prefix, $date, $enc, $perfPrac, $v) {
  [void](Obs @{ k = "$prefix-bp"; cat = 'vital-signs'; code = '85354-9'; disp = 'Blood pressure panel with all children optional'; date = $date; e = $enc; perfType = 'Practitioner'; perf = $perfPrac; profile = "$UC/us-core-blood-pressure$UCV"
    comp = @(
      [ordered]@{ code = (CC $LOINC '8480-6' 'Systolic blood pressure'); valueQuantity = (Qty $v.sys 'mm[Hg]') },
      [ordered]@{ code = (CC $LOINC '8462-4' 'Diastolic blood pressure'); valueQuantity = (Qty $v.dia 'mm[Hg]') }) })
  $rows = @(
    @('hr', '8867-4', 'Heart rate', $v.hr, '/min', "$UC/us-core-heart-rate$UCV"),
    @('rr', '9279-1', 'Respiratory rate', $v.rr, '/min', "$UC/us-core-respiratory-rate$UCV"),
    @('temp', '8310-5', 'Body temperature', $v.temp, 'Cel', "$UC/us-core-body-temperature$UCV"),
    @('spo2', '59408-5', 'Oxygen saturation in Arterial blood by Pulse oximetry', $v.spo2, '%', "$UC/us-core-pulse-oximetry$UCV"),
    @('ht', '8302-2', 'Body height', $v.ht, 'cm', "$UC/us-core-body-height$UCV"),
    @('wt', '29463-7', 'Body weight', $v.wt, 'kg', "$UC/us-core-body-weight$UCV"),
    @('bmi', '39156-5', 'Body mass index (BMI) [Ratio]', $v.bmi, 'kg/m2', "$UC/us-core-bmi$UCV"))
  foreach ($row in $rows) {
    if ($null -eq $row[3]) { continue }
    [void](Obs @{ k = "$prefix-$($row[0])"; cat = 'vital-signs'; code = $row[1]; disp = $row[2]; v = $row[3]; u = $row[4]; date = $date; e = $enc; perfType = 'Practitioner'; perf = $perfPrac; profile = $row[5] })
  }
  if ($null -ne $v.pain) {
    [void](Obs @{ k = "$prefix-pain"; cat = 'survey'; code = '72514-3'; disp = 'Pain severity - 0-10 verbal numeric rating [Score] - Reported'; v = $v.pain; u = '{score}'; date = $date; e = $enc; perfType = 'Practitioner'; perf = $perfPrac })
  }
}

function Proc($key, $code, $date, $enc, $prac, $reasons, $site, $note, $end) {
  $r = [ordered]@{
    resourceType = 'Procedure'; id = (Id $key); meta = (Meta "$UC/us-core-procedure$UCV")
    status = 'completed'
    code = $code
    subject = (PatRef)
    encounter = (Ref 'Encounter' $enc)
    performer = @([ordered]@{ actor = (Ref 'Practitioner' $prac) })
    reasonReference = (Each $reasons { param($c) Ref 'Condition' $c })
    bodySite = (Each $site { param($s) $s })
    note = (Each $note { param($t) [ordered]@{ text = $t } })
  }
  if ($end) { $r.performedPeriod = [ordered]@{ start = $date; end = $end } } else { $r.performedDateTime = $date }
  Add $r
}

$TOOTH = 'http://terminology.hl7.org/CodeSystem/ex-tooth'

$SOP = @{ MR = '1.2.840.10008.5.1.4.1.1.4'; DX = '1.2.840.10008.5.1.4.1.1.1.1'; XA = '1.2.840.10008.5.1.4.1.1.12.1'; US = '1.2.840.10008.5.1.4.1.1.6.1'; OPT = '1.2.840.10008.5.1.4.1.1.77.1.5.4'; PX = '1.2.840.10008.5.1.4.1.1.1.1'; XC = '1.2.840.10008.5.1.4.1.1.77.1.4' }

$MODALITY = @{ MR = 'Magnetic Resonance'; DX = 'Digital Radiography'; XA = 'X-Ray Angiography'; US = 'Ultrasound'; OPT = 'Ophthalmic Tomography'; PX = 'Panoramic X-Ray'; XC = 'External-camera Photography' }

function Study($key, $started, $enc, $sr, $referrer, $interpreter, $proc, $reasons, $desc, $mod, $bodySite, $bodyDisp, $seriesTitles) {
  $ctr = @{ n = 0 }
  $series = Each $seriesTitles { param($s)
    $ctr.n++; $n = $ctr.n
    $titles = $s.Split('|')
    $inst = @{ j = 0 }
    [ordered]@{
      uid = (DicomUid "$key|$n"); number = $n
      modality = (Coding $DCM $mod $MODALITY[$mod])
      description = $titles[0]
      numberOfInstances = $titles.Count - 1
      bodySite = (Coding $SCT $bodySite $bodyDisp)
      started = $started
      instance = (Each ($titles | Select-Object -Skip 1) { param($t) $inst.j++; [ordered]@{ uid = (DicomUid "$key|$n|$($inst.j)"); sopClass = [ordered]@{ system = 'urn:ietf:rfc:3986'; code = "urn:oid:$($SOP[$mod])" }; number = $inst.j; title = $t } })
    }
  }
  $images = 0; foreach ($s in $series) { $images += $s.numberOfInstances }
  Add ([ordered]@{
    resourceType = 'ImagingStudy'; id = (Id $key); meta = (Meta $null)
    identifier = @([ordered]@{ system = 'urn:dicom:uid'; value = "urn:oid:$(DicomUid "$key|study")" })
    status = 'available'
    modality = @(Coding $DCM $mod $MODALITY[$mod])
    subject = (PatRef); encounter = (Ref 'Encounter' $enc)
    started = $started
    basedOn = (Each $sr { param($s) Ref 'ServiceRequest' $s })
    referrer = (Ref 'Practitioner' $referrer)
    interpreter = @(Ref 'Practitioner' $interpreter)
    numberOfSeries = $series.Count; numberOfInstances = $images
    procedureCode = @($proc)
    reasonReference = (Each $reasons { param($c) Ref 'Condition' $c })
    description = $desc
    series = $series
  })
}

$DOC_CAT = 'http://hl7.org/fhir/us/core/CodeSystem/us-core-documentreference-category'

$REPORT_CATS = @{ rad = @('LP29684-5', 'Radiology'); card = @('LP29708-2', 'Cardiology'); path = @('LP7839-6', 'Pathology') }

function DocRef($key, $dateTime, $type, $categories, $author, $org, $enc, $title, $attachment, $related) {
  $ctx = [ordered]@{ encounter = @(Ref 'Encounter' $enc); period = [ordered]@{ start = $dateTime.Substring(0, 10); end = $dateTime.Substring(0, 10) } }
  if ($related) { $ctx.related = @($related) }
  Add ([ordered]@{
    resourceType = 'DocumentReference'; id = (Id $key); meta = (Meta "$UC/us-core-documentreference$UCV")
    identifier = @([ordered]@{ system = 'urn:ietf:rfc:3986'; value = "urn:uuid:$(Id $key)" })
    status = 'current'; docStatus = 'final'
    type = $type; category = @($categories)
    subject = (PatRef); date = $dateTime
    author = @(Ref 'Practitioner' $author)
    custodian = (Ref 'Organization' $org)
    description = $title
    content = @([ordered]@{ attachment = $attachment; format = (Coding 'http://ihe.net/fhir/ihe.formatcode.fhir/CodeSystem/formatcode' 'urn:ihe:iti:xds:2017:mimeTypeSufficient' 'mimeType Sufficient') })
    context = $ctx
  })
}

function Report($key, $kind, $code, $date, $issued, $enc, $sr, $studies, $prac, $org, $title, $conclusion, $results, $text) {
  $att = Attach "bin_$key" $text $title $issued
  $cat = $REPORT_CATS[$kind]
  DocRef "doc_$key" $issued $code @((CC $DOC_CAT 'clinical-note' 'Clinical Note'), (CC $LOINC $cat[0] $cat[1])) $prac $org $enc $title $att (Ref 'DiagnosticReport' $key)
  Add ([ordered]@{
    resourceType = 'DiagnosticReport'; id = (Id $key); meta = (Meta "$UC/us-core-diagnosticreport-note$UCV")
    basedOn = (Each $sr { param($s) Ref 'ServiceRequest' $s })
    status = 'final'
    category = @(CC $LOINC $cat[0] $cat[1])
    code = $code
    subject = (PatRef); encounter = (Ref 'Encounter' $enc)
    effectiveDateTime = $date; issued = $issued
    performer = @((Ref 'Practitioner' $prac), (Ref 'Organization' $org))
    resultsInterpreter = @(Ref 'Practitioner' $prac)
    result = (Each $results { param($k) Ref 'Observation' $k })
    imagingStudy = (Each $studies { param($s) Ref 'ImagingStudy' $s })
    conclusion = $conclusion
    presentedForm = @($att)
  })
}

$IMG = { param($text) CC $LOINC '18748-4' 'Diagnostic imaging study' $text }

function Note($key, $dateTime, $code, $disp, $author, $org, $enc, $title, $text) {
  $att = Attach "bin_$key" $text $title $dateTime
  DocRef $key $dateTime (CC $LOINC $code $disp) @(CC $DOC_CAT 'clinical-note' 'Clinical Note') $author $org $enc $title $att $null
}

$CAT_REF = @('3457005', 'Patient referral')

$CAT_IMG = @('363679005', 'Imaging')

$CAT_EDU = @('409073007', 'Education')

function SR($key, $date, $status, $cat, $code, $requester, $performers, $enc, $reasons, $note, $priority = 'routine') {
  Add ([ordered]@{
    resourceType = 'ServiceRequest'; id = (Id $key); meta = (Meta "$UC/us-core-servicerequest$UCV")
    identifier = @([ordered]@{ system = 'https://parkerapex.com/atlas/order'; value = "ORD-$($date -replace '-', '')-$($key.ToUpper())" })
    status = $status; intent = 'order'
    category = @(CC $SCT $cat[0] $cat[1])
    priority = $priority
    code = $code
    subject = (PatRef)
    encounter = (Ref 'Encounter' $enc)
    authoredOn = $date
    requester = (Ref 'Practitioner' $requester)
    performer = (Each $performers { param($p) $p })
    reasonReference = (Each $reasons { param($c) Ref 'Condition' $c })
    note = (Each $note { param($t) [ordered]@{ text = $t } })
  })
}

$REFER = { param($text) CC $SCT '103696004' 'Patient referral to specialist (procedure)' $text }

$ADJ = 'http://terminology.hl7.org/CodeSystem/adjudication'

function Adj($sys, $code, $disp, $amt) { [ordered]@{ category = [ordered]@{ coding = @(Coding $sys $code $disp) }; amount = (Money $amt) } }

$PROFILES = @{
  professional = 'C4BB-ExplanationOfBenefit-Professional-NonClinician'; institutional = 'C4BB-ExplanationOfBenefit-Inpatient-Institutional'
  pharmacy = 'C4BB-ExplanationOfBenefit-Pharmacy'; oral = 'C4BB-ExplanationOfBenefit-Oral'
}

function Eob($c) {
  $kind = $c.kind
  $ctr = @{ i = 0; j = 0; s = 0; n = 0 }
  $care = Each $c.care { param($p) $ctr.i++; [ordered]@{ sequence = $ctr.i; provider = (Ref $p[0] $p[1]); role = (CC "$C4BB/C4BBClaimCareTeamRole" $p[2] $p[3]) } }
  $dx = Each $c.dx { param($d)
    $ctr.j++
    $type = if ($ctr.j -eq 1) { Coding 'http://terminology.hl7.org/CodeSystem/ex-diagnosistype' 'principal' 'Principal Diagnosis' } elseif ($kind -eq 'institutional') { Coding "$C4BB/C4BBClaimDiagnosisType" 'other' 'Other' } else { Coding "$C4BB/C4BBClaimDiagnosisType" 'secondary' 'Secondary' }
    [ordered]@{ sequence = $ctr.j; diagnosisCodeableConcept = (CC $ICD $d.c $d.d); type = @([ordered]@{ coding = @($type) }) }
  }
  $info = New-Object System.Collections.ArrayList
  [void]$info.Add([ordered]@{ category = (CC "$C4BB/C4BBSupportingInfoType" 'billingnetworkcontractingstatus' 'Billing Network Contracting Status'); code = (CC "$C4BB/C4BBPayerProviderContractingStatus" 'contracted' 'Contracted') })
  [void]$info.Add([ordered]@{ category = (CC "$C4BB/C4BBSupportingInfoType" 'clmrecvddate' 'Claim Received Date'); timingDate = $c.received })
  foreach ($x in @($c.info)) { if ($x) { [void]$info.Add($x) } }
  $info = Each $info { param($x) $ctr.s++; $x.Insert(0, 'sequence', $ctr.s); $x }
  $tot = @{ sub = [decimal]0; elig = [decimal]0; prov = [decimal]0; pt = [decimal]0 }
  $items = Each $c.lines { param($l)
    $ctr.n++
    $allowed = [decimal]$l.allowed; $pt = [decimal]$l.pt; $paid = $allowed - $pt
    $tot.sub += [decimal]$l.charge; $tot.elig += $allowed; $tot.prov += $paid; $tot.pt += $pt
    $it = [ordered]@{ sequence = $ctr.n; careTeamSequence = @(1) }
    if ($c.dx) { $it.diagnosisSequence = @(1) }
    if ($l.rev) { $it.revenue = (CC 'https://www.nubc.org/CodeSystem/RevenueCodes' $l.rev $l.revDisp) }
    $it.productOrService = (CC $l.sys $l.code $l.disp)
    if ($l.mod) { $it.modifier = @(CC $CPT $l.mod $l.modDisp) }
    $it.servicedDate = $(if ($l.date) { $l.date } else { $c.start })
    if ($c.pos) { $it.locationCodeableConcept = (CC $POS $c.pos $c.posDisp) }
    $it.quantity = $(if ($l.qty) { [ordered]@{ value = $l.qty; unit = $l.unit } } else { [ordered]@{ value = 1 } })
    if ($l.tooth) { $it.bodySite = (CC 'http://terminology.hl7.org/CodeSystem/ex-tooth' $l.tooth $l.toothDisp) }
    if ($l.surface) { $it.subSite = @(CC 'http://terminology.hl7.org/CodeSystem/ex-surface' $l.surface $l.surfaceDisp) }
    if ($c.enc) { $it.encounter = @(Ref 'Encounter' $c.enc) }
    $it.adjudication = @(
      (Adj $ADJ 'submitted' 'Submitted Amount' $l.charge),
      (Adj $ADJ 'eligible' 'Eligible Amount' $allowed),
      (Adj "$C4BB/C4BBAdjudication" 'paidtoprovider' 'Paid to provider' $paid),
      (Adj "$C4BB/C4BBAdjudication" 'paidbypatient' 'Paid by patient' $pt),
      [ordered]@{ category = [ordered]@{ coding = @(Coding "$C4BB/C4BBAdjudicationDiscriminator" 'inoutnetwork' 'In or Out of Network') }; reason = [ordered]@{ coding = @(Coding "$C4BB/C4BBPayerAdjudicationStatus" 'innetwork' 'In Network') } })
    $it
  }
  $r = [ordered]@{
    resourceType = 'ExplanationOfBenefit'; id = (Id $c.k); meta = (Meta "$C4BBSD/$($PROFILES[$kind])|2.0.0")
    identifier = @([ordered]@{ type = (CC "$C4BB/C4BBIdentifierType" 'uc' 'Unique Claim ID'); system = 'https://parkerapex.com/atlas/claim'; value = "CLM-$($c.start -replace '-', '')-$($c.k.ToUpper())" })
    status = 'active'
    type = (CC 'http://terminology.hl7.org/CodeSystem/claim-type' $(if ($kind -eq 'oral') { 'oral' } else { $kind }) $(if ($kind -eq 'oral') { 'Oral' } else { (Get-Culture).TextInfo.ToTitleCase($kind) }))
    use = 'claim'
    patient = (PatRef)
    billablePeriod = [ordered]@{ start = $c.start; end = $(if ($c.end) { $c.end } else { $c.start }) }
    created = "$($c.received)T00:00:00$TZ"
    insurer = (Ref 'Organization' $c.payer)
    provider = (Ref 'Organization' $c.billing)
    outcome = 'complete'
    careTeam = $care
    supportingInfo = $info
    diagnosis = $dx
    procedure = (Each $c.pcs { param($p) [ordered]@{ sequence = 1; type = @(CC 'http://terminology.hl7.org/CodeSystem/ex-proceduretype' 'primary' 'Primary procedure'); date = $c.start; procedureCodeableConcept = (CC $PCS $p.c $p.d) } })
    insurance = @([ordered]@{ focal = $true; coverage = (Ref 'Coverage' $c.cov) })
    item = $items
    total = @(
      (Adj $ADJ 'submitted' 'Submitted Amount' $tot.sub), (Adj $ADJ 'eligible' 'Eligible Amount' $tot.elig),
      (Adj "$C4BB/C4BBAdjudication" 'paidtoprovider' 'Paid to provider' $tot.prov), (Adj "$C4BB/C4BBAdjudication" 'paidbypatient' 'Paid by patient' $tot.pt))
    payment = [ordered]@{ type = (CC 'http://terminology.hl7.org/CodeSystem/ex-paymenttype' 'complete' 'Complete'); date = $c.paid; amount = (Money $tot.prov) }
  }
  Add $r
}

function CareRef($prac, $role = 'rendering', $disp = 'Rendering provider') { , @('Practitioner', $prac, $role, $disp) }

function Dx($code, $disp) { @{ c = $code; d = $disp } }

function Line($sys, $code, $disp, $charge, $allowed, $pt, $extra) { $l = @{ sys = $sys; code = $code; disp = $disp; charge = $charge; allowed = $allowed; pt = $pt }; if ($extra) { foreach ($k in $extra.Keys) { $l[$k] = $extra[$k] } }; $l }

function Pro($k, $start, $received, $paid, $billing, $prac, $enc, $dx, $lines, $pos = '11', $posDisp = 'Office', $referring, $payer = 'payer_med', $cov = 'cov_med') {
  $care = @(CareRef $prac)
  if ($referring) { $care += , @('Practitioner', $referring, 'referring', 'Referring') }
  Eob @{ k = $k; kind = 'professional'; start = $start; received = $received; paid = $paid; payer = $payer; billing = $billing; cov = $cov; enc = $enc; care = $care; dx = $dx; lines = $lines; pos = $pos; posDisp = $posDisp }
}
