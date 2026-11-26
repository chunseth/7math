# Mentalist concept progression

The map, main-path recommendation and skill preview order follow the 87 skills in `content/mentalist/lesson-plan.json`. There are 237 levels. Multiplication and division each have six mixed-table review levels: 0/1, 2/3/4, 5/10, 6/7, 8/9, and 11/12. Each samples 12 questions evenly across its tables. The first division review combines zero dividends and division by one. The main path resumes at the earliest unfinished published level, respecting teacher placements.

The map connects all levels in plan order. Only the current stop and earlier cleared levels can be opened from the path. More Topics offers one card per unfinished skill with zero or one unfinished prerequisite skill across its entire dependency chain. Its clip demonstrates the first unfinished level in the destination skill. “Try it” pins that destination and opens the next playable prerequisite or destination level. A clear earned through either route counts everywhere. Each map level also has its own worked-example video. Regenerate the MP4s and posters from `content/mentalist/previews.json` with `node scripts/mentalist/ink/render.cjs` and an H.264-enabled ffmpeg on the path. Grouped levels reuse a worked example from one of their tables.

Student sign-in persists for 30 days in an HttpOnly, SameSite=Lax cookie backed by a database session. Reloading or reopening the app restores the player from that session, including when arriving through a link to the app. Signing out ends the database session and clears the cookie.

Clearing a level requires 10 of 12 problems correct on the first scored attempt. Three stars require zero wrong answers and a total active answering time within the level target. Two stars require at most one wrong answer and a time within 1.5 times the target. Other clears earn one star. Fraction simplifications count toward answering time and preserve accuracy.

Each level leaderboard lists one row per student with a three-star finish. The two columns track each student's best total time and fastest single problem across qualifying runs. Either column sorts fastest first, and identical times share a rank. The completion screen shows times for the run just played and, for three stars, the student's rank by personal-best total time.

The signed-addition Different Signs checkpoint offers the 8 and 9 multiplication review. Its shortcut points to the existing review stop. Opening a preview preserves the offer. The first committed battle entry consumes it, and 12 first-try correct earns 25 extra coins. Clearing Mixed Signs and Zero before entering expires the offer. Replaying the checkpoint cannot create another.

Correct answers and card chests award topic cards. Foundational multiplication and division each have a shared card. Other skills use their curriculum topic, such as Foundational review or Ratios and rates. Upgrading a card increases battle damage across that topic.

## Local setup and staged rollout

1. Use an isolated development Supabase project or compatible PostgreSQL database. Set the server-only `MENTALIST_DATABASE_URL` to its PostgreSQL connection string. Configure TLS for the hosted database. Teacher sign-in uses the existing `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
2. For the grouped-review upgrade, apply the topic-card migration, publish the current bank at the deployment’s existing stage, and switch to the updated app together. The one-time inventory reset clears existing card balances, purchased card upgrades, legacy cards, and pending legacy chests. On a database that received the reset early, the topic-card migration groups cards earned since that reset. Earlier single-table clears and teacher placements count toward their new groups. Mixed-table leaderboards use runs played on the grouped level. For a fresh Supabase database, apply `supabase/schema.sql` and the migrations in filename order. Existing databases need only unapplied migrations. The cutover migrates two-digit PINs to bcrypt hashes, clears plaintext, and revokes direct browser reads and writes to legacy student tables. Deploy the server-backed routes together with the cutover. The old anonymous clients require their original permissions.
3. Run `npm run mentalist:validate` and review the candidate sets, keyboard configurations, answer keys and coverage matrix for the intended release. Set `MENTALIST_CONTENT_REVIEWER` to identify the person approving that release. The publish command records the reviewer per level and rejects changes under a previously published version.
4. Run `npm run mentalist:publish -- --stage=slice` for the three signed-addition levels and their six prerequisite review levels. Use `--stage=numeric` for the numeric pilot and its full prerequisite closure, or `--stage=complete` for the entire inventory. Stages add to the playable pool, and each stage publishes all prerequisites needed by its selected skills. The 8 and 9 multiplication bonus requires its target to be published when the checkpoint clears.
5. Set `MENTALIST_CURRICULUM=1` on the pilot deployment, provision a teacher through the existing Supabase teacher setup, and enroll the pilot class at `/teacher`. Use a separate pilot database to keep the credential and permissions cutover isolated from the legacy deployment. Release more broadly after the class pilot and content review.

No startup path applies migrations or publishes content. The repository contains no school enrollment or production rollout configuration.

## Content and academic evidence

Version six retains 237 levels with 24 distinct questions per level and updates templates identified in Verification Trail review. On each start, the server samples 12 without replacement, keeps the level’s mix of question types and time targets, and shuffles play order. It saves the selected questions with the run. Publish the bank at the desired stage to activate the new pools. Levels published only under earlier versions continue using their existing sets. Teacher inspection uses that order and falls back to the published order for older runs. The original combined catalog IDs remain grouping references. Assignments to those groups translate into their child skills when the originating teacher enrolls the student. Existing currency, XP, selected characters and legacy collections are preserved. Occupied legacy chest slots retain their timers and original rewards.

The source templates in `scripts/mentalist/` compile into a compressed bank for publication and a separate student-facing preview manifest. Rebuild with `python3 -B scripts/mentalist/build.py`. Publication validates the rebuild against checked-in artifacts. The map preloads the next playable level. Tapping “Try it” prepares the selected goal’s next playable level. Each current practice pack contains all 24 prompts, controls, visuals, and answer checks. Play starts the run and fixes its shuffled order and combat rolls. During play the browser checks answers locally and retains the transcript for reload or reconnect. On completion, knockdown, or exit, one request submits the transcript. The server regrades it against the saved set before recording attempts, rewards, and rankings. The database retains its answer key, parameter values, variant, stable question ID, ordered set and content version.

The coverage report distinguishes mapped short tasks from outstanding evidence. Guided choices and constructed records measure those specific activities. Use these classroom checks for original stories and volume explanations. A teacher can record the evidence alongside the matching level.

- After `algebra.story.1`, write an original situation for `3x + 5 = 32`. Identify the variable, rate, fixed amount, and exact total in the situation.
- After `algebra.story.2`, write a different original situation for `4x + 8 ≤ 20`. Explain the meaning of the inclusive bound. A situation can use any quantities or units that fit the rule.
- After `solid.models`, use a model with congruent bases and equal heights to explain why three pyramid volumes match one prism. Describe the model in words and connect it to `V = Bh/3` for both rectangular and triangular bases.

The household-estimator tasks use a dated Harris County snapshot. [Living Wage Calculator, February 15, 2026](https://livingwage.mit.edu/counties/48201)

## Verification and operations

- `npm test` checks catalog integrity, all published candidate keys, five distinct sets per level, fixed variant quotas, exact scoring, timing thresholds and access overrides. `npm run typecheck` and `npm run build` check the application.
- `npm run mentalist:integration` exercises a running local app against its disposable local database. Set `MENTALIST_TEST_ORIGIN` and `MENTALIST_DATABASE_URL`. Optional `MENTALIST_TEST_TEACHER_A_TOKEN` and `MENTALIST_TEST_TEACHER_B_TOKEN` enable cross-roster checks with two provisioned teacher accounts.
- `npm run mentalist:browser` uses the same fixture with Chromium. Set `MENTALIST_TEST_CHROME` to an installed Chrome or Chromium executable. The test creates disposable players and enrolls one with a fixture teacher. It covers phone navigation, retries, fraction debounce, lost acknowledgements and resuming on reload and retrying a batch save.
- `npm run mentalist:audit` performs read-only checks for unpublished recommendations, missing sets, missing encounter rewards, inconsistent bonus payments and academic replay differences. Request failures and duplicate suppression are logged without PINs or student answers.

## Verification

Open `/verification` from the main menu and sign in with an existing player account. The mixed set uses the candidate banks in the app. It includes one example per presentation and response format, so reviewers can start before ranked publication. Apply `202611260001_combined_verification.sql` before deploying the combined page.

Answer correctly to accept a question, submit a written bug report, or skip it for the current pass. Progress resumes from the next unfinished question. **Export bug reports** downloads only the signed-in reviewer’s flagged cases in the active set. Each report carries the grade, bank version, level ID, question ID, and a snapshot. Earlier reports remain in `mentalist.verification_reviews`.
