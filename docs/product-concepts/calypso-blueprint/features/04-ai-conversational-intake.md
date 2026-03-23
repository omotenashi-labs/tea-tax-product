# Feature: AI Conversational Intake

**Stage:** Phase 2 — Multi-Modal Intake

---

## Motivation

The core user experience of Tea Tax is a guided, conversational intake that feels like talking to a knowledgeable, patient CPA friend — not filling out a software form. The AI chat progressively extracts the user's tax situation through natural language, asking follow-up questions, providing encouragement, and translating complex tax concepts into plain language. This is the primary intake modality and the connective tissue between all other input types (documents, voice, Plaid data).

---

## Features

- **Guided conversational flow:** AI-driven chat that walks the user through their tax situation, starting broad ("Tell me about your year") and progressively narrowing ("You mentioned a new job — was that a W-2 or 1099 position?")
- **Progressive object building:** Each exchange updates the tax situation object in real time; user can see completeness grow
- **Context-aware follow-ups:** The AI tracks what's been covered and what's missing, prioritizing high-impact questions
- **Plain language translation:** Complex tax concepts (AMT, estimated payments, wash sale rules) explained in accessible terms when relevant to the user's situation
- **Multi-modal handoff:** The chat can prompt the user to upload a document, take a photo, connect Plaid, or use voice — seamlessly handing off to and receiving back from other intake modalities
- **Encouragement and white-glove feel:** Tone is supportive, not clinical; acknowledges that taxes are stressful; celebrates progress ("Great — you're 60% done")
- **Resume capability:** If the user leaves mid-conversation, they can return and pick up exactly where they left off with full context

---

## Test Plan

- [ ] New user starts a chat and receives an opening prompt that sets expectations and begins the intake
- [ ] User's natural language responses are correctly parsed into tax situation object fields (income type, filing status, etc.)
- [ ] Chat asks relevant follow-up questions based on prior answers (e.g., mentions freelance income → asks about estimated tax payments)
- [ ] Completeness indicator updates in real time as the user provides information
- [ ] Chat correctly suggests uploading a document when the user mentions having a W-2 or 1099
- [ ] User can leave mid-chat, return later, and the conversation resumes with full context
- [ ] Chat does not provide tax advice or strategy (Circular 230 boundary); it only collects and clarifies information
- [ ] Edge case: user provides contradictory information → chat flags the contradiction and asks for clarification
