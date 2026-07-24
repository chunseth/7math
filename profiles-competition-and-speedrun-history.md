# Profiles, Competition, And Speedrun History

This document describes the student profile system, private usernames, weekly leaderboards, class records, trophies, Elo-style ratings, and "Summoning Salt" style history videos for major high scores.

## Student Profiles

Each student should have a profile that tracks practice history and progression without giving unfair gameplay boosts.

Profile should show:

- Secret username
- Avatar
- Font skin
- Current XP
- Total problems completed
- Current world progress
- Stars earned by world
- Trophies
- Weekly leaderboard placements
- Personal bests
- Boss battle history
- Timed challenge high scores
- Current Elo or rating, if used

XP is only an indication of how much the student has practiced on the app. It should not grant boosts, unlock easier scoring, increase rewards, or change problem difficulty. XP is a profile stat and status marker, not a power system.

## Secret Usernames

At the start of the year, each student chooses a username. That username stays hidden from everyone else in the class unless the student chooses to reveal it.

Rules:

- Students know only their own username.
- Teachers can connect usernames to real students.
- Other students see leaderboard names but do not know who they belong to.
- Usernames should be classroom-safe and teacher-approved.
- Usernames should lock after the start-of-year setup unless a teacher resets one.

This lets students compete without public embarrassment. A student can be ranked low one week without classmates knowing who they are.

## World Progress In Profile

Each math world should have visible profile progress.

Example worlds:

- Rational Number Operations
- Proportional Relationships
- Expressions, Equations, And Inequalities
- Geometry And Measurement
- Data And Statistics
- Probability
- Personal Financial Literacy

Each world should show:

- Current level
- Highest unlocked level
- Stars earned
- Boss defeated or not defeated
- Best timed score
- Mastery percentage
- Last practiced date

Example:

```json
{
  "worldId": "proportional-relationships",
  "currentLevel": 5,
  "highestUnlockedLevel": 6,
  "starsEarned": 14,
  "starsPossible": 21,
  "bossDefeated": false,
  "masteryPercent": 72,
  "bestTimedScore": 1840,
  "lastPracticedAt": "2026-09-18T14:25:00Z"
}
```

## Progress Tracking

The app should track individual and class progress.

Student-level tracking:

- Problems attempted
- Problems correct
- Time per problem
- Hint usage
- Attempts per problem
- Rewatch events
- Personal bests
- Best score by skill
- Current and historical leaderboard rank
- World progress

Class-level tracking:

- Class high scores
- Weekly leaderboard results
- Average mastery by TEKS skill
- Most improved skills
- Total class problems solved
- Boss battle records
- Timed challenge records
- Difficulty curve movement

## Weekly Leaderboards

Every week, the leaderboard resets. This creates fresh-start energy and prevents one strong student from permanently owning the top spot.

Recommended weekly leaderboard categories:

- Highest weekly score
- Biggest improvement
- Most corrected mistakes
- Most review completed
- Best boss battle
- Best timed challenge
- Most stars earned
- Best team contribution

Do not run only one leaderboard. Multiple categories create more ways for different students to win.

## High Scores

Track personal, class, and all-time records.

High score types:

- Personal best
- Weekly class best
- Unit best
- All-year class record
- Boss battle record
- Timed mode record
- Fewest attempts record
- Most improved record

High scores should record enough detail to reconstruct the run:

- Student username
- Date
- Problem sequence
- Time per problem
- Hints shown
- Attempts
- Final score
- Difficulty settings
- World and level
- Previous record beaten

## Summoning Salt Style Speedrun History Videos

For major high scores, the app can generate a documentary-style recap video showing the history of the record.

Video ingredients:

- Timeline of previous records
- Student username only, not real name
- Score progression over time
- Key moments in the run
- ######## Problem-by-problem pace chart
- Comparison against previous record
- Dramatic turning point
- Final record moment
- Trophy reveal

Example narration structure:

1. "At the beginning of the week, the class record for Ratio Rush was 2,140."
2. "Three students came close, but nobody broke 2,300."
3. "Then, on Thursday, StarVector opened with six perfect unit-rate problems."
4. "The run nearly collapsed on a percent discount problem."
5. "A clean finish on the scale drawing boss pushed the score to 2,510."
6. "And with that, a new class record was born."

These videos could be generated weekly for:

- New class record
- New boss battle champion
- Biggest comeback
- Most improved student
- Team victory

## Difficulty Curves And Early-Year Balancing

The progression system can use difficulty curves to level the playing field at the beginning of the year.

The goal is not to punish advanced students. The goal is to keep them challenged while giving developing students a fair chance to experience wins.

Balancing strategies:

- Advanced students unlock harder variants earlier.
- Strong students receive deeper multi-step problems.
- Strong students face stricter boss battle scaling.
- Students are ranked partly by improvement, not just raw score.
- Early-year leaderboards can use rating brackets.
- Class events can normalize scores based on difficulty.

Example:

Two students both complete a timed proportionality challenge.

- Student A gets easier Level 2 problems and scores 1,400.
- Student B gets harder Level 5 problems and scores 1,550.
- The leaderboard can show adjusted score, raw score, and difficulty tier.

This keeps the competition alive without letting one or two students run away immediately.

## Nerfing Smart Kids, Carefully

The app can "nerf" advanced students by increasing challenge, not by reducing their rewards unfairly.

Good nerfs:

- More complex numbers
- Multi-step problems
- Less scaffolding
- Mixed skills
- Shorter timers in optional speed modes
- Higher boss health
- Fewer repeated problem patterns

Avoid:

- Taking away earned coins or trophies
- Making correct answers worth less without explanation
- Hiding progress
- Publicly labeling students as overpowered

In student-facing language, call this "challenge scaling" or "higher difficulty tier."

## Trophies

Trophies should recognize both excellence and growth.

Possible trophies:

- Weekly Champion
- Most Improved
- Boss Slayer
- Review Hero
- Perfect Accuracy
- Comeback Run
- Fastest Clean Run
- Streak Keeper
- Hint Strategist
- Ratio Champion
- Integer Master
- Geometry Builder

Trophy tiers:

- Bronze
- Silver
- Gold
- Platinum
- Legendary

Trophies should be visible in the student profile, but real identities should stay hidden from classmates.

## Elo-Style Rating

An Elo-style rating can support fair matchups and leaderboard brackets.

Use cases:

- Place students into weekly brackets.
- Match students against comparable ghost scores.
- Track growth across the year.
- Make leaderboards fairer.
- Create rivalry arcs without revealing identities.

Rating should update based on:

- Expected performance
- Actual performance
- Difficulty tier
- Accuracy
- Time
- Improvement from prior attempts

Simple rating idea:

```text
New Rating =
  Old Rating
+ performance adjustment
+ difficulty bonus
+ improvement bonus
- repeated guessing penalty
```

Do not penalize hint use. Hints are part of learning and should not lower Elo.

## Ghost Runs

Students can race against anonymized "ghost runs" from classmates or their own past performances.

Ghost types:

- Personal best ghost
- Class average ghost
- Weekly champion ghost
- Similar-rating ghost
- Teacher-created ghost

The student should see pace and progress, not another student's real identity.

## Data Model Additions

Student profile:

```json
{
  "studentId": "student-123",
  "username": "StarVector",
  "usernameVisibleToClass": true,
  "realIdentityVisibleToClass": false,
  "xp": 18420,
  "elo": 1265,
  "totalProblemsCompleted": 1438,
  "worldProgress": [],
  "trophies": [],
  "personalBests": []
}
```

Leaderboard entry:

```json
{
  "leaderboardId": "week-05-ratio-rush",
  "username": "StarVector",
  "studentId": "student-123",
  "rank": 1,
  "rawScore": 2510,
  "adjustedScore": 2680,
  "difficultyTier": 5,
  "category": "timed-challenge",
  "weekStart": "2026-09-14"
}
```

Speedrun history record:

```json
{
  "recordId": "ratio-rush-week-05-record",
  "eventType": "new_class_record",
  "username": "StarVector",
  "score": 2510,
  "previousRecord": 2320,
  "problemTimeline": [],
  "eligibleForRecapVideo": true
}
```

## Design Rule

The competitive system should create stories, not shame.

The best version of this app lets students say, "Wait, who is NumberCrush42?" while the teacher quietly knows exactly which students are improving, struggling, and ready for more challenge.
