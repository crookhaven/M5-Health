# Builds synthetic patient Mavis Dracula (38 F): a realistic, moderate record
# for a typical Marketplace shopper. A few chronic conditions, a short list of
# common prescriptions with RxNorm codes (what the Compare plans drug check
# needs), one year of ordinary care, and medical claims. All data is fictional
# (tagged HTEST). Codes were checked against RxNav, NLM Clinical Tables and
# tx.fhir.org.
param(
  [string]$Output = (Join-Path $PSScriptRoot 'mavis-dracula.json'),
  [string]$FhirBase = 'https://hapi.fhir.org/baseR4'
)
$ErrorActionPreference = 'Stop'
$PatId = 'MVD-SYN-0000000038-2'
$IdPrefix = 'MVD'
$Base = $FhirBase
. (Join-Path $PSScriptRoot '..\lib\FhirBuilders.ps1')
. (Join-Path $PSScriptRoot '..\lib\ClinicalBuilders.ps1')
$HDR = "Patient: Mavis Dracula    DOB: 02/14/1988    MRN: $PatId"
$ROUTES['nasal'] = @('46713006', 'Nasal route')

# =====================================================================
# Patient and emergency contact
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
    [ordered]@{ url = "$UC/us-core-birthsex"; valueCode = 'F' }
  )
  identifier = @([ordered]@{ use = 'usual'; type = (CC 'http://terminology.hl7.org/CodeSystem/v2-0203' 'MR' 'Medical record number'); system = 'https://parkerapex.com/atlas/mrn'; value = $PatId })
  active = $true
  name = @([ordered]@{ use = 'official'; family = 'Dracula'; given = @('Mavis') })
  telecom = @(
    [ordered]@{ system = 'phone'; value = '555-0138'; use = 'mobile' },
    [ordered]@{ system = 'email'; value = 'mavis.dracula@example.org'; use = 'home' })
  gender = 'female'
  birthDate = '1988-02-14'
  address = @([ordered]@{ use = 'home'; line = @('1 Castle Hill Road'); city = 'Springfield'; state = 'IL'; postalCode = '62703'; country = 'US' })
  maritalStatus = (CC 'http://terminology.hl7.org/CodeSystem/v3-MaritalStatus' 'M' 'Married')
  communication = @([ordered]@{ language = (CC 'urn:ietf:bcp:47' 'en-US' 'English (United States)'); preferred = $true })
})
Add ([ordered]@{
  resourceType = 'RelatedPerson'; id = (Id 'rp_husband'); meta = (Meta "$UC/us-core-relatedperson$UCV")
  active = $true; patient = (PatRef)
  relationship = @((CC 'http://terminology.hl7.org/CodeSystem/v3-RoleCode' 'HUSB' 'husband'), (CC 'http://terminology.hl7.org/CodeSystem/v2-0131' 'C' 'Emergency Contact'))
  name = @([ordered]@{ family = 'Loughran'; given = @('Jonathan') })
  telecom = @([ordered]@{ system = 'phone'; value = '555-0139'; use = 'mobile' })
  address = @([ordered]@{ line = @('1 Castle Hill Road'); city = 'Springfield'; state = 'IL'; postalCode = '62703' })
})

# =====================================================================
# Organizations, practitioners, coverage
# =====================================================================
Org 'org_pcp' 'Atlas Community Primary Care'
Org 'org_uc' 'Atlas Urgent Care'
Org 'org_neuro' 'Atlas Neurology Associates'
Org 'org_bh' 'Atlas Behavioral Health'
Org 'org_womens' "Atlas Women's Health"
Org 'org_lab' 'Atlas Reference Laboratory'
Org 'payer_med' 'Atlas Marketplace Health Plan' 'pay' 'Payer'

Prac 'pr_pcp' 'Nadia' 'Petrescu' 'MD' 'org_pcp' '207Q00000X' 'Family Medicine'
Prac 'pr_uc' 'Kevin' 'Brooks' 'MD' 'org_uc' '207P00000X' 'Emergency Medicine'
Prac 'pr_neuro' 'Ivan' 'Novak' 'MD' 'org_neuro' '2084N0400X' 'Neurology'
Prac 'pr_bh' 'Elena' 'Popa' 'LCSW' 'org_bh' '1041C0700X' 'Clinical Social Worker'
Prac 'pr_gyn' 'Sarah' 'Wolfe' 'MD' 'org_womens' '207V00000X' 'Obstetrics & Gynecology'
Prac 'pr_path' 'Laura' 'Kim' 'MD' 'org_lab' '207ZP0102X' 'Anatomic & Clinical Pathology'
Prac 'pr_rn' 'Marta' 'Jones' 'RN' 'org_pcp' '163W00000X' 'Registered Nurse'

Coverage 'cov_med' 'payer_med' 'HMO' 'health maintenance organization policy' 'Atlas Silver 4500 HMO' 'Individual Marketplace' '2025-01-01' 'AMP-562-38-1988' '38'

# =====================================================================
# Encounters (the past year)
# =====================================================================
Enc 'e_neuro25' (Ts '2025-11-04' '10:00') (Ts '2025-11-04' '10:50') 'AMB' 'consult' 'pr_neuro' 'org_neuro' @('c_migraine') 'Neurology consultation: migraines'
Enc 'e_uc26' (Ts '2026-01-18' '19:10') (Ts '2026-01-18' '20:25') 'AMB' 'problem' 'pr_uc' 'org_uc' @('c_asthma') 'Urgent care: asthma flare'
Enc 'e_pcp26a' (Ts '2026-03-10' '08:30') (Ts '2026-03-10' '09:20') 'AMB' 'checkup' 'pr_pcp' 'org_pcp' @('c_hypo', 'c_asthma', 'c_gad') 'Annual physical'
Enc 'e_bh26a' (Ts '2026-04-21' '17:00') (Ts '2026-04-21' '17:45') 'VR' 'tele' 'pr_bh' 'org_bh' @('c_gad') 'Video visit: therapy'
Enc 'e_gyn26' (Ts '2026-06-02' '09:00') (Ts '2026-06-02' '09:30') 'AMB' 'checkup' 'pr_gyn' 'org_womens' @() 'Well-woman exam'
Enc 'e_bh26b' (Ts '2026-07-14' '17:00') (Ts '2026-07-14' '17:45') 'VR' 'tele' 'pr_bh' 'org_bh' @('c_gad') 'Video visit: therapy'
Enc 'e_pcp26b' (Ts '2026-09-08' '15:00') (Ts '2026-09-08' '15:25') 'AMB' 'followup' 'pr_pcp' 'org_pcp' @('c_hypo', 'c_rhinitis') 'Follow-up: thyroid and allergies'

# =====================================================================
# Conditions, allergies
# =====================================================================
Cond 'c_rhinitis' 'Seasonal allergic rhinitis' '367498001' 'Seasonal allergic rhinitis' 'J30.2' 'Other seasonal allergic rhinitis' '2005-04-01'
Cond 'c_asthma' 'Mild persistent asthma' '426979002' 'Mild persistent asthma' 'J45.30' 'Mild persistent asthma, uncomplicated' '2009-04-01'
Cond 'c_migraine' 'Migraine without aura' '56097005' 'Migraine without aura' 'G43.009' 'Migraine without aura, not intractable, without status migrainosus' '2014-03-01'
Cond 'c_hypo' 'Hypothyroidism' '40930008' 'Hypothyroidism' 'E03.9' 'Hypothyroidism, unspecified' '2017-08-15'
Cond 'c_gad' 'Generalized anxiety disorder' '21897009' 'Generalized anxiety disorder' 'F41.1' 'Generalized anxiety disorder' '2021-02-10'

Allergy 'a_sulfa' (CC $RX '10180' 'sulfamethoxazole' 'Sulfamethoxazole (sulfa antibiotics)') 'allergy' 'medication' 'high' '2012-09-03' (CC $SCT '271807003' 'Eruption' 'Widespread rash') 'moderate' 'Rash with trimethoprim-sulfamethoxazole for a urinary tract infection.'
Allergy 'a_garlic' (TextCC 'Garlic') 'allergy' 'food' 'low' '2016-10-31' (CC $SCT '126485001' 'Urticaria' 'Hives') 'mild' $null

# =====================================================================
# Medications: the active list, plus one dose change and one short course
# =====================================================================
Med 'm_levo75' '966222' 'levothyroxine sodium 0.075 MG Oral Tablet' 'oral' 'Take 1 tablet by mouth every morning on an empty stomach, 30-60 minutes before breakfast.' '2024-09-10' 'stopped' 'pr_pcp' $null @('c_hypo') 90 'tablet' 0.075 'mg' 'Dose increased to 88 mcg on 2026-09-08 (TSH 4.9).'
Med 'm_levo88' '966253' 'levothyroxine sodium 0.088 MG Oral Tablet' 'oral' 'Take 1 tablet by mouth every morning on an empty stomach, 30-60 minutes before breakfast.' '2026-09-08' 'active' 'pr_pcp' 'e_pcp26b' @('c_hypo') 90 'tablet' 0.088 'mg' 'Recheck TSH in 6-8 weeks.'
Med 'm_sert' '312941' 'sertraline 50 MG Oral Tablet' 'oral' 'Take 1 tablet by mouth daily.' '2021-02-10' 'active' 'pr_pcp' $null @('c_gad') 90 'tablet' 50 'mg'
Med 'm_suma' '313161' 'sumatriptan 50 MG Oral Tablet' 'oral' 'Take 1 tablet at the start of a migraine; may repeat once after 2 hours. No more than 200 mg in 24 hours.' '2025-11-04' 'active' 'pr_neuro' 'e_neuro25' @('c_migraine') 9 'tablet' 50 'mg' $null $true
Med 'm_flovent' '895994' '120 ACTUAT fluticasone propionate 0.044 MG/ACTUAT Metered Dose Inhaler' 'inh' 'Inhale 2 puffs twice daily. Rinse mouth after each use.' '2026-01-18' 'active' 'pr_uc' 'e_uc26' @('c_asthma') 1 'inhaler'
Med 'm_albuterol' '2123076' 'NDA020983 200 ACTUAT albuterol 0.09 MG/ACTUAT Metered Dose Inhaler' 'inh' 'Inhale 2 puffs every 4-6 hours as needed for wheezing or shortness of breath.' '2026-01-18' 'active' 'pr_uc' 'e_uc26' @('c_asthma') 1 'inhaler' $null $null $null $true
Med 'm_flonase' '1797907' 'fluticasone propionate 0.05 MG/ACTUAT Metered Dose Nasal Spray' 'nasal' 'Spray 2 sprays in each nostril daily during allergy season.' '2026-09-08' 'active' 'pr_pcp' 'e_pcp26b' @('c_rhinitis') 1 'bottle'
Med 'm_pred' '312615' 'prednisone 20 MG Oral Tablet' 'oral' 'Take 2 tablets (40 mg) by mouth daily for 5 days.' '2026-01-18' 'completed' 'pr_uc' 'e_uc26' @('c_asthma') 10 'tablet' 40 'mg' 'Five-day course for asthma flare, completed.'

# =====================================================================
# Immunizations
# =====================================================================
Immz 'i_tdap' '115' 'Tdap' '2019-05-20' 'TD19E20' 'LA' 'pr_rn'
Immz 'i_flu25' '150' 'Influenza, split virus, quadrivalent, PF' '2025-10-14' 'FL25J14' 'LA' 'pr_rn'
Immz 'i_covid25' '213' 'SARS-COV-2 (COVID-19) vaccine, UNSPECIFIED' '2025-10-14' 'CV25J14' 'RA' 'pr_rn'

# =====================================================================
# Observations
# =====================================================================
Vitals 'vs26uc' (Ts '2026-01-18' '19:15') 'e_uc26' 'pr_uc' @{ sys = 124; dia = 80; hr = 98; rr = 22; temp = 37.0; spo2 = 94 }
Vitals 'vs26a' (Ts '2026-03-10' '08:35') 'e_pcp26a' 'pr_rn' @{ sys = 118; dia = 76; hr = 72; rr = 14; temp = 36.7; spo2 = 98; ht = 165.1; wt = 63.5; bmi = 23.3; pain = 0 }
Vitals 'vs26b' (Ts '2026-09-08' '15:05') 'e_pcp26b' 'pr_rn' @{ sys = 116; dia = 74; hr = 70; spo2 = 98; wt = 64.2 }

$t = Ts '2026-03-11' '07:20'
$cmp = LabSet 'lab26a' '2026-03-10' $t 'e_pcp26a' @(
  (Row '2345-7' 88 'mg/dL' 70 99 'N'), (Row '2160-0' 0.78 'mg/dL' 0.57 1.00 'N'), (Row '98979-8' 100 'mL/min/{1.73_m2}' 60 $null 'N'),
  (Row '2951-2' 140 'mmol/L' 136 145 'N'), (Row '2823-3' 4.1 'mmol/L' 3.5 5.1 'N'))
$thyroid = LabSet 'lab26a' '2026-03-10' $t 'e_pcp26a' @(
  (Row '3016-3' 2.8 'm[IU]/L' 0.4 4.5 'N' 'Thyrotropin [Units/volume] in Serum or Plasma'),
  (Row '3024-7' 1.2 'ng/dL' 0.8 1.8 'N' 'Thyroxine (T4) free [Mass/volume] in Serum or Plasma'))
$cbc = LabSet 'lab26a' '2026-03-10' $t 'e_pcp26a' @(
  (Row '6690-2' 6.2 '10*3/uL' 4.0 11.0 'N' 'Leukocytes [#/volume] in Blood by Automated count'), (Row '718-7' 12.1 'g/dL' 12.0 15.5 'N' 'Hemoglobin [Mass/volume] in Blood'),
  (Row '4544-3' 37.0 '%' 35 45 'N' 'Hematocrit [Volume Fraction] of Blood by Automated count'), (Row '777-3' 260 '10*3/uL' 150 400 'N' 'Platelets [#/volume] in Blood by Automated count'),
  (Row '2276-4' 18 'ng/mL' 15 150 'N' 'Ferritin [Mass/volume] in Serum or Plasma'))
$lipid = LabSet 'lab26a' '2026-03-10' $t 'e_pcp26a' @(
  (Row '2093-3' 182 'mg/dL' $null 199 'N' 'Cholesterol [Mass/volume] in Serum or Plasma'), (Row '2571-8' 96 'mg/dL' $null 149 'N' 'Triglyceride [Mass/volume] in Serum or Plasma'),
  (Row '2085-9' 62 'mg/dL' 50 $null 'N' 'Cholesterol in HDL [Mass/volume] in Serum or Plasma'), (Row '13457-7' 101 'mg/dL' $null 99 'H' 'Cholesterol in LDL [Mass/volume] in Serum or Plasma by calculation'))
LabReport 'dr_lab26a' '11502-2' 'Laboratory report' '2026-03-10' $t 'e_pcp26a' (@($cmp) + @($thyroid) + @($cbc))
LabReport 'dr_lipid26a' '24331-1' 'Lipid 1996 panel - Serum or Plasma' '2026-03-10' $t 'e_pcp26a' $lipid
[void](LabSet 'lab26b' '2026-09-08' (Ts '2026-09-09' '07:20') 'e_pcp26b' @(
  (Row '3016-3' 4.9 'm[IU]/L' 0.4 4.5 'H' 'Thyrotropin [Units/volume] in Serum or Plasma'),
  (Row '3024-7' 0.9 'ng/dL' 0.8 1.8 'N' 'Thyroxine (T4) free [Mass/volume] in Serum or Plasma')))

[void](Obs @{ k = 'phq26'; cat = 'survey'; code = '44261-6'; disp = 'Patient Health Questionnaire 9 item (PHQ-9) total score [Reported]'; v = 5; u = '{score}'; date = (Ts '2026-03-10' '08:40'); e = 'e_pcp26a'; perfType = 'Practitioner'; perf = 'pr_rn' })
[void](Obs @{ k = 'gad26a'; cat = 'survey'; code = '70274-6'; disp = 'Generalized anxiety disorder 7 item (GAD-7) total score [Reported.PHQ]'; v = 11; u = '{score}'; date = (Ts '2026-03-10' '08:40'); e = 'e_pcp26a'; perfType = 'Practitioner'; perf = 'pr_rn' })
[void](Obs @{ k = 'gad26b'; cat = 'survey'; code = '70274-6'; disp = 'Generalized anxiety disorder 7 item (GAD-7) total score [Reported.PHQ]'; v = 7; u = '{score}'; date = (Ts '2026-07-14' '17:05'); e = 'e_bh26b'; perfType = 'Practitioner'; perf = 'pr_bh' })
[void](Obs @{ k = 'smoke26'; cat = 'social-history'; code = '72166-2'; disp = 'Tobacco smoking status'; vcc = (CC $SCT '266919005' 'Never smoked tobacco' 'Never smoker'); date = (Ts '2026-03-10' '08:40'); e = 'e_pcp26a'; perfType = 'Practitioner'; perf = 'pr_rn' })

# =====================================================================
# Procedures
# =====================================================================
Proc 'p_neb' (CC $CPT '94640' 'Inhalation treatment, nebulizer' 'Nebulized albuterol treatment') (Ts '2026-01-18' '19:30') 'e_uc26' 'pr_uc' @('c_asthma') $null 'Albuterol 2.5 mg nebulized x 2; wheezing resolved, SpO2 94% to 98%.'
Proc 'p_spiro' (CC $CPT '94010' 'Spirometry' 'Spirometry') (Ts '2026-03-10' '09:00') 'e_pcp26a' 'pr_pcp' @('c_asthma') $null 'FEV1 88% predicted, FEV1/FVC 0.78; normal after flare.'
Proc 'p_pap' (CC $HCPCS 'Q0091' 'Screening Papanicolaou smear; obtaining, preparing and conveyance to laboratory' 'Cervical cancer screening (Pap with HPV co-test)') (Ts '2026-06-02' '09:10') 'e_gyn26' 'pr_gyn' @() $null 'Negative for intraepithelial lesion; HPV negative. Repeat in 5 years.'

# =====================================================================
# Clinical notes
# =====================================================================
Note 'n_neuro25' (Ts '2025-11-04' '11:15') '11488-4' 'Consult note' 'pr_neuro' 'org_neuro' 'e_neuro25' 'Neurology Consultation: Migraine' @"
ATLAS NEUROLOGY ASSOCIATES - NEUROLOGY CONSULTATION
$HDR
Date: 11/04/2025    Neurologist: Ivan Novak, MD    Referred by: Nadia Petrescu, MD

HISTORY: 37-year-old woman with migraine since age 26. Now 4-5 headache days per month, pulsating, one-sided, with light and sound sensitivity and nausea; no aura. Triggers: poor sleep, skipped meals, red wine, premenstrual days. Ibuprofen helps about half the time. No red flags (no new pattern after 50, no neurologic deficits, no thunderclap onset). Exam normal, including fundi.

ASSESSMENT: Migraine without aura, episodic (fewer than 15 days per month). Does not need daily prevention at this frequency.

PLAN:
1. Sumatriptan 50 mg at onset; may repeat after 2 hours. Limit acute medicines to 10 days per month to avoid rebound headache.
2. Headache diary; sleep regularity; magnesium 400 mg nightly optional.
3. Start a preventive (propranolol is limited by asthma; consider topiramate) if 8 or more headache days per month.
4. Follow up as needed.

Electronically signed: Ivan Novak, MD    11/04/2025 11:15
"@

Note 'n_uc26' (Ts '2026-01-18' '20:30') '11506-3' 'Progress note' 'pr_uc' 'org_uc' 'e_uc26' 'Urgent Care Visit: Asthma Flare' @"
ATLAS URGENT CARE - VISIT NOTE
$HDR
Date: 01/18/2026    Physician: Kevin Brooks, MD

S: Three days of cough, chest tightness and wheezing after a cold. Using an old albuterol inhaler 4-5 times a day. No controller inhaler. No fever. Never smoker.
O: HR 98, RR 22, SpO2 94%, T 37.0 C. Diffuse expiratory wheezes, speaks in full sentences. After 2 albuterol nebulizer treatments: wheezing resolved, SpO2 98%.
A: Mild persistent asthma with acute exacerbation, triggered by a viral upper respiratory infection.
P: Prednisone 40 mg daily x 5 days. Start fluticasone inhaler 2 puffs twice daily as a daily controller; new albuterol inhaler for rescue. Return or go to the ED for worsening breathing. PCP follow-up within 2 months.

Electronically signed: Kevin Brooks, MD    01/18/2026 20:30
"@

Note 'n_pcp26' (Ts '2026-03-10' '17:00') '11506-3' 'Progress note' 'pr_pcp' 'org_pcp' 'e_pcp26a' 'Annual Physical' @"
ATLAS COMMUNITY PRIMARY CARE - ANNUAL PHYSICAL
$HDR
Date: 03/10/2026    Physician: Nadia Petrescu, MD

S: 38-year-old woman for an annual physical. Asthma well controlled since the January flare; using fluticasone twice daily, albuterol about once a week. Migraines down to 2-3 per month with sumatriptan. Anxiety steady on sertraline; interested in therapy. Takes levothyroxine 75 mcg every morning. Works as a hotel operations manager; walks daily; never smoker; drinks 2-3 glasses of wine a week.
O: BP 118/76, HR 72, BMI 23.3. Normal exam. Spirometry: FEV1 88% predicted, normal ratio.
Screening: PHQ-9 = 5, GAD-7 = 11.
Labs: TSH 2.8, free T4 1.2 (euthyroid on current dose). CBC normal; ferritin 18 (low-normal). LDL 101, HDL 62. Glucose and kidney function normal.
A/P:
1. Mild persistent asthma: well controlled; continue fluticasone and as-needed albuterol. Asthma action plan given.
2. Hypothyroidism: stable on levothyroxine 75 mcg; recheck TSH in 6 months.
3. Migraine without aura: improved; continue sumatriptan as needed.
4. Generalized anxiety disorder: GAD-7 11; continue sertraline 50 mg; referral to therapy (CBT).
5. Low-normal iron stores: iron-rich diet; recheck with next labs.
6. Health maintenance: Pap due (scheduled with gynecology), Tdap current (2019), flu and COVID vaccines given 10/2025.

Electronically signed: Nadia Petrescu, MD    03/10/2026 17:00
"@

Note 'n_pcp26b' (Ts '2026-09-08' '16:00') '11506-3' 'Progress note' 'pr_pcp' 'org_pcp' 'e_pcp26b' 'Follow-up: Thyroid and Allergies' @"
ATLAS COMMUNITY PRIMARY CARE - PROGRESS NOTE
$HDR
Date: 09/08/2026    Physician: Nadia Petrescu, MD

S: More tired over the summer, cold intolerance. Ragweed season congestion and itchy eyes. Asthma quiet. Anxiety better with biweekly therapy (GAD-7 down to 7).
O: BP 116/74, HR 70, weight 64.2 kg (up 0.7 kg). Boggy nasal turbinates. Lungs clear.
Labs: TSH 4.9 (high), free T4 0.9.
A/P:
1. Hypothyroidism, under-replaced: increase levothyroxine to 88 mcg daily; recheck TSH in 6-8 weeks.
2. Seasonal allergic rhinitis: fluticasone nasal spray daily in season; referral to allergy for testing given asthma.
3. Asthma and anxiety: stable; continue current treatment.

Electronically signed: Nadia Petrescu, MD    09/08/2026 16:00
"@

# =====================================================================
# Referrals
# =====================================================================
SR 'sr_neuro25' '2025-10-02' 'completed' $CAT_REF (& $REFER 'Referral to neurology') 'pr_pcp' @((Ref 'Practitioner' 'pr_neuro'), (Ref 'Organization' 'org_neuro')) 'e_neuro25' @('c_migraine') 'Migraines 4-5 days per month despite ibuprofen.'
SR 'sr_bh26' '2026-03-10' 'active' $CAT_REF (& $REFER 'Referral to behavioral health (CBT)') 'pr_pcp' @((Ref 'Practitioner' 'pr_bh'), (Ref 'Organization' 'org_bh')) 'e_pcp26a' @('c_gad') 'GAD-7 11 on sertraline; cognitive behavioral therapy, biweekly.'
SR 'sr_allergy26' '2026-09-08' 'active' $CAT_REF (& $REFER 'Referral to allergy and immunology') 'pr_pcp' @() 'e_pcp26b' @('c_rhinitis', 'c_asthma') 'Seasonal allergic rhinitis with asthma; allergy testing.'

# =====================================================================
# Care team
# =====================================================================
Add ([ordered]@{
  resourceType = 'CareTeam'; id = (Id 'ct_main'); meta = (Meta "$UC/us-core-careteam$UCV")
  status = 'active'; name = 'Mavis Dracula care team'; subject = (PatRef)
  period = [ordered]@{ start = '2017-08-15' }
  participant = @(
    [ordered]@{ role = @(TextCC 'Primary care physician'); member = (Ref 'Practitioner' 'pr_pcp' $PRAC['pr_pcp']) },
    [ordered]@{ role = @(TextCC 'Neurologist'); member = (Ref 'Practitioner' 'pr_neuro' $PRAC['pr_neuro']) },
    [ordered]@{ role = @(TextCC 'Therapist'); member = (Ref 'Practitioner' 'pr_bh' $PRAC['pr_bh']) },
    [ordered]@{ role = @(TextCC 'Gynecologist'); member = (Ref 'Practitioner' 'pr_gyn' $PRAC['pr_gyn']) },
    [ordered]@{ role = @(TextCC 'Emergency contact'); member = (Ref 'RelatedPerson' 'rp_husband' 'Jonathan Loughran') })
  managingOrganization = @(Ref 'Organization' 'org_pcp')
})

# =====================================================================
# Claims: medical only (Silver 4500 HMO: $30 primary care, $65 specialist,
# $75 urgent care, $30 therapy, preventive $0, labs to the deductible).
# No pharmacy claims, so the medication list has one record per drug.
# =====================================================================
$DX_ASTHMA = Dx 'J45.30' 'Mild persistent asthma, uncomplicated'
$DX_HYPO = Dx 'E03.9' 'Hypothyroidism, unspecified'
$DX_GAD = Dx 'F41.1' 'Generalized anxiety disorder'
Pro 'clm_neuro25' '2025-11-04' '2025-11-07' '2025-11-25' 'org_neuro' 'pr_neuro' 'e_neuro25' @((Dx 'G43.009' 'Migraine without aura, not intractable, without status migrainosus')) @((Line $CPT '99204' 'Office/outpatient visit, new patient, moderate' 320 168 65)) '11' 'Office' 'pr_pcp'
Pro 'clm_uc26' '2026-01-18' '2026-01-21' '2026-02-06' 'org_uc' 'pr_uc' 'e_uc26' @((Dx 'J45.31' 'Mild persistent asthma with (acute) exacerbation')) @(
  (Line $CPT '99214' 'Office/outpatient visit, established patient, moderate' 260 142 75),
  (Line $CPT '94640' 'Inhalation treatment, nebulizer' 85 22 0 @{ qty = 2; unit = 'treatments' }),
  (Line $HCPCS 'J7613' 'Albuterol, inhalation solution, unit dose, 1 mg' 12 2 0 @{ qty = 5; unit = 'mg' })) '20' 'Urgent Care Facility'
Pro 'clm_pcp26a' '2026-03-10' '2026-03-13' '2026-03-31' 'org_pcp' 'pr_pcp' 'e_pcp26a' @((Dx 'Z00.00' 'Encounter for general adult medical examination without abnormal findings'), $DX_ASTHMA, $DX_HYPO, $DX_GAD) @(
  (Line $CPT '99395' 'Preventive visit, established patient, 18-39 years' 280 172 0),
  (Line $CPT '94010' 'Spirometry' 75 38 38))
Pro 'clm_lab26a' '2026-03-10' '2026-03-12' '2026-03-30' 'org_lab' 'pr_path' 'e_pcp26a' @($DX_HYPO, (Dx 'Z00.00' 'Encounter for general adult medical examination without abnormal findings')) @(
  (Line $CPT '84443' 'Thyroid stimulating hormone' 45 22 22), (Line $CPT '84439' 'Thyroxine; free' 40 18 18), (Line $CPT '85025' 'Complete blood count with automated differential' 35 9 0),
  (Line $CPT '82728' 'Ferritin' 40 17 17), (Line $CPT '80061' 'Lipid panel' 55 14 0), (Line $CPT '80048' 'Basic metabolic panel' 38 9 0)) '81' 'Independent Laboratory' 'pr_pcp'
Pro 'clm_bh26a' '2026-04-21' '2026-04-24' '2026-05-12' 'org_bh' 'pr_bh' 'e_bh26a' @($DX_GAD) @((Line $CPT '90834' 'Psychotherapy, 45 minutes' 150 96 30 @{ mod = '95'; modDisp = 'Synchronous telemedicine service' })) '10' 'Telehealth Provided in Patient Home' 'pr_pcp'
Pro 'clm_gyn26' '2026-06-02' '2026-06-05' '2026-06-23' 'org_womens' 'pr_gyn' 'e_gyn26' @((Dx 'Z01.419' 'Encounter for gynecological examination (general) (routine) without abnormal findings'), (Dx 'Z12.4' 'Encounter for screening for malignant neoplasm of cervix')) @(
  (Line $CPT '99395' 'Preventive visit, established patient, 18-39 years' 280 172 0),
  (Line $HCPCS 'Q0091' 'Screening Papanicolaou smear; obtaining, preparing and conveyance to laboratory' 60 38 0))
Pro 'clm_bh26b' '2026-07-14' '2026-07-17' '2026-08-04' 'org_bh' 'pr_bh' 'e_bh26b' @($DX_GAD) @((Line $CPT '90834' 'Psychotherapy, 45 minutes' 150 96 30 @{ mod = '95'; modDisp = 'Synchronous telemedicine service' })) '10' 'Telehealth Provided in Patient Home' 'pr_pcp'
Pro 'clm_pcp26b' '2026-09-08' '2026-09-11' '2026-09-29' 'org_pcp' 'pr_pcp' 'e_pcp26b' @($DX_HYPO, (Dx 'J30.2' 'Other seasonal allergic rhinitis')) @(
  (Line $CPT '99213' 'Office/outpatient visit, established patient, low' 180 98 30),
  (Line $CPT '84443' 'Thyroid stimulating hormone' 45 22 22),
  (Line $CPT '84439' 'Thyroxine; free' 40 18 18))

# =====================================================================
Write-Bundle $Output
"Wrote $Output"
Test-Bundle $Output
