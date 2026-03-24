# Tea Tax v0 — Strategy Context

**Date:** 2026-03-24
**Companion to:** `docs/prd-v0.md`

This document captures the market thesis, go-to-market phases, revenue model, founding team context, and business-level assumptions and risks that inform the v0 PRD. It is not a product requirements document — it explains _why_ v0 exists and what happens after it ships.

---

## 1. Problem Statement

### 1.1 The Missing Infrastructure

Every major tax provider has a proprietary intake format. Data doesn't move between systems. AI agents have no standard way to interact with any provider programmatically. As AI becomes the front door for consumer decisions, this absence creates a vacuum that bilateral exclusivity deals will fill — replicating the exact disintermediation pattern that reshaped travel (Expedia/Booking.com), food delivery (DoorDash/Uber Eats), and retail (Amazon).

### 1.2 The Threat to Non-Intuit Providers

Intuit is a $180B company with a $1B+ annual marketing budget. In a world of bilateral AI partnerships — TurboTax pays Anthropic for preferred placement, TurboTax pays OpenAI for default routing — Intuit wins every bidding war. Every other provider (H&R Block, Taxwell/Drake/TaxWise, April Tax, UltraTax) is structurally disadvantaged. The open standard is the only structural answer.

### 1.3 The Precedent Is Already Live

OpenAI launched "Buy it in ChatGPT" powered by the Agentic Commerce Protocol (ACP) — an open standard co-developed with Stripe. By February 2026: 1M+ Shopify merchants integrated, 4% transaction fee per purchase, ~50M shopping-related queries/day. Intuit has launched Intuit Assist spanning 100M customers. The pattern is arriving in tax whether the industry acts or not.

### 1.4 FTC Enforcement Context

- FTC ordered Intuit (2024) to stop advertising TurboTax as "free" unless genuinely free for all consumers.
- Separate FTC action against H&R Block for deceptive pricing practices, enforcing changes through 2026.
- This regulatory activity validates the problem Tea Tax exists to solve and creates consumer awareness.

---

## 2. Go-to-Market Phases (Post-v0)

### Phase 2: The First Two Dominos (May–June 2026)

**Target:** H&R Block (CEO Curtis Campbell — former TaxAct president, knows the founder's work) and Taxwell (CEO Dermot Halpin, CTO Sugata Mukhopadhyay, CPO Bastien Martini — all from travel industry, lived the disintermediation playbook).

**The ask:** Not a contract. A commitment to participate — evaluate the schema, pilot the integration, have a seat at the table. Low barrier to yes, high cost of no.

### Phase 3: Consortium Solidifies (July–September 2026)

Governance structure, technical working group (CTOs from member companies), reference integrations against real provider architectures. Tea Tax occupies the protocol steward role — neutral, not a competitor.

### Phase 4: AI Platform Engagement (Q4 2026)

With multiple providers adopted, approach Anthropic and OpenAI. Not a pitch — an announcement. The consortium's protocol becomes the canonical tax layer in the AI agent ecosystem.

### Phase 5: Consumer Layer Emerges (2027+)

Once the protocol is adopted by providers and spoken by AI agents, the consumer-facing opportunity materializes. The exact shape — aggregator, marketplace, routing layer — will be informed by protocol usage patterns and value flows. Prior consumer-product documentation (thesis, blueprint, distribution strategy) governs Phase 5 scope.

---

## 3. Revenue Model

**Intentionally unresolved** for v0. The strategic priority is protocol adoption.

Potential models that emerge from usage patterns:

| Model                                                        | Precedent   |
| ------------------------------------------------------------ | ----------- |
| Integration tooling and enterprise support                   | Twilio      |
| Transaction-layer fees as volume flows through the protocol  | Visa/Stripe |
| Data and intelligence products from aggregate protocol usage | Bloomberg   |
| Premium services layered on the open standard                | Red Hat     |

---

## 4. Founding Team Capabilities

Two roles cover the requirements for a credible open standard:

**Domain expertise (the founder):** Two years leading TaxAct's Xpert ecosystem, 0-to-1 launch of Xpert Full Service. Knows which fields matter, how tier placement works, what edge cases exist, where providers diverge. Direct relationships with H&R Block CEO, Taxwell C-suite, April Tax, UltraTax leadership. Can define the schema correctly on the first try.

**Cryptographic and compliance engineering (Lucas Geiger):** Background in decentralized systems, cryptographic protocols, and decentralized identity. Covers zero-knowledge encryption, compliance architecture, cryptographic multi-tenancy, and AI model privacy — the technical requirements that make the protocol trustworthy to enterprise security teams.

**Both are neutral.** Not a competitor. Not an incumbent. Not an AI company. The only team whose incentive is the standard itself.

---

## 5. Business Assumptions and Risks

### What Must Be True

1. **AI agents become a meaningful front door for tax filing within 2–3 years.** Current trajectory suggests near-certain, but speed matters.
2. **Incumbents perceive the bilateral-deal threat as real and imminent.** The threat narrative must land.
3. **At least two major providers commit to pilot within 3 months of outreach.** Phase 2 is the highest-risk moment.
4. **The steward role remains trusted as neutral.** Neutrality is an operational constraint, not a positioning choice.
5. **The consortium itself becomes the credibility anchor.** Until the first two providers commit, authority rests on the founder's domain credibility and relationships.

### Key Risks

| Risk                                                    | Impact                                      | Mitigation                                                                                                                                                               |
| ------------------------------------------------------- | ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| First two CEO conversations don't convert               | Strategy collapses — no consortium momentum | Founder's direct relationships with Campbell (H&R Block) and Halpin (Taxwell) reduce but don't eliminate this risk. Fallback: pivot to consumer product path per thesis. |
| Intuit moves faster than expected on bilateral AI deals | Urgency window shrinks                      | Accelerate Phase 1 delivery. The threat narrative becomes more compelling, not less.                                                                                     |
| Protocol steward perceived as non-neutral               | Consortium trust collapses                  | Governance design must enforce neutrality structurally. No revenue model that creates competitive conflict.                                                              |

---

## 6. Prior Document Reconciliation

The strategy document (`docs/strategy/tax-situation-protocol-strategy.md`, 2026-03-23) is the source of truth for v0. Where prior documents conflict, the strategy governs. Full reconciliation details are in `docs/reviews/lg-review-2026-03-24.md`.

| Prior Document                | Path                                             | Relationship to v0                                                                    |
| ----------------------------- | ------------------------------------------------ | ------------------------------------------------------------------------------------- |
| Tea Tax Product Thesis        | `docs/vision/tea-tax-thesis.md`                  | Long-term consumer product vision. Retained for Phase 5+.                             |
| Tea Tax Distribution Strategy | `docs/strategy/tea-tax-distribution-strategy.md` | Consumer distribution playbook. Retained for Phase 5+.                                |
| Calypso Blueprint             | `docs/product-concepts/calypso-blueprint/`       | Consumer product architecture and feature specs. Retained as Phase 5+ implementation. |
| Superhuman CPA OS Scaffold    | `docs/product-concepts/superuman-cpa/`           | Separate product initiative. May inform future Practitioner Layer.                    |
| Thesis Review Session         | `docs/vision/tea-tax-thesis-review-session.md`   | Three-vertical architecture, V1 metrics. Partially superseded by strategy phasing.    |
| Current Priorities            | `docs/requirements/current-priorities.md`        | Partially superseded by strategy timeline.                                            |
| Deployment Reference          | `docs/requirements/deployment-access-handoff.md` | Current infrastructure access. Retained for operational context.                      |
