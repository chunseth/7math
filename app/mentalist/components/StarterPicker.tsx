import { useId } from "react";
import { starterSprites } from "../../../lib/mentalist/sprites";

export function StarterPicker({ value, onChange, disabled }: {
  value: string;
  onChange: (sprite: string) => void;
  disabled?: boolean;
}) {
  const name = useId();

  return (
    <fieldset className="starter-picker" disabled={disabled}>
      <legend>Choose your starter</legend>
      <div className="starter-picker-grid">
        {starterSprites.map((sprite) => (
          <label className="starter-picker-option" key={sprite}>
            <input
              className="starter-picker-input"
              type="radio"
              name={name}
              value={sprite}
              checked={value === sprite}
              onChange={() => onChange(sprite)}
            />
            <span className="starter-picker-card">
              <img src={`/sprites/${sprite}.png`} alt="" width={64} height={64} />
              <span>{sprite.charAt(0).toUpperCase() + sprite.slice(1)}</span>
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
