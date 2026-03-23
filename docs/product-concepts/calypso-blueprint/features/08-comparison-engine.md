# Feature: Comparison Engine

**Stage:** Phase 4 — Comparison Engine
**Vertical:** 2 — Comparison Engine

---

## Motivation

This is where Tea Tax delivers its core consumer empowerment value. The comparison engine translates a user's specific tax situation into a personalized, transparent, side-by-side view of every filing option available - showing not just what it costs, but what the experience will feel like and where the hidden charges live.

Today, no tool does this. Users pick tax software based on ads, inertia, or generic editorial reviews. Tea Tax compares based on the user's actual situation and gives them three things the industry has never provided together: honest pricing, ancillary risk visibility, and real sentiment from real people.

The comparison should feel like advice from an impartial CPA friend - not a comparison table. "Based on your situation, here's what I'd do if I were you, and here's why" is the voice. The user walks in overwhelmed and walks out empowered with the information and the structured data to shop the market on their own terms.

---

## Three-Vector Comparison Model

### Vector 1: Baseline Pricing

Deterministic, form-driven pricing that can be computed from the user's tax situation object.

- **Provider database:** Structured catalog of filing options:
  - Free File Alliance members (8 providers, eligibility rules based on AGI and other criteria)
  - Commercial software tiers (TurboTax Free/Deluxe/Premier/Self-Employed, H&R Block, TaxAct, FreeTaxUSA, etc.)
  - Service levels within each provider (DIY, DIWH, DIFM)
  - Local CPA / EA referral (post-V1, but placeholder in comparison)
- **Form-to-tier mapping:** Rules engine that maps the tax situation object's form makeup to each provider's tier placement:
  - Simple W-2 only -> Free File, free tiers of commercial products
  - Freelance / 1099 -> Self-employed tiers, Schedule C support
  - Investments / crypto -> Premier-tier or CPA
  - Multi-state -> providers that support multi-state, additional state filing costs
  - Rental income / K-1 -> advanced tiers or CPA
  - Quantity vectors: multiple W-2s, multiple 1099s may affect tier placement
- **Published price tracking:** Baseline tier prices are tracked over time (they shift through the season, typically increasing as the deadline approaches)
- **State filing costs:** Per-state add-on costs included in the baseline estimate

**Data source:** The Pricing Discovery Project (see implementation plan). This is a research-driven, domain-expertise project that produces the form-to-tier mapping and price tracking for the top 5 providers.

### Vector 2: Ancillary Risk

The opaque layer where the bait-and-switch lives. The comparison engine warns users about upsells they're likely to encounter based on their situation, even when exact pricing isn't known.

- **Known ancillary products by provider:** Audit protection/defense, refund advance loans, refund transfer fees, identity protection, MAX/premium bundles, state filing fees (when bundled rather than listed)
- **Upsell likelihood indicators:** Based on the user's situation complexity, flag which ancillary products the provider is likely to push ("TurboTax will offer you Audit Defense for ~$49 and a MAX bundle that adds ~$60")
- **Community pricing data integration:** When available, show what people with similar situations actually paid all-in (from the Community Pricing Database, Phase 5)
- **"Hidden cost" delta:** The estimated gap between the advertised/baseline price and the likely all-in cost after ancillary products

**Data source:** Initially populated from domain expertise and public pricing pages. Enriched over time by the Community Pricing Database (crowdsourced Layer 2 data).

### Vector 3: Aggregated Sentiment

The qualitative dimension. Public review data aggregated across every discoverable source into a provider-level vibe-check score.

- **Source aggregation:** Trustpilot, BBB, App Store, Google Play, Reddit, Twitter/X, and any other public review platforms
- **Provider sentiment score:** Aggregated, normalized score per provider, updated regularly
- **Temporal tracking:** Score trends over time (L7, L30, season-over-season) so users can see if a provider is getting better or worse
- **Bait-and-switch likelihood signal:** Derived from the frequency of surprise-charge complaints, the gap between advertised and reported pricing, FTC enforcement history, and the pattern of reviews mentioning forced tier upgrades or upsell pressure. This is the ick vector - it directly quantifies the feeling that "the people" don't trust incumbents.
- **Situation-specific sentiment:** Where data volume allows, segment reviews by situation type (freelancer reviews of TurboTax Self-Employed vs. simple filer reviews of TurboTax Free)

**Data source:** Public, scrapable, no partnerships required. Buildable from day one.

---

## Comparison Display

- **Side-by-side matrix** showing all three vectors for each option: baseline price estimate, ancillary risk warnings, and sentiment score with bait-and-switch indicator
- **Personalized explanation:** Each comparison includes plain-language reasoning: "This option is ranked #1 for you because your situation is straightforward, you qualify for their free tier, and their reviews from similar filers are strong"
- **Free File eligibility:** Prominently surfaced when the user qualifies (AGI under $89K) - these options appear at or near the top
- **Default sort:** Always "best fit for you" - never "highest bidder"
- **Transparency:** If a provider pays for placement, it's clearly labeled. Methodology is published. Every ranking includes an explanation of why it ranked where it did.
- **Portable object as shopping weapon:** The comparison screen makes it clear that the user's structured tax situation object is theirs - they can export it and use it to quickly get real quotes from any provider, flying through intake flows that would otherwise take an hour

---

## Test Plan

- [ ] User with AGI < $89K and simple W-2 -> Free File Alliance options are prominently surfaced
- [ ] User with freelance income -> self-employed tier products ranked highest with correct baseline pricing
- [ ] User with investments and multi-state -> appropriate tier products shown with multi-state surcharge included in cost
- [ ] Baseline price estimates include state filing costs, not just the base tier price
- [ ] Ancillary risk warnings appear for providers known to upsell (audit protection, refund advance, etc.)
- [ ] Community pricing data (when available) is shown alongside baseline estimates with clear labeling
- [ ] Sentiment scores are displayed per provider with temporal trend indicators
- [ ] Bait-and-switch likelihood signal is visible and derived from public review data
- [ ] Comparison matrix is sorted by fit score; user can re-sort by price, sentiment, or ick factor
- [ ] Each comparison includes a plain-language explanation of the ranking
- [ ] Provider database can be updated without code changes (data-driven, not hardcoded)
- [ ] Portable object export is accessible directly from the comparison screen

---

## Dependencies

- Pricing Discovery Project must be complete before baseline pricing is meaningful
- Community Pricing Database (Phase 5) enriches ancillary risk over time but is not required for launch
- Sentiment data pipeline can be built independently and in parallel
