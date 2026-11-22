// Exercise the real HTTP and transaction boundaries against a disposable local database.
const assert = require("node:assert/strict");
const { randomUUID } = require("node:crypto");
const { Client } = require("pg");
const base = process.env.MENTALIST_TEST_ORIGIN,
  url = process.env.MENTALIST_DATABASE_URL;
if (!base || !url || ![base, url].every((u) => ["127.0.0.1", "localhost"].includes(new URL(u).hostname)))
  throw Error("Provide the local test origin and its disposable local database.");
const db = new Client({ connectionString: url });
let cookie = "",
  student;
async function api(body, expected = 200, token) {
  const res = await fetch(base + "/api/mentalist", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: cookie,
      ...(token ? { Authorization: "Bearer " + token } : {}),
    },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  assert.equal(res.status, expected, JSON.stringify({ action: body.action, response: data.error }));
  return { data, cookie: res.headers.get("set-cookie") };
}
async function state() {
  return (await api({ action: "state" })).data;
}
async function start(level, previous = null) {
  return (await api({ action: "start", id: randomUUID(), level, previous })).data;
}
async function key(run) {
  const row = (
    await db.query(
      "select snapshot->>'answer' answer,snapshot->'control' control from mentalist.encounters where id=$1",
      [run.encounter.id],
    )
  ).rows[0];
  if (row.control.kind === "fraction" && !row.answer.includes("/")) row.answer += "/1";
  return row;
}
function event(run, raw) {
  return {
    action: "answer",
    id: randomUUID(),
    run: run.id,
    encounter: run.encounter.id,
    revision: run.encounter.revision,
    elapsed: 5,
    raw,
  };
}
async function solve(run, misses = 0, elapsed = () => 5) {
  while (run.encounter) {
    const { answer, control } = await key(run);
    if (misses > 0) {
      const wrong =
        control.kind === "fraction"
          ? answer === "999/1"
            ? "998/1"
            : "999/1"
          : answer.replace(/\d/, (d) => (d === "9" ? "8" : "9"));
      run = (await api(event(run, wrong))).data.run;
      misses--;
    }
    run = (await api({ ...event(run, answer), elapsed: elapsed(run.encounter.position) })).data.run;
  }
  return run;
}
async function checkBatchPlay() {
  const level = "review.subtract.1";
  async function entry() {
    const { data: pack } = await api({ action: "prepareLevel", level });
    assert.equal(pack.questions.length, 24);
    assert.ok(pack.questions.every(q => q.check.length === 64 && !("answer" in q)));
    const { data: run } = await api({ action: "start", level, prepared: pack.set, id: randomUUID() });
    const { rows: keys } = await db.query(`select q.definition->>'answer' as answer
      from mentalist.runs r cross join lateral jsonb_array_elements(r.policy->'positions') with ordinality p(slot,n)
      join mentalist.questions q on q.version=r.version and q.id=p.slot->>'q' where r.id=$1 order by p.n`, [run.id]);
    assert.equal(new Set(run.rules.order).size, 12);
    assert.equal(pack.questions[run.rules.order[0]].prompt, run.encounter.question.prompt);
    const attempts = keys.map((key, i) => ({ raw: key.answer, at: (i + 1) * 5, elapsed: 5 }));
    return { run, attempts, action: { action: "saveBattle", run: run.id, id: run.id } };
  }
  const before = (await state()).profile.coins;
  const full = await entry();
  await api(event(full.run, full.attempts[0].raw), 409);
  await api({ ...full.action, attempts: full.attempts.slice(0, 11) }, 422);
  assert.equal((await state()).profile.coins, before);
  const payload = { ...full.action, attempts: full.attempts };
  const [left, right] = await Promise.all([api(payload), api(payload)]);
  assert.deepEqual(left.data, right.data);
  assert.equal(left.data.result.activeMs, 60);
  assert.equal(left.data.result.stars, 3);
  assert.ok(left.data.leaderboardRank);
  assert.equal((await state()).profile.coins, before + 120);
  const partial = await entry();
  const leftEarly = await api({ ...partial.action, attempts: partial.attempts.slice(0, 2), leave: true });
  assert.equal(leftEarly.data.status, "interrupted");
  assert.equal(leftEarly.data.resolved, 2);
  const reached = await db.query("select position,resolved from mentalist.encounters where run=$1 order by position", [partial.run.id]);
  assert.deepEqual(reached.rows.map(row => [row.position, !!row.resolved]), [[1,true],[2,true],[3,false]]);
  const knocked = await entry();
  const wrong = knocked.attempts[0].raw.replace(/\d/, d => d === "9" ? "8" : "9");
  const misses = knocked.attempts.slice(0, 4).map(a => ({ ...a, raw: wrong }));
  const result = await api({ ...knocked.action, attempts: misses });
  assert.equal(result.data.status, "knockdown");
  assert.equal(result.data.hp, 0);
  assert.equal((await state()).profile.coins, before + 140);
}
async function checkLeaderboard(name) {
  const level = "review.add.1";
  const board = async () => (await api({ action: "leaderboard", level })).data;
  const originalCookie = cookie;
  const other = "test_" + randomUUID().slice(0, 8);
  const login = await api({ action: "login", username: other, pin: "42", sprite: "raijin", create: true });
  cookie = login.cookie.split(";")[0];
  const missed = await solve(await start(level), 1);
  assert.equal(missed.result.stars, 2);
  assert.equal(missed.leaderboardRank, undefined);
  assert.ok(!(await board()).some(row => row.username === other));
  const tied = await solve(await start(level));
  const tiedBoard = await board();
  const studentRow = tiedBoard.find(row => row.username === name);
  assert.equal(tied.leaderboardRank, studentRow.totalRank);
  assert.equal(tiedBoard.find(row => row.username === other).problemRank, studentRow.problemRank);
  await solve(await start(level), 0, () => 4);
  cookie = originalCookie;
  const replay = await solve(await start(level), 0, pos => pos === 1 ? 1 : 10);
  const scores = await board();
  const mine = scores.find(row => row.username === name);
  const theirs = scores.find(row => row.username === other);
  assert.equal(scores.filter(row => row.username === name).length, 1);
  assert.equal(mine.totalMs, 60);
  assert.equal(mine.fastestProblemMs, 1);
  assert.equal(replay.result.activeMs, 111);
  assert.equal(replay.leaderboardRank, mine.totalRank);
  assert.ok(theirs.totalRank < mine.totalRank && theirs.problemRank > mine.problemRank);
  assert.ok(!(await api({ action: "leaderboard", level: "review.add.2" })).data.some(row => row.username === other));
}
async function teacherChecks(name) {
  const ta = process.env.MENTALIST_TEST_TEACHER_A_TOKEN,
    tb = process.env.MENTALIST_TEST_TEACHER_B_TOKEN;
  if (!ta || !tb) return;
  const teach = (action, values = {}, token = ta, status = 200) =>
    api({ scope: "teacher", action, ...values }, status, token);
  const label = "Fixture " + randomUUID();
  const classes = (await teach("createClass", { name: label })).data,
    classId = classes.find((c) => c.name === label).id;
  await teach("enroll", { classId, username: name });
  const child = { classId, profile: student };
  await teach("assignment", { ...child, skill: "fraction.add" });
  for (const skill of ["review.fractions", "signed.add", "signed.subtract", "signed.multiply", "signed.divide"])
    await teach("placement", { ...child, skill });
  await teach("placement", { ...child, skill: "ratio.equivalent" });
  await teach("placement", { ...child, skill: "review.conversions" });
  await teach("timing", { ...child, multiplier: 1.5 });
  const st = await state();
  assert.equal(st.access.find((a) => a.id === "fraction.add.1").reason, "Teacher assignment");
  assert.equal(st.access.find((a) => a.id === "ratio.equivalent.1").state, "placed");
  assert.equal(st.access.find((a) => a.id === "percent.parts.1").state, "ready");
  let f = await start("fraction.add.1");
  const first = f.encounter.id;
  const { answer } = await key(f);
  const [n, d] = answer.split("/").map(Number);
  await api(event(f, "1/0"), 422);
  const unsimplified = event(f, 2 * n + "/" + 2 * d);
  const simp = (await api(unsimplified)).data;
  assert.equal(simp.outcome, "simplification");
  assert.equal(simp.run.hp, 100);
  assert.equal(simp.run.encounter.id, first);
  await api({ ...unsimplified, id: randomUUID() }, 409);
  f = (await api(event(simp.run, answer))).data.run;
  f = await solve(f);
  assert.equal(f.result.firstTry, 12);
  assert.equal(f.result.simplifications, 1);
  assert.equal(f.result.targetMs, 12 * 30 * 1000 * 1.5);
  const h = (await teach("run", { ...child, run: f.id })).data;
  assert.equal(h.positions.length, 12);
  assert.deepEqual(
    h.positions[0].events.map((e) => [e.outcome, e.attempt]),
    [
      ["simplification", null],
      ["correct", 1],
    ],
  );
  await teach("run", { ...child, run: f.id }, tb, 404);
  await teach("roster", { classId }, tb, 404);
  const coverage = (await teach("coverage", { classId })).data;
  assert.equal(coverage.published.length, 87);
  assert.ok(coverage.requirements.some((v) => v.levels.length === 0));
  console.log(
    "Passed two-teacher isolation, placement, timing snapshots, fraction revisions, and historical run inspection.",
  );
}
async function retryHistory() {
  let run = await start("review.multiply.8-9.1");
  const sets = [];
  const orders = [];
  for (let i = 0; i < 6; i++) {
    const row = (await db.query(`select r.set_id,r.policy->'positions' as slots,l.definition->'pool' as pool,s.positions,
      e.question from mentalist.runs r join mentalist.sets s on (s.version,s.id)=(r.version,r.set_id)
      join mentalist.levels l on (l.version,l.id)=(r.version,r.level)
      join mentalist.encounters e on e.run=r.id and e.position=1 where r.id=$1`, [run.id])).rows[0];
    const order = row.slots.map(slot => slot.q);
    orders.push([...order].sort().join(","));
    assert.equal(row.question, order[0]);
    assert.equal(new Set(order).size, 12);
    assert.ok(order.every(id => row.pool.some(slot => slot.q === id)));
    assert.deepEqual(row.slots.map(slot => slot.variant).sort(), row.positions.map(slot => slot.variant).sort());
    sets.push(row.set_id);
    if (i < 5) run = await start(run.level, run.id);
  }
  assert.equal(new Set(sets.slice(0, 5)).size, 5);
  assert.equal(sets[0], sets[5]);
  assert.ok(new Set(orders).size > 1);
  const encounter = run.encounter.id;
  const { answer } = await key(run);
  const wrong = answer.replace(/\d/, d => d === "9" ? "8" : "9");
  for (const raw of [wrong, wrong, answer]) run = (await api(event(run, raw))).data.run;
  const attempts = (
    await db.query("select raw,scored_number from mentalist.events where encounter=$1 order by ordinal", [
      encounter,
    ])
  ).rows;
  assert.deepEqual(
    attempts.map((a) => [a.raw, a.scored_number]),
    [
      [wrong, 1],
      [wrong, 2],
      [answer, 3],
    ],
  );
  assert.equal(run.hp, 50);
  if (run.status === "active") {
    const balance = (await state()).profile.coins;
    for (let i = 0; i < 2; i++) {
      const { answer } = await key(run);
      run = (
        await api(
          event(
            run,
            answer.replace(/\d/, (d) => (d === "9" ? "8" : "9")),
          ),
        )
      ).data.run;
    }
    assert.equal(run.status, "knockdown");
    assert.equal((await state()).profile.coins, balance);
  }
}
async function main() {
  await db.connect();
  await api({ action: "state" }, 401);
  await api({ action: "leaderboard", level: "review.add.1" }, 401);
  const name = "test_" + randomUUID().slice(0, 8);
  const login = await api({ action: "login", username: name, pin: "28", sprite: "raijin", create: true });
  assert.match(login.cookie, /HttpOnly/i);
  assert.match(login.cookie, /SameSite=Lax/i);
  assert.match(login.cookie, /Max-Age=2592000/i);
  cookie = login.cookie.split(";")[0];
  student = login.data.id;
  const session = (await db.query("select expires from mentalist.sessions where profile=$1", [student])).rows[0];
  assert.ok(new Date(session.expires).getTime() > Date.now() + 29 * 24 * 60 * 60 * 1000);
  assert.equal((await state()).access.length, 237);
  await api({ action: "start", id: randomUUID(), level: "signed.add.2" }, 403);
  await api({ action: "start", id: randomUUID(), level: "signed.add.1" }, 403);
  const initialPath = await state();
  assert.equal(initialPath.recommendation.level, "review.add.1");
  for (const skill of ["review.add", "review.subtract"]) {
    for (const level of [1, 2, 3]) await solve(await start(`${skill}.${level}`));
  }
  await checkLeaderboard(name);
  assert.equal((await state()).access.find((a) => a.id === "signed.add.1").state, "ready");
  let run = await start("signed.add.1"),
    first = run.id;
  const initialCoins = (await state()).profile.coins;
  const a = await key(run),
    request = event(run, a.answer);
  assert.equal(JSON.stringify(run).includes('"answer":'), false);
  const [left, right] = await Promise.all([api(request), api(request)]);
  assert.deepEqual(left.data, right.data);
  run = left.data.run;
  await api({ ...request, raw: "0" }, 409);
  assert.equal((await state()).profile.coins, initialCoins + 10);
  run = await solve(run, 3);
  assert.equal(run.result.firstTry, 9);
  assert.equal(run.result.passed, false);
  assert.equal((await state()).access.find((a) => a.id === "signed.add.2").state, "locked");
  run = await solve(await start("signed.add.1"), 2);
  assert.equal(run.result.firstTry, 10);
  assert.equal(run.result.stars, 1);
  assert.ok(run.result.passed);
  const s2 = await solve(await start("signed.add.2"));
  assert.ok(s2.result.passed);
  assert.ok((await state()).offer);
  const bonus = await start("review.multiply.8-9.1");
  assert.equal(bonus.bonus, true);
  assert.equal((await state()).offer, false);
  const perfect = await solve(bonus);
  assert.equal(perfect.bonusPaid, true);
  await solve(await start("signed.add.2"));
  assert.equal((await state()).offer, false);
  const normal = await start("review.multiply.8-9.1");
  assert.equal(normal.bonus, false);
  let knock = normal;
  for (let i = 0; i < 4; i++) {
    const { answer } = await key(knock);
    knock = (
      await api(
        event(
          knock,
          answer.replace(/\d/, (d) => (d === "9" ? "8" : "9")),
        ),
      )
    ).data.run;
  }
  assert.equal(knock.status, "knockdown");
  assert.equal(knock.result, null);
  const later = await start("review.multiply.8-9.1");
  assert.equal(later.encounter.position, 1);
  assert.equal(later.hp, 100);
  const replacement = await start(later.level, later.id);
  assert.notEqual(replacement.id, later.id);
  await api(event(later, "00"), 409);
  await api({ action: "leave", id: randomUUID(), run: replacement.id });
  const daily = (await state()).quests.find((q) => q.count >= q.goal);
  await api({ action: "quest", id: randomUUID(), value: daily.id });
  assert.ok((await state()).quests.find((q) => q.id === daily.id).claimed);
  const chest = (await state()).chests[0];
  await api({ action: "unlock", id: randomUUID(), value: chest.id });
  assert.ok((await state()).chests.find((c) => c.id === chest.id).ready);
  const record = (await db.query("select policy from mentalist.runs where id=$1", [first])).rows[0];
  assert.equal(record.policy.upgrade, 1);
  const c = (await state()).cards.find((c) => c.skill === "number");
  assert.ok(c.amount >= 40);
  await api({ action: "upgrade", value: "number", id: randomUUID() });
  assert.equal((await state()).cards.find((c) => c.skill === "multiplication").upgrade, 1);
  const shared = await start("signed.add.2");
  assert.equal((await db.query("select policy from mentalist.runs where id=$1", [shared.id])).rows[0].policy.upgrade, 2);
  await api({ action: "leave", id: randomUUID(), run: shared.id });
  const hist = (
    await db.query("select id,set_id from mentalist.runs where profile=$1 and level=$2 order by started", [
      student,
      "review.multiply.8-9.1",
    ])
  ).rows;
  assert.equal(new Set(hist.map((r) => r.set_id)).size, hist.length);
  const quarry = await api({ scope: "craft", action: "craftState" });
  assert.equal(quarry.data.energy, 20);
  assert.equal(quarry.data.job, null);
  await api({ scope: "craft", action: "mine", node: "iron-falls", id: randomUUID() }, 409);
  const mining = await api({ scope: "craft", action: "mine", node: "copper-ridge", id: randomUUID() });
  assert.equal(mining.data.energy, 16);
  assert.equal(mining.data.job.node, "copper-ridge");
  await api({ scope: "craft", action: "mine", node: "tin-hollow", id: randomUUID() }, 409);
  await db.query("update public.crafters_progress set mining_complete_at=now() where profile_id=$1", [student]);
  const collections = await Promise.all([api({ scope: "craft", action: "collect" }), api({ scope: "craft", action: "collect" })]);
  assert.deepEqual(collections.map(({data}) => data.inventory.copper), [1, 1]);
  await api({ scope: "craft", action: "craftTool", tool: "copper-pickaxe", id: randomUUID() }, 409);
  await db.query(
    `insert into public.crafters_inventory(profile_id,ore_id,ore_name,quantity)
     values($1,'copper','Copper Ore',3),($1,'tin','Tin Ore',1)
     on conflict(profile_id,ore_id) do update set quantity=crafters_inventory.quantity+excluded.quantity`,
    [student],
  );
  await api({ scope: "craft", action: "craftTool", tool: "copper-pickaxe", id: randomUUID() });
  await api({ scope: "craft", action: "equipPickaxe", tool: "copper-pickaxe", id: randomUUID() });
  const iron = await api({ scope: "craft", action: "mine", node: "iron-falls", id: randomUUID() });
  assert.equal(iron.data.energy, 12);
  const sword = await api({ scope: "craft", action: "craftTool", tool: "copper-sword", id: randomUUID() });
  assert.equal(sword.data.inventory.copper, 0);
  const equipped = await api({ action: "equipSword", value: "copper-sword", id: randomUUID() });
  assert.equal(equipped.data.equipment.equippedSword, "copper-sword");
  const armed = await start("signed.add.2");
  const armedDamage = (await db.query("select policy->'damage' as damage from mentalist.runs where id=$1", [armed.id])).rows[0].damage;
  const baseDamage = (await db.query("select policy->'damage' as damage from mentalist.runs where id=$1", [shared.id])).rows[0].damage;
  assert.deepEqual(armedDamage, baseDamage.map((damage) => damage + 3));
  await api({ action: "leave", id: randomUUID(), run: armed.id });
  await api({ action: "equipSword", value: "", id: randomUUID() });
  const denied = await db.query(
    "select has_table_privilege('anon','public.profiles','select') leak,has_schema_privilege('authenticated','mentalist','usage') bypass",
  );
  assert.deepEqual(denied.rows[0], { leak: false, bypass: false });
  await checkBatchPlay();
  await retryHistory();
  await teacherChecks(name);
  await api({ action: "logout" });
  await api({ action: "state" }, 401);
  console.log(
    "Passed local HTTP, transactions, progression, checkpoint, concurrency, economy, access and Crafters checks.",
  );
}
main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => db.end());
