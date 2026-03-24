# Feature: Privacy & Encryption Architecture

**Stage:** Phase 1 — Foundation

---

## Motivation

Privacy is a core tenet of Tea Tax, not a compliance afterthought. The thesis mandates that the platform infrastructure cannot access plaintext user data, that there is no admin "god mode," and that data minimization is practiced throughout. Users are trusting the platform with their most sensitive financial information — the architecture must earn that trust structurally, not just through policy.

The specific zero-knowledge architecture and phasing (full ZK in V1 vs. layered approach) is **TBD**. This feature establishes the privacy primitives that the rest of the system builds on.

Additionally, the platform must be compliant from a regulatory and law enforcement standpoint. The subpoena/legal compliance architecture is **TBD** but must be considered in the design.

---

## Features

- **Encryption at rest:** All user PII and tax situation data encrypted in storage
- **Encryption in transit:** TLS for all network communication
- **No admin data access:** No API, admin panel, database query, or internal tool can retrieve plaintext user data without the user's active session
- **Data minimization:** System only collects and retains data necessary for the stated purpose; raw artifacts can be deleted once structured data is extracted (user choice)
- **Consent management:** Granular, time-bound, revocable consent model for any future third-party access (e.g., CPA marketplace, post-V1)
- **Audit logging:** All data access events are logged and visible to the user in their account
- **Local model processing (where applicable):** Sensitive data processing (OCR, PII extraction) uses proprietary local models to avoid sending plaintext to third-party APIs
- **Regulatory compliance posture:** Architecture designed to support lawful compliance requirements (specifics TBD)

---

## Test Plan

- [ ] Database contents for user records are encrypted; raw SQL queries return ciphertext
- [ ] No admin API endpoint returns plaintext user PII
- [ ] Data export (user-initiated) returns decrypted data; same export path without auth returns nothing
- [ ] Deleting a raw artifact (document, photo) removes it from storage; only extracted structured data remains (if user opted to keep it)
- [ ] Consent grant creates a scoped, time-bound access record; revocation immediately terminates access
- [ ] Audit log accurately reflects all read/write operations on user data, viewable by the user
- [ ] Local model inference pipeline processes sample documents without external API calls for PII fields

---

## Open Items

- [ ] Determine phasing: full zero-knowledge in V1 or layered approach (strong encryption first, ZK properties added later)
- [ ] Design subpoena / law enforcement compliance architecture — platform must be compliant; determine what "compliance" means when the platform structurally cannot access user data
- [ ] Select encryption scheme and key management approach
