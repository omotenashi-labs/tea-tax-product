# Tea Tax — Product Owner Interview Transcript

**Date:** 2026-03-22
**Product Owner:** Tea Tax product direction owner
**Interviewer:** AI Agent
**Source material:** Tea Tax Product Thesis, Tea Tax Distribution Strategy, Tea Tax Thesis Chat Transcript

Note: This transcript captures point-in-time interview language. For launch MVP data model and access control decisions, use `docs/requirements/tax-object-ownership-and-access-spec.md` as the canonical source.

---

## Pre-filled Questionnaire (Confirmed)

### 1. Product Vision & Value Proposition

**What is the core problem this application solves for the user?**

> The tax filing industry is opaque by design. Consumers face pricing bait-and-switches (starts "free," ends expensive), decision paralysis (no impartial way to compare filing options), and preparation anxiety (not knowing what documents they need, what life events matter, or where to start). There is no impartial, intake-driven recommendation tool that tells a specific person, based on their actual tax situation, what their best filing option is and what it will actually cost.

**How does the user currently solve this problem, and how is this application better?**

> Today, users default to whatever they used last year (~80% reuse), ask friends and family for word-of-mouth recommendations, or read static editorial "best tax software" articles (NerdWallet, Wirecutter) that aren't personalized. None of these paths collect the user's actual situation and recommend based on it. This product is better because it acts as a personalized, AI-driven intake that produces a structured understanding of the user's tax situation and then delivers honest, side-by-side comparisons with real all-in pricing - like having a savvy, impartial CPA friend.

**What does a successful outcome look like for the primary user?**

> The user walks in unprepared and anxious, and walks out with: (1) a complete, structured, portable representation of their tax situation (the "tax situation object"), (2) a clear, transparent comparison of every filing option for their specific situation showing pricing, ancillary risk, and real sentiment, and (3) the confidence and data to act on it - whether that means filing through a Free File Alliance member, using a commercial product, exporting the portable object to shop the market, or connecting with a local CPA.

---

### 2. Core Workflows & User Stories

**Describe the "Happy Path" from sign-up to primary goal achieved.**

> 1. User arrives at the product (web, mobile-first)
> 2. User begins a multi-modal intake experience - guided conversational AI chat, with options to upload documents (W-2s, 1099s, receipts), capture photos/video of paperwork, talk through their situation via voice, and optionally connect financial accounts via Plaid
> 3. The system progressively builds the user's tax situation object, asking follow-up questions, flagging missing information, and providing encouragement along the way (white-glove CPA friend feel, not software onboarding)
> 4. Once the system has sufficient data, it produces a transparent three-vector comparison: side-by-side filing options showing baseline pricing, ancillary risk warnings (upsell likelihood, hidden cost delta), and aggregated sentiment (including bait-and-switch likelihood) - sorted by "best fit for you"
> 5. User selects a path: clicks through to a provider (affiliate link), exports the portable tax situation object to shop the market, or connects with a practitioner from the marketplace
> 6. User can optionally share what they actually paid back to the community pricing database, including ancillary product breakdown

**What are the most common edge cases or alternative workflows?**

> - User has already filed and wants a "Tax Second Opinion" (upload completed return to check if they left money on the table)
> - User abandons intake partway through - system saves progress and allows resumption
> - User's situation is too complex for self-service recommendations - system routes to a credentialed professional via the marketplace (post-V1 placeholder in V1)
> - User cannot provide certain documents yet - system tracks documentation completeness and allows partial intake with a "come back when you have X" nudge
> - User qualifies for Free File Alliance (AGI under $89K) - system surfaces this prominently
> - User wants to share/export the portable object without choosing a provider through the platform
> - User wants professional help - captured via practitioner connect (Practitioner Layer marketplace is post-V1)

**Are there complex state machines for entities?**

> Yes:
> - **Tax Situation Object lifecycle**: creation -> progressive enrichment (multi-modal inputs) -> documentation completeness check -> comparison generation -> export/share/act
> - **Provider comparison flow**: intake complete -> generate three-vector comparison matrix -> user selects option -> referral/export/practitioner connect -> optional pricing data contribution back to community
>
> CPA marketplace engagement lifecycle is post-V1.

**What entities exist and how do they interact?**

> - **User** - the taxpayer; owns their tax situation object
> - **Tax Situation Object** - the structured, portable representation of the user's complete tax situation (income streams, deductions, life events, documents, confidence scores)
> - **Filing Provider** - external entity (TurboTax, H&R Block, Free File Alliance members, CPAs); compared across three vectors
> - **Comparison** - the personalized three-vector matrix generated from the user's situation (pricing, ancillary risk, sentiment)
> - **Pricing Data Point** - crowdsourced community contribution (provider, tier, situation complexity, base cost, ancillary products offered/accepted, actual total cost, timestamp)
> - **Sentiment Data** - aggregated public review data per provider (Trustpilot, Reddit, App Store, etc.) with bait-and-switch likelihood signal
> - **Raw Artifact** - uploaded document, photo, video, or voice recording that feeds into the tax situation object
>
> CPA/Tax Professional entity (profile, credentials, reviews) is post-V1 marketplace scope.

---

### 3. User Roles, Permissions, and Access

**What distinct types/roles of users exist?**

> For V1:
> - **Taxpayer (primary user)** - the person filing; full control over their data; can create, view, edit, export, and delete their tax situation object
> - **Anonymous visitor** - can browse crowdsourced pricing data, sentiment scores, and general information; no intake or personal data
>
> Post-V1:
> - **Credentialed Tax Professional (CPA/EA)** - can view a user's tax situation only with explicit, granular, time-bound, revocable consent
> - **Administrator** - explicitly has NO access to any user tax data (core tenet: "no god mode"); limited to platform operations that don't involve user PII

**What can each role access? What are they restricted from?**

> - **Taxpayer**: Full CRUD on their own tax situation object, documents, and pricing contributions. Cannot see other users' data. Can grant/revoke access to credentialed professionals (post-V1).
> - **Anonymous visitor**: Read-only access to aggregated, anonymized pricing data and provider sentiment scores. No PII exposure.
> - **Credentialed Professional (post-V1)**: Read-only access to specific user data with explicit scoped permission. Cannot modify user data. Access is logged and visible to the user.
> - **Administrator**: Zero access to user tax situations or associated data. Can manage platform configuration, view aggregate system health metrics, manage provider listings. Cannot view, search, or export individual user records.

**Does authorization depend on complex conditions?**

> Yes - the credentialed professional access model (post-V1) is the most complex: scoped, time-bound, revocable, logged, and visible to the user.
>
> Subpoena / law enforcement compliance architecture is **TBD**. The platform must be compliant from a regulatory and law enforcement standpoint. Design to be determined - the zero-access architecture creates an interesting tension with compliance obligations.

**Is there a distinction between user and customer?**

> In V1, these are the same: the user IS the taxpayer/customer. No multi-tenant scenario in V1.

**What CRUD views should different roles have?**

> - **Taxpayer**: Full self-service dashboard - view/edit tax situation, manage documents, view comparisons, export data, delete account
> - **Anonymous visitor**: Pricing comparison tool and sentiment scores (read-only, aggregated data)

---

### 4. External Integrations (Business Context)

**What external services must the system integrate with?**

> - **Plaid** - financial account connection to pull income, expense, and transaction context
> - **OCR service** - document extraction from photos/uploads (W-2s, 1099s, receipts). May be handled by proprietary local models.
> - **Affiliate networks** - CJ Affiliate (TurboTax 10-15% rev share), similar programs for H&R Block, TaxAct, FreeTaxUSA
> - **Free File Alliance** - routing/linking to the 8 member providers (link-based, no direct API)
> - **AI model APIs** - frontier model for complex reasoning (Anthropic/Claude); proprietary local models for routine extraction and classification
> - **Public review APIs / scraping** - Trustpilot, App Store, Google Play, Reddit, BBB for sentiment aggregation

**What business actions trigger calls to external services?**

> - User connects a financial account -> Plaid API call
> - User uploads/captures a document -> OCR/extraction pipeline
> - User completes intake and views comparisons -> affiliate links generated
> - User selects a provider -> redirect through affiliate tracking link
> - During intake, complex situational reasoning -> frontier model API call
> - During intake, routine extraction/classification -> proprietary local model inference
> - Sentiment data refresh -> public review source ingestion (scheduled, not user-triggered)

---

### 5. Test Credentials and Setup

> No test credentials collected at interview time. Tracking issues created:
> - Plaid sandbox credentials
> - OCR service credentials (if using third-party)
> - Affiliate network test credentials
> - Anthropic API key for development
> - Email service credentials
>
> See [features/12-collect-test-credentials.md](features/12-collect-test-credentials.md)

---

## Product Owner Confirmations

The following items were explicitly confirmed by the product direction owner:

| Question | Answer |
|----------|--------|
| Product name: Tea Tax | Confirmed |
| V1 scope: Intake Engine + Comparison Engine, no marketplace, no Practitioner Layer, no advice/strategy, no filing | Confirmed |
| Tax Second Opinion in V1 | Confirmed |
| Community Pricing Database in V1 | Confirmed - scoped to Layer 2 ancillary pricing |
| Mobile-first vs. web | TBD |
| Privacy architecture phasing | TBD - pending privacy architecture spec |
| Subpoena / law enforcement compliance | TBD - platform must be compliant from regulatory/law enforcement standpoint |

---

## Product Owner Confirmations (Session 2 - Thesis Review & Reframe)

The following items were confirmed during the thesis review and strategic reframe session:

> **Note:** Session 2 captured an intermediate architecture. Session 3 supersedes any four-vertical or filing-waitlist references below.

| Question | Answer |
|----------|--------|
| Four-vertical product architecture (Intake, Comparison, Prep & Filing, Professional Layer) | Confirmed in Session 2; superseded by Session 3 three-vertical architecture |
| V1 ships Verticals 1 + 2 only | Confirmed |
| Prep & Filing Engine as future vertical (not V1) | Confirmed in Session 2; superseded by Session 3 practitioner-layer framing |
| Comparison Engine three-vector model (baseline pricing, ancillary risk, aggregated sentiment) | Confirmed |
| Aggregated sentiment / bait-and-switch ick vector from public review data | Confirmed - buildable from day one, no dependencies |
| Baseline (Layer 1) pricing is deterministic, form-driven, solvable via Pricing Discovery Project | Confirmed |
| Ancillary (Layer 2) pricing is opaque, crowdsourced via Community Pricing Database | Confirmed |
| Pricing Discovery Project as prerequisite for Comparison Engine (starting with TurboTax) | Confirmed - separate scoping needed |
| V1 metrics: completion rate (60%+), time-to-value (10min), CTR (40%+) | Confirmed |
| Portable tax situation object as shopping weapon | Confirmed - empowers users to shop the market with structured data |
| Filing waitlist in V1 to capture demand for Vertical 3 | Confirmed in Session 2; superseded by practitioner connect in Session 3 |
| No e-file transmission in V1 | Confirmed |
| Dedicated technical lead for privacy architecture | Confirmed |
| Privacy architecture specification owner is TBD | Confirmed |
| Tax Second Opinion extends seasonal window; is #1 distribution wedge | Confirmed |
| Comparison + portable object together drive virality: both empower users in ways the current industry does not | Confirmed |

---

## Product Owner Confirmations (Session 3 - Practitioner Layer Reframe)

The following items were confirmed during the session that eliminated the Prep & Filing Engine and reframed the Professional Layer as the Practitioner Layer:

| Question | Answer |
|----------|--------|
| Eliminate Prep & Filing Engine (Vertical 3 from four-vertical model) | Confirmed - filing is a solved problem; building it adds regulatory liability and competes with practitioner tools |
| Three-vertical architecture: Intake Engine, Comparison Engine, Practitioner Layer | Confirmed |
| Practitioner Layer integrates with existing filing software, does not replace it | Confirmed - practitioners evaluate and lock in tech stacks post-season (May-Sep); switching costs are massive |
| "Practitioner" as the naming convention (Circular 230 language) | Confirmed - calls out the credential, the HITL truth, and the right abstraction |
| Practitioner Layer = marketplace + coordination layer (not practice management) | Confirmed - "practice management" is an existing category (TaxDome, Canopy, Karbon) that would create a positioning collision |
| Coordination layer wraps around existing tools (Drake, Lacerte, ProConnect, CCH) | Confirmed - the pitch is "keep your filing software, we handle everything upstream and around it" |
| Filing waitlist in V1 replaced by practitioner connect (demand signal for marketplace) | Confirmed |
| Tea Tax never needs IRS Authorized e-File Provider status | Confirmed - filing liability stays with the existing software and the credentialed practitioner |
| Supply-side GTM pitch: "We're not asking you to change your tax software. We send you pre-structured clients and make you 10x more productive with the tools you already use." | Confirmed |
