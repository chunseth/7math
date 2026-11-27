// Publish the checked-in, validated content to the explicitly configured database.
const { Client } = require("pg");
const { readFileSync } = require("node:fs");
const { gunzipSync } = require("node:zlib");
const { createHash } = require("node:crypto");
const { resolve } = require("node:path");
const { execFileSync } = require("node:child_process");
const root = resolve(__dirname, "../..");

async function publish() {
  if (!process.env.MENTALIST_DATABASE_URL)
    throw new Error("Set MENTALIST_DATABASE_URL to the target database.");
  const grade = process.argv.find(arg => arg.startsWith("--grade="))?.slice(8) ?? "7";
  if (!["6", "7", "8"].includes(grade)) throw new Error("Choose grade 6, 7, or 8.");
  execFileSync("python3", ["-B", resolve(__dirname, grade === "7" ? "build.py" : `../${grade}math/build.py`), "--check"], { stdio: "inherit" });
  const raw = gunzipSync(readFileSync(resolve(root, grade === "7" ? "content/mentalist/bank-v9.json.gz" : `content/${grade}math/bank.json.gz`)));
  const bank = JSON.parse(raw);
  const stage = process.argv.find((a) => a.startsWith("--stage="))?.slice(8);
  if (!["slice", "numeric", "complete"].includes(stage))
    throw new Error("Choose --stage=slice, --stage=numeric, or --stage=complete.");
  const reviewer = process.env.MENTALIST_CONTENT_REVIEWER?.trim();
  if (!reviewer || reviewer.length > 120)
    throw new Error(
      "Record the release reviewer in MENTALIST_CONTENT_REVIEWER before publishing reviewed sets.",
    );
  if (grade !== "7" && stage !== "complete") throw new Error(`Use --stage=complete for Grade ${grade}.`);
  const bySkill = new Map(bank.skills.map((skill) => [skill.id, skill]));
  const included = new Set();
  function include(id) {
    if (included.has(id)) return;
    const skill = bySkill.get(id);
    if (!skill) throw new Error(`Unknown prerequisite ${id}`);
    included.add(id);
    skill.prerequisites.forEach(include);
  }
  for (const skill of bank.skills) {
    if (
      stage === "complete" ||
      (stage === "slice"
        ? skill.id === "signed.add"
        : /^(signed[.]|decimal[.]|fraction[.]|review[.](multiply|divide)[.]|percent[.]parts$|algebra[.]equation$)/.test(skill.id))
    ) include(skill.id);
  }
  const selected = bank.levels.filter((level) => included.has(level.skill));
  const digest = createHash("sha256").update(raw).digest("hex");
  const client = new Client({ connectionString: process.env.MENTALIST_DATABASE_URL });
  await client.connect();
  try {
    await client.query("begin");
    await client.query("select pg_advisory_xact_lock(7211620)");
    const prev = await client.query("select digest from mentalist.releases where version=$1", [bank.version]);
    if (prev.rowCount && prev.rows[0].digest !== digest)
      throw new Error("Version already published with different content.");
    if (!prev.rowCount) {
      await client.query("insert into mentalist.releases(version,digest) values($1,$2)", [
        bank.version,
        digest,
      ]);
      const groups = [
        ["skills", bank.skills],
        ["levels", bank.levels],
        ["templates", bank.templates],
        ["questions", Object.entries(bank.questions).map(([id, q]) => ({ id, ...q }))],
        ["sets", bank.sets],
      ];
      for (const [table, rows] of groups) {
        const columns =
          table === "sets"
            ? "id,level,positions"
            : table === "levels"
              ? "id,skill,definition"
              : "id,definition";
        const values =
          table === "sets"
            ? "r->>'id',r->>'level',r->'positions'"
            : table === "levels"
              ? "r->>'id',r->>'skill',r"
              : "r->>'id',r";
        for (let i = 0; i < rows.length; i += 400) {
          await client.query(
            `insert into mentalist.${table}(version,${columns}) select $1,${values} from jsonb_array_elements($2) r`,
            [bank.version, JSON.stringify(rows.slice(i, i + 400))],
          );
        }
      }
      await client.query(
        "insert into mentalist.evidence(version,group_id,requirement,levels) select $1,r->>'group',r->>'requirement',r->'levels' from jsonb_array_elements($2) r",
        [bank.version, JSON.stringify(bank.coverage)],
      );
    }
    await client.query(
      "insert into mentalist.published_levels(version,level,reviewed_by) select $1,unnest($2::text[]),$3 on conflict do nothing",
      [bank.version, selected.map((l) => l.id), reviewer],
    );
    await client.query("commit");
    console.log("Curriculum version", bank.version, "verified in database.");
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    await client.end();
  }
}
publish().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
