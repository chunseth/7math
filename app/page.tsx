"use client";

import Link from "next/link";
import { Suspense, useEffect, useRef, useState } from "react";
import { STARTING_UNLOCKED_NUMBERS } from "../lib/gameplay";
import { isSupabaseConfigured, supabase } from "../lib/supabase";
import type { ChestSlot, Profile, StudentProgress } from "../lib/database.types";

const allNumbers = Array.from({ length: 13 }, (_, number) => number);
const CHEST_UNLOCK_MS = 2 * 60 * 60 * 1000;
const QUEUE_CHEST_COST = 1000;
const INSTANT_OPEN_COST = 6000;
const spriteNames = [
  "raijin", "phoenix", "pooka", "long", "banshee", "skinwalker", "nian", "jormungandr", "simurgh", "naga",
  "hydra", "garuda", "pegasus", "anubis", "valkyrie", "oni", "horus", "griffin", "chupacabra", "fenrir",
  "minotaur", "kitsune", "seraph", "sphynx", "quetzalcoatl",
];

type PlayerState = {
  profile: Profile;
  progress: StudentProgress;
  chests: ChestSlot[];
};

const emptyLocalSlots: ChestSlot[] = Array.from({ length: 4 }, (_, slot_index) => ({
  id: `empty-${slot_index}`,
  profile_id: "",
  slot_index,
  state: "empty",
  rarity: "common",
  reward_type: null,
  reward_number: null,
  reward_coins: null,
  earned_at: null,
  unlock_started_at: null,
  ready_at: null,
  opened_at: null,
}));

export default function Home() {
  return <Suspense fallback={null}><HomeContent /></Suspense>;
}

function HomeContent() {
  const [activeTab, setActiveTab] = useState(0);
  const [selectedNumber, setSelectedNumber] = useState(7);
  const [player, setPlayer] = useState<PlayerState | null>(null);
  const [showSignin, setShowSignin] = useState(false);
  const [showCharacterSelect, setShowCharacterSelect] = useState(false);
  const [selectedSprite, setSelectedSprite] = useState(spriteNames[0]);
  const [hasCheckedSession, setHasCheckedSession] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [username, setUsername] = useState("");
  const [pinCode, setPinCode] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [selectedChest, setSelectedChest] = useState<ChestSlot | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const pagerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    async function restorePlayer() {
      const activeProfileId = sessionStorage.getItem("activeProfileId");
      if (!supabase || !activeProfileId) {
        setShowSignin(true);
        setHasCheckedSession(true);
        return;
      }

      setLoading(true);
      try {
        const { data: profile, error } = await supabase
          .from("profiles")
          .select()
          .eq("id", activeProfileId)
          .maybeSingle();

        if (error) throw error;
        if (!profile) {
          sessionStorage.removeItem("activeProfileId");
          setShowSignin(true);
          setHasCheckedSession(true);
          return;
        }

        const nextPlayer = await loadPlayerState(profile);
        setPlayer(nextPlayer);
        setSelectedNumber(nextPlayer.progress.selected_number ?? STARTING_UNLOCKED_NUMBERS[0]);
        setShowSignin(false);
        setShowUserMenu(false);

        const routeParams = new URLSearchParams(window.location.search);
        if (routeParams.get("chest") === "earned") {
          setMessage("Chest earned!");
        } else if (routeParams.get("chest") === "missed") {
          setMessage("Score 50% or higher to earn a chest.");
        } else if (routeParams.get("chest") === "error") {
          setMessage("Round finished, but saving the chest needs another try.");
        }
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Could not restore player.");
        setShowSignin(true);
      } finally {
        setLoading(false);
        setHasCheckedSession(true);
      }
    }

    restorePlayer();
  }, []);

  function goToTab(index: number) {
    setActiveTab(index);
    pagerRef.current?.scrollTo({ left: pagerRef.current.clientWidth * index, behavior: "smooth" });
  }

  async function signInWithUsername() {
    if (!supabase) {
      setMessage("Add Supabase env values before signing in.");
      return;
    }

    const normalizedUsername = username.trim().toLowerCase();
    if (!/^[a-z0-9_]{3,16}$/.test(normalizedUsername)) {
      setMessage("Username must be 3-16 characters: letters, numbers, or underscore.");
      return;
    }

    if (!/^[0-9]{2}$/.test(pinCode)) {
      setMessage("Password must be exactly 2 digits.");
      return;
    }

    setLoading(true);
    setMessage("");

    try {
      const { data: existingProfile, error: lookupError } = await supabase
        .from("profiles")
        .select()
        .eq("username", normalizedUsername)
        .maybeSingle();

      if (lookupError) throw lookupError;

      if (existingProfile && existingProfile.pin_code !== pinCode) {
        setMessage("That username exists. Enter the matching 2 digit password.");
        return;
      }

      if (!existingProfile) {
        setShowCharacterSelect(true);
        setShowSignin(false);
        return;
      }

      const profile = existingProfile;
      const nextPlayer = await loadPlayerState(profile);

      setPlayer(nextPlayer);
      sessionStorage.setItem("activeProfileId", profile.id);
      setSelectedNumber(nextPlayer.progress.selected_number ?? STARTING_UNLOCKED_NUMBERS[0]);
      setShowSignin(false);
      setShowUserMenu(false);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not sign in.");
    } finally {
      setLoading(false);
    }
  }

  async function finishSignup() {
    if (!supabase) return;
    setLoading(true);
    setMessage("");
    try {
      const profile = await createNewProfile(username.trim().toLowerCase(), pinCode, selectedSprite);
      const nextPlayer = await loadPlayerState(profile);
      setPlayer(nextPlayer);
      sessionStorage.setItem("activeProfileId", profile.id);
      setSelectedNumber(nextPlayer.progress.selected_number ?? STARTING_UNLOCKED_NUMBERS[0]);
      setShowCharacterSelect(false);
      setShowSignin(false);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not create player.");
    } finally {
      setLoading(false);
    }
  }

  function changeUser() {
    sessionStorage.removeItem("activeProfileId");
    setPlayer(null);
    setUsername("");
    setPinCode("");
    setMessage("");
    setShowUserMenu(false);
    setShowSignin(true);
  }

  async function selectNumber(number: number) {
    setSelectedNumber(number);
    if (!supabase || !player) return;

    const { error } = await supabase
      .from("student_progress")
      .update({ selected_number: number })
      .eq("profile_id", player.profile.id);

    if (!error) {
      setPlayer({ ...player, progress: { ...player.progress, selected_number: number } });
    }
  }

  async function refreshPlayer(nextMessage?: string) {
    if (!player || !supabase) return;
    const { data: profile, error } = await supabase.from("profiles").select().eq("id", player.profile.id).single();
    if (error) {
      setMessage(error.message);
      return;
    }
    const nextPlayer = await loadPlayerState(profile);
    setPlayer(nextPlayer);
    if (nextMessage) setMessage(nextMessage);
  }

  async function startChestUnlock(chest: ChestSlot) {
    if (!supabase || !player) return;

    const unlockStartedAt = new Date();
    const readyAt = new Date(unlockStartedAt.getTime() + CHEST_UNLOCK_MS);
    const { error } = await supabase
      .from("chest_slots")
      .update({
        state: "unlocking",
        unlock_started_at: unlockStartedAt.toISOString(),
        ready_at: readyAt.toISOString(),
      })
      .eq("id", chest.id);

    if (error) {
      setMessage(error.message);
      return;
    }

    setSelectedChest(null);
    await refreshPlayer("Chest unlock started.");
  }

  async function queueChestUnlock(chest: ChestSlot) {
    if (!supabase || !player || player.profile.coins < QUEUE_CHEST_COST) return;

    const queueAfter = getUnlockQueueEnd(player.chests, now);
    const unlockStartedAt = new Date(queueAfter);
    const readyAt = new Date(queueAfter + CHEST_UNLOCK_MS);
    const nextCoins = player.profile.coins - QUEUE_CHEST_COST;

    const { error: chestError } = await supabase
      .from("chest_slots")
      .update({
        state: "unlocking",
        unlock_started_at: unlockStartedAt.toISOString(),
        ready_at: readyAt.toISOString(),
      })
      .eq("id", chest.id);

    if (chestError) {
      setMessage(chestError.message);
      return;
    }

    const { error: coinError } = await supabase
      .from("profiles")
      .update({ coins: nextCoins })
      .eq("id", player.profile.id);

    if (coinError) {
      setMessage(coinError.message);
      return;
    }

    setSelectedChest(null);
    await refreshPlayer("Chest queued for 1,000 coins.");
  }

  async function openChest(chest: ChestSlot) {
    if (!supabase || !player || !isChestOpenable(chest, now)) return;

    await claimChestReward(chest, 0);
  }

  async function openChestWithCoins(chest: ChestSlot) {
    if (!player || player.profile.coins < INSTANT_OPEN_COST) return;
    await claimChestReward(chest, INSTANT_OPEN_COST);
  }

  async function claimChestReward(chest: ChestSlot, coinCost: number) {
    if (!supabase || !player) return;

    let nextCoins = player.profile.coins - coinCost;
    let nextUnlockedNumbers = player.progress.unlocked_numbers;

    if (nextCoins < 0) return;

    if (chest.reward_type === "coins" && chest.reward_coins) {
      nextCoins += chest.reward_coins;
    }

    if (chest.reward_type === "number" && chest.reward_number !== null) {
      nextUnlockedNumbers = Array.from(new Set([...nextUnlockedNumbers, chest.reward_number])).sort((a, b) => a - b);
      const { error } = await supabase
        .from("student_progress")
        .update({ unlocked_numbers: nextUnlockedNumbers })
        .eq("profile_id", player.profile.id);
      if (error) {
        setMessage(error.message);
        return;
      }
    }

    const { error: coinError } = await supabase.from("profiles").update({ coins: nextCoins }).eq("id", player.profile.id);
    if (coinError) {
      setMessage(coinError.message);
      return;
    }

    const { error: emptyError } = await supabase
      .from("chest_slots")
      .update({
        state: "empty",
        reward_type: null,
        reward_number: null,
        reward_coins: null,
        earned_at: null,
        unlock_started_at: null,
        ready_at: null,
        opened_at: new Date().toISOString(),
      })
      .eq("id", chest.id);

    if (emptyError) {
      setMessage(emptyError.message);
      return;
    }

    const rewardMessage = chest.reward_type === "coins" ? `+${chest.reward_coins} coins` : `row ${chest.reward_number}s unlocked`;
    setSelectedChest(null);
    await refreshPlayer(coinCost ? `Opened for 6,000 coins: ${rewardMessage}.` : `Opened chest: ${rewardMessage}.`);
  }

  const displayName = player?.profile.display_name ?? "Choose player";
  const avatarLetter = displayName.slice(0, 1).toUpperCase() || "?";
  const coins = player?.profile.coins ?? 0;
  const xp = player?.profile.xp ?? 0;
  const level = player?.profile.level ?? 1;
  const unlockedNumbers = player?.progress.unlocked_numbers ?? STARTING_UNLOCKED_NUMBERS;
  const chestSlots = player?.chests ?? emptyLocalSlots;
  const xpIntoLevel = xp % 1000;
  const hasUnlockingChest = chestSlots.some((chest) => isChestInProgress(chest, now));

  return (
    <main className="shell">
      {hasCheckedSession && showSignin && (
        <div className="signin-overlay" role="dialog" aria-modal="true" aria-labelledby="signin-title">
          <div className="signin-card">
            <h1 id="signin-title">Choose Username</h1>
            <input
              autoComplete="off"
              autoFocus
              maxLength={16}
              onChange={(event) => setUsername(event.target.value)}
              placeholder="username"
              value={username}
            />
            <input
              autoComplete="off"
              inputMode="numeric"
              maxLength={2}
              onChange={(event) => setPinCode(event.target.value.replace(/\D/g, "").slice(0, 2))}
              placeholder="2 digit password"
              type="password"
              value={pinCode}
            />
            <button disabled={loading || !isSupabaseConfigured} onClick={signInWithUsername}>
              {loading ? "LOADING" : "ENTER"}
            </button>
            <p>{message || "New usernames start with 10,000 coins, 0 XP, and empty chest slots."}</p>
          </div>
        </div>
      )}

      {hasCheckedSession && showCharacterSelect && (
        <div className="signin-overlay" role="dialog" aria-modal="true" aria-labelledby="character-title">
          <div className="signin-card character-card">
            <h1 id="character-title">Choose Your Sprite</h1>
            <p>Pick your player icon.</p>
            <div className="sprite-grid">
              {spriteNames.map((sprite) => (
                <button className={`sprite-option ${selectedSprite === sprite ? "selected" : ""}`} key={sprite} onClick={() => setSelectedSprite(sprite)} aria-label={`Choose ${sprite}`}>
                  <img src={`/sprites/${sprite}.png`} alt="" />
                </button>
              ))}
            </div>
            <button disabled={loading} onClick={finishSignup}>{loading ? "LOADING" : "CREATE PLAYER"}</button>
            <button className="secondary-button" onClick={() => { setShowCharacterSelect(false); setShowSignin(true); }}>BACK</button>
          </div>
        </div>
      )}

      <header className="topbar">
        <div className="player-header">
          <button className="avatar menu-avatar" onClick={() => setShowUserMenu((open) => !open)}>
            {player?.profile.sprite_name ? <img src={`/sprites/${player.profile.sprite_name}.png`} alt="" /> : avatarLetter}
          </button>
          <strong>{displayName}</strong>
          <div className="resource inline-coins">Coins <span>{coins.toLocaleString()}</span></div>
          {showUserMenu && (
            <div className="user-menu">
              <button onClick={changeUser}>Change user</button>
            </div>
          )}
        </div>
      </header>

      <section className="hero compact-hero">
        <div className="resource-row">
          <div className="xp-resource">
            <span>LVL {level}</span>
            <div className="xp-track"><span style={{ width: `${Math.min(100, xpIntoLevel / 10)}%` }} /></div>
            <b>{xpIntoLevel} / 1000 XP</b>
          </div>
        </div>
      </section>

      {message && !showSignin && <div className="status-line">{message}</div>}

      {selectedChest && (
        <div className="signin-overlay" role="dialog" aria-modal="true" aria-labelledby="chest-modal-title">
          <div className="signin-card chest-modal">
            <h1 id="chest-modal-title">Chest Slot {selectedChest.slot_index + 1}</h1>
            <p>{getChestModalCopy(selectedChest, now)}</p>
            {selectedChest.state === "waiting" && !hasUnlockingChest && (
              <button onClick={() => startChestUnlock(selectedChest)}>START 2 HOUR UNLOCK</button>
            )}
            {selectedChest.state === "waiting" && hasUnlockingChest && (
              <button disabled={coins < QUEUE_CHEST_COST} onClick={() => queueChestUnlock(selectedChest)}>
                QUEUE FOR {QUEUE_CHEST_COST.toLocaleString()} COINS
              </button>
            )}
            {isChestOpenable(selectedChest, now) && (
              <button onClick={() => openChest(selectedChest)}>OPEN CHEST</button>
            )}
            {selectedChest.state !== "empty" && !isChestOpenable(selectedChest, now) && (
              <button disabled={coins < INSTANT_OPEN_COST} onClick={() => openChestWithCoins(selectedChest)}>
                OPEN NOW FOR {INSTANT_OPEN_COST.toLocaleString()} COINS
              </button>
            )}
            <button className="secondary-button" onClick={() => setSelectedChest(null)}>CLOSE</button>
          </div>
        </div>
      )}

      <section
        className="pager"
        ref={pagerRef}
        onScroll={(event) => {
          const width = event.currentTarget.clientWidth;
          setActiveTab(Math.round(event.currentTarget.scrollLeft / width));
        }}
      >
        <section className="page-slide home-panel">
          <div className="play-zone">
            <Link
              className="play-button"
              href="/play"
              onClick={(event) => {
                if (!player) {
                  event.preventDefault();
                  setShowSignin(true);
                  setMessage("Choose a username before playing.");
                  return;
                }
                sessionStorage.setItem("activeProfileId", player.profile.id);
              }}
            >
              PLAY
            </Link>
          </div>

          <div className="chest-section">
            <div className="chest-grid">
              {chestSlots.map((chest) => (
                <button className={`chest empty chest-${getChestDisplayState(chest, now)}`} disabled={chest.state === "empty"} key={chest.slot_index} onClick={() => setSelectedChest(chest)}>
                  {chest.state === "empty" ? "" : getChestLabel(chest, now)}
                </button>
              ))}
            </div>
          </div>
        </section>

        <section className="page-slide">
          <div className="map-view">
            <div className="section-heading">
              <h2>World Map <span>CHESTS REVEAL ROWS</span></h2>
              <div className="map-score">{unlockedNumbers.length} / 13 rows</div>
            </div>
            <div className="map-board">
              <div className="cloud c1" />
              <div className="cloud c2" />
              <div className="path" />
              <div className="map-node start">6<small>Start</small></div>
              <div className="map-node current">{selectedNumber}<small>Current</small></div>
              <div className="map-node locked">?</div>
              <div className="map-node final">12<small>Boss</small></div>
              <div className="map-label">CHEST DROPS EXPAND THE MAP</div>
            </div>
          </div>
        </section>

        <section className="page-slide">
          <div className="numbers">
            <div className="number-grid">
              {allNumbers.map((number) => {
                const unlocked = unlockedNumbers.includes(number);
                return (
                  <button
                    className={`number-card ${unlocked ? "" : "locked-number"} ${selectedNumber === number ? "chosen" : ""}`}
                    disabled={!unlocked}
                    key={number}
                    onClick={() => selectNumber(number)}
                  >
                    <div className="number-gem">{unlocked ? number : "?"}</div>
                    <strong>{number}s</strong>
                  </button>
                );
              })}
            </div>
            <div className="selected-note">Selected row: {selectedNumber}s.</div>
          </div>
        </section>
      </section>

      <nav className="tabs" aria-label="Main sections">
        {["Home", "Map", "Numbers"].map((tab, index) => (
          <button className={activeTab === index ? "active" : ""} key={tab} onClick={() => goToTab(index)}>
            {tab}
          </button>
        ))}
      </nav>
    </main>
  );
}

async function createNewProfile(username: string, pinCode: string, sprite_name: string) {
  if (!supabase) throw new Error("Supabase is not configured.");

  const { data, error } = await supabase
    .from("profiles")
    .insert({
      username,
      pin_code: pinCode,
      display_name: username,
      sprite_name,
      coins: 10000,
      xp: 0,
      level: 1,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

async function loadPlayerState(profile: Profile): Promise<PlayerState> {
  const progress = await loadOrCreateProgress(profile.id);
  const chests = await loadOrCreateChestSlots(profile.id);
  return { profile, progress, chests };
}

async function loadOrCreateProgress(profileId: string) {
  if (!supabase) throw new Error("Supabase is not configured.");

  const { data: existingProgress, error: lookupError } = await supabase
    .from("student_progress")
    .select()
    .eq("profile_id", profileId)
    .maybeSingle();

  if (lookupError) throw lookupError;
  if (existingProgress) return existingProgress;

  const { data, error } = await supabase
    .from("student_progress")
    .insert({
      profile_id: profileId,
      unlocked_numbers: STARTING_UNLOCKED_NUMBERS,
      selected_number: STARTING_UNLOCKED_NUMBERS[0],
      matches_played: 0,
      map_revealed: true,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

async function loadOrCreateChestSlots(profileId: string) {
  if (!supabase) throw new Error("Supabase is not configured.");

  const { data: existingChests, error: lookupError } = await supabase
    .from("chest_slots")
    .select()
    .eq("profile_id", profileId)
    .order("slot_index");

  if (lookupError) throw lookupError;

  const existingIndexes = new Set(existingChests.map((chest) => chest.slot_index));
  const missingSlots = [0, 1, 2, 3]
    .filter((slot_index) => !existingIndexes.has(slot_index))
    .map((slot_index) => ({ profile_id: profileId, slot_index, state: "empty" as const }));

  if (missingSlots.length) {
    const { error } = await supabase.from("chest_slots").insert(missingSlots);
    if (error) throw error;
  }

  const { data, error } = await supabase
    .from("chest_slots")
    .select()
    .eq("profile_id", profileId)
    .order("slot_index");

  if (error) throw error;
  return data;
}

function isChestOpenable(chest: ChestSlot, now: number) {
  return chest.state === "ready" || (chest.state === "unlocking" && Boolean(chest.ready_at) && new Date(chest.ready_at!).getTime() <= now);
}

function isChestInProgress(chest: ChestSlot, now: number) {
  if (chest.state !== "unlocking" || !chest.ready_at) return false;
  return new Date(chest.ready_at).getTime() > now;
}

function getUnlockQueueEnd(chests: ChestSlot[], now: number) {
  return chests.reduce((queueEnd, chest) => {
    if (chest.state !== "unlocking" || !chest.ready_at) return queueEnd;
    return Math.max(queueEnd, new Date(chest.ready_at).getTime());
  }, now);
}

function getChestDisplayState(chest: ChestSlot, now: number) {
  if (isChestOpenable(chest, now)) return "ready";
  if (chest.state === "unlocking" && chest.unlock_started_at && new Date(chest.unlock_started_at).getTime() > now) {
    return "queued";
  }
  return chest.state;
}

function getChestLabel(chest: ChestSlot, now: number) {
  const displayState = getChestDisplayState(chest, now);
  if (displayState === "ready") return "OPEN";
  if (displayState === "queued") return "QUEUED";
  if (displayState === "unlocking") return formatRemainingTime(chest.ready_at, now);
  if (displayState === "waiting") return "READY";
  return "";
}

function getChestModalCopy(chest: ChestSlot, now: number) {
  const displayState = getChestDisplayState(chest, now);
  if (displayState === "ready") return "This chest finished unlocking. Open it to claim the reward.";
  if (displayState === "queued") return `Queued. Unlock starts in ${formatRemainingTime(chest.unlock_started_at, now)}.`;
  if (displayState === "unlocking") return `Unlocking. Ready in ${formatRemainingTime(chest.ready_at, now)}.`;
  if (displayState === "waiting") return "Start a 2 hour unlock now, or queue it behind your current unlock for coins.";
  return "This chest slot is empty.";
}

function formatRemainingTime(dateValue: string | null, now: number) {
  if (!dateValue) return "2h";
  const remainingMs = Math.max(0, new Date(dateValue).getTime() - now);
  const totalMinutes = Math.ceil(remainingMs / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours <= 0) return `${minutes}m`;
  return `${hours}h ${minutes.toString().padStart(2, "0")}m`;
}
