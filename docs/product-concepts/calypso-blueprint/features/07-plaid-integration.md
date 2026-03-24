# Feature: Plaid Financial Account Connection

**Stage:** Phase 2 — Multi-Modal Intake

---

## Motivation

Connecting financial accounts via Plaid lets the system automatically identify income streams, interest/dividend income, and significant transactions (home purchase, large medical expenses) that are tax-relevant. This reduces the burden on the user to remember and manually report every financial detail, and helps catch items they might otherwise miss.

---

## Features

- **Plaid Link integration:** Embedded Plaid Link widget for users to securely connect bank, brokerage, and credit card accounts
- **Transaction categorization:** Pull transactions for the tax year and categorize them for tax relevance (income, deductible expenses, investment activity)
- **Income stream detection:** Identify W-2 deposits, 1099 patterns, rental income, and other recurring income from transaction history
- **Deduction hints:** Flag potentially deductible categories (medical expenses, charitable donations, business expenses) based on transaction patterns
- **Tax situation object enrichment:** Plaid-derived data is mapped to the appropriate fields in the tax situation object with source attribution
- **User review:** Plaid-derived data is presented as suggestions, not automatically confirmed; user reviews and accepts/rejects each item
- **Disconnect and delete:** User can disconnect Plaid at any time; disconnection removes all Plaid-derived data from the system

---

## Test Plan

- [ ] User can initiate Plaid Link and connect a sandbox bank account
- [ ] After connection, system pulls transactions for the tax year
- [ ] Income deposits are correctly identified and mapped to income stream fields in the tax situation object
- [ ] Potentially deductible transactions are flagged for user review
- [ ] User can accept or reject each Plaid-derived suggestion individually
- [ ] Accepted suggestions correctly update the tax situation object with Plaid source attribution
- [ ] User can disconnect Plaid; all Plaid-derived data is removed from the tax situation object
- [ ] Plaid API errors (timeout, invalid credentials) are handled gracefully with user messaging

---

## Dependencies

- Plaid sandbox/development API credentials (see [12-collect-test-credentials.md](12-collect-test-credentials.md))
