import type { CSSProperties } from "react";
import type { MiningResource } from "../../../lib/crafters/config";
import { atlas, hazardFamilies, type RockAppearance, type RockFrame } from "../../../lib/crafters/rock-art";

const position = (index: number, count: number) => count === 1 ? 0 : 100 * index / (count - 1);

function Sprite({ asset, column, row = 0, columns, rows = 1, className }: {
  asset: string; column: number; row?: number; columns: number; rows?: number; className?: string;
}) {
  const style: CSSProperties = {
    aspectRatio: `${atlas.tileWidth} / ${atlas.tileHeight}`,
    backgroundImage: `url(/crafters/rocks/${asset}.webp)`,
    backgroundSize: `${100 * columns}% ${100 * rows}%`,
    backgroundPosition: `${position(column, columns)}% ${position(row, rows)}%`,
  };
  return <span aria-hidden="true" className={`rock-sprite${className ? ` ${className}` : ""}`} style={style} />;
}

export function RockSprite({ appearance, frame = 0, className }: {
  appearance: RockAppearance; frame?: RockFrame; className?: string;
}) {
  const { family, variant, hazard } = appearance;
  return (
    <Sprite asset={hazard ? "hazards" : family} column={frame} columns={atlas.frames.length} className={className}
      row={hazard ? hazardFamilies.indexOf(family) : variant}
      rows={hazard ? hazardFamilies.length : atlas.families[family].variants.length} />
  );
}

export function TerrainSprite({ terrain, className }: { terrain: "empty" | "stairs" | "explosion"; className?: string }) {
  const column = { empty: 0, stairs: 1, explosion: 2 }[terrain];
  return <Sprite asset="terrain" column={column} columns={atlas.terrain.length} className={className} />;
}

export function ResourceSprite({ resource, className }: { resource: MiningResource; className?: string }) {
  return <Sprite asset="resources" column={atlas.resources.indexOf(resource)} columns={atlas.resources.length} className={className} />;
}
