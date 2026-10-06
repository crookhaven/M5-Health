# synthetic-patients

Part of [M5-Health](../README.md). The SMART Health Link file is served from
`https://raw.githubusercontent.com/crookhaven/M5-Health/main/synthetic-patients/shl/kimberly-gonzalez.jwe`.

Synthetic FHIR R4 test patients. **All data is fictional** and every resource is tagged
`HTEST` (test health data). No real PHI.

## Kimberly Gonzalez (`GPX-SYN-0000000279-0`)

68-year-old woman with hypertension, type 2 diabetes, diabetic CKD G3a/A2, diabetic
retinopathy and osteopenia. Built on the APEX Atlas synthetic record and enriched with:

| Content | Resources |
|---|---|
| Imaging | 5 `ImagingStudy` (renal US, OCT/fundus x2, mammogram, DXA) |
| Reports | 5 imaging `DiagnosticReport` + 2 lab panels (CMP, lipid) |
| Clinical notes | 5 consult/progress notes + a `DocumentReference` twin of each imaging report, all sharing `Binary` attachments |
| Medications | 6 `MedicationRequest` (RxNorm verified against RxNav) |
| Referrals / orders | 10 `ServiceRequest` |
| Claims | 10 CARIN BB `ExplanationOfBenefit` (professional) |
| Care team | 6 `Practitioner` + `PractitionerRole`, 8 provider `Organization`s |

Files in `kimberly-gonzalez/`:

- `GPX-SYN-0000000279-0_enriched.json`: the bundle (130 resources). URLs point at the public
  HAPI test server, `https://hapi.fhir.org/baseR4`.
- `build_kimberly_enriched.ps1`: rebuilds the bundle from the source record.
- `publish_to_hapi.ps1`: uploads the bundle to HAPI as a transaction. Re-run it if HAPI has
  been reset.
- `make_shl.ps1`: builds the SMART Health Link.

### SMART Health Link

`shl/kimberly-gonzalez.jwe` is the bundle encrypted as a compact JWE (`dir` / `A256GCM`,
DEFLATE), served from `raw.githubusercontent.com`. The link (flag `U`, no passcode) carries the
key, so the file in this repo is safe to keep public. The link itself and its QR page
(`shl-secret.json`, `shl.html`) are gitignored. Anyone with the link can read the record.

After changing the bundle:

```powershell
cd kimberly-gonzalez
.\make_shl.ps1            # re-encrypts with the same key; commit + push shl/
.\make_shl.ps1 -VerifyOnly  # after pushing: checks the live file decrypts
```

Note: HAPI can't host the SHL file itself, because it rejects the `?recipient=` query
parameter that viewers are required to send.
