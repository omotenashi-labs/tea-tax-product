# Current Priorities

This file captures the near-term organizational focus for Tea Tax.

## Now

- Align on MVP scope boundaries from the thesis and blueprint docs.
- Agree on the minimum intake workflow and required user inputs.
- Confirm trust, privacy, and data handling requirements for launch.
- Lock MVP persistence model and access rule:
  - Launch tables: `users`, `tax_objects`, `tax_returns`
  - Launch authorization: access only where `tax_objects.created_by_user_id = current_user.id`
  - `tax_object_memberships` deferred to follow-on sharing phase

## Next

- Translate prioritized user flows into implementation tickets.
- Define provider matching assumptions and fallback rules.
- Align on metrics for MVP success and post-launch iteration.

## Later

- Expand affiliate routing and advanced comparison logic.
- Add richer community pricing data capture.
- Explore second-opinion automation and scaling strategy.

## Open Questions

- Which workflows must be synchronous in MVP vs async follow-up?
- What user data is mandatory before matching can occur?
- What compliance checkpoints are required before external handoff?
