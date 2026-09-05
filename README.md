# M5-Health
M⁵ Health is an open-source personal and family health app built to explore the CMS Health Tech Ecosystem in practice. It brings health records, coverage information, medications, and other health data into one consumer-controlled experience using modern interoperability standards such as FHIR and SMART.

# PIQI Personal Health Companion - MVP

## Purpose

Build a patient-controlled health data workspace that allows a patient to import health data, assess its quality using the PIQI framework, review findings, and selectively share information with providers.

This application is inspired by CMS Health Tech Ecosystem (HTE) and Kill the Clipboard (KTC) principles, but is not an EHR, provider portal, or clinical decision support application.

---

# MVP User Story

As a patient,

I want to import my health information,

so that I can:

- Understand what health information I have
- Identify missing or duplicate information
- Improve my personal health record
- Decide what information to share
- Generate a shareable package for a healthcare provider

---

# MVP Workflow

1. Import health data
2. Normalize data into a canonical record
3. Run PIQI analysis
4. Review findings
5. View health record
6. Select information to share
7. Export sharing package

---

# Feature 1: Data Import

Support importing health information from:

## SMART Health Links (SHL)

The user should be able to:

- Paste an SHL URL
- Scan an SHL QR Code
- Retrieve the underlying health data
- Store the original SHL package

## PDF Documents

The user should be able to:

- Upload any health-related PDF
- Store the original PDF
- Extract useful information when possible

Examples:

- Apple Health exports
- Provider visit summaries
- Clinical reports
- Health plan documents

The system must be vendor-neutral.

---

# Feature 2: Canonical Health Record

Normalize imported information into a USCDI v3-aligned record.

The MVP supports:

## Demographics

- Name
- Date of Birth
- Sex/Gender

## Medications

- Name
- Dosage
- Frequency
- Route
- Status

## Allergies

- Substance
- Reaction
- Severity

## Conditions

- Diagnosis
- Status

## Labs

- Test
- Value
- Unit
- Date

## Immunizations

- Vaccine
- Date

All records must retain source provenance.

---

# Feature 3: PIQI Analysis

PIQI evaluates data readiness.

PIQI must analyze:

## Completeness

Examples:

- Missing dosage
- Missing frequency
- Missing reaction
- Missing units

## Duplication

Examples:

- Exact duplicates
- Probable duplicates

## Consistency

Examples:

- Conflicting medications
- Conflicting allergies

## Provenance

Examples:

- Missing source
- Unknown source

## Timeliness

Examples:

- Recently updated
- Historical
- Potentially stale

---

# Feature 4: PIQI Findings

Each finding must include:

- What was found
- Why it was flagged
- Suggested action

Example:

Medication:
Atorvastatin

Finding:
Frequency missing

Actions:
- Review
- Ignore For Now
- Remind Me Later

Nothing is automatically changed.

---

# Feature 5: Patient Review

Patients may:

- Confirm information
- Add patient assertions
- Ignore findings

Examples:

- Add missing dosage
- Add missing frequency
- Confirm current medication status

Patient assertions must remain separate from source records.

Source records are immutable.

---

# Feature 6: Data Readiness Scorecard

Display a PIQI Data Readiness Scorecard.

Example:

Overall Readiness: 82%

Dimensions:

- Completeness
- Consistency
- Provenance
- Timeliness
- Patient Review Status

This is NOT a health score.

This is a data quality score.

---

# Feature 7: Human-Readable Health Dashboard

Display the patient's information in a simple format.

Example:

## Medications

Lisinopril 20 mg

Status:
Patient Confirmed

Source:
SMART Health Link

---

## Allergy

Penicillin

Reaction:
Rash

Source:
PDF Import

The user should never need to view raw FHIR resources.

---

# Feature 8: Selective Sharing

The patient chooses what to share.

Example:

☑ Demographics

☑ Medications

☑ Allergies

☐ Labs

☐ Conditions

☐ Immunizations

Sharing must be patient controlled.

---

# Feature 9: Export

Support:

## PDF Export

Human-readable summary.

Includes:

- Selected health information
- Source information
- PIQI summary

## SMART Health Link Export

Create an SHL package containing:

- Selected health information
- Provenance metadata
- Patient assertions

---

# Important Rules

1. Source records are immutable.

2. Patient assertions never overwrite source records.

3. PIQI findings must be explainable.

4. Provenance must be preserved.

5. Data Readiness is not a health score.

6. Clinical conclusions are outside MVP scope.

7. Provider review is outside MVP scope.

8. The application is a personal health data workspace, not an EHR.

---

# Non-Goals

The MVP will NOT include:

- EHR integration
- Provider portal integration
- ID.me integration
- CLEAR integration
- Clinical decision support
- Treatment recommendations
- Risk prediction
- Direct EHR writeback
- CMS-Aligned Network participation
- Provider reconciliation workflows

---

# Success Criteria

The MVP is successful when a user can:

1. Import a PDF or SMART Health Link.

2. View a unified health record.

3. Receive PIQI findings.

4. Review or ignore findings.

5. Add patient assertions.

6. View a Data Readiness Scorecard.

7. Select information for sharing.

8. Export selected information as a PDF or SMART Health Link.

