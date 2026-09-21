# Personal Health Companion

## Vision

A patient-controlled health data workspace that:

- Imports FHIR health data (planned: SMART Health Links and Apple Health exports)
- Creates a USCDI v3 aligned longitudinal record
- Shows data quality scores from the PIQI Gateway (the app makes no pass/fail checks of its own)
- Explains PIQI Gateway results, such as:
  - Missing medication dosage
  - Missing frequency
  - Missing route
  - Duplicate records
  - Conflicting records
  - Stale records
  - Missing provenance
- Allows patients to:
  - Review findings
  - Confirm data
  - Add patient assertions
  - Annotate potential corrections
- Generates encounter-specific sharing packages
- Supports SMART Health Check-In concepts
- Produces QR, SMART Health Link, and human-readable summaries
