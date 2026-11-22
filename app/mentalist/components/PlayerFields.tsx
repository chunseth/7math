import { sprites } from "../../../lib/mentalist/model";

export const emptyCredentials = { username: "", pin: "", sprite: sprites[0] };
export type Credentials = typeof emptyCredentials;

export function PlayerFields({
  value, onChange, create,
}: {
  value: Credentials;
  onChange: (credentials: Credentials) => void;
  create: boolean;
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
        <label>
          Character
          <select value={value.sprite} onChange={(e) => onChange({ ...value, sprite: e.target.value })}>
            {sprites.map((sprite) => <option key={sprite}>{sprite}</option>)}
          </select>
        </label>
      )}
    </>
  );
}
