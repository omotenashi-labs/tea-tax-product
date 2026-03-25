# Tea Tax v0 — Product Requirements Document

**Date:** 2026-03-24
**Status:** Draft
**Strategy context:** `docs/strategy/strategy-context-v0.md`
**LG review:** `docs/reviews/lg-review-2026-03-24.md`

---

## 1. Product Vision

Tea Tax is the steward of the **Tax Situation Protocol** — an open, AI-native standard that defines how AI agents represent a taxpayer's financial situation, communicate with tax providers, and route consumers to the right filing option. The protocol fills the gap between the messy, pre-return reality of a taxpayer's life and the structured formats providers need to serve them. The tax industry has a standard for the _output_ (IRS MeF XML for completed returns) but nothing for the _input_.

**Operating principle:** This PRD defines the protocol and reference tooling — not the organizational structure around it. Consortium governance, membership models, and organizational design are out of scope. The protocol's adoption and retention depend entirely on its utility: if the schema is correct, the knowledge base is trustworthy, and the tooling works, participants stay. No governance mechanism substitutes for a protocol that solves real problems.

---

## 2. The Tax Situation Object

The core artifact of the protocol: a structured, portable, AI-native representation of a taxpayer's complete financial situation.

### 2.1 What It Contains

- Filing year, filing status, dependents
- Income streams (W-2, 1099 variants, K-1, rental, etc.) with source, amount, and linked documentation
- Deductions and credits (standard vs. itemized, education, child, earned income, etc.)
- Life events (marriage, home purchase, job change, birth, retirement, etc.)
- State residency and multi-state filing indicators
- Prior-year context (estimated AGI, filing method, provider)
- Documentation completeness tracker with confidence scores per field
- Raw artifacts (documents, photos, recordings) with extracted data

### 2.2 What It Enables

- Any AI agent can produce a tax situation object from a conversation, documents, or financial account connections
- Any tax provider can consume the object and immediately determine the right product, tier, and estimated price
- Any consumer can carry their structured tax situation to any provider without re-entering data
- Any credentialed tax professional can receive a pre-structured client instead of a shoebox

### 2.3 Data Model (MVP Persistence)

| Table         | Purpose                                                                                             |
| ------------- | --------------------------------------------------------------------------------------------------- |
| `users`       | Authenticated accounts                                                                              |
| `tax_objects` | Filing identity and related data per context (individual, joint, business, dependent, estate/trust) |
| `tax_returns` | Year- and jurisdiction-scoped returns under a tax object                                            |

MVP access rule: `tax_objects.created_by_user_id = current_user.id` (creator-only). Sharing via `tax_object_memberships` is deferred.

Canonical source: `docs/requirements/users-tax-objects-ownership-access-spec.md`

---

## 3. v0 Scope — The Artifact Phase

v0 corresponds to Phase 1 of the strategy: "Build the Artifact" (now through April 2026). Three deliverables:

### 3.1 The Schema Specification

A v0.1 definition of the tax situation object — core fields, types, validation rules, edge case handling, extensibility model.

**Design constraints:**

- Deliberately minimal: broad enough to be correct, narrow enough that a future technical working group has room to contribute
- Technically rigorous enough that a CTO can evaluate it in an afternoon
- Informed by prior tax SaaS product management expertise — which fields matter, how tier placement works, what edge cases exist, where providers diverge
- Maps to IRS form/schedule taxonomy (1040 series, Schedules A–F, SE, common supplemental forms)

**Conceptual schema:**

```
TaxSituation {
  filingYear, filingStatus, dependents[]
  incomeStreams[] { type, source, amount, documentation[] }
  deductions[] { type, amount, documentation[] }
  lifeEvents[] { type, date, details }
  priorYearContext { estimatedAGI, filingMethod, provider }
  stateResidency { primary, additional[] }
  documentationCompleteness: float
  confidenceScores: {}
  rawArtifacts[] { type, source, extractedData }
}
```

### 3.2 The Tax Domain Knowledge Base

The schema defines the _shape_ of a tax situation. The knowledge base provides the _rules_ needed to evaluate whether a given tax situation object is correct, complete, and actionable. Without it, the schema is an inert data format.

**What the knowledge base encodes:**

- **IRS form/schedule taxonomy.** Which forms exist, what fields they require, how they relate to each other. Schedule C triggers self-employment tax (Schedule SE). Investment income triggers Schedule D and Form 8949. Rental income requires Schedule E. These dependencies are the validation backbone.
- **Provider tier mapping rules.** Which combination of forms, complexity factors, and income levels maps to which product tier at which provider. A W-2-only filer qualifies for free tiers; a K-1 with foreign tax paid forces a premier tier at one major provider but not at a budget competitor. This is the domain expertise that makes the protocol useful to providers — not just a data container, but an evaluable artifact.
- **Validation logic.** Contradictions (claiming single filing status + dependent spouse), missing dependencies (1099-NEC income without estimated tax payment history), implausible values (negative AGI without capital loss documentation), incomplete form chains (Schedule C present but no SE tax calculation).
- **Tax code rules and thresholds.** AGI limits for Free File eligibility ($89K), credit phase-out ranges, standard deduction amounts by filing status, estimated tax safe harbor rules, EITC qualifying thresholds. These change annually and must be versioned.

The knowledge base also serves as the **training corpus** for the fine-tuned domain model in v1 (see Section 5).

### 3.3 Working Reference Implementation

A transport-agnostic implementation that demonstrates the schema and knowledge base working together end-to-end.

**Demo capabilities:**

- Accept messy inputs: a photo of a W-2, a voice description of a life event, a bank account connection
- Produce a structured tax situation object
- Validate the object against the knowledge base — flag missing fields, contradictions, and form dependency gaps
- Demonstrate that a provider could consume the object and determine tier placement

**Quality bar:** Tangible enough that a non-technical CEO can see it working and a CTO can see the architecture. Does not need to be production-grade.

**Responsive PWA with camera capture:** The reference implementation is a responsive PWA that works across desktop, tablet, and mobile. The user flow is identical on all form factors: upload (or photograph) a W-2 → review extracted data → complete the tax situation → view validation and tier results. On devices with cameras (mobile, tablet, some laptops), the upload step detects camera availability and offers a "Take Photo" option alongside the standard file picker. This is the "sizzle" for CEO conversations — a CEO pulls out their phone, photographs their own W-2, and watches the protocol work in real time. The existing codebase includes production-ready PWA infrastructure (service worker, install prompts, camera capture with progressive enhancement via `use-platform.ts`, platform detection) that makes this feasible within v0 scope.

**Transport is an implementation detail.** AI agent protocol bindings, function schemas, REST APIs, or other transports are packaging decisions made based on audience context — not a product requirement.

---

## 4. Execution Timeline (v0)

| Week          | Deliverable                                                                                                                                                                       |
| ------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1–2           | Tax situation object schema v0.1 — core fields, type definitions, validation rules. Informed by prior tax domain expertise and IRS form/schedule mapping.                         |
| 3–4           | Tax domain knowledge base — form taxonomy, provider tier mappings, validation rules, tax code thresholds. Structured as both a reference document and future model training data. |
| 5–6           | Reference implementation — demo showing schema + knowledge base working end-to-end: messy inputs → structured object → validation → tier placement evaluation.                    |
| 7–8           | Dry runs. Refine the demo. Pressure-test the schema and knowledge base against edge cases. Prepare for CTO-level technical scrutiny.                                              |
| Post-April 15 | First calls with target provider CEOs and CTOs.                                                                                                                                   |

---

## 5. v1: The Fine-Tuned Domain Model

v0 proves the schema and knowledge base are correct. v1 makes them operationally scalable.

The tax domain knowledge base is large and rule-dense. Feeding it into a frontier model's context window for every evaluation is expensive, unreliable, and a trust problem: the more context loaded, the more the model hallucinates or drops rules. In tax, a dropped rule means wrong tier placement, a missed credit, or bad validation. These errors are unacceptable for tax preparation — lost confidence in the system leads to failure to distribute and adopt.

**The v1 deliverable is a fine-tuned small language model** trained on the v0 knowledge base that can evaluate, validate, and reason over tax situation objects reliably without context window pressure. The knowledge base is the training data; the small model is the inference engine that has internalized it.

**Why this matters:**

- **Reliability at scale.** A fine-tuned model produces deterministic, low-variance evaluations. A frontier model with a stuffed context window produces stochastic ones.
- **Cost.** Frontier model API calls for every object evaluation across 150M+ potential filers are prohibitive. A small model collapses unit economics.
- **Trust.** A CTO evaluating the protocol needs confidence that the system won't silently drop a validation rule under context pressure.
- **Privacy.** Sensitive tax data processed by a small model on controlled infrastructure avoids sending PII to third-party frontier model APIs.
- **Moat.** The model improves as the knowledge base grows and as usage data reveals edge cases. A competitor can't replicate this by plugging into Claude or GPT.

---

## 6. Privacy and Security Constraints

Privacy is a constitutional principle of the platform.

### 6.1 Core Tenets

- **No admin data access.** No administrator, employee, or internal system can view a user's tax situation. No god mode.
- **Credentialed access only.** The only window into user data is a credentialed tax professional with explicit, granular, time-bound, auditable, revocable user consent.
- **Encryption is foundational.** Data encrypted at rest, in transit, and in processing. Zero-knowledge and end-to-end encryption principles applied wherever technically feasible.
- **Data minimization.** Collect only what is needed. Retain only what the user consents to. Delete aggressively on consent withdrawal.
- **The portable object is user property.** Export, share, or destroy at will.

### 6.2 Protocol-Specific Security Requirements

- **Zero-knowledge encryption of the tax situation object.** Even the protocol steward cannot access plaintext user data.
- **Cryptographic multi-tenancy.** Competing providers sharing the protocol need cryptographic assurance their data is invisible to every other participant and to the steward.
- **AI model privacy.** Sensitive tax data must not leak into model weights, training pipelines, or third-party API calls during extraction and classification.
- **Circular 230 compliance enforced architecturally.** Credentialed access, granular consent, auditability, revocability — enforced by the system, not by behavior.

### 6.3 Open Items

- Full zero-knowledge in v0 reference implementation vs. layered approach: TBD
- Subpoena/law enforcement compliance architecture: TBD
- Encryption scheme and key management approach: TBD

---

## 7. Regulatory Design Constraint: Circular 230

IRS Circular 230 governs who can practice before the IRS and provide personalized tax guidance. This is a design constraint, not background context.

- **AI cannot substitute for practitioner competence.** IRS National Tax Forum material (2024) explicitly states this.
- **Proposed §10.35** would require practitioners to maintain technological competency, including understanding benefits and risks of AI tools.
- **AI compresses low-leverage tax labor; regulation preserves human accountability** at risk-bearing decision points (written advice, position-taking, representation, sign-off).

**Design implication:** The protocol collects and structures information but does not provide tax advice. The knowledge base encodes tax rules for validation and tier mapping, not for advisory output. When advice or strategy is needed, the protocol routes to credentialed professionals.

---

## 8. Success Criteria for v0

| Criterion                | Measure                                                                                                                                                               |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Schema completeness      | v0.1 covers core 1040-series filing scenarios (W-2 only, freelance/1099, investments, multi-state, rental income) with correct field definitions and validation rules |
| Knowledge base coverage  | Form taxonomy, provider tier mappings, validation rules, and tax code thresholds are encoded and structured for both human review and future model training           |
| Reference implementation | Demo produces a structured object from messy inputs, validates it against the knowledge base, and demonstrates provider tier evaluation                               |
| Camera capture           | On devices with cameras, the upload step offers "Take Photo" alongside file upload — a CEO photographs their W-2 from their phone and sees the full flow              |
| Technical credibility    | A CTO can evaluate the schema and knowledge base in an afternoon and conclude "this is correct"                                                                       |
| Executive credibility    | A non-technical CEO can see the demo working and understand the value proposition — on desktop, tablet, or their own phone                                            |
| Timeline                 | All three deliverables ready before post-April 15 outreach window                                                                                                     |

---

## 9. What v0 Is Not

| Out of Scope                                                                   | Where It Lives                      |
| ------------------------------------------------------------------------------ | ----------------------------------- |
| Consortium governance, membership, and organizational structure                | Organizational design; not product  |
| Fine-tuned domain model                                                        | v1                                  |
| Specific transport bindings (agent protocol servers, function schemas)         | Implementation detail; post-v0      |
| Full consumer-facing intake product (chat, voice, financial account connections) | Phase 5 / Calypso blueprint Phase 2 |
| Comparison engine (pricing, sentiment, ancillary risk)                         | Phase 5 / Calypso blueprint Phase 4 |
| Tax Second Opinion feature                                                     | Phase 5 / Calypso blueprint Phase 3 |
| Community pricing database                                                     | Phase 5 / Calypso blueprint Phase 5 |
| Practitioner Layer / CPA marketplace                                           | Phase 5+                            |
| Done-for-you tax preparation (Superhuman CPA OS)                               | Separate product initiative         |
| Consumer distribution (SEO, content creators, gig platforms, payroll partners) | Phase 5 / Distribution strategy     |
| Political amplification (bipartisan pledge, congressional testimony)           | Post-consumer launch                |
| Affiliate revenue model                                                        | Phase 5                             |
| Threat narrative / pitch deck                                                  | Go-to-market material, not product  |
| Production deployment infrastructure                                           | Post-v0                             |

---

## 10. Engineering Risk

| Risk                                        | Impact                                             | Mitigation                                                                           |
| ------------------------------------------- | -------------------------------------------------- | ------------------------------------------------------------------------------------ |
| Schema requires more iteration than 2 weeks | Phase 2 outreach window compressed                 | Scope v0.1 aggressively minimal. Working group in Phase 3 handles depth.             |
| Knowledge base scope creep                  | Blocks reference implementation                    | Define minimum provider count (top 5) and scenario count upfront. Expand post-v0.    |
| Reference implementation demo scope         | Desktop + mobile PWA demo surfaces                 | Single modality (W-2 OCR). Mobile PWA leverages existing camera/PWA infrastructure.  |
| Privacy open items unresolved               | Blocks handling of real tax data                   | v0 reference implementation may use synthetic data only. Real PII handling deferred. |

---

## 11. Source Documents

| Document                        | Path                                                           | Relationship                                                     |
| ------------------------------- | -------------------------------------------------------------- | ---------------------------------------------------------------- |
| Tax Situation Protocol Strategy | `docs/strategy/tax-situation-protocol-strategy.md`             | Source of truth for v0 scope and strategic framing               |
| Strategy Context (v0)           | `docs/strategy/strategy-context-v0.md`                         | Market thesis, GTM phases, revenue model, team, business risks   |
| LG Review (2026-03-24)          | `docs/reviews/lg-review-2026-03-24.md`                         | Critique and changes to strategy document for PRD purposes       |
| Users/Tax Objects/Access Spec   | `docs/requirements/users-tax-objects-ownership-access-spec.md` | Data model and access rules for the tax situation object         |
| Calypso Blueprint               | `docs/product-concepts/calypso-blueprint/`                     | Consumer product specs. Retained as Phase 5+ implementation ref. |
| Circular 230 AI Memo            | `docs/research/irs-circular-230/circular230-ai-memo.md`        | Regulatory research supporting architectural compliance approach |
