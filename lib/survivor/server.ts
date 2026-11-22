import type { PoolClient } from "pg";
import { one, rows, type Identity } from "../mentalist/db";
import { curriculumVersion, skillById, sprites } from "../mentalist/model";
import { publishedLevelIds } from "../mentalist/student";
import { completedSurvivorLevels, type SurvivorPack, type SurvivorQuestion, type SurvivorTopic } from "./pack";

export async function survivorPack(db: PoolClient, who: Identity): Promise<SurvivorPack> {
  const { sprite_name } = await one<{ sprite_name: string }>(db,
    "select sprite_name from public.profiles where id=$1", [who.profile]);
  const sprite = sprites.includes(sprite_name) ? sprite_name : sprites[0];
  const published = await publishedLevelIds(db);
  const clears = await rows<{ level: string }>(db, "select level from clears where profile=$1", [who.profile]);
  const eligible = completedSurvivorLevels(published, clears.map(clear => clear.level));
  if (!eligible.length) return { sprite, topics: [] };

  const pack = await rows<SurvivorQuestion & { skill: string }>(db,
    `with eligible_ids as materialized (
       select distinct l.skill,p.slot->>'q' as id
       from sets s join levels l on (s.version,s.level)=(l.version,l.id)
       cross join lateral jsonb_array_elements(s.positions) p(slot)
       where s.version=$1 and s.level=any($2::text[])
     ), sampled as (
       select i.skill,q.id,q.definition->>'prompt' as prompt,q.definition->>'answer' as answer,
         row_number() over (partition by i.skill order by random()) as position
       from eligible_ids i join questions q on q.version=$1 and q.id=i.id
       where q.definition->'control'->>'kind' in ('whole','decimal','fraction')
         and q.definition->>'visual' is null
     )
     select skill,id,prompt,answer from sampled where position<=12 order by position,random()`,
    [curriculumVersion, eligible]);

  const topics = new Map<string, SurvivorTopic>();
  for (const { skill, ...question } of pack) {
    const topic = topics.get(skill) ?? { id: skill, title: skillById.get(skill)!.title, questions: [] };
    topic.questions.push(question);
    topics.set(skill, topic);
  }
  return { sprite, topics: [...topics.values()] };
}
