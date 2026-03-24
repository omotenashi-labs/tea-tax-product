# Feature: Provider Routing, Affiliate Integration & Practitioner Connect

**Stage:** Phase 4 — Comparison Engine
**Vertical:** 2 — Comparison Engine (action layer)

---

## Motivation

Tea Tax empowers users in two complementary ways: the Comparison Engine shows them their best options, and the portable tax situation object gives them the structured data to act on it. The routing layer connects these to action - whether that's clicking through to a SaaS provider, shopping the market with the portable object, joining the Free File program, or connecting with a credentialed practitioner.

The portable object is a shopping weapon. A user who has their complete tax situation structured and portable can walk into any provider's intake flow and fly through it in minutes instead of hours. This turns the object from a data asset into a power tool that breaks the lock-in the industry depends on.

---

## Features

- **Affiliate link generation:** When a user selects a provider from the comparison matrix, generate a tracked affiliate link (CJ Affiliate for TurboTax, similar networks for others)
- **Free File Alliance routing:** Direct links to Free File Alliance member sites (no affiliate tracking; these are public service links)
- **Portable object export ("Take your data and shop"):** User can export their tax situation object as a downloadable JSON/PDF file. The framing is explicit: "This is your data. Take it to any provider's intake and skip the line - you'll get a real quote in minutes, not hours."
- **Practitioner connect ("Connect with a tax pro"):** Users whose situations are complex or who want professional help can express interest in the practitioner marketplace. In V1, this captures demand signal and situation complexity for the Practitioner Layer (Vertical 3). Post-V1, this becomes the direct marketplace connection.
- **Referral attribution:** Track which comparisons lead to click-throughs for revenue reporting (no user PII in tracking; only aggregate conversion data)
- **Transparent disclosure:** User is clearly informed that Tea Tax earns a referral fee when they click through to a commercial provider; Free File, export, and practitioner connect are never deprioritized because of this

---

## Test Plan

- [ ] Selecting a commercial provider generates a valid affiliate tracking link and redirects correctly
- [ ] Selecting a Free File Alliance option routes to the correct member site without affiliate tracking
- [ ] "Take your data and shop" produces a downloadable file containing the user's tax situation object
- [ ] Exported file is self-contained and parseable (valid JSON, or readable PDF summary)
- [ ] Practitioner connect captures user interest and situation complexity
- [ ] Affiliate disclosure is visible on the comparison page before the user clicks
- [ ] Referral tracking captures aggregate click-through data without user PII
- [ ] Free File options are not deprioritized when the user qualifies - they appear at or near the top
- [ ] Practitioner connect and export options are never deprioritized relative to affiliate-generating options

---

## Dependencies

- Affiliate network test/sandbox credentials (see [12-collect-test-credentials.md](12-collect-test-credentials.md))
