# Feature: Tax Situation Object

**Stage:** Phase 1 — Foundation

---

## Motivation

The tax situation object is the central data model of Tea Tax — a structured, portable, user-owned representation of a taxpayer's complete situation. It is the universal intermediate format between the intake experience and the recommendation engine, and it is the artifact the user takes with them if they leave the platform. Every other feature reads from or writes to this object.

For MVP persistence and access rules, this concept maps to:

- `tax_objects` (one user can create many objects)
- `tax_returns` (year and jurisdiction scoped records under a tax object)
- creator-only access via `tax_objects.created_by_user_id` in launch scope

Canonical reference: `docs/requirements/users-tax-objects-ownership-access-spec.md`.

---

## Features

- **Schema definition:** Structured representation covering:
  - Filing status and dependents
  - Income streams (W-2, 1099-NEC, 1099-INT, 1099-DIV, 1099-B, K-1, rental, etc.)
  - Deductions and credits (standard vs. itemized, education, child, earned income, etc.)
  - Life events (marriage, home purchase, job change, birth, retirement, etc.)
  - State residency and multi-state filing indicators
  - Linked documents and raw artifacts (with confidence scores per field)
  - Documentation completeness tracker (what's provided, what's missing, what's optional)
- **CRUD operations:** User can create, read, update, and delete their tax objects
- **Progressive enrichment:** The object is incrementally built as the user provides information through any intake modality; partial objects are valid and storable
- **Portability / export:** User can export the object in a standard format (JSON) to take to any provider or professional
- **Encryption at rest:** The object is encrypted in storage; decryption requires user authentication (specific crypto architecture TBD per open item)

---

## Test Plan

- [ ] A user can create multiple tax objects (for example personal, business, or dependent contexts)
- [ ] For each active filing flow, data is written to the selected `tax_object_id`
- [ ] A tax return record can be created under a tax object for a target year and jurisdiction
- [ ] Each intake modality (chat, document, voice, Plaid) correctly writes to the object schema
- [ ] Partial objects save and load correctly (user resumes intake and sees prior progress)
- [ ] Object export produces valid, self-contained JSON that a third party could parse
- [ ] Deleting the object removes all associated data including linked raw artifacts
- [ ] Object cannot be read without valid user authentication (direct DB access returns ciphertext)
- [ ] Documentation completeness tracker accurately reflects what fields are populated vs. missing
