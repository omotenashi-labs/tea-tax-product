# Tea Tax v0 — Product Requirements Document

**Date:** 2026-03-24
**Status:** Draft
**Source of Truth:** `docs/strategy/tax-situation-protocol-strategy.md` (2026-03-23)

---

## 1. Product Vision

Tea Tax is the steward of the **Tax Situation Protocol** — an open, AI-native standard that defines how AI agents represent a taxpayer's financial situation, communicate with tax providers, and route consumers to the right filing option. The protocol fills the gap between the messy, pre-return reality of a taxpayer's life and the structured formats providers need to serve them.

The tax industry has a standard for the _output_ (IRS MeF XML for completed returns) but nothing for the _input_. That vacuum is about to be filled — either by bilateral deals between AI platforms and incumbents (where the largest player wins every bidding war), or by an open standard the industry collectively adopts. Tea Tax defines and stewards the open standard.

> **Inconsistency Note — Prior docs vs. Strategy (overruled):** The product thesis (`docs/vision/tea-tax-thesis.md`) and the Calypso blueprint (`docs/product-concepts/calypso-blueprint/`) position Tea Tax as a consumer-facing "Kayak for taxes" — a free AI-powered intake and comparison engine. The strategy document reframes Tea Tax's **primary v0 identity** as a protocol steward and consortium organizer, with the consumer-facing product emerging later (Phase 5, 2027+) on top of entrenched industry infrastructure. **The strategy document governs.** The consumer product vision remains the long-term destination, but v0 builds the protocol layer that makes it structurally viable.

---

## 2. Problem Statement

### 2.1 The Missing Infrastructure

Every major tax provider has a proprietary intake format. Data doesn't move between systems. AI agents have no standard way to interact with any provider programmatically. As AI becomes the front door for consumer decisions, this absence creates a vacuum that bilateral exclusivity deals will fill — replicating the exact disintermediation pattern that reshaped travel (Expedia/Booking.com), food delivery (DoorDash/Uber Eats), and retail (Amazon).

### 2.2 The Threat to Non-Intuit Providers

Intuit is a $180B company with a $1B+ annual marketing budget. In a world of bilateral AI partnerships — TurboTax pays Anthropic for preferred placement, TurboTax pays OpenAI for default routing — Intuit wins every bidding war. Every other provider (H&R Block, Taxwell/Drake/TaxWise, April Tax, UltraTax) is structurally disadvantaged. The open standard is the only structural answer.

### 2.3 The Precedent Is Already Live

OpenAI launched "Buy it in ChatGPT" powered by the Agentic Commerce Protocol (ACP) — an open standard co-developed with Stripe. By February 2026: 1M+ Shopify merchants integrated, 4% transaction fee per purchase, ~50M shopping-related queries/day. Intuit has launched Intuit Assist spanning 100M customers. The pattern is arriving in tax whether the industry acts or not.

---

## 3. The Tax Situation Object

The core artifact of the protocol: a structured, portable, AI-native representation of a taxpayer's complete financial situation.

### 3.1 What It Contains

- Filing year, filing status, dependents
- Income streams (W-2, 1099 variants, K-1, rental, etc.) with source, amount, and linked documentation
- Deductions and credits (standard vs. itemized, education, child, earned income, etc.)
- Life events (marriage, home purchase, job change, birth, retirement, etc.)
- State residency and multi-state filing indicators
- Prior-year context (estimated AGI, filing method, provider)
- Documentation completeness tracker with confidence scores per field
- Raw artifacts (documents, photos, recordings) with extracted data

### 3.2 What It Enables

- Any AI agent (Claude, ChatGPT, Gemini, or a consumer's local model) can produce a tax situation object from a conversation, documents, or financial account connections
- Any tax provider can consume the object and immediately determine the right product, tier, and estimated price
- Any consumer can carry their structured tax situation to any provider without re-entering data
- Any credentialed tax professional can receive a pre-structured client instead of a shoebox

### 3.3 Data Model (MVP Persistence)

For internal reference implementation, the object maps to:

| Table         | Purpose                                                                                             |
| ------------- | --------------------------------------------------------------------------------------------------- |
| `users`       | Authenticated accounts                                                                              |
| `tax_objects` | Filing identity and related data per context (individual, joint, business, dependent, estate/trust) |
| `tax_returns` | Year- and jurisdiction-scoped returns under a tax object                                            |

MVP access rule: `tax_objects.created_by_user_id = current_user.id` (creator-only). Sharing via `tax_object_memberships` is deferred.

Canonical source: `docs/requirements/users-tax-objects-ownership-access-spec.md`

> **Consistency Note:** The data model defined in the ownership/access spec and the Calypso blueprint align with the strategy document's tax situation object definition. No conflict.

---

## 4. v0 Scope — The Artifact Phase

v0 corresponds to **Phase 1** of the strategy: "Build the Artifact" (now through April 2026). Three deliverables:

### 4.1 The Schema Specification

A v0.1 definition of the tax situation object — core fields, types, validation rules, edge case handling, extensibility model.

**Design constraints:**

- Deliberately minimal: broad enough to be correct, narrow enough that a future technical working group has room to contribute
- Technically rigorous enough that a CTO can evaluate it in an afternoon
- Informed by domain expertise from TaxAct's Xpert ecosystem — which fields matter, how tier placement works, what edge cases exist, where providers diverge
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

> **Inconsistency Note — Schema scope:** The Calypso blueprint (`features/02-tax-situation-object.md`) specifies a full CRUD implementation with progressive enrichment, encryption at rest, and export — scoped to a shipping consumer product. The strategy document scopes v0.1 to a _specification_ with a reference implementation, not a production consumer-grade system. **The strategy document governs.** The blueprint's feature spec is retained as the future consumer-product implementation target.

### 4.2 The Tax Domain Knowledge Base

The schema defines the _shape_ of a tax situation. The knowledge base provides the _rules_ needed to evaluate whether a given tax situation object is correct, complete, and actionable. Without it, the schema is an inert data format.

**What the knowledge base encodes:**

- **IRS form/schedule taxonomy.** Which forms exist, what fields they require, how they relate to each other. Schedule C triggers self-employment tax (Schedule SE). Investment income triggers Schedule D and Form 8949. Rental income requires Schedule E. These dependencies are the validation backbone.
- **Provider tier mapping rules.** Which combination of forms, complexity factors, and income levels maps to which product tier at which provider. A W-2-only filer qualifies for free tiers; a K-1 with foreign tax paid forces premier tier at TurboTax but not at FreeTaxUSA. This is the domain expertise that makes the protocol useful to providers — not just a data container, but an evaluable artifact.
- **Validation logic.** Contradictions (claiming single filing status + dependent spouse), missing dependencies (1099-NEC income without estimated tax payment history), implausible values (negative AGI without capital loss documentation), incomplete form chains (Schedule C present but no SE tax calculation).
- **Tax code rules and thresholds.** AGI limits for Free File eligibility ($89K), credit phase-out ranges, standard deduction amounts by filing status, estimated tax safe harbor rules, EITC qualifying thresholds. These change annually and must be versioned.

**Why this is a v0 deliverable:**

The knowledge base is the founder's core domain advantage. Anyone can guess at a schema shape. Knowing that box 12 code DD on a W-2 doesn't affect tier placement but a K-1 with foreign tax paid does — that's the alpha that makes the schema right on the first try and the validation trustworthy to a CTO evaluating it.

The knowledge base also serves as the **training corpus** for the fine-tuned domain model in v1 (see Section 6.1).

### 4.3 Working Reference Implementation

A transport-agnostic implementation that demonstrates the schema and knowledge base working together end-to-end.

**Demo capabilities:**

- Accept messy inputs: a photo of a W-2, a voice description of a life event, a bank account connection
- Produce a structured tax situation object
- Validate the object against the knowledge base — flag missing fields, contradictions, and form dependency gaps
- Demonstrate that a provider could consume the object and determine tier placement

**Quality bar:** Tangible enough that a non-technical CEO can see it working and a CTO can see the architecture. Does not need to be production-grade.

**Transport is an implementation detail.** The reference implementation should demonstrate the schema and knowledge base — not commit to a specific wire protocol. MCP (Anthropic ecosystem), OpenAI function definitions, REST APIs, or other transports are packaging decisions made based on which demo lands best with the specific audience in the room. The protocol's value is in the schema and domain logic, not in which transport layer delivers it.

> **Inconsistency Note — MCP as named deliverable (overruled by PRD review):** The strategy document names "an MCP server and OpenAI function definitions" as the reference implementation. This PRD treats MCP and OpenAI function schemas as transport options, not as v0 requirements. The deliverable is the working demo of schema + knowledge base; the transport packaging is a tactical decision. See Appendix A for rationale.

---

## 5. Execution Timeline (v0)

| Week          | Deliverable                                                                                                                                                                       |
| ------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1–2           | Tax situation object schema v0.1 — core fields, type definitions, validation rules. Informed by TaxAct Xpert domain knowledge and IRS form/schedule mapping.                      |
| 3–4           | Tax domain knowledge base — form taxonomy, provider tier mappings, validation rules, tax code thresholds. Structured as both a reference document and future model training data. |
| 5–6           | Reference implementation — demo showing schema + knowledge base working end-to-end: messy inputs → structured object → validation → tier placement evaluation.                    |
| 7–8           | Dry runs. Refine the demo. Pressure-test the schema and knowledge base against edge cases. Prepare for CTO-level technical scrutiny.                                              |
| Post-April 15 | First calls. H&R Block CEO. Taxwell CEO and CTO.                                                                                                                                  |

---

## 6. Strategic Roadmap (Post-v0)

### v1: The Fine-Tuned Domain Model

v0 proves the schema and knowledge base are correct. v1 makes them operationally scalable.

The tax domain knowledge base is large and rule-dense — the full IRS form taxonomy, provider tier logic across multiple providers, validation interdependencies, tax code thresholds, credit phase-outs. Feeding this into a frontier model's context window for every evaluation is expensive, unreliable, and ultimately a trust problem: the more context loaded, the more the model hallucinates or drops rules. In tax, a dropped rule means wrong tier placement, a missed credit, or bad validation. That generates errors that are unacceptable for tax preparation — lost confidence in the system leads to failure to distribute and adopt.

**The v1 deliverable is a fine-tuned small language model** trained on the v0 knowledge base that can evaluate, validate, and reason over tax situation objects reliably without context window pressure. The knowledge base is the training data; the small model is the inference engine that has internalized it.

**Why this matters for the protocol strategy:**

- **Reliability at scale.** A fine-tuned model produces deterministic, low-variance evaluations. A frontier model with a stuffed context window produces stochastic ones. Providers and practitioners need the former.
- **Cost.** Frontier model API calls for every object evaluation across 150M+ potential filers are prohibitive. A small model collapses unit economics.
- **Trust.** A CTO evaluating the protocol needs confidence that the system won't silently drop a validation rule under context pressure. A fine-tuned model that has internalized the rules is a fundamentally different trust proposition than a general model reasoning over a long prompt.
- **Privacy.** Sensitive tax data processed by a small model on controlled infrastructure avoids sending PII to third-party frontier model APIs.
- **Moat.** The model improves as the knowledge base grows and as usage data reveals edge cases. A competitor can't replicate this by plugging into Claude or GPT — the domain-specific model quality is earned through accumulated expertise, not bought off the shelf.

### Phase 2: The First Two Dominos (May–June 2026)

**Target:** H&R Block (CEO Curtis Campbell — former TaxAct president, knows the founder's work) and Taxwell (CEO Dermot Halpin, CTO Sugata Mukhopadhyay, CPO Bastien Martini — all from travel industry, lived the disintermediation playbook).

**The ask:** Not a contract. A commitment to participate — evaluate the schema, pilot the integration, have a seat at the table. Low barrier to yes, high cost of no.

### Phase 3: Consortium Solidifies (July–September 2026)

Governance structure, technical working group (CTOs from member companies), reference integrations against real provider architectures. Tea Tax occupies the protocol steward role — neutral, not a competitor.

### Phase 4: AI Platform Engagement (Q4 2026)

With multiple providers adopted, approach Anthropic and OpenAI. Not a pitch — an announcement. The consortium's protocol becomes the canonical tax layer in the AI agent ecosystem.

> **Inconsistency Note — Anthropic relationship:** The thesis frames the Anthropic relationship as an AI partnership ("Powered by Claude" co-marketing, preferred API pricing, strategic investment). The strategy reframes it as a platform-level integration where the consortium presents a fait accompli: "The industry adopted this standard. Your agents should speak it natively." **The strategy document governs.** The Anthropic relationship is Phase 4, not Phase 1.

### Phase 5: Consumer Layer Emerges (2027+)

Once the protocol is adopted by providers and spoken by AI agents, the consumer-facing opportunity materializes. The exact shape — aggregator, marketplace, routing layer — will be informed by protocol usage patterns and value flows.

> **Inconsistency Note — Consumer product timing:** The thesis and blueprint assume a consumer product launching for the 2026 filing season ("V1 lives and dies in-season"). The strategy defers the consumer product to 2027+, building it on top of entrenched infrastructure rather than against an entrenched industry. **The strategy document governs.** The 2026 filing season is the _protocol development_ window, not the consumer product launch window.

---

## 7. Revenue Model

**Intentionally unresolved** for v0. The strategic priority is protocol adoption.

Potential models that emerge from usage patterns:

| Model                                                        | Precedent   |
| ------------------------------------------------------------ | ----------- |
| Integration tooling and enterprise support                   | Twilio      |
| Transaction-layer fees as volume flows through the protocol  | Visa/Stripe |
| Data and intelligence products from aggregate protocol usage | Bloomberg   |
| Premium services layered on the open standard                | Red Hat     |

> **Inconsistency Note — Revenue model:** The thesis defines revenue as "Kayak model with radical transparency" — affiliate referral fees from providers when consumers click through. The distribution strategy details specific affiliate programs (TurboTax 10–15% rev share via CJ Affiliate). The strategy document says revenue is "intentionally unresolved" and lists four different precedent models, none of which are affiliate/referral. **The strategy document governs.** Affiliate revenue may emerge in the consumer layer (Phase 5), but v0 does not assume or build toward it.

---

## 8. Privacy and Security Architecture

Privacy is a constitutional principle of the platform, retained from the thesis and reinforced by the strategy's consortium trust requirements.

### 8.1 Core Tenets (unchanged from thesis)

- **No admin data access.** No administrator, employee, or internal system can view a user's tax situation. No god mode.
- **Credentialed access only.** The only window into user data is a credentialed tax professional with explicit, granular, time-bound, auditable, revocable user consent.
- **Encryption is foundational.** Data encrypted at rest, in transit, and in processing. Zero-knowledge and end-to-end encryption principles applied wherever technically feasible.
- **Data minimization.** Collect only what is needed. Retain only what the user consents to. Delete aggressively on consent withdrawal.
- **The portable object is user property.** Export, share, or destroy at will.

### 8.2 Protocol-Specific Security Requirements (from strategy)

- **Zero-knowledge encryption of the tax situation object.** Even the protocol steward cannot access plaintext user data. Consortium members need assurance the steward isn't accumulating a data advantage.
- **Cryptographic multi-tenancy.** Competing providers sharing the protocol need cryptographic assurance their data is invisible to every other participant and to the steward.
- **AI model privacy.** Sensitive tax data must not leak into model weights, training pipelines, or third-party API calls during extraction and classification.
- **Circular 230 compliance enforced architecturally.** Credentialed access, granular consent, auditability, revocability — enforced by the system, not by behavior.

### 8.3 Open Items (retained from blueprint)

- Full zero-knowledge in v0 reference implementation vs. layered approach: TBD
- Subpoena/law enforcement compliance architecture: TBD
- Encryption scheme and key management approach: TBD

---

## 9. Regulatory Context

### 9.1 Circular 230

IRS Circular 230 governs who can practice before the IRS and provide personalized tax guidance. Key implications:

- **AI cannot substitute for practitioner competence.** IRS National Tax Forum material (2024) explicitly states this.
- **Proposed §10.35** would require practitioners to maintain technological competency, including understanding benefits and risks of AI tools.
- **AI compresses low-leverage tax labor; regulation preserves human accountability** at risk-bearing decision points (written advice, position-taking, representation, sign-off).

Tea Tax's protocol design enforces Circular 230 boundaries architecturally: the system collects and structures information but does not provide tax advice. When advice or strategy is needed, the protocol routes to credentialed professionals.

### 9.2 FTC Enforcement Context

- FTC ordered Intuit (2024) to stop advertising TurboTax as "free" unless genuinely free for all consumers.
- Separate FTC action against H&R Block for deceptive pricing practices, enforcing changes through 2026.
- This regulatory activity validates the problem Tea Tax exists to solve and creates consumer awareness.

---

## 10. Founding Team Capabilities

Two roles cover the requirements for a credible open standard:

**Domain expertise (the founder):** Two years leading TaxAct's Xpert ecosystem, 0-to-1 launch of Xpert Full Service. Knows which fields matter, how tier placement works, what edge cases exist, where providers diverge. Direct relationships with H&R Block CEO, Taxwell C-suite, April Tax, UltraTax leadership. Can define the schema correctly on the first try.

**Cryptographic and compliance engineering (Lucas Geiger):** Background in decentralized systems, cryptographic protocols, and decentralized identity. Covers zero-knowledge encryption, compliance architecture, cryptographic multi-tenancy, and AI model privacy — the technical requirements that make the protocol trustworthy to enterprise security teams.

**Both are neutral.** Not a competitor. Not an incumbent. Not an AI company. The only team whose incentive is the standard itself.

---

## 11. Success Criteria for v0

| Criterion                | Measure                                                                                                                                                               |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Schema completeness      | v0.1 covers core 1040-series filing scenarios (W-2 only, freelance/1099, investments, multi-state, rental income) with correct field definitions and validation rules |
| Knowledge base coverage  | Form taxonomy, provider tier mappings, validation rules, and tax code thresholds are encoded and structured for both human review and future model training           |
| Reference implementation | Demo produces a structured object from messy inputs, validates it against the knowledge base, and demonstrates provider tier evaluation                               |
| Technical credibility    | A CTO can evaluate the schema and knowledge base in an afternoon and conclude "this is correct"                                                                       |
| Executive credibility    | A non-technical CEO can see the demo working and understand the value proposition                                                                                     |
| Timeline                 | All three deliverables ready before post-April 15 outreach window                                                                                                     |

---

## 12. What v0 Is Not

To maintain clarity on scope, the following are explicitly **not in v0**:

| Out of Scope                                                                   | Where It Lives                      |
| ------------------------------------------------------------------------------ | ----------------------------------- |
| Fine-tuned domain model                                                        | v1                                  |
| Specific transport bindings (MCP server, OpenAI function schema)               | Implementation detail; post-v0      |
| Consumer-facing intake product (chat, voice, document upload UX)               | Phase 5 / Calypso blueprint Phase 2 |
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

> **Inconsistency Note — Superhuman CPA OS:** The scaffold design document (`docs/product-concepts/superuman-cpa/`) describes a separate done-for-you tax preparation platform with multi-tenant firm architecture, Circular 230 workflow gates, and per-return billing. This is a fundamentally different product than what v0 defines — it positions Tea Tax as a _tax preparer_, not a protocol steward. The strategy document does not reference Superhuman CPA OS. **The strategy document governs for v0 scope.** The Superhuman CPA OS scaffold may inform the Practitioner Layer in later phases, but it is not part of the protocol strategy.

> **Inconsistency Note — Distribution strategy:** The distribution document (`docs/strategy/tea-tax-distribution-strategy.md`) is entirely consumer-focused: Tax Second Opinion wedge, programmatic SEO, content creator partnerships, gig platform integrations, payroll providers, CPA society alliances, AARP, political amplification. The strategy document's "distribution" is CEO conversations and consortium building. **The strategy document governs for v0.** The consumer distribution strategy is retained for Phase 5.

---

## 13. Assumptions and Risks

### What Must Be True (from strategy)

1. **AI agents become a meaningful front door for tax filing within 2–3 years.** Current trajectory suggests near-certain, but speed matters.
2. **Incumbents perceive the bilateral-deal threat as real and imminent.** The threat narrative must land.
3. **The schema can be defined correctly by a small team, fast.** Domain expertise from TaxAct is the accelerant.
4. **At least two major providers commit to pilot within 3 months of outreach.** Phase 2 is the highest-risk moment.
5. **The steward role remains trusted as neutral.** Neutrality is an operational constraint, not a positioning choice.
6. **The consortium itself becomes the credibility anchor.** Until the first two providers commit, authority rests on the founder's domain credibility and relationships.

### Key Risks

| Risk                                                    | Impact                                      | Mitigation                                                                                                                                                               |
| ------------------------------------------------------- | ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| First two CEO conversations don't convert               | Strategy collapses — no consortium momentum | Founder's direct relationships with Campbell (H&R Block) and Halpin (Taxwell) reduce but don't eliminate this risk. Fallback: pivot to consumer product path per thesis. |
| Intuit moves faster than expected on bilateral AI deals | Urgency window shrinks                      | Accelerate Phase 1 delivery. The threat narrative becomes more compelling, not less.                                                                                     |
| Schema requires more iteration than 2 weeks             | Phase 2 outreach window compressed          | Scope v0.1 aggressively minimal. Working group in Phase 3 handles depth.                                                                                                 |
| Protocol steward perceived as non-neutral               | Consortium trust collapses                  | Governance design must enforce neutrality structurally. No revenue model that creates competitive conflict.                                                              |

---

## 14. Incorporated Material Index

All prior documents are incorporated by reference. Where they conflict with the strategy document, this PRD notes the inconsistency and applies the strategy document's position.

| Document                        | Path                                                           | Role in PRD                                                                                                                                       |
| ------------------------------- | -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| Tax Situation Protocol Strategy | `docs/strategy/tax-situation-protocol-strategy.md`             | **Source of truth** for v0 scope, phasing, and strategic framing                                                                                  |
| Tea Tax Product Thesis          | `docs/vision/tea-tax-thesis.md`                                | Long-term product vision, consumer value proposition, competitive landscape, moat analysis. Retained for Phase 5+ context.                        |
| Tea Tax Distribution Strategy   | `docs/strategy/tea-tax-distribution-strategy.md`               | Consumer distribution playbook. Retained for Phase 5+ context.                                                                                    |
| Calypso Blueprint               | `docs/product-concepts/calypso-blueprint/`                     | Consumer product architecture, feature specs, user flows, implementation plan. Retained as Phase 5+ implementation reference.                     |
| Users/Tax Objects/Access Spec   | `docs/requirements/users-tax-objects-ownership-access-spec.md` | Data model and access rules for the tax situation object. Aligned with strategy; no conflict.                                                     |
| Current Priorities              | `docs/requirements/current-priorities.md`                      | Near-term organizational focus. Partially superseded by strategy timeline.                                                                        |
| Superhuman CPA OS Scaffold      | `docs/product-concepts/superuman-cpa/`                         | Done-for-you tax prep platform design. Separate product initiative; may inform future Practitioner Layer.                                         |
| Circular 230 AI Memo            | `docs/research/irs-circular-230/circular230-ai-memo.md`        | Regulatory research supporting the "AI as empowerment" thesis and architectural compliance approach.                                              |
| Thesis Review Session           | `docs/vision/tea-tax-thesis-review-session.md`                 | Key decisions from March 22 review: three-vertical architecture, three-vector comparison, V1 metrics. Partially superseded by strategy's phasing. |
| Deployment Reference            | `docs/requirements/deployment-access-handoff.md`               | Current infrastructure access. Retained for operational context.                                                                                  |

---

## 15. Inconsistency Summary

For quick reference, all inconsistencies between the strategy document (source of truth) and prior documents:

| Topic                         | Prior Docs Say                                                                       | Strategy Says                                                           | PRD Position                                                                         |
| ----------------------------- | ------------------------------------------------------------------------------------ | ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| **Product identity**          | Consumer-facing "Kayak for taxes" — free AI intake + comparison engine               | Protocol steward — open standard for AI-tax ecosystem interoperability  | Strategy governs                                                                     |
| **v0 deliverables**           | Shipping consumer product (Intake Engine + Comparison Engine) for 2026 filing season | Schema spec, MCP reference implementation, threat narrative deck        | Schema spec, knowledge base, reference implementation (see Appendix A for revisions) |
| **Revenue model**             | Affiliate referral fees (Kayak/Credit Karma model)                                   | Intentionally unresolved; adoption is the priority                      | Strategy governs                                                                     |
| **Consumer product timing**   | 2026 filing season ("V1 lives and dies in-season")                                   | 2027+ (Phase 5), built on top of entrenched protocol infrastructure     | Strategy governs                                                                     |
| **Tax situation object role** | Consumer "shopping weapon" and internal data model                                   | Industry-standard protocol layer between AI agents and tax ecosystem    | Strategy governs                                                                     |
| **MCP/AI integration**        | Future integration opportunity for consumer product                                  | Primary delivery mechanism from day one                                 | Transport is an implementation detail, not a v0 deliverable (see Appendix A)         |
| **Anthropic relationship**    | AI partnership with co-marketing and investment                                      | Phase 4 platform engagement after consortium adoption                   | Strategy governs                                                                     |
| **Distribution**              | Consumer channels: SEO, content creators, gig platforms, payroll                     | CEO conversations and consortium building                               | Strategy governs                                                                     |
| **Superhuman CPA OS**         | Separate done-for-you tax prep service with multi-tenant firm architecture           | Not referenced; separate from protocol strategy                         | Strategy governs                                                                     |
| **V1 success metrics**        | 60% intake completion, 10-min time to value, 40% CTR                                 | Schema correctness, CTO/CEO credibility, post-season outreach readiness | Strategy governs                                                                     |
| **Target audience (v0)**      | American taxpayers                                                                   | Industry CEOs, CTOs, and AI platform companies                          | Strategy governs                                                                     |

> **Reconciliation:** These are not contradictions in vision — they are a sequencing reframe. The strategy document does not reject the consumer product; it sequences the protocol layer _first_ so the consumer product launches on entrenched infrastructure rather than against entrenched resistance. All prior consumer-product documentation is retained and will govern the Phase 5 consumer build.

---

## Appendix A: LG's Critique and Changes to Strategy Document

This appendix documents where this PRD departs from the strategy document based on review by LG (Lucas Geiger, co-founder), and the rationale for each change.

### Change 1: MCP is an implementation detail, not a deliverable

**Strategy says:** "An MCP server and OpenAI function definitions that implement the protocol."

**Critique:** MCP is a transport layer — a way to package and deliver the protocol. It is not the protocol itself. Naming MCP as a v0 deliverable conflates the _what_ (schema + domain logic) with the _how_ (wire format). The customer need the reference implementation solves is: "show me that this standard works end-to-end." Whether that demo runs over MCP, OpenAI functions, a REST API, or a CLI is a tactical packaging decision driven by audience context — not a product requirement.

**Change:** The reference implementation is defined as transport-agnostic. MCP and OpenAI function schemas are listed as transport options that may be built for specific demos, not as v0 deliverables.

### Change 2: The knowledge base is a missing deliverable

**Strategy says:** The schema specification and reference implementation are the two product deliverables. The knowledge base is implied (the strategy references "domain expertise" and "knowing which fields matter") but never named as a distinct artifact.

**Critique:** The schema defines the _shape_ of a tax situation object. But the schema alone cannot answer: "Is this object correct? What's missing? What contradicts what? What tier does this map to at TurboTax vs. FreeTaxUSA?" Those answers require a structured encoding of the tax domain — IRS form taxonomy, inter-form dependencies, provider tier mapping rules, validation logic, tax code thresholds. Without this knowledge base, the schema is an inert data format that no one can evaluate. With it, the protocol becomes an evaluable, validatable system that a CTO can trust.

The knowledge base is also the founder's core domain advantage — the TaxAct Xpert expertise _is_ this knowledge, not the schema shape. And it is the future training corpus for the v1 fine-tuned model.

**Change:** The tax domain knowledge base is added as a named v0 deliverable (Section 4.2), sitting between the schema spec and the reference implementation.

### Change 3: The threat narrative deck is not a product deliverable

**Strategy says:** The threat narrative deck is one of three Phase 1 deliverables.

**Critique:** The deck is go-to-market material — a pitch artifact for CEO conversations. It is essential for the strategy's success, but it is not part of the product. A PRD should define what gets built, not what gets presented. Including the deck as a product deliverable blurs the line between product scope and sales motion.

**Change:** The threat narrative deck is removed from v0 product scope and noted in "What v0 Is Not" (Section 12) as go-to-market material. It remains important — it just isn't product.

### Change 4: v1 is the fine-tuned domain model

**Strategy does not address this.** The thesis document discusses proprietary local models as a cost, privacy, and moat play, but frames them as a consumer product concern.

**Critique:** The knowledge base is large and rule-dense. Feeding it into a frontier model's context window for every tax situation evaluation is expensive, unreliable, and a trust problem. Context window pressure causes frontier models to drop rules stochastically — in tax, that means wrong tier placement, missed credits, or bad validation. These errors are unacceptable for tax preparation. If the system produces stochastic errors, providers and practitioners lose confidence. Lost confidence in the system leads to failure to distribute and adopt — which kills the consortium strategy.

The answer is a fine-tuned small language model trained on the knowledge base. The model internalizes the domain rules and can evaluate tax situation objects reliably without context window degradation. v0 proves the schema and knowledge base are correct; v1 makes them operationally scalable and trustworthy.

**Change:** v1 is defined as the fine-tuned domain model (Section 6.1), with the v0 knowledge base explicitly serving double duty as both a human-reviewable reference and a model training corpus.
