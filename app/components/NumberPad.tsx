import type { PointerEvent } from "react";

const digits = ["1", "2", "3", "4", "5", "6", "7", "8", "9"];
type ControlKey = { key: string; label: string; name: string };

export default function NumberPad({ className, controls = [], disabled, onKey, onPointerKey }: {
  className: string;
  controls?: ControlKey[];
  disabled: boolean;
  onKey: (key: string) => void;
  onPointerKey?: (event: PointerEvent<HTMLButtonElement>, key: string) => void;
}) {
  function button(key: string, label: string, name: string, style?: string) {
    return <button type="button" key={key} className={style} aria-label={name} disabled={disabled}
      onClick={event => { if (!onPointerKey || event.detail === 0) onKey(key); }}
      onPointerDown={onPointerKey && (event => onPointerKey(event, key))}>{label}</button>;
  }

  const controlButtons = controls.map(({ key, label, name }) => button(key, label, name, "number-pad-control"));
  return <div className={className} role="group" aria-label="Number pad">
    {digits.map(digit => button(digit, digit, digit))}
    {controls.length === 1 && controlButtons}
    {button("0", "0", "0", "number-pad-zero")}
    {button("Backspace", "⌫", "Delete", "number-pad-delete")}
    {controls.length > 1 && controlButtons}
  </div>;
}
