// Shapes of the PlayMotion HTTP API responses the TV uses (see docs/PROTOCOL.md).

export interface PlanExercise {
  id: string;
  target: number;
}

export interface PlanDay {
  day: string;
  game: string;
  minutes: number;
  intensity: number;
  exercises: PlanExercise[];
}

export interface Today extends PlanDay {
  date: string;
  adapted: 'planned' | 'feeling_good' | 'low_mood' | 'low_energy' | 'pain';
  posture?: string;
  coachLine?: string;
}

export interface Plan {
  mode: 'steady' | 'fit' | 'calm' | 'kids' | 'recover';
  ctx: { mobility: string; who: string; painAreas: string[] };
  intensity: number;
  sessionMinutes: number;
  posture: 'standing' | 'seated';
  week: PlanDay[];
  goals: { weeklyActiveMinutes: number | null; plannedMinutes: number };
  nutrition: { calorieCounting: boolean; bodyNeutral: boolean; waterReminders: boolean; swaps: string[] } | null;
  safetyNotes: string[];
  physioNote?: string;
  explanation: { summary: string; why: string[]; swaps: string[]; firstCoachLine: string | null; source: 'ai' | 'template' };
}

export interface Progress {
  xp: number;
  level: number;
  streak: number;
  bestStreak: number;
  sessions: number;
  totalMinutes: number;
  totalReps: number;
  badges: string[];
  garden: { weekOf: string | null; drops: number; stage: number; gardensGrown: number };
  stars: number;
  stickers: string[];
}

export interface Profile {
  userId: string;
  kind: 'adult' | 'kid';
  displayName?: string | null;
  language: string;
  kid?: { nickname: string; avatar: string; ageBand: string | null };
  familyEnabled?: boolean;
}

export interface PlanResponse {
  profile: Profile;
  plan: Plan;
  today: Today;
  checkedInToday: boolean;
  progress: Progress;
  notices: { kind: string; text: string; at: string }[];
}

export interface OnboardResponse {
  userId: string;
  profile: Profile;
  plan: Plan;
  reminders: { session: boolean; water: boolean };
}

export interface CheckinResponse {
  safety: {
    level: 'ok' | 'gentle' | 'support';
    title?: string;
    message?: string;
    helplines?: { name: string; contact: string }[];
    emergency?: string;
    disclaimer?: string;
  };
  today: Today | null;
  coach?: { line: string; source: string; audioUrl: string | null };
}

export interface SessionResult {
  gained: {
    xp: number;
    level: number;
    levelUp: boolean;
    nextLevelXp: number;
    streak: number;
    newBadges: string[];
    gardenStage: number;
    gardenGrew: boolean;
    moodLift: number;
    sticker: string | null;
  };
  progress: Progress;
  celebration: { line: string; audioUrl: string | null };
  sharedWithFamily: boolean;
  followUp: { suggestSeated: boolean; message: string } | null;
}

export interface ReportDay {
  date: string;
  minutes: number;
  sessions: number;
  moodBefore: number | null;
  moodAfter: number | null;
}

export interface ReportResponse {
  stats: {
    weekStart: string;
    weekEnd: string;
    activeMinutes: number;
    whoTargetMinutes: number | null;
    whoPercent: number | null;
    sessions: number;
    activeDays: number;
    reps: number;
    avgFormScore: number | null;
    moodLift: number | null;
    energyLift: number | null;
    byDay: ReportDay[];
    games: Record<string, number>;
    chairStand: { latest: number; previous: number | null; change: number | null; history: { date: string; stands: number }[] } | null;
    streak: number;
    level: number;
    stars?: number;
    stickers?: string[];
  };
  summary: string;
  source: 'ai' | 'template';
}

export interface VoicePack {
  cues: Record<string, { text: string; url: string | null }>;
}
