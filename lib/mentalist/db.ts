import { Pool, type PoolClient } from "pg";
import { createHash, randomBytes } from "node:crypto";
import { sprites } from "./model";

export class GameError extends Error {
  constructor(
    message: string,
    readonly status = 400,
  ) {
    super(message);
  }
}
export const studentCookie = "mentalist_session";
export const studentSessionMaxAge = 30 * 24 * 60 * 60;
export const enabled = () => process.env.MENTALIST_CURRICULUM === "1";
let pool: Pool | undefined;
export async function transaction<T>(fn: (db: PoolClient) => Promise<T>): Promise<T> {
  if (!process.env.MENTALIST_DATABASE_URL) throw new GameError("Curriculum database is unavailable.", 503);
  pool ??= new Pool({
    connectionString: process.env.MENTALIST_DATABASE_URL,
    max: 5,
    connectionTimeoutMillis: 5000,
  });
  const db = await pool.connect();
  try {
    await db.query("begin");
    await db.query("set local search_path=mentalist,public,extensions");
    const result = await fn(db);
    await db.query("commit");
    return result;
  } catch (e) {
    await db.query("rollback");
    throw e;
  } finally {
    db.release();
  }
}
export const hash = (value: string) => createHash("sha256").update(value).digest("hex");
export function uuid(value: unknown): string {
  if (
    typeof value !== "string" ||
    !/^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i.test(value)
  )
    throw new GameError("Invalid request identifier.");
  return value;
}
export async function rows<T = Record<string, any>>(
  db: PoolClient,
  sql: string,
  args: unknown[] = [],
): Promise<T[]> {
  return (await db.query(sql, args)).rows as T[];
}
export async function one<T = Record<string, any>>(
  db: PoolClient,
  sql: string,
  args: unknown[] = [],
): Promise<T> {
  const row = (await rows<T>(db, sql, args))[0];
  if (!row) throw new GameError("This record is unavailable.", 404);
  return row;
}
export type Identity = { profile: string; token: string; classId: string | null };
export async function identity(db: PoolClient, cookie: string | undefined): Promise<Identity> {
  if (!cookie) throw new GameError("Sign in to play.", 401);
  const token = hash(cookie);
  const [session] = await rows(
    db,
    "select profile,selected_class from sessions where token=$1 and ended is null and expires>now()",
    [token],
  );
  if (!session) throw new GameError("Sign in to play.", 401);
  // Serialize every student operation, including starts from competing tabs.
  await db.query("select id from public.profiles where id=$1 for update", [session.profile]);
  const live = await rows(
    db,
    "select token from sessions where token=$1 and ended is null and expires>now()",
    [token],
  );
  if (!live.length) throw new GameError("Sign in to play.", 401);
  const [membership] = await rows(
    db,
    "select class from roster where profile=$1 order by (class=$2) desc nulls last,class limit 1",
    [session.profile, session.selected_class],
  );
  return { profile: session.profile, token, classId: membership?.class ?? null };
}
export async function login(db: PoolClient, username: string, pin: string, sprite: string, create: boolean) {
  const name = username.trim().toLowerCase();
  if (!/^[a-z0-9_]{3,16}$/.test(name) || !/^\d{2}$/.test(pin))
    throw new GameError("Use a 3–16 character username and a two-digit PIN.");
  const limit = await one(
    db,
    `insert into login_limits values($1,now(),1) on conflict(name) do update set
    since=case when login_limits.since<now()-interval '15 minutes' then now() else login_limits.since end,
    attempts=case when login_limits.since<now()-interval '15 minutes' then 1 else login_limits.attempts+1 end returning attempts`,
    [name],
  );
  if (limit.attempts > 8) return { error: "Too many attempts. Try again in 15 minutes.", status: 429 };
  let [profile] = await rows(
    db,
    `select p.id,c.pin_hash=crypt($2,c.pin_hash) as valid from public.profiles p left join credentials c on c.profile=p.id where p.username=$1`,
    [name, pin],
  );
  if (!profile && create && sprites.includes(sprite)) {
    profile = await one(
      db,
      "insert into public.profiles(username,display_name,sprite_name) values($1,$1,$2) returning id",
      [name, sprite],
    );
    await db.query("insert into credentials values($1,crypt($2,gen_salt('bf',10)))", [profile.id, pin]);
  } else if (!profile?.valid) return { error: "Username or PIN is incorrect.", status: 401 };
  await db.query(
    "insert into owned_sprites(profile,sprite) select id,sprite_name from public.profiles where id=$1 on conflict do nothing",
    [profile.id],
  );
  const token = randomBytes(32).toString("hex");
  await db.query("delete from login_limits where name=$1", [name]);
  await db.query("insert into sessions(token,profile,expires) values($1,$2,now()+$3 * interval '1 second')", [
    hash(token),
    profile.id,
    studentSessionMaxAge,
  ]);
  return { token, id: profile.id };
}
