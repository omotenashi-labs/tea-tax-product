# Provider Selection & Handoff — State Machine

## Entry Condition
User has a completed tax situation object and is viewing the comparison matrix (COMPARISON_READY state in the Tax Situation Intake flow).

## Exit Condition (Goal Achieved)
User has either (a) clicked through to a filing provider via affiliate link, (b) been routed to a Free File Alliance member, (c) exported their portable tax situation object to shop the market, or (d) signed up for the practitioner marketplace waitlist.

---

## States and Transitions

### State: BROWSING_COMPARISON
**Meaning:** User is reviewing the three-vector comparison matrix and exploring their options.
**Entry:** User reaches COMPARISON_READY in the intake flow.
**Available Actions:**
  - Select a commercial provider -> PROVIDER_DISCLOSURE (triggered by: user clicks a commercial filing option)
  - Select a Free File option -> FREE_FILE_ROUTING (triggered by: user clicks a Free File Alliance member)
  - Export portable object -> EXPORTING (triggered by: user clicks "Take my data and shop")
  - Connect with a practitioner -> PRACTITIONER_CONNECT (triggered by: user clicks "Connect with a tax pro")
  - Export portable object to bring to own CPA -> EXPORTING (triggered by: user clicks "Take my data and shop")
  - Go back to intake -> (exits to CONVERSATIONAL_INTAKE in intake flow)
**Feedback:**
  - Three-vector comparison matrix: baseline price estimate, ancillary risk warnings (upsell likelihood, hidden cost delta), and sentiment score with bait-and-switch indicator per provider
  - Personalized explanation for each ranking ("This is ranked #1 for you because...")
  - Free File eligibility badge (if applicable)
  - Portable object framing: "Your tax situation is structured and portable. You can take it anywhere."
  - Affiliate disclosure: "Tea Tax earns a referral fee when you file through a partner. Free File, export, and practitioner connect are always available."
**Invariants:**
  - Comparisons are based on the current tax situation object
  - No provider is artificially boosted by affiliate economics
  - Sentiment and ick data are sourced from public reviews, not provider-curated

---

### State: PROVIDER_DISCLOSURE
**Meaning:** User has selected a commercial provider. Before redirect, the system shows a transparent disclosure and confirms the handoff.
**Entry:** User selects a commercial provider from the matrix.
**Available Actions:**
  - Confirm and proceed -> REDIRECTING (triggered by: user clicks "Continue to [Provider]")
  - Go back -> BROWSING_COMPARISON (triggered by: user decides to explore other options)
**Feedback:**
  - Provider name, estimated baseline cost, and what's included at this tier
  - Ancillary risk warning: "Based on your situation, [Provider] is likely to offer you [specific upsells]. You don't have to accept them."
  - Sentiment snapshot: "[Provider] has a [X/5] rating from [N] reviews. Bait-and-switch likelihood: [High/Medium/Low]."
  - Disclosure: "You'll be redirected to [Provider]. Tea Tax earns a referral fee for this. Your tax data is not shared with [Provider] - you'll enter it on their site."
  - If portable export is supported by provider (future): "You can also send your tax situation data to pre-fill your return"
**Invariants:**
  - No user data is transmitted to the provider at this stage
  - Affiliate link has not been triggered yet

---

### State: REDIRECTING
**Meaning:** The system generates the affiliate tracking link and redirects the user to the provider's site.
**Entry:** User confirms the handoff.
**Available Actions:**
  - Redirect succeeds -> HANDOFF_COMPLETE (triggered by: browser navigates to provider)
  - Redirect fails -> PROVIDER_DISCLOSURE (triggered by: link generation error; user can retry)
**Feedback:**
  - Brief redirect message: "Taking you to [Provider]..."
**Invariants:**
  - Affiliate tracking captures aggregate conversion data only (no user PII in tracking payload)
  - User's browser navigates away from Tea Tax

---

### State: FREE_FILE_ROUTING
**Meaning:** User has selected a Free File Alliance member. The system provides a direct link (no affiliate tracking).
**Entry:** User selects a Free File option.
**Available Actions:**
  - Proceed to Free File site -> HANDOFF_COMPLETE (triggered by: user clicks through)
  - Go back -> BROWSING_COMPARISON (triggered by: user wants to explore other options)
**Feedback:**
  - "You qualify for free filing through [Free File Member]. This is a government-supported program - there is no cost and no referral fee."
  - Direct link to the Free File member's IRS Free File landing page
**Invariants:**
  - No affiliate tracking on Free File links
  - Free File option is never deprioritized

---

### State: EXPORTING
**Meaning:** The system is generating a downloadable export of the user's tax situation object.
**Entry:** User selects "Take my data and shop."
**Available Actions:**
  - Export succeeds -> HANDOFF_COMPLETE (triggered by: file download starts)
  - Export fails -> BROWSING_COMPARISON (triggered by: generation error; user can retry)
**Feedback:**
  - Format selection (if multiple formats): JSON (structured, machine-readable), PDF (human-readable summary)
  - Framing: "This is your data. Take it to any provider's intake and skip the line - you'll get a real quote in minutes, not hours."
  - Download confirmation
**Invariants:**
  - Exported file contains the user's data and nothing else (no tracking, no watermarks)
  - Export is decrypted - the user gets plaintext of their own data

---

### State: PRACTITIONER_CONNECT
**Meaning:** User wants to connect with a credentialed tax practitioner (CPA, EA, attorney). In V1, this captures demand for the Practitioner Layer (Vertical 3) and routes users to export their data for their own practitioner.
**Entry:** User selects "Connect with a tax pro."
**Available Actions:**
  - Sign up for marketplace waitlist -> HANDOFF_COMPLETE (triggered by: user confirms interest in being matched with a practitioner)
  - Export for own practitioner -> EXPORTING (triggered by: user decides to export and bring to their own CPA/EA)
  - Go back -> BROWSING_COMPARISON (triggered by: user returns to comparison)
**Feedback:**
  - "Our practitioner marketplace is coming soon. We'll match you with a credentialed tax pro who specializes in your situation - and they'll receive your tax data pre-structured so you save time and money."
  - Captures: email, situation complexity summary (for demand segmentation and practitioner matching when marketplace launches)
  - "In the meantime, you can export your tax situation and bring it to your own CPA or EA - it'll save them hours of intake work."
**Invariants:**
  - No practitioner matching or marketplace functionality in V1
  - Waitlist data is used for demand signal only; not shared externally
  - User is always offered the export path as an immediate alternative

---

### State: HANDOFF_COMPLETE
**Meaning:** The user has successfully left Tea Tax to file with a provider, use Free File, downloaded their export, or signed up for the practitioner marketplace. This is the terminal state.
**Entry:** Redirect, Free File link click, export download, or waitlist signup completes.
**Available Actions:**
  - Return to dashboard -> (user can come back at any time)
  - Contribute pricing data -> (exits to Pricing Contribution flow; shown as a prompt after the user has filed)
**Feedback:**
  - If redirect/Free File: "Good luck filing! When you're done, come back and tell us what you actually paid - it helps everyone."
  - If export: "Your data is downloaded. Take it to any provider and skip the intake. Come back and tell us what you paid!"
  - If practitioner waitlist: "You're on the list! We'll reach out when the practitioner marketplace is live for your situation."
**Invariants:**
  - User's account and tax situation remain intact for future visits

---

## Full State Diagram

```
┌────────────────────────┐
│  BROWSING_COMPARISON    │
└──┬────┬────┬────┬──────┘
   │    │    │    │
   │    │    │    └── connect pro ──► PRACTITIONER_CONNECT
   │    │    │                              │
   │    │    └── export ──────────────► EXPORTING
   │    │                                   │
   │    └── free file ──► FREE_FILE_ROUTING │
   │                            │           │
   │                            ▼           ▼
   └── commercial ──► PROVIDER_DISCLOSURE   │
                          │                 │
                          ▼                 │
                     REDIRECTING            │
                          │                 │
                          ▼                 │
                   HANDOFF_COMPLETE ◄───────┘
```

---

## Edge Cases and Recoveries

| Edge Case | Current State | Trigger | Recovery Path |
|-----------|---------------|---------|---------------|
| Affiliate link is broken or expired | REDIRECTING | HTTP error on redirect | -> PROVIDER_DISCLOSURE; "Something went wrong. Try again or choose another option." |
| Free File member site is down | FREE_FILE_ROUTING | Site unreachable | -> BROWSING_COMPARISON; inform user and suggest other Free File members |
| User qualifies for Free File but selects a paid option | PROVIDER_DISCLOSURE | User choice | Allow it - show a reminder: "You qualify for free filing. Still want to proceed with [paid provider]?" |
| Export file is very large (complex situation) | EXPORTING | Large payload | Generate asynchronously; notify when ready for download |
| User returns after filing and wants to contribute pricing | HANDOFF_COMPLETE | User returns | -> Pricing Contribution flow |
| Sentiment data unavailable for a provider | BROWSING_COMPARISON | No review data | Display "No community data yet" instead of a score; don't hide the provider |
| User signs up for practitioner waitlist then wants to also file via SaaS | PRACTITIONER_CONNECT | User wants both | Waitlist signup -> HANDOFF_COMPLETE -> user can return and choose another path |
