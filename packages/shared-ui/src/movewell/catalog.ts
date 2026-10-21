// Display names and game metadata for the TV. IDs match packages/shared/catalog.mjs (the source of truth);
// names are repeated here because Metro bundles TypeScript, not that .mjs file.
import { Plan, PlanExercise, Today } from './types';

export const EXERCISE_NAMES: Record<string, string> = {
  sit_to_stand: 'Sit to stand',
  standing_march: 'Standing march',
  arm_raise: 'Arm raises',
  side_leg_raise: 'Side leg raise',
  balance_hold: 'Balance hold',
  jumping_jacks: 'Jumping jacks',
  punches: 'Punches',
  squats: 'Squats',
  seated_knee_lift: 'Seated knee lifts',
  seated_march: 'Seated march',
  seated_arm_raise: 'Seated arm raises',
  seated_side_reach: 'Seated side reach',
  seated_tall_hold: 'Sit tall hold',
  seated_arm_jacks: 'Seated arm jacks',
  seated_punches: 'Seated punches',
  breathing: 'Paced breathing',
  frog_jump: 'Frog jumps',
  flamingo_balance: 'Flamingo balance',
  bear_steps: 'Bear stomps',
  crab_walk: 'Crab steps',
  star_jumps: 'Star jumps',
  side_steps: 'Side steps',
  freeze: 'Freeze like a statue',
  chair_stand_test: 'Chair-stand test',
};

export const exerciseName = (id: string) => EXERCISE_NAMES[id] ?? id.replace(/_/g, ' ');

/** Moves the phone can count today (apps/phone/src/lib/pose/detectors.js). */
export const PHONE_COUNTS = new Set([
  'sit_to_stand', 'arm_raise', 'seated_arm_raise', 'breathing', 'squats', 'frog_jump', 'jumping_jacks', 'star_jumps',
  'seated_arm_jacks', 'punches', 'seated_punches', 'balance_hold', 'flamingo_balance', 'seated_tall_hold', 'chair_stand_test',
  'standing_march', 'bear_steps', 'side_steps', 'crab_walk', 'freeze',
]);

/** How a move is measured: reps, seconds held, or stands in a fixed 30 seconds. */
export type MoveKind = 'reps' | 'hold' | 'timed';
const HOLDS = new Set(['balance_hold', 'flamingo_balance', 'seated_tall_hold', 'freeze']);
export const moveKind = (id: string): MoveKind => (id === 'chair_stand_test' ? 'timed' : HOLDS.has(id) ? 'hold' : 'reps');
export const CHAIR_TEST_SECONDS = 30;

export interface GameInfo {
  name: string;
  icon: string;
  blurb: string;
  playable: boolean;
  color: string; // card and scene accent
  kids?: boolean;
}

export const GAMES: Record<string, GameInfo> = {
  boss_battle: { name: 'Boss Battle', icon: '👾', blurb: 'Squats, punches and jumps power your attacks.', playable: true, color: '#8B5CF6' },
  pop_bubbles: { name: 'Pop the Bubbles', icon: '🫧', blurb: 'Reach up and out to pop floating bubbles.', playable: true, color: '#38BDF8' },
  balance_bridge: { name: 'Balance Bridge', icon: '🌉', blurb: 'Hold your balance to cross, then a 30-second chair-stand test.', playable: true, color: '#F59E0B' },
  garden_grow: { name: 'Garden Grow', icon: '🌱', blurb: 'Every rep waters a plant until it blooms.', playable: true, color: '#22C55E' },
  calm_river: { name: 'Calm River', icon: '🛶', blurb: 'Slow breathing and gentle arm moves guide your boat.', playable: true, color: '#A78BFA' },
  jungle_quest: { name: 'Jungle Quest', icon: '🐸', blurb: 'A story adventure: frog jumps, flamingo balance, bear stomps and crab steps.', playable: true, color: '#16A34A', kids: true },
  superhero_training: { name: 'Superhero Training', icon: '🦸', blurb: 'Punches and squats unlock your powers.', playable: true, color: '#EF4444', kids: true },
  freeze_dance: { name: 'Freeze Dance', icon: '🕺', blurb: 'Dance on the disco floor, then freeze like a statue!', playable: true, color: '#EC4899', kids: true },
  floor_is_lava: { name: 'Floor Is Lava', icon: '🌋', blurb: 'Side-step and hop across the stones to the cool river.', playable: true, color: '#F97316', kids: true },
};

/** Story games: a narrator reads a chapter before each move (kids). */
export const STORY_GAMES = new Set(['jungle_quest', 'freeze_dance', 'floor_is_lava']);

export interface ModeInfo {
  id: Plan['mode'];
  name: string;
  icon: string;
  color: string;
  blurb: string;
  games: string[];
}

export const MODES: ModeInfo[] = [
  { id: 'steady', name: 'Steady', icon: '🧘', color: '#38BDF8', blurb: 'Balance and fall prevention', games: ['balance_bridge', 'garden_grow', 'pop_bubbles', 'boss_battle'] },
  { id: 'fit', name: 'Fit', icon: '💪', color: '#FF9F5A', blurb: 'Strength and cardio at home', games: ['boss_battle', 'pop_bubbles', 'garden_grow'] },
  { id: 'calm', name: 'Calm', icon: '🌊', color: '#A78BFA', blurb: '2–5 minutes for mood and energy', games: ['calm_river', 'garden_grow', 'pop_bubbles'] },
  { id: 'kids', name: 'Kids', icon: '🦁', color: '#FACC15', blurb: 'Story games for ages 5–12', games: ['superhero_training', 'jungle_quest', 'freeze_dance', 'floor_is_lava'] },
  { id: 'recover', name: 'Recover', icon: '🩹', color: '#4ADE80', blurb: 'Physio exercises (preview)', games: ['garden_grow', 'pop_bubbles', 'balance_bridge'] },
];

export const BADGE_NAMES: Record<string, string> = {
  first_steps: 'First steps',
  streak_3: '3 days moving',
  streak_7: '7 days moving',
  mood_lifter: 'Mood lifter',
  garden_bloom: 'Full bloom',
  moves_100: '100 moves',
  moves_500: '500 moves',
  steady_feet: 'Steady feet',
  chair_champ: 'Chair champ',
  calm_keeper: 'Calm keeper',
};

export const AVATARS: Record<string, string> = {
  fox: '🦊', panda: '🐼', robot: '🤖', unicorn: '🦄', dino: '🦖', owl: '🦉', cat: '🐱', astronaut: '🧑‍🚀',
};

export const GARDEN_STAGES = ['🌰', '🌱', '🌿', '🪴', '🌷', '🌻'];

const ADAPTED_TEXT: Record<Today['adapted'], string> = {
  planned: 'As planned',
  feeling_good: 'A little harder today: you feel good',
  low_mood: 'Gentler and shorter today',
  low_energy: 'Gentler and shorter today',
  pain: 'Seated moves today, to keep you comfortable',
};
export const adaptedText = (a: Today['adapted']) => ADAPTED_TEXT[a] ?? ADAPTED_TEXT.planned;

/**
 * Boss Battle moves for this person: today's plan when it is a Boss Battle day, otherwise safe defaults
 * that respect posture, age and knee pain. Only moves the phone can count; at most 10 reps each.
 */
export function bossMoves(plan: Plan | null, today: Today | null, isKid: boolean): PlanExercise[] {
  const cap = (list: PlanExercise[]) => list.map((e) => ({ id: e.id, target: Math.min(e.target, 10) }));
  if (today?.game === 'boss_battle') {
    const counted = today.exercises.filter((e) => PHONE_COUNTS.has(e.id));
    if (counted.length) return cap(counted);
  }
  const c = moveContext(plan, today);
  const standing = isKid ? ['squats', 'punches', 'star_jumps'] : c.older ? ['sit_to_stand', 'punches', 'arm_raise'] : ['squats', 'punches', 'jumping_jacks'];
  return cap(pickMoves(standing, ['seated_punches', 'seated_arm_jacks', 'seated_arm_raise'], c));
}

// ---------------------------------------------------------------- safety, shared by every game and "just one move"
interface MoveContext {
  seated: boolean;
  sore: Set<string>;
  older: boolean; // older adult or holds a chair: no jumping, no deep squats
  gentle: boolean; // aches all over: low impact only, fewest reps
  reps: number;
  seconds: number;
}

export function moveContext(plan: Plan | null, today: Today | null): MoveContext {
  const ctx = plan?.ctx;
  const sore = new Set(ctx?.painAreas ?? []);
  const gentle = sore.has('full_body');
  const level = gentle ? 1 : plan?.intensity ?? 2;
  return {
    seated: plan?.posture === 'seated' || today?.adapted === 'pain',
    sore,
    older: ctx?.who === 'older_adult' || ctx?.mobility === 'chair',
    gentle,
    reps: level === 1 ? 6 : level === 3 ? 12 : 8,
    seconds: level === 1 ? 15 : level === 3 ? 30 : 20,
  };
}

const JUMPS = new Set(['jumping_jacks', 'star_jumps', 'frog_jump']);
const LEG_HEAVY = new Set(['squats', 'sit_to_stand', 'jumping_jacks', 'star_jumps', 'frog_jump']);
const HIP_MOVES = new Set(['standing_march', 'side_steps', 'bear_steps', 'crab_walk']);
const OVERHEAD = new Set(['arm_raise', 'seated_arm_raise', 'seated_arm_jacks', 'jumping_jacks', 'star_jumps']);

export function isSafeMove(id: string, c: MoveContext): boolean {
  if ((c.older || c.gentle) && (JUMPS.has(id) || id === 'squats')) return false;
  if ((c.sore.has('knees') || c.sore.has('ankles')) && LEG_HEAVY.has(id)) return false;
  if (c.sore.has('hips') && (LEG_HEAVY.has(id) || HIP_MOVES.has(id))) return false;
  if ((c.sore.has('wrists') || c.sore.has('shoulders')) && id.includes('punches')) return false;
  if (c.sore.has('shoulders') && OVERHEAD.has(id)) return false;
  return true;
}

const targetFor = (id: string, c: MoveContext) => (id === 'freeze' ? 5 : moveKind(id) === 'hold' ? c.seconds : id === 'breathing' ? 6 : c.reps);

/** The safe ones of these moves (seated list when seated); breathing if nothing is left. */
function pickMoves(standing: string[], seated: string[], c: MoveContext): PlanExercise[] {
  let ids = (c.seated ? seated : standing).filter((id) => isSafeMove(id, c));
  if (!ids.length) ids = ['breathing'];
  return ids.map((id) => ({ id, target: targetFor(id, c) }));
}

/** Story games need one move per chapter: keep the order, repeat safe moves to fill four chapters. */
function storyMoves(standing: string[], seated: string[], c: MoveContext): PlanExercise[] {
  const safe = (c.seated ? seated : standing).map((id) => (isSafeMove(id, c) ? id : null));
  const fallback = safe.find(Boolean) ?? 'seated_arm_raise';
  return safe.map((id) => id ?? fallback).map((id) => ({ id, target: targetFor(id, c) }));
}

/** Pop the Bubbles: reaching up and out, plus marching to the next bubble. */
export const popMoves = (plan: Plan | null, today: Today | null) =>
  pickMoves(['arm_raise', 'punches', 'standing_march'], ['seated_arm_raise', 'seated_punches', 'seated_arm_jacks'], moveContext(plan, today));

/** Garden Grow: gentle strength. Every rep waters the plant. */
export const gardenMoves = (plan: Plan | null, today: Today | null) =>
  pickMoves(['sit_to_stand', 'standing_march', 'arm_raise'], ['seated_arm_raise', 'seated_arm_jacks', 'seated_punches'], moveContext(plan, today));

/** Freeze Dance (kids): dance, freeze, dance, freeze. */
export const freezeMoves = (plan: Plan | null, today: Today | null) =>
  storyMoves(['star_jumps', 'freeze', 'punches', 'freeze'], ['seated_arm_jacks', 'freeze', 'seated_punches', 'freeze'], moveContext(plan, today)).map((m) =>
    m.id === 'freeze' ? m : { ...m, target: Math.min(m.target, 8) },
  );

/** Floor Is Lava (kids): side-steps and small soft hops across the stones. */
export const lavaMoves = (plan: Plan | null, today: Today | null) =>
  storyMoves(['side_steps', 'frog_jump', 'side_steps', 'frog_jump'], ['seated_arm_jacks', 'seated_punches', 'seated_arm_raise', 'seated_arm_jacks'], moveContext(plan, today)).map(
    (m) => ({ ...m, target: Math.min(m.target, 6) }),
  );

/** Calm River: slow breathing with arm raises, then a few gentle arm raises. Short and with no fail state. */
export function calmMoves(plan: Plan | null, today: Today | null): PlanExercise[] {
  const seated = plan?.posture === 'seated' || today?.adapted === 'pain';
  const sore = new Set(plan?.ctx?.painAreas ?? []);
  const breaths = { id: 'breathing', target: 6 };
  if (sore.has('shoulders')) return [{ id: 'breathing', target: 8 }];
  return [breaths, { id: seated ? 'seated_arm_raise' : 'arm_raise', target: 6 }];
}

/**
 * Balance Bridge: a timed balance hold (sit-tall hold when seated), then the 30-second chair-stand test
 * for people who can stand without knee or hip pain. Hold targets are seconds.
 */
export function balanceMoves(plan: Plan | null, today: Today | null): PlanExercise[] {
  const seated = plan?.posture === 'seated' || today?.adapted === 'pain';
  const sore = new Set(plan?.ctx?.painAreas ?? []);
  const seconds = plan?.intensity === 1 ? 15 : plan?.intensity === 3 ? 30 : 20;
  if (seated) return [{ id: 'seated_tall_hold', target: seconds }];
  const moves: PlanExercise[] = [{ id: 'balance_hold', target: seconds }];
  if (!sore.has('knees') && !sore.has('hips')) moves.push({ id: 'chair_stand_test', target: CHAIR_TEST_SECONDS });
  return moves;
}

/**
 * Jungle Quest chapters, in story order (river, log, cave, beach). Standing, low-impact moves only;
 * seated kids get arm-based versions so the story still works from a chair or wheelchair.
 */
export function jungleMoves(plan: Plan | null, today: Today | null): PlanExercise[] {
  const seated = plan?.posture === 'seated' || today?.adapted === 'pain';
  if (seated) {
    return [
      { id: 'seated_arm_jacks', target: 6 },
      { id: 'seated_tall_hold', target: 8 },
      { id: 'seated_punches', target: 10 },
      { id: 'seated_arm_raise', target: 6 },
    ];
  }
  return [
    { id: 'frog_jump', target: 5 },
    { id: 'flamingo_balance', target: 8 },
    { id: 'bear_steps', target: 10 },
    { id: 'crab_walk', target: 6 },
  ];
}

export const STICKER_EMOJI: Record<string, string> = {
  parrot: '🦜', tiger_cub: '🐯', rocket: '🚀', rainbow: '🌈', starfish: '⭐', dino: '🦕', comet: '☄️', sunflower: '🌻', whale: '🐋', kite: '🪁',
};

/** Moves for any playable game, already filtered for this person's safety. */
export function movesFor(game: string, plan: Plan | null, today: Today | null, isKid: boolean): PlanExercise[] {
  if (game === 'jungle_quest') return jungleMoves(plan, today);
  if (game === 'freeze_dance') return freezeMoves(plan, today);
  if (game === 'floor_is_lava') return lavaMoves(plan, today);
  if (game === 'calm_river') return calmMoves(plan, today);
  if (game === 'balance_bridge') return balanceMoves(plan, today);
  if (game === 'pop_bubbles') return popMoves(plan, today);
  if (game === 'garden_grow') return gardenMoves(plan, today);
  return bossMoves(plan, today, isKid);
}

/** Games people can pick themselves (playable now). */
export const pickableGames = (isKid: boolean) =>
  isKid ? ['jungle_quest', 'superhero_training', 'freeze_dance', 'floor_is_lava'] : ['boss_battle', 'pop_bubbles', 'garden_grow', 'balance_bridge', 'calm_river'];

/**
 * "Just one move" choices: moves the phone can count, filtered the same way as the planned sessions
 * (seated when needed, nothing that loads a sore joint, no jumping for older adults or chair users).
 */
export function singleMoves(plan: Plan | null, today: Today | null, isKid: boolean): PlanExercise[] {
  const standing = isKid
    ? ['frog_jump', 'star_jumps', 'punches', 'squats', 'bear_steps', 'crab_walk', 'flamingo_balance', 'freeze']
    : ['sit_to_stand', 'squats', 'arm_raise', 'punches', 'jumping_jacks', 'standing_march', 'side_steps', 'balance_hold', 'breathing'];
  return pickMoves(standing, ['seated_arm_raise', 'seated_punches', 'seated_arm_jacks', 'seated_tall_hold', 'breathing'], moveContext(plan, today));
}

/** The game a single move is played in: breathing on the river, holds on the bridge, the rest against the monster. */
export function gameForMove(id: string, isKid: boolean): string {
  if (id === 'breathing') return 'calm_river';
  if (id === 'freeze') return 'freeze_dance';
  if (moveKind(id) === 'hold') return 'balance_bridge'; // the monster's health comes from reps, so holds go on the bridge
  return isKid ? 'superhero_training' : 'boss_battle';
}

/** The game to play for today's planned game: the planned one when it's ready, otherwise Boss Battle. */
export const playableGame = (game: string) => (GAMES[game]?.playable ? game : 'boss_battle');
