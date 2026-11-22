const { chromium } = require("playwright-core");
const { Client } = require("pg");
const assert = require("node:assert/strict");
const base = process.env.MENTALIST_TEST_ORIGIN,
  url = process.env.MENTALIST_DATABASE_URL;
if (!base || !url || ![base, url].every((u) => ["127.0.0.1", "localhost"].includes(new URL(u).hostname)))
  throw Error("Use a disposable local database and local app origin.");
(async () => {
  const browser = await chromium.launch({
    executablePath: process.env.MENTALIST_TEST_CHROME,
    headless: true,
    args: ["--no-sandbox", "--disable-gpu"],
  });
  const db = new Client({ connectionString: url });
  await db.connect();
  try {
    // Check the document itself so a successful hydration cannot mask incorrect initial labels.
    const guest = await browser.newContext({ javaScriptEnabled: false });
    try {
      const page = await guest.newPage();
      await page.goto(base + "/mentalist", { waitUntil: "domcontentloaded" });
      const map = page.getByRole("region", { name: "Curriculum map" });
      assert.equal(await map.locator("li").count(), 237);
      assert.equal(await map.getByRole("button").count(), 1);
      assert.equal(await map.locator('[aria-current="step"]').count(), 1);
    } finally {
      await guest.close();
    }
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true });
    const p = await ctx.newPage();
    p.setDefaultTimeout(10000);
    const errors = [];
    p.on("pageerror", (e) => errors.push(e.message));
    const actions = [];
    p.on("request", r => { if (r.url().endsWith("/api/mentalist")) actions.push(r.postDataJSON().action); });
    await p.goto(base + "/mentalist", { waitUntil: "domcontentloaded" });
    await p.getByRole("region", { name: "Curriculum map" }).locator('[aria-current="step"]').click();
    await p.getByRole("button", { name: "Play", exact: true }).click();
    await p.getByRole("button", { name: "Create a player", exact: true }).click();
    const name = "ui_" + Date.now().toString(36);
    await p.getByLabel("Username", { exact: true }).fill(name);
    await p.getByLabel("Two-digit PIN").fill("57");
    await p.getByRole("button", { name: "Create player", exact: true }).click();
    await p.getByRole("button", { name: "Play", exact: true }).click();
    await p.locator(".mt-keypad").waitFor();
    const key = async () => {
      const r = await db.query(
        "select e.snapshot->>'answer' as answer from mentalist.encounters e join mentalist.runs r on r.id=e.run join public.profiles p on p.id=r.profile where p.username=$1 and r.status='active' and e.resolved is null",
        [name],
      );
      return r.rows[0].answer;
    };
    assert.ok(actions.includes("prepareLevel"));
    const onStart = actions.length;
    const ans = await key();
    await p.keyboard.type(ans.replace(/\d/, (d) => (d === "9" ? "8" : "9")));
    await p.getByText(/was incorrect/).waitFor();
    await p.keyboard.type(ans);
    await p.getByText("2 / 12", { exact: true }).waitFor();
    assert.deepEqual(actions.slice(onStart), []);
    await p.getByRole("button", { name: "Leave battle", exact: true }).click();
    await p.locator("[role=dialog]").getByRole("button", { name: "Leave battle", exact: true }).click();
    assert.equal(await p.getByLabel("Jump to lesson").count(), 0);
    await p.getByRole("button", { name: "Rewards", exact: true }).click();
    await p.getByText("Chest slots", { exact: true }).waitFor();
    await p.getByRole("button", { name: "Collection", exact: true }).click();
    await p.getByText("Level 1 · 1 card").waitFor();
    await p.getByRole("button", { name: "Map", exact: true }).click();
    // Assign a fractional level to this local student so the browser exercises
    // incomplete edits, debounce, simplification, and a lost acknowledgement.
    const t = (await db.query("select id from public.teachers order by email limit 1")).rows[0].id;
    const c = (
      await db.query(
        "insert into mentalist.classes(teacher,name) values($1,'Browser fixture') returning id",
        [t],
      )
    ).rows[0].id;
    const profile = (await db.query("select id from public.profiles where username=$1", [name])).rows[0].id;
    await db.query("insert into mentalist.roster(class,profile) values($1,$2)", [c, profile]);
    await db.query(
      "insert into mentalist.decisions(class,profile,skill,teacher,kind) values($1,$2,'fraction.add',$3,'assignment')",
      [c, profile, t],
    );
    await db.query(
      "insert into mentalist.decisions(class,profile,skill,teacher,kind) select $1,$2,unnest($3::text[]),$4,'placement'",
      [c, profile, ["review.fractions", "signed.add", "signed.subtract", "signed.multiply", "signed.divide"], t],
    );
    await p.reload({ waitUntil: "domcontentloaded" });
    await p.getByRole("button", { name: "More Topics", exact: true }).click();
    await p.locator('.mp-card[aria-label="Fraction addition"]').first().scrollIntoViewIfNeeded();
    await p.getByRole("article", { name: "Fraction addition", exact: true })
      .getByRole("button", { name: "Try it" }).click();
    await p.getByRole("button", { name: "Play", exact: true }).click();
    await p.locator(".mt-keypad").waitFor();
    const expected = await key(),
      [top, bottom = 1] = expected.split("/").map(Number);
    const afterStart = actions.length;
    await p.keyboard.type(String(2 * top));
    await p.keyboard.press("/");
    await p.keyboard.type("0");
    await p.waitForTimeout(900);
    assert.equal(await p.getByRole("button", {name:"Check answer"}).isDisabled(), true);
    await p.keyboard.press("Backspace");
    await p.keyboard.type(String(2 * bottom));
    await p.getByText("Equivalent fraction. Simplify your answer.").waitFor();
    await p.getByRole("button", { name: "Numerator", exact: true }).first().click();
    await p.getByRole("button", { name: "Clear", exact: true }).click();
    await p.keyboard.type(String(top));
    await p.keyboard.press("/");
    await p.getByRole("button", { name: "Clear", exact: true }).click();
    await p.keyboard.type(String(bottom));
    await p.getByRole("button", {name:"Check answer"}).click();
    await p.getByText("2 / 12", { exact: true }).waitFor();
    assert.deepEqual(actions.slice(afterStart), []);
    await p.reload({waitUntil:"domcontentloaded"});
    await p.getByText("2 / 12", {exact:true}).waitFor();
    const saves = [];
    await p.route("**/api/mentalist", async route => {
      const body = route.request().postDataJSON();
      if (body.action === "saveBattle") {
        saves.push(body);
        if (saves.length === 1) {
          await route.fetch();
          return route.abort("failed");
        }
      }
      await route.continue();
    });
    await p.getByRole("button", { name: "Leave battle", exact: true }).click();
    await p.getByRole("dialog").getByRole("button", { name: "Leave battle", exact: true }).click();
    await p.getByRole("button", { name: "Retry saving level" }).click();
    await p.getByRole("region", { name: "Curriculum map" }).waitFor();
    assert.equal(saves.length, 2);
    assert.deepEqual(saves[0], saves[1]);
    assert.equal(saves[0].attempts.length, 2);
    await p.getByRole("region", {name:"Curriculum map"}).locator('[aria-current="step"]').click();
    await p.getByRole("button", {name:"Play", exact:true}).click();
    await p.getByText("1 / 12", {exact:true}).waitFor();
    const full = await db.query(`select q.definition->>'answer' as answer
      from mentalist.runs r join public.profiles pr on pr.id=r.profile
      cross join lateral jsonb_array_elements(r.policy->'positions') with ordinality p(slot,n)
      join mentalist.questions q on q.id=p.slot->>'q' and q.version=r.version
      where pr.username=$1 and r.status='active' order by p.n`, [name]);
    const offlineStart = actions.length;
    await ctx.setOffline(true);
    for (const [i, slot] of full.rows.entries()) {
      await p.getByText((i+1) + " / 12", {exact:true}).waitFor();
      await p.keyboard.type(slot.answer);
    }
    await p.getByText("Your answers will sync when you reconnect.").waitFor();
    assert.deepEqual(actions.slice(offlineStart), []);
    await ctx.setOffline(false);
    await p.getByRole("heading", {name:"Level cleared"}).waitFor();
    await p.getByText("Your rank by best total time").waitFor();
    assert.deepEqual(actions.slice(offlineStart), ["saveBattle"]);
    console.log("Verified zero answer requests, local fraction grading, reload recovery and idempotent batch retry.");
    assert.equal(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    assert.deepEqual(errors, []);
    console.log("Mobile map, signup, keypad, miss, advance, exit, world jump, menus and viewport passed.");
  } finally {
    await browser.close();
    await db.end();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
