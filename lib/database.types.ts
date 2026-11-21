export type ChestState = "empty" | "waiting" | "unlocking" | "ready" | "opened";
export type ChestRarity = "common" | "rare" | "epic" | "legendary";
export type RewardType = "number" | "coins" | "cards";
export type Operation = "multiplication" | "addition" | "subtraction" | "division";
export type SkillRewardType = "coins" | "cards" | "unlock";

export type Profile = {
  id: string;
  auth_user_id: string | null;
  username: string;
  pin_code: string;
  display_name: string;
  sprite_name: string;
  level: number;
  xp: number;
  coins: number;
  created_at: string;
  updated_at: string;
};

export type Teacher = {
  id: string;
  auth_user_id: string;
  email: string;
  display_name: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type StudentProgress = {
  profile_id: string;
  unlocked_numbers: number[];
  selected_number: number | null;
  matches_played: number;
  map_revealed: boolean;
  created_at: string;
  updated_at: string;
};

export type ChestSlot = {
  id: string;
  profile_id: string;
  slot_index: number;
  state: ChestState;
  rarity: ChestRarity;
  reward_type: RewardType | null;
  reward_number: number | null;
  reward_coins: number | null;
  reward_card_count: number | null;
  earned_at: string | null;
  unlock_started_at: string | null;
  ready_at: string | null;
  opened_at: string | null;
};

export type NumberCard = {
  profile_id: string;
  number: number;
  card_count: number;
  level: number;
  created_at: string;
  updated_at: string;
};

export type SkillCard = {
  profile_id: string;
  skill_id: string;
  operation: Operation;
  card_count: number;
  level: number;
  unlocked_at: string;
  created_at: string;
  updated_at: string;
};

export type ChestReward = {
  id: string;
  chest_id: string;
  reward_order: number;
  reward_type: SkillRewardType;
  operation: Operation | null;
  skill_id: string | null;
  coin_amount: number | null;
  card_amount: number | null;
  source_match_id: string | null;
  claimed_at: string | null;
  created_at: string;
};

export type MatchRow = {
  id: string;
  profile_id: string;
  selected_numbers: number[];
  correct_count: number;
  incorrect_count: number;
  duration_ms: number | null;
  xp_earned: number;
  coins_earned: number;
  chest_earned: boolean;
  operations: Operation[];
  created_at: string;
};

export type ProblemAttempt = {
  id: string;
  match_id: string;
  profile_id: string;
  operation: Operation;
  skill_id: string;
  operand_a: number;
  operand_b: number;
  operand_c: number | null;
  expected_answer: number;
  student_answer: number | null;
  is_correct: boolean;
  time_ms: number | null;
  hints_used: number;
  attempt_order: number;
  created_at: string;
};

export type ArenaSpeedProfile = {
  profile_id: string;
  arena_id: string;
  ending_milestone_id: string;
  carry_milestone_id: string;
  carry_multiplier: number;
  battles_recorded: number;
  last_fast_rate: number;
  last_accuracy: number;
  last_median_time_seconds: number;
  last_battle_at: string | null;
  created_at: string;
  updated_at: string;
};

export type MatchSpeedStatsRow = {
  match_id: string;
  profile_id: string;
  arena_id: string;
  starting_milestone_id: string;
  ending_milestone_id: string;
  carry_milestone_id: string;
  attempts: number;
  correct_count: number;
  accuracy: number;
  fast_count: number;
  fast_rate: number;
  median_time_seconds: number;
  average_clock_used: number;
  created_at: string;
};

export type CraftersProgress = {
  profile_id: string;
  stamina: number;
  stamina_refilled_at: string;
  active_mining_resource_id: string | null;
  active_mining_resource_name: string | null;
  active_mining_ore_id: string | null;
  active_mining_ore_name: string | null;
  mining_complete_at: string | null;
  created_at: string;
  updated_at: string;
};

export type CraftersInventory = {
  profile_id: string;
  ore_id: string;
  ore_name: string;
  quantity: number;
  created_at: string;
  updated_at: string;
};

export type ConceptAssignment = {
  id: string;
  profile_id: string;
  concept_id: string;
  teacher_id: string;
  created_at: string;
};

export type Database = {
  public: {
    Tables: {
      curriculum_concepts: {
        Row: { id: string; title: string };
        Insert: { id: string; title: string };
        Update: { title?: string };
        Relationships: [];
      };
      concept_assignments: {
        Row: ConceptAssignment;
        Insert: { id?: string; profile_id: string; concept_id: string; teacher_id: string; created_at?: string };
        Update: never;
        Relationships: [];
      };
      profiles: {
        Row: Profile;
        Insert: {
          id?: string;
          auth_user_id?: string | null;
          username: string;
          pin_code: string;
          display_name?: string;
          sprite_name?: string;
          level?: number;
          xp?: number;
          coins?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Omit<Profile, "id" | "created_at">>;
        Relationships: [];
      };
      teachers: {
        Row: Teacher;
        Insert: {
          id?: string;
          auth_user_id: string;
          email: string;
          display_name?: string;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Omit<Teacher, "id" | "auth_user_id" | "created_at">>;
        Relationships: [];
      };
      student_progress: {
        Row: StudentProgress;
        Insert: {
          profile_id: string;
          unlocked_numbers?: number[];
          selected_number?: number | null;
          matches_played?: number;
          map_revealed?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Omit<StudentProgress, "profile_id" | "created_at">>;
        Relationships: [];
      };
      chest_slots: {
        Row: ChestSlot;
        Insert: {
          id?: string;
          profile_id: string;
          slot_index: number;
          state?: ChestState;
          rarity?: ChestRarity;
          reward_type?: RewardType | null;
          reward_number?: number | null;
          reward_coins?: number | null;
          reward_card_count?: number | null;
          earned_at?: string | null;
          unlock_started_at?: string | null;
          ready_at?: string | null;
          opened_at?: string | null;
        };
        Update: Partial<Omit<ChestSlot, "id" | "profile_id">>;
        Relationships: [];
      };
      number_cards: {
        Row: NumberCard;
        Insert: {
          profile_id: string;
          number: number;
          card_count?: number;
          level?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Omit<NumberCard, "profile_id" | "number" | "created_at">>;
        Relationships: [];
      };
      skill_cards: {
        Row: SkillCard;
        Insert: {
          profile_id: string;
          skill_id: string;
          operation: Operation;
          card_count?: number;
          level?: number;
          unlocked_at?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Omit<SkillCard, "profile_id" | "skill_id" | "created_at">>;
        Relationships: [];
      };
      chest_rewards: {
        Row: ChestReward;
        Insert: {
          id?: string;
          chest_id: string;
          reward_order: number;
          reward_type: SkillRewardType;
          operation?: Operation | null;
          skill_id?: string | null;
          coin_amount?: number | null;
          card_amount?: number | null;
          source_match_id?: string | null;
          claimed_at?: string | null;
          created_at?: string;
        };
        Update: Partial<Omit<ChestReward, "id" | "chest_id" | "created_at">>;
        Relationships: [];
      };
      matches: {
        Row: MatchRow;
        Insert: {
          id?: string;
          profile_id: string;
          selected_numbers: number[];
          correct_count?: number;
          incorrect_count?: number;
          duration_ms?: number | null;
          xp_earned?: number;
          coins_earned?: number;
          chest_earned?: boolean;
          operations?: Operation[];
          created_at?: string;
        };
        Update: Partial<Omit<MatchRow, "id" | "profile_id" | "created_at">>;
        Relationships: [];
      };
      problem_attempts: {
        Row: ProblemAttempt;
        Insert: {
          id?: string;
          match_id: string;
          profile_id: string;
          operation: Operation;
          skill_id: string;
          operand_a: number;
          operand_b: number;
          operand_c?: number | null;
          expected_answer: number;
          student_answer?: number | null;
          is_correct: boolean;
          time_ms?: number | null;
          hints_used?: number;
          attempt_order: number;
          created_at?: string;
        };
        Update: Partial<Omit<ProblemAttempt, "id" | "match_id" | "profile_id" | "created_at">>;
        Relationships: [];
      };
      arena_speed_profiles: {
        Row: ArenaSpeedProfile;
        Insert: {
          profile_id: string;
          arena_id: string;
          ending_milestone_id?: string;
          carry_milestone_id?: string;
          carry_multiplier?: number;
          battles_recorded?: number;
          last_fast_rate?: number;
          last_accuracy?: number;
          last_median_time_seconds?: number;
          last_battle_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Omit<ArenaSpeedProfile, "profile_id" | "arena_id" | "created_at">>;
        Relationships: [];
      };
      match_speed_stats: {
        Row: MatchSpeedStatsRow;
        Insert: {
          match_id: string;
          profile_id: string;
          arena_id: string;
          starting_milestone_id?: string;
          ending_milestone_id?: string;
          carry_milestone_id?: string;
          attempts?: number;
          correct_count?: number;
          accuracy?: number;
          fast_count?: number;
          fast_rate?: number;
          median_time_seconds?: number;
          average_clock_used?: number;
          created_at?: string;
        };
        Update: Partial<Omit<MatchSpeedStatsRow, "match_id" | "profile_id" | "created_at">>;
        Relationships: [];
      };
      crafters_progress: {
        Row: CraftersProgress;
        Insert: {
          profile_id: string;
          stamina?: number;
          stamina_refilled_at?: string;
          active_mining_resource_id?: string | null;
          active_mining_resource_name?: string | null;
          active_mining_ore_id?: string | null;
          active_mining_ore_name?: string | null;
          mining_complete_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Omit<CraftersProgress, "profile_id" | "created_at">>;
        Relationships: [];
      };
      crafters_inventory: {
        Row: CraftersInventory;
        Insert: {
          profile_id: string;
          ore_id: string;
          ore_name: string;
          quantity?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Omit<CraftersInventory, "profile_id" | "ore_id" | "created_at">>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      get_concept_assignments: {
        Args: { player_username: string; player_pin: string };
        Returns: { concept_id: string }[];
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
