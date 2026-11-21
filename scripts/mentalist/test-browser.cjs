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
      const published = (
        await db.query("select count(*)::int as count from mentalist.published_levels where version=1")
      ).rows[0].count;
      const stops = page.locator(".mt-node");
      assert.equal((await stops.count()) - (await page.locator(".mt-node.state-planned").count()), published);
      assert.ok((await page.locator(".mt-node.state-ready").count()) > 0);
    } finally {
      await guest.close();
    }
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true });
    const p = await ctx.newPage();
    p.setDefaultTimeout(10000);
    const errors = [];
    p.on("pageerror", (e) => errors.push(e.message));
    await p.goto(base + "/mentalist", { waitUntil: "domcontentloaded" });
    const node = p.getByRole("button", { name: "Addition, Facts/make ten, Ready to play", exact: true });
    await node.click();
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
    const ans = await key();
    await p.keyboard.type(ans.replace(/\d/, (d) => (d === "9" ? "8" : "9")));
    await p.getByText(/was incorrect/).waitFor();
    await p.keyboard.type(ans);
    await p.getByText("2 / 12", { exact: true }).waitFor();
    await p.getByRole("button", { name: "Leave battle", exact: true }).click();
    await p.locator("[role=dialog]").getByRole("button", { name: "Leave battle", exact: true }).click();
    await p.getByLabel("Jump to world").selectOption("review");
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
    await p
      .getByRole("button", { name: "Fraction addition, Like denominators, Teacher assignment", exact: true })
      .click();
    await p.getByRole("button", { name: "Play", exact: true }).click();
    await p.locator(".mt-keypad").waitFor();
    const expected = await key(),
      [top, bottom = 1] = expected.split("/").map(Number);
    let answers = 0;
    const sent = [];
    await p.route("**/api/mentalist", async (route) => {
      const b = route.request().postDataJSON();
      if (b.action === "answer") {
        answers++;
        sent.push(b.id);
        if (answers === 2) {
          await route.fetch();
          return route.abort("failed");
        }
      }
      await route.continue();
    });
    await p.keyboard.type(String(2 * top));
    await p.keyboard.press("/");
    await p.keyboard.type("0");
    await p.waitForTimeout(900);
    assert.equal(answers, 0);
    await p.keyboard.press("Backspace");
    await p.keyboard.type(String(2 * bottom));
    await p.waitForTimeout(250);
    assert.equal(answers, 0);
    await p.getByText("Equivalent fraction. Simplify your answer.").waitFor();
    await p.waitForTimeout(900);
    assert.equal(answers, 1);
    await p.getByRole("button", { name: "Numerator", exact: true }).first().click();
    await p.getByRole("button", { name: "Clear", exact: true }).click();
    await p.keyboard.type(String(top));
    await p.keyboard.press("/");
    await p.getByRole("button", { name: "Clear", exact: true }).click();
    await p.keyboard.type(String(bottom));
    await p.getByRole("button", { name: "Retry saving answer", exact: true }).click();
    await p.getByText("2 / 12", { exact: true }).waitFor();
    assert.equal(answers, 3);
    assert.equal(sent[1], sent[2]);
    await p.reload({ waitUntil: "domcontentloaded" });
    await p
      .getByRole("button", { name: "Fraction addition, Like denominators, In progress", exact: true })
      .click();
    await p.getByRole("button", { name: "Play", exact: true }).click();
    await p.getByText("1 / 12", { exact: true }).waitFor();
    console.log(
      "Fraction debounce, zero denominator, simplification, lost acknowledgement, same-ID retry and fresh set on reload passed.",
    );
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
