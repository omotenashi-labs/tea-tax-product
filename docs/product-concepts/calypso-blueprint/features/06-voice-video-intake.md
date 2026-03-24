# Feature: Voice & Video Intake

**Stage:** Phase 2 — Multi-Modal Intake

---

## Motivation

Not everyone wants to type or upload documents. Some users find it easier to talk through their tax situation ("I got married in June, switched jobs in September, and started freelancing on the side"). Voice and video intake meet users where they are, reducing friction for people who are uncomfortable with forms or document-heavy workflows. Video also supports the use case of walking through a stack of paperwork on camera.

---

## Features

- **Voice narration:** User can speak their tax situation; speech-to-text transcription feeds into the AI conversational intake for structured extraction
- **Video walkthrough:** User can record a video walking through their documents or explaining their situation; the system extracts both audio (transcription) and visual (document recognition) information
- **AI extraction from transcription:** Natural language processing on voice/video transcripts to identify tax-relevant entities (income, deductions, life events) and write them to the tax situation object
- **Confirmation flow:** Extracted entities from voice/video are presented to the user for review before committing to the tax situation object
- **Privacy:** Voice and video are processed locally where possible; raw recordings can be deleted after extraction (user choice)

---

## Test Plan

- [ ] User records a voice clip mentioning W-2 income and a dependent → system extracts income type and dependent count
- [ ] User records a video showing a W-2 document → system extracts structured fields from the visual
- [ ] Extracted entities are presented for user review; user can correct before confirming
- [ ] Confirmed entities correctly update the tax situation object
- [ ] User can delete raw voice/video recordings; deletion removes files from storage
- [ ] Poor audio quality produces a low-confidence extraction with appropriate user messaging
- [ ] Voice/video processing does not send raw recordings to external services (where local processing is available)
