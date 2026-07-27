# Problem Attempt Storage Findings

Keeping a record of every problem attempt is reasonable and valuable for this app.

## Current Data Stored

The current `problem_attempts` table stores a compact record for each attempt:

- Attempt ID
- Match ID
- Student profile ID
- Two multiplication factors
- Student answer
- Whether the answer was correct
- Time spent on the problem
- Number of hints used
- Attempt order
- Creation timestamp

## Estimated Storage

Including normal PostgreSQL row overhead and indexes, each problem attempt will likely require approximately **150–300 bytes**.

| Number of attempts | Estimated storage |
| ---: | ---: |
| 1 million | 150–300 MB |
| 10 million | 1.5–3 GB |
| 100 million | 15–30 GB |

For example, if 1,000 students each complete 50 problems per school day, the app would generate about 9 million attempts during a 180-day school year. That would likely require only a few gigabytes of database storage.

This amount is manageable for PostgreSQL and Supabase, although database hosting costs may become relevant as usage grows.

## Why the History Is Worth Keeping

Complete attempt history can support:

- Mastery and improvement tracking
- Personalized practice recommendations
- Personalized test-up timing
- Identification of common mistakes
- Teacher reports
- Speedrun and record history
- XP and leaderboard auditing

## Main Scaling Concern

Query performance is more likely to become a concern than raw storage capacity.

Recommended practices:

- Add an index on `(profile_id, created_at)` for student-history queries.
- Add an index on `(match_id, attempt_order)` for reconstructing matches.
- Paginate attempt-history queries.
- Do not load a student's entire history into the browser at once.
- Use summary tables or materialized views for dashboards and aggregate statistics.
- Consider table partitioning or archival storage only after the dataset becomes very large.

## Recommendation

Keep every problem attempt for now. The educational and analytical value outweighs the relatively small storage requirement. Design queries and indexes for growth, and introduce archival or partitioning later if real usage makes it necessary.
