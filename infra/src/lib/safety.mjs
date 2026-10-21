// Check-in safety screen. Runs before any coaching or AI call.
// PlayMotion is not therapy: worrying words or very low mood route to a calm support screen.

const WORRYING_PATTERNS = [
  /suicid/i,
  /\bkill(ing)?\s+(my\s*self|myself)\b/i,
  /\bend\s+(it\s+all|my\s+life)\b/i,
  /\bwant(ed)?\s+to\s+die\b/i,
  /\bdon'?t\s+want\s+to\s+(live|be\s+here)\b/i,
  /\bself[-\s]?harm/i,
  /\bhurt(ing)?\s+my\s*self\b/i,
  /\bno\s+reason\s+to\s+live\b/i,
  /\bbetter\s+off\s+without\s+me\b/i,
  /\bcan'?t\s+go\s+on\b/i,
  /\bhopeless\b/i,
];

// [verify] each number against the helpline's official site before the demo.
export const HELPLINES = {
  US: [{ name: '988 Suicide & Crisis Lifeline', contact: 'Call or text 988' }],
  GB: [{ name: 'Samaritans', contact: 'Call 116 123' }],
  IN: [{ name: 'Tele-MANAS', contact: 'Call 14416' }],
  PK: [{ name: 'Umang mental health helpline', contact: 'Call 0311 7786264' }],
  DEFAULT: [{ name: 'Find a helpline near you', contact: 'findahelpline.com' }],
};

export function hasWorryingWords(text) {
  if (typeof text !== 'string' || !text.trim()) return false;
  return WORRYING_PATTERNS.some((re) => re.test(text));
}

/**
 * level: 'ok' | 'gentle' | 'support'
 *  support -> show the calm support screen, do not push exercise
 *  gentle  -> continue, but adapt to a Calm session and check in kindly
 */
export function screenCheckin({ mood, energy, note } = {}) {
  const reasons = [];
  if (hasWorryingWords(note)) reasons.push('worrying_words');
  if (mood === 1) reasons.push('very_low_mood');
  if (reasons.length) return { level: 'support', reasons };
  if (mood === 2 || energy === 1) return { level: 'gentle', reasons: ['low_mood_or_energy'] };
  return { level: 'ok', reasons: [] };
}

export function supportPayload(country) {
  const code = typeof country === 'string' ? country.toUpperCase() : '';
  return {
    title: "Let's pause here",
    message:
      "Thank you for telling us how you feel. You don't have to go through this alone. " +
      'Talking to someone you trust, or a trained listener, can really help.',
    helplines: [...(HELPLINES[code] ?? []), ...HELPLINES.DEFAULT],
    emergency: 'If you are in danger right now, call your local emergency number.',
    disclaimer: 'PlayMotion is not therapy and cannot help in an emergency.',
    gentleOption: { game: 'calm_river', minutes: 2, label: 'Try 2 minutes of slow breathing (optional)' },
  };
}
