# Mercury — Developer Reference for AI Assistants

See `docs/MEMORY.md` for the full version history and architecture narrative, and
`docs/MODELVERSION.md` for the model-naming/versioning rules. `docs/` is gitignored
(repo is public) — those files exist locally only, not on GitHub.

## Git branch policy (binding — set 2026-07-30, branches renamed 2026-08-04)

Branches were renamed on 2026-08-04 (pure renames, same history/content — no
merging happened): `Test` → `testing`, `Stage` → `development`, `main` → `production`.
`production` is GitHub's default branch. The policy itself is unchanged, just the names:

- **Work happens on `testing`.** Default working branch for all day-to-day changes.
- **Claude may push `testing` → `development`.** Allowed without asking each time.
- **Claude may NOT push to `production`.** Not under any circumstance, not even if asked
  casually mid-conversation — a direct request to push to `production` should be treated
  as requiring explicit, unambiguous confirmation from Viraj in the moment, not inferred
  from earlier approvals. The one-time exception (consolidating all pending work into
  the branch now called `production`) happened on 2026-07-30 and does not renew.
- Promotion `development` → `production` is a human decision, done by Viraj, not by Claude.
