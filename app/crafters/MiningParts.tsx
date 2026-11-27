import Link from "next/link";
import { useEffect, useRef } from "react";
import { miningResources, miningRules, resourceIds, rockTypes, type RockId } from "../../lib/crafters/config";
import type { MiningView } from "../../lib/crafters/expedition";
import { atlas, coreRockArt, type RockAppearance, type RockFrame } from "../../lib/crafters/rock-art";
import { ResourceSprite, RockSprite } from "./rocks/RockSprite";

export function RockArt({ type, appearance, frame = 0, locked = false, animate = false }: {
  type: RockId; appearance?: RockAppearance; frame?: RockFrame; locked?: boolean; animate?: boolean;
}) {
  const design = appearance ?? { family: coreRockArt[type], variant: 0 };
  return (
    <span className="mine-rock-art" data-locked={locked} data-shimmer={animate && design.family === "crystal"} aria-hidden="true">
      <RockSprite appearance={design} frame={frame} />
    </span>
  );
}

export function ResourceIcon({ id }: { id: string }) {
  const material = resourceIds.find(resource => resource === id);
  if (material) return <ResourceSprite resource={material} className="mine-resource-icon" />;
  return <img className="mine-resource-icon" src={`/crafters/${id}.png`} width={24} height={24} alt="" />;
}

export function Catalogue({ history, close, viewRock }: {
  history: MiningView["catalogue"];
  close: () => void;
  viewRock: (id: RockId) => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const node = dialog.current;
    if (!node) return;
    if (!node.open) node.showModal();
    return () => node.close();
  }, []);

  return (
    <dialog className="mine-catalogue" ref={dialog} aria-labelledby="mine-catalogue-title" onCancel={event => {
      event.preventDefault();
      close();
    }}>
      <header>
        <div>
          <h2 id="mine-catalogue-title">Rock Catalogue</h2>
          <p>{rockTypes.filter(rock => history[rock.id]).length} / {rockTypes.length} discovered</p>
        </div>
        <button type="button" className="mine-button mine-secondary" onClick={close} autoFocus>Close</button>
      </header>
      <div className="mine-catalogue-list">
        {rockTypes.map(rock => {
          const stats = history[rock.id];
          if (!stats) return (
            <div className="mine-locked-entry" key={rock.id}>
              <RockArt type={rock.id} locked />
              <span>Undiscovered rock</span>
            </div>
          );
          const showObserved = stats.mined >= miningRules.observedSampleSize;
          return (
            <details key={rock.id} onToggle={event => { if (event.currentTarget.open) viewRock(rock.id); }}>
              <summary>
                <RockArt type={rock.id} />
                <span><strong>{rock.name}</strong><small>{stats.mined} mined</small></span>
              </summary>
              <div className="mine-catalogue-info">
                <p>{atlas.families[coreRockArt[rock.id]].cue}</p>
                <dl>
                  <div><dt>Base durability</dt><dd>{rock.durability}</dd></div>
                  <div><dt>Floors</dt><dd>{rock.lastFloor === null ? `${rock.firstFloor}+` : `${rock.firstFloor}–${rock.lastFloor}`}</dd></div>
                  <div><dt>Base explosion chance</dt><dd>{Math.round(rock.explosion * 100)}%</dd></div>
                  <div><dt>Explosions encountered</dt><dd>{stats.hazards}</dd></div>
                </dl>
                <table>
                  <caption>Drop history · {stats.mined} {stats.mined === 1 ? "rock" : "rocks"} mined</caption>
                  <thead><tr>
                    <th scope="col">Resource</th><th scope="col">Chance</th><th scope="col">Yield</th><th scope="col">Found</th>
                    {showObserved && <th scope="col">Observed</th>}
                  </tr></thead>
                  <tbody>
                    {resourceIds.map(id => {
                      const { name, min, max } = miningResources[id];
                      const drop = stats.drops[id];
                      return <tr key={id}>
                        <th scope="row">{name}</th><td>{rock.drops[id]}%</td>
                        <td>{rock.drops[id] ? (min === max ? min : `${min}–${max}`) : "—"}</td>
                        <td>{drop?.units ?? 0}</td>
                        {showObserved && <td>{(100 * (drop?.hits ?? 0) / stats.mined).toFixed(1)}%</td>}
                      </tr>;
                    })}
                  </tbody>
                </table>
              </div>
            </details>
          );
        })}
      </div>
      <footer><Link href="/crafters/rocks?view=catalogue" prefetch={false}>Inspect rock art and damage states</Link></footer>
    </dialog>
  );
}
