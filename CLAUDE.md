# Mercury — Developer Reference for AI Assistants

See `HISTORY.md` for the full version history and architecture narrative.

## Git branch policy (binding — set 2026-07-30)

- **Work happens on `Test`.** Default working branch for all day-to-day changes.
- **Claude may push `Test` → `Stage`.** Allowed without asking each time.
- **Claude may NOT push to `main`.** Not under any circumstance, not even if asked
  casually mid-conversation — a direct request to push to `main` should be treated as
  requiring explicit, unambiguous confirmation from Viraj in the moment, not inferred
  from earlier approvals. The one-time exception (consolidating all pending work into
  `main`) happened on 2026-07-30 and does not renew.
- Promotion `Stage` → `main` is a human decision, done by Viraj, not by Claude.
