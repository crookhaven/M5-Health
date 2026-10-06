# synthetic-patients

Part of [M5-Health](../README.md). Synthetic FHIR R4 test patients. **All data is fictional**
and every resource is tagged `HTEST` (test health data). No real PHI.

Each patient is published three ways:

1. **Bundle file** in this folder.
2. **FHIR endpoint**: uploaded to the public HAPI test server, `https://hapi.fhir.org/baseR4`.
   It is wiped from time to time; re-run the publish scripts to restore it.
3. **SMART Health Link** (flag `U`, no passcode): the bundle encrypted as a compact JWE
   (`dir` / `A256GCM`, DEFLATE) in `shl/`, served from
   `https://raw.githubusercontent.com/crookhaven/M5-Health/main/synthetic-patients/shl/<patient>.jwe`.
   An EHR can discover the link with `GET DocumentReference?patient=<id>` on HAPI (the entry
   titled "SMART Health Link"). The link carries the key, so the `.jwe` files are safe to keep
   public; each patient's link and QR page (`shl-secret.json`, `shl.html`) are gitignored.

## Patients

### Kimberly Gonzalez (`GPX-SYN-0000000279-0`), 68 F

Hypertension, type 2 diabetes, diabetic CKD G3a/A2, diabetic retinopathy, osteopenia. Built on
the APEX Atlas synthetic record and enriched with imaging (5 studies), reports, 5 clinical
notes, medications, 10 referrals, 10 CARIN BB claims and a care team. 130 resources.

### Maximus Decimus Meridius (`MDM-SYN-0000000048-1`), 48 M

A dense record that fills every M5 category, including hearing, dermatology, dental and vision
care. 408 resources.

| Area | Content |
|---|---|
| Medical | T2DM with neuropathy, HTN, hyperlipidemia, NSTEMI 2024 with LAD drug-eluting stent, CAD, CKD 3a, morbid obesity, OSA on CPAP, COPD, lumbar radiculopathy, PTSD, depression, gout, GERD, fatty liver, vitamin D deficiency |
| Dermatology | Psoriasis, basal cell carcinoma of the nose (dermoscopy, biopsy with pathology report, Mohs surgery), actinic keratoses (cryotherapy, 5-FU) |
| Hearing | Noise-induced bilateral sensorineural loss and tinnitus, two audiograms (LOINC hearing thresholds), tympanometry, bilateral hearing aids |
| Vision | Primary open-angle glaucoma (IOP, cup-disc ratio, OCT RNFL, visual fields), myopia and presbyopia (refraction, visual acuity, progressive glasses) |
| Dental | Generalized periodontitis and caries: comprehensive exam, panoramic X-ray, scaling and root planing, extraction, crown, composite (CDT codes, tooth numbers) |
| Encounters | 25 (office, emergency, inpatient, telehealth) |
| Imaging and reports | 7 studies (MRI, chest X-ray, coronary angiography/PCI, echocardiogram, OCT, dermoscopy, panoramic) with radiology, cardiology and pathology reports |
| Notes | 12 (ED note, discharge summary, cardiology, primary care, behavioral health, sleep study, audiology, eye, dermatology, dental) |
| Also | 122 observations (labs, vitals, hearing, vision, PHQ-9, GAD-7, AUDIT-C, smoking status), 22 medications, 8 immunizations, 23 procedures, 6 devices, 16 referrals, care team, 2 related people, medical/dental/vision coverage, 34 CARIN BB claims (inpatient institutional, professional, pharmacy with NDCs, oral, vision) |

### Mavis Dracula (`MVD-SYN-0000000038-2`), 38 F

A realistic, moderate record for a typical Marketplace shopper, built for testing Compare plans.
114 resources.

| Area | Content |
|---|---|
| Conditions | Mild persistent asthma, hypothyroidism, migraine without aura, generalized anxiety disorder, seasonal allergic rhinitis |
| Medications | 6 active, all with RxNorm codes: levothyroxine 88 mcg, sertraline, sumatriptan, fluticasone inhaler, albuterol inhaler, fluticasone nasal spray. Plus a stopped levothyroxine 75 mcg (dose change) and a completed prednisone course |
| Care | 7 visits in the past year (neurology, urgent care for an asthma flare, annual physical, well-woman exam, 2 therapy video visits, thyroid follow-up), labs, spirometry, Pap, 4 clinical notes, 3 referrals |
| Coverage and claims | One Marketplace plan (Silver 4500 HMO); 8 professional claims. No pharmacy claims, so each medicine appears once |

Her current medicines' RxNorm codes, for the Compare plans drug check:
`$rxcuis = '966253','312941','313161','895994','2123076','1797907'`

Codes were checked against RxNav (RxNorm, NDC), NLM Clinical Tables (LOINC, ICD-10-CM) and
tx.fhir.org (SNOMED CT, CVX, ICD-10-PCS, v3-ActCode). Dental surface codes (`ex-surface`) could
not be verified there and are labeled as such.

## Scripts

- `lib/FhirBuilders.ps1`: shared building blocks (deterministic ids, JSON writer, attachments,
  bundle checks).
- `lib/ClinicalBuilders.ps1`: shared resource builders (encounters, conditions, medications,
  observations, reports, notes, referrals, claims). Set `$IdPrefix` before dot-sourcing so
  organization and practitioner identifiers are unique per patient; HAPI rejects duplicates.
- `kimberly-gonzalez/build_kimberly_enriched.ps1`, `maximus-decimus-meridius/build_maximus.ps1`,
  `mavis-dracula/build_mavis.ps1`: rebuild each bundle. IDs are deterministic, so links stay the same.
- `kimberly-gonzalez/publish_to_hapi.ps1`: uploads a bundle to HAPI, in dependency-ordered
  batches for large bundles. Takes `-Bundle` and `-TransactionOut`.
- `kimberly-gonzalez/make_shl.ps1`: builds a SMART Health Link (`-Bundle`, `-FileUrl`,
  `-JweOut`, `-Label`, `-SecretFile`, `-QrPage`); run with `-VerifyOnly` after pushing.
- `kimberly-gonzalez/publish_shl_docref.ps1`: publishes the link to HAPI as a discoverable
  DocumentReference (`-SecretFile`, `-PatientId`, `-DocId`).

Example, for Maximus (from `synthetic-patients/`):

```powershell
.\maximus-decimus-meridius\build_maximus.ps1
.\kimberly-gonzalez\publish_to_hapi.ps1 -Bundle .\maximus-decimus-meridius\maximus-decimus-meridius.json -TransactionOut .\maximus-decimus-meridius\maximus_transaction.json
.\kimberly-gonzalez\make_shl.ps1 -Bundle .\maximus-decimus-meridius\maximus-decimus-meridius.json -FileUrl https://raw.githubusercontent.com/crookhaven/M5-Health/main/synthetic-patients/shl/maximus-decimus-meridius.jwe -JweOut .\shl\maximus-decimus-meridius.jwe -Label "Maximus Decimus Meridius - synthetic test record" -SecretFile .\maximus-decimus-meridius\shl-secret.json -QrPage .\maximus-decimus-meridius\shl.html
.\kimberly-gonzalez\publish_shl_docref.ps1 -SecretFile .\maximus-decimus-meridius\shl-secret.json -PatientId MDM-SYN-0000000048-1 -DocId shl-MDM-SYN-0000000048-1
```

HAPI can't host the SHL file itself: it rejects the `?recipient=` query parameter that viewers
are required to send.
