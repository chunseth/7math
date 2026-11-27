import { rockTypes } from "../../../lib/crafters/config";
import { atlas, coreRockArt, decoyFamilies, hazardFamilies, type RockAppearance, type RockFrame } from "../../../lib/crafters/rock-art";
import { RockSprite, TerrainSprite } from "./RockSprite";

function FrameStrip({ appearance, label }: { appearance: RockAppearance; label: string }) {
  return (
    <div className="rock-frame-strip">
      <h4>{label}</h4>
      <div className="rock-frame-cells">
        {atlas.frames.map((frame, index) => (
          <figure key={frame}>
            <RockSprite appearance={appearance} frame={index as RockFrame} />
            <figcaption>{frame}</figcaption>
          </figure>
        ))}
      </div>
    </div>
  );
}

export default function RockCatalogue() {
  const coreFamilies = rockTypes.map(({ id }) => coreRockArt[id]);
  return (
    <section className="rock-catalogue" aria-labelledby="rock-catalogue-title">
      <div className="rock-panel-heading">
        <h2 id="rock-catalogue-title">Rock catalogue</h2>
        <p>Ore seams are clues to what a rock might contain.</p>
      </div>
      <ul className="rock-heroes">
        {coreFamilies.map((family) => {
          const { name, cue } = atlas.families[family];
          return (
            <li key={family} className="rock-hero rock-panel" data-family={family}>
              <div className="rock-hero-art"><RockSprite appearance={{ family, variant: 0 }} /></div>
              <div className="rock-hero-copy"><h3>{name}</h3><p>{cue}</p></div>
            </li>
          );
        })}
      </ul>
      <section className="rock-sheet" aria-labelledby="rock-variants-title">
        <h3 id="rock-variants-title">Variants and damage</h3>
        <div className="rock-details">
          {[...coreFamilies, ...decoyFamilies].map((family) => {
            const { name, cue, variants } = atlas.families[family];
            return (
              <details key={family} className="rock-panel">
                <summary><RockSprite appearance={{ family, variant: 0 }} />{name}</summary>
                <div className="rock-details-body">
                  <p>{cue}</p>
                  {variants.map((variant, index) => (
                    <FrameStrip key={variant} appearance={{ family, variant: index }} label={variant} />
                  ))}
                </div>
              </details>
            );
          })}
        </div>
      </section>
      <section className="rock-sheet" aria-labelledby="rock-unstable-title">
        <h3 id="rock-unstable-title">Hazard-suggestive looks</h3>
        <div className="rock-details">
          {hazardFamilies.map((family) => (
            <details key={family} className="rock-panel">
              <summary><RockSprite appearance={{ family, variant: 0, hazard: true }} />{atlas.hazards[family]}</summary>
              <div className="rock-details-body">
                <FrameStrip appearance={{ family, variant: 0, hazard: true }} label={atlas.families[family].name} />
              </div>
            </details>
          ))}
        </div>
      </section>
      <section className="rock-sheet" aria-labelledby="rock-terrain-title">
        <h3 id="rock-terrain-title">After the break</h3>
        <div className="rock-terrain-gallery">
          {(["empty", "stairs", "explosion"] as const).map((terrain, index) => (
            <figure className="rock-panel" key={terrain}>
              <TerrainSprite terrain={terrain} />
              <figcaption>{atlas.terrain[index]}</figcaption>
            </figure>
          ))}
        </div>
      </section>
    </section>
  );
}
