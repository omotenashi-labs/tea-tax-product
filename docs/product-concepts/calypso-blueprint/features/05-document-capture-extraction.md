# Feature: Document Capture & Extraction

**Stage:** Phase 2 — Multi-Modal Intake

---

## Motivation

Most taxpayers have physical or digital documents (W-2s, 1099s, receipts, prior returns) that contain the majority of the structured data needed for their tax situation. Manually re-entering this information is tedious and error-prone. This feature lets users upload or photograph their documents and have the system automatically extract structured data into the tax situation object, dramatically reducing friction and improving accuracy.

---

## Features

- **Document upload:** Support for PDF, JPEG, PNG, HEIC uploads of tax documents
- **Camera capture:** In-app camera interface for photographing physical documents (mobile-first)
- **OCR and extraction pipeline:** Extract structured fields from recognized document types:
  - W-2: employer name/EIN, wages, federal/state withholding, Box 12 codes
  - 1099-NEC / 1099-MISC: payer name, nonemployee compensation
  - 1099-INT / 1099-DIV: interest income, qualified dividends, capital gain distributions
  - 1099-B: proceeds, cost basis, gain/loss, holding period
  - Prior year tax return (1040): AGI, filing status, dependents, all schedules
- **Confidence scoring:** Each extracted field has a confidence score; low-confidence fields are flagged for user review
- **User review and correction:** Extracted data is presented for confirmation before being written to the tax situation object
- **Raw artifact management:** Users can view, re-process, or delete uploaded documents; raw artifacts are encrypted at rest
- **Privacy-first processing:** Document extraction uses local models where possible to avoid sending plaintext PII to third-party APIs

---

## Test Plan

- [ ] Upload a W-2 PDF → system extracts employer name, wages, and withholding correctly
- [ ] Upload a 1099-NEC image (photo) → system extracts payer and compensation amount
- [ ] Low-confidence extraction is flagged for user review; user can correct and confirm
- [ ] Confirmed extraction data correctly updates the tax situation object
- [ ] User can view and delete an uploaded document; deletion removes the raw file from storage
- [ ] Extraction pipeline does not send plaintext PII to external services (verify with network traffic inspection in test)
- [ ] Unsupported document type (e.g., random PDF) is handled gracefully with a message asking the user to try a different document
- [ ] Camera capture on mobile produces a usable image that the extraction pipeline can process
