# Unit 1 Mini Clash: Multiplication Monster Match

This document describes the Unit 1 starter game for Mathematical Reasoning and Number Review. It is a small Clash Royale-inspired loop built around multiplication fluency, collection, chests, and fast matches.

## Unit Connection

Unit 1 reviews:

- Integers
- Fractions
- Decimals
- Factors
- Multiples
- Order of operations
- Mathematical reasoning and representations

This mini-game starts with multiplication fluency because it supports later work with factors, multiples, rational numbers, ratios, proportionality, and mental math.

## Game Pitch

Students enter a short monster match. Monsters advance toward the player. Each monster is defeated by answering a multiplication fact correctly.

Initial match pool:

- 6 times table
- 7 times table
- 8 times table
- 9 times table

The player has 100 health.

## Match Rules

Each match:

- Uses multiplication facts only.
- Starts with 6-9 times tables.
- Presents one monster/problem at a time.
- Gives 5 seconds per problem.
- Correct answer defeats the monster.
- Incorrect answer causes the monster to hit the player.
- No answer within 5 seconds also causes a hit.
- Match ends when the timer ends, the monster wave ends, or player health reaches 0.

Suggested starting damage:

- Incorrect answer: 10 damage
- Timeout: 10 damage
- Boss monster incorrect answer: 20 damage

Suggested match length:

- 60 seconds, or
- 15 monsters, whichever is easier to implement first.

## Rewards

If the student answers at least one problem correctly, they earn a chest.

Chest rule:

- At least 1 correct answer = chest earned.
- 0 correct answers = practice XP only, no chest.
- XP is profile-only and does not give boosts.

The chest contains unlock progress for the multiplication map.

## Chest Slots

Each player has 4 chest slots.

Rules:

- A player can hold up to 4 unopened chests.
- If all 4 slots are full, they can still play matches for XP and practice, but cannot earn another chest until a slot opens.
- The first chest is opened instantly using coins provided to the player during onboarding.
- After the first chest, standard chests take 4 hours to unlock.

Recommended chest states:

- Empty
- Locked
- Unlocking
- Ready to open
- Opened

## First Chest

The first chest should be generous and quick.

Purpose:

- Teach the chest loop.
- Give the student immediate collection progress.
- Let them feel the table growing.

First chest behavior:

- Awarded after the first match with at least 1 correct answer.
- Instantly opened using starter coins.
- Contains a random unlocked number from the Common pool.

Common starter pool:

- 3
- 4
- 5

This means the student begins by expanding from 6-9 into one easier or familiar table.

## Chest Rarity Pools

After the first chest, chest rewards are drawn by rarity.

| Rarity | Unlock Numbers | Role |
| --- | --- | --- |
| Common | 3, 4, 5 | Familiar facts and factor support |
| Rare | 11, 12 | Upper multiplication fluency |
| Epic | 10, 2 | Anchor facts and doubling |
| Legendary | 0, 1 | Special identity/zero tables |

Chests can also award economy items and cosmetics. Number unlocks should remain the main early reward until the multiplication map is complete.

Initial unlocked rows:

- 6
- 7
- 8
- 9

Collectible rows:

- 0
- 1
- 2
- 3
- 4
- 5
- 10
- 11
- 12

## Rarity Distribution

Suggested initial rarity odds:

| Rarity | Starting Chance |
| --- | --- |
| Common | 60% |
| Rare | 25% |
| Epic | 12% |
| Legendary | 3% |

The distribution must adjust as numbers are collected. If a rarity pool is empty, its probability should be redistributed across remaining available rarity pools.

Example:

If the student already collected all Common numbers, the Common 60% is removed and redistributed proportionally across Rare, Epic, and Legendary.

Remaining original weights:

```text
Rare: 25
Epic: 12
Legendary: 3
Total remaining weight: 40
```

Adjusted chances:

```text
Rare: 25 / 40 = 62.5%
Epic: 12 / 40 = 30%
Legendary: 3 / 40 = 7.5%
```

## Chest Reward Pools

Common chests should mostly help students keep playing and managing chest flow.

| Item | Rarity | Inventory Limit | Effect |
| --- | --- | --- | --- |
| Instant Open Token | Common | 2 | Opens one chest immediately. |
| Double Chest Potion | Common | 3 | Next eligible match awards 2 chests if a slot is available. |
| Double XP Potion | Common | 3 | Doubles profile XP for a limited time or match count. XP remains profile-only and gives no boosts. |
| Streak Freeze | Common | 2 | Protects a daily streak after one missed day. |
| Queue Chest Token | Common | 2 | Allows one chest to wait in queue when all 4 slots are full. |

Rare chests should start adding identity and personalization.

| Item | Rarity | Inventory Limit | Effect |
| --- | --- | --- | --- |
| Secret Username Color | Rare | No duplicate colors | Changes the leaderboard/profile username color. |
| Favorite Problem Slot | Rare | 1 active, multiple collected | Lets the student pin a favorite problem type to their profile. |
| Hate Problem Slot | Rare | 1 active, multiple collected | Lets the student privately tag a disliked problem type for extra practice routing. |
| Font Skin | Rare | No duplicate fonts | Changes profile, headings, reward screens, and non-math UI text. |

The "hate problem" feature should be private to the student and teacher. It should help the app recommend practice, not publicly label the student.

## Chest Item Drop Mix

Suggested reward mix while multiplication numbers remain locked:

| Reward Type | Chance |
| --- | --- |
| New multiplication number | 70% |
| Common economy item | 25% |
| Rare cosmetic/profile item | 5% |

Suggested reward mix after the multiplication map is complete:

| Reward Type | Chance |
| --- | --- |
| Common economy item | 55% |
| Rare cosmetic/profile item | 35% |
| An absurd amount of Coins | 10% |

If an inventory-limited item is full, the app should either reroll within the same rarity or convert the duplicate into small amounts of coins.

Recommended duplicate conversion:

| Duplicate Item Rarity | Coin Conversion |
| --- | --- |
| Common | 500 coins |
| Rare | 2,000 coins |
| Epic | 7,500 coins |
| Legendary | 20,000 coins |

For MVP, prefer rerolling before converting to coins.

## Chest Draw Algorithm

The chest should never award a number the student already owns.

Recommended algorithm:

1. Build a list of rarity pools that still contain unowned numbers.
2. Remove empty rarity pools.
3. Recalculate rarity weights using only non-empty pools.
4. Randomly select one rarity using adjusted weights.
5. Randomly select one unowned number from that rarity.
6. Add that number to the student's unlocked multiplication map.

If the chest is rolling an item instead of a multiplication number:

1. Build a list of available item rewards.
2. Remove items blocked by inventory limits.
3. Remove cosmetics the student already owns.
4. Draw from the remaining item pool.
5. If the pool is empty, convert to coins or reroll as a number unlock.

Example data:

```json
{
  "rarityWeights": {
    "common": 60,
    "rare": 25,
    "epic": 12,
    "legendary": 3
  },
  "rarityPools": {
    "common": [3, 4, 5],
    "rare": [11, 12],
    "epic": [10, 2],
    "legendary": [0, 1]
  },
  "startingUnlocked": [6, 7, 8, 9]
}
```

## Shop And Coin Costs

Coins should buy cosmetics, convenience, and extra optional play. They should not buy correct answers, easier problems, leaderboard score, or mastery.

Common economy items:

| Item | Coin Cost | Inventory Limit | Notes |
| --- | --- | --- | --- |
| Instant Open Token | 8,000 | 2 | Opens one chest immediately. |
| Double Chest Potion | 12,000 | 3 | Next eligible match can award 2 chests if slots or queue are available. |
| Double XP Potion | 6,000 | 3 | Doubles profile XP for 30 minutes or 3 matches. No gameplay boost. |
| Streak Freeze | 10,000 | 2 | Protects one missed-day streak. |
| Queue Chest Token | 15,000 | 2 | Adds one temporary queued chest beyond the 4 normal slots. |

Rare profile and cosmetic items:

| Item | Coin Cost | Inventory Limit | Notes |
| --- | --- | --- | --- |
| Secret Username Color | 18,000 | No duplicates | Cosmetic leaderboard/profile color. |
| Favorite Problem Slot | 20,000 | 1 active | Lets a student display a favorite problem type. |
| Hate Problem Slot | 20,000 | 1 active | Private preference used for extra routing and teacher insight. |
| Basic Font Skin | 15,000 | No duplicates | Profile and UI heading font. |
| Premium Font Skin | 35,000 | No duplicates | Higher-style font with reward-screen effects. |

Bundles:

| Bundle | Coin Cost | Contents |
| --- | --- | --- |
| Chest Manager Bundle | 30,000 | 1 Instant Open Token, 1 Queue Chest Token, 1 Streak Freeze |
| Practice Grinder Bundle | 32,000 | 1 Double XP Potion, 1 Double Chest Potion, 1 Streak Freeze |
| Profile Identity Bundle | 45,000 | 1 Secret Username Color, 1 Basic Font Skin, 1 profile banner |
| Speedrun Prep Bundle | 50,000 | 1 Queue Chest Token, 1 Double Chest Potion, 1 timer skin |
| 100K Showcase Bundle | 100,000 | 1 Premium Font Skin, 1 Secret Username Color, 1 animated profile banner, 1 trophy shelf theme |

Cosmetics:

| Cosmetic | Coin Cost |
| --- | --- |
| Avatar color | 3,000 |
| Avatar outfit | 12,000 |
| Arena background | 25,000 |
| Monster skin pack | 30,000 |
| Chest opening animation | 18,000 |
| Health bar theme | 10,000 |
| Timer skin | 12,000 |
| Multiplication map theme | 40,000 |
| Trophy shelf theme | 35,000 |
| Animated profile banner | 50,000 |

## Multiplication Map

On the student's fifth match, unlock the multiplication map.

The map shows a 0-12 multiplication table.

Rules:

- Unlocked rows and columns are visible.
- Locked rows and columns are blocked out.
- The starting visible rows and columns are 6, 7, 8, and 9.
- Newly collected numbers reveal their matching row and column.
- Locked cells should look covered, fogged, or chained.

Example:

If the student has unlocked 3, 6, 7, 8, 9, and 11:

- Rows 3, 6, 7, 8, 9, 11 are visible.
- Columns 3, 6, 7, 8, 9, 11 are visible.
- All other rows and columns are blocked.

The map gives students a clear collection goal: complete the full 0-12 table.

## Problem Selection

The match should select problems from unlocked rows and columns.

At launch:

- Use only 6, 7, 8, 9 rows and columns.

After collection:

- Add newly unlocked rows and columns to the problem pool.

Problem examples:

- 6 x 8
- 9 x 7
- 3 x 8, after 3 is unlocked
- 11 x 6, after 11 is unlocked
- 10 x 12, only after both 10 and 12 are unlocked if using strict row-column unlocks

Design choice:

- Strict unlock: a cell appears only if both row and column are unlocked.
- Generous unlock: a fact appears if either row or column is unlocked.

Recommended: strict unlock for the map, generous unlock for practice. This lets students see more growth while keeping the map visually meaningful.

## Monster Design

Monster type can reflect difficulty.

| Monster | Problem Type | Behavior |
| --- | --- | --- |
| Slime | Easy known facts | 5-second timer |
| Goblin | Mixed 6-9 facts | 5-second timer |
| Shield Monster | Recently unlocked number | Needs 2 correct answers |
| Fast Monster | Known facts answered quickly before | 4-second timer |
| Boss | Mixed facts streak | Higher damage |

Note: use a different creature name than "goblin" if the final product needs a more original fantasy theme.

## Hints In Monster Match

Because the match is timed, hints should be quick and visual.

For multiplication facts above 10:

- Show 10 groups plus extras.
- Example: 12 x 7 = 10 x 7 + 2 x 7.

For 9s:

- Show 10 groups minus 1 group.
- Example: 9 x 8 = 10 x 8 - 1 x 8.

For 6-8:

- Show doubles, near doubles, or skip-counting.

Hint use should not reduce rewards. In a timed match, the natural tradeoff is that using a hint takes time.

## Fifth Match Map Reveal

After the student's fifth match, show a special reveal:

- The arena pauses after the match.
- The student receives a "Map Fragment."
- The full multiplication map opens.
- Locked rows and columns are shown as hidden.
- Current unlocked numbers light up.
- The app explains that chests reveal more rows and columns.

Student-facing copy:

"You found the Multiplication Map. Every chest can reveal a new row and column. Complete the map to master the arena."

## Progression Loop

Core loop:

1. Play monster match.
2. Answer multiplication facts.
3. Earn a chest if at least one answer is correct.
4. Open chest instantly only for the first onboarding chest.
5. Unlock a new multiplication table number.
6. Expand the map.
7. Add new facts to future matches.
8. Repeat until the 0-12 table is complete.

## Balancing Notes

The game should avoid making students wait with nothing useful to do.

If all chest slots are full:

- Let them play for XP.
- Let them chase high scores.
- Let them complete practice quests.
- Let them earn coins.
- Let them practice locked numbers in preview mode without unlocking them.

If the student struggles:

- Keep giving chests for at least one correct answer.
- Use more visual hints.
- Offer slower practice mode.
- Let teacher grant a chest or unlock a row.

If the student is advanced:

- Increase monster speed.
- Add mixed tables sooner.
- Add boss monsters.
- Use stricter test up requirements.
- Place them in higher leaderboard brackets.

## Implementation Data Model

Student collection:

```json
{
  "studentId": "student-123",
  "unlockedMultiplicationNumbers": [6, 7, 8, 9, 3],
  "coins": 100000,
  "matchesPlayed": 5,
  "mapUnlocked": true,
  "inventory": {
    "instantOpenTokens": 1,
    "doubleChestPotions": 0,
    "doubleXpPotions": 2,
    "streakFreezes": 1,
    "queueChestTokens": 1
  },
  "cosmetics": {
    "secretUsernameColors": ["electric-blue"],
    "fontSkins": ["notebook"],
    "favoriteProblem": "9 x 8",
    "hateProblem": "7 x 8"
  },
  "chestSlots": [
    {
      "slot": 1,
      "state": "ready-to-open",
      "rarity": "common",
      "unlockNumber": 4,
      "unlockStartedAt": "2026-09-01T12:00:00Z",
      "unlockReadyAt": "2026-09-01T16:00:00Z"
    }
  ]
}
```

Match result:

```json
{
  "matchId": "match-001",
  "studentId": "student-123",
  "mode": "multiplication-monster-match",
  "tablesUsed": [6, 7, 8, 9],
  "healthStart": 100,
  "healthEnd": 70,
  "correct": 12,
  "incorrect": 2,
  "timeouts": 1,
  "chestEarned": true,
  "durationSeconds": 60
}
```

## Open Design Questions

- Should chests unlock only one number, or sometimes unlock coins and cosmetics too?
- Should duplicate chest rolls convert into coins, or should duplicates be impossible?
- Should students be allowed to spend coins to speed up chest timers?
- Should map completion trigger a Unit 1 boss battle?
- Should the teacher be able to disable 4-hour timers during class?

Recommended answer for MVP:

- Chests usually unlock one new number until the multiplication map is complete.
- Chests can also award common economy items and rare profile cosmetics.
- Duplicates should reroll first, then convert into coins only if needed.
- Coins can buy instant open tokens, but direct instant chest opening should use tokens. make the direct instant chest opening more expensive than the instant open tokens. This will incentivize critical comparison and the kids will feel like they are getting a deal. 
- Map completion unlocks a Unit 1 boss.
- Teacher can override timers.
