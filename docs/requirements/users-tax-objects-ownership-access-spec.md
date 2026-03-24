# Users, Tax Objects, Ownership, and Access Spec

Status: Draft v1
Owner: Product + Platform
Last updated: 2026-03-23

## Launch MVP Snapshot

Launch requires only:

- `users`
- `tax_objects`
- `tax_returns`

Launch access rule:

- A user can access only tax objects where `tax_objects.created_by_user_id = current_user.id`.

Not required to launch:

- `tax_object_memberships` (optional in v1, recommended as the next migration for sharing roles).

## Purpose

Define a near-term data and access model that supports:

- One user with multiple tax objects
- Multiple people collaborating on one tax object in future phases
- Clear separation between filing identity and app access permissions

This spec is designed to avoid rework when adding MFJ, partnerships, preparers, and delegated access.

## Terms

- User: An authenticated account in Tea Tax.
- Tax object: A filing identity and its related tax data for one context (self, business, dependent, etc.).
- Tax return: A year and jurisdiction specific return inside a tax object.
- Membership: A user to tax object relationship with a role and permission set.

## Scope

In scope for v1:

- User can create and manage multiple tax objects
- Tax object is owned by exactly one user at creation in MVP
- Tax returns are created under a tax object
- API and service layer are scoped by tax object id

Out of scope for v1 (but schema is prepared):

- Inviting other users to collaborate
- Fine-grained sharing controls
- Ownership transfer workflows
- E-signature authority workflows
- Membership-based sharing UX and role management flows

## Core Model

### v1 required relationships

- `users (1) -> (many) tax_objects`
- `tax_objects (1) -> (many) tax_returns`

### v2 ready relationships

- `users (many) <-> (many) tax_objects` through `tax_object_memberships`

The MVP app treats creator as implicit owner. Memberships are introduced in a follow-on phase for sharing and role-based access.

## Data Model (Logical)

### users

- `id`
- auth and profile fields

### tax_objects

- `id`
- `created_by_user_id` (FK users.id)
- `object_type` enum:
  - `individual`
  - `joint_household`
  - `business`
  - `dependent`
  - `estate_or_trust`
- `display_name`
- `status` (active, archived)
- timestamps

### tax_returns

- `id`
- `tax_object_id` (FK tax_objects.id)
- `tax_year`
- `jurisdiction` (federal, state code, local if needed)
- `return_type` (1040, 1065, etc.)
- `status` (draft, in_review, filed, amended)
- timestamps

Unique constraint recommendation:

- `(tax_object_id, tax_year, jurisdiction, return_type)`

### tax_object_memberships (optional for MVP launch, used in v2 sharing)

- `id`
- `tax_object_id` (FK tax_objects.id)
- `user_id` (FK users.id)
- `role` enum:
  - `owner`
  - `admin`
  - `editor`
  - `viewer`
  - `preparer`
- `is_active`
- timestamps

Unique constraint recommendation:

- `(tax_object_id, user_id)` unique active membership
- Implementation note: in databases that support it, use a partial unique index for active rows only (for example `WHERE is_active = true`). Otherwise, enforce active uniqueness in application logic.

## Access Rules

v1 rules:

- Creator has effective owner rights.
- Only creator can read and write their tax objects.
- Every API that reads or writes returns must verify user access to `tax_object_id`.

v2 extension path:

- Authorization resolves from membership role.
- Owner can invite, remove, and change roles.
- Editor can update tax data but cannot transfer ownership.
- Viewer can read but not write.
- Preparer can edit filing data per policy.

## API Requirements

Required in v1:

- `POST /tax-objects`
- `GET /tax-objects`
- `GET /tax-objects/{id}`
- `PATCH /tax-objects/{id}`
- `POST /tax-objects/{id}/returns`
- `GET /tax-objects/{id}/returns`

Every return endpoint must require `tax_object_id` context either by path or validated join.

## Product Behavior

v1 UX:

- User sees a list of tax objects (self, business, dependent, etc.)
- User selects active tax object before entering tax workflow
- New object creation flow asks for object type and display name

v2 UX:

- Share action on tax object
- Invite user by email
- Assign role at invite time
- Manage access list and role updates

## Examples

Example A - single user, multiple objects:

- User Jane has:
  - `Jane - Individual 1040`
  - `Jane Design LLC - Business`
  - `Dependent Alex - 1040`

Example B - future MFJ:

- One `joint_household` tax object
- Two users with `owner` or `editor` membership

Example C - future 1065 partnership:

- One partnership tax object
- Multiple partner users with role-based access
- External CPA with `preparer` role

## Non-Goals

- This spec does not define tax law logic.
- This spec does not define identity verification or KYC.
- This spec does not define e-signature compliance controls.

## Acceptance Criteria

- User can create more than one tax object.
- Tax returns are always associated with exactly one tax object.
- Unauthorized user cannot access a tax object they do not own.
- API handlers enforce tax object scoped authorization checks.
- Membership table is not required for MVP launch and is scheduled for the next migration phase.

## Migration Notes (if current schema is `tax_objects.user_id`)

1. Add `tax_object_memberships`.
2. Backfill one `owner` membership per existing tax object using `user_id`.
3. Update authorization checks to read membership table.
4. Keep `user_id` during transition, then deprecate.
