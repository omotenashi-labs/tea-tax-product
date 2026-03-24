# Feature: Tax Second Opinion

**Stage:** Phase 3 — Tax Second Opinion

---

## Motivation

The Tax Second Opinion is the #1 distribution wedge in the launch strategy. Many taxpayers have already filed or are about to file, and they wonder: "Did I leave money on the table?" This feature lets users upload a completed return and get an AI-powered analysis of potentially missed deductions, credits, or filing strategy improvements. It serves as a standalone entry point to the platform — users who get value from the second opinion are likely to use the full intake experience next year.

---

## Features

- **Return upload:** User uploads a completed tax return (PDF of 1040 and schedules, or images of printed return)
- **Return parsing:** OCR and structured extraction of the filed return — AGI, filing status, income lines, deductions taken, credits claimed, schedules filed
- **Opportunity analysis:** AI compares the filed return against:
  - Common deductions/credits the user may have qualified for but didn't claim
  - Filing status optimization (e.g., married filing separately vs. jointly)
  - Education credits, earned income credit, child tax credit, saver's credit eligibility
  - Estimated tax payment optimization (for self-employed users)
- **Savings estimate:** For each identified opportunity, provide an estimated dollar range of potential savings
- **Summary report:** Clear, plain-language report: "Based on your return, here are 3 things that might save you money"
- **Circular 230 boundary:** The report identifies opportunities and estimates savings but does not constitute tax advice. Language is carefully scoped: "You may qualify for..." not "You should claim..."
- **Conversion path:** After viewing the report, user is prompted to try the full intake experience or connect with a credentialed professional

---

## Test Plan

- [ ] User uploads a sample 1040 PDF → system extracts filing status, AGI, income lines, deductions, credits
- [ ] System correctly identifies a missed earned income credit on a qualifying return
- [ ] System correctly identifies a missed education credit (American Opportunity / Lifetime Learning) on a qualifying return
- [ ] System does not flag false positives for deductions the user clearly doesn't qualify for
- [ ] Savings estimates are presented as ranges, not precise amounts
- [ ] Report language stays within Circular 230 boundaries (informational, not advisory)
- [ ] After viewing the report, user sees a clear path to the full intake or to connect with a professional
- [ ] Unsupported return format is handled gracefully (e.g., handwritten return → "We can't parse this yet")
