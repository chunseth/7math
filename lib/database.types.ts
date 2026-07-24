export type ChestState = "empty" | "waiting" | "unlocking" | "ready" | "opened";
export type ChestRarity = "common" | "rare" | "epic" | "legendary";
export type RewardType = "number" | "coins";

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
  earned_at: string | null;
  unlock_started_at: string | null;
  ready_at: string | null;
  opened_at: string | null;
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
  created_at: string;
};

export type ProblemAttempt = {
  id: string;
  match_id: string;
  profile_id: string;
  factor_a: number;
  factor_b: number;
  student_answer: number | null;
  is_correct: boolean;
  time_ms: number | null;
  hints_used: number;
  attempt_order: number;
  created_at: string;
};

export type Database = {
  public: {
    Tables: {
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
          earned_at?: string | null;
          unlock_started_at?: string | null;
          ready_at?: string | null;
          opened_at?: string | null;
        };
        Update: Partial<Omit<ChestSlot, "id" | "profile_id">>;
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
          factor_a: number;
          factor_b: number;
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
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
