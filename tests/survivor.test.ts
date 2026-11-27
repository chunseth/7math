import assert from "node:assert/strict";
import { test } from "node:test";
import {
  BOSS_AT, BOSS_HEALTH, CHARGE_MS, chooseUpgrade, createRun, editAnswer, radius,
  resizeRun, stepRun, upgradeChoices, type Run,
} from "../lib/survivor/arena";
import { completedSurvivorLevels, type SurvivorPack } from "../lib/survivor/pack";

const size = { width: 420, height: 600 };
const idle = { target: null, direction: { x: 0, y: 0 } };

function pack(...answers: string[]): SurvivorPack {
  return {
    sprite: "phoenix",
    topics: [{ id: "signed.add", title: "Signed addition", questions: answers.map((answer, i) => ({ id: String(i), prompt: `Question ${i}`, answer })) }],
  };
}

function play(...answers: string[]) { return createRun(pack(...answers), size, () => 0.5); }
function type(run: Run, answer: string) { for (const key of answer) editAnswer(run, key); }
function arriveAtBoss(run: Run) {
  run.elapsed = BOSS_AT - 1;
  stepRun(run, idle, 1);
  assert.equal(run.enemy?.kind, "boss");
}

test("Survivor requires a published clear for every level of a concept", () => {
  const signed = ["signed.add.1", "signed.add.2", "signed.add.3"];
  assert.deepEqual(completedSurvivorLevels(signed, []), []);
  assert.deepEqual(completedSurvivorLevels(signed, signed.slice(0, 2)), []);
  assert.deepEqual(completedSurvivorLevels(signed.slice(0, 2), signed), []);
  assert.deepEqual(completedSurvivorLevels([...signed, "signed.multiply.1"], [...signed, "signed.multiply.1"]), signed);
  assert.deepEqual(completedSurvivorLevels(["review.multiply.8-9.1"], ["review.multiply.8.1"]), ["review.multiply.8-9.1"]);
});

test("regular enemies pursue and shoot, then leave an XP pickup and one replacement", () => {
  const run = play("5", "6");
  assert.equal(run.sprite, "phoenix");
  assert.deepEqual(run.player, { x: 210, y: 300 });
  const first = run.enemy!;
  const initialPosition = first.at;
  stepRun(run, idle, 1500);
  assert.notDeepEqual(first.at, initialPosition);
  assert.equal(run.shots.length, 1);
  editAnswer(run, "4");
  editAnswer(run, "Enter");
  assert.equal(run.health, 100);
  assert.equal(run.enemy, first);
  editAnswer(run, "Backspace");
  editAnswer(run, "5");
  assert.equal(run.enemy?.kind ?? "none", "none");
  assert.equal(run.defeated, 1);
  assert.equal(run.xp, 0);
  assert.deepEqual(run.drops.map(drop => drop.at), [first.at]);
  stepRun(run, idle, 699);
  assert.equal(run.enemy?.kind ?? "none", "none");
  stepRun(run, idle, 1);
  assert.equal(run.enemy?.kind ?? "none", "enemy");
  assert.notEqual(run.enemy?.id, first.id);
  run.player = run.drops[0].at;
  stepRun(run, idle, 1);
  assert.equal(run.drops.length, 0);
  assert.equal(run.xp, 1);
});

test("questions rotate across concepts and cycle without repeats", () => {
  const setup = pack("1", "2", "3");
  setup.topics.push({ id: "review.subtract", title: "Subtraction", questions: [{ id: "other", prompt: "Other topic", answer: "8" }] });
  const run = createRun(setup, size, () => 0.5);
  const seen: string[] = [];
  for (let i = 0; i < 5; i++) {
    const question = run.enemy!.question;
    seen.push(question.id);
    type(run, question.answer);
    stepRun(run, idle, 700);
  }
  assert.deepEqual(seen, ["0", "other", "1", "2", "0"]);
});

test("three pickups pause combat and offer power, speed, and health upgrades", () => {
  for (const kind of ["power", "speed", "health"] as const) {
    const run = play("7");
    run.health = 80;
    for (let i = 0; i < 3; i++) {
      type(run, "7");
      run.player = run.drops[0].at;
      stepRun(run, idle, 700);
    }
    assert.equal(run.phase, "upgrade");
    assert.deepEqual(upgradeChoices(run).map(choice => choice.kind), ["power", "speed", "health"]);
    const elapsed = run.elapsed;
    stepRun(run, { ...idle, direction: { x: 1, y: 0 } }, 5000);
    assert.equal(run.elapsed, elapsed);
    chooseUpgrade(run, kind);
    assert.equal(run.phase, "playing");
    assert.equal(run.xp, 0);
    assert.equal(run.xpGoal, 4);
    assert.equal(run.upgrades[0].kind, kind);
    if (kind === "power") {
      arriveAtBoss(run);
      type(run, "7");
      assert.equal(run.enemy?.kind === "boss" && run.enemy.health, BOSS_HEALTH - 2);
    } else if (kind === "speed") {
      assert.ok(run.speed > 1);
    } else {
      assert.equal(run.maxHealth, 120);
      assert.equal(run.health, 100);
    }
  }
});

test("the boss takes over at 3:00 and releases its question with the charged orb", () => {
  const run = play("2", "34", "56", "78");
  stepRun(run, idle, 1500);
  assert.equal(run.shots.length, 1);
  run.elapsed = BOSS_AT - 2;
  stepRun(run, idle, 1);
  assert.equal(run.enemy?.kind ?? "none", "enemy");
  stepRun(run, idle, 1);
  assert.equal(run.elapsed, BOSS_AT);
  assert.equal(run.enemy?.kind ?? "none", "boss");
  assert.equal(run.shots.length, 0);
  stepRun(run, idle, CHARGE_MS - 1);
  assert.equal(run.orb?.id ?? null, null);
  stepRun(run, idle, 1);
  assert.equal(run.orb?.question.answer, "56");
  type(run, "56");
  assert.equal(run.orb, null);
  assert.equal(run.enemy?.kind === "boss" && run.enemy.health, BOSS_HEALTH);
  assert.equal(run.enemy?.attackAt, run.elapsed + CHARGE_MS);
  type(run, "34");
  assert.equal(run.enemy?.kind === "boss" && run.enemy.health, BOSS_HEALTH - 1);
  assert.equal(run.enemy?.question.answer, "78");
});

test("one keypad accepts both targets, handles shared prefixes, and resolves equal answers together", () => {
  const run = play("4", "1", "12");
  arriveAtBoss(run);
  stepRun(run, idle, CHARGE_MS);
  type(run, "1");
  assert.equal(run.entry, "1");
  assert.equal(run.enemy?.kind === "boss" && run.enemy.health, BOSS_HEALTH);
  type(run, "2");
  assert.equal(run.orb, null);
  type(run, "1");
  assert.equal(run.enemy?.kind === "boss" && run.enemy.health, BOSS_HEALTH - 1);

  const short = play("4", "1", "12");
  arriveAtBoss(short);
  stepRun(short, idle, CHARGE_MS);
  type(short, "1");
  stepRun(short, idle, 799);
  assert.equal(short.enemy?.kind === "boss" && short.enemy.health, BOSS_HEALTH);
  stepRun(short, idle, 1);
  assert.ok(short.orb);
  assert.equal(short.enemy?.kind === "boss" && short.enemy.health, BOSS_HEALTH - 1);

  const equal = play("4", "-0.5", "-1/2");
  arriveAtBoss(equal);
  stepRun(equal, idle, CHARGE_MS);
  type(equal, "-1/2");
  assert.equal(equal.orb, null);
  assert.equal(equal.enemy?.kind === "boss" && equal.enemy.health, BOSS_HEALTH - 1);
});

test("orb hits and misses restart the charge, and zero health freezes the run", () => {
  const run = play("4", "1", "12");
  arriveAtBoss(run);
  stepRun(run, idle, CHARGE_MS);
  run.orb!.at = { x: -100, y: 0 };
  stepRun(run, idle, 1);
  assert.equal(run.orb, null);
  assert.equal(run.health, 100);
  stepRun(run, idle, CHARGE_MS);
  run.orb!.at = run.player;
  stepRun(run, idle, 1);
  assert.equal(run.health, 68);
  stepRun(run, idle, CHARGE_MS);
  run.orb!.at = run.player;
  run.health = 32;
  stepRun(run, idle, 1);
  assert.equal(run.health, 0);
  assert.equal(run.phase, "defeat");
  const elapsed = run.elapsed;
  stepRun(run, idle, CHARGE_MS);
  assert.equal(run.elapsed, elapsed);
});

test("defeating the boss ends spawning and a fresh run resets state", () => {
  const run = play("3");
  arriveAtBoss(run);
  for (let i = 0; i < BOSS_HEALTH; i++) type(run, "3");
  assert.equal(run.phase, "victory");
  stepRun(run, idle, 20_000);
  assert.equal(run.enemy, null);
  assert.equal(run.elapsed, BOSS_AT);
  const fresh = play("3");
  assert.equal(fresh.enemy?.kind, "enemy");
  assert.equal(fresh.elapsed, 0);
  assert.equal(fresh.health, 100);
});

test("touch targets steer until release and resizing keeps the player in bounds", () => {
  const run = play("1");
  stepRun(run, { ...idle, target: { x: 500, y: 300 } }, 150);
  assert.ok(run.player.x > 210);
  const released = run.player;
  stepRun(run, idle, 150);
  assert.deepEqual(run.player, released);
  resizeRun(run, { width: 240, height: 330 });
  stepRun(run, { ...idle, direction: { x: 1, y: 0 } }, 1500);
  assert.equal(run.player.x, 240 - radius(run, "player"));
});
