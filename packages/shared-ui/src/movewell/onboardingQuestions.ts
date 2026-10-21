// Onboarding questions, answered with the remote. Keys map to the /onboard request (see buildOnboardBody).
import { Option } from './ui';

export interface Question {
  key: string;
  title: string;
  sub?: string;
  kind: 'single' | 'multi' | 'pin' | 'info' | 'text';
  options?: Option<any>[];
  columns?: number;
  /** Shows a Skip button that answers with skipValue (the backend fills a sensible default). */
  skip?: { label?: string; value: any };
}

// Skipped answers are sent as undefined, so the backend uses its defaults.
const SKIP = { value: undefined };

const WHO: Question = {
  key: 'who',
  title: 'Who will be exercising?',
  sub: 'This sets the right moves, pace and safety for the person in front of the TV.',
  kind: 'single',
  columns: 3,
  options: [
    { value: 'adult', label: 'Adult', sub: 'Ages 18 to 64 · strength, cardio, balance', icon: '🧑' },
    { value: 'older_adult', label: 'Senior', sub: 'Ages 65+ · gentler pace, fall-prevention focus', icon: '🧓' },
    { value: 'kid', label: 'Child', sub: 'Ages 5 to 12 · story games, set up by a parent', icon: '🧒' },
  ],
};

const MOBILITY: Question = {
  key: 'mobility',
  title: 'How do you usually move?',
  sub: 'We only suggest moves that are safe for you.',
  kind: 'single',
  columns: 2,
  options: [
    { value: 'unsupported', label: 'I stand without support', icon: '🚶' },
    { value: 'chair', label: 'I hold a chair for support', icon: '🪑' },
    { value: 'seated', label: 'I exercise seated', icon: '💺' },
    { value: 'wheelchair', label: 'I use a wheelchair', icon: '♿' },
  ],
};

const scale = (labels: string[], icons: string[]): Option<number>[] => labels.map((label, i) => ({ value: i + 1, label, icon: icons[i] }));

export const ADULT_QUESTIONS: Question[] = [
  WHO,
  {
    key: 'goal',
    title: 'What would you like help with?',
    kind: 'single',
    columns: 3,
    options: [
      { value: 'balance', label: 'Better balance', sub: 'Steady mode', icon: '🧘' },
      { value: 'lose_weight', label: 'Lose weight', sub: 'Fit mode', icon: '🔥' },
      { value: 'get_stronger', label: 'Get stronger', sub: 'Fit mode', icon: '💪' },
      { value: 'feel_calmer', label: 'Feel calmer', sub: 'Calm mode', icon: '🌊' },
      { value: 'recover', label: 'Recover after injury', sub: 'Recover mode (preview)', icon: '🩹' },
    ],
  },
  MOBILITY,
  {
    key: 'painAreas',
    title: 'Any pain or stiffness?',
    sub: "Pick all that apply, then choose Done. We'll avoid moves that load them.",
    kind: 'multi',
    options: [
      { value: 'none', label: 'No pain', icon: '👍' },
      { value: 'full_body', label: 'Full body', sub: 'Aches or stiffness all over', icon: '🧍' },
      { value: 'neck', label: 'Neck', icon: '🦒' },
      { value: 'shoulders', label: 'Shoulders', icon: '💪' },
      { value: 'back', label: 'Back', icon: '🔙' },
      { value: 'hips', label: 'Hips', icon: '🦴' },
      { value: 'knees', label: 'Knees', icon: '🦵' },
      { value: 'ankles', label: 'Ankles', icon: '🦶' },
      { value: 'wrists', label: 'Wrists', icon: '✋' },
    ],
    columns: 5,
  },
  {
    key: 'activityLevel',
    title: 'How active are you right now?',
    kind: 'single',
    columns: 3,
    options: [
      { value: 'low', label: 'Mostly sitting', icon: '🛋️' },
      { value: 'some', label: 'Some walking', icon: '🚶' },
      { value: 'active', label: 'Active most days', icon: '🏃' },
    ],
  },
  {
    key: 'mealsPerDay',
    title: 'How many meals or big snacks a day?',
    kind: 'single',
    columns: 4,
    skip: SKIP,
    options: [
      { value: 2, label: '1–2' },
      { value: 3, label: '3' },
      { value: 4, label: '4' },
      { value: 5, label: '5 or more' },
    ],
  },
  {
    key: 'sugaryDrinks',
    title: 'Sugary drinks (soda, sweet tea, juice)?',
    kind: 'single',
    columns: 3,
    skip: SKIP,
    options: [
      { value: 'none', label: 'Rarely', icon: '💧' },
      { value: 'some', label: 'Some days', icon: '🥤' },
      { value: 'daily', label: 'Every day', icon: '🧃' },
    ],
  },
  {
    key: 'eatingOut',
    title: 'Where does most of your food come from?',
    kind: 'single',
    columns: 3,
    skip: SKIP,
    options: [
      { value: 'mostly_home', label: 'Home cooking', icon: '🍲' },
      { value: 'mixed', label: 'A mix', icon: '🥡' },
      { value: 'mostly_outside', label: 'Mostly outside', icon: '🍔' },
    ],
  },
  {
    key: 'sleep',
    title: 'How have you been sleeping?',
    kind: 'single',
    columns: 5,
    skip: SKIP,
    options: scale(['Very badly', 'Badly', 'Okay', 'Well', 'Very well'], ['😫', '😕', '😐', '🙂', '😴']),
  },
  {
    key: 'mood',
    title: 'How has your mood been this week?',
    sub: 'This helps us pace your sessions. It is not a diagnosis.',
    kind: 'single',
    columns: 5,
    skip: SKIP,
    options: scale(['Very low', 'Low', 'Okay', 'Good', 'Great'], ['😞', '🙁', '😐', '🙂', '😄']),
  },
  {
    key: 'sessionMinutes',
    title: 'How long should a session be?',
    kind: 'single',
    columns: 4,
    skip: { label: 'Skip (10 minutes)', value: undefined },
    options: [
      { value: 5, label: '5 minutes', sub: 'A quick boost' },
      { value: 10, label: '10 minutes' },
      { value: 15, label: '15 minutes' },
      { value: 20, label: '20 minutes' },
    ],
  },
  {
    key: 'language',
    title: 'Which language should your coach speak?',
    sub: 'The voice, tips and coaching lines use this language. Screens stay in English for now.',
    kind: 'single',
    columns: 4,
    skip: { label: 'Skip (English)', value: undefined },
    options: [
      { value: 'en-US', label: 'English' },
      { value: 'hi-IN', label: 'हिन्दी / اردو', sub: 'Hindi / Urdu' },
      { value: 'es-US', label: 'Español', sub: 'Spanish' },
      { value: 'ar-AE', label: 'العربية', sub: 'Arabic' },
    ],
  },
  {
    key: 'displayName',
    title: "What's your name?",
    sub: 'Type your name or a nickname. Used in family updates like "Ammi finished today\'s session ✓".',
    kind: 'text',
    skip: SKIP,
  },
  {
    key: 'shareWith',
    title: 'Who should see your progress?',
    kind: 'single',
    columns: 3,
    skip: { label: 'Skip (just me)', value: undefined },
    options: [
      { value: 'nobody', label: 'Just me', icon: '🔒' },
      { value: 'family', label: 'My family', icon: '👨‍👩‍👧' },
      { value: 'physio', label: 'My physio', sub: 'Preview', icon: '🩺' },
    ],
  },
  {
    key: 'reminderTime',
    title: 'When should we remind you to move?',
    kind: 'single',
    columns: 4,
    skip: { label: 'No reminders', value: 'none' },
    options: [
      { value: '09:00', label: 'Morning', sub: '9:00' },
      { value: '13:00', label: 'Afternoon', sub: '13:00' },
      { value: '18:00', label: 'Evening', sub: '18:00' },
      { value: '20:00', label: 'Night', sub: '20:00' },
    ],
  },
];

export const KID_QUESTIONS: Question[] = [
  WHO,
  {
    key: 'parentNote',
    title: 'Grown-up setup',
    sub: 'Kids mode is set up by a parent. We only store a nickname and an avatar: no real name, no photos, no ads, no chat. Please stay nearby while your child plays.',
    kind: 'info',
  },
  {
    key: 'nickname',
    title: 'Pick a hero nickname',
    kind: 'single',
    columns: 3,
    options: ['Star', 'Rocket', 'Tiger', 'Sunny', 'Comet', 'Ace'].map((n) => ({ value: n, label: n })),
  },
  {
    key: 'avatar',
    title: 'Choose an avatar',
    kind: 'single',
    columns: 4,
    options: [
      { value: 'fox', label: 'Fox', icon: '🦊' },
      { value: 'panda', label: 'Panda', icon: '🐼' },
      { value: 'robot', label: 'Robot', icon: '🤖' },
      { value: 'unicorn', label: 'Unicorn', icon: '🦄' },
      { value: 'dino', label: 'Dino', icon: '🦖' },
      { value: 'owl', label: 'Owl', icon: '🦉' },
      { value: 'cat', label: 'Cat', icon: '🐱' },
      { value: 'astronaut', label: 'Astronaut', icon: '🧑‍🚀' },
    ],
  },
  { ...MOBILITY, title: 'How does your child usually move?' },
  {
    key: 'parentPin',
    title: 'Set a 4-digit parent PIN',
    sub: 'You will need it to change Kids settings.',
    kind: 'pin',
  },
];

export const questionsFor = (answers: Record<string, any>) => (answers.who === 'kid' ? KID_QUESTIONS : ADULT_QUESTIONS);

function country(): string | null {
  try {
    const locale = Intl.DateTimeFormat().resolvedOptions().locale ?? '';
    const region = locale.split('-')[1];
    return region && /^[A-Z]{2}$/.test(region) ? region : null;
  } catch {
    return null;
  }
}

function timeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}

export function buildOnboardBody(a: Record<string, any>) {
  const base = { timezone: timeZone(), country: country() };
  if (a.who === 'kid') {
    return {
      ...base,
      answers: { who: 'kid', mobility: a.mobility, language: 'en-US' },
      kid: { nickname: a.nickname, avatar: a.avatar, parentPin: a.parentPin },
    };
  }
  const pain: string[] = (a.painAreas ?? []).filter((p: string) => p !== 'none');
  return {
    ...base,
    answers: {
      who: a.who,
      goal: a.goal,
      mobility: a.mobility,
      painAreas: pain,
      activityLevel: a.activityLevel,
      food: { mealsPerDay: a.mealsPerDay, sugaryDrinks: a.sugaryDrinks, eatingOut: a.eatingOut },
      sleep: a.sleep,
      mood: a.mood,
      sessionMinutes: a.sessionMinutes,
      language: a.language,
      displayName: a.displayName ?? undefined,
      shareWith: a.shareWith,
      reminderTime: a.reminderTime,
      waterReminders: true,
    },
  };
}
