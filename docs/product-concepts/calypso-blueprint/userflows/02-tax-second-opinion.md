# Tax Second Opinion — State Machine

## Entry Condition
User is authenticated. User has a completed tax return (filed or ready to file) that they want analyzed for missed opportunities.

## Exit Condition (Goal Achieved)
User has reviewed a plain-language report identifying potentially missed deductions, credits, or optimizations, with estimated savings ranges.

---

## States and Transitions

### State: UPLOAD_RETURN
**Meaning:** User is ready to provide their completed tax return for analysis.
**Entry:** User selects "Get a Second Opinion" from the dashboard or landing page.
**Available Actions:**
  - Upload return document → PARSING_RETURN (triggered by: user uploads PDF or image of their completed return)
  - Cancel → (exit flow)
**Feedback:**
  - Clear instructions: "Upload your completed 1040 (and schedules) as a PDF or photo"
  - Supported format list
  - Privacy assurance: "Your return is encrypted and never shared"
**Invariants:**
  - No return data has been stored yet
  - User is authenticated

---

### State: PARSING_RETURN
**Meaning:** The system is extracting structured data from the uploaded return via OCR and document parsing.
**Entry:** User uploads a return document.
**Available Actions:**
  - Parsing succeeds → PARSED_REVIEW (triggered by: extraction pipeline completes with sufficient data)
  - Parsing fails → UPLOAD_RETURN (triggered by: document is unreadable or not a tax return; user is prompted to try again)
**Feedback:**
  - Processing indicator ("Reading your return...")
  - If > 5 seconds, intermediate progress ("Found your filing status... extracting income lines...")
**Invariants:**
  - Raw document is encrypted and stored
  - Extracted data is provisional

---

### State: PARSED_REVIEW
**Meaning:** The system has extracted data from the return and presents it for user verification before running the analysis.
**Entry:** Parsing completes successfully.
**Available Actions:**
  - User confirms parsed data → ANALYZING (triggered by: user approves the extracted summary)
  - User corrects parsed data → ANALYZING (triggered by: user edits incorrect fields and confirms)
  - User rejects and re-uploads → UPLOAD_RETURN (triggered by: parsed data is too inaccurate; user wants to try a different file)
**Feedback:**
  - Summary of extracted return data: filing status, AGI, income lines, deductions, credits claimed
  - Low-confidence fields highlighted
  - "Does this match your return?" prompt
**Invariants:**
  - Extracted data is not yet used for analysis until confirmed

---

### State: ANALYZING
**Meaning:** The AI is comparing the user's filed return against potential missed opportunities.
**Entry:** User confirms the parsed return data.
**Available Actions:**
  - Analysis complete → REPORT_READY (triggered by: analysis engine finishes)
  - Analysis fails → PARSED_REVIEW (triggered by: processing error; user can retry)
**Feedback:**
  - Processing indicator ("Checking for missed opportunities...")
  - If > 5 seconds, intermediate progress ("Checking education credits... checking retirement contributions...")
**Invariants:**
  - Confirmed return data is read-only during analysis
  - Analysis does not send user PII to external services

---

### State: REPORT_READY
**Meaning:** The second opinion report is ready. The user is viewing identified opportunities with estimated savings.
**Entry:** Analysis engine completes.
**Available Actions:**
  - View full report details → REPORT_READY (triggered by: user expands individual opportunity items)
  - Start full intake → (exits to Tax Situation Intake flow; triggered by: user wants to use Tea Tax for next year)
  - Connect with a professional → (triggered by: user wants expert review of identified opportunities; post-V1 marketplace link or placeholder)
  - Export report → REPORT_READY (triggered by: user downloads the report as PDF)
  - Dismiss → (exit flow)
**Feedback:**
  - Plain-language summary: "We found 3 potential opportunities that could save you $800–$1,400"
  - Each opportunity: description, estimated savings range, confidence level, explanation of why it might apply
  - Circular 230 disclaimer: "This is not tax advice. We recommend consulting a credentialed tax professional before amending your return."
  - Conversion prompt: "Want personalized recommendations for next year? Try our full intake."
**Invariants:**
  - Report is informational, not advisory
  - Language uses "may," "potential," "estimated" — never "you should"

---

## Full State Diagram

```
┌────────────────┐
│ UPLOAD_RETURN   │
└───────┬────────┘
        │ upload
        ▼
┌────────────────┐
│ PARSING_RETURN  │──── fail ──► UPLOAD_RETURN
└───────┬────────┘
        │ success
        ▼
┌────────────────┐
│ PARSED_REVIEW   │──── reject ──► UPLOAD_RETURN
└───────┬────────┘
        │ confirm
        ▼
┌────────────────┐
│ ANALYZING       │──── fail ──► PARSED_REVIEW
└───────┬────────┘
        │ complete
        ▼
┌────────────────┐
│ REPORT_READY    │──► exit / start full intake / connect professional
└────────────────┘
```

---

## Edge Cases and Recoveries

| Edge Case | Current State | Trigger | Recovery Path |
|-----------|---------------|---------|---------------|
| Uploaded file is not a tax return | PARSING_RETURN | Document classification fails | → UPLOAD_RETURN; "This doesn't look like a tax return. Please upload your 1040." |
| Return is from a prior year (not current) | PARSED_REVIEW | Year mismatch detected | → PARSED_REVIEW; inform user and ask if they still want analysis (valid use case) |
| Handwritten return uploaded | PARSING_RETURN | OCR produces very low confidence | → UPLOAD_RETURN; "We can't read handwritten returns yet. Do you have a digital copy?" |
| User's return has no missed opportunities | ANALYZING | Analysis finds nothing | → REPORT_READY; "Good news — your return looks solid. We didn't find anything you missed." |
| Analysis identifies an opportunity the user already considered and intentionally skipped | REPORT_READY | User feedback | Future: allow user to dismiss with "I know about this" to improve model |
