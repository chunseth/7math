import { starterSprites } from "../../../lib/mentalist/sprites";
import { StarterPicker } from "./StarterPicker";

export const emptyCredentials = { username: "", pin: "", sprite: starterSprites[0] };
export type Credentials = typeof emptyCredentials;

export function PlayerFields({
  value, onChange, create, busy,
}: {
  value: Credentials;
  onChange: (credentials: Credentials) => void;
  create: boolean;
  busy?: boolean;
}) {
  return (
    <>
      <label>
        Username
        <input
          autoComplete="username"
          required
          pattern="[a-zA-Z0-9_]{3,16}"
          maxLength={16}
          value={value.username}
          onChange={(e) => onChange({ ...value, username: e.target.value })}
        />
      </label>
      <label>
        Two-digit PIN
        <input
          type="password"
          inputMode="numeric"
          required
          pattern="[0-9]{2}"
          maxLength={2}
          value={value.pin}
          onChange={(e) => onChange({ ...value, pin: e.target.value })}
        />
      </label>
      {create && (
        <StarterPicker value={value.sprite} onChange={(sprite) => onChange({ ...value, sprite })} disabled={busy} />
      )}
    </>
  );
}
