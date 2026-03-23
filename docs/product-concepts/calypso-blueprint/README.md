# Tea Tax

A free, AI-powered tax filing platform that acts as an impartial CPA friend for anyone who needs to do their taxes. Tea Tax guides users through a multi-modal intake experience to build a structured, portable tax situation object, then delivers transparent, personalized comparisons with real pricing, ancillary risk warnings, and aggregated sentiment - empowering users to shop the market on their own terms.

Based on the [Tea Tax Product Thesis](../tea-tax/tea-tax-thesis.md).

---

## Product Architecture: Three Verticals

| Vertical | Name | V1 | Description |
|----------|------|----|-------------|
| 1 | **Intake Engine** | Yes | Multi-modal AI intake that produces the portable tax situation object |
| 2 | **Comparison Engine** | Yes | Three-vector transparency layer: baseline pricing, ancillary risk, aggregated sentiment |
| 3 | **Practitioner Layer** | No | Marketplace + coordination layer for credentialed practitioners. Integrates with existing filing software. |

V1 ships Verticals 1 and 2. The tax situation object is the connective tissue between all three verticals.

---

## Implementation Plan

**[View the full Implementation Plan](implementation-plan.md)**

Tax Second Opinion is sequenced as an early distribution wedge and can run in parallel with core V1 work. The core V1 product remains Intake + Comparison.

### Phases

| Phase | Focus | Features |
|-------|-------|----------|
| 1 | Foundation | Authentication, Tax Situation Object, Privacy & Encryption |
| 2 | Intake Engine | AI Chat, Document Capture, Voice/Video, Plaid |
| 3 | Tax Second Opinion | Return upload, opportunity analysis, savings estimates |
| 4 | Comparison Engine | Three-vector comparison (pricing, risk, sentiment), Affiliate Routing, Practitioner Connect, Portable Export |
| 5 | Community Pricing (Layer 2) | Crowdsourced ancillary pricing contributions, public pricing tool |
| 6 | External Credentials | Sandbox API keys for all integrations |

### Prerequisites

| Prerequisite | Description |
|-------------|-------------|
| Pricing Discovery Project | Research-driven mapping of baseline (Layer 1) pricing for top 5 providers. Required before Phase 4. |

### V1 Success Metrics

| Metric | Target |
|--------|--------|
| Intake Completion Rate | 60%+ |
| End-to-End Time to Value | 10 minutes or less |
| Comparison Click-Through Rate | 40%+ |

### Open Items

- Mobile-first vs. web strategy: TBD
- Privacy architecture phasing (full zero-knowledge in V1 or layered): TBD
- Subpoena / law enforcement compliance architecture: TBD
- Tax situation object export formats for existing filing software: TBD

---

## Feature Issues

See the [features/](features/) directory for individual feature specifications.

## Userflow State Machines

See the [userflows/](userflows/) directory for formalized state machines covering all primary user goals.

## Interview Transcript

See [interview-transcript.md](interview-transcript.md) for the product owner interview Q&A that produced these artifacts.
