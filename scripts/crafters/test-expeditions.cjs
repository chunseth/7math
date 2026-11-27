const assert = require("node:assert/strict");
const { randomUUID } = require("node:crypto");
const { Client } = require("pg");

const origin = process.env.MENTALIST_TEST_ORIGIN;
const database = process.env.MENTALIST_DATABASE_URL;
const chrome = process.env.MENTALIST_TEST_CHROME;
if (!origin || !database || ![origin, database].every(value => ["localhost", "127.0.0.1"].includes(new URL(value).hostname))) {
  throw new Error("Use a disposable local PostgreSQL database and a local 7math server.");
}

const db = new Client({ connectionString: database });
const command = (action, fields = {}) => ({ scope: "mining", action, id: randomUUID(), ...fields });
const decision = (view, action, fields = {}) => command(action, {
  expedition: view.active.id, revision: view.active.revision, ...fields,
});
const balance = (view, ore) => view.inventory.find(item => item.id === ore)?.quantity ?? 0;

async function player() {
  let cookie = "";
  async function api(body, expected = 200) {
    const response = await fetch(new URL("/api/mentalist", origin), {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookie },
      body: JSON.stringify(body),
    });
    assert.match(response.headers.get("content-type") ?? "", /application\/json/, `Expected JSON for ${body.action} (HTTP ${response.status})`);
    const data = await response.json();
    assert.equal(response.status, expected, `${body.action}: ${data.error ?? response.status}`);
    if (response.headers.has("set-cookie")) cookie = response.headers.get("set-cookie").split(";")[0];
    return data;
  }
  const username = "mine_" + randomUUID().slice(0, 8);
  const { id } = await api({ action: "login", username, pin: "42", sprite: "phoenix", create: true });
  return { id, api, cookie };
}

function fixtureRock(type, durability, resource, quantity, explosion = false) {
  return { type, durability, remaining: durability, drop: { resource, quantity }, explosion };
}

async function fixture(profile, edits = {}) {
  // Force edge cases in the disposable database while sending all actions through the real API.
  const { rows: [{ state }] } = await db.query(
    "select state from mentalist.mining_expeditions where profile=$1 and status='active'", [profile]);
  const rock = fixtureRock("granite", 1, "stone", 3);
  Object.assign(state, edits);
  state.floor.rocks = [
    fixtureRock("copper-flecked", 2, "copper", 3, true),
    fixtureRock("copper-flecked", 2, "copper", 1),
    rock, rock, rock, rock,
  ];
  state.floor.stairSlot = edits.stairSlot ?? 0;
  delete state.stairSlot;
  if (edits.explosionAt) state.floor.rocks[edits.explosionAt] = { ...rock, explosion: true };
  delete state.explosionAt;
  await db.query("update mentalist.mining_expeditions set state=$2 where id=$1", [state.id, state]);
}

async function apiChecks() {
  const { id: profile, api } = await player();
  const state = () => api({ scope: "mining", action: "miningState" });
  await db.query(
    "insert into public.crafters_inventory(profile_id,ore_id,ore_name,quantity) values($1,'coal','Coal',7)", [profile]);
  const start = command("start", { previous: null });
  const [first, duplicateStart] = await Promise.all([api(start), api(start)]);
  assert.equal(first.active.id, duplicateStart.active.id);
  assert.equal(first.active.energy, 40);
  assert.equal(first.active.stairSlot, null);
  assert.ok(first.active.rocks.every(rock => !("drop" in rock) && !("explosion" in rock)));
  const firstId = first.active.id;
  await fixture(profile);

  const firstSwing = decision(first, "swing", { slot: 0 });
  const [partial, samePartial] = await Promise.all([api(firstSwing), api(firstSwing)]);
  assert.equal(partial.active.energy, 39);
  assert.equal(samePartial.active.energy, 39);
  assert.equal(samePartial.active.rocks[0].remaining, 1);
  await api({ ...firstSwing, id: randomUUID() }, 409);
  const switched = await api(decision(partial, "swing", { slot: 1 }));
  const resumed = await state();
  assert.deepEqual(resumed.active, switched.active);
  assert.deepEqual(resumed.active.rocks.slice(0, 2).map(rock => rock.remaining), [1, 1]);

  const revealed = await api(decision(resumed, "swing", { slot: 0 }));
  assert.deepEqual(revealed.swing, {
    floor: 1, slot: 0, remaining: 0, broken: true, drop: { resource: "copper", quantity: 3 },
    stairs: true, explosion: true,
  });
  assert.equal(revealed.active.energy, 32);
  assert.equal(revealed.active.stairSlot, 0);
  assert.equal(revealed.catalogue["copper-flecked"].hazards, 1);
  assert.deepEqual(revealed.catalogue["copper-flecked"].drops.copper, { hits: 1, units: 3 });
  await api(command("catalogue", { rock: "copper-flecked" }));
  assert.deepEqual((await state()).active, revealed.active);
  const continued = await api(decision(revealed, "swing", { slot: 2 }));
  const descended = await api(decision(continued, "descend"));
  assert.equal(descended.active.floor, 2);
  assert.equal(descended.active.energy, 28);
  assert.deepEqual(descended.active.collected, { copper: 3, stone: 3 });
  const returnHome = decision(descended, "return");
  const [returned, duplicateReturn] = await Promise.all([api(returnHome), api(returnHome)]);
  assert.equal(returned.active, null);
  assert.equal(returned.latest.outcome, "returned");
  assert.equal(returned.latest.energyRemaining, 28);
  assert.equal(balance(returned, "copper"), 3);
  assert.deepEqual(duplicateReturn.inventory, returned.inventory);
  await api({ ...returnHome, id: randomUUID() }, 409);

  const { rows: events } = await db.query(
    "select kind,details from mentalist.mining_events where expedition=$1 order by id", [firstId]);
  assert.deepEqual(events.map(event => event.kind), [
    "start", "swing", "swing", "swing", "catalogue", "swing", "descend", "return",
  ]);
  assert.equal(events[5].details.continuedAfterStairs, true);
  assert.equal(events[6].details.energyBefore, 31);
  assert.deepEqual(events[6].details.abandoned.map(rock => rock.slot), [1]);
  assert.equal(events[7].details.resourcesPerEnergy, 0.5);

  for (const [energy, explosion] of [[1, false], [5, true]]) {
    const before = await state();
    const started = await api(command("start", { previous: before.latest.id }));
    assert.equal(started.active.energy, 40);
    await fixture(profile, { energy, collected: { coal: 3, copper: 2, gem: 1 }, stairSlot: 5, explosionAt: explosion ? 5 : null });
    const passOut = decision(started, "swing", { slot: 5 });
    const [passedOut, replayed] = await Promise.all([api(passOut), api(passOut)]);
    assert.equal(passedOut.active, null);
    assert.equal(passedOut.latest.outcome, "passed_out");
    assert.equal(passedOut.latest.hazards, Number(explosion));
    assert.deepEqual(passedOut.latest.secured, { stone: 1, coal: 1, copper: 1 });
    assert.deepEqual(passedOut.latest.lost, { stone: 2, coal: 2, copper: 1, gem: 1 });
    assert.equal(balance(passedOut, "coal"), balance(before, "coal") + 1);
    assert.deepEqual(passedOut.inventory, replayed.inventory);
  }
  const last = await state();
  assert.deepEqual(last.stats, { deepestFloor: 2, expeditions: 3, returned: 1, passedOut: 2 });
  assert.deepEqual(last.catalogue.granite.drops.stone, { hits: 3, units: 9 });
  console.log("Crafters HTTP, concurrency, settlement, catalogue, and analytics checks passed.");
}

async function browserChecks() {
  const { chromium } = require("playwright-core");
  const { id, api, cookie } = await player();
  await api(command("start", { previous: null }));
  await fixture(id);
  const browser = await chromium.launch({ executablePath: chrome, headless: true, args: ["--no-sandbox", "--disable-gpu"] });
  try {
    const context = await browser.newContext({ viewport: { width: 320, height: 650 }, isMobile: true, hasTouch: true });
    await context.addCookies([{ url: origin, name: "mentalist_session", value: cookie.slice(cookie.indexOf("=") + 1) }]);
    const page = await context.newPage();
    page.setDefaultTimeout(10_000);
    const exceptions = [];
    page.on("pageerror", error => exceptions.push(error.message));
    await page.goto(new URL("/crafters", origin).href);
    const arena = page.getByRole("region", { name: "Floor 1" });
    const energy = page.getByRole("progressbar", { name: "Energy" });
    const unbroken = arena.getByRole("button", { name: /Copper-flecked rock, 2 of 2 swings left/i }).first();
    const partial = arena.getByRole("button", { name: /Copper-flecked rock, 1 of 2 swings left/i });
    let interrupted = false;
    await page.route("**/api/mentalist", async route => {
      if (!interrupted && route.request().postDataJSON().action === "swing") {
        interrupted = true;
        const result = await route.fetch();
        assert.equal(result.status(), 200);
        await route.abort();
      } else await route.continue();
    });
    await unbroken.click();
    await page.getByRole("button", { name: "Retry", exact: true }).click();
    await partial.waitFor();
    assert.equal(await partial.locator(".mine-durability [data-filled=true]").count(), 1);
    assert.equal(await energy.getAttribute("aria-valuenow"), "39");
    await page.reload();
    await partial.click();
    await arena.getByRole("img", { name: "Staircase discovered" }).waitFor();
    assert.equal(await energy.getAttribute("aria-valuenow"), "33");
    await page.getByRole("button", { name: "Rock Catalogue" }).click();
    const catalogue = page.getByRole("dialog", { name: "Rock Catalogue" });
    await catalogue.getByText("Copper-flecked rock", { exact: true }).click();
    await catalogue.getByText("Drop history · 1 rock mined", { exact: true }).waitFor();
    assert.equal(await catalogue.getByRole("columnheader", { name: "Observed" }).count(), 0);
    await catalogue.getByRole("button", { name: "Close" }).click();
    await page.getByRole("button", { name: /Descend/ }).click();
    await page.getByRole("heading", { name: "Floor 2" }).waitFor();
    assert.equal(await energy.getAttribute("aria-valuenow"), "30");
    const bounds = await page.locator(".mine-grid").evaluate(grid => {
      const rect = grid.getBoundingClientRect();
      return { left: rect.left, right: rect.right, columns: getComputedStyle(grid).gridTemplateColumns.split(" ").length };
    });
    assert.ok(bounds.left >= 0 && bounds.right <= 320 && bounds.columns === 3, JSON.stringify(bounds));
    await page.getByRole("button", { name: "Return Home" }).click();
    await page.getByRole("heading", { name: "Back at camp" }).waitFor();
    await page.getByRole("button", { name: "Camp", exact: true }).click();
    await page.getByRole("heading", { name: "Permanent Inventory" }).waitFor();
    assert.match(await page.getByRole("region", { name: "Permanent Inventory" }).innerText(), /Copper\s+3/);
    if (process.env.CRAFTERS_TEST_SCREENSHOT) {
      await page.getByRole("button", { name: "Start Expedition" }).click();
      await page.getByRole("heading", { name: "Floor 1" }).waitFor();
      await page.screenshot({ path: process.env.CRAFTERS_TEST_SCREENSHOT });
    }
    assert.deepEqual(exceptions, []);
    console.log("Crafters mobile browser, resume, catalogue, descent, and inventory checks passed.");
  } finally {
    await browser.close();
  }
}

(async () => {
  await db.connect();
  try {
    await apiChecks();
    if (chrome) await browserChecks();
  } finally {
    await db.end();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
