# Tax Situation Intake — State Machine

## Entry Condition
User is authenticated and has not yet completed a tax situation intake for the current tax year (or has chosen to start a new one).

## Exit Condition (Goal Achieved)
User has a structurally complete tax situation object and is presented with a personalized three-vector comparison of filing options. Target: 10 minutes or less from entry to comparison.

---

## States and Transitions

### State: ONBOARDING
**Meaning:** User has just signed in and has no (or an empty) tax situation object. The system introduces the intake experience, sets expectations, and establishes trust.
**Entry:** User authenticates for the first time, or starts a new tax year intake.
**Available Actions:**
  - Begin intake -> CONVERSATIONAL_INTAKE (triggered by: user starts chat or selects an intake modality)
  - Upload a completed return instead -> (exits to Tax Second Opinion flow)
**Feedback:**
  - Welcome message: "Think of this as talking to a CPA friend who's on your side. We'll figure out your tax situation together - most people finish in under 10 minutes."
  - Overview of intake modalities available (chat, upload, voice, connect accounts)
  - Trust signals: who built this, what happens to your data, what Tea Tax will never do with it
  - Framing: "When we're done, you'll have a structured picture of your tax situation that you own - and honest comparisons of every filing option available to you."
**Invariants:**
  - Tax situation object exists but is empty
  - No user data has been collected yet

---

### State: CONVERSATIONAL_INTAKE
**Meaning:** User is actively engaged in the guided AI chat, answering questions and providing information. This is the central state - all other intake modalities feed back into this state.
**Entry:** User begins or resumes the chat.
**Available Actions:**
  - Provide information via chat -> CONVERSATIONAL_INTAKE (object updated, next question asked)
  - Upload a document -> DOCUMENT_PROCESSING (triggered by: user uploads or system prompts for a document)
  - Start voice/video recording -> VOICE_VIDEO_PROCESSING (triggered by: user initiates recording)
  - Connect financial account -> PLAID_CONNECTION (triggered by: user initiates Plaid Link)
  - Abandon session -> SUSPENDED (triggered by: user navigates away or closes browser)
  - All required fields populated -> COMPLETENESS_REVIEW (triggered by: system determines object is structurally complete)
**Feedback:**
  - Active chat interface with AI responses in the voice of an impartial CPA friend
  - Real-time completeness indicator ("45% complete - income covered, deductions next")
  - Contextual prompts to use other modalities ("Have your W-2 handy? Upload it and I'll pull the numbers automatically")
  - Time indicator showing progress toward the 10-minute target
**Invariants:**
  - Tax situation object is partially populated and being actively enriched
  - Chat context (conversation history) is preserved
  - The AI collects and clarifies information; it does not provide tax advice (Circular 230 boundary)

---

### State: DOCUMENT_PROCESSING
**Meaning:** User has uploaded or captured a document. The system is extracting structured data via OCR.
**Entry:** User uploads a file or takes a photo during the intake.
**Available Actions:**
  - Extraction succeeds -> EXTRACTION_REVIEW (triggered by: extraction pipeline completes with results)
  - Extraction fails -> CONVERSATIONAL_INTAKE (triggered by: unrecognizable document; user is asked to try again or provide info manually)
**Feedback:**
  - Processing indicator ("Reading your W-2...")
  - If > 3 seconds, explain what's happening
**Invariants:**
  - Raw document is encrypted and stored
  - Tax situation object is not yet updated (pending user review of extraction)

---

### State: EXTRACTION_REVIEW
**Meaning:** The system has extracted data from a document and is presenting it for user confirmation.
**Entry:** Extraction pipeline completes successfully.
**Available Actions:**
  - User confirms extraction -> CONVERSATIONAL_INTAKE (triggered by: user approves; object updated with extracted data)
  - User corrects extraction -> CONVERSATIONAL_INTAKE (triggered by: user edits fields and confirms; object updated with corrected data)
  - User rejects extraction -> CONVERSATIONAL_INTAKE (triggered by: user discards; object not updated, user can re-upload or provide info manually)
**Feedback:**
  - Extracted fields displayed with confidence indicators
  - Low-confidence fields highlighted for attention
  - "Does this look right?" prompt
**Invariants:**
  - Extracted data is provisional - not written to the object until confirmed
  - Original document remains available for re-processing

---

### State: VOICE_VIDEO_PROCESSING
**Meaning:** User has submitted a voice or video recording. The system is transcribing and extracting tax-relevant entities.
**Entry:** User completes a voice or video recording.
**Available Actions:**
  - Processing succeeds -> EXTRACTION_REVIEW (triggered by: transcription and entity extraction complete)
  - Processing fails -> CONVERSATIONAL_INTAKE (triggered by: unusable audio/video; user is prompted to try again or type instead)
**Feedback:**
  - Processing indicator ("Listening to your recording...")
**Invariants:**
  - Raw recording is encrypted and stored
  - Tax situation object is not yet updated (pending user review)

---

### State: PLAID_CONNECTION
**Meaning:** User is in the Plaid Link flow, connecting a financial account.
**Entry:** User initiates Plaid Link from the chat or dashboard.
**Available Actions:**
  - Connection succeeds -> PLAID_REVIEW (triggered by: Plaid returns access token and account data)
  - Connection cancelled -> CONVERSATIONAL_INTAKE (triggered by: user closes Plaid Link without connecting)
  - Connection fails -> CONVERSATIONAL_INTAKE (triggered by: Plaid error; user is informed and can retry or skip)
**Feedback:**
  - Plaid Link widget is displayed
  - System waits for user to complete the external flow
**Invariants:**
  - No Plaid data is stored until the connection succeeds and user reviews

---

### State: PLAID_REVIEW
**Meaning:** Plaid data has been retrieved. The system presents tax-relevant transactions and income patterns for user review.
**Entry:** Plaid connection succeeds and transaction data is retrieved.
**Available Actions:**
  - User accepts suggestions -> CONVERSATIONAL_INTAKE (triggered by: user confirms Plaid-derived data; object updated)
  - User partially accepts -> CONVERSATIONAL_INTAKE (triggered by: user accepts some, rejects others; object updated with accepted items only)
  - User rejects all -> CONVERSATIONAL_INTAKE (triggered by: user discards Plaid data; Plaid disconnected, data removed)
**Feedback:**
  - List of identified income streams and deductible transactions
  - Each item can be individually accepted or rejected
**Invariants:**
  - Plaid-derived data is provisional until user confirms

---

### State: SUSPENDED
**Meaning:** User has left the intake session without completing it. All progress is saved.
**Entry:** User navigates away, closes browser, or explicitly pauses.
**Available Actions:**
  - User returns -> CONVERSATIONAL_INTAKE (triggered by: user signs back in; conversation resumes with full context)
  - 30 days pass without return -> SUSPENDED (system sends a reminder notification, if user has opted in)
**Feedback:**
  - On return: "Welcome back! You were 62% done - let's pick up where you left off"
  - Reminder notification (if opted in): "Your tax intake is waiting - you're almost done"
**Invariants:**
  - Tax situation object and conversation context are preserved
  - No data is lost or expired

---

### State: COMPLETENESS_REVIEW
**Meaning:** The system has determined the tax situation object is structurally complete (all high-priority fields populated). The user reviews the full picture before generating comparisons.
**Entry:** System detects sufficient completeness during the conversational intake.
**Available Actions:**
  - User confirms completeness -> GENERATING_COMPARISON (triggered by: user approves the summary)
  - User wants to add more -> CONVERSATIONAL_INTAKE (triggered by: user identifies missing information)
  - User wants to skip remaining optional items -> GENERATING_COMPARISON (triggered by: user chooses to proceed despite optional gaps)
**Feedback:**
  - Full summary of the tax situation object, organized by category
  - Visual indicator of what's complete, what's optional, what's missing
  - "Ready to see your options?" prompt
  - Portable object framing: "This is your structured tax situation. You own it. After we show you your options, you can export it and take it anywhere."
**Invariants:**
  - All required fields are populated
  - Confidence scores are above threshold for all required fields

---

### State: GENERATING_COMPARISON
**Meaning:** The system is running the comparison engine against the completed tax situation object.
**Entry:** User confirms the intake is complete.
**Available Actions:**
  - Comparison generated -> COMPARISON_READY (triggered by: comparison engine completes)
  - Generation fails -> COMPLETENESS_REVIEW (triggered by: engine error; user is informed and can retry)
**Feedback:**
  - Processing indicator ("Analyzing your situation and finding the best options...")
  - If > 5 seconds, show intermediate progress ("Checking Free File eligibility... Estimating costs... Pulling reviews...")
**Invariants:**
  - Tax situation object is locked (read-only) during generation
  - No external API calls that could leak user data (comparison logic runs on provider data, not user data sent externally)

---

### State: COMPARISON_READY
**Meaning:** The user is viewing their personalized three-vector comparison. This is the goal state of the intake flow.
**Entry:** Comparison engine completes successfully.
**Available Actions:**
  - Select a provider -> (exits to Provider Selection & Handoff flow)
  - Export portable object -> (triggered by: user downloads their tax situation object)
  - Connect with a practitioner -> (triggered by: user wants professional help)
  - Go back and update intake -> CONVERSATIONAL_INTAKE (triggered by: user wants to change information)
  - Contribute pricing data -> (exits to Pricing Contribution flow, after filing)
**Feedback:**
  - Three-vector comparison matrix: baseline pricing, ancillary risk, sentiment/ick per provider
  - Personalized explanation for each ranking
  - Free File eligibility prominently displayed if applicable
  - Affiliate disclosure visible
  - Portable object export accessible: "Your data is yours. Take it anywhere."
**Invariants:**
  - Comparisons reflect the current state of the tax situation object
  - If the user goes back and changes data, comparisons must be regenerated

---

## Full State Diagram

```
                    ┌─────────────┐
                    │  ONBOARDING │
                    └──────┬──────┘
                           │ begin intake
                           ▼
              ┌──────────────────────────┐
         ┌───│  CONVERSATIONAL_INTAKE    │◄──────────────────────────┐
         │   └──┬────┬────┬────┬────┬───┘                           │
         │      │    │    │    │    │                                │
         │      │    │    │    │    └─── abandon ──► SUSPENDED ──────┘
         │      │    │    │    │                      (resume)
         │      │    │    │    │
         │      │    │    │    └── connect Plaid ──► PLAID_CONNECTION
         │      │    │    │                              │
         │      │    │    │                              ▼
         │      │    │    │                         PLAID_REVIEW ────┘
         │      │    │    │
         │      │    │    └── voice/video ──► VOICE_VIDEO_PROCESSING
         │      │    │                              │
         │      │    │                              ▼
         │      │    └── upload doc ──► DOCUMENT_PROCESSING
         │      │                            │
         │      │                            ▼
         │      │                     EXTRACTION_REVIEW ────────────┘
         │      │
         │      └── complete ──► COMPLETENESS_REVIEW
         │                            │
         │                            ▼
         │                   GENERATING_COMPARISON
         │                            │
         │                            ▼
         └────────────────── COMPARISON_READY
```

---

## Edge Cases and Recoveries

| Edge Case | Current State | Trigger | Recovery Path |
|-----------|---------------|---------|---------------|
| User closes browser mid-intake | CONVERSATIONAL_INTAKE | Browser close | -> SUSPENDED; resume on return with full context |
| OCR produces zero usable fields | DOCUMENT_PROCESSING | Unrecognizable document | -> CONVERSATIONAL_INTAKE; user prompted to re-upload or enter manually |
| Plaid connection times out | PLAID_CONNECTION | Network timeout | -> CONVERSATIONAL_INTAKE; user can retry or skip |
| User contradicts prior information | CONVERSATIONAL_INTAKE | Conflicting input | AI flags contradiction, asks for clarification; object not updated until resolved |
| Comparison engine timeout | GENERATING_COMPARISON | Processing timeout | -> COMPLETENESS_REVIEW; user can retry |
| User returns after 6+ months | SUSPENDED | User signs in | -> CONVERSATIONAL_INTAKE; prompt to review existing data ("A lot may have changed - want to start fresh or continue?") |
| Intake exceeds 10-minute target | CONVERSATIONAL_INTAKE | Time elapsed | AI adapts - prioritizes high-impact remaining questions, suggests skipping optional items, offers to infer from available data |
