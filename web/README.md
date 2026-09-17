# M5 Health -- Web App

A React + Vite implementation of the M5 Health PIQI Personal Health Companion
MVP described in the [repo root README](../README.md). Everything runs
client-side in the browser -- there is no backend, and all data is kept in
`localStorage` on the device.

## Setup

Requires Node.js 20+.

```bash
npm install
npm run dev
```

Then open the printed `localhost` URL. The Import tab has buttons to load
bundled sample data if you don't have a real SMART Health Link, PDF, or
coverage document on hand.

## Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the Vite dev server with hot reload |
| `npm run build` | Production build to `dist/` |
| `npm run preview` | Serve the production build locally |
| `npm test` | Run the Vitest suite |
| `npm run lint` | Run Oxlint |

## What's implemented

- **Import**: sample health record / sample coverage plan, coverage plan
  JSON upload, PDF upload (text extraction via pdfjs, with a manual entry
  form since structured extraction from arbitrary PDFs isn't reliable), and
  SMART Health Links (pasted URL or an uploaded QR code image), including
  real AES-256-GCM JWE decryption and SMART Health Card decoding.
- **Canonical record**: FHIR resources are normalized into six USCDI-aligned
  domains plus Coverage (`src/lib/fhir/normalize.js`).
- **PIQI analysis**: completeness, duplication, consistency, provenance, and
  timeliness checks (`src/lib/piqi/engine.js`), with a Data Readiness
  Scorecard and human-readable Findings review flow. Patient assertions are
  stored separately from source records and never overwrite them.
- **Share & Export**: per-domain sharing selection, a PDF summary export,
  and a SMART Health Link package (real encryption, but this prototype has
  no server to host the encrypted manifest at a retrievable URL -- the
  package downloads locally instead of producing a scannable link).

## Known limitations

- No backend: everything lives in the browser's `localStorage`, so data
  doesn't sync across devices and can be lost by clearing site data.
- SHL export can't produce a URL another app can actually retrieve, since
  that requires hosting. The encryption and packaging are real; only the
  hosting step is missing.
- PDF import extracts raw text but does not attempt structured parsing --
  the patient enters fields manually after reading the extracted text.
