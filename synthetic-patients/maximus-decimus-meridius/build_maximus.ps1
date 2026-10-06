# Builds synthetic patient Maximus Decimus Meridius (48 M): a dense,
# internally consistent record covering every M5 category, plus hearing,
# dermatology, dental and vision care. All data is fictional (tagged HTEST).
# Codes were checked against RxNav, NLM Clinical Tables (LOINC, ICD-10-CM) and
# tx.fhir.org (SNOMED CT, CVX, ICD-10-PCS, v3-ActCode).
param(
  [string]$Output = (Join-Path $PSScriptRoot 'maximus-decimus-meridius.json'),
  [string]$FhirBase = 'https://hapi.fhir.org/baseR4'
)
$ErrorActionPreference = 'Stop'
$PatId = 'MDM-SYN-0000000048-1'
$Base = $FhirBase
. (Join-Path $PSScriptRoot '..\lib\FhirBuilders.ps1')
. (Join-Path $PSScriptRoot '..\lib\ClinicalBuilders.ps1')

# foreach that never runs on $null and always returns an array

$HDR = "Patient: Maximus Decimus Meridius    DOB: 03/15/1978    MRN: $PatId"

# =====================================================================
# Patient and related people
# =====================================================================
Add ([ordered]@{
  resourceType = 'Patient'; id = $PatId; meta = (Meta "$UC/us-core-patient$UCV")
  extension = @(
    [ordered]@{ url = "$UC/us-core-race"; extension = @(
      [ordered]@{ url = 'ombCategory'; valueCoding = (Coding 'urn:oid:2.16.840.1.113883.6.238' '2106-3' 'White') },
      [ordered]@{ url = 'text'; valueString = 'White' }) },
    [ordered]@{ url = "$UC/us-core-ethnicity"; extension = @(
      [ordered]@{ url = 'ombCategory'; valueCoding = (Coding 'urn:oid:2.16.840.1.113883.6.238' '2186-5' 'Not Hispanic or Latino') },
      [ordered]@{ url = 'text'; valueString = 'Not Hispanic or Latino' }) },
    [ordered]@{ url = "$UC/us-core-birthsex"; valueCode = 'M' }
  )
  identifier = @([ordered]@{ use = 'usual'; type = (CC 'http://terminology.hl7.org/CodeSystem/v2-0203' 'MR' 'Medical record number'); system = 'https://parkerapex.com/atlas/mrn'; value = $PatId })
  active = $true
  name = @([ordered]@{ use = 'official'; family = 'Meridius'; given = @('Maximus', 'Decimus') })
  telecom = @(
    [ordered]@{ system = 'phone'; value = '555-0148'; use = 'mobile' },
    [ordered]@{ system = 'email'; value = 'maximus.meridius@example.org'; use = 'home' })
  gender = 'male'
  birthDate = '1978-03-15'
  address = @([ordered]@{ use = 'home'; line = @('180 Legion Way'); city = 'Springfield'; state = 'IL'; postalCode = '62701'; country = 'US' })
  maritalStatus = (CC 'http://terminology.hl7.org/CodeSystem/v3-MaritalStatus' 'W' 'Widowed')
  communication = @([ordered]@{ language = (CC 'urn:ietf:bcp:47' 'en-US' 'English (United States)'); preferred = $true })
})

function RelPerson($key, $given, $family, $relCode, $relDisp, $phone, $extraRel) {
  $rels = @(CC 'http://terminology.hl7.org/CodeSystem/v3-RoleCode' $relCode $relDisp)
  if ($extraRel) { $rels += $extraRel }
  Add ([ordered]@{
    resourceType = 'RelatedPerson'; id = (Id $key); meta = (Meta "$UC/us-core-relatedperson$UCV")
    active = $true; patient = (PatRef)
    relationship = $rels
    name = @([ordered]@{ family = $family; given = @($given) })
    telecom = @([ordered]@{ system = 'phone'; value = $phone; use = 'mobile' })
    address = @([ordered]@{ line = @('22 Aurelian Court'); city = 'Springfield'; state = 'IL'; postalCode = '62704' })
  })
}
RelPerson 'rp_sister' 'Lucilla' 'Meridius' 'SIS' 'sister' '555-0172' (CC 'http://terminology.hl7.org/CodeSystem/v3-RoleCode' 'POWATT' 'power of attorney')
RelPerson 'rp_friend' 'Juba' 'Numidianus' 'FRND' 'unrelated friend' '555-0190' (CC 'http://terminology.hl7.org/CodeSystem/v2-0131' 'C' 'Emergency Contact')

# =====================================================================
# Organizations, practitioners, roles
# =====================================================================

Org 'org_pcp' 'Atlas Community Primary Care'
Org 'org_hosp' 'Atlas General Hospital'
Org 'org_cards' 'Atlas Heart & Vascular'
Org 'org_sleep' 'Atlas Sleep Center'
Org 'org_pain' 'Atlas Spine & Pain'
Org 'org_derm' 'Atlas Dermatology & Mohs Surgery'
Org 'org_aud' 'Atlas Hearing & Audiology'
Org 'org_eye' 'Atlas Eye & Retina Center'
Org 'org_dental' 'Atlas Family Dental'
Org 'org_perio' 'Atlas Periodontics'
Org 'org_bh' 'Atlas Behavioral Health'
Org 'org_gi' 'Atlas Digestive Health'
Org 'org_lab' 'Atlas Reference Laboratory'
Org 'org_img' 'Atlas Imaging Center'
Org 'org_pharm' 'Atlas Pharmacy'
Org 'payer_med' 'Atlas Health Plan' 'pay' 'Payer'
Org 'payer_dental' 'Atlas Dental Plan' 'pay' 'Payer'
Org 'payer_vision' 'Atlas Vision Plan' 'pay' 'Payer'

Prac 'pr_pcp' 'Helena' 'Ortiz' 'MD' 'org_pcp' '207R00000X' 'Internal Medicine'
Prac 'pr_ed' 'Priya' 'Raman' 'MD' 'org_hosp' '207P00000X' 'Emergency Medicine'
Prac 'pr_hosp' 'Samuel' 'Okafor' 'MD' 'org_hosp' '208M00000X' 'Hospitalist'
Prac 'pr_icard' 'Elena' 'Vasquez' 'MD' 'org_cards' '207RI0011X' 'Interventional Cardiology'
Prac 'pr_cards' 'Marcus' 'Chen' 'MD' 'org_cards' '207RC0000X' 'Cardiovascular Disease'
Prac 'pr_sleep' 'Aaron' 'Feld' 'MD' 'org_sleep' '207RP1001X' 'Pulmonary Disease'
Prac 'pr_pain' 'Victor' 'Hale' 'MD' 'org_pain' '208VP0014X' 'Interventional Pain Medicine'
Prac 'pr_derm' 'Naomi' 'Blake' 'MD' 'org_derm' '207N00000X' 'Dermatology'
Prac 'pr_path' 'Laura' 'Kim' 'MD' 'org_lab' '207ZP0102X' 'Anatomic & Clinical Pathology'
Prac 'pr_aud' 'Jordan' 'Lee' 'AuD' 'org_aud' '231H00000X' 'Audiologist'
Prac 'pr_ophth' 'Rajiv' 'Mehta' 'MD' 'org_eye' '207W00000X' 'Ophthalmology'
Prac 'pr_od' 'Claire' 'Dubois' 'OD' 'org_eye' '152W00000X' 'Optometrist'
Prac 'pr_dds' 'Sofia' 'Marin' 'DDS' 'org_dental' '1223G0001X' 'General Practice Dentistry'
Prac 'pr_perio' 'Tomas' 'Reyes' 'DDS' 'org_perio' '1223P0300X' 'Periodontics'
Prac 'pr_psych' 'Grace' 'Holloway' 'PhD' 'org_bh' '103T00000X' 'Psychologist'
Prac 'pr_gi' 'Ben' 'Adler' 'MD' 'org_gi' '207RG0100X' 'Gastroenterology'
Prac 'pr_rad' 'Thomas' 'Nguyen' 'MD' 'org_img' '2085R0202X' 'Diagnostic Radiology'
Prac 'pr_rn' 'Maria' 'Santos' 'RN' 'org_pcp' '163W00000X' 'Registered Nurse'

# =====================================================================
# Coverage: medical, dental, vision
# =====================================================================

Coverage 'cov_med' 'payer_med' 'PPO' 'preferred provider organization policy' 'Atlas Health PPO Gold' 'Legion Veterans Cooperative' '2020-01-01'
Coverage 'cov_dental' 'payer_dental' 'DENTAL' 'dental care policy' 'Atlas Dental PPO' 'Legion Veterans Cooperative' '2020-01-01'
Coverage 'cov_vision' 'payer_vision' 'VISPOL' 'vision care policy' 'Atlas Vision Plus' 'Legion Veterans Cooperative' '2020-01-01'

# =====================================================================
# Encounters
# =====================================================================

Enc 'e_bh18' (Ts '2018-04-10' '10:00') (Ts '2018-04-10' '11:00') 'AMB' 'consult' 'pr_psych' 'org_bh' @('c_ptsd') 'Behavioral health intake'
Enc 'e_psg19' (Ts '2019-05-20' '21:00') (Ts '2019-05-21' '06:00') 'AMB' 'problem' 'pr_sleep' 'org_sleep' @('c_osa') 'Overnight sleep study'
Enc 'e_pcp22' (Ts '2022-08-30' '09:00') (Ts '2022-08-30' '09:40') 'AMB' 'problem' 'pr_pcp' 'org_pcp' @('c_disc') 'Office visit: low back pain'
Enc 'e_mri22' (Ts '2022-09-14' '13:00') (Ts '2022-09-14' '13:45') 'AMB' 'problem' 'pr_rad' 'org_img' @('c_disc') 'Imaging: MRI lumbar spine'
Enc 'e_esi22' (Ts '2022-10-20' '08:00') (Ts '2022-10-20' '09:00') 'AMB' 'problem' 'pr_pain' 'org_pain' @('c_disc') 'Lumbar epidural steroid injection'
Enc 'e_spiro23' (Ts '2023-02-14' '10:00') (Ts '2023-02-14' '10:45') 'AMB' 'problem' 'pr_pcp' 'org_pcp' @('c_copd') 'Office visit: dyspnea, spirometry'
Enc 'e_ed24' (Ts '2024-03-02' '05:42') (Ts '2024-03-02' '09:15') 'EMER' 'er' 'pr_ed' 'org_hosp' @('c_nstemi') 'Emergency department visit: chest pain'
Enc 'e_ip24' (Ts '2024-03-02' '09:15') (Ts '2024-03-05' '14:00') 'IMP' 'admit' 'pr_hosp' 'org_hosp' @('c_nstemi', 'c_cad') 'Inpatient admission: NSTEMI'
Enc 'e_card24' (Ts '2024-04-09' '14:00') (Ts '2024-04-09' '14:40') 'AMB' 'followup' 'pr_cards' 'org_cards' @('c_cad') 'Cardiology follow-up'
Enc 'e_aud24' (Ts '2024-07-15' '09:00') (Ts '2024-07-15' '10:00') 'AMB' 'consult' 'pr_aud' 'org_aud' @('c_snhl') 'Audiology evaluation'
Enc 'e_had24' (Ts '2024-08-12' '15:00') (Ts '2024-08-12' '16:00') 'AMB' 'problem' 'pr_aud' 'org_aud' @('c_snhl') 'Hearing aid fitting'
Enc 'e_colo24' (Ts '2024-11-18' '07:30') (Ts '2024-11-18' '09:00') 'AMB' 'problem' 'pr_gi' 'org_gi' @() 'Screening colonoscopy'
Enc 'e_eye25' (Ts '2025-01-20' '10:00') (Ts '2025-01-20' '11:15') 'AMB' 'consult' 'pr_ophth' 'org_eye' @('c_poag') 'Ophthalmology consultation: glaucoma'
Enc 'e_derm25' (Ts '2025-05-12' '11:00') (Ts '2025-05-12' '11:30') 'AMB' 'consult' 'pr_derm' 'org_derm' @('c_psor') 'Dermatology consultation: skin lesion'
Enc 'e_mohs25' (Ts '2025-06-02' '08:00') (Ts '2025-06-02' '12:00') 'AMB' 'problem' 'pr_derm' 'org_derm' @('c_bcc') 'Mohs surgery'
Enc 'e_dent26a' (Ts '2026-02-11' '08:00') (Ts '2026-02-11' '09:30') 'AMB' 'checkup' 'pr_dds' 'org_dental' @('c_perio') 'Dental examination'
Enc 'e_dent26b' (Ts '2026-02-25' '08:00') (Ts '2026-02-25' '10:00') 'AMB' 'problem' 'pr_perio' 'org_perio' @('c_perio') 'Periodontal scaling and root planing'
Enc 'e_dent26c' (Ts '2026-03-04' '14:00') (Ts '2026-03-04' '14:45') 'AMB' 'problem' 'pr_dds' 'org_dental' @('c_caries') 'Dental extraction'
Enc 'e_derm26' (Ts '2026-04-07' '09:30') (Ts '2026-04-07' '10:00') 'AMB' 'followup' 'pr_derm' 'org_derm' @('c_ak', 'c_psor') 'Dermatology follow-up: skin check'
Enc 'e_aud26' (Ts '2026-06-10' '13:00') (Ts '2026-06-10' '14:00') 'AMB' 'followup' 'pr_aud' 'org_aud' @('c_snhl') 'Audiology follow-up'
Enc 'e_eye26' (Ts '2026-07-14' '09:00') (Ts '2026-07-14' '10:30') 'AMB' 'followup' 'pr_od' 'org_eye' @('c_poag', 'c_myopia') 'Eye exam: glaucoma follow-up and refraction'
Enc 'e_bh26' (Ts '2026-07-22' '16:00') (Ts '2026-07-22' '17:00') 'VR' 'tele' 'pr_psych' 'org_bh' @('c_ptsd', 'c_mdd') 'Video visit: psychotherapy'
Enc 'e_dent26d' (Ts '2026-08-12' '08:00') (Ts '2026-08-12' '10:30') 'AMB' 'problem' 'pr_dds' 'org_dental' @('c_perio', 'c_caries') 'Periodontal maintenance and restorations'
Enc 'e_pcp26' (Ts '2026-08-24' '08:30') (Ts '2026-08-24' '09:30') 'AMB' 'checkup' 'pr_pcp' 'org_pcp' @('c_dm', 'c_htn', 'c_ckd') 'Annual physical and chronic care'
Enc 'e_card26' (Ts '2026-09-15' '10:00') (Ts '2026-09-15' '10:40') 'AMB' 'followup' 'pr_cards' 'org_cards' @('c_cad') 'Cardiology follow-up'

# =====================================================================
# Conditions (SNOMED where verified, plus ICD-10-CM)
# =====================================================================

Cond 'c_htn' 'Essential hypertension' '59621000' 'Essential hypertension' 'I10' 'Essential (primary) hypertension' '2012-06-18'
Cond 'c_dm' 'Type 2 diabetes mellitus with diabetic polyneuropathy' '44054006' 'Type 2 diabetes mellitus' 'E11.42' 'Type 2 diabetes mellitus with diabetic polyneuropathy' '2015-02-09'
Cond 'c_lipid' 'Hyperlipidemia' '55822004' 'Hyperlipidemia' 'E78.5' 'Hyperlipidemia, unspecified' '2016-03-21'
Cond 'c_ptsd' 'Post-traumatic stress disorder' '47505003' 'Posttraumatic stress disorder' 'F43.10' 'Post-traumatic stress disorder, unspecified' '2018-04-10' 'e_bh18'
Cond 'c_mdd' 'Major depressive disorder, recurrent, moderate' '35489007' 'Depressive disorder' 'F33.1' 'Major depressive disorder, recurrent, moderate' '2019-01-15'
Cond 'c_osa' 'Obstructive sleep apnea' '78275009' 'Obstructive sleep apnea syndrome' 'G47.33' 'Obstructive sleep apnea (adult) (pediatric)' '2019-05-21' 'e_psg19'
Cond 'c_gerd' 'Gastroesophageal reflux disease' '235595009' 'Gastroesophageal reflux disease' 'K21.9' 'Gastro-esophageal reflux disease without esophagitis' '2020-02-03'
Cond 'c_psor' 'Psoriasis vulgaris' '9014002' 'Psoriasis' 'L40.0' 'Psoriasis vulgaris' '2021-05-11'
Cond 'c_disc' 'Lumbar disc herniation with radiculopathy' '128196005' 'Lumbar radiculopathy' 'M51.16' 'Intervertebral disc disorders with radiculopathy, lumbar region' '2022-08-30' 'e_pcp22'
Cond 'c_copd' 'Chronic obstructive pulmonary disease' '13645005' 'Chronic obstructive pulmonary disease' 'J44.9' 'Chronic obstructive pulmonary disease, unspecified' '2023-02-14' 'e_spiro23'
Cond 'c_gout' 'Chronic gout without tophus' '90560007' 'Gout' 'M1A.9XX0' 'Chronic gout, unspecified, without tophus (tophi)' '2023-07-06'
Cond 'c_nstemi' 'Acute NSTEMI (resolved)' '401314000' 'Acute non-ST segment elevation myocardial infarction' 'I21.4' 'Non-ST elevation (NSTEMI) myocardial infarction' '2024-03-02' 'e_ed24' 'resolved' '2024-04-01' 'encounter-diagnosis'
Cond 'c_oldmi' 'History of myocardial infarction' '399211009' 'History of myocardial infarction' 'I25.2' 'Old myocardial infarction' '2024-04-09' 'e_card24'
Cond 'c_cad' 'Coronary artery disease, status post drug-eluting stent' '53741008' 'Coronary arteriosclerosis' 'I25.10' 'Atherosclerotic heart disease of native coronary artery without angina pectoris' '2024-03-03' 'e_ip24'
Cond 'c_snhl' 'Noise-induced sensorineural hearing loss, bilateral' '60700002' 'Sensorineural hearing loss' 'H90.3' 'Sensorineural hearing loss, bilateral' '2024-07-15' 'e_aud24'
Cond 'c_tinn' 'Tinnitus, bilateral' '60862001' 'Tinnitus' 'H93.13' 'Tinnitus, bilateral' '2024-07-15' 'e_aud24'
Cond 'c_poag' 'Primary open-angle glaucoma, bilateral, mild stage' '77075001' 'Primary open angle glaucoma' 'H40.1131' 'Primary open-angle glaucoma, bilateral, mild stage' '2025-01-20' 'e_eye25'
Cond 'c_myopia' 'Myopia, bilateral' '57190000' 'Myopia' 'H52.13' 'Myopia, bilateral' '2010-05-01'
Cond 'c_presby' 'Presbyopia' $null $null 'H52.4' 'Presbyopia' '2024-01-10'
Cond 'c_bcc' 'Basal cell carcinoma of skin of nose (excised)' '254701007' 'Basal cell carcinoma of skin' 'C44.311' 'Basal cell carcinoma of skin of nose' '2025-05-12' 'e_derm25' 'resolved' '2025-06-02'
Cond 'c_ak' 'Actinic keratosis' '201101007' 'Actinic keratosis' 'L57.0' 'Actinic keratosis' '2026-04-07' 'e_derm26'
Cond 'c_ckd' 'Chronic kidney disease stage 3a' '700378005' 'Chronic kidney disease stage 3A' 'N18.31' 'Chronic kidney disease, stage 3a' '2025-09-08'
Cond 'c_obesity' 'Morbid obesity, BMI 36' '238136002' 'Morbid obesity' 'E66.01' 'Morbid (severe) obesity due to excess calories' '2014-01-01'
Cond 'c_vitd' 'Vitamin D deficiency' '34713006' 'Vitamin D deficiency' 'E55.9' 'Vitamin D deficiency, unspecified' '2026-08-24' 'e_pcp26'
Cond 'c_nafld' 'Nonalcoholic fatty liver disease' '197315008' 'Non-alcoholic fatty liver' 'K76.0' 'Fatty (change of) liver, not elsewhere classified' '2024-03-04' 'e_ip24'
Cond 'c_perio' 'Chronic periodontitis, generalized, moderate' '41565005' 'Periodontitis' 'K05.322' 'Chronic periodontitis, generalized, moderate' '2026-02-11' 'e_dent26a'
Cond 'c_caries' 'Dental caries into dentin' '80967001' 'Dental caries' 'K02.52' 'Dental caries on pit and fissure surface penetrating into dentin' '2026-02-11' 'e_dent26a'
Cond 'c_toothloss' 'Partial loss of teeth' $null $null 'K08.409' 'Partial loss of teeth, unspecified cause, unspecified class' '2026-03-04' 'e_dent26c'

# =====================================================================
# Allergies and intolerances
# =====================================================================

Allergy 'a_pcn' (CC $RX '7980' 'penicillin G' 'Penicillin') 'allergy' 'medication' 'high' '1996-08-01' (CC $SCT '271807003' 'Eruption' 'Generalized rash') 'moderate' 'Rash and itching during Army basic training.'
Allergy 'a_acei' (CC $RX '29046' 'lisinopril' 'Lisinopril (ACE inhibitor)') 'intolerance' 'medication' 'high' '2013-04-02' (CC $SCT '41291007' 'Angioedema' 'Angioedema of lips and tongue') 'severe' 'Avoid all ACE inhibitors; switched to losartan.'
Allergy 'a_shell' (CC $SCT '44027008' 'Seafood' 'Shellfish') 'allergy' 'food' 'low' '2005-07-04' (CC $SCT '126485001' 'Urticaria' 'Hives') 'mild' $null
Allergy 'a_latex' (CC $SCT '111088007' 'Latex' 'Latex') 'allergy' 'environment' 'low' '2016-11-02' (CC $SCT '126485001' 'Urticaria' 'Contact hives') 'mild' 'Use non-latex gloves for dental and procedural care.'

# =====================================================================
# Medications
# =====================================================================

$MEDS = @(
  @{ k = 'm_metformin'; rx = '861004'; n = 'metformin hydrochloride 1000 MG Oral Tablet'; r = 'oral'; s = 'Take 1 tablet by mouth twice daily with meals.'; d = '2016-01-11'; st = 'active'; p = 'pr_pcp'; rs = @('c_dm'); q = 180; u = 'tablet'; dv = 1000; du = 'mg'; ndc = '00185022101' },
  @{ k = 'm_empa'; rx = '1545658'; n = 'empagliflozin 10 MG Oral Tablet'; r = 'oral'; s = 'Take 1 tablet by mouth every morning.'; d = '2024-03-05'; st = 'active'; p = 'pr_hosp'; e = 'e_ip24'; rs = @('c_dm', 'c_cad'); q = 90; u = 'tablet'; dv = 10; du = 'mg' },
  @{ k = 'm_glargine'; rx = '311041'; n = 'insulin glargine 100 UNT/ML Injectable Solution'; r = 'sc'; s = 'Inject 28 units under the skin at bedtime.'; d = '2024-03-05'; st = 'active'; p = 'pr_hosp'; e = 'e_ip24'; rs = @('c_dm'); q = 15; u = 'mL'; dv = 28; du = 'units'; ndc = '00955172901' },
  @{ k = 'm_atorva'; rx = '259255'; n = 'atorvastatin 80 MG Oral Tablet'; r = 'oral'; s = 'Take 1 tablet by mouth at bedtime.'; d = '2024-03-05'; st = 'active'; p = 'pr_hosp'; e = 'e_ip24'; rs = @('c_cad', 'c_lipid'); q = 90; u = 'tablet'; dv = 80; du = 'mg'; ndc = '00093505705' },
  @{ k = 'm_asa'; rx = '308416'; n = 'aspirin 81 MG Delayed Release Oral Tablet'; r = 'oral'; s = 'Take 1 tablet by mouth daily.'; d = '2024-03-02'; st = 'active'; p = 'pr_ed'; e = 'e_ed24'; rs = @('c_cad'); q = 90; u = 'tablet'; dv = 81; du = 'mg' },
  @{ k = 'm_clopi'; rx = '309362'; n = 'clopidogrel 75 MG Oral Tablet'; r = 'oral'; s = 'Take 1 tablet by mouth daily for 12 months after stent.'; d = '2024-03-03'; st = 'completed'; p = 'pr_icard'; e = 'e_ip24'; rs = @('c_cad'); q = 90; u = 'tablet'; dv = 75; du = 'mg'; ndc = '00093731405'; note = 'Dual antiplatelet therapy completed 2025-03-03; aspirin continues.' },
  @{ k = 'm_metop'; rx = '866436'; n = '24 HR metoprolol succinate 50 MG Extended Release Oral Tablet'; r = 'oral'; s = 'Take 1 tablet by mouth daily.'; d = '2024-03-05'; st = 'active'; p = 'pr_hosp'; e = 'e_ip24'; rs = @('c_cad', 'c_htn'); q = 90; u = 'tablet'; dv = 50; du = 'mg'; ndc = '00185028201' },
  @{ k = 'm_losartan'; rx = '979480'; n = 'losartan potassium 100 MG Oral Tablet'; r = 'oral'; s = 'Take 1 tablet by mouth daily.'; d = '2013-04-09'; st = 'active'; p = 'pr_pcp'; rs = @('c_htn', 'c_ckd'); q = 90; u = 'tablet'; dv = 100; du = 'mg'; ndc = '00054012522'; note = 'ARB used because of lisinopril angioedema.' },
  @{ k = 'm_ntg'; rx = '198039'; n = 'nitroglycerin 0.4 MG Sublingual Tablet'; r = 'sl'; s = 'Place 1 tablet under the tongue every 5 minutes as needed for chest pain, up to 3 doses. Call 911 if pain persists.'; d = '2024-03-05'; st = 'active'; p = 'pr_hosp'; e = 'e_ip24'; rs = @('c_cad'); q = 25; u = 'tablet'; dv = 0.4; du = 'mg'; prn = $true },
  @{ k = 'm_allo'; rx = '197320'; n = 'allopurinol 300 MG Oral Tablet'; r = 'oral'; s = 'Take 1 tablet by mouth daily.'; d = '2023-07-20'; st = 'active'; p = 'pr_pcp'; rs = @('c_gout'); q = 90; u = 'tablet'; dv = 300; du = 'mg' },
  @{ k = 'm_sert'; rx = '312938'; n = 'sertraline 100 MG Oral Tablet'; r = 'oral'; s = 'Take 1 tablet by mouth daily.'; d = '2019-01-15'; st = 'active'; p = 'pr_pcp'; rs = @('c_mdd', 'c_ptsd'); q = 90; u = 'tablet'; dv = 100; du = 'mg'; ndc = '00378418801' },
  @{ k = 'm_prazosin'; rx = '312593'; n = 'prazosin 1 MG Oral Capsule'; r = 'oral'; s = 'Take 1 capsule by mouth at bedtime for nightmares.'; d = '2021-09-30'; st = 'active'; p = 'pr_pcp'; rs = @('c_ptsd'); q = 90; u = 'capsule'; dv = 1; du = 'mg' },
  @{ k = 'm_gaba'; rx = '310431'; n = 'gabapentin 300 MG Oral Capsule'; r = 'oral'; s = 'Take 1 capsule by mouth three times daily.'; d = '2022-10-20'; st = 'active'; p = 'pr_pain'; e = 'e_esi22'; rs = @('c_disc', 'c_dm'); q = 270; u = 'capsule'; dv = 300; du = 'mg' },
  @{ k = 'm_tiotropium'; rx = '485032'; n = 'tiotropium 0.018 MG Inhalation Powder'; r = 'inh'; s = 'Inhale contents of 1 capsule once daily.'; d = '2023-02-14'; st = 'active'; p = 'pr_pcp'; e = 'e_spiro23'; rs = @('c_copd'); q = 90; u = 'capsule'; dv = 0.018; du = 'mg' },
  @{ k = 'm_albuterol'; rx = '801092'; n = 'NDA020983 60 ACTUAT albuterol 0.09 MG/ACTUAT Metered Dose Inhaler'; r = 'inh'; s = 'Inhale 2 puffs every 4-6 hours as needed for wheezing.'; d = '2023-02-14'; st = 'active'; p = 'pr_pcp'; e = 'e_spiro23'; rs = @('c_copd'); q = 1; u = 'inhaler'; prn = $true },
  @{ k = 'm_omep'; rx = '198051'; n = 'omeprazole 20 MG Delayed Release Oral Capsule'; r = 'oral'; s = 'Take 1 capsule by mouth daily before breakfast.'; d = '2020-02-03'; st = 'active'; p = 'pr_pcp'; rs = @('c_gerd'); q = 90; u = 'capsule'; dv = 20; du = 'mg' },
  @{ k = 'm_latanoprost'; rx = '314072'; n = 'latanoprost 0.05 MG/ML Ophthalmic Solution'; r = 'eye'; s = 'Instill 1 drop in each eye at bedtime.'; d = '2025-01-20'; st = 'active'; p = 'pr_ophth'; e = 'e_eye25'; rs = @('c_poag'); q = 2.5; u = 'mL'; ndc = '00378964532' },
  @{ k = 'm_clobetasol'; rx = '861487'; n = 'clobetasol propionate 0.5 MG/ML Topical Solution'; r = 'top'; s = 'Apply to scalp plaques twice daily for up to 2 weeks, then weekends only.'; d = '2021-05-11'; st = 'active'; p = 'pr_derm'; rs = @('c_psor'); q = 50; u = 'mL'; ndc = '00064043050' },
  @{ k = 'm_calcipotriene'; rx = '313921'; n = 'calcipotriene 0.05 MG/ML Topical Cream'; r = 'top'; s = 'Apply a thin layer to elbow and knee plaques twice daily.'; d = '2021-05-11'; st = 'active'; p = 'pr_derm'; rs = @('c_psor'); q = 60; u = 'g' },
  @{ k = 'm_5fu'; rx = '105583'; n = 'fluorouracil 50 MG/ML Topical Cream'; r = 'top'; s = 'Apply to forehead and scalp actinic keratoses twice daily for 3 weeks.'; d = '2026-04-07'; st = 'completed'; p = 'pr_derm'; e = 'e_derm26'; rs = @('c_ak'); q = 40; u = 'g'; note = 'Field treatment course completed 2026-04-28.' },
  @{ k = 'm_chlorhex'; rx = '834127'; n = 'chlorhexidine gluconate 1.2 MG/ML Mouthwash'; r = 'oral'; s = 'Rinse with 15 mL for 30 seconds twice daily after brushing, then spit. Do not swallow.'; d = '2026-02-25'; st = 'completed'; p = 'pr_perio'; e = 'e_dent26b'; rs = @('c_perio'); q = 473; u = 'mL'; ndc = '00116000315'; note = 'Two-week course after scaling and root planing.' },
  @{ k = 'm_vitd'; rx = '705728'; n = 'cholecalciferol 1.25 MG Oral Capsule'; r = 'oral'; s = 'Take 1 capsule (50,000 units) by mouth once weekly for 8 weeks.'; d = '2026-08-25'; st = 'active'; p = 'pr_pcp'; e = 'e_pcp26'; rs = @('c_vitd'); q = 8; u = 'capsule'; dv = 1.25; du = 'mg' }
)
foreach ($m in $MEDS) { Med $m.k $m.rx $m.n $m.r $m.s $m.d $m.st $m.p $m.e $m.rs $m.q $m.u $m.dv $m.du $m.note $m.prn }

# =====================================================================
# Immunizations
# =====================================================================

Immz 'i_hepb1' '43' 'Hep B, adult' '2016-01-12' 'HB16A01' 'LA' 'pr_rn'
Immz 'i_hepb2' '43' 'Hep B, adult' '2016-02-12' 'HB16A02' 'LA' 'pr_rn'
Immz 'i_hepb3' '43' 'Hep B, adult' '2016-07-12' 'HB16A07' 'LA' 'pr_rn'
Immz 'i_tdap' '115' 'Tdap' '2021-06-15' 'TD21F15' 'RA' 'pr_rn'
Immz 'i_pcv20' '216' 'Pneumococcal conjugate PCV20, polysaccharide CRM197 conjugate, adjuvant, PF' '2024-04-09' 'PC24D09' 'LA' 'pr_rn'
Immz 'i_flu25' '150' 'Influenza, split virus, quadrivalent, PF' '2025-10-02' 'FL25J02' 'LA' 'pr_rn'
Immz 'i_covid25' '213' 'SARS-COV-2 (COVID-19) vaccine, UNSPECIFIED' '2025-10-02' 'CV25J02' 'RA' 'pr_rn'
Immz 'i_flu26' '150' 'Influenza, split virus, quadrivalent, PF' '2026-09-20' 'FL26I20' 'LA' 'pr_rn'

# =====================================================================
# Observations: labs, vitals, hearing, vision, assessments
# =====================================================================

# --- lab panels (key, LOINC, display, value, unit, low, high, flag) ---

# 2024-03-02 emergency department
$t = Ts '2024-03-02' '06:30'
$edLabs = LabSet 'lab24ed' '2024-03-02' $t 'e_ed24' @(
  (Row '89579-7' 86 'ng/L' $null 22 'H' 'Troponin I.cardiac [Mass/volume] in Serum or Plasma by High sensitivity method'),
  (Row '33762-6' 640 'pg/mL' $null 125 'H' 'Natriuretic peptide.B prohormone N-Terminal [Mass/volume] in Serum or Plasma'),
  (Row '2345-7' 212 'mg/dL' 70 99 'H'), (Row '2160-0' 1.18 'mg/dL' 0.74 1.35 'N'), (Row '98979-8' 77 'mL/min/{1.73_m2}' 60 $null 'N'),
  (Row '2951-2' 138 'mmol/L' 136 145 'N'), (Row '2823-3' 4.3 'mmol/L' 3.5 5.1 'N'),
  (Row '6690-2' 9.8 '10*3/uL' 4.0 11.0 'N' 'Leukocytes [#/volume] in Blood by Automated count'),
  (Row '718-7' 15.1 'g/dL' 13.5 17.5 'N' 'Hemoglobin [Mass/volume] in Blood'),
  (Row '4544-3' 44.8 '%' 40 52 'N' 'Hematocrit [Volume Fraction] of Blood by Automated count'),
  (Row '777-3' 245 '10*3/uL' 150 400 'N' 'Platelets [#/volume] in Blood by Automated count'),
  (Row '4548-4' 9.1 '%' 4.0 5.6 'H' 'Hemoglobin A1c/Hemoglobin.total in Blood'),
  (Row '2093-3' 236 'mg/dL' $null 199 'H' 'Cholesterol [Mass/volume] in Serum or Plasma'),
  (Row '2571-8' 280 'mg/dL' $null 149 'H' 'Triglyceride [Mass/volume] in Serum or Plasma'),
  (Row '2085-9' 34 'mg/dL' 40 $null 'L' 'Cholesterol in HDL [Mass/volume] in Serum or Plasma'),
  (Row '13457-7' 146 'mg/dL' $null 99 'H' 'Cholesterol in LDL [Mass/volume] in Serum or Plasma by calculation'))
[void](Obs @{ k = 'lab24ed-trop2'; cat = 'laboratory'; code = '89579-7'; disp = 'Troponin I.cardiac [Mass/volume] in Serum or Plasma by High sensitivity method'; text = 'High-sensitivity troponin I (3-hour repeat)'; v = 412; u = 'ng/L'; hi = 22; flag = 'H'; date = (Ts '2024-03-02' '08:45'); issued = (Ts '2024-03-02' '09:30'); e = 'e_ed24'; perf = 'org_lab' })
LabReport 'dr_lab24ed' '11502-2' 'Laboratory report' '2024-03-02' $t 'e_ed24' (@($edLabs) + 'lab24ed-trop2')

# 2025 kidney trend
$ckd25a = LabSet 'lab25may' '2025-05-12' (Ts '2025-05-13' '07:30') 'e_derm25' @((Row '2160-0' 1.52 'mg/dL' 0.74 1.35 'H'), (Row '98979-8' 57 'mL/min/{1.73_m2}' 60 $null 'L'), (Row '4548-4' 7.6 '%' 4.0 5.6 'H' 'Hemoglobin A1c/Hemoglobin.total in Blood'))
$ckd25b = LabSet 'lab25sep' '2025-09-08' (Ts '2025-09-09' '07:30') 'e_card24' @((Row '2160-0' 1.55 'mg/dL' 0.74 1.35 'H'), (Row '98979-8' 55 'mL/min/{1.73_m2}' 60 $null 'L'), (Row '9318-7' 68 'mg/g' $null 29 'H' 'Albumin/Creatinine [Mass Ratio] in Urine'))

# 2026-08-24 annual
$t = Ts '2026-08-25' '07:15'
$cmp26 = LabSet 'lab26' '2026-08-24' $t 'e_pcp26' @(
  (Row '2345-7' 156 'mg/dL' 70 99 'H'), (Row '3094-0' 26 'mg/dL' 7 20 'H'), (Row '2160-0' 1.58 'mg/dL' 0.74 1.35 'H'), (Row '98979-8' 54 'mL/min/{1.73_m2}' 60 $null 'L'),
  (Row '2951-2' 139 'mmol/L' 136 145 'N'), (Row '2823-3' 4.9 'mmol/L' 3.5 5.1 'N'), (Row '2075-0' 102 'mmol/L' 98 107 'N'), (Row '2028-9' 25 'mmol/L' 22 29 'N'),
  (Row '17861-6' 9.5 'mg/dL' 8.6 10.3 'N'), (Row '1751-7' 4.1 'g/dL' 3.5 5.2 'N'), (Row '2885-2' 7.2 'g/dL' 6.0 8.3 'N'), (Row '1742-6' 48 'U/L' 0 41 'H'),
  (Row '1920-8' 39 'U/L' 0 40 'N'), (Row '6768-6' 88 'U/L' 40 129 'N'), (Row '1975-2' 0.7 'mg/dL' 0.1 1.2 'N'))
$lip26 = LabSet 'lab26' '2026-08-24' $t 'e_pcp26' @(
  (Row '2093-3' 148 'mg/dL' $null 199 'N' 'Cholesterol [Mass/volume] in Serum or Plasma'), (Row '2571-8' 196 'mg/dL' $null 149 'H' 'Triglyceride [Mass/volume] in Serum or Plasma'),
  (Row '2085-9' 38 'mg/dL' 40 $null 'L' 'Cholesterol in HDL [Mass/volume] in Serum or Plasma'), (Row '13457-7' 71 'mg/dL' $null 54 'H' 'Cholesterol in LDL [Mass/volume] in Serum or Plasma by calculation'))
$cbc26 = LabSet 'lab26' '2026-08-24' $t 'e_pcp26' @(
  (Row '6690-2' 8.1 '10*3/uL' 4.0 11.0 'N' 'Leukocytes [#/volume] in Blood by Automated count'), (Row '718-7' 14.6 'g/dL' 13.5 17.5 'N' 'Hemoglobin [Mass/volume] in Blood'),
  (Row '4544-3' 43.5 '%' 40 52 'N' 'Hematocrit [Volume Fraction] of Blood by Automated count'), (Row '777-3' 232 '10*3/uL' 150 400 'N' 'Platelets [#/volume] in Blood by Automated count'))
$misc26 = LabSet 'lab26' '2026-08-24' $t 'e_pcp26' @(
  (Row '4548-4' 7.4 '%' 4.0 5.6 'H' 'Hemoglobin A1c/Hemoglobin.total in Blood'), (Row '9318-7' 88 'mg/g' $null 29 'H' 'Albumin/Creatinine [Mass Ratio] in Urine'),
  (Row '3016-3' 2.1 'm[IU]/L' 0.4 4.5 'N' 'Thyrotropin [Units/volume] in Serum or Plasma'), (Row '3084-1' 6.8 'mg/dL' 3.4 7.0 'N' 'Urate [Mass/volume] in Serum or Plasma'),
  (Row '1989-3' 24 'ng/mL' 30 100 'L' '25-hydroxyvitamin D3 [Mass/volume] in Serum or Plasma'),
  (Row '33762-6' 210 'pg/mL' $null 125 'H' 'Natriuretic peptide.B prohormone N-Terminal [Mass/volume] in Serum or Plasma'))
LabReport 'dr_cmp26' '24323-8' 'Comprehensive metabolic 2000 panel - Serum or Plasma' '2026-08-24' $t 'e_pcp26' $cmp26
LabReport 'dr_lipid26' '24331-1' 'Lipid 1996 panel - Serum or Plasma' '2026-08-24' $t 'e_pcp26' $lip26
LabReport 'dr_cbc26' '11502-2' 'Laboratory report' '2026-08-24' $t 'e_pcp26' $cbc26

# --- vital signs ---

Vitals 'vs24ed' (Ts '2024-03-02' '05:50') 'e_ed24' 'pr_ed' @{ sys = 162; dia = 98; hr = 104; rr = 20; temp = 36.9; spo2 = 94; wt = 121.6; pain = 8 }
Vitals 'vs24card' (Ts '2024-04-09' '14:05') 'e_card24' 'pr_cards' @{ sys = 134; dia = 82; hr = 66; spo2 = 96; wt = 119.8; ht = 180.3; bmi = 36.9 }
Vitals 'vs26pcp' (Ts '2026-08-24' '08:40') 'e_pcp26' 'pr_rn' @{ sys = 138; dia = 86; hr = 72; rr = 16; temp = 36.8; spo2 = 95; ht = 180.3; wt = 117.9; bmi = 36.3; pain = 4 }
Vitals 'vs26card' (Ts '2026-09-15' '10:05') 'e_card26' 'pr_cards' @{ sys = 128; dia = 78; hr = 64; spo2 = 96; wt = 116.5; ht = 180.3; bmi = 35.8 }

# --- hearing: pure-tone audiograms (dB HL) ---
$EARS = @{ R = @('25577004', 'Right ear structure'); L = @('89644007', 'Left ear structure') }
$AUDIO_CODES = @{
  R = @{ 500 = '89025-1'; 1000 = '89017-8'; 2000 = '89019-4'; 4000 = '89023-6'; 8000 = '89029-3' }
  L = @{ 500 = '89024-4'; 1000 = '89016-0'; 2000 = '89018-6'; 4000 = '89022-8'; 8000 = '89028-5' }
}
function Audiogram($prefix, $date, $enc, $right, $left) {
  $keys = @()
  foreach ($side in 'R', 'L') {
    $vals = if ($side -eq 'R') { $right } else { $left }
    $freqs = @(500, 1000, 2000, 4000, 8000)
    for ($i = 0; $i -lt 5; $i++) {
      $f = $freqs[$i]; $ear = if ($side -eq 'R') { 'right' } else { 'left' }
      $keys += Obs @{ k = "$prefix-$side$f"; cat = 'exam'; code = $AUDIO_CODES[$side][$f]; disp = "Hearing threshold Ear - $ear --$f Hz"; v = $vals[$i]; u = 'dB HL'; ucum = 'dB'
        hi = 25; flag = $(if ($vals[$i] -gt 25) { 'H' } else { 'N' }); date = $date; e = $enc; perfType = 'Practitioner'; perf = 'pr_aud'; site = (CC $SCT $EARS[$side][0] $EARS[$side][1]) }
    }
  }
  , $keys
}
$aud24 = Audiogram 'aud24' (Ts '2024-07-15' '09:20') 'e_aud24' @(15, 15, 25, 55, 45) @(15, 20, 30, 60, 50)
$aud26 = Audiogram 'aud26' (Ts '2026-06-10' '13:20') 'e_aud26' @(20, 20, 30, 60, 55) @(20, 25, 35, 65, 60)

# --- vision ---
$EYES = @{ R = @('18944008', 'Right eye structure'); L = @('8966001', 'Left eye structure') }
function EyeObs($k, $code, $disp, $side, $date, $enc, $prac, $extra) {
  $o = @{ k = $k; cat = 'exam'; code = $code; disp = $disp; date = $date; e = $enc; perfType = 'Practitioner'; perf = $prac; site = (CC $SCT $EYES[$side][0] $EYES[$side][1]) }
  foreach ($key in $extra.Keys) { $o[$key] = $extra[$key] }
  [void](Obs $o)
}
$d = Ts '2025-01-20' '10:15'
EyeObs 'iop25R' '79892-6' 'Right eye Intraocular pressure' 'R' $d 'e_eye25' 'pr_ophth' @{ v = 26; u = 'mm[Hg]'; lo = 10; hi = 21; flag = 'H' }
EyeObs 'iop25L' '79893-4' 'Left eye Intraocular pressure' 'L' $d 'e_eye25' 'pr_ophth' @{ v = 27; u = 'mm[Hg]'; lo = 10; hi = 21; flag = 'H' }
EyeObs 'cdr25R' '71485-7' 'Right optic nerve Cup-disc ratio by Ophthalmoscopy' 'R' $d 'e_eye25' 'pr_ophth' @{ v = 0.6; u = '{ratio}' }
EyeObs 'cdr25L' '71484-0' 'Left optic nerve Cup-disc ratio by Ophthalmoscopy' 'L' $d 'e_eye25' 'pr_ophth' @{ v = 0.65; u = '{ratio}' }
EyeObs 'rnfl25R' '86301-9' 'Right retina Retinal nerve fiber layer.mean thickness by OCT' 'R' $d 'e_eye25' 'pr_ophth' @{ v = 82; u = 'um'; lo = 80; flag = 'N' }
EyeObs 'rnfl25L' '86290-4' 'Left retina Retinal nerve fiber layer.mean thickness by OCT' 'L' $d 'e_eye25' 'pr_ophth' @{ v = 76; u = 'um'; lo = 80; flag = 'L' }
$d = Ts '2026-07-14' '09:20'
EyeObs 'iop26R' '79892-6' 'Right eye Intraocular pressure' 'R' $d 'e_eye26' 'pr_od' @{ v = 17; u = 'mm[Hg]'; lo = 10; hi = 21; flag = 'N' }
EyeObs 'iop26L' '79893-4' 'Left eye Intraocular pressure' 'L' $d 'e_eye26' 'pr_od' @{ v = 18; u = 'mm[Hg]'; lo = 10; hi = 21; flag = 'N' }
EyeObs 'va26R' '65893-0' 'Visual acuity best corrected Right eye' 'R' $d 'e_eye26' 'pr_od' @{ vs = '20/20' }
EyeObs 'va26L' '65897-1' 'Visual acuity best corrected Left eye' 'L' $d 'e_eye26' 'pr_od' @{ vs = '20/25' }
EyeObs 'cdr26R' '71485-7' 'Right optic nerve Cup-disc ratio by Ophthalmoscopy' 'R' $d 'e_eye26' 'pr_od' @{ v = 0.65; u = '{ratio}' }
EyeObs 'cdr26L' '71484-0' 'Left optic nerve Cup-disc ratio by Ophthalmoscopy' 'L' $d 'e_eye26' 'pr_od' @{ v = 0.7; u = '{ratio}' }
EyeObs 'rnfl26R' '86301-9' 'Right retina Retinal nerve fiber layer.mean thickness by OCT' 'R' $d 'e_eye26' 'pr_od' @{ v = 78; u = 'um'; lo = 80; flag = 'L' }
EyeObs 'rnfl26L' '86290-4' 'Left retina Retinal nerve fiber layer.mean thickness by OCT' 'L' $d 'e_eye26' 'pr_od' @{ v = 72; u = 'um'; lo = 80; flag = 'L' }
EyeObs 'sph26R' '65890-6' 'Spherical power [Inverse Length] Right eye' 'R' $d 'e_eye26' 'pr_od' @{ v = -2.75; u = '[diop]' }
EyeObs 'sph26L' '65894-8' 'Spherical power [Inverse Length] Left eye' 'L' $d 'e_eye26' 'pr_od' @{ v = -3.25; u = '[diop]' }

# --- screening and assessments ---
[void](Obs @{ k = 'phq24'; cat = 'survey'; code = '44261-6'; disp = 'Patient Health Questionnaire 9 item (PHQ-9) total score [Reported]'; v = 14; u = '{score}'; date = (Ts '2024-04-09' '14:10'); e = 'e_card24'; perfType = 'Practitioner'; perf = 'pr_cards' })
[void](Obs @{ k = 'phq26'; cat = 'survey'; code = '44261-6'; disp = 'Patient Health Questionnaire 9 item (PHQ-9) total score [Reported]'; v = 9; u = '{score}'; date = (Ts '2026-07-22' '16:05'); e = 'e_bh26'; perfType = 'Practitioner'; perf = 'pr_psych' })
[void](Obs @{ k = 'gad26'; cat = 'survey'; code = '70274-6'; disp = 'Generalized anxiety disorder 7 item (GAD-7) total score [Reported.PHQ]'; v = 8; u = '{score}'; date = (Ts '2026-07-22' '16:08'); e = 'e_bh26'; perfType = 'Practitioner'; perf = 'pr_psych' })
[void](Obs @{ k = 'auditc26'; cat = 'survey'; code = '75626-2'; disp = 'Total score [AUDIT-C]'; v = 3; u = '{score}'; date = (Ts '2026-08-24' '08:45'); e = 'e_pcp26'; perfType = 'Practitioner'; perf = 'pr_rn' })
[void](Obs @{ k = 'smoke26'; cat = 'social-history'; code = '72166-2'; disp = 'Tobacco smoking status'; vcc = (CC $SCT '8517006' 'Ex-smoker' 'Former smoker (quit 2024-03, 25 pack-years)'); date = (Ts '2026-08-24' '08:45'); e = 'e_pcp26'; perfType = 'Practitioner'; perf = 'pr_rn' })

# =====================================================================
# Procedures
# =====================================================================

Proc 'p_psg' (CC $CPT '95810' 'Polysomnography, attended, 4 or more parameters' 'Overnight polysomnography') (Ts '2019-05-20' '21:30') 'e_psg19' 'pr_sleep' @('c_osa') $null 'AHI 38 events/hour; severe obstructive sleep apnea.' (Ts '2019-05-21' '05:45')
Proc 'p_esi' (CC $CPT '62323' 'Lumbar epidural injection with imaging guidance' 'Lumbar epidural steroid injection, L4-5') (Ts '2022-10-20' '08:20') 'e_esi22' 'pr_pain' @('c_disc') @(CC $SCT '122496007' 'Lumbar spine structure') '80 mg triamcinolone, interlaminar L4-5, fluoroscopic guidance.'
Proc 'p_spiro' (CC $CPT '94010' 'Spirometry' 'Spirometry') (Ts '2023-02-14' '10:15') 'e_spiro23' 'pr_pcp' @('c_copd') $null 'Post-bronchodilator FEV1/FVC 0.66, FEV1 71% predicted (GOLD 2).'
Proc 'p_cath' (CC $CPT '93458' 'Left heart catheterization with coronary angiography' 'Left heart catheterization and coronary angiography') (Ts '2024-03-03' '10:05') 'e_ip24' 'pr_icard' @('c_nstemi') @(CC $SCT '41801008' 'Coronary artery structure') $null
Proc 'p_pci' (CCn 'Percutaneous coronary intervention with drug-eluting stent, proximal LAD' @($SCT, '415070008', 'Percutaneous coronary intervention') @($CPT, '92928', 'Percutaneous transcatheter placement of intracoronary stent, single major coronary artery')) (Ts '2024-03-03' '10:40') 'e_ip24' 'pr_icard' @('c_nstemi', 'c_cad') @(CC $SCT '41801008' 'Coronary artery structure' 'Proximal left anterior descending artery') 'One 3.0 x 28 mm drug-eluting stent; TIMI 3 flow restored.' (Ts '2024-03-03' '11:20')
Proc 'p_aud24' (CC $CPT '92557' 'Comprehensive audiometry threshold evaluation and speech recognition' 'Comprehensive audiometry') (Ts '2024-07-15' '09:10') 'e_aud24' 'pr_aud' @('c_snhl') @(CC $SCT '34338003' 'Both ears') $null
Proc 'p_tymp24' (CC $CPT '92567' 'Tympanometry' 'Tympanometry') (Ts '2024-07-15' '09:40') 'e_aud24' 'pr_aud' @('c_snhl') @(CC $SCT '34338003' 'Both ears') 'Type A tympanograms bilaterally.'
Proc 'p_haf' (CC $HCPCS 'V5011' 'Fitting/orientation/checking of hearing aid' 'Hearing aid fitting, both ears') (Ts '2024-08-12' '15:10') 'e_had24' 'pr_aud' @('c_snhl') @(CC $SCT '34338003' 'Both ears') 'Receiver-in-canal aids, real-ear verified to NAL-NL2 targets.'
Proc 'p_colo' (CC $CPT '45378' 'Colonoscopy, flexible, diagnostic' 'Screening colonoscopy') (Ts '2024-11-18' '08:00') 'e_colo24' 'pr_gi' @() $null 'Normal to cecum; no polyps. Repeat in 10 years.'
Proc 'p_vf25' (CC $CPT '92083' 'Visual field examination, extended' 'Visual field test (24-2)') (Ts '2025-01-20' '10:30') 'e_eye25' 'pr_ophth' @('c_poag') @(CC $SCT '40638003' 'Structure of both eyes') 'Early inferior arcuate defect OS; borderline OD.'
Proc 'p_oct25' (CC $CPT '92133' 'Scanning computerized ophthalmic diagnostic imaging, optic nerve' 'OCT optic nerve, both eyes') (Ts '2025-01-20' '10:45') 'e_eye25' 'pr_ophth' @('c_poag') @(CC $SCT '40638003' 'Structure of both eyes') $null
Proc 'p_bx25' (CC $CPT '11102' 'Tangential biopsy of skin, single lesion' 'Shave biopsy, left nasal ala') (Ts '2025-05-12' '11:15') 'e_derm25' 'pr_derm' @('c_bcc') @(CC $SCT '45206002' 'Nasal structure' 'Left nasal ala') $null
Proc 'p_mohs25' (CC $CPT '17311' 'Mohs micrographic surgery, head and neck, first stage' 'Mohs surgery, left nasal ala, 2 stages') (Ts '2025-06-02' '08:30') 'e_mohs25' 'pr_derm' @('c_bcc') @(CC $SCT '45206002' 'Nasal structure' 'Left nasal ala') 'Clear margins after 2 stages; repaired with bilobed flap.' (Ts '2025-06-02' '11:30')
Proc 'p_dent_srp1' (CC $CDT 'D4341' 'Periodontal scaling and root planing, four or more teeth per quadrant' 'Scaling and root planing, upper right quadrant') (Ts '2026-02-25' '08:15') 'e_dent26b' 'pr_perio' @('c_perio') @(CC $TOOTH '1' 'Upper right quadrant') $null
Proc 'p_dent_srp2' (CC $CDT 'D4341' 'Periodontal scaling and root planing, four or more teeth per quadrant' 'Scaling and root planing, lower right quadrant') (Ts '2026-02-25' '09:00') 'e_dent26b' 'pr_perio' @('c_perio') @(CC $TOOTH '4' 'Lower right quadrant') $null
Proc 'p_dent_ext' (CC $CDT 'D7140' 'Extraction, erupted tooth or exposed root' 'Extraction of tooth #2') (Ts '2026-03-04' '14:10') 'e_dent26c' 'pr_dds' @('c_caries') @(CC $TOOTH '17' 'Tooth #2 (upper right second molar)') 'Non-restorable caries; extracted under local anesthesia.'
Proc 'p_cryo26' (CC $CPT '17000' 'Destruction of premalignant lesion, first lesion' 'Cryotherapy of actinic keratoses (6 lesions)') (Ts '2026-04-07' '09:45') 'e_derm26' 'pr_derm' @('c_ak') $null 'Liquid nitrogen to 6 actinic keratoses on scalp and forehead.'
Proc 'p_aud26' (CC $CPT '92557' 'Comprehensive audiometry threshold evaluation and speech recognition' 'Comprehensive audiometry') (Ts '2026-06-10' '13:10') 'e_aud26' 'pr_aud' @('c_snhl') @(CC $SCT '34338003' 'Both ears') $null
Proc 'p_vf26' (CC $CPT '92083' 'Visual field examination, extended' 'Visual field test (24-2)') (Ts '2026-07-14' '09:40') 'e_eye26' 'pr_od' @('c_poag') @(CC $SCT '40638003' 'Structure of both eyes') 'Stable inferior arcuate defect OS compared with 2025.'
Proc 'p_refr26' (CC $CPT '92015' 'Determination of refractive state' 'Refraction') (Ts '2026-07-14' '10:00') 'e_eye26' 'pr_od' @('c_myopia', 'c_presby') @(CC $SCT '40638003' 'Structure of both eyes') $null
Proc 'p_dent_perio' (CC $CDT 'D4910' 'Periodontal maintenance' 'Periodontal maintenance') (Ts '2026-08-12' '08:10') 'e_dent26d' 'pr_dds' @('c_perio') @(CC $TOOTH '0' 'Whole mouth') 'Probing depths improved to 3-4 mm; bleeding on probing 18%.'
Proc 'p_dent_crown' (CC $CDT 'D2740' 'Crown, porcelain/ceramic' 'Ceramic crown, tooth #30') (Ts '2026-08-12' '09:00') 'e_dent26d' 'pr_dds' @('c_caries') @(CC $TOOTH '46' 'Tooth #30 (lower right first molar)') $null
Proc 'p_dent_comp' (CC $CDT 'D2392' 'Resin-based composite, two surfaces, posterior' 'Composite filling, tooth #19 (MO)') (Ts '2026-08-12' '10:00') 'e_dent26d' 'pr_dds' @('c_caries') @(CC $TOOTH '36' 'Tooth #19 (lower left first molar)') $null

# =====================================================================
# Devices
# =====================================================================
function Device($key, $type, $status, $manufacturer, $model, $serial, $lot, $exp, $implant, $site, $note) {
  $r = [ordered]@{
    resourceType = 'Device'; id = (Id $key); meta = (Meta $(if ($implant) { "$UC/us-core-implantable-device$UCV" } else { $null }))
    status = $status
    manufacturer = $manufacturer
    modelNumber = $model
    serialNumber = $serial
    lotNumber = $lot
    expirationDate = $exp
    type = $type
    patient = (PatRef)
    owner = (Ref 'Organization' $site)
    note = (Each $note { param($t) [ordered]@{ text = $t } })
  }
  if ($implant) {
    $r.manufactureDate = $implant.made
    $r.udiCarrier = @([ordered]@{ deviceIdentifier = $implant.di; carrierHRF = "(01)$($implant.di)(17)$($exp.Replace('-', '').Substring(2))(10)$lot(21)$serial" })
  }
  Add $r
}
Device 'd_stent' (CC $SCT '705643001' 'Coronary artery stent' 'Drug-eluting coronary stent, 3.0 x 28 mm') 'active' 'Synthetic Cardio Devices (fictional)' 'SCD-DES-3028' 'SYN-DES-240303-01' 'LOT2402A' '2027-12-31' @{ made = '2023-12-01'; di = '00000000000000' } 'org_hosp' 'Implanted 2024-03-03, proximal LAD. MRI conditional.'
Device 'd_cpap' (CC $SCT '702172008' 'Home CPAP unit' 'Auto-titrating CPAP') 'active' 'Synthetic Sleep Systems (fictional)' 'SSS-APAP-10' 'SYN-CPAP-190601' $null $null $null 'org_sleep' 'Pressure 8-14 cm H2O; 87% nights >4 hours (2026 download).'
Device 'd_ha_r' (CC $SCT '6012004' 'Hearing aid' 'Hearing aid, receiver-in-canal, right ear') 'active' 'Synthetic Hearing Co. (fictional)' 'SHC-RIC-5' 'SYN-HA-R-240812' $null $null $null 'org_aud' 'Fitted 2024-08-12.'
Device 'd_ha_l' (CC $SCT '6012004' 'Hearing aid' 'Hearing aid, receiver-in-canal, left ear') 'active' 'Synthetic Hearing Co. (fictional)' 'SHC-RIC-5' 'SYN-HA-L-240812' $null $null $null 'org_aud' 'Fitted 2024-08-12.'
Device 'd_cgm' (TextCC 'Continuous glucose monitor') 'active' 'Synthetic Glucose Sensors (fictional)' 'SGS-CGM-3' 'SYN-CGM-250915' $null $null $null 'org_pcp' 'Started 2025-09-15; time in range 68% (2026-08).'
Device 'd_glasses' (CC $SCT '50121007' 'Eyeglasses' 'Progressive eyeglasses') 'active' 'Atlas Optical' 'PROG-2026' 'SYN-RX-260714' $null $null $null 'org_eye' 'OD -2.75 -0.50 x 090, OS -3.25 -0.75 x 085, add +1.50.'

# =====================================================================
# Imaging studies with reports, plus a pathology report
# =====================================================================

# A narrative report: DiagnosticReport plus a DocumentReference copy sharing one Binary (US Core).

# --- 2022 MRI lumbar spine ---
$t = Ts '2022-09-14' '13:05'
Study 'is_mri22' $t 'e_mri22' @('sr_mri22') 'pr_pcp' 'pr_rad' (CC $CPT '72148' 'MRI lumbar spine without contrast' 'MRI lumbar spine without contrast') @('c_disc') 'MR LUMBAR SPINE WO CONTRAST' 'MR' '122496007' 'Lumbar spine structure' @('SAG T1|Sagittal T1 1|Sagittal T1 2|Sagittal T1 3', 'SAG T2|Sagittal T2 1|Sagittal T2 2|Sagittal T2 3', 'AX T2|Axial T2 L3-4|Axial T2 L4-5|Axial T2 L5-S1')
Report 'dr_mri22' 'rad' (& $IMG 'MRI lumbar spine without contrast') '2022-09-14' (Ts '2022-09-14' '16:20') 'e_mri22' @('sr_mri22') @('is_mri22') 'pr_rad' 'org_img' 'MRI Lumbar Spine' 'Left paracentral L4-5 disc extrusion contacting the traversing left L5 nerve root; mild L5-S1 degenerative change.' $null @"
ATLAS IMAGING CENTER - DIAGNOSTIC RADIOLOGY REPORT
$HDR
Exam: MRI LUMBAR SPINE WITHOUT CONTRAST (CPT 72148)    Date: 09/14/2022
Ordering: Helena Ortiz, MD
Indication: Low back pain radiating to the left leg for 6 weeks, numbness of the left foot dorsum.
Comparison: None.

FINDINGS:
Alignment normal. Vertebral body heights preserved. Conus ends at L1.
L3-4: Mild disc bulge without stenosis.
L4-5: Left paracentral disc extrusion measuring 9 mm, contacting and posteriorly displacing the traversing left L5 nerve root. Mild left lateral recess narrowing. No central canal stenosis.
L5-S1: Mild disc desiccation and facet arthropathy. Foramina patent.

IMPRESSION:
1. Left paracentral L4-5 disc extrusion contacting the traversing left L5 nerve root, correlating with left L5 radiculopathy.
2. Mild L5-S1 degenerative change.

Electronically signed: Thomas Nguyen, MD - Diagnostic Radiology    09/14/2022 16:20
"@

# --- 2024 chest X-ray ---
$t = Ts '2024-03-02' '06:10'
Study 'is_cxr24' $t 'e_ed24' @() 'pr_ed' 'pr_rad' (CC $CPT '71046' 'Radiologic examination, chest; 2 views' 'Chest X-ray, 2 views') @('c_nstemi') 'XR CHEST PA AND LATERAL' 'DX' '51185008' 'Thoracic structure' @('PA|PA chest', 'LAT|Lateral chest')
Report 'dr_cxr24' 'rad' (& $IMG 'Chest X-ray, 2 views') '2024-03-02' (Ts '2024-03-02' '06:55') 'e_ed24' @() @('is_cxr24') 'pr_rad' 'org_img' 'Chest X-ray, 2 Views' 'No acute cardiopulmonary process. Normal heart size.' $null @"
ATLAS GENERAL HOSPITAL - DIAGNOSTIC RADIOLOGY REPORT
$HDR
Exam: XR CHEST PA AND LATERAL (CPT 71046)    Date: 03/02/2024 06:10
Indication: Chest pain.

FINDINGS: Heart size normal. Mediastinal contours normal. Lungs clear; mild hyperinflation. No effusion or pneumothorax. No acute osseous abnormality.

IMPRESSION: No acute cardiopulmonary process.

Electronically signed: Thomas Nguyen, MD    03/02/2024 06:55
"@

# --- 2024 coronary angiography and PCI ---
$t = Ts '2024-03-03' '10:05'
Study 'is_cath24' $t 'e_ip24' @() 'pr_hosp' 'pr_icard' (CC $CPT '93458' 'Left heart catheterization with coronary angiography' 'Coronary angiography') @('c_nstemi') 'XA CORONARY ANGIOGRAPHY AND PCI' 'XA' '41801008' 'Coronary artery structure' @('LCA|LAO cranial|RAO caudal|AP cranial', 'RCA|LAO|RAO', 'PCI LAD|Pre-PCI LAD|Stent deployment|Post-PCI LAD')
Report 'dr_cath24' 'card' (CC $LOINC '18748-4' 'Diagnostic imaging study' 'Cardiac catheterization and PCI report') '2024-03-03' (Ts '2024-03-03' '12:10') 'e_ip24' @() @('is_cath24') 'pr_icard' 'org_hosp' 'Cardiac Catheterization and PCI' '90% proximal LAD stenosis (culprit) treated with a 3.0 x 28 mm drug-eluting stent; TIMI 3 flow. Moderate nonobstructive RCA and LCx disease.' $null @"
ATLAS GENERAL HOSPITAL - CARDIAC CATHETERIZATION REPORT
$HDR
Date: 03/03/2024    Operator: Elena Vasquez, MD (Interventional Cardiology)
Indication: NSTEMI (peak hs-troponin I 412 ng/L), ongoing anginal symptoms.
Access: Right radial artery, 6 Fr. Contrast: 140 mL. Fluoroscopy: 11.2 minutes.

HEMODYNAMICS: Aortic 138/82 mmHg. LVEDP 18 mmHg.

CORONARY ANGIOGRAPHY:
Left main: No significant disease.
LAD: 90% proximal stenosis with haziness (culprit). Mid LAD 30%.
LCx: 30% mid stenosis.
RCA: Dominant. 40% mid stenosis.

INTERVENTION: Proximal LAD predilated with a 2.5 mm balloon, then stented with a 3.0 x 28 mm drug-eluting stent at 14 atm, post-dilated with a 3.25 mm noncompliant balloon. Final 0% residual stenosis, TIMI 3 flow. No complications. Radial band applied.

CONCLUSIONS:
1. Single-vessel culprit LAD disease, successfully treated with one drug-eluting stent.
2. Moderate nonobstructive RCA and LCx disease: medical therapy.
3. Dual antiplatelet therapy (aspirin + clopidogrel) for 12 months; high-intensity statin.

Electronically signed: Elena Vasquez, MD    03/03/2024 12:10
"@

# --- 2024 echocardiogram (with an LVEF result) ---
$lvef = Obs @{ k = 'echo24-lvef'; cat = 'imaging'; code = '10230-1'; disp = 'Left ventricular Ejection fraction'; v = 45; u = '%'; lo = 52; flag = 'L'; date = (Ts '2024-03-04' '09:30'); e = 'e_ip24'; perfType = 'Practitioner'; perf = 'pr_cards' }
$t = Ts '2024-03-04' '09:30'
Study 'is_echo24' $t 'e_ip24' @() 'pr_hosp' 'pr_cards' (CC $CPT '93306' 'Transthoracic echocardiography, complete, with Doppler' 'Transthoracic echocardiogram') @('c_nstemi') 'US ECHOCARDIOGRAM TRANSTHORACIC' 'US' '80891009' 'Heart structure' @('2D|Parasternal long axis|Parasternal short axis|Apical 4 chamber|Apical 2 chamber', 'DOPPLER|Mitral inflow|Aortic outflow')
Report 'dr_echo24' 'card' (CC $LOINC '18748-4' 'Diagnostic imaging study' 'Transthoracic echocardiogram report') '2024-03-04' (Ts '2024-03-04' '13:00') 'e_ip24' @() @('is_echo24') 'pr_cards' 'org_hosp' 'Transthoracic Echocardiogram' 'LVEF 45% with anterior and apical hypokinesis; mild concentric LVH; no significant valve disease.' @($lvef) @"
ATLAS GENERAL HOSPITAL - ECHOCARDIOGRAPHY REPORT
$HDR
Date: 03/04/2024    Reader: Marcus Chen, MD (Cardiology)
Indication: NSTEMI, post-PCI LV function.

FINDINGS:
Left ventricle: Normal size. Mild concentric hypertrophy (septum 1.2 cm). LVEF 45% (biplane). Hypokinesis of the mid-to-apical anterior wall and apex.
Right ventricle: Normal size and function.
Valves: Trace mitral regurgitation. Aortic valve trileaflet without stenosis.
Diastolic function: Grade I dysfunction.
No pericardial effusion. No LV thrombus.

IMPRESSION: Mildly reduced LV systolic function (EF 45%) with LAD-territory wall motion abnormality.

Electronically signed: Marcus Chen, MD    03/04/2024 13:00
"@

# --- 2025 OCT optic nerve ---
$t = Ts '2025-01-20' '10:45'
Study 'is_oct25' $t 'e_eye25' @('sr_eye24') 'pr_od' 'pr_ophth' (CC $CPT '92133' 'Scanning computerized ophthalmic diagnostic imaging, optic nerve' 'OCT optic nerve, both eyes') @('c_poag') 'OCT RNFL OU' 'OPT' '40638003' 'Structure of both eyes' @('RNFL OD|Optic disc cube OD|RNFL thickness map OD', 'RNFL OS|Optic disc cube OS|RNFL thickness map OS')
Report 'dr_oct25' 'rad' (& $IMG 'OCT optic nerve, both eyes') '2025-01-20' (Ts '2025-01-20' '11:30') 'e_eye25' @('sr_eye24') @('is_oct25') 'pr_ophth' 'org_eye' 'OCT Retinal Nerve Fiber Layer' 'Borderline RNFL OD (82 um) and inferior thinning OS (76 um), consistent with early glaucoma.' @('rnfl25R', 'rnfl25L') @"
ATLAS EYE & RETINA CENTER - OPHTHALMIC IMAGING REPORT
$HDR
Study: OCT optic nerve head and RNFL, both eyes (CPT 92133)    Date: 01/20/2025
Indication: Elevated intraocular pressure (26/27 mmHg), suspicious optic nerves.

FINDINGS:
OD: Average RNFL 82 um (borderline); inferior quadrant borderline. Cup-to-disc 0.60.
OS: Average RNFL 76 um (below normal); inferior quadrant thinning. Cup-to-disc 0.65.
Good signal strength OU (8/10).

INTERPRETATION: Early structural glaucomatous change, worse OS, matching the inferior rim thinning on exam and the early superior arcuate field defect OS.

Electronically signed: Rajiv Mehta, MD - Ophthalmology    01/20/2025 11:30
"@

# --- 2025 dermoscopy ---
$t = Ts '2025-05-12' '11:05'
Study 'is_derm25' $t 'e_derm25' @('sr_derm25') 'pr_pcp' 'pr_derm' (TextCC 'Dermoscopic photography of skin lesion') @('c_bcc') 'DERMOSCOPY LEFT NASAL ALA' 'XC' '45206002' 'Nasal structure' @('CLINICAL|Overview photo|Dermoscopy 10x|Dermoscopy polarized')
Report 'dr_derm25' 'rad' (& $IMG 'Dermoscopy, left nasal ala') '2025-05-12' (Ts '2025-05-12' '11:40') 'e_derm25' @('sr_derm25') @('is_derm25') 'pr_derm' 'org_derm' 'Dermoscopy: Left Nasal Ala' 'Arborizing vessels and shiny white structures; highly suggestive of basal cell carcinoma. Biopsied.' $null @"
ATLAS DERMATOLOGY & MOHS SURGERY - DERMOSCOPY REPORT
$HDR
Date: 05/12/2025    Dermatologist: Naomi Blake, MD
Lesion: 7 mm pearly papule, left nasal ala, present ~8 months, occasionally bleeds.

DERMOSCOPY: Arborizing telangiectatic vessels, shiny white structures, a few blue-gray ovoid nests. No pigment network.

IMPRESSION: Highly suggestive of basal cell carcinoma, nodular type. Shave biopsy performed today.

Electronically signed: Naomi Blake, MD    05/12/2025 11:40
"@

# --- 2025 pathology ---
Report 'dr_path25' 'path' (CC $LOINC '11526-1' 'Pathology study' 'Surgical pathology report') '2025-05-12' (Ts '2025-05-14' '15:00') 'e_derm25' @() @() 'pr_path' 'org_lab' 'Surgical Pathology: Skin, Left Nasal Ala' 'Basal cell carcinoma, nodular type, extending to the deep margin.' $null @"
ATLAS REFERENCE LABORATORY - SURGICAL PATHOLOGY REPORT
$HDR
Accession: SP25-04412    Collected: 05/12/2025    Reported: 05/14/2025
Submitting physician: Naomi Blake, MD

SPECIMEN: Skin, left nasal ala, shave biopsy.

GROSS: A tan-pink shave of skin, 0.8 x 0.6 x 0.2 cm, entirely submitted.

MICROSCOPIC: Nests of basaloid cells with peripheral palisading and retraction artifact in a fibromyxoid stroma, arising from the epidermis and extending into the reticular dermis.

DIAGNOSIS: BASAL CELL CARCINOMA, NODULAR TYPE. Tumor extends to the deep margin.

Electronically signed: Laura Kim, MD - Pathology    05/14/2025 15:00
"@

# --- 2026 panoramic dental radiograph ---
$t = Ts '2026-02-11' '08:20'
Study 'is_pano26' $t 'e_dent26a' @() 'pr_dds' 'pr_dds' (CC $CDT 'D0330' 'Panoramic radiographic image' 'Panoramic dental radiograph') @('c_perio', 'c_caries') 'PANORAMIC DENTAL RADIOGRAPH' 'PX' '74262004' 'Oral cavity structure' @('PANO|Panoramic image')
Report 'dr_pano26' 'rad' (& $IMG 'Panoramic dental radiograph') '2026-02-11' (Ts '2026-02-11' '09:20') 'e_dent26a' @() @('is_pano26') 'pr_dds' 'org_dental' 'Panoramic Dental Radiograph' 'Generalized moderate horizontal bone loss; #2 non-restorable caries; #30 failing restoration with recurrent caries; #19 occlusal caries.' $null @"
ATLAS FAMILY DENTAL - RADIOGRAPHIC INTERPRETATION
$HDR
Images: Panoramic (D0330) and full-mouth series (D0210)    Date: 02/11/2026
Dentist: Sofia Marin, DDS

FINDINGS:
- Generalized moderate horizontal alveolar bone loss (25-35%), more advanced in the molar regions.
- #2: Large distal caries extending to the pulp; furcation involvement. Non-restorable.
- #30: Large MOD amalgam with recurrent caries at the distal margin.
- #19: Occlusal caries into dentin.
- #1, #16, #17, #32: Missing.
- No periapical radiolucencies apart from widened PDL at #2. Sinuses and TMJs unremarkable.

IMPRESSION: Chronic periodontitis with moderate bone loss; restorative needs at #2, #19 and #30.

Electronically signed: Sofia Marin, DDS    02/11/2026 09:20
"@

# =====================================================================
# Clinical notes
# =====================================================================

Note 'n_bh18' (Ts '2018-04-10' '11:30') '11488-4' 'Consult note' 'pr_psych' 'org_bh' 'e_bh18' 'Behavioral Health Intake' @"
ATLAS BEHAVIORAL HEALTH - INTAKE ASSESSMENT
$HDR
Date: 04/10/2018    Clinician: Grace Holloway, PhD
Referred by: Helena Ortiz, MD, for sleep disturbance and irritability.

HISTORY: 40-year-old Army veteran (infantry, 1996-2004, two deployments). Widowed in 2011. Reports nightmares 4-5 nights per week, hypervigilance in crowds, avoidance of fireworks and news coverage, irritability, and drinking 3-4 beers most nights to sleep. Denies suicidal or homicidal ideation; no prior attempts. Works as a farm equipment mechanic.

SCREENING: PCL-5 total 52. PHQ-9 total 12. AUDIT-C 7.

ASSESSMENT: Post-traumatic stress disorder, chronic. Hazardous alcohol use. Rule out depressive disorder.

PLAN:
1. Prolonged exposure therapy, weekly x 12 sessions.
2. Motivational interviewing for alcohol; goal of no more than 2 drinks per day.
3. Recommend PCP evaluate for prazosin for nightmares and an SSRI.
4. Safety plan reviewed; crisis line number provided.

Electronically signed: Grace Holloway, PhD    04/10/2018 11:30
"@

Note 'n_psg19' (Ts '2019-05-22' '10:00') '28570-0' 'Procedure note' 'pr_sleep' 'org_sleep' 'e_psg19' 'Polysomnography Report' @"
ATLAS SLEEP CENTER - POLYSOMNOGRAPHY REPORT
$HDR
Study date: 05/20/2019 (overnight)    Interpreting physician: Aaron Feld, MD
Indication: Loud snoring, witnessed apneas, daytime sleepiness, BMI 37.

RESULTS:
Total sleep time 386 minutes; sleep efficiency 81%.
Apnea-hypopnea index (AHI) 38 events/hour (supine 52, non-supine 21).
Oxygen nadir 79%; time below 88% SpO2: 41 minutes.
Periodic limb movements: not significant. No cardiac arrhythmia.

IMPRESSION: Severe obstructive sleep apnea.

RECOMMENDATIONS: Auto-titrating CPAP 6-15 cm H2O with heated humidification; weight loss; avoid alcohol and sedatives before bed; follow-up in 6-8 weeks with a compliance download.

Electronically signed: Aaron Feld, MD    05/22/2019 10:00
"@

Note 'n_ed24' (Ts '2024-03-02' '09:10') '34117-2' 'History and physical note' 'pr_ed' 'org_hosp' 'e_ed24' 'Emergency Department Note' @"
ATLAS GENERAL HOSPITAL - EMERGENCY DEPARTMENT NOTE
$HDR
Arrival: 03/02/2024 05:42 by ambulance    Physician: Priya Raman, MD

CHIEF COMPLAINT: Chest pressure.

HPI: 45-year-old man with type 2 diabetes, hypertension, hyperlipidemia, OSA and 25 pack-year smoking (current, 1 pack/day) awoke at 04:30 with substernal pressure radiating to the left arm, diaphoresis and nausea. Took 325 mg aspirin from EMS. Pain 8/10, improved to 4/10 after sublingual nitroglycerin x 2.

EXAM: BP 162/98, HR 104, RR 20, SpO2 94% on room air. Diaphoretic. Regular tachycardia, no murmur. Lungs clear. No edema.

ECG: Sinus tachycardia 102. 1.5 mm ST depression V2-V4. No ST elevation.

DATA: hs-troponin I 86 ng/L at 06:30, 412 ng/L at 08:45. Glucose 212, A1c 9.1%, creatinine 1.18. Chest X-ray: no acute process.

ASSESSMENT: Non-ST elevation myocardial infarction.

PLAN: Heparin infusion, aspirin, atorvastatin 80 mg, metoprolol. Cardiology consulted; admit to cardiac care for catheterization within 24 hours. Smoking cessation counseling started.

Electronically signed: Priya Raman, MD    03/02/2024 09:10
"@

Note 'n_dc24' (Ts '2024-03-05' '13:45') '18842-5' 'Discharge summary' 'pr_hosp' 'org_hosp' 'e_ip24' 'Discharge Summary' @"
ATLAS GENERAL HOSPITAL - DISCHARGE SUMMARY
$HDR
Admitted: 03/02/2024    Discharged: 03/05/2024    Attending: Samuel Okafor, MD

PRINCIPAL DIAGNOSIS: NSTEMI.
SECONDARY: Coronary artery disease; type 2 diabetes with hyperglycemia and polyneuropathy; hypertension; hyperlipidemia; obstructive sleep apnea; morbid obesity (BMI 36.9); tobacco use; fatty liver on imaging.

HOSPITAL COURSE: Admitted from the ED on heparin. Catheterization 03/03 showed a 90% proximal LAD culprit lesion, treated with one 3.0 x 28 mm drug-eluting stent (TIMI 3). Moderate nonobstructive RCA and LCx disease. Echocardiogram 03/04: LVEF 45% with anterior hypokinesis. No arrhythmias. Glucose controlled with basal-bolus insulin; transitioned to glargine 28 units nightly plus metformin, with empagliflozin added for cardiorenal benefit. Nicotine patch declined; patient committed to quitting.

PROCEDURES: Left heart catheterization; PCI with drug-eluting stent, proximal LAD (ICD-10-PCS 027034Z).

DISCHARGE MEDICATIONS: Aspirin 81 mg daily; clopidogrel 75 mg daily x 12 months; atorvastatin 80 mg nightly; metoprolol succinate 50 mg daily; losartan 100 mg daily; empagliflozin 10 mg daily; insulin glargine 28 units nightly; metformin 1000 mg twice daily; nitroglycerin 0.4 mg SL as needed. Home medications otherwise unchanged.

FOLLOW-UP: Cardiology (Dr. Chen) in 4-6 weeks; cardiac rehabilitation referral placed; PCP in 2 weeks. Return for chest pain, shortness of breath, or bleeding.

Electronically signed: Samuel Okafor, MD    03/05/2024 13:45
"@

Note 'n_card24' (Ts '2024-04-09' '15:00') '11506-3' 'Progress note' 'pr_cards' 'org_cards' 'e_card24' 'Cardiology Follow-up' @"
ATLAS HEART & VASCULAR - CARDIOLOGY PROGRESS NOTE
$HDR
Date: 04/09/2024    Cardiologist: Marcus Chen, MD

S: Five weeks after NSTEMI and LAD stent. No angina; walks 20 minutes daily. Started cardiac rehab (session 6 of 36). Quit smoking on 03/02/2024. Mood low since the heart attack; PHQ-9 today 14.
O: BP 134/82, HR 66, weight 119.8 kg. Radial site healed. Lungs clear. No edema.
A: CAD s/p DES to proximal LAD; ischemic cardiomyopathy, LVEF 45%; hypertension improving; depression, moderate.
P: Continue DAPT through 03/2025, high-intensity statin, beta-blocker, ARB and SGLT2 inhibitor. LDL goal under 55 mg/dL; recheck lipids in 6 weeks. PCV20 given today. Communicated PHQ-9 to PCP and behavioral health. Repeat echocardiogram in 3 months.

Electronically signed: Marcus Chen, MD    04/09/2024 15:00
"@

Note 'n_aud26' (Ts '2026-06-10' '14:10') '11488-4' 'Consult note' 'pr_aud' 'org_aud' 'e_aud26' 'Audiology Re-evaluation' @"
ATLAS HEARING & AUDIOLOGY - AUDIOLOGIC RE-EVALUATION
$HDR
Date: 06/10/2026    Audiologist: Jordan Lee, AuD
History: Noise exposure from military service (artillery, small arms) and farm machinery. Bilateral hearing aids since 08/2024, worn 11 hours/day. Constant high-pitched bilateral tinnitus, less bothersome with aids. Hearing in restaurants still difficult.

OTOSCOPY: Clear canals, intact tympanic membranes OU.
TYMPANOMETRY: Type A OU.

PURE-TONE THRESHOLDS (dB HL)
Frequency (Hz)   500  1000  2000  4000  8000
Right ear         20    20    30    60    55
Left ear          20    25    35    65    60
(2024: R 15/15/25/55/45, L 15/20/30/60/50)

SPEECH: Word recognition 88% right, 84% left at comfortable levels.

ASSESSMENT: Bilateral sensorineural hearing loss with a 4 kHz notch typical of noise exposure; mild progression since 2024 (about 5 dB at 4-8 kHz). Bilateral tinnitus.

PLAN: Reprogrammed aids (+4 dB high-frequency gain, restaurant program added). Recommended a remote microphone accessory. Custom musician-style earplugs for farm work. Recheck in 12 months.

Electronically signed: Jordan Lee, AuD    06/10/2026 14:10
"@

Note 'n_eye26' (Ts '2026-07-14' '10:40') '11506-3' 'Progress note' 'pr_od' 'org_eye' 'e_eye26' 'Eye Exam: Glaucoma Follow-up and Refraction' @"
ATLAS EYE & RETINA CENTER - PROGRESS NOTE
$HDR
Date: 07/14/2026    Optometrist: Claire Dubois, OD (co-managing with Rajiv Mehta, MD)

S: Using latanoprost nightly; misses about one dose a week. Near vision blurrier; current glasses 3 years old. No eye pain or halos.
O:
Best-corrected visual acuity: OD 20/20, OS 20/25.
IOP (applanation): OD 17, OS 18 mmHg (baseline 26/27 before treatment).
Optic nerves: C/D 0.65 OD, 0.70 OS with inferior rim thinning OS.
OCT RNFL: 78 um OD, 72 um OS (2025: 82/76).
Visual field 24-2: stable inferior arcuate defect OS; OD full.
Dilated fundus: No diabetic retinopathy OU.
Refraction: OD -2.75 -0.50 x 090, OS -3.25 -0.75 x 085, add +1.50.
A:
1. Primary open-angle glaucoma OU, mild stage; IOP at target, but RNFL thinning continues slowly.
2. Myopia with astigmatism and presbyopia.
3. Type 2 diabetes without diabetic retinopathy.
P:
1. Continue latanoprost; adherence counseling; consider adding timolol if RNFL progression continues on next OCT.
2. New progressive glasses prescribed.
3. Return in 4 months for IOP check; OCT and visual field in 6 months; dilated diabetic exam yearly.

Electronically signed: Claire Dubois, OD    07/14/2026 10:40
"@

Note 'n_derm26' (Ts '2026-04-07' '10:10') '11506-3' 'Progress note' 'pr_derm' 'org_derm' 'e_derm26' 'Dermatology Follow-up: Skin Check' @"
ATLAS DERMATOLOGY & MOHS SURGERY - PROGRESS NOTE
$HDR
Date: 04/07/2026    Dermatologist: Naomi Blake, MD

S: Ten months after Mohs surgery for BCC of the left nasal ala. Psoriasis flares on the scalp, elbows and knees in winter; uses clobetasol solution and calcipotriene cream. Farm work with limited sun protection.
O: Full-body skin exam. Well-healed bilobed flap scar, left nasal ala, no recurrence. Six rough, erythematous scaly papules on the scalp and forehead. Psoriatic plaques: scalp, both elbows and both knees, about 4% body surface area. Nail pitting on 3 fingernails. No suspicious pigmented lesions.
A:
1. History of basal cell carcinoma, no recurrence.
2. Actinic keratoses x 6.
3. Plaque psoriasis, about 4% BSA, with nail involvement; no joint symptoms.
P:
1. Cryotherapy to 6 actinic keratoses today, followed by 3 weeks of 5-fluorouracil cream field treatment.
2. Continue topical psoriasis therapy; discussed biologic options if BSA goes above 10% or joint symptoms develop.
3. Daily broad-spectrum SPF 30+, wide-brim hat.
4. Full skin exam every 6 months.

Electronically signed: Naomi Blake, MD    04/07/2026 10:10
"@

Note 'n_dent26' (Ts '2026-02-11' '09:30') '11488-4' 'Consult note' 'pr_dds' 'org_dental' 'e_dent26a' 'Comprehensive Dental and Periodontal Evaluation' @"
ATLAS FAMILY DENTAL - COMPREHENSIVE ORAL EVALUATION
$HDR
Date: 02/11/2026    Dentist: Sofia Marin, DDS
Medical alerts: Coronary stent (2024), aspirin (no longer on clopidogrel); type 2 diabetes (A1c 7.6%); latex allergy (non-latex gloves used); penicillin allergy.

S: Bleeding gums when brushing; pain chewing on the upper right. Last cleaning 4 years ago.
O:
Periodontal charting: generalized probing depths 4-6 mm, 7 mm at #2 and #31; bleeding on probing 46%; class I furcation on molars; recession 1-2 mm.
Caries: #2 deep distal (non-restorable), #19 occlusal into dentin, #30 recurrent decay under a MOD amalgam.
Missing: #1, #16, #17, #32.
Oral cancer screening: negative.
Radiographs: panoramic and full-mouth series (see report).
A:
1. Chronic periodontitis, generalized, moderate (Stage III, Grade B; diabetes is a risk modifier).
2. Dental caries #2, #19, #30.
P:
1. Referral to periodontics for scaling and root planing, 4 quadrants.
2. Extract #2.
3. Ceramic crown #30; composite #19 (MO).
4. Periodontal maintenance every 3 months; shared the A1c-periodontitis link with the patient and PCP.

Electronically signed: Sofia Marin, DDS    02/11/2026 09:30
"@

Note 'n_bh26' (Ts '2026-07-22' '17:05') '11506-3' 'Progress note' 'pr_psych' 'org_bh' 'e_bh26' 'Psychotherapy Video Visit' @"
ATLAS BEHAVIORAL HEALTH - PROGRESS NOTE (TELEHEALTH)
$HDR
Date: 07/22/2026    Clinician: Grace Holloway, PhD    Visit type: video, patient at home

S: Nightmares down to 1-2 nights per week on prazosin. Sleeping better with CPAP. Mood "steadier"; still withdraws socially around the anniversary of his wife's death in August. Alcohol 1-2 beers on weekends. No suicidal ideation.
O: Alert, engaged, euthymic-to-mildly-dysthymic affect. Linear thought process.
Measures: PHQ-9 = 9 (from 14 in 2024). GAD-7 = 8.
A: PTSD, improving. Major depressive disorder, recurrent, moderate, in partial remission. Anniversary reaction expected.
P: Continue biweekly CBT focused on behavioral activation; anniversary coping plan; continue sertraline 100 mg and prazosin per PCP; connected with a peer veterans group. Safety plan reviewed.

Electronically signed: Grace Holloway, PhD    07/22/2026 17:05
"@

Note 'n_pcp26' (Ts '2026-08-25' '17:30') '11506-3' 'Progress note' 'pr_pcp' 'org_pcp' 'e_pcp26' 'Annual Physical and Chronic Care Visit' @"
ATLAS COMMUNITY PRIMARY CARE - PROGRESS NOTE
$HDR
Date of service: 08/24/2026    Physician: Helena Ortiz, MD

S: 48-year-old man for an annual exam and chronic disease follow-up. No chest pain since the 2024 stent; walks 30 minutes 4 days a week. Smoke-free 2.5 years. Burning in both feet at night, partly helped by gabapentin. Back pain 4/10, flares with lifting. Gout quiet for 14 months. CGM time in range 68%. Recent care: periodontal treatment, new glasses, hearing aids reprogrammed, actinic keratosis treatment.

MEDICATIONS: reviewed and reconciled (see list).

O: BP 138/86, HR 72, RR 16, T 36.8 C, SpO2 95%, BMI 36.3. Monofilament: absent at 4 of 10 sites bilaterally; vibration reduced at both great toes. Pedal pulses 1+. Mild lumbar paraspinal tenderness.

LABS (08/24/2026): A1c 7.4%; creatinine 1.58, eGFR 54 (CKD-EPI 2021); UACR 88 mg/g; K 4.9; LDL 71, HDL 38, TG 196; ALT 48; uric acid 6.8; vitamin D 24; NT-proBNP 210; TSH 2.1; CBC normal.

ASSESSMENT AND PLAN:
1. Type 2 diabetes with polyneuropathy, A1c 7.4%: near goal (under 7%). Refer to endocrinology to consider a GLP-1 RA for glucose, weight and cardiovascular benefit. DSMES referral. Podiatry for loss of protective sensation.
2. CKD 3a with albuminuria (A2), stable: continue losartan and empagliflozin; avoid NSAIDs; nephrology if eGFR falls below 45.
3. CAD with ischemic cardiomyopathy (EF 45%): stable; cardiology follow-up 09/15. LDL 71 is above the goal of 55: discuss adding ezetimibe with cardiology.
4. Hypertension above goal (138/86; goal under 130/80): home BP log for 2 weeks before any change.
5. Morbid obesity, BMI 36.3: GLP-1 RA as above; nutrition referral.
6. COPD (GOLD 2): stable on tiotropium; no exacerbations.
7. OSA: CPAP adherence 87%.
8. PTSD/depression: improving; continue therapy and sertraline.
9. Vitamin D deficiency: cholecalciferol 50,000 units weekly x 8 weeks.
10. Fatty liver (ALT 48): weight loss; recheck in 6 months.
11. Health maintenance: flu shot due in September; colonoscopy up to date (2024); tobacco abstinent.

Electronically signed: Helena Ortiz, MD    08/25/2026 17:30
"@

Note 'n_card26' (Ts '2026-09-15' '11:00') '11506-3' 'Progress note' 'pr_cards' 'org_cards' 'e_card26' 'Cardiology Follow-up' @"
ATLAS HEART & VASCULAR - CARDIOLOGY PROGRESS NOTE
$HDR
Date: 09/15/2026    Cardiologist: Marcus Chen, MD

S: No angina or dyspnea at rest; mild dyspnea climbing 2 flights (COPD versus deconditioning). Completed cardiac rehab in 2024. Adherent to medications.
O: BP 128/78, HR 64, weight 116.5 kg (BMI 35.8). No JVD, lungs clear, no edema. NT-proBNP 210 (08/2026).
A: CAD s/p LAD DES 2024, stable; ischemic cardiomyopathy, LVEF 45% (repeat echo 06/2024: 50%); LDL 71, above goal.
P: Add ezetimibe 10 mg daily (to be prescribed after the endocrinology visit to bundle the changes); continue aspirin, high-intensity statin, metoprolol, losartan, empagliflozin. Supports a GLP-1 RA. Annual follow-up, sooner for symptoms.

Electronically signed: Marcus Chen, MD    09/15/2026 11:00
"@

# =====================================================================
# Referrals and orders
# =====================================================================

SR 'sr_bh18' '2018-04-01' 'completed' $CAT_REF (& $REFER 'Referral to behavioral health (PTSD)') 'pr_pcp' @((Ref 'Practitioner' 'pr_psych'), (Ref 'Organization' 'org_bh')) 'e_bh18' @('c_ptsd') 'Nightmares, hypervigilance, alcohol use for sleep. Evaluate for PTSD and treatment.'
SR 'sr_sleep19' '2019-04-02' 'completed' $CAT_REF (& $REFER 'Referral to sleep medicine') 'pr_pcp' @((Ref 'Practitioner' 'pr_sleep'), (Ref 'Organization' 'org_sleep')) 'e_psg19' @('c_osa') 'Snoring, witnessed apneas, STOP-BANG 6. Polysomnography requested.'
SR 'sr_mri22' '2022-08-30' 'completed' $CAT_IMG (CC $CPT '72148' 'MRI lumbar spine without contrast' 'MRI lumbar spine without contrast') 'pr_pcp' @(Ref 'Organization' 'org_img') 'e_pcp22' @('c_disc') 'Left L5 radiculopathy for 6 weeks despite therapy.'
SR 'sr_esi22' '2022-09-20' 'completed' $CAT_REF (& $REFER 'Referral to interventional pain medicine') 'pr_pcp' @((Ref 'Practitioner' 'pr_pain'), (Ref 'Organization' 'org_pain')) 'e_mri22' @('c_disc') 'L4-5 extrusion with L5 radiculopathy; consider epidural steroid injection.'
SR 'sr_rehab24' '2024-03-05' 'completed' $CAT_REF (& $REFER 'Referral to cardiac rehabilitation') 'pr_hosp' @(Ref 'Organization' 'org_cards') 'e_ip24' @('c_cad', 'c_nstemi') 'Phase II cardiac rehab, 36 sessions, after NSTEMI and PCI.'
SR 'sr_cards24' '2024-03-05' 'completed' $CAT_REF (& $REFER 'Referral to cardiology follow-up') 'pr_hosp' @((Ref 'Practitioner' 'pr_cards'), (Ref 'Organization' 'org_cards')) 'e_ip24' @('c_cad') 'Post-PCI follow-up in 4-6 weeks.'
SR 'sr_aud24' '2024-06-18' 'completed' $CAT_REF (& $REFER 'Referral to audiology') 'pr_pcp' @((Ref 'Practitioner' 'pr_aud'), (Ref 'Organization' 'org_aud')) 'e_card24' @('c_snhl') 'Progressive hearing difficulty and tinnitus; military noise exposure.'
SR 'sr_gi24' '2024-10-01' 'completed' $CAT_REF (& $REFER 'Referral for screening colonoscopy') 'pr_pcp' @((Ref 'Practitioner' 'pr_gi'), (Ref 'Organization' 'org_gi')) 'e_card24' @() 'Average-risk colorectal cancer screening, age 46.'
SR 'sr_eye24' '2024-12-10' 'completed' $CAT_REF (& $REFER 'Referral to ophthalmology (glaucoma)') 'pr_od' @((Ref 'Practitioner' 'pr_ophth'), (Ref 'Organization' 'org_eye')) 'e_aud24' @('c_poag') 'IOP 26/27 mmHg with suspicious optic nerves on routine exam.'
SR 'sr_derm25' '2025-04-22' 'completed' $CAT_REF (& $REFER 'Referral to dermatology') 'pr_pcp' @((Ref 'Practitioner' 'pr_derm'), (Ref 'Organization' 'org_derm')) 'e_card24' @('c_psor') 'Non-healing pearly papule on the left nasal ala; psoriasis management.'
SR 'sr_mohs25' '2025-05-19' 'completed' $CAT_REF (& $REFER 'Referral for Mohs micrographic surgery') 'pr_derm' @((Ref 'Practitioner' 'pr_derm'), (Ref 'Organization' 'org_derm')) 'e_derm25' @('c_bcc') 'Nodular BCC of the left nasal ala, positive deep margin; Mohs indicated (H-zone).'
SR 'sr_perio26' '2026-02-11' 'completed' $CAT_REF (& $REFER 'Referral to periodontics') 'pr_dds' @((Ref 'Practitioner' 'pr_perio'), (Ref 'Organization' 'org_perio')) 'e_dent26a' @('c_perio') 'Stage III Grade B periodontitis; scaling and root planing, 4 quadrants.'
SR 'sr_endo26' '2026-08-24' 'active' $CAT_REF (& $REFER 'Referral to endocrinology') 'pr_pcp' @(Ref 'Practitioner' 'pr_pcp') 'e_pcp26' @('c_dm', 'c_obesity') 'A1c 7.4% on metformin, empagliflozin and glargine; BMI 36. Evaluate for a GLP-1 receptor agonist.'
SR 'sr_pod26' '2026-08-24' 'active' $CAT_REF (& $REFER 'Referral to podiatry') 'pr_pcp' @() 'e_pcp26' @('c_dm') 'Loss of protective sensation (monofilament 4/10 absent bilaterally). Diabetic foot care.'
SR 'sr_dsmes26' '2026-08-24' 'active' $CAT_EDU (CC $HCPCS 'G0108' 'Diabetes outpatient self-management training services, individual, per 30 minutes' 'Diabetes self-management education and support (DSMES)') 'pr_pcp' @() 'e_pcp26' @('c_dm') 'DSMES plus medical nutrition therapy for weight and glucose.'
SR 'sr_echo26' '2026-09-15' 'active' $CAT_IMG (CC $CPT '93306' 'Transthoracic echocardiography, complete, with Doppler' 'Transthoracic echocardiogram') 'pr_cards' @(Ref 'Organization' 'org_cards') 'e_card26' @('c_cad') 'Reassess LV function (EF 45% in 2024, 50% in 06/2024).'

# =====================================================================
# Care team
# =====================================================================
$members = @(
  @('pr_pcp', 'Primary care physician'), @('pr_cards', 'Cardiologist'), @('pr_derm', 'Dermatologist'), @('pr_aud', 'Audiologist'),
  @('pr_ophth', 'Ophthalmologist'), @('pr_od', 'Optometrist'), @('pr_dds', 'Dentist'), @('pr_perio', 'Periodontist'),
  @('pr_psych', 'Psychologist'), @('pr_sleep', 'Sleep medicine physician'), @('pr_rn', 'Care manager (RN)'))
$participants = Each $members { param($m) [ordered]@{ role = @(TextCC $m[1]); member = (Ref 'Practitioner' $m[0] $PRAC[$m[0]]) } }
$participants += [ordered]@{ role = @(TextCC 'Caregiver and power of attorney'); member = (Ref 'RelatedPerson' 'rp_sister' 'Lucilla Meridius') }
Add ([ordered]@{
  resourceType = 'CareTeam'; id = (Id 'ct_main'); meta = (Meta "$UC/us-core-careteam$UCV")
  status = 'active'
  name = 'Maximus Meridius care team'
  subject = (PatRef)
  period = [ordered]@{ start = '2018-04-01' }
  participant = $participants
  managingOrganization = @(Ref 'Organization' 'org_pcp')
})

# =====================================================================
# Claims (CARIN BB ExplanationOfBenefit): institutional, professional,
# pharmacy, oral (dental) and vision
# =====================================================================

$DX_NSTEMI = Dx 'I21.4' 'Non-ST elevation (NSTEMI) myocardial infarction'
$DX_CAD = Dx 'I25.10' 'Atherosclerotic heart disease of native coronary artery without angina pectoris'
$DX_DM = Dx 'E11.42' 'Type 2 diabetes mellitus with diabetic polyneuropathy'
$DX_DMH = Dx 'E11.65' 'Type 2 diabetes mellitus with hyperglycemia'
$DX_HTN = Dx 'I10' 'Essential (primary) hypertension'
$DX_LIPID = Dx 'E78.5' 'Hyperlipidemia, unspecified'
$DX_OB = Dx 'E66.01' 'Morbid (severe) obesity due to excess calories'
$DX_BMI = Dx 'Z68.36' 'Body mass index [BMI] 36.0-36.9, adult'
$DX_OSA = Dx 'G47.33' 'Obstructive sleep apnea (adult) (pediatric)'

# --- institutional: NSTEMI admission ---
Eob @{ k = 'clm_ip24'; kind = 'institutional'; start = '2024-03-02'; end = '2024-03-05'; received = '2024-03-12'; paid = '2024-04-02'; payer = 'payer_med'; billing = 'org_hosp'; cov = 'cov_med'; enc = 'e_ip24'
  care = @((CareRef 'pr_hosp' 'attending' 'Attending'), (CareRef 'pr_icard' 'operating' 'Operating'))
  dx = @($DX_NSTEMI, $DX_CAD, $DX_DMH, $DX_DM, $DX_HTN, $DX_LIPID, $DX_OSA, $DX_OB, (Dx 'Z68.36' 'Body mass index [BMI] 36.0-36.9, adult'))
  pcs = @(@{ c = '027034Z'; d = 'Dilation of Coronary Artery, One Artery with Drug-eluting Intraluminal Device, Percutaneous Approach' })
  info = @(
    [ordered]@{ category = (CC "$C4BB/C4BBSupportingInfoType" 'admissionperiod' 'Admission Period'); timingPeriod = [ordered]@{ start = '2024-03-02'; end = '2024-03-05' } },
    [ordered]@{ category = (CC "$C4BB/C4BBSupportingInfoType" 'typeofbill' 'Type of Bill'); code = (CC 'https://www.nubc.org/CodeSystem/TypeOfBill' '0111' 'Hospital inpatient, admit through discharge') },
    [ordered]@{ category = (CC "$C4BB/C4BBSupportingInfoType" 'admtype' 'Admission Type'); code = (CC 'https://www.nubc.org/CodeSystem/PriorityTypeOfAdmitOrVisit' '1' 'Emergency') },
    [ordered]@{ category = (CC "$C4BB/C4BBSupportingInfoType" 'discharge-status' 'Discharge Status'); code = (CC 'https://www.nubc.org/CodeSystem/PatDischargeStatus' '01' 'Discharged to home or self care') })
  lines = @(
    (Line 'http://terminology.hl7.org/CodeSystem/data-absent-reason' 'not-applicable' 'Not Applicable' 11800 6200 500 @{ rev = '0120'; revDisp = 'Room and board, semi-private'; qty = 3; unit = 'days' }),
    (Line $CPT '93458' 'Left heart catheterization with coronary angiography' 14200 5600 0 @{ rev = '0481'; revDisp = 'Cardiac catheterization lab' }),
    (Line $CPT '92928' 'Percutaneous transcatheter placement of intracoronary stent, single major coronary artery' 28600 11400 0 @{ rev = '0481'; revDisp = 'Cardiac catheterization lab' }),
    (Line $CPT '93306' 'Transthoracic echocardiography, complete, with Doppler' 3100 980 0 @{ rev = '0483'; revDisp = 'Echocardiology' }),
    (Line 'http://terminology.hl7.org/CodeSystem/data-absent-reason' 'not-applicable' 'Not Applicable' 4200 1500 0 @{ rev = '0250'; revDisp = 'Pharmacy, general' }),
    (Line 'http://terminology.hl7.org/CodeSystem/data-absent-reason' 'not-applicable' 'Not Applicable' 2600 820 0 @{ rev = '0300'; revDisp = 'Laboratory, general' })) }

# --- professional ---

Pro 'clm_psg19' '2019-05-20' '2019-05-28' '2019-06-14' 'org_sleep' 'pr_sleep' 'e_psg19' @($DX_OSA) @((Line $CPT '95810' 'Polysomnography, attended, 4 or more parameters' 2400 1150 230)) '22' 'On Campus-Outpatient Hospital' 'pr_pcp'
Pro 'clm_esi22' '2022-10-20' '2022-10-25' '2022-11-15' 'org_pain' 'pr_pain' 'e_esi22' @((Dx 'M51.16' 'Intervertebral disc disorders with radiculopathy, lumbar region')) @((Line $CPT '62323' 'Lumbar epidural injection with imaging guidance' 1450 520 104)) '24' 'Ambulatory Surgical Center' 'pr_pcp'
Pro 'clm_ed24' '2024-03-02' '2024-03-08' '2024-03-29' 'org_hosp' 'pr_ed' 'e_ed24' @($DX_NSTEMI, $DX_DMH, $DX_HTN) @((Line $CPT '99285' 'Emergency department visit, high medical decision making' 1650 420 150)) '23' 'Emergency Room - Hospital'
Pro 'clm_pci24' '2024-03-03' '2024-03-10' '2024-03-31' 'org_cards' 'pr_icard' 'e_ip24' @($DX_NSTEMI, $DX_CAD) @(
  (Line $CPT '93458' 'Left heart catheterization with coronary angiography' 2900 860 0 @{ mod = '26'; modDisp = 'Professional component' }),
  (Line $CPT '92928' 'Percutaneous transcatheter placement of intracoronary stent, single major coronary artery' 3800 1240 0)) '21' 'Inpatient Hospital'
Pro 'clm_card24' '2024-04-09' '2024-04-15' '2024-05-02' 'org_cards' 'pr_cards' 'e_card24' @($DX_CAD, (Dx 'I25.2' 'Old myocardial infarction')) @((Line $CPT '99214' 'Office/outpatient visit, established patient, moderate' 260 142 40), (Line $CPT '90677' 'Pneumococcal conjugate vaccine, 20 valent' 320 265 0), (Line $CPT '90471' 'Immunization administration' 40 25 0))
Pro 'clm_aud24' '2024-07-15' '2024-07-19' '2024-08-06' 'org_aud' 'pr_aud' 'e_aud24' @((Dx 'H90.3' 'Sensorineural hearing loss, bilateral'), (Dx 'H93.13' 'Tinnitus, bilateral'), (Dx 'H83.3X3' 'Noise effects on inner ear, bilateral')) @((Line $CPT '92557' 'Comprehensive audiometry threshold evaluation and speech recognition' 180 92 40), (Line $CPT '92567' 'Tympanometry' 60 28 0)) '11' 'Office' 'pr_pcp'
Pro 'clm_ha24' '2024-08-12' '2024-08-16' '2024-09-10' 'org_aud' 'pr_aud' 'e_had24' @((Dx 'H90.3' 'Sensorineural hearing loss, bilateral'), (Dx 'Z46.1' 'Encounter for fitting and adjustment of hearing aid')) @((Line $HCPCS 'V5261' 'Hearing aid, digital, binaural, behind the ear' 5400 3000 1500), (Line $HCPCS 'V5011' 'Fitting/orientation/checking of hearing aid' 150 90 0))
Pro 'clm_colo24' '2024-11-18' '2024-11-22' '2024-12-10' 'org_gi' 'pr_gi' 'e_colo24' @((Dx 'Z12.11' 'Encounter for screening for malignant neoplasm of colon')) @((Line $CPT '45378' 'Colonoscopy, flexible, diagnostic' 1800 640 0)) '24' 'Ambulatory Surgical Center' 'pr_pcp'
Pro 'clm_eye25' '2025-01-20' '2025-01-24' '2025-02-12' 'org_eye' 'pr_ophth' 'e_eye25' @((Dx 'H40.1131' 'Primary open-angle glaucoma, bilateral, mild stage')) @((Line $CPT '92004' 'Ophthalmological services, comprehensive, new patient' 290 165 40), (Line $CPT '92083' 'Visual field examination, extended' 160 72 0), (Line $CPT '92133' 'Scanning computerized ophthalmic diagnostic imaging, optic nerve' 120 42 0)) '11' 'Office' 'pr_od'
Pro 'clm_derm25' '2025-05-12' '2025-05-16' '2025-06-03' 'org_derm' 'pr_derm' 'e_derm25' @((Dx 'C44.311' 'Basal cell carcinoma of skin of nose'), (Dx 'L40.0' 'Psoriasis vulgaris')) @((Line $CPT '99204' 'Office/outpatient visit, new patient, moderate' 320 168 40 @{ mod = '25'; modDisp = 'Significant, separately identifiable E/M service' }), (Line $CPT '11102' 'Tangential biopsy of skin, single lesion' 210 105 21)) '11' 'Office' 'pr_pcp'
Pro 'clm_mohs25' '2025-06-02' '2025-06-06' '2025-06-27' 'org_derm' 'pr_derm' 'e_mohs25' @((Dx 'C44.311' 'Basal cell carcinoma of skin of nose')) @((Line $CPT '17311' 'Mohs micrographic surgery, head and neck, first stage' 1650 720 144), (Line $CPT '17312' 'Mohs micrographic surgery, head and neck, each additional stage' 900 410 82))
Pro 'clm_derm26' '2026-04-07' '2026-04-10' '2026-04-29' 'org_derm' 'pr_derm' 'e_derm26' @((Dx 'L57.0' 'Actinic keratosis'), (Dx 'L40.0' 'Psoriasis vulgaris')) @((Line $CPT '99214' 'Office/outpatient visit, established patient, moderate' 260 142 40 @{ mod = '25'; modDisp = 'Significant, separately identifiable E/M service' }), (Line $CPT '17000' 'Destruction of premalignant lesion, first lesion' 160 72 14), (Line $CPT '17003' 'Destruction of premalignant lesions, 2 through 14, each' 25 8 2 @{ qty = 5; unit = 'lesions' }))
Pro 'clm_aud26' '2026-06-10' '2026-06-15' '2026-07-01' 'org_aud' 'pr_aud' 'e_aud26' @((Dx 'H90.3' 'Sensorineural hearing loss, bilateral'), (Dx 'Z97.4' 'Presence of external hearing-aid')) @((Line $CPT '92557' 'Comprehensive audiometry threshold evaluation and speech recognition' 180 92 40))
Pro 'clm_eyemed26' '2026-07-14' '2026-07-17' '2026-08-05' 'org_eye' 'pr_od' 'e_eye26' @((Dx 'H40.1131' 'Primary open-angle glaucoma, bilateral, mild stage')) @((Line $CPT '92014' 'Ophthalmological services, comprehensive, established patient' 210 118 40), (Line $CPT '92083' 'Visual field examination, extended' 160 72 0), (Line $CPT '92133' 'Scanning computerized ophthalmic diagnostic imaging, optic nerve' 120 42 0))
Pro 'clm_bh26' '2026-07-22' '2026-07-25' '2026-08-12' 'org_bh' 'pr_psych' 'e_bh26' @((Dx 'F43.10' 'Post-traumatic stress disorder, unspecified'), (Dx 'F33.1' 'Major depressive disorder, recurrent, moderate')) @((Line $CPT '90837' 'Psychotherapy, 60 minutes' 210 140 30 @{ mod = '95'; modDisp = 'Synchronous telemedicine service' })) '10' 'Telehealth Provided in Patient Home'
Pro 'clm_pcp26' '2026-08-24' '2026-08-28' '2026-09-15' 'org_pcp' 'pr_pcp' 'e_pcp26' @((Dx 'Z00.00' 'Encounter for general adult medical examination without abnormal findings'), $DX_DM, (Dx 'N18.31' 'Chronic kidney disease, stage 3a'), $DX_HTN, $DX_CAD, $DX_OB, $DX_BMI, (Dx 'E55.9' 'Vitamin D deficiency, unspecified')) @(
  (Line $CPT '99396' 'Preventive visit, established patient, 40-64 years' 310 190 0),
  (Line $CPT '99214' 'Office/outpatient visit, established patient, moderate' 260 142 40 @{ mod = '25'; modDisp = 'Significant, separately identifiable E/M service' }),
  (Line $CPT '96127' 'Brief emotional/behavioral assessment' 30 6 0))
Pro 'clm_lab26' '2026-08-24' '2026-08-27' '2026-09-10' 'org_lab' 'pr_path' 'e_pcp26' @($DX_DM, (Dx 'N18.31' 'Chronic kidney disease, stage 3a'), $DX_LIPID, (Dx 'E55.9' 'Vitamin D deficiency, unspecified')) @(
  (Line $CPT '80053' 'Comprehensive metabolic panel' 48 12 0), (Line $CPT '80061' 'Lipid panel' 55 14 0), (Line $CPT '83036' 'Hemoglobin; glycosylated (A1C)' 40 10 0),
  (Line $CPT '85025' 'Complete blood count with automated differential' 35 8 0), (Line $CPT '82043' 'Albumin; urine, microalbumin, quantitative' 30 7 0), (Line $CPT '82570' 'Creatinine; other source' 25 5 0),
  (Line $CPT '84443' 'Thyroid stimulating hormone' 45 18 0), (Line $CPT '84550' 'Uric acid; blood' 25 5 0), (Line $CPT '82306' 'Vitamin D; 25 hydroxy' 70 30 0), (Line $CPT '83880' 'Natriuretic peptide' 80 36 0)) '81' 'Independent Laboratory' 'pr_pcp'
Pro 'clm_card26' '2026-09-15' '2026-09-18' '2026-10-02' 'org_cards' 'pr_cards' 'e_card26' @($DX_CAD, (Dx 'I25.2' 'Old myocardial infarction'), $DX_LIPID) @((Line $CPT '99214' 'Office/outpatient visit, established patient, moderate' 260 142 40))

# --- vision plan: routine exam and glasses ---
Pro 'clm_vision26' '2026-07-14' '2026-07-17' '2026-08-05' 'org_eye' 'pr_od' 'e_eye26' @((Dx 'H52.13' 'Myopia, bilateral'), (Dx 'H52.4' 'Presbyopia')) @(
  (Line $CPT '92015' 'Determination of refractive state' 65 45 10),
  (Line $HCPCS 'V2020' 'Frames, purchases' 220 150 70),
  (Line $HCPCS 'V2781' 'Progressive lens, per lens' 180 120 50 @{ qty = 2; unit = 'lenses' })) '11' 'Office' $null 'payer_vision' 'cov_vision'

# --- oral (dental) ---
function Dental($k, $start, $received, $paid, $billing, $prac, $enc, $dx, $lines) {
  Eob @{ k = $k; kind = 'oral'; start = $start; received = $received; paid = $paid; payer = 'payer_dental'; billing = $billing; cov = 'cov_dental'; enc = $enc; care = @(CareRef $prac); dx = $dx; lines = $lines; pos = '11'; posDisp = 'Office' }
}
$DX_PERIO = Dx 'K05.322' 'Chronic periodontitis, generalized, moderate'
$DX_CARIES = Dx 'K02.52' 'Dental caries on pit and fissure surface penetrating into dentin'
Dental 'clm_dent26a' '2026-02-11' '2026-02-13' '2026-03-02' 'org_dental' 'pr_dds' 'e_dent26a' @($DX_PERIO, $DX_CARIES) @(
  (Line $CDT 'D0150' 'Comprehensive oral evaluation, new or established patient' 95 75 0),
  (Line $CDT 'D0210' 'Intraoral, comprehensive series of radiographic images' 150 110 0),
  (Line $CDT 'D0330' 'Panoramic radiographic image' 120 90 0))
Dental 'clm_dent26b' '2026-02-25' '2026-02-27' '2026-03-16' 'org_perio' 'pr_perio' 'e_dent26b' @($DX_PERIO) @(
  (Line $CDT 'D4341' 'Periodontal scaling and root planing, four or more teeth per quadrant' 260 190 38 @{ tooth = '1'; toothDisp = 'Upper right quadrant' }),
  (Line $CDT 'D4341' 'Periodontal scaling and root planing, four or more teeth per quadrant' 260 190 38 @{ tooth = '4'; toothDisp = 'Lower right quadrant' }))
Dental 'clm_dent26c' '2026-03-04' '2026-03-06' '2026-03-23' 'org_dental' 'pr_dds' 'e_dent26c' @($DX_CARIES, (Dx 'K08.409' 'Partial loss of teeth, unspecified cause, unspecified class')) @(
  (Line $CDT 'D7140' 'Extraction, erupted tooth or exposed root' 210 150 30 @{ tooth = '17'; toothDisp = 'Tooth #2 (upper right second molar)' }))
Dental 'clm_dent26d' '2026-08-12' '2026-08-14' '2026-09-01' 'org_dental' 'pr_dds' 'e_dent26d' @($DX_PERIO, $DX_CARIES) @(
  (Line $CDT 'D4910' 'Periodontal maintenance' 160 120 24),
  (Line $CDT 'D2740' 'Crown, porcelain/ceramic' 1350 980 490 @{ tooth = '46'; toothDisp = 'Tooth #30 (lower right first molar)' }),
  (Line $CDT 'D2392' 'Resin-based composite, two surfaces, posterior' 240 170 34 @{ tooth = '36'; toothDisp = 'Tooth #19 (lower left first molar)'; surface = 'MO'; surfaceDisp = 'Mesioclusal (unverified code)' }))

# --- pharmacy fills (NDCs from RxNav) ---
function Fill($k, $date, $medKey, $prac, $days, $qty, $unit, $charge, $allowed, $copay, $refill) {
  $m = $MEDS | Where-Object { $_.k -eq $medKey }
  Eob @{ k = $k; kind = 'pharmacy'; start = $date; received = $date; paid = $date; payer = 'payer_med'; billing = 'org_pharm'; cov = 'cov_med'
    care = @(CareRef $prac 'prescribing' 'Prescribing provider')
    info = @(
      [ordered]@{ category = (CC "$C4BB/C4BBSupportingInfoType" 'dayssupply' 'Days Supply'); valueQuantity = [ordered]@{ value = $days } },
      [ordered]@{ category = (CC "$C4BB/C4BBSupportingInfoType" 'dawcode' 'DAW Code'); code = (CC 'http://terminology.hl7.org/CodeSystem/NCPDPDispensedAsWrittenOrProductSelectionCode' '0' 'No product selection indicated') },
      [ordered]@{ category = (CC "$C4BB/C4BBSupportingInfoType" 'refillnum' 'Refill Number'); valueQuantity = [ordered]@{ value = $refill } })
    lines = @((Line $NDC $m.ndc $m.n $charge $allowed $copay @{ qty = $qty; unit = $unit })); pos = '01'; posDisp = 'Pharmacy' }
}
Fill 'rx_clopi24' '2024-03-05' 'm_clopi' 'pr_icard' 90 90 'tablet' 42 18 10 0
Fill 'rx_atorva26' '2026-07-30' 'm_atorva' 'pr_cards' 90 90 'tablet' 38 14 10 6
Fill 'rx_metformin26' '2026-07-30' 'm_metformin' 'pr_pcp' 90 180 'tablet' 24 9 5 8
Fill 'rx_metop26' '2026-07-30' 'm_metop' 'pr_cards' 90 90 'tablet' 46 20 10 6
Fill 'rx_losartan26' '2026-07-30' 'm_losartan' 'pr_pcp' 90 90 'tablet' 30 12 5 10
Fill 'rx_glargine26' '2026-08-02' 'm_glargine' 'pr_pcp' 30 15 'mL' 420 310 45 9
Fill 'rx_sert26' '2026-08-02' 'm_sert' 'pr_pcp' 90 90 'tablet' 28 10 5 12
Fill 'rx_latanoprost26' '2026-07-14' 'm_latanoprost' 'pr_od' 30 2.5 'mL' 32 14 10 4
Fill 'rx_clobetasol26' '2026-04-07' 'm_clobetasol' 'pr_derm' 30 50 'mL' 88 46 20 2
Fill 'rx_chlorhex26' '2026-02-25' 'm_chlorhex' 'pr_perio' 14 473 'mL' 18 8 5 0

# =====================================================================
Write-Bundle $Output
"Wrote $Output"
Test-Bundle $Output
