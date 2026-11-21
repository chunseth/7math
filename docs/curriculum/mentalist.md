# Mentalist concept progression

The map, main-path recommendation and skill preview order follow the 93 lesson groups in `content/mentalist/lesson-plan.json`. The 100 existing skills retain their 250 level IDs and prerequisite links. The main path resumes at the earliest unfinished published level, respecting teacher placements.

The map connects all levels in plan order. Only the current stop and earlier cleared levels can be opened from the path. More Topics offers one card per unfinished skill with zero or one unfinished prerequisite skill across its entire dependency chain. Its clip demonstrates the first unfinished level in the destination skill. “Try it” pins that destination and opens the next playable prerequisite or destination level. A clear earned through either route counts everywhere. Each map level also has its own worked-example video. Regenerate the MP4s and posters from `content/mentalist/previews.json` with `node scripts/mentalist/ink/render.cjs` and an H.264-enabled ffmpeg on the path. The approved assessment bank and its level IDs are independent of this media.

The signed-addition Different Signs checkpoint offers the 9× review. Its shortcut points to the existing review stop. Opening a preview preserves the offer. The first committed battle entry consumes it, and 12 first-try correct earns 25 extra coins. Clearing Mixed Signs and Zero before entering expires the offer. Replaying the checkpoint cannot create another.

## Local setup and staged rollout

1. Use an isolated development Supabase project or compatible PostgreSQL database. Set the server-only `MENTALIST_DATABASE_URL` to its PostgreSQL connection string. Configure TLS for the hosted database. Teacher sign-in uses the existing `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
2. For a fresh Supabase database, apply `supabase/schema.sql` and the migrations in filename order. Existing databases need only unapplied migrations. The cutover migrates two-digit PINs to bcrypt hashes, clears plaintext, and revokes direct browser reads and writes to legacy student tables. Deploy the server-backed routes together with the cutover. The old anonymous clients require their original permissions.
3. Run `npm run mentalist:validate` and review the candidate sets, keyboard configurations, answer keys and coverage matrix for the intended release. Set `MENTALIST_CONTENT_REVIEWER` to identify the person approving that release. The publish command records the reviewer per level and rejects changes under a previously published version.
4. Run `npm run mentalist:publish -- --stage=slice` for the three signed-addition levels and their six prerequisite review levels. Use `--stage=numeric` for the numeric pilot and its full prerequisite closure, or `--stage=complete` for the entire inventory. Stages add to the playable pool, and each stage publishes all prerequisites needed by its selected skills. The 9× bonus requires its target to be published when the checkpoint clears.
5. Set `MENTALIST_CURRICULUM=1` on the pilot deployment, provision a teacher through the existing Supabase teacher setup, and enroll the pilot class at `/teacher`. Use a separate pilot database to keep the credential and permissions cutover isolated from the legacy deployment. Release more broadly after the class pilot and content review.

No startup path applies migrations or publishes content. The repository contains no school enrollment or production rollout configuration.

## Content and academic evidence

The version-one bank contains 100 skills, 250 levels, 1,250 ordered sets and 15,000 positions. The original combined catalog IDs remain grouping references. Assignments to those groups translate into their child skills when the originating teacher enrolls the student. Existing currency, XP, selected characters and legacy collections are preserved. Occupied legacy chest slots retain their timers and original rewards.

The source templates in `scripts/mentalist/` compile into a compressed bank for publication and a separate student-facing preview manifest. Rebuild with `python3 -B scripts/mentalist/build.py`. Publication validates the rebuild against checked-in artifacts. The client receives the active prompt, response control and visual. The database retains its answer key, parameter values, variant, stable question ID, ordered set and content version.

The coverage report distinguishes mapped short tasks from outstanding evidence. Guided choices and constructed records measure those specific activities. Original equation and inequality stories and unrestricted verbal or written explanations still require separate teacher-reviewed evidence. The household-estimator tasks use a dated Harris County snapshot. [Living Wage Calculator, February 15, 2026](https://livingwage.mit.edu/counties/48201)

## Verification and operations

- `npm test` checks catalog integrity, all published candidate keys, five distinct sets per level, fixed variant quotas, exact scoring, timing thresholds and access overrides. `npm run typecheck` and `npm run build` check the application.
- `npm run mentalist:integration` exercises a running local app against its disposable local database. Set `MENTALIST_TEST_ORIGIN` and `MENTALIST_DATABASE_URL`. Optional `MENTALIST_TEST_TEACHER_A_TOKEN` and `MENTALIST_TEST_TEACHER_B_TOKEN` enable cross-roster checks with two provisioned teacher accounts.
- `npm run mentalist:browser` uses the same fixture with Chromium. Set `MENTALIST_TEST_CHROME` to an installed Chrome or Chromium executable. The test creates disposable players and enrolls one with a fixture teacher. It covers phone navigation, retries, fraction debounce, lost acknowledgements and fresh sets on reload.
- `npm run mentalist:audit` performs read-only checks for unpublished recommendations, missing sets, missing encounter rewards, inconsistent bonus payments and academic replay differences. Request failures and duplicate suppression are logged without PINs or student answers.
