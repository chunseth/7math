# Curriculum foundation: implementation status

The curriculum release uses concept levels, first-try clears, and optional fluency stars. This document describes the earlier design. [Current Mentalist rules and rollout](mentalist.md)

Implemented November 17, 2026.

## Available now

- `/skills`, linked from the main menu: all 69 concepts, branch navigation, recommended prerequisite links, review scope, TEKS links, and explicit planned/available mission states.
- Six untimed numeric pilots: signed addition/subtraction, signed multiplication/division, decimal operations, fraction operations, percent part/whole/rate, and two-step equations with integer coefficients. These pilots cover calculation only, not the full concept requirements.
- Exact rational evaluation of integer, decimal, fraction, and mixed-number responses. Blank, incomplete, malformed, oversized, and zero-denominator input is rejected. Hints and correct-without-hints session counts are separate.
- Teacher dashboard assignments per student, including independently assigned review and direct assignment past recommended preparation. Teachers can remove their own assignments. Duplicate assignments are prevented by a database constraint.
- Students can retrieve assigned concept IDs using the existing game's username/PIN identity convention. Credentials stay in component memory, the PIN is cleared after lookup, and assignments can be cleared without changing battle login.

The numeric practice runs locally in the browser and does not persist attempts, award rewards, or establish mastery. It leaves the existing battle answer controls, timers, rewards, and legacy progress unchanged. No database migration is applied automatically at app startup.

## Database setup

For an existing database, apply `supabase/migrations/202611170001_curriculum_foundation.sql` after its current schema. For a fresh database, apply `supabase/schema.sql` and then this migration. The migration seeds the 69 concept IDs and adds `concept_assignments`, row-level security policies, and the `get_concept_assignments` RPC.

Assignment writes require an authenticated, active teacher and a matching `teacher_id`. Anonymous direct table access is revoked. Authenticated students can read their own assignments; username players retrieve only concept IDs through the PIN-checked RPC. This retains the legacy username/PIN identity model and does not upgrade the existing game's broader profile security. Do not treat this as a new strong-authentication boundary.

Without the migration, numeric practice and catalog browsing work; assignment panels show an unavailable message. Database-backed assignment workflows have not been tested against a live database here. No credentials or remote data were changed.

## Verification

`npm test` compiles isolated TypeScript tests to a temporary directory and runs Node's test runner. Coverage includes catalog integrity and all 43 content-expectation mappings, exact signed equivalence, invalid-answer handling, known-answer fixtures, and template operand bounds/variant rotation. `npm run typecheck` checks the entire app; `npm run build` creates the production build.

Manual browser checks cover starting practice, invalid fraction validation, equivalent fraction acceptance, correct feedback, and updating the independent session count.

## Next slice

1. Apply and verify assignment migration in the intended development database with teacher and student fixtures; check inactive teacher and cross-student access denial.
2. Author stable variant keys and per-template evidence dimensions, instead of inferring full coverage from these calculation pilots.
3. Add authenticated server-generated instances, authoritative grading, immutable attempt snapshots, idempotent submission, persistence, and teacher-visible concept evidence. Only then connect mastery or rewards.
4. Add choice/diagram templates and constructed-response formats before claiming full concept or Grade 7 coverage.

Per-family arithmetic IDs are unchanged; no legacy card level or battle attempt has been imported as curriculum mastery.
