"use client";

import Link from "next/link";
import { Suspense, useEffect, useRef, useState } from "react";
import {
  CARDS_PER_LEVEL,
  GOLD_PER_LEVEL,
  MAX_NUMBER_LEVEL,
  ADDITION_SKILLS,
  DIVISION_NUMBERS,
  SKILLS_BY_OPERATION,
  STARTER_ADDITION_SKILL_ID,
  STARTER_SUBTRACTION_SKILL_ID,
  STARTING_UNLOCKED_NUMBERS,
  SUBTRACTION_SKILLS,
  canLevelUp,
  clampCardCount,
  currentProgressionArena,
  damageRangeForLevel,
  getProfileXpProgress,
  isArenaUnlocked,
  multiplicationSkillId,
  divisionSkillId,
  OPERATION_ARENAS,
  operationForSkillId,
  type OperationArena,
} from "../../lib/gameplay";
import { isSupabaseConfigured, supabase } from "../../lib/supabase";
import type { ChestReward, ChestSlot, Profile, SkillCard, StudentProgress } from "../../lib/database.types";

const allNumbers = Array.from({ length: 12 }, (_, number) => number + 1);
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
  skillCards: SkillCard[];
  chestRewards: ChestReward[];
  completedLevelIds: string[];
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
  reward_card_count: null,
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
  const [numbersSubtab, setNumbersSubtab] = useState<"multiplication" | "addition" | "subtraction" | "division">("multiplication");
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
  const [levelUpSkillId, setLevelUpSkillId] = useState<string | null>(null);
  const [levelUpLoading, setLevelUpLoading] = useState(false);
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
          setMessage("Get at least one correct answer to earn a chest.");
        } else if (routeParams.get("chest") === "full") {
          setMessage("Chest slots are full. Open one before you can earn another.");
        } else if (routeParams.get("chest") === "error") {
          setMessage("Round finished, but saving the chest needs another try.");
        } else if (routeParams.get("bossReset") === "1") {
          setMessage("Boss defeat reset this world's progress. Clear the stages again to retry the boss.");
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

  function getSkillCard(skillId: string) {
    const row = player?.skillCards.find((card) => card.skill_id === skillId);
    return {
      skill_id: skillId,
      card_count: row?.card_count ?? 0,
      level: row?.level ?? 1,
      unlocked: Boolean(row),
    };
  }

  function getNumberCard(number: number) {
    const card = getSkillCard(multiplicationSkillId(number));
    return {
      ...card,
      unlocked: (player?.progress.unlocked_numbers ?? STARTING_UNLOCKED_NUMBERS).includes(number),
    };
  }

  function getDivisionCard(number: number) {
    return { ...getSkillCard(divisionSkillId(number)), unlocked: true };
  }

  async function confirmLevelUp() {
    if (!supabase || !player || levelUpSkillId === null) return;

    const card = getSkillCard(levelUpSkillId);
    if (!canLevelUp(card.level, card.card_count, player.profile.coins)) return;

    setLevelUpLoading(true);
    try {
      const nextCoins = player.profile.coins - GOLD_PER_LEVEL;
      const nextCards = clampCardCount(card.card_count - CARDS_PER_LEVEL);
      const nextLevel = Math.min(MAX_NUMBER_LEVEL, card.level + 1);

      const { error: cardError } = await supabase.from("skill_cards").upsert(
        {
          profile_id: player.profile.id,
          skill_id: levelUpSkillId,
          operation: operationForSkillId(levelUpSkillId),
          card_count: nextCards,
          level: nextLevel,
        },
        { onConflict: "profile_id,skill_id" },
      );
      if (cardError) throw cardError;

      const { error: coinError } = await supabase
        .from("profiles")
        .update({ coins: nextCoins })
        .eq("id", player.profile.id);
      if (coinError) throw coinError;

      await refreshPlayer(`${skillTitle(levelUpSkillId)} reached level ${nextLevel}!`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not level up that number.");
    } finally {
      setLevelUpLoading(false);
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
    if (nextCoins < 0) return;
    const rewards = player.chestRewards.filter((reward) => reward.chest_id === chest.id && !reward.claimed_at);
    const claimed: string[] = [];
    for (const reward of rewards) {
      if (reward.reward_type === "coins") {
        nextCoins += reward.coin_amount ?? 0;
        claimed.push(`+${reward.coin_amount ?? 0} coins`);
      } else if (reward.reward_type === "cards" && reward.skill_id) {
        const unlocked = player.skillCards.some((card) => card.skill_id === reward.skill_id);
        if (unlocked) {
          await grantSkillCards(player.profile.id, reward.skill_id, reward.operation!, reward.card_amount ?? 0);
          claimed.push(`+${reward.card_amount ?? 0} ${skillTitle(reward.skill_id)} cards`);
        } else {
          nextCoins += 150;
          claimed.push("+150 coins");
        }
      } else if (reward.reward_type === "unlock" && reward.skill_id && reward.operation === "multiplication") {
        // Multiplication rows are gated by student_progress.unlocked_numbers,
        // not by the presence of a skill_cards row.
        const number = Number(reward.skill_id.match(/^multiplication\.row\.(\d+)$/)?.[1]);
        const current = player.progress.unlocked_numbers ?? STARTING_UNLOCKED_NUMBERS;
        if (Number.isFinite(number) && !current.includes(number)) {
          await unlockNumber(player.profile.id, current, number);
          await grantSkillCards(player.profile.id, reward.skill_id, "multiplication", 0);
          claimed.push(`Unlocked ${skillTitle(reward.skill_id)}`);
        } else {
          nextCoins += 250;
          claimed.push("+250 coins");
        }
      } else if (reward.reward_type === "unlock" && reward.skill_id && reward.operation) {
        const alreadyUnlocked = player.skillCards.some((card) => card.skill_id === reward.skill_id);
        if (!alreadyUnlocked) {
          await grantSkillCards(player.profile.id, reward.skill_id, reward.operation, 0);
          claimed.push(`Unlocked ${skillTitle(reward.skill_id)}`);
        } else {
          nextCoins += 250;
          claimed.push("+250 coins");
        }
      }
      await supabase.from("chest_rewards").update({ claimed_at: new Date().toISOString() }).eq("id", reward.id);
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
        reward_card_count: null,
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

    const rewardMessage = claimed.length ? claimed.join(" · ") : "No unclaimed rewards";
    setSelectedChest(null);
    await refreshPlayer(coinCost ? `Opened for 6,000 coins: ${rewardMessage}.` : `Opened chest: ${rewardMessage}.`);
  }

  const displayName = player?.profile.display_name ?? "Choose player";
  const avatarLetter = displayName.slice(0, 1).toUpperCase() || "?";
  const coins = player?.profile.coins ?? 0;
  const xp = player?.profile.xp ?? 0;
  const xpProgress = getProfileXpProgress(xp);
  const level = Math.max(player?.profile.level ?? 1, xpProgress.level);
  const unlockedNumbers = player?.progress.unlocked_numbers ?? STARTING_UNLOCKED_NUMBERS;
  const chestSlots = player?.chests ?? emptyLocalSlots;
  const xpBarPercent = xpProgress.isMax
    ? 100
    : Math.min(100, (xpProgress.xpIntoLevel / Math.max(1, xpProgress.xpForNext)) * 100);
  const hasUnlockingChest = chestSlots.some((chest) => isChestInProgress(chest, now));
  const levelUpTarget = levelUpSkillId === null
    ? null
    : operationForSkillId(levelUpSkillId) === "multiplication"
      ? getNumberCard(Number(levelUpSkillId.match(/\.(\d+)$/)?.[1] ?? 0))
      : operationForSkillId(levelUpSkillId) === "division"
        ? getDivisionCard(Number(levelUpSkillId.match(/\.(\d+)$/)?.[1] ?? 0))
        : getSkillCard(levelUpSkillId);
  const levelUpReady =
    levelUpTarget !== null && player !== null && canLevelUp(levelUpTarget.level, levelUpTarget.card_count, player.profile.coins);
  const multiplicationUpgrades = allNumbers.filter((number) => {
    const card = getNumberCard(number);
    return unlockedNumbers.includes(number) && canLevelUp(card.level, card.card_count, coins);
  }).length;
  const additionUpgrades = ADDITION_SKILLS.filter((skill) => {
    const card = getSkillCard(skill.id);
    return card.unlocked && canLevelUp(card.level, card.card_count, coins);
  }).length;
  const subtractionUpgrades = SUBTRACTION_SKILLS.filter((skill) => {
    const card = getSkillCard(skill.id);
    return card.unlocked && canLevelUp(card.level, card.card_count, coins);
  }).length;
  const divisionUpgrades = DIVISION_NUMBERS.filter((number) => {
    const card = getDivisionCard(number);
    return canLevelUp(card.level, card.card_count, coins);
  }).length;
  const activeSkills = numbersSubtab === "addition" || numbersSubtab === "subtraction" ? SKILLS_BY_OPERATION[numbersSubtab] : ADDITION_SKILLS;
  const numberCollectionIsDivision = numbersSubtab === "division";
  const completedLevelIds = player?.completedLevelIds ?? [];
  const arenaStates = getArenaStates(completedLevelIds);
  const recommendedArena = currentProgressionArena(completedLevelIds);
  const completedInWorld = OPERATION_ARENAS.filter((arena) => arena.worldId === recommendedArena.worldId && completedLevelIds.includes(arena.id)).length;

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
            <Link href="/mentalist/previews">More Topics</Link>
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
              <Link href="/teacher">Teacher dashboard</Link>
            </div>
          )}
        </div>
      </header>

      <section className="hero compact-hero">
        <div className="resource-row">
          <div className="xp-resource">
            <span>LVL {level}</span>
            <div className="xp-track"><span style={{ width: `${xpBarPercent}%` }} /></div>
            <b>
              {xpProgress.isMax
                ? "MAX"
                : `${xpProgress.xpIntoLevel} / ${xpProgress.xpForNext} XP`}
            </b>
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

      {levelUpTarget && levelUpSkillId !== null && (
        <div className="signin-overlay" role="dialog" aria-modal="true" aria-labelledby="card-detail-title">
          <div className="signin-card chest-modal card-detail-modal">
            <p className="card-detail-kicker">
              {operationForSkillId(levelUpSkillId) === "multiplication"
                ? "Number card"
                : operationForSkillId(levelUpSkillId) === "division"
                  ? "Division card"
                  : "Concept card"}
            </p>
            <div className="card-detail-hero">
              <div className={`card-detail-gem ${levelUpTarget.unlocked ? "" : "locked"}`}>
                {levelUpTarget.unlocked ? cardDetailGlyph(levelUpSkillId) : "?"}
              </div>
              <div>
                <h1 id="card-detail-title">{skillTitle(levelUpSkillId)}</h1>
                <p className="card-detail-status">
                  {levelUpTarget.unlocked
                    ? levelUpTarget.level >= MAX_NUMBER_LEVEL
                      ? `Level ${levelUpTarget.level} · Max`
                      : `Level ${levelUpTarget.level}`
                    : "Locked"}
                </p>
              </div>
            </div>

            <p className="card-detail-copy">{skillDescription(levelUpSkillId)}</p>

            {levelUpTarget.unlocked ? (
              <>
                <div className="card-detail-stats">
                  <div>
                    <span>Cards</span>
                    <strong>
                      {levelUpTarget.level >= MAX_NUMBER_LEVEL
                        ? levelUpTarget.card_count
                        : `${levelUpTarget.card_count} / ${CARDS_PER_LEVEL}`}
                    </strong>
                  </div>
                  <div>
                    <span>Damage</span>
                    <strong>
                      {damageRangeForLevel(levelUpTarget.level)[0]}–{damageRangeForLevel(levelUpTarget.level)[1]}
                    </strong>
                  </div>
                </div>
                <div className="card-track" aria-label={`${levelUpTarget.card_count} of ${CARDS_PER_LEVEL} cards`}>
                  <span
                    style={{
                      width: `${levelUpTarget.level >= MAX_NUMBER_LEVEL ? 100 : Math.min(100, (levelUpTarget.card_count / CARDS_PER_LEVEL) * 100)}%`,
                    }}
                  />
                </div>

                {levelUpTarget.level < MAX_NUMBER_LEVEL ? (
                  <>
                    <ul className="levelup-costs">
                      <li>
                        <span>Cards</span>
                        <strong>
                          {levelUpTarget.card_count} → {Math.max(0, levelUpTarget.card_count - CARDS_PER_LEVEL)}
                        </strong>
                        <em>−{CARDS_PER_LEVEL}</em>
                      </li>
                      <li>
                        <span>Gold</span>
                        <strong>
                          {coins.toLocaleString()} → {Math.max(0, coins - GOLD_PER_LEVEL).toLocaleString()}
                        </strong>
                        <em>−{GOLD_PER_LEVEL.toLocaleString()}</em>
                      </li>
                    </ul>
                    <button disabled={!levelUpReady || levelUpLoading} onClick={confirmLevelUp}>
                      {levelUpLoading ? "LEVELING..." : `LEVEL UP TO ${levelUpTarget.level + 1}`}
                    </button>
                    {!levelUpReady && (
                      <p className="levelup-blocked">
                        {levelUpTarget.card_count < CARDS_PER_LEVEL
                          ? `Need ${CARDS_PER_LEVEL - levelUpTarget.card_count} more cards.`
                          : `Need ${(GOLD_PER_LEVEL - coins).toLocaleString()} more gold.`}
                      </p>
                    )}
                  </>
                ) : (
                  <p className="card-detail-maxed">This card is max level.</p>
                )}
              </>
            ) : (
              <p className="levelup-blocked">
                {skillUnlockHint(levelUpSkillId)}
              </p>
            )}

            <button className="secondary-button" disabled={levelUpLoading} onClick={() => setLevelUpSkillId(null)}>
              CLOSE
            </button>
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
              href={`/play?arena=${recommendedArena.id}`}
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
              <span>Recommended Battle</span>
              <small>{recommendedArena.title}</small>
            </Link>
            <Link href="/mentalist/previews">More Topics</Link>
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
              <h2>World Map <span>CHOOSE YOUR BATTLE</span></h2>
              <div className="map-score">{recommendedArena.worldTitle} · {completedInWorld} / 6 cleared</div>
            </div>
            <div className="operation-map-board">
              <div className="operation-path" aria-hidden="true" />
              <Link
                className="recommended-card"
                href={`/play?arena=${recommendedArena.id}`}
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
                <span>Recommended</span>
                <strong>{recommendedArena.title}</strong>
                <small>{recommendedArena.focus}</small>
              </Link>
              {arenaStates.map((state) => (
                <ArenaNode
                  key={state.arena.id}
                  arena={state.arena}
                  lockedReason={state.lockedReason}
                  completed={state.completed}
                  current={state.arena.id === recommendedArena.id}
                  unlocked={state.unlocked}
                  onLocked={() => setMessage(state.lockedReason)}
                  playerId={player?.profile.id}
                />
              ))}
            </div>
          </div>
        </section>

        <section className="page-slide">
          <div className="numbers">
            <div className="numbers-subtabs" role="tablist" aria-label="Number collections">
              <button className={numbersSubtab === "multiplication" ? "active" : ""} onClick={() => setNumbersSubtab("multiplication")} aria-label="Multiplication">
                × {multiplicationUpgrades > 0 && <span className="upgrade-count">{multiplicationUpgrades}</span>}
              </button>
              <button className={numbersSubtab === "addition" ? "active" : ""} onClick={() => setNumbersSubtab("addition")} aria-label="Addition">
                + {additionUpgrades > 0 && <span className="upgrade-count">{additionUpgrades}</span>}
              </button>
              <button className={numbersSubtab === "subtraction" ? "active" : ""} onClick={() => setNumbersSubtab("subtraction")} aria-label="Subtraction">
                − {subtractionUpgrades > 0 && <span className="upgrade-count">{subtractionUpgrades}</span>}
              </button>
              <button className={numbersSubtab === "division" ? "active" : ""} onClick={() => setNumbersSubtab("division")} aria-label="Division">
                ÷ {divisionUpgrades > 0 && <span className="upgrade-count">{divisionUpgrades}</span>}
              </button>
            </div>
            {numbersSubtab === "multiplication" || numbersSubtab === "division" ? (
              <div className="number-grid">
                {(numberCollectionIsDivision ? DIVISION_NUMBERS : allNumbers).map((number) => {
                  const unlocked = numberCollectionIsDivision || unlockedNumbers.includes(number);
                  const card = numberCollectionIsDivision ? getDivisionCard(number) : getNumberCard(number);
                  const ready = unlocked && canLevelUp(card.level, card.card_count, coins);
                  const skillId = numberCollectionIsDivision ? divisionSkillId(number) : multiplicationSkillId(number);

                  return (
                    <button
                      key={number}
                      type="button"
                      className={`number-card ${unlocked ? "" : "locked-number"} ${ready ? "upgrade-ready" : ""}`}
                      aria-label={
                        unlocked
                          ? `${numberCollectionIsDivision ? `Divide by ${number}` : `${number}s`}, level ${card.level}`
                          : `${number} locked`
                      }
                      onClick={() => {
                        if (unlocked && !numberCollectionIsDivision) selectNumber(number);
                        setLevelUpSkillId(skillId);
                      }}
                    >
                      <span className="number-gem">
                        {unlocked ? number : "?"}
                        {ready && <span className="upgrade-ready-badge" aria-label="Ready to level up">!</span>}
                      </span>
                      <span className="number-level">{unlocked ? `Lv ${card.level}` : "Locked"}</span>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="addition-tree-layout concept-only">
                <div className="addition-skill-tree" aria-label={`${numbersSubtab} skill tree`}>
                  <svg className="addition-tree-path" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
                    <path className="addition-tree-path-shadow" d="M 10 25 H 90 V 75 H 10" />
                    <path className="addition-tree-path-line" d="M 10 25 H 90 V 75 H 10" />
                  </svg>
                  {activeSkills.map((skill, index) => {
                    const card = getSkillCard(skill.id);
                    const ready = card.unlocked && canLevelUp(card.level, card.card_count, coins);
                    return (
                      <div className={`addition-tree-step step-${index + 1}`} key={skill.id}>
                        <button
                          aria-label={`${skill.title}${card.unlocked ? `, level ${card.level}` : ", locked"}`}
                          className={`addition-skill-icon concept-card ${card.unlocked ? "unlocked" : "locked"} ${ready ? "upgrade-ready" : ""}`}
                          onClick={() => setLevelUpSkillId(skill.id)}
                          type="button"
                        >
                          <strong>{card.unlocked ? skill.title : "Locked"}</strong>
                          <small>{card.unlocked ? `Lv ${card.level}` : "Locked"}</small>
                          {ready && <b className="upgrade-ready-badge" aria-label="Ready to level up">!</b>}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </section>
      </section>

      <nav className="tabs" aria-label="Main sections">
        {["Play", "Map", "Numbers"].map((tab, index) => (
          <button className={activeTab === index ? "active" : ""} key={tab} onClick={() => goToTab(index)}>
            {tab}
          </button>
        ))}
      </nav>
    </main>
  );
}

type ArenaState = {
  arena: OperationArena;
  unlocked: boolean;
  completed: boolean;
  lockedReason: string;
};

function getArenaStates(completedLevelIds: string[]): ArenaState[] {
  return OPERATION_ARENAS.map((arena) => {
    const completed = completedLevelIds.includes(arena.id);
    const unlocked = completed || isArenaUnlocked(arena.id, completedLevelIds);
    const prior = OPERATION_ARENAS[OPERATION_ARENAS.findIndex((entry) => entry.id === arena.id) - 1];
    return {
      arena,
      completed,
      unlocked,
      lockedReason: prior ? `Clear ${prior.title}` : "",
    };
  });
}

function ArenaNode({
  arena,
  completed,
  current,
  lockedReason,
  onLocked,
  playerId,
  unlocked,
}: {
  arena: OperationArena;
  completed: boolean;
  current: boolean;
  lockedReason: string;
  onLocked: () => void;
  playerId?: string;
  unlocked: boolean;
}) {
  const label = arena.level === "B" ? `${arena.worldTitle}-B` : `${arena.worldTitle}-${arena.level}`;
  const content = (
    <>
      <span>{label}</span>
      <strong>{arena.title.split(": ")[1] ?? arena.title}</strong>
      <small>{unlocked ? `${arena.enemyCount} enemies · ${arena.enemyHealthMultiplier}x HP` : lockedReason}</small>
      {current && <b>Next</b>}
      {completed && <b className="done">Done</b>}
    </>
  );

  if (!unlocked) {
    return (
      <button className={`arena-node arena-${arena.id} locked`} onClick={onLocked} type="button">
        {content}
      </button>
    );
  }

  return (
    <Link
      className={`arena-node arena-${arena.id} ${current ? "recommended" : ""} ${completed ? "completed" : ""}`}
      href={`/play?arena=${arena.id}`}
      onClick={() => {
        if (playerId) sessionStorage.setItem("activeProfileId", playerId);
      }}
    >
      {content}
    </Link>
  );
}

function AdditionSkillDetail({
  card,
  coins,
  onLevelUp,
  skill,
}: {
  card: { card_count: number; level: number; unlocked: boolean };
  coins: number;
  onLevelUp: () => void;
  skill: (typeof ADDITION_SKILLS)[number];
}) {
  const progress = Math.min(100, (card.card_count / CARDS_PER_LEVEL) * 100);
  const ready = card.unlocked && canLevelUp(card.level, card.card_count, coins);
  return (
    <aside className={`addition-skill-detail ${card.unlocked ? "unlocked" : "locked"}`} aria-live="polite">
      <div className="addition-detail-icon">{card.unlocked ? skillIcon(skill.id) : "?"}</div>
      <span className="addition-detail-status">{card.unlocked ? `Level ${card.level}` : "Locked"}</span>
      <h3>{skill.title}</h3>
      {card.unlocked && <p>{skill.description}</p>}
      {card.unlocked ? <>
        <div className="card-track" aria-label={`${card.card_count} of ${CARDS_PER_LEVEL} cards`}>
          <span style={{ width: `${card.level >= MAX_NUMBER_LEVEL ? 100 : progress}%` }} />
        </div>
        <small>{card.level >= MAX_NUMBER_LEVEL ? `${card.card_count} cards · Max level` : `${card.card_count} / ${CARDS_PER_LEVEL} cards`}</small>
        <button className={ready ? "number-levelup ready" : "number-levelup"} disabled={card.level >= MAX_NUMBER_LEVEL} onClick={onLevelUp}>
          {card.level >= MAX_NUMBER_LEVEL ? "MAX" : "Level Up"}
        </button>
      </> : (
        <small>Master {skill.prerequisiteId ? skillTitle(skill.prerequisiteId) : "the previous concept"} to make this concept chest-eligible.</small>
      )}
    </aside>
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
  const skillCards = await loadSkillCards(profile.id);
  const completedLevelIds = await loadCompletedProgressionLevelIds(profile.id);
  const chestIds = chests.map((chest) => chest.id);
  const { data: chestRewards, error } = chestIds.length
    ? await supabase!.from("chest_rewards").select().in("chest_id", chestIds).order("reward_order")
    : { data: [], error: null };
  if (error) throw error;
  return { profile, progress, chests, skillCards, chestRewards: chestRewards ?? [], completedLevelIds };
}

async function loadCompletedProgressionLevelIds(profileId: string) {
  if (!supabase) return [];

  const progressionIds = OPERATION_ARENAS.map((arena) => arena.id);
  const { data, error } = await supabase
    .from("match_speed_stats")
    .select("arena_id")
    .eq("profile_id", profileId)
    .in("arena_id", progressionIds);

  if (error) return [];
  return Array.from(new Set((data ?? []).map((row) => row.arena_id).filter((id) => progressionIds.includes(id))));
}

async function loadSkillCards(profileId: string) {
  if (!supabase) throw new Error("Supabase is not configured.");

  const { data, error } = await supabase
    .from("skill_cards")
    .select()
    .eq("profile_id", profileId)
    .order("skill_id");

  if (error) throw error;
  const starters = [
    [STARTER_ADDITION_SKILL_ID, "addition"],
    [STARTER_SUBTRACTION_SKILL_ID, "subtraction"],
  ] as const;
  const divisionRows = [0, ...DIVISION_NUMBERS].map((number) => [divisionSkillId(number), "division"] as const);
  const missing = [...starters, ...divisionRows].filter(([skillId]) => !(data ?? []).some((card) => card.skill_id === skillId));
  if (missing.length) {
    await Promise.all(missing.map(([skillId, operation]) => grantSkillCards(profileId, skillId, operation, 0)));
    return loadSkillCards(profileId);
  }
  return data ?? [];
}

/** Append a multiplication number to student_progress.unlocked_numbers. */
async function unlockNumber(profileId: string, current: number[], number: number) {
  if (!supabase) return;
  const { error } = await supabase
    .from("student_progress")
    .update({ unlocked_numbers: [...current, number].sort((a, b) => a - b) })
    .eq("profile_id", profileId);
  if (error) throw error;
}

async function grantSkillCards(profileId: string, skillId: string, operation: "multiplication" | "addition" | "subtraction" | "division", amount: number) {
  if (!supabase || amount < 0) return;

  const { data: existing, error: lookupError } = await supabase
    .from("skill_cards")
    .select("card_count, level")
    .eq("profile_id", profileId)
    .eq("skill_id", skillId)
    .maybeSingle();

  if (lookupError) throw lookupError;

  const { error } = await supabase.from("skill_cards").upsert(
    {
      profile_id: profileId,
      skill_id: skillId,
      operation,
      card_count: clampCardCount((existing?.card_count ?? 0) + amount),
      level: existing?.level ?? 1,
    },
    { onConflict: "profile_id,skill_id" },
  );

  if (error) throw error;
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

function skillTitle(skillId: string) {
  const skill = [...ADDITION_SKILLS, ...SUBTRACTION_SKILLS].find((entry) => entry.id === skillId);
  if (skill) return skill.title;
  const divisionRow = skillId.match(/^division\.row\.(\d+)$/)?.[1];
  if (divisionRow) return `Divide by ${divisionRow}`;
  const row = skillId.match(/^multiplication\.row\.(\d+)$/)?.[1];
  return row ? `${row}s` : skillId;
}

function skillDescription(skillId: string) {
  const skill = [...ADDITION_SKILLS, ...SUBTRACTION_SKILLS].find((entry) => entry.id === skillId);
  if (skill) return skill.description;
  const divisionRow = skillId.match(/^division\.row\.(\d+)$/)?.[1];
  if (divisionRow) return `Division facts for dividing by ${divisionRow}. Higher levels deal more damage in battle.`;
  const row = skillId.match(/^multiplication\.row\.(\d+)$/)?.[1];
  if (row) return `Times-table facts for the ${row}s. Higher levels deal more damage in battle.`;
  return "Collect cards from battles to level this up.";
}

function skillUnlockHint(skillId: string) {
  const skill = [...ADDITION_SKILLS, ...SUBTRACTION_SKILLS].find((entry) => entry.id === skillId);
  if (skill?.prerequisiteId) {
    return `Master ${skillTitle(skill.prerequisiteId)} to unlock this concept.`;
  }
  if (skillId.startsWith("multiplication.")) {
    return "Unlock this number from chests and battles to start collecting cards.";
  }
  return "Keep playing to unlock this card.";
}

function cardDetailGlyph(skillId: string) {
  const divisionRow = skillId.match(/^division\.row\.(\d+)$/)?.[1];
  if (divisionRow) return divisionRow;
  const row = skillId.match(/^multiplication\.row\.(\d+)$/)?.[1];
  if (row) return row;
  return skillIcon(skillId);
}

function skillIcon(skillId: string) {
  const icons: Record<string, string> = {
    "addition.single-digit": "N",
    "addition.doubles": "2+2",
    "addition.near-doubles": "6+5",
    "addition.make-ten": "10",
    "addition.eleven-twenty": "NN",
    "addition.three": "1+2+3",
    "addition.ten-multiples": "10+20",
    "addition.simple-two-digit": "23+14",
    "addition.regrouping-ones": "27+15",
    "addition.two-digit": "48+37",
  };
  if (icons[skillId]) return icons[skillId];
  if (skillId.startsWith("subtraction.")) return "−";
  if (skillId.startsWith("division.")) return "÷";
  return "+";
}
