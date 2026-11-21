# Test Up System

The curriculum release uses concept levels, first-try clears, and optional fluency stars. This document describes the earlier design. [Current Mentalist rules and rollout](docs/curriculum/mentalist.md)

The "test up" system lets students prove they are ready to unlock a higher level, rarity tier, or harder world path. It is timed both per problem and overall. The final target time is personalized using the student's own previous performance.

## Core Idea

A test up is a short qualifying run of about 15 problems. The student must:

- Complete all required problems.
- Meet the accuracy requirement.
- Stay under the personalized total time target.
- Avoid repeated guessing patterns.
- Demonstrate coverage across the target skill set.

The test up should feel like a speedrun qualification, not a normal worksheet.

## Why Personalized Timing Works

Students have different processing speeds. A single class-wide time limit rewards only the fastest students. A personalized modifier lets the app ask:

"Can this student perform this skill faster and more accurately than their own recent baseline?"

That makes test ups useful for both advanced students and developing students.

## Test Up Inputs

For each student, the app should store historical problem data:

- Skill ID
- Problem type
- Difficulty tier
- Time to correct answer
- Number of attempts
- Hint usage
- Accuracy
- Date completed
- Whether the problem was in practice, timed mode, boss battle, or test up

Only correct answers should count toward shortest-time calculations.

## Baseline Time Calculation

For a 15-problem test up, calculate the student's personalized target from their shortest valid time on similar prerequisite problems.

Simple formula:

```text
Personal Baseline =
  sum of student's shortest valid times for the 15 matching problem types
```

Then apply a custom modifier:

```text
Test Up Target Time =
  Personal Baseline x Difficulty Modifier x Readiness Modifier
```

Example:

```text
Shortest valid times across 15 problems:
8 + 10 + 9 + 12 + 11 + 14 + 13 + 10 + 16 + 15 + 12 + 9 + 11 + 13 + 17 = 180 seconds

Difficulty Modifier: 1.20
Readiness Modifier: 1.10

Target Time = 180 x 1.20 x 1.10 = 237.6 seconds
Rounded Target = 238 seconds
```

The student must finish the full test up in less than 238 seconds while meeting accuracy requirements.

## Recommended Modifiers

| Modifier | Purpose | Suggested Range |
| --- | --- | --- |
| Difficulty Modifier | Gives more time for harder or newer problem types. | 1.10-1.50 |
| Readiness Modifier | Gives support if the student is new to test ups. | 1.00-1.25 |
| Consistency Modifier | Gives more time if prior correct times are inconsistent. | 1.00-1.20 |
| Challenge Modifier | Tightens the target for advanced tiers. | 0.85-1.00 |

Combined formula:

```text
Target Time =
  Baseline Time
x Difficulty Modifier
x Readiness Modifier
x Consistency Modifier
x Challenge Modifier
```

## Per-Problem Timers

Each problem should have its own expected time window.

Per-problem target:

```text
Problem Target =
  student's shortest valid time for similar problem
x problem difficulty modifier
x support modifier
```

The per-problem timer is used for pacing feedback, not automatic failure.

Good pacing feedback:

- "You are ahead of your pace."
- "This one is taking longer than usual. Want a visual?"
- "You can still beat your target if you recover on the next two."

Avoid:

- "Too slow."
- "You failed this problem."

## Overall Timer

The overall timer is the qualifying condition.

A student passes the test up if:

```text
overall time < personalized target time
accuracy >= required accuracy
required skills covered
guessing pattern not detected
```

Suggested accuracy requirements:

| Unlock Tier | Accuracy Needed |
| --- | --- |
| Common to Uncommon | 80% |
| Uncommon to Rare | 85% |
| Rare to Epic | 90% |
| Epic to Legendary | 95% |

## Selecting The 15 Problems

The test should not pick 15 random problems from one narrow type. It should sample the skill family.

Example for integer subtraction test up:

- 3 positive minus positive
- 3 negative minus positive
- 3 positive minus negative
- 3 negative minus negative
- 3 word problems or number line interpretation problems

Example for proportionality test up:

- 3 ratio table problems
- 3 unit rate problems
- 3 percent problems
- 3 graph problems
- 3 word problems

## Valid Shortest Times

Do not use every fast answer as part of the baseline. Some fast times are noise.

A shortest time is valid only if:

- The answer was correct.
- The student did not guess repeatedly.
- The problem was similar in skill and difficulty.
- The student had not just seen the exact same problem.
- The time was above a reasonable minimum.

Suggested minimum time floors:

| Problem Type | Minimum Valid Time |
| --- | --- |
| Math fact | 2 seconds |
| One-step integer operation | 4 seconds |
| Fraction operation | 8 seconds |
| Unit rate | 10 seconds |
| Two-step equation | 12 seconds |
| Word problem | 18 seconds |

This prevents accidental taps or memorized repeats from making a student's future target impossible.

## Handling Hints During Test Up

Hints should be allowed, but test up mode can treat them differently from normal practice.

Recommended rule:

- Hints do not reduce XP.
- Hints do not reduce stars already earned.
- Hints do not publicly penalize the student.
- But a test up with major hints becomes a "practice clear," not a "qualifying clear."

This preserves the no-shame hint policy while keeping the test up meaningful.

Suggested categories:

- Qualifying Clear: passed without guided solve.
- Assisted Clear: passed with hints, earns practice rewards but does not unlock the next tier.
- Retry Ready: failed but unlocked targeted practice.

## Retry Loop

If a student fails the test up:

1. Show the missed skill types.
2. Rewatch the exact video clips tied to those errors.
3. Complete 3-5 targeted practice problems.
4. Earn a discounted retry ticket.
5. Retry with a slightly adjusted target if appropriate.

Do not make students repeat the entire unit just because they failed one test up.

## Anti-Gaming Rules

The app should prevent students from lowering their baseline on purpose or gaming their target time.

Rules:

- Use fastest valid correct times, not average time, for baseline.
- Exclude obviously idle attempts from baseline.
- Exclude repeated exact problems.
- Require accuracy before speed counts.
- Use a rolling window of recent performance plus all-time bests.
- Ignore practice attempts where the student abandoned the problem.

Recommended baseline:

```text
Baseline Time =
  median of the student's 3 fastest valid correct times
  for each required problem type
```

This is more stable than using only one fastest time.

## Student-Facing Language

Use speedrun language:

- "Test Up Run"
- "Qualifying Pace"
- "Personal Target"
- "Ahead of Pace"
- "Recovery Problem"
- "Clean Run"
- "Assisted Clear"
- "New Personal Qualifier"

Avoid language that sounds punitive:

- "Remedial"
- "Too slow"
- "Failed because of hints"
- "Below class average"

## Example Data Model

```json
{
  "testUpId": "integer-subtraction-rare-test-up",
  "studentId": "student-123",
  "skillFamily": "integer-subtraction",
  "problemCount": 15,
  "baselineSeconds": 180,
  "modifiers": {
    "difficulty": 1.2,
    "readiness": 1.1,
    "consistency": 1.0,
    "challenge": 1.0
  },
  "targetSeconds": 238,
  "actualSeconds": 224,
  "accuracy": 0.93,
  "hintsUsed": ["visual"],
  "clearType": "assisted-clear",
  "unlockedNextTier": false
}
```

## Design Rule

The test up system should compare students against a fair version of themselves first. Class competition can still exist, but level advancement should be based on personalized speed, accuracy, and readiness.
