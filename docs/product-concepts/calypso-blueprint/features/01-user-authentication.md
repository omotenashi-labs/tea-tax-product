# Feature: User Authentication & Session Management

**Stage:** Phase 1 — Foundation

---

## Motivation

Tea Tax handles extremely sensitive PII (income, SSNs, financial accounts). Authentication is the first gate. Users must be able to register and sign in securely, with session management that supports the abandon-and-resume intake workflow (users may not complete intake in a single sitting). The system must never expose a "god mode" admin path to user data.

---

## Features

- **Registration flow:** Email-based registration with email verification
- **Sign-in flow:** Secure authentication (specific mechanism TBD — password, passkey/WebAuthn, magic link, or combination)
- **Session persistence:** Sessions must survive browser close and allow users to resume an in-progress intake
- **Account deletion:** User can delete their account and all associated data (hard delete, not soft)
- **No admin impersonation:** No mechanism for any administrator to authenticate as a user or access user sessions

---

## Test Plan

- [ ] User can register with a valid email and receive a verification email
- [ ] User cannot register with an already-registered email (clear error message)
- [ ] Verified user can sign in and reach their dashboard
- [ ] Session persists across browser close; user can resume without re-authenticating (within session TTL)
- [ ] Expired session redirects to sign-in without data loss (in-progress intake is preserved server-side)
- [ ] User can delete account; all associated data is confirmed removed from storage
- [ ] No API endpoint or admin interface allows access to another user's session or data
