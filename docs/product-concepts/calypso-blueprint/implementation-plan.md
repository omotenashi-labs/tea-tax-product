# Tea Tax — Implementation Plan

> **Product name:** Tea Tax
> **Interview date:** 2026-03-22
> **Last updated:** 2026-03-22 (three-vertical reframe, practitioner layer, pricing discovery, V1 metrics)
> **V1 scope:** Intake Engine + Comparison Engine. No marketplace, no Practitioner Layer, no advice/strategy. Architecture anticipates the Practitioner Layer (marketplace + coordination for existing filing software) without building it.
> **Sequencing note:** Tax Second Opinion is treated as a parallel, earlier distribution wedge to build trust and data before/alongside the core Intake + Comparison V1 path.

---

## Product Architecture: Three Verticals

Tea Tax is three distinct product verticals that compose into a single platform. V1 ships Verticals 1 and 2. Vertical 3 is architecturally anticipated but built post-validation.

| Vertical | Name | V1 | Description |
|----------|------|----|-------------|
| 1 | **Intake Engine** | Yes | Multi-modal AI intake that produces the portable tax situation object |
| 2 | **Comparison Engine** | Yes | Three-vector transparency layer: baseline pricing, ancillary risk, aggregated sentiment |
| 3 | **Practitioner Layer** | No | Marketplace + coordination layer for credentialed practitioners (CPAs, EAs). Integrates with existing filing software - does not replace it. |

The tax situation object is the connective tissue. The Intake Engine produces it; every other vertical consumes it. V1's architecture must ensure the object schema is compatible with the Practitioner Layer when it comes online, including export formats that existing filing software (Drake, Lacerte, ProConnect, CCH) can consume.

Launch persistence and authorization contract:

- `users -> tax_objects -> tax_returns`
- access control enforced by `tax_objects.created_by_user_id` in MVP
- `tax_object_memberships` is deferred to a follow-on sharing phase

---

## V1 Success Metrics

Three numbers determine whether V1 is working. Everything else is noise until these are proven.

| Metric | Definition | Target |
|--------|-----------|--------|
| **Intake Completion Rate** | % of users who start the intake and finish with a structured tax situation object | 60%+ |
| **End-to-End Time to Value** | Elapsed time from first touch to delivered comparison | 10 minutes or less |
| **Comparison Click-Through Rate** | % of users who receive a comparison and click through to a provider, Free File, or export | 40%+ |

These form a funnel: users who start -> users who finish -> users who act. If any stage breaks, the stages below it are meaningless.

---

## Phase 1: Foundation

**Goal:** Core data model, authentication, and privacy primitives that everything else builds on.

| Feature | Issue |
|---------|-------|
| User Authentication & Session Management | [features/01-user-authentication.md](features/01-user-authentication.md) |
| Tax Situation Object | [features/02-tax-situation-object.md](features/02-tax-situation-object.md) |
| Privacy & Encryption Architecture | [features/03-privacy-encryption.md](features/03-privacy-encryption.md) |

**Exit criteria:** A user can register, authenticate, create and manage multiple tax objects, and create/read returns under a tax object with creator-only access enforcement.

---

## Phase 2: Multi-Modal Intake (Intake Engine)

**Goal:** The guided intake experience that progressively builds the tax situation object from multiple input types. The experience should feel like talking to an impartial CPA friend, not filling out a form.

| Feature | Issue |
|---------|-------|
| AI Conversational Intake | [features/04-ai-conversational-intake.md](features/04-ai-conversational-intake.md) |
| Document Capture & Extraction | [features/05-document-capture-extraction.md](features/05-document-capture-extraction.md) |
| Voice & Video Intake | [features/06-voice-video-intake.md](features/06-voice-video-intake.md) |
| Plaid Financial Account Connection | [features/07-plaid-integration.md](features/07-plaid-integration.md) |

**Depends on:** Phase 1 (tax object schema, return scoping, encryption)
**Exit criteria:** A user can complete a guided intake session through at least two input modalities (chat + document upload) and produce a structurally complete tax situation object in 10 minutes or less.

---

## Phase 3: Tax Second Opinion

**Goal:** Let users upload a completed return and learn if they left money on the table. The #1 distribution wedge - extends the product window beyond tax season and seeds the pricing database.

| Feature | Issue |
|---------|-------|
| Tax Second Opinion | [features/10-tax-second-opinion.md](features/10-tax-second-opinion.md) |

**Depends on:** Phase 1 (authentication, encryption). Can be built in parallel with Phases 2 and 4.
**Exit criteria:** A user can upload a completed tax return (PDF/image), receive a structured analysis of potentially missed deductions or credits, and see an estimated savings range.

---

## Phase 4: Comparison Engine

**Goal:** Generate personalized, transparent comparisons and empower users to shop the market with their portable object.

| Feature | Issue |
|---------|-------|
| Comparison Engine (three-vector model) | [features/08-comparison-engine.md](features/08-comparison-engine.md) |
| Provider Routing, Affiliate Integration & Practitioner Connect | [features/09-provider-routing-affiliates.md](features/09-provider-routing-affiliates.md) |

**Depends on:** Phase 2 (completed tax situation object), Pricing Discovery Project (baseline pricing data)
**Exit criteria:** Given a completed tax situation object, the system generates a ranked comparison showing baseline pricing, ancillary risk warnings, and aggregated sentiment for each option. The user can click through to a provider, export the portable object, or connect with a practitioner.

---

## Phase 5: Community Pricing Database (Layer 2 Ancillary Pricing)

**Goal:** Crowdsourced transparency for the pricing layer that is deliberately opaque - the ancillary products, upsells, and bundles that turn "free" into $200+.

| Feature | Issue |
|---------|-------|
| Community Pricing Database | [features/11-community-pricing-database.md](features/11-community-pricing-database.md) |

**Depends on:** Phase 1 (authentication for contributions; anonymous read access for visitors). Can be built in parallel with Phases 2-4.
**Exit criteria:** Users can contribute pricing data points (including specific ancillary product upsells), and anonymous visitors can browse aggregated pricing comparisons.

---

## Phase 6: External Service Credentials

**Goal:** Collect and configure sandbox/test credentials for all external integrations.

| Feature | Issue |
|---------|-------|
| Collect Test Credentials | [features/12-collect-test-credentials.md](features/12-collect-test-credentials.md) |

**Note:** This is a dependency for features in Phases 2-5 that call external APIs. Features can stub integrations initially, but real API testing requires these credentials.

---

## Pricing Discovery Project (Prerequisite for Phase 4)

The Comparison Engine depends on understanding how major providers actually price their products. This is a research project, not a code project, and must be completed before the comparison engine can generate meaningful baseline pricing.

**Providers to research:** TurboTax, H&R Block, TaxAct, FreeTaxUSA, Cash App Taxes. Free File Alliance members are $0 by definition for eligible users.

**What to learn for each provider:**
1. Tier structure: how many tiers, names, published price per tier per service level (DIY, DIWH, DIFM)
2. Form-to-tier mapping: which forms/schedules trigger which tier? Documented or requires testing?
3. Price stability: how often do published prices change through the season?
4. State filing pricing: flat per state, variable, or bundled?
5. Observability method: published content, client-side logic, API, or flow simulation?

**Output:** A structured matrix (provider x tier x service level x form triggers x price range x observability method) that the comparison engine consumes.

**Layer 1 (baseline) pricing comes from this project. Layer 2 (ancillary) pricing comes from the Community Pricing Database (Phase 5).**

---

## Open / TBD Items

These items were identified during product owner sessions and are deferred for future decision:

| Item | Status | Notes |
|------|--------|-------|
| Mobile-first vs. web (responsive web app, native, or both) | TBD | Affects Phase 2 intake UX decisions |
| Privacy architecture phasing (full zero-knowledge in V1 vs. phased) | TBD | Pending privacy architecture spec; affects Phase 1 scope |
| Subpoena / law enforcement compliance architecture | TBD | Platform must be compliant from regulatory and law enforcement standpoint; design to be determined |
| Tax situation object export formats | TBD | The portable object must export in formats that existing filing software (Drake, Lacerte, ProConnect, CCH) can consume when the Practitioner Layer comes online |

---

## Userflow State Machines

The following state machines formalize the primary user goals and must be reviewed before implementation begins:

| Userflow | Document |
|----------|----------|
| Tax Situation Intake | [userflows/01-tax-situation-intake.md](userflows/01-tax-situation-intake.md) |
| Tax Second Opinion | [userflows/02-tax-second-opinion.md](userflows/02-tax-second-opinion.md) |
| Provider Selection & Handoff | [userflows/03-provider-selection-handoff.md](userflows/03-provider-selection-handoff.md) |
| Pricing Data Contribution | [userflows/04-pricing-contribution.md](userflows/04-pricing-contribution.md) |
