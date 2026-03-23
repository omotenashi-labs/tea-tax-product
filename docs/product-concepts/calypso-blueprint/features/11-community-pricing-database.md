# Feature: Community Pricing Database

**Stage:** Phase 5 — Community Pricing Database (Layer 2 Ancillary Pricing)
**Vertical:** 2 — Comparison Engine (data source)

---

## Motivation

Tax filing pricing has two layers. Layer 1 - baseline pricing - is deterministic and form-driven; it can be researched and mapped through the Pricing Discovery Project. Layer 2 - ancillary pricing - is where the opacity and the bait-and-switch actually live: audit protection, refund advances, refund transfer fees, identity protection bundles, and contextual upsells that are dynamically priced and deliberately opaque. This is the layer the FTC has fined incumbents for.

The Community Pricing Database is a crowdsourced transparency tool specifically targeting Layer 2. Real people report what they actually paid all-in, which ancillary products they were upsold, which they accepted, and what the total damage was. This data feeds into the Comparison Engine's ancillary risk vector and is also available as a standalone public tool ("What Did You Actually Pay?").

The vibe is "we the people" - anonymous, crowdsourced, unbiased, and impossible for providers to game. The war against pricing opacity is won by the community.

---

## Features

- **Pricing contribution flow:** After filing (or at any time), a user can contribute:
  - Provider used (TurboTax, H&R Block, TaxAct, FreeTaxUSA, CPA, etc.)
  - Tier / product level (Free, Deluxe, Premier, etc.)
  - Service level (DIY, DIWH, DIFM)
  - Situation complexity indicators (number of income types, state filings, schedules)
  - **Base price paid** (the tier price before any add-ons)
  - **Ancillary products offered:** Checklist of upsells the provider presented (audit protection, refund advance, refund transfer, identity protection, MAX/premium bundle, other)
  - **Ancillary products accepted:** Which of the offered products the user actually purchased
  - **Ancillary cost paid:** Total cost of ancillary products accepted
  - **Actual total cost paid:** All-in (base + state + ancillary)
  - Optional: satisfaction rating (1-5 stars)
  - Optional: free-text comment
- **Anonymization:** Contributions are anonymized; no PII is stored with pricing data points. Complexity indicators are categorical, not personally identifying.
- **Aggregated pricing display:** Public-facing tool showing:
  - Average / median total cost by provider, tier, and service level
  - Cost distribution by situation complexity
  - **Ancillary upsell frequency:** How often each provider pushes specific ancillary products
  - **Ancillary acceptance rate:** What percentage of users accept each upsell
  - **Hidden cost delta:** Average gap between advertised/baseline price and actual all-in cost paid
  - Price trends over time (year-over-year, within-season)
- **Comparison Engine integration:** Community pricing data enriches the ancillary risk vector in the Comparison Engine. Baseline pricing comes from the Pricing Discovery Project; community data provides the Layer 2 reality check.
- **Anti-gaming:** Rate limiting, statistical outlier detection, and account age requirements to prevent providers from flooding fake data

---

## Test Plan

- [ ] Authenticated user can submit a pricing contribution with all required fields including ancillary product breakdown
- [ ] Contribution is stored without PII - no link back to the user's identity or tax situation
- [ ] Anonymous visitor can browse aggregated pricing data without signing in
- [ ] Aggregated view correctly calculates average/median for a given provider and tier
- [ ] Ancillary upsell frequency is calculated correctly (e.g., "78% of TurboTax Premier users were offered Audit Defense")
- [ ] Hidden cost delta displays correctly (advertised vs. actual average)
- [ ] Adding a new contribution updates the aggregate (eventual consistency is acceptable)
- [ ] Statistical outlier (e.g., $50,000 for TurboTax Free) is flagged and excluded from aggregates
- [ ] Community pricing data appears in the Comparison Engine's ancillary risk warnings when available
- [ ] Pricing display distinguishes between "estimated" (from Pricing Discovery) and "community-reported" (from crowdsourced data)
