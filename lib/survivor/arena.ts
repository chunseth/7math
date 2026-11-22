import { formatRational, parseAnswer } from "../curriculum/rational";
import type { SurvivorPack, SurvivorQuestion } from "./pack";

export const BOSS_AT = 180_000;
export const CHARGE_MS = 3_000;
export const BOSS_HEALTH = 12;
const RESPAWN_MS = 700;
const SHOT_INTERVAL_MS = 2_600;
const HIT_RECOVERY_MS = 850;

export type Point = { x: number; y: number };
export type ArenaSize = { width: number; height: number };
export type Movement = { direction: Point; target: Point | null };
export type Upgrade = "power" | "speed" | "health";
export type UpgradeTaken = { kind: Upgrade; title: string };
type Topic = { id: string; title: string };
type Question = SurvivorQuestion & { topic: Topic; normalized: string };
type Enemy = { id: number; at: Point; question: Question; attackAt: number | null } &
  ({ kind: "enemy" } | { kind: "boss"; health: number });
type Projectile = { id: number; at: Point; direction: Point };
type Orb = Projectile & { question: Question };
type Drop = { id: number; at: Point; topic: Topic };

export type Run = {
  size: ArenaSize;
  elapsed: number;
  phase: "playing" | "upgrade" | "victory" | "defeat";
  bossArrived: boolean;
  sprite: string;
  player: Point;
  health: number;
  maxHealth: number;
  hurtUntil: number;
  enemy: Enemy | null;
  spawnAt: number;
  shots: Projectile[];
  orb: Orb | null;
  drops: Drop[];
  defeated: number;
  xp: number;
  xpGoal: number;
  upgradeTopic: Topic | null;
  upgrades: UpgradeTaken[];
  power: Record<string, number>;
  speed: number;
  entry: string;
  feedback: string;
  nextId: number;
  deck: Question[];
  pool: Question[];
  random: () => number;
};

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
const distance = (a: Point, b: Point) => Math.hypot(b.x - a.x, b.y - a.y);
const shortSide = (run: Run) => Math.min(run.size.width, run.size.height);

export function radius(run: Run, kind: "player" | "enemy" | "boss" | "shot" | "orb" | "drop") {
  const factors = { player: 0.037, enemy: 0.045, boss: 0.075, shot: 0.012, orb: 0.055, drop: 0.015 };
  return clamp(shortSide(run) * factors[kind], 4, kind === "boss" ? 55 : 30);
}

function moveToward(at: Point, target: Point, amount: number): Point {
  const length = distance(at, target);
  if (!length || amount >= length) return target;
  return { x: at.x + (target.x - at.x) * amount / length, y: at.y + (target.y - at.y) * amount / length };
}

function moveInDirection(at: Point, direction: Point, amount: number): Point {
  return { x: at.x + direction.x * amount, y: at.y + direction.y * amount };
}

function keepInArena(at: Point, size: ArenaSize, inset: number): Point {
  return { x: clamp(at.x, inset, size.width - inset), y: clamp(at.y, inset, size.height - inset) };
}

function questionSpace(run: Run, kind: Enemy["kind"]) {
  return Math.min(run.size.height * 0.44, radius(run, kind) + 91);
}

function spawnPoint(run: Run, boss: boolean) {
  const { width, height } = run.size;
  const inset = shortSide(run) * 0.1;
  const top = questionSpace(run, boss ? "boss" : "enemy");
  const bottom = height - (boss ? Math.min(height * 0.32, 115) : inset);
  const along = 0.36 + run.random() * 0.28;
  const edges = [
    { x: inset, y: clamp(height * along, top, bottom) }, { x: width - inset, y: clamp(height * (1 - along), top, bottom) },
    { x: width * along, y: top }, { x: width * (1 - along), y: bottom },
  ];
  edges.sort((a, b) => distance(b, run.player) - distance(a, run.player));
  return edges[0];
}

function answerForms(question: Question) {
  return [question.answer, question.normalized];
}

function drawQuestion(run: Run, other?: Question, previous?: Question) {
  if (!run.deck.length) run.deck = [...run.pool];
  const index = run.deck.findIndex(question => (!previous || previous.id !== question.id) && (!other ||
    answerForms(question).every(a => answerForms(other).every(b => !a.startsWith(b) && !b.startsWith(a)))));
  const distinct = index === -1 && other ? run.deck.findIndex(question => question.normalized !== other.normalized) : -1;
  return run.deck.splice(index >= 0 ? index : Math.max(0, distinct), 1)[0];
}

function spawn(run: Run, boss: boolean) {
  const common = { id: run.nextId++, at: spawnPoint(run, boss), question: drawQuestion(run) };
  run.enemy = boss
    ? { ...common, kind: "boss", health: BOSS_HEALTH, attackAt: run.elapsed + CHARGE_MS }
    : { ...common, kind: "enemy", attackAt: run.elapsed + 1_500 };
}

export function createRun(pack: SurvivorPack, size: ArenaSize, random = Math.random): Run {
  const pool: Question[] = [];
  const longestTopic = Math.max(0, ...pack.topics.map(topic => topic.questions.length));
  for (let i = 0; i < longestTopic; i++) {
    for (const { id, title, questions } of pack.topics) {
      const question = questions[i];
      const value = question && parseAnswer(question.answer);
      if (value) pool.push({ ...question, topic: { id, title }, normalized: formatRational(value) });
    }
  }
  if (!pool.length) throw new Error("Survivor needs at least one numeric question.");
  const run: Run = {
    size, elapsed: 0, phase: "playing", bossArrived: false, sprite: pack.sprite,
    player: { x: size.width / 2, y: size.height / 2 }, health: 100, maxHealth: 100, hurtUntil: 0,
    enemy: null, spawnAt: 0, shots: [], orb: null, drops: [], defeated: 0,
    xp: 0, xpGoal: 3, upgradeTopic: null, upgrades: [], power: {}, speed: 1,
    entry: "", feedback: "", nextId: 1, deck: [...pool], pool, random,
  };
  spawn(run, false);
  return run;
}

export function resizeRun(run: Run, size: ArenaSize) {
  const rescale = (point: Point) => ({ x: point.x * size.width / run.size.width, y: point.y * size.height / run.size.height });
  run.player = rescale(run.player);
  if (run.enemy) run.enemy.at = rescale(run.enemy.at);
  if (run.orb) run.orb.at = rescale(run.orb.at);
  run.shots.forEach(shot => { shot.at = rescale(shot.at); });
  run.drops.forEach(drop => { drop.at = rescale(drop.at); });
  run.size = size;
  run.player = keepInArena(run.player, size, radius(run, "player"));
}

function shoot(run: Run, origin: Point, kind: "shot" | "orb") {
  const length = distance(origin, run.player);
  const direction = length ? { x: (run.player.x - origin.x) / length, y: (run.player.y - origin.y) / length } : { x: 0, y: 1 };
  const at = moveInDirection(origin, direction, radius(run, kind === "orb" ? "boss" : "enemy"));
  return { id: run.nextId++, at, direction };
}

function chargeAgain(run: Run) {
  run.orb = null;
  if (run.enemy?.kind === "boss") run.enemy.attackAt = run.elapsed + CHARGE_MS;
}

function hurt(run: Run, damage: number) {
  if (run.elapsed < run.hurtUntil) return;
  run.health = Math.max(0, run.health - damage);
  run.hurtUntil = run.elapsed + HIT_RECOVERY_MS;
  if (run.health === 0) {
    run.phase = "defeat";
    run.entry = "";
  }
}

function moveProjectile(run: Run, projectile: Projectile, kind: "shot" | "orb", amount: number) {
  const r = radius(run, kind);
  projectile.at = moveInDirection(projectile.at, projectile.direction, amount);
  if (distance(projectile.at, run.player) <= r + radius(run, "player")) {
    hurt(run, kind === "orb" ? 32 : 12);
    return false;
  }
  const { x, y } = projectile.at;
  return x >= -r && y >= -r && x <= run.size.width + r && y <= run.size.height + r;
}

function tick(run: Run, movement: Movement, milliseconds: number) {
  run.elapsed += milliseconds;
  const travel = shortSide(run) * milliseconds / 1000;
  const speed = travel * 0.50 * run.speed;
  const length = Math.hypot(movement.direction.x, movement.direction.y);
  const destination = length ? moveInDirection(run.player, movement.direction, speed / length)
    : movement.target ? moveToward(run.player, movement.target, speed) : run.player;
  run.player = keepInArena(destination, run.size, radius(run, "player"));

  if (!run.bossArrived && run.elapsed >= BOSS_AT) {
    run.bossArrived = true;
    run.shots = [];
    run.entry = "";
    run.feedback = "The boss has arrived.";
    spawn(run, true);
  } else if (!run.bossArrived && !run.enemy && run.elapsed >= run.spawnAt) {
    spawn(run, false);
  }

  run.shots = run.shots.filter(shot => moveProjectile(run, shot, "shot", travel * 0.48));
  if (run.orb && !moveProjectile(run, run.orb, "orb", travel * 0.24)) chargeAgain(run);
  if (run.phase === "defeat") return;

  const enemy = run.enemy;
  if (enemy?.kind === "enemy") {
    const advance = Math.min(travel * 0.33, Math.max(0, distance(enemy.at, run.player) - shortSide(run) * 0.35));
    enemy.at = moveToward(enemy.at, run.player, advance);
    if (enemy.at.y < questionSpace(run, "enemy")) enemy.at = { ...enemy.at, y: questionSpace(run, "enemy") };
    if (enemy.attackAt !== null && run.elapsed >= enemy.attackAt) {
      run.shots.push(shoot(run, enemy.at, "shot"));
      enemy.attackAt = run.elapsed + SHOT_INTERVAL_MS;
    }
  } else if (enemy?.kind === "boss" && enemy.attackAt !== null && run.elapsed >= enemy.attackAt) {
    run.orb = { ...shoot(run, enemy.at, "orb"), question: drawQuestion(run, enemy.question) };
    enemy.attackAt = null;
  }

  const pickup = run.drops.findIndex(drop => distance(drop.at, run.player) <= radius(run, "player") + radius(run, "drop") + 4);
  if (pickup >= 0) {
    const [drop] = run.drops.splice(pickup, 1);
    run.xp++;
    if (run.xp === run.xpGoal) {
      run.phase = "upgrade";
      run.upgradeTopic = drop.topic;
    }
  }
}

export function stepRun(run: Run, movement: Movement, milliseconds: number) {
  let remaining = milliseconds;
  while (remaining > 0 && run.phase === "playing") {
    const untilBoss = run.bossArrived ? Infinity : BOSS_AT - run.elapsed;
    const step = Math.min(remaining, 16, untilBoss > 0 ? untilBoss : Infinity);
    tick(run, movement, step);
    remaining -= step;
  }
}

export function upgradeChoices(run: Run): (UpgradeTaken & { description: string })[] {
  if (!run.upgradeTopic) return [];
  const damage = 2 + (run.power[run.upgradeTopic.id] ?? 0);
  return [
    { kind: "power", title: `${run.upgradeTopic.title} power`, description: `Correct answers in this concept deal ${damage} boss damage.` },
    { kind: "speed", title: "Fleet Foot", description: "Increase movement speed by 12% of base speed." },
    { kind: "health", title: "Fortitude", description: "Gain 20 maximum health and restore 20 health." },
  ];
}

export function chooseUpgrade(run: Run, kind: Upgrade) {
  if (run.phase !== "upgrade" || !run.upgradeTopic) return;
  const choice = upgradeChoices(run).find(option => option.kind === kind);
  if (!choice) return;
  if (kind === "power") {
    const topic = run.upgradeTopic.id;
    run.power[topic] = (run.power[topic] ?? 0) + 1;
  } else if (kind === "speed") {
    run.speed += 0.12;
  } else {
    run.maxHealth += 20;
    run.health += 20;
  }
  run.upgrades.push({ kind, title: choice.title });
  run.xp = 0;
  run.xpGoal++;
  run.upgradeTopic = null;
  run.phase = "playing";
  run.feedback = `${choice.title} acquired.`;
}

export function editAnswer(run: Run, key: string) {
  if (run.phase !== "playing") return;
  if (key === "Clear") {
    run.entry = "";
    run.feedback = "";
    return;
  }
  if (!run.enemy && !run.orb) return;
  const entry = key === "Enter" ? run.entry : key === "Backspace" ? run.entry.slice(0, -1)
    : key === "-" ? run.entry.startsWith("-") ? run.entry.slice(1) : "-" + run.entry : run.entry + key;
  if (!/^-?(?:\d{0,12}(?:\.\d{0,12})?|\d{1,12}\/\d{0,12})$/.test(entry)) return;
  run.entry = entry;
  run.feedback = "";
  const parsed = parseAnswer(entry);
  const value = parsed && formatRational(parsed);
  const enemy = run.enemy;
  const orb = run.orb;
  const hitEnemy = enemy !== null && enemy.question.normalized === value;
  const defuse = orb !== null && orb.question.normalized === value;
  if (!hitEnemy && !defuse) {
    if (key === "Enter" && entry) run.feedback = "Try again.";
    return;
  }
  const other = hitEnemy ? orb?.question : enemy?.question;
  if (key !== "Enter" && !(hitEnemy && defuse) && other &&
      answerForms(other).some(form => form.length > entry.length && form.startsWith(entry))) {
    run.feedback = "Keep typing or press Enter.";
    return;
  }

  run.entry = "";
  if (defuse) {
    chargeAgain(run);
    run.feedback = "Orb defused.";
  }
  if (hitEnemy && enemy.kind === "enemy") {
    run.drops.push({ id: run.nextId++, at: enemy.at, topic: enemy.question.topic });
    run.defeated++;
    run.enemy = null;
    run.spawnAt = run.elapsed + RESPAWN_MS;
    run.feedback = "Enemy defeated. Collect the XP.";
  } else if (hitEnemy && enemy.kind === "boss") {
    enemy.health = Math.max(0, enemy.health - 1 - (run.power[enemy.question.topic.id] ?? 0));
    if (enemy.health === 0) {
      run.phase = "victory";
      run.enemy = null;
      run.orb = null;
    } else {
      enemy.question = drawQuestion(run, run.orb?.question, enemy.question);
      run.feedback = defuse ? "Orb defused. Boss hit." : "Boss hit.";
    }
  }
}
