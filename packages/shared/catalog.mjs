// PlayMotion shared catalog: the exercise, game and badge IDs used by the TV app,
// the phone pose engine and the backend. This file is the source of truth;
// scripts/sync-shared.ps1 copies it into infra/src/lib/shared/ before a deploy.

export const MODES = ['steady', 'fit', 'calm', 'kids', 'recover'];

export const GOAL_TO_MODE = {
  balance: 'steady',
  lose_weight: 'fit',
  get_stronger: 'fit',
  feel_calmer: 'calm',
  recover: 'recover',
};

export const WHO = ['adult', 'older_adult', 'kid'];
export const MOBILITY = ['unsupported', 'chair', 'seated', 'wheelchair'];
// full_body = general aches or stiffness all over: only low-impact moves, gentlest intensity.
export const PAIN_AREAS = ['neck', 'shoulders', 'back', 'hips', 'knees', 'ankles', 'wrists', 'full_body'];
export const painLabel = (p) => (p === 'full_body' ? 'whole body' : p);
export const ACTIVITY_LEVELS = ['low', 'some', 'active'];
export const SESSION_MINUTES = [5, 10, 15, 20];

// Coach languages: each has an Amazon Polly voice (infra/src/lib/voice.mjs) and translated spoken
// lines (infra/src/lib/templates.mjs). Hindi doubles as spoken Urdu (Polly has no Urdu voice).
export const LANGUAGES = {
  'en-US': 'English',
  'hi-IN': 'Hindi',
  'es-US': 'Spanish',
  'ar-AE': 'Arabic',
};

// posture: what the body needs to do ('standing' | 'seated' | 'any').
// impact: 'low' | 'medium' | 'high'.
// loads: joints that take load; used to swap moves out for reported pain areas.
// seatedAlt / chairAlt / gentleAlt: safer substitutes, tried in that order of fit.
export const EXERCISES = {
  // Adult standing moves
  sit_to_stand: { name: 'Sit to stand', posture: 'standing', impact: 'low', loads: ['knees', 'hips'], seatedAlt: 'seated_knee_lift', unit: 'reps' },
  standing_march: { name: 'Standing march', posture: 'standing', impact: 'low', loads: ['hips'], seatedAlt: 'seated_march', unit: 'reps' },
  arm_raise: { name: 'Arm raises', posture: 'standing', impact: 'low', loads: ['shoulders'], seatedAlt: 'seated_arm_raise', unit: 'reps' },
  side_leg_raise: { name: 'Side leg raise (hold a chair)', posture: 'standing', impact: 'low', loads: ['hips'], seatedAlt: 'seated_side_reach', unit: 'reps' },
  balance_hold: { name: 'Balance hold', posture: 'standing', impact: 'low', loads: ['ankles'], seatedAlt: 'seated_tall_hold', unit: 'seconds' },
  jumping_jacks: { name: 'Jumping jacks', posture: 'standing', impact: 'high', loads: ['knees', 'ankles'], chairAlt: 'seated_arm_jacks', gentleAlt: 'standing_march', seatedAlt: 'seated_arm_jacks', unit: 'reps' },
  punches: { name: 'Punches', posture: 'standing', impact: 'low', loads: ['shoulders', 'wrists'], seatedAlt: 'seated_punches', unit: 'reps' },
  squats: { name: 'Squats', posture: 'standing', impact: 'medium', loads: ['knees', 'hips'], chairAlt: 'sit_to_stand', gentleAlt: 'sit_to_stand', seatedAlt: 'seated_knee_lift', unit: 'reps' },

  // Seated versions (chair or wheelchair): arms and upper body
  seated_knee_lift: { name: 'Seated knee lifts', posture: 'seated', impact: 'low', loads: ['hips'], unit: 'reps' },
  seated_march: { name: 'Seated march', posture: 'seated', impact: 'low', loads: ['hips'], unit: 'reps' },
  seated_arm_raise: { name: 'Seated arm raises', posture: 'seated', impact: 'low', loads: ['shoulders'], unit: 'reps' },
  seated_side_reach: { name: 'Seated side reach', posture: 'seated', impact: 'low', loads: ['back'], unit: 'reps' },
  seated_tall_hold: { name: 'Sit tall hold', posture: 'seated', impact: 'low', loads: [], unit: 'seconds' },
  seated_arm_jacks: { name: 'Seated arm jacks', posture: 'seated', impact: 'low', loads: ['shoulders'], unit: 'reps' },
  seated_punches: { name: 'Seated punches', posture: 'seated', impact: 'low', loads: ['shoulders', 'wrists'], unit: 'reps' },

  // Calm
  breathing: { name: 'Paced breathing', posture: 'any', impact: 'low', loads: [], unit: 'breaths' },

  // Kids (safe movement only: no flips, no high jumps)
  frog_jump: { name: 'Frog jumps (small hops)', posture: 'standing', impact: 'medium', loads: ['knees', 'ankles'], seatedAlt: 'seated_arm_jacks', unit: 'reps' },
  flamingo_balance: { name: 'Flamingo balance', posture: 'standing', impact: 'low', loads: ['ankles'], seatedAlt: 'seated_tall_hold', unit: 'seconds' },
  // Standing versions of bear and crab walks: safe indoors and countable by the phone camera.
  bear_steps: { name: 'Bear stomps (knees up)', posture: 'standing', impact: 'low', loads: ['hips'], seatedAlt: 'seated_march', unit: 'reps' },
  crab_walk: { name: 'Crab steps (sideways)', posture: 'standing', impact: 'low', loads: ['hips'], seatedAlt: 'seated_side_reach', unit: 'reps' },
  star_jumps: { name: 'Star jumps (small)', posture: 'standing', impact: 'medium', loads: ['knees', 'ankles'], seatedAlt: 'seated_arm_jacks', unit: 'reps' },
  side_steps: { name: 'Side steps', posture: 'standing', impact: 'low', loads: ['hips'], seatedAlt: 'seated_march', unit: 'reps' },
  freeze: { name: 'Dance and freeze', posture: 'any', impact: 'low', loads: [], unit: 'rounds' },
};

export const GAMES = {
  pop_bubbles: { name: 'Pop the Bubbles', modes: ['steady', 'fit', 'calm', 'recover', 'kids'], exercises: ['arm_raise', 'side_leg_raise', 'standing_march'], trains: 'reach and weight shift', competitive: false },
  balance_bridge: { name: 'Balance Bridge', modes: ['steady', 'recover'], exercises: ['balance_hold', 'side_leg_raise', 'standing_march'], trains: 'balance', competitive: false },
  boss_battle: { name: 'Boss Battle', modes: ['fit'], exercises: ['squats', 'punches', 'jumping_jacks'], trains: 'strength and cardio', competitive: true },
  garden_grow: { name: 'Garden Grow', modes: ['calm', 'steady', 'recover'], exercises: ['sit_to_stand', 'standing_march', 'arm_raise'], trains: 'gentle strength', competitive: false, noFailState: true },
  calm_river: { name: 'Calm River', modes: ['calm'], exercises: ['breathing', 'arm_raise'], trains: 'paced breathing', competitive: false, noFailState: true },
  jungle_quest: { name: 'Jungle Quest', modes: ['kids'], exercises: ['frog_jump', 'flamingo_balance', 'bear_steps', 'crab_walk'], trains: 'balance and coordination', story: true },
  superhero_training: { name: 'Superhero Training', modes: ['kids'], exercises: ['punches', 'squats', 'star_jumps'], trains: 'strength', story: true },
  freeze_dance: { name: 'Freeze Dance', modes: ['kids'], exercises: ['freeze'], trains: 'body control', story: true },
  floor_is_lava: { name: 'Floor Is Lava', modes: ['kids'], exercises: ['side_steps', 'frog_jump'], trains: 'agility', story: true },
};

// Monday..Sunday game rotation per mode.
export const WEEK_TEMPLATES = {
  steady: ['balance_bridge', 'garden_grow', 'pop_bubbles', 'balance_bridge', 'garden_grow', 'pop_bubbles', 'calm_river'],
  fit: ['boss_battle', 'pop_bubbles', 'boss_battle', 'garden_grow', 'boss_battle', 'pop_bubbles', 'calm_river'],
  calm: ['calm_river', 'garden_grow', 'calm_river', 'pop_bubbles', 'calm_river', 'garden_grow', 'calm_river'],
  kids: ['jungle_quest', 'superhero_training', 'freeze_dance', 'floor_is_lava', 'jungle_quest', 'freeze_dance', 'superhero_training'],
  recover: ['garden_grow', 'pop_bubbles', 'balance_bridge', 'garden_grow', 'pop_bubbles', 'balance_bridge', 'calm_river'],
};

export const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export const BADGES = {
  first_steps: { name: 'First steps', description: 'Finished your first session' },
  streak_3: { name: '3 days moving', description: 'Moved 3 days in a row' },
  streak_7: { name: '7 days moving', description: 'Moved 7 days in a row' },
  mood_lifter: { name: 'Mood lifter', description: 'Felt better after 3 sessions' },
  garden_bloom: { name: 'Full bloom', description: 'Grew a garden to full bloom' },
  moves_100: { name: '100 moves', description: '100 reps in total' },
  moves_500: { name: '500 moves', description: '500 reps in total' },
  steady_feet: { name: 'Steady feet', description: 'Held a balance for 30 seconds' },
  chair_champ: { name: 'Chair champ', description: 'Beat your chair-stand score' },
  calm_keeper: { name: 'Calm keeper', description: 'Finished 3 Calm sessions' },
};

export const STICKERS = ['parrot', 'tiger_cub', 'rocket', 'rainbow', 'starfish', 'dino', 'comet', 'sunflower', 'whale', 'kite'];
export const AVATARS = ['fox', 'panda', 'robot', 'unicorn', 'dino', 'owl', 'cat', 'astronaut'];
export const AGE_BANDS = ['5-8', '9-12'];

/**
 * Returns the safest exercise ID for this person: the original if it fits,
 * otherwise the first fitting substitute. Never returns a move that needs a
 * posture, impact level or joint the person can't use. Unknown IDs return null.
 */
export function safeExercise(id, { mobility = 'unsupported', who = 'adult', painAreas = [] } = {}) {
  const pain = new Set((painAreas || []).filter((p) => PAIN_AREAS.includes(p)));
  const seatedOnly = mobility === 'seated' || mobility === 'wheelchair';
  const fits = (eid) => {
    const ex = EXERCISES[eid];
    if (!ex) return false;
    if (seatedOnly && ex.posture === 'standing') return false;
    if (mobility === 'chair' && ex.impact !== 'low') return false;
    if (who === 'older_adult' && ex.impact === 'high') return false;
    if (pain.has('full_body') && ex.impact !== 'low') return false;
    if (ex.loads.some((joint) => pain.has(joint))) return false;
    return true;
  };
  const ex = EXERCISES[id];
  if (!ex) return null;
  if (fits(id)) return id;
  const preferred = mobility === 'chair' ? ex.chairAlt : ex.gentleAlt;
  const candidates = [preferred, ex.chairAlt, ex.gentleAlt, ex.seatedAlt, 'seated_arm_raise', 'seated_march', 'breathing'];
  return candidates.find((c) => c && fits(c)) ?? null;
}
