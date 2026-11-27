import { useEffect, useRef } from "react";
import { miningResources, miningRules, resourceIds, rockType, rockTypes, type RockId } from "../../lib/crafters/config";
import type { MiningView } from "../../lib/crafters/expedition";

export function RockArt({ type, damage = 0, locked = false }: { type: RockId; damage?: number; locked?: boolean }) {
  return (
    <span className="mine-rock-art" data-mineral={rockType(type).visual} data-locked={locked} aria-hidden="true">
      <span className="mine-rock-shadow" />
      <span className="mine-rock-shape">
        <span className="mine-rock-facets" />
        <span className="mine-rock-flecks"><i /><i /><i /><i /><i /></span>
        {damage > 0 && <span className="mine-rock-cracks" data-heavy={damage >= 0.5}><i /><i /><i /></span>}
      </span>
    </span>
  );
}

export function ResourceIcon({ id }: { id: string }) {
  if (id === "stone") return <span className="mine-stone-icon" aria-hidden="true" />;
  return <img className="mine-resource-icon" src={`/crafters/${id === "gem" ? "crystal" : id}.png`} width={24} height={24} alt="" />;
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
                <dl>
                  <div><dt>Base durability</dt><dd>{rock.durability}</dd></div>
                  <div><dt>Floors</dt><dd>{rock.lastFloor === null ? `${rock.firstFloor}+` : `${rock.firstFloor}–${rock.lastFloor}`}</dd></div>
                  <div><dt>Base explosion chance</dt><dd>{Math.round(rock.explosion * 100)}%</dd></div>
                  <div><dt>Explosions encountered</dt><dd>{stats.hazards}</dd></div>
                </dl>
                <table>
                  <caption>Drop history · {stats.mined} rocks mined</caption>
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
    </dialog>
  );
}
