# Adaptive Hints And Leaderboards

This document describes how the app should track time on each problem, provide useful hints as students work, and support leaderboards without punishing students for using help.

## Core Principle

Hints should be treated as part of learning, not as a penalty. Students should be encouraged to use hints, get the problem right, and build mastery. The leaderboard should reward accuracy, persistence, improvement, streaks, and challenge completion, not just speed.

## Time-Based Hint System

Every problem should track:

- Time started
- Time to first interaction
- Time between answer changes
- Hint trigger timestamps
- Hints shown
- Final answer
- Accuracy
- Number of attempts
- Whether the student eventually corrected the problem

The app should offer hints automatically as time passes, while still allowing students to tap a hint button earlier.

Suggested timing:

| Time On Problem | App Behavior |
| --- | --- |
| 0-10 seconds | No hint unless requested. |
| 10-20 seconds | Subtle nudge: "Think about what the problem is asking." |
| 20-35 seconds | Show the first visual or strategy hint. |
| 35-60 seconds | Show a more direct step or representation. |
| 60+ seconds | Offer guided solve mode with one step at a time. |

The exact timing should adapt by student and skill. A student who usually solves multiplication facts in 8 seconds should get support sooner if they are stuck for 25 seconds. A student who normally needs more processing time should not be rushed.

## Hint Levels

Each problem should have a hint ladder:

| Hint Level | Purpose | Example |
| --- | --- | --- |
| Hint 1 | Restate the goal | "You are finding 8 groups of 7." |
| Hint 2 | Give a strategy | "Break 8 x 7 into 10 x 7 minus 2 x 7." |
| Hint 3 | Show a visual | Array, number line, model, table, or diagram. |
| Hint 4 | Start the first step | "10 x 7 = 70." |
| Hint 5 | Guided solve | Student fills in each remaining step. |

No hint should reveal the final answer immediately unless the student has already made a strong attempt or entered guided solve mode.

## Multiplication Hint Model

For multiplication, the app should show groups of 10 with the excess added as another column or smaller group. This makes counting easier and gives students a visual anchor.

Example: 12 x 7

- Show 10 groups of 7.
- Show 2 extra groups of 7 in a separate column.
- Label the parts: 10 x 7 and 2 x 7.
- Let the student combine 70 + 14.

Example visual structure:

```text
10 groups of 7:  [7][7][7][7][7][7][7][7][7][7] = 70
2 extra groups:  [7][7] = 14
Total: 70 + 14 = ?
```

The same structure works well for facts above 10:

- 11 x 6 becomes 10 x 6 + 1 x 6.
- 12 x 8 becomes 10 x 8 + 2 x 8.
- 9 x 7 can become 10 x 7 - 1 x 7.

## Subtracting From A Negative Number

For subtracting from a negative number, the app should use a number line with two points and an arrow moving backward.

Example: -3 - 5

- Put a point at -3.
- Show that subtraction means moving left.
- Draw an arrow 5 spaces backward.
- Land on -8.

Example visual structure:

```text
<---|---|---|---|---|---|---|---|---|--->
   -8  -7  -6  -5  -4  -3  -2  -1   0
    ^-------------------^
  end                 start
```

The hint should say something like:

"Start at -3. Since you are subtracting 5, move 5 spaces backward on the number line."

For a problem like -3 - (-5), the app should show the change clearly:

- Start at -3.
- Subtracting a negative means moving in the opposite direction.
- Move 5 spaces forward.
- Land on 2.

## TEKS-Aligned Hint Examples

| Concept | Hint Visual | Strategy |
| --- | --- | --- |
| Integer addition | Number line arrows | Move right for positive, left for negative. |
| Integer subtraction | Number line with backward arrow | Subtraction moves left unless subtracting a negative. |
| Fraction operations | Area models and common denominator bars | Rename fractions before combining. |
| Unit rates | Ratio table | Divide both quantities to find one unit. |
| Percent discount | Bar model or 100-grid | Find the percent amount, then subtract. |
| Equations | Balance scale | Do the same operation to both sides. |
| Inequalities | Number line with open or closed point | Graph the boundary and shade the solution direction. |
| Circle measurement | Labeled circle diagram | Use radius or diameter correctly before substituting. |
| Probability | Outcome grid or tree diagram | Count favorable outcomes over total outcomes. |
| Statistics | Dot plot or box plot | Compare center and spread, not just the largest value. |

## No-Penalty Hint Policy

Students should never lose stars, XP, rank, or currency for using hints.

Instead, the app can track hint use privately for teacher insight:

- Student solved independently.
- Student solved with a strategy hint.
- Student solved with a visual hint.
- Student solved with guided support.

This lets teachers know what kind of support helped without making students afraid to ask for help.

Suggested reward logic:

- Correct answer with no hint: earns full XP.
- Correct answer with hints: earns full XP.
- Correct after multiple attempts: earns full XP plus persistence credit.
- Incorrect but completed: earns practice XP and unlocks review.
- Improved after review: earns bonus XP.

## Leaderboard Design

Leaderboards should encourage healthy competition while avoiding shame.

Recommended leaderboard types:

- Class XP leaderboard
- Weekly improvement leaderboard
- Streak leaderboard
- Boss battle leaderboard
- Timed challenge leaderboard
- Most improved skill leaderboard
- Team leaderboard

Avoid showing a permanent public rank for struggling students. Weekly resets and category variety give more students a path to recognition.

## Fair Scoring Model

Leaderboard points should combine several behaviors:

```text
Leaderboard Score =
  accuracy points
+ completion points
+ improvement points
+ streak points
+ challenge points
+ review points
```

Speed should be used only in timed modes, not as the main ranking system.

Example:

| Action | Points |
| --- | --- |
| Complete a practice level | 50 |
| Get a correct answer | 10 |
| Correct a missed problem | 15 |
| Finish a review quest | 75 |
| Improve a skill score | 100 |
| Complete timed challenge | 100 |
| Beat personal best | 150 |

## Timed Mode Scoring

Timed modes can have their own leaderboard, but hints should still be allowed.

Suggested timed mode rules:

- Hints do not reduce score.
- Students may skip and return to problems.
- Accuracy matters more than raw speed.
- Personal bests are celebrated.
- Students can replay timed challenges for more coins and tickets.

Timed mode score:

```text
Timed Score =
  correct answers x 100
+ remaining seconds x 5
+ personal best bonus
+ no-rush accuracy bonus
```

The "no-rush accuracy bonus" rewards students who answer carefully instead of spam-clicking.

## Data For Teachers

Teachers should see hint data as learning evidence.

Useful reports:

- Average time per problem
- Skills where students pause longest
- Which hints are most used
- Students who solve correctly after visual hints
- Students who need guided solve mode often
- Common incorrect answers
- Improvement after hints
- Timed mode growth over time

This makes the app more than a game: it becomes a diagnostic tool that shows how students think.

## Implementation Notes

Each problem should include a hint configuration:

```json
{
  "problemId": "integer-subtraction-001",
  "skillId": "rational-numbers.integer-subtraction.level-4",
  "prompt": "-3 - 5",
  "answer": -8,
  "hintStrategy": "number_line_backward",
  "hintScheduleSeconds": [15, 30, 60],
  "visualModel": {
    "type": "number_line",
    "start": -3,
    "movement": -5,
    "end": -8
  }
}
```

The app should log every hint event:

```json
{
  "studentId": "student-123",
  "problemId": "integer-subtraction-001",
  "startedAt": "2026-07-23T15:20:00Z",
  "submittedAt": "2026-07-23T15:20:42Z",
  "timeSeconds": 42,
  "hintsShown": ["nudge", "number_line_backward"],
  "attempts": 2,
  "correct": true
}
```

## Student Experience

When a student takes longer, the app should feel helpful, not judgmental.

Good message:

"Want a visual? Start at -3 and move backward 5 spaces."

Avoid:

"You are taking too long."

The app should feel like a coach sitting beside the student, not a timer breathing down their neck.
