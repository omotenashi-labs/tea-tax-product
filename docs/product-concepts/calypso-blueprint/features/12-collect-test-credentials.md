# Feature: Collect Test Credentials for External Services

**Stage:** Phase 6 — External Service Credentials

---

## Motivation

Tea Tax integrates with several external services that require API credentials for development and testing. Real network requests against sandbox environments are necessary to validate integrations before production. This issue tracks the collection of all required credentials.

---

## Credentials Needed

| Service | Purpose | Status |
|---------|---------|--------|
| **Plaid** | Financial account connection (sandbox mode) | Not collected |
| **OCR Service** | Document extraction (or N/A if using local models only) | TBD — depends on privacy architecture decision |
| **CJ Affiliate** | TurboTax affiliate link tracking (test mode) | Not collected |
| **Other affiliate networks** | H&R Block, TaxAct, FreeTaxUSA referral tracking | Not collected |
| **Anthropic (Claude)** | Frontier model for complex reasoning during intake | Not collected |
| **Email service** | Transactional email for verification, notifications | Not selected |
| **Identity verification** | If needed for credentialed professional consent (post-V1) | Post-V1 |

---

## Test Plan

- [ ] Each collected credential is stored in `.env.test` (not committed to version control)
- [ ] `.env.test` is listed in `.gitignore`
- [ ] Each credential is validated with a basic connectivity test (e.g., Plaid sandbox health check, affiliate link generation test)
- [ ] Missing credentials do not block development — features that depend on uncollected credentials use stubs/mocks until real credentials are available

---

## Notes

This is a dependency for features in Phases 2–5 that call external APIs. Features can be developed with mocked integrations initially, but real API testing (as required by the interview template) depends on these credentials.
