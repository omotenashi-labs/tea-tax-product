# Tea Tax: Thesis Review Session Summary

**Date:** March 22, 2026
**Participants:** Product direction owner, AI (VC-lens review, then product launch advisor)

---

## What Happened

The full Tea Tax corpus - product thesis, distribution strategy, Calypso blueprint (12 feature specs, 4 user flow state machines, implementation plan), and the Superhuman CPA OS scaffold - was reviewed through the lens of a top-tier VC partner (AlleyCorp, a16z, Kleiner Perkins, Anthropic). The review focused on "how do we launch and validate this," which is where the substantive decisions were made.

---

## Key Decisions

### 1. Three-Vertical Product Architecture

The product was restructured from a narrative thesis into three distinct, composable verticals:

| Vertical | Name               | V1  | What It Does                                                                             |
| -------- | ------------------ | --- | ---------------------------------------------------------------------------------------- |
| 1        | Intake Engine      | Yes | Multi-modal AI intake -> portable tax situation object                                   |
| 2        | Comparison Engine  | Yes | Three-vector transparency: pricing, ancillary risk, sentiment                            |
| 3        | Practitioner Layer | No  | CPA/EA marketplace + coordination layer over existing filing software and HITL workflows |

The tax situation object is the connective tissue between all three. V1 builds the data layer that everything else plugs into.

### 2. Three V1 Metrics to Obsess Over

| Metric                        | Target             | Why It Matters                                                            |
| ----------------------------- | ------------------ | ------------------------------------------------------------------------- |
| Intake Completion Rate        | 60%+               | Product-market fit signal for the intake. Below 40% = fundamental rework. |
| End-to-End Time to Value      | 10 minutes or less | If it takes 20 minutes, you're the tax software you're trying to replace. |
| Comparison Click-Through Rate | 40%+               | The entire revenue model in a single number. No CTR, no business.         |

These form a funnel: start -> finish -> act. If any stage breaks, everything below it is meaningless.

### 3. Comparison Engine: Three-Vector Model

The old "recommendation engine" was replaced with a richer comparison engine built on three data vectors:

- **Baseline pricing (Layer 1):** Deterministic, form-driven. Which forms/schedules are present determines the provider tier and price. Solvable through the Pricing Discovery Project - a research effort, not crowdsourcing.
- **Ancillary risk (Layer 2):** The opaque layer where the bait-and-switch lives. Audit protection, refund advances, refund transfer fees, identity bundles. This is what the FTC fined incumbents for. Crowdsourced via the Community Pricing Database.
- **Aggregated sentiment (Layer 3):** Public review data (Trustpilot, Reddit, App Store, BBB) aggregated into a provider-level vibe-check score with temporal trends (L7, L30, season-over-season) and a bait-and-switch likelihood signal. Buildable from day one with zero dependencies.

### 4. Pricing Discovery Project

Before the comparison engine can generate meaningful baseline pricing, a separate research project must map how the top 5 providers (TurboTax, H&R Block, TaxAct, FreeTaxUSA, Cash App Taxes) actually price their tiers. For each: tier structure, form-to-tier mapping, price stability through the season, state filing costs, and observability method. This is domain expertise work, not engineering.

### 5. No E-File Transmission in V1

Filing is a regulated, liability-bearing activity requiring IRS Authorized e-File Provider status, MeF XML compliance, state filing support, and accuracy guarantees. It also destroys the impartial aggregator positioning - the moment Tea Tax files returns, it becomes a competitor to the providers it recommends. V1 stays in the aggregator lane. Instead of building filing, Tea Tax focuses on the Practitioner Layer to route users to credentialed humans who keep their existing filing software.

### 6. Practitioner Connect as Demand Signal

Instead of a filing waitlist, V1 captures demand for the practitioner marketplace. A "Connect with a tax pro" path on the comparison screen measures which user segments want professional help and captures situation complexity for practitioner matching when the marketplace launches.

### 7. Course Correction: From Recommendation to CPA Friend

The product direction shifted from "Kayak for taxes" (transactional recommendation engine) toward "the CPA friend everyone wishes they had" (persistent relationship over financial context). The comparison engine and the portable tax situation object together empower users in ways the current tax prep industry does not:

- The comparison gives them transparency the industry deliberately withholds.
- The portable object gives them structured data to shop the market - breaking the lock-in the industry depends on.

Both are virality drivers. The comparison is shareable ("look at TurboTax's bait-and-switch score"). The portable object is a power tool ("I walked into H&R Block's intake and finished in 5 minutes because Tea Tax had everything structured").

### 8. The Portable Object as Shopping Weapon

The tax situation object was reframed from "technical data asset" to "consumer empowerment tool." A user with a structured, portable tax situation can walk into any provider's intake and fly through it in minutes instead of hours. The object doesn't just feed the comparison engine - it breaks the inertia that keeps 80% of filers returning to the same provider every year. "Take your data and shop" is the framing on the comparison screen.

### 9. Aggregated Sentiment as Pre-Launch Artifact

The sentiment data (public reviews, Reddit, Trustpilot scores) can be scraped and published before the product exists. This is a standalone content asset - a provider "ick score" dashboard - that drives SEO, social sharing, and brand credibility with zero cold-start problem. It slots into the distribution strategy alongside the "What Did You Actually Pay?" tool as a Tier 1 pre-launch play.

---

## Organization Context

- **Product direction owner** - SaaS tax product management background with domain expertise in filing industry mechanics and tier placement logic.
- **Technical architecture lead** - Responsible for AI, privacy architecture, and systems-level implementation strategy.
- **Prototype status** - Days away from shipping. No code written in the blueprint repo yet; prototype is being built separately.

---

## What Was Updated

### Tea Tax Thesis (`tea-tax/tea-tax-thesis.md`)

- Added three-vertical product architecture section with composition diagram (Prep & Filing Engine eliminated)
- Added V1 metric signals section (completion rate, time-to-value, CTR)
- Added three-vector comparison model to the Comparison Engine vertical (baseline pricing, ancillary risk, aggregated sentiment)
- Added bait-and-switch likelihood / ick vector signal
- Pricing data problem section updated with Layer 1 / Layer 2 distinction

### Calypso Blueprint (`tea-tax-calypso-blueprint/`)

Nine files updated:

| File                                         | Change                                                                                                                                                                                                                                                                                                      |
| -------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `implementation-plan.md`                     | Restructured around three verticals (Practitioner Layer replaces Prep & Filing + Professional Layer). V1 metrics added. Pricing Discovery Project added as prerequisite for Comparison Engine. Tax Second Opinion sequenced ahead of Comparison as the first distribution wedge. Phase 5 scoped to Layer 2. |
| `features/08-comparison-engine.md`           | New file (replaces `08-recommendation-engine.md`). Three-vector model, CPA friend framing, portable object as shopping weapon.                                                                                                                                                                              |
| `features/11-community-pricing-database.md`  | Scoped to Layer 2 ancillary pricing. Contribution form captures upsell product breakdown.                                                                                                                                                                                                                   |
| `features/09-provider-routing-affiliates.md` | Renamed to "Provider Routing, Affiliate Integration & Practitioner Connect." Practitioner connect replaces filing waitlist. Portable export reframed as "Take your data and shop."                                                                                                                          |
| `userflows/03-provider-selection-handoff.md` | `PRACTITIONER_CONNECT` state replaces `FILING_WAITLIST` and `PROFESSIONAL_PLACEHOLDER`. Three vectors in comparison view. Ancillary risk and sentiment in provider disclosure.                                                                                                                              |
| `userflows/01-tax-situation-intake.md`       | 10-minute target (was 10-20). Shopping weapon framing. Terminal states renamed to `COMPARISON_READY`.                                                                                                                                                                                                       |
| `userflows/04-pricing-contribution.md`       | Ancillary product breakdown (offered vs. accepted). Cross-validation.                                                                                                                                                                                                                                       |
| `README.md`                                  | Three verticals (Practitioner Layer), updated phases, V1 metrics, Pricing Discovery prerequisite.                                                                                                                                                                                                           |
| `interview-transcript.md`                    | Session 2 confirmations added covering all decisions from this conversation.                                                                                                                                                                                                                                |

**Sequencing note:** Tax Second Opinion is treated as the #1 distribution wedge and moved earlier than the Comparison Engine in execution sequencing. Comparison remains core to the thesis and V1 value proposition, while Second Opinion is the fastest path to trust and pre-season traction.

---

## Open Questions for Next Session

1. **Privacy architecture specification.** The thesis promises zero-knowledge-level privacy. The AI intake requires plaintext processing. The honest architecture is probably a tiered trust model - no human access (policy), processing-time-only decryption (achievable), true zero-knowledge (not compatible with multi-modal AI). The spec should land on what's buildable and write the privacy commitment around the truth.
2. **Pricing Discovery Project scope.** TurboTax first. How much of Layer 1 baseline pricing is observable from the outside? Published content, client-side logic, testable flows? This determines whether the comparison engine can generate meaningful baseline prices at launch.
3. **Prototype metrics instrumentation.** The three V1 metrics need to be measurable from day one. What's the analytics setup?
4. **Mobile-first vs. responsive web.** Still TBD. Affects the intake UX decisions in Phase 2.
5. **Tax situation object export formats.** The portable object must export in formats that existing filing software (Drake, Lacerte, ProConnect, CCH) can consume when the Practitioner Layer comes online. Research which import formats each tool supports.
6. **Regulatory/compliance advisor.** Circular 230 is central to the long-term thesis. No in-house legal counsel is assumed. Before moving past V1, the organization needs dedicated expertise in this domain.
