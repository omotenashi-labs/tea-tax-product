# Pricing Data Contribution — State Machine

## Entry Condition
User is authenticated and has filed their taxes (through Tea Tax's referral or independently). The user wants to contribute what they actually paid to the community pricing database.

## Exit Condition (Goal Achieved)
User has submitted an anonymized pricing data point - including ancillary product breakdown - that is stored in the community database and reflected in aggregated pricing displays.

---

## States and Transitions

### State: CONTRIBUTION_PROMPT
**Meaning:** User is being invited to share what they paid. This can be triggered from the post-handoff screen, the dashboard, or a standalone "What Did You Actually Pay?" entry point.
**Entry:** User navigates to the pricing contribution form (from dashboard, post-filing prompt, or public campaign page).
**Available Actions:**
  - Begin contribution -> ENTERING_DATA (triggered by: user clicks "Share what I paid")
  - Dismiss -> (exit flow)
**Feedback:**
  - "Help others see through the pricing fog - tell us what you actually paid to file your taxes. We'll keep it anonymous."
  - Preview of how the data will be used (aggregated comparisons, hidden cost indicators, bait-and-switch tracking)
**Invariants:**
  - No data has been collected yet
  - User is authenticated (for rate limiting and anti-gaming; identity is not stored with the contribution)

---

### State: ENTERING_DATA
**Meaning:** User is filling out the pricing contribution form.
**Entry:** User begins the contribution.
**Available Actions:**
  - Submit contribution -> VALIDATING (triggered by: user fills required fields and submits)
  - Save draft -> ENTERING_DATA (triggered by: user saves progress but doesn't submit)
  - Cancel -> (exit flow)
**Feedback:**
  - Form fields:
    - Provider used (dropdown: TurboTax, H&R Block, TaxAct, FreeTaxUSA, Cash App Taxes, CPA, EA, Other)
    - Product tier (conditional dropdown based on provider: Free, Deluxe, Premier, Self-Employed, etc.)
    - Service level (DIY, Do It With Help, Do It For Me)
    - Number of state returns filed
    - Situation complexity (checkboxes: W-2 only, freelance/1099, investments, rental income, multi-state, business owner, crypto)
    - **Base price paid** (the tier/service price before any add-ons)
    - **Ancillary products offered** (checkboxes: audit protection/defense, refund advance loan, refund transfer fee, identity protection, MAX/premium bundle, state filing fee add-on, other)
    - **Ancillary products accepted** (which of the offered products the user actually purchased)
    - **Ancillary cost paid** (total cost of accepted ancillary products)
    - **Actual total cost paid** (all-in: base + state + ancillary - the final number on the receipt)
    - Optional: satisfaction rating (1-5 stars)
    - Optional: free-text comment ("What surprised you about the pricing?")
  - All fields clearly labeled as anonymized
**Invariants:**
  - Provider, base price, and total cost are required fields
  - User identity is associated for rate limiting only; not stored with the data point

---

### State: VALIDATING
**Meaning:** The system is validating the submitted data for completeness and plausibility.
**Entry:** User submits the form.
**Available Actions:**
  - Validation passes -> CONFIRMING (triggered by: all required fields present and values are plausible)
  - Validation fails -> ENTERING_DATA (triggered by: missing required field or implausible value; user is shown specific errors)
**Feedback:**
  - Brief processing indicator
  - If validation fails: specific error messages ("Please enter the total amount you paid" or "That amount seems unusually high - please double-check")
**Invariants:**
  - Data is not yet stored
  - Outlier detection flags values outside expected ranges but does not reject them outright (allows user to confirm)
  - Cross-validation: total cost should approximately equal base + state + ancillary (flag if not, but allow submission)

---

### State: CONFIRMING
**Meaning:** User reviews a summary of their contribution before final submission.
**Entry:** Validation passes.
**Available Actions:**
  - Confirm submission -> SUBMITTED (triggered by: user clicks "Submit")
  - Edit -> ENTERING_DATA (triggered by: user wants to change something)
  - Cancel -> (exit flow)
**Feedback:**
  - Summary: "You paid $247 total to TurboTax Premier (DIY) for a return with W-2, investments, and 1 state filing. Base price: $129. You were offered Audit Defense ($49) and MAX ($59) and accepted Audit Defense. Ancillary total: $49. State filing: $69."
  - "This will be anonymized and added to our community database"
  - Final submit button
**Invariants:**
  - Data has been validated but not yet persisted

---

### State: SUBMITTED
**Meaning:** The contribution has been anonymized and stored. This is the terminal state.
**Entry:** User confirms submission.
**Available Actions:**
  - View community pricing -> (navigates to the aggregated pricing tool)
  - Return to dashboard -> (exit flow)
  - Submit another contribution -> ENTERING_DATA (triggered by: user filed with multiple providers or for multiple years)
**Feedback:**
  - "Thank you! Your contribution helps others see the real cost of filing."
  - Show how many people have contributed and the aggregate for the user's provider/tier
  - Show the hidden cost delta for this provider: "The average [Provider] [Tier] user pays $X more than the advertised price"
  - Prompt to view the full community pricing data
**Invariants:**
  - Contribution is stored without PII linkage
  - Contribution is immediately reflected in aggregates (or within eventual consistency window)
  - Contribution cannot be traced back to the user

---

## Full State Diagram

```
┌──────────────────────┐
│ CONTRIBUTION_PROMPT   │
└──────────┬───────────┘
           │ begin
           ▼
┌──────────────────────┐
│ ENTERING_DATA         │◄──────────────┐
└──────────┬───────────┘               │
           │ submit                     │
           ▼                            │
┌──────────────────────┐               │
│ VALIDATING            │── fail ──────┘
└──────────┬───────────┘
           │ pass
           ▼
┌──────────────────────┐
│ CONFIRMING            │── edit ──► ENTERING_DATA
└──────────┬───────────┘
           │ confirm
           ▼
┌──────────────────────┐
│ SUBMITTED             │──► submit another ──► ENTERING_DATA
└──────────────────────┘
```

---

## Edge Cases and Recoveries

| Edge Case | Current State | Trigger | Recovery Path |
|-----------|---------------|---------|---------------|
| User enters $0 as cost (legitimately free filing) | VALIDATING | $0 submitted | -> CONFIRMING; $0 is a valid data point (Free File, free tier) |
| User enters implausibly high cost (e.g., $10,000 for TurboTax) | VALIDATING | Outlier detected | -> ENTERING_DATA; "That amount is unusually high for this provider. Please double-check. If it's correct, you can submit anyway." |
| Suspected gaming (many contributions from one account) | VALIDATING | Rate limit exceeded | -> ENTERING_DATA; "You've submitted several contributions recently. Please try again later." |
| User wants to amend a prior contribution | SUBMITTED | User returns | V1: not supported. Future: allow amendment within a time window. |
| User submits for a provider not in the dropdown | ENTERING_DATA | Selects "Other" | -> free-text field for provider name; contribution is stored and may be added to the dropdown if common |
| Total cost doesn't match base + state + ancillary | VALIDATING | Math mismatch | -> ENTERING_DATA; "Your total ($X) doesn't match the breakdown ($Y). This sometimes happens with bundled pricing - just confirm the total is correct." |
| User was offered ancillary products but declined all | ENTERING_DATA | All offered, none accepted | Valid and valuable data point - shows upsell pressure without conversion |
