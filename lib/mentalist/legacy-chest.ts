import type { PoolClient } from "pg";
import { one, rows } from "./db";

/** Resolve previously earned bundles under their original card rules. */
export async function legacyChest(db: PoolClient, profile: string, id: string) {
  const slot = await one(db, "select * from public.chest_slots where profile_id=$1 and id=$2 for update", [
    profile,
    id,
  ]);
  const rewards = await rows(
    db,
    "select * from public.chest_rewards where chest_id=$1 order by reward_order",
    [id],
  );
  let coins = 0;
  if (!rewards.length) {
    if (slot.reward_type === "coins") coins = slot.reward_coins ?? 0;
    if (slot.reward_type === "cards" || slot.reward_type === "number") {
      const n = slot.reward_number;
      await db.query(
        "insert into public.number_cards(profile_id,number,card_count) values($1,$2,$3) on conflict(profile_id,number) do update set card_count=least(999,number_cards.card_count+excluded.card_count)",
        [profile, n, slot.reward_card_count ?? 1],
      );
      if (slot.reward_type === "number") await addNumber(db, profile, n);
    }
  }
  for (const item of rewards.filter((r) => !r.claimed_at)) {
    if (item.reward_type === "coins") {
      coins += item.coin_amount;
      continue;
    }
    const exists =
      (
        await rows(db, "select 1 from public.skill_cards where profile_id=$1 and skill_id=$2", [
          profile,
          item.skill_id,
        ])
      ).length > 0;
    if (item.reward_type === "cards" && !exists) {
      coins += 150;
      continue;
    }
    if (item.reward_type === "unlock") {
      if (item.operation === "multiplication") {
        const n = Number(item.skill_id.split(".").at(-1));
        if (!Number.isInteger(n) || n < 0 || n > 12 || !(await addNumber(db, profile, n))) {
          coins += 250;
          continue;
        }
      } else if (exists) {
        coins += 250;
        continue;
      }
    }
    await db.query(
      `insert into public.skill_cards(profile_id,skill_id,operation,card_count) values($1,$2,$3,$4)
      on conflict(profile_id,skill_id) do update set card_count=least(999,skill_cards.card_count+excluded.card_count)`,
      [profile, item.skill_id, item.operation, item.card_amount ?? 0],
    );
  }
  await db.query(
    "update public.chest_rewards set claimed_at=now() where chest_id=$1 and claimed_at is null",
    [id],
  );
  await db.query("update public.chest_slots set state='opened',opened_at=now() where id=$1", [id]);
  return coins;
}
async function addNumber(db: PoolClient, profile: string, n: number) {
  await db.query("insert into public.student_progress(profile_id) values($1) on conflict do nothing", [
    profile,
  ]);
  return !!(
    await db.query(
      "update public.student_progress set unlocked_numbers=array_append(unlocked_numbers,$2) where profile_id=$1 and not ($2=any(unlocked_numbers)) returning profile_id",
      [profile, n],
    )
  ).rowCount;
}
