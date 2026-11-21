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
async function solve(run, misses = 0) {
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
    run = (await api(event(run, answer))).data.run;
  }
  return run;
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
  assert.equal(coverage.published.length, 100);
  assert.ok(coverage.requirements.some((v) => v.levels.length === 0));
  console.log(
    "Passed two-teacher isolation, placement, timing snapshots, fraction revisions, and historical run inspection.",
  );
}
async function retryHistory() {
  let run = await start("review.multiply.9.1");
  const sets = [];
  for (let i = 0; i < 6; i++) {
    const row = (await db.query("select set_id from mentalist.runs where id=$1", [run.id])).rows[0];
    sets.push(row.set_id);
    if (i < 5) run = await start(run.level, run.id);
  }
  assert.equal(new Set(sets.slice(0, 5)).size, 5);
  assert.equal(sets[0], sets[5]);
  const hasSeven = async (id) =>
    (
      await db.query(
        "select exists(select from mentalist.runs r join mentalist.sets s on (s.version,s.id)=(r.version,r.set_id) cross join lateral jsonb_array_elements(s.positions) p where r.id=$1 and p->>'q'='fact.multiply.9.7') as ok",
        [id],
      )
    ).rows[0].ok;
  if (!(await hasSeven(run.id))) run = await start(run.level, run.id);
  while (run.encounter.question.prompt !== "9 × 7")
    run = (await api(event(run, (await key(run)).answer))).data.run;
  const encounter = run.encounter.id;
  for (const raw of ["54", "62", "63"]) run = (await api(event(run, raw))).data.run;
  const attempts = (
    await db.query("select raw,scored_number from mentalist.events where encounter=$1 order by ordinal", [
      encounter,
    ])
  ).rows;
  assert.deepEqual(
    attempts.map((a) => [a.raw, a.scored_number]),
    [
      ["54", 1],
      ["62", 2],
      ["63", 3],
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
  const name = "test_" + randomUUID().slice(0, 8);
  const login = await api({ action: "login", username: name, pin: "28", sprite: "raijin", create: true });
  assert.match(login.cookie, /HttpOnly/i);
  cookie = login.cookie.split(";")[0];
  student = login.data.id;
  assert.equal((await state()).access.length, 250);
  await api({ action: "start", id: randomUUID(), level: "signed.add.2" }, 403);
  await api({ action: "start", id: randomUUID(), level: "signed.add.1" }, 403);
  const initialPath = await state();
  assert.equal(initialPath.recommendation.level, "review.add.1");
  for (const skill of ["review.add", "review.subtract"]) {
    for (const level of [1, 2, 3]) await solve(await start(`${skill}.${level}`));
  }
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
  assert.ok(run.result.passed);
  const s2 = await solve(await start("signed.add.2"));
  assert.ok(s2.result.passed);
  assert.ok((await state()).offer);
  const bonus = await start("review.multiply.9.1");
  assert.equal(bonus.bonus, true);
  assert.equal((await state()).offer, false);
  const perfect = await solve(bonus);
  assert.equal(perfect.bonusPaid, true);
  await solve(await start("signed.add.2"));
  assert.equal((await state()).offer, false);
  const normal = await start("review.multiply.9.1");
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
  const later = await start("review.multiply.9.1");
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
  const c = (await state()).cards.find((c) => c.skill === "signed.add");
  assert.ok(c.amount >= 40);
  await api({ action: "upgrade", value: "signed.add", id: randomUUID() });
  assert.equal((await state()).cards.find((c) => c.skill === "review.multiply.9").upgrade, 1);
  const hist = (
    await db.query("select id,set_id from mentalist.runs where profile=$1 and level=$2 order by started", [
      student,
      "review.multiply.9.1",
    ])
  ).rows;
  assert.equal(new Set(hist.map((r) => r.set_id)).size, hist.length);
  const a2 = await api({ scope: "craft", action: "craftState" });
  assert.equal(a2.data.progress.profile_id, student);
  await api({ scope: "craft", action: "mine", node: "copper-ridge" });
  await api({ scope: "craft", action: "mine", node: "iron-falls" }, 400);
  const denied = await db.query(
    "select has_table_privilege('anon','public.profiles','select') leak,has_schema_privilege('authenticated','mentalist','usage') bypass",
  );
  assert.deepEqual(denied.rows[0], { leak: false, bypass: false });
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
