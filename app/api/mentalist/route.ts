import { NextRequest, NextResponse } from "next/server";
import {
  enabled,
  GameError,
  hash,
  identity,
  login,
  one,
  rows,
  studentCookie as cookie,
  transaction,
  uuid,
} from "../../../lib/mentalist/db";
import { start, submit } from "../../../lib/mentalist/battle";
import { leaderboard, publishedLevelIds, studentState } from "../../../lib/mentalist/student";
import { economy } from "../../../lib/mentalist/economy";
import { faculty, teacherUser } from "../../../lib/mentalist/teacher";
import { craft } from "../../../lib/mentalist/craft";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
function json(data: unknown, status = 200) {
  return NextResponse.json(data, { status, headers: { "Cache-Control": "private, no-store" } });
}
export async function POST(req: NextRequest) {
  if (!enabled()) return json({ error: "Curriculum is disabled." }, 404);
  const origin = req.headers.get("origin");
  if (origin) {
    let host;
    try {
      host = new URL(origin).host;
    } catch {
      return json({ error: "Invalid origin." }, 403);
    }
    if (host !== (req.headers.get("host") ?? req.nextUrl.host))
      return json({ error: "Invalid origin." }, 403);
  }
  try {
    if (!req.headers.get("content-type")?.startsWith("application/json"))
      throw new GameError("JSON required.", 415);
    const raw = await req.text();
    if (raw.length > 4096) throw new GameError("Request too large.", 413);
    let b;
    try {
      b = JSON.parse(raw);
    } catch {
      throw new GameError("Invalid request.");
    }
    if (!b || typeof b.action !== "string") throw new GameError("Specify an action.");
    if (b.action === "publicTrail") return json(await transaction(publishedLevelIds));
    if (b.action === "login") {
      const res = await transaction((db) =>
        login(db, String(b.username), String(b.pin), String(b.sprite), b.create === true),
      );
      if (!res.token) return json({ error: res.error }, res.status);
      const reply = json({ id: res.id });
      reply.cookies.set(cookie, res.token, {
        httpOnly: true,
        sameSite: "strict",
        secure: req.nextUrl.protocol === "https:" || process.env.NODE_ENV === "production",
        maxAge: 43200,
        path: "/",
      });
      return reply;
    }
    if (b.scope === "teacher") {
      const user = await teacherUser((req.headers.get("authorization") ?? "").replace(/^Bearer /, ""));
      return json(await transaction((db) => faculty(db, user, b)));
    }
    const result = await transaction(async (db) => {
      const who = await identity(db, req.cookies.get(cookie)?.value);
      if (b.action === "state") return studentState(db, who);
      if (b.action === "leaderboard") return leaderboard(db, b.level);
      if (b.action === "logout") {
        await db.query("update sessions set ended=now() where token=$1", [who.token]);
        await db.query(
          "update runs set ended=now(),status='interrupted' where profile=$1 and status='active' and session_token=$2",
          [who.profile, who.token],
        );
        return {};
      }
      if (b.scope === "craft") return craft(db, who, b);
      const id = uuid(b.id),
        digest = hash(raw);
      const [prior] = await rows(
        db,
        "select payload_hash,response from receipts where profile=$1 and id=$2",
        [who.profile, id],
      );
      if (prior) {
        if (prior.payload_hash !== digest) throw new GameError("Request identifier already used.", 409);
        console.info("Mentalist duplicate suppressed", { action: b.action });
        return prior.response;
      }
      let data;
      if (b.action === "start") data = await start(db, who, b.level, b.previous ?? null);
      else if (b.action === "answer")
        data = await submit(db, who, {
          id,
          raw: b.raw,
          run: b.run,
          encounter: b.encounter,
          elapsed: b.elapsed,
          revision: b.revision,
        });
      else {
        if (b.action === "class") {
          await one(db, "select class from roster where profile=$1 and class=$2", [
            who.profile,
            uuid(b.value),
          ]);
          await db.query("update sessions set selected_class=$1 where token=$2", [b.value, who.token]);
          who.classId = b.value;
        } else if (b.action === "leave") {
          await db.query(
            "update runs set status='interrupted',ended=now() where id=$1 and profile=$2 and status='active'",
            [uuid(b.run), who.profile],
          );
        } else await economy(db, who, b.action, b.value);
        data = await studentState(db, who);
      }
      await db.query("insert into receipts values($1,$2,$3,$4,$5)", [
        who.profile,
        id,
        b.action,
        digest,
        data,
      ]);
      return data;
    });
    const reply = json(result);
    if (b.action === "logout") reply.cookies.delete(cookie);
    return reply;
  } catch (err) {
    if (err instanceof GameError) return json({ error: err.message }, err.status);
    // Report the error class/code without credentials or raw student responses.
    console.error(
      "Mentalist request failed",
      err instanceof Error ? err.name : "Error",
      (err as { code?: string })?.code,
    );
    return json({ error: "Could not save or load this request. Retry when connected." }, 503);
  }
}
