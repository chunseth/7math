import type { PoolClient } from "pg";
import { legacyChest } from "./legacy-chest";
import { credit } from "./battle";
import { GameError, one, rows, uuid, type Identity } from "./db";
import { cardTitles, cardTopic, currentSkill, playable, skillById, levelById, sprites } from "./model";
import { course, quests, studentState } from "./student";
import { equipTool } from "./craft";

export async function economy(db: PoolClient, who: Identity, act: string, arg: string) {
  const p = who.profile;
  if (act === "equipSword") return equipTool(db, p, "sword", arg);
  const { coins } = await one(db, "select coins from public.profiles where id=$1", [p]);
  if (act === "upgrade") {
    if (skillById.has(currentSkill(arg))) arg = cardTopic(arg);
    const card = await one(db, "select amount,upgrade from cards where profile=$1 and skill=$2", [p, arg]);
    if (!Object.hasOwn(cardTitles, arg) || card.amount < 40 || coins < 2000 || card.upgrade >= 4)
      throw new GameError("Upgrade requires 40 cards and 2,000 coins, up to level 4.");
    await db.query("update cards set amount=amount-40,upgrade=upgrade+1 where profile=$1 and skill=$2", [
      p,
      arg,
    ]);
    await credit(db, p, `upgrade.${arg}.${card.upgrade + 1}`, arg, -2000, 0, 0);
    await db.query("update ledger set cards=-40 where profile=$1 and source=$2", [
      p,
      `upgrade.${arg}.${card.upgrade + 1}`,
    ]);
  } else if (act === "quest") {
    const q = (await quests(db, who)).find((q) => q.id === arg);
    if (!q || q.claimed || q.count < q.goal) throw new GameError("That quest is unavailable.");
    await credit(db, p, q.id, null, q.coins, 0, 0);
  } else if (["unlock", "queue", "open", "instant"].includes(act)) {
    const chest = await one(db, "select * from chests where id=$1 and profile=$2 and opened is null", [
      uuid(arg),
      p,
    ]);
    const ready = chest.ready && new Date(chest.ready).getTime() <= Date.now();
    if (act === "unlock" || act === "queue") {
      const { last } = await one(
        db,
        "select max(ready) last from chests where profile=$1 and opened is null and ready>now()",
        [p],
      );
      if (chest.ready || (act === "unlock" && last) || (act === "queue" && (!last || coins < 1000)))
        throw new GameError("This chest cannot start unlocking yet.");
      if (act === "queue") await credit(db, p, "queue." + arg, null, -1000, 0, 0);
      await db.query(
        "update chests set ready=greatest(now(),$2::timestamptz)+interval '2 hours' where id=$1",
        [chest.id, last],
      );
    } else {
      const cost = ready ? 0 : 6000;
      if (!ready && (act !== "instant" || coins < cost)) throw new GameError("The chest is still locked.");
      if (chest.legacy_slot) {
        const coins = await legacyChest(db, p, chest.legacy_slot);
        await credit(db, p, "chest." + arg, null, coins - cost, 0, 0);
        await db.query("update chests set opened=now() where id=$1", [arg]);
        return;
      }
      const data = await course(db, who);
      const available = data.access.filter(playable).map((a) => levelById.get(a.id)!.skill);
      const cardSkill = available.includes(currentSkill(chest.skill)) ? currentSkill(chest.skill) : available[0];
      const giveCard = chest.reward === "cards" && !!cardSkill;
      await credit(
        db,
        p,
        "chest." + arg,
        giveCard ? cardSkill : null,
        (giveCard ? 0 : 100) - cost,
        0,
        giveCard ? 10 : 0,
      );
      await db.query("update chests set opened=now() where id=$1", [arg]);
    }
  } else if (act === "appearance") {
    const state = await studentState(db, who);
    if (arg === "Trail Scholar" && state.clearedSkills >= 1)
      await db.query(
        "insert into appearance(profile,title) values($1,$2) on conflict(profile) do update set title=excluded.title",
        [p, arg],
      );
    else if (arg === "Gold" && state.clearedSkills >= 3)
      await db.query(
        "insert into appearance(profile,frame) values($1,$2) on conflict(profile) do update set frame=excluded.frame",
        [p, arg],
      );
    else if (
      sprites.includes(arg) &&
      (state.ownedSprites.includes(arg) || sprites.indexOf(arg) < 1 + state.clearedSkills * 3)
    ) {
      await db.query("insert into owned_sprites(profile,sprite) values($1,$2) on conflict do nothing", [
        p,
        arg,
      ]);
      await db.query("update public.profiles set sprite_name=$2 where id=$1", [p, arg]);
    } else throw new GameError("This collection milestone is still locked.");
  } else throw new GameError("Unknown collection action.");
}
