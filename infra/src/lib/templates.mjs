// Template fallbacks: every Bedrock call has one of these behind it, so the demo never breaks.
import { BADGES, EXERCISES, GAMES } from './shared/catalog.mjs';

export const DISCLAIMER = 'PlayMotion is wellness coaching, not a medical device.';

const MODE_SUMMARY = {
  steady: 'This week builds balance and leg strength, the kind of exercise most linked to fewer falls.',
  fit: 'This week mixes strength and cardio games so every session feels like play, not a workout.',
  calm: 'This week is gentle: short sessions of slow breathing and easy movement to lift your mood and energy.',
  recover: 'This week uses gentle, low-impact moves. In the full version your physiotherapist sets them.',
  kids: 'Ten-minute story adventures where every jump, balance and stomp moves the story forward.',
};

export function planExplanation(a, plan) {
  const why = [];
  if (plan.posture === 'seated') why.push('Every move is seated, so you can take part safely from a chair or wheelchair.');
  else if (a.mobility === 'chair') why.push('Moves are chair-supported, so you always have something steady to hold.');
  why.push(
    { 1: 'We start gently because you told us you are not very active yet.', 2: 'We start at a moderate level and adjust after each check-in.', 3: 'You are already active, so sessions start a little harder.' }[plan.intensity],
  );
  if (a.sleep <= 2) why.push('Your sleep has been rough, so we kept things lighter this week.');
  if (a.mood <= 2) why.push('Two days are Calm River sessions to give your mood some gentle support.');
  if (a.painAreas.includes('full_body')) why.push('You ache all over, so every move is gentle and low-impact.');
  else if (a.painAreas.length) why.push(`We left out moves that load your ${a.painAreas.join(', ')}.`);
  return {
    summary: `${MODE_SUMMARY[plan.mode]} Sessions are ${plan.sessionMinutes} minutes.`,
    why: why.slice(0, 4),
    swaps: plan.nutrition?.swaps ?? [],
    firstCoachLine: "Welcome to PlayMotion. Let's start nice and easy.",
  };
}

// Spoken template lines per coach language. Hindi is written in Devanagari in everyday Hindustani,
// so Urdu speakers understand it when Polly's Kajal voice reads it. Kids mode is English only.
// Translations: [verify] with native speakers before launch.
const lang = (language) => (['hi-IN', 'es-US', 'ar-AE'].includes(language) ? language : 'en');

const ADAPTED_LINES = {
  en: {
    planned: (g) => `Ready when you are! Today it's ${g}. Let's get moving together!`,
    feeling_good: (g) => `You're feeling great today, so ${g} has a little extra challenge. Let's go!`,
    low_mood: () => "Thanks for being honest about how you feel. Let's take five calm minutes together, nothing more.",
    low_energy: () => "Low on energy today? That's okay. A short, gentle session can help. Go at your own pace.",
    pain: (g) => `Let's keep you comfortable. Today's ${g} uses seated moves. Stop any time.`,
  },
  'hi-IN': {
    planned: (g) => `जब आप तैयार हों! आज है ${g}। चलिए साथ में शुरू करते हैं!`,
    feeling_good: (g) => `आज आप बढ़िया महसूस कर रहे हैं, तो ${g} में थोड़ी और चुनौती है। चलो!`,
    low_mood: () => 'सच बताने के लिए शुक्रिया। चलिए बस पाँच शांत मिनट साथ बिताते हैं।',
    low_energy: () => 'आज ताक़त कम लग रही है? कोई बात नहीं। छोटा, हल्का सेशन मदद कर सकता है। अपनी रफ़्तार से कीजिए।',
    pain: (g) => `आपके आराम का ध्यान रखते हैं। आज का ${g} बैठकर होगा। कभी भी रुक सकते हैं।`,
  },
  'es-US': {
    planned: (g) => `¡Cuando quieras! Hoy toca ${g}. ¡Vamos a movernos juntos!`,
    feeling_good: (g) => `Hoy te sientes genial, así que ${g} tiene un reto extra. ¡Vamos!`,
    low_mood: () => 'Gracias por contarme cómo te sientes. Tomemos solo cinco minutos tranquilos juntos.',
    low_energy: () => '¿Poca energía hoy? No pasa nada. Una sesión corta y suave puede ayudar. Ve a tu ritmo.',
    pain: (g) => `Cuidemos tu comodidad. Hoy ${g} será con movimientos sentados. Puedes parar cuando quieras.`,
  },
  'ar-AE': {
    planned: (g) => `عندما تكون جاهزًا! اليوم لدينا ${g}. هيا نتحرك معًا!`,
    feeling_good: (g) => `تشعر بحال رائعة اليوم، لذلك في ${g} تحدٍّ إضافي. هيا!`,
    low_mood: () => 'شكرًا لصدقك. لنأخذ خمس دقائق هادئة معًا فقط.',
    low_energy: () => 'طاقتك منخفضة اليوم؟ لا بأس. جلسة قصيرة وخفيفة قد تساعد. على راحتك.',
    pain: (g) => `لنحافظ على راحتك. ${g} اليوم بحركات جلوسًا. يمكنك التوقف في أي وقت.`,
  },
};

export function coachLine(today, language) {
  const gameName = GAMES[today.game]?.name ?? 'your session';
  const lines = ADAPTED_LINES[lang(language)];
  return (lines[today.adapted] ?? lines.planned)(gameName);
}

const CELEBRATE = {
  en: {
    badge: (b) => `Well done! You earned the "${b}" badge.`,
    level: (n) => `Level up! You just reached level ${n}. Brilliant work!`,
    lift: () => 'Well done. You feel better than when you started, and that matters.',
    streak: (n) => `Well done. That's ${n} ${n === 1 ? 'day' : 'days'} in a row.`,
  },
  'hi-IN': {
    badge: (b) => `शाबाश! आपको "${b}" बैज मिला।`,
    level: (n) => `लेवल अप! आप लेवल ${n} पर पहुँच गए। शानदार!`,
    lift: () => 'शाबाश। आप शुरू से बेहतर महसूस कर रहे हैं, और यही सबसे ज़रूरी है।',
    streak: (n) => `शाबाश। लगातार ${n} दिन!`,
  },
  'es-US': {
    badge: (b) => `¡Bien hecho! Ganaste la insignia "${b}".`,
    level: (n) => `¡Subiste de nivel! Ya estás en el nivel ${n}. ¡Genial!`,
    lift: () => 'Bien hecho. Te sientes mejor que al empezar, y eso importa.',
    streak: (n) => `Bien hecho. ¡${n} ${n === 1 ? 'día' : 'días'} seguidos!`,
  },
  'ar-AE': {
    badge: (b) => `أحسنت! حصلت على شارة "${b}".`,
    level: (n) => `ارتقيت مستوى! وصلت إلى المستوى ${n}. رائع!`,
    lift: () => 'أحسنت. تشعر بتحسن عن البداية، وهذا هو المهم.',
    streak: (n) => `أحسنت. أيام متتالية: ${n}!`,
  },
};

const REPORT = {
  en: {
    active: (m, p) => `This week you were active for ${m} minutes, ${p}% of the 150 minutes the WHO recommends.`,
    lift: (x) => `On average your mood lifted by ${x} points after a session.`,
    chair: (c) => `Your chair-stand score went up by ${c}, a sign of stronger legs.`,
    streak: (n) => `You're on a ${n}-day streak.`,
    met: 'Keep it going!',
    notMet: 'Every minute counts. Try adding one short session next week.',
  },
  'hi-IN': {
    active: (m, p) => `इस हफ़्ते आप ${m} मिनट एक्टिव रहे, जो WHO के बताए 150 मिनट का ${p}% है।`,
    lift: (x) => `सेशन के बाद आपका मूड औसतन ${x} अंक बेहतर हुआ।`,
    chair: (c) => `आपका कुर्सी टेस्ट का स्कोर ${c} बढ़ा, यानी पैर मज़बूत हो रहे हैं।`,
    streak: (n) => `आप लगातार ${n} दिन से आ रहे हैं।`,
    met: 'ऐसे ही जारी रखिए!',
    notMet: 'हर मिनट मायने रखता है। अगले हफ़्ते एक छोटा सेशन और जोड़कर देखिए।',
  },
  'es-US': {
    active: (m, p) => `Esta semana estuviste activo ${m} minutos, el ${p}% de los 150 minutos que recomienda la OMS.`,
    lift: (x) => `En promedio, tu ánimo subió ${x} puntos después de cada sesión.`,
    chair: (c) => `Tu resultado en la prueba de la silla subió ${c}, señal de piernas más fuertes.`,
    streak: (n) => `Llevas una racha de ${n} días.`,
    met: '¡Sigue así!',
    notMet: 'Cada minuto cuenta. Intenta añadir una sesión corta la próxima semana.',
  },
  'ar-AE': {
    active: (m, p) => `كنت نشيطًا هذا الأسبوع لمدة ${m} دقيقة، أي ${p}% من الـ150 دقيقة التي توصي بها منظمة الصحة العالمية.`,
    lift: (x) => `في المتوسط تحسّن مزاجك بمقدار ${x} نقطة بعد كل جلسة.`,
    chair: (c) => `ارتفعت نتيجتك في اختبار الكرسي بمقدار ${c}، وهذه علامة على ساقين أقوى.`,
    streak: (n) => `أنت مستمر منذ ${n} أيام متتالية.`,
    met: 'استمر هكذا!',
    notMet: 'كل دقيقة مهمة. جرّب إضافة جلسة قصيرة الأسبوع القادم.',
  },
};

export function celebrationLine(gained, isKid, language) {
  if (isKid) return `Amazing moving! You earned ${gained.sticker ? 'a new sticker and ' : ''}more stars!`;
  const c = CELEBRATE[lang(language)];
  if (gained.newBadges.length) return c.badge(BADGES[gained.newBadges[0]].name);
  if (gained.levelUp) return c.level(gained.level);
  if (gained.moodLift > 0) return c.lift();
  return c.streak(gained.streak);
}

export function reportSummary(stats, isKid, language) {
  if (isKid) {
    const n = (count, word) => `${count} ${word}${count === 1 ? '' : 's'}`;
    return `This week your child moved for ${n(stats.activeMinutes, 'minute')} over ${n(stats.activeDays, 'day')} and collected ${n(stats.stars ?? 0, 'star')}.`;
  }
  const r = REPORT[lang(language)];
  const parts = [r.active(stats.activeMinutes, stats.whoPercent)];
  if (stats.moodLift !== null && stats.moodLift > 0) parts.push(r.lift(stats.moodLift));
  if (stats.chairStand?.change > 0) parts.push(r.chair(stats.chairStand.change));
  if (stats.streak > 1) parts.push(r.streak(stats.streak));
  parts.push(stats.activeMinutes >= 150 ? r.met : r.notMet);
  return parts.join(' ');
}

export function mealFallback(food) {
  const tips = ['Aim for half the plate as vegetables or salad when you can.', 'A glass of water with your meal helps you stay hydrated.'];
  if (food?.sugaryDrinks === 'daily') tips.push('If there is a sugary drink with this meal, try water or tea instead.');
  return {
    isFood: true,
    looksLike: null,
    positives: ['Taking a moment to notice your food is a great habit.'],
    tips: tips.slice(0, 3),
    swap: null,
    waterNudge: 'Time for a glass of water?',
  };
}

const STORIES = {
  jungle_quest: [
    '{{name}} steps into the jungle. A river blocks the path! Frog-jump across the lily pads: hop, hop, hop!',
    'A flamingo shows {{name}} a secret: stand on one leg and stay still to cross the wobbly log.',
    'A sleepy bear blocks the cave! Wake it up with big bear stomps, {{name}}. Knees up high: stomp, stomp, stomp!',
    'Crab steps along the sandy beach to find the golden shell. Claws up and step sideways, sideways. You can do it!',
    'You found the treasure, {{name}}! The whole jungle cheers for you.',
  ],
  superhero_training: [
    'Welcome to hero school, {{name}}! First power: super punches. Punch, punch, punch!',
    'Squat down low to charge your power boots, then stand up tall and strong.',
    'Star jumps light up the city! Small, bouncy stars, one, two, three!',
    'Your powers are glowing, {{name}}. One more round to unlock the cape!',
    'You did it! {{name}} is officially a superhero.',
  ],
  freeze_dance: [
    "Let's dance, {{name}}! Move to the beat, and when the music stops... freeze like a statue!",
    'Wiggle your arms, bounce your knees, and freeze!',
    'Dance like a robot! Ready... freeze!',
    'Dance like a jellyfish, all wobbly... and freeze!',
    'Best statues ever, {{name}}! Take a bow.',
  ],
  floor_is_lava: [
    'Oh no, {{name}}, the floor is lava! Side-step to the safe stones.',
    'Lava on the left! Step right, step right!',
    'Little hops to the next stone. Bend your knees and land softly.',
    'Almost at the cool blue river. Keep going, {{name}}!',
    'Safe at last! The lava cooled down thanks to you.',
  ],
};

export function storyFallback(game, chapter) {
  const lines = STORIES[game] ?? STORIES.jungle_quest;
  return lines[Math.min(Math.max(chapter, 0), lines.length - 1)];
}

export const storyExerciseNames = (game) => (GAMES[game]?.exercises ?? []).map((id) => EXERCISES[id]?.name).filter(Boolean);

// Short lines the TV plays instantly during games (pre-synthesised by GET /voice/pack).
export const CUE_LINES = {
  coach: {
    great_rep: 'Great rep!',
    nice_form: 'Ooh, nice form! Keep it up!',
    halfway: "Halfway there! You're crushing it!",
    last_three: "Last three! Finish strong, you've got this!",
    stand_tall: 'Stand tall and look ahead.',
    knees_out: 'Keep your knees over your toes.',
    arms_higher: 'Reach a little higher if it feels okay.',
    slow_down: 'Nice and slow. Control the move.',
    hold_steady: 'Hold steady. Breathe.',
    use_chair: 'Hold the chair if you need it.',
    step_in_frame: 'Step back so the camera can see all of you.',
    combo: 'Combo! Woohoo, keep the power coming!',
    boss_hit: 'Boom! Direct hit!',
    stop_ok: "We've stopped. You did well. Would you like to try a seated version?",
    pain_ok: "Let's stop that move. Your comfort comes first.",
    session_done: 'Yes! Session complete. Amazing work today!',
  },
  calm: {
    breathe_in: 'Breathe in slowly.',
    breathe_out: 'And breathe out.',
    soften: 'Let your shoulders soften.',
    well_done: 'Well done. Take that calm with you.',
  },
  kids: {
    great_jump: 'Wow, great jump!',
    freeze: 'Freeze!',
    super_still: 'Super still! Amazing!',
    keep_going: 'Keep going, hero! You are unstoppable!',
    star_earned: 'Yay! You earned a shiny star!',
    move_break: 'Time for a move break!',
    grown_up: 'Make sure a grown-up is nearby.',
  },
};

const CUE_TRANSLATIONS = {
  'hi-IN': {
    coach: {
      great_rep: 'बहुत बढ़िया!',
      nice_form: 'वाह, बहुत अच्छा! ऐसे ही करते रहिए!',
      halfway: 'आधा हो गया! आप कमाल कर रहे हैं!',
      last_three: 'बस तीन और! ज़ोर लगाइए, आप कर सकते हैं!',
      stand_tall: 'सीधे खड़े रहिए और सामने देखिए।',
      knees_out: 'घुटने पैरों की सीध में रखिए।',
      arms_higher: 'आराम से हो सके तो हाथ थोड़ा और ऊपर।',
      slow_down: 'धीरे-धीरे, आराम से।',
      hold_steady: 'स्थिर रहिए। सांस लेते रहिए।',
      use_chair: 'ज़रूरत हो तो कुर्सी पकड़ लीजिए।',
      step_in_frame: 'थोड़ा पीछे हटिए ताकि कैमरा आपको पूरा देख सके।',
      combo: 'कॉम्बो! वाह, ऐसे ही जारी रखिए!',
      boss_hit: 'धमाका! सीधा निशाना!',
      stop_ok: 'हमने रोक दिया है। आपने अच्छा किया। क्या बैठकर करना चाहेंगे?',
      pain_ok: 'चलिए इसे रोक देते हैं। आपका आराम सबसे पहले है।',
      session_done: 'हाँ! सेशन पूरा हुआ। आज आपने कमाल किया!',
    },
    calm: {
      breathe_in: 'धीरे से सांस अंदर लीजिए।',
      breathe_out: 'और सांस बाहर छोड़िए।',
      soften: 'कंधों को ढीला छोड़ दीजिए।',
      well_done: 'बहुत अच्छा। यह सुकून अपने साथ रखिए।',
    },
  },
  'es-US': {
    coach: {
      great_rep: '¡Muy bien!',
      nice_form: '¡Qué buena técnica! ¡Sigue así!',
      halfway: '¡Ya vas a la mitad! ¡Lo estás haciendo genial!',
      last_three: '¡Solo tres más! ¡Termina fuerte, tú puedes!',
      stand_tall: 'Párate derecho y mira al frente.',
      knees_out: 'Mantén las rodillas en línea con los pies.',
      arms_higher: 'Sube un poco más los brazos si te sientes bien.',
      slow_down: 'Despacio, con control.',
      hold_steady: 'Mantente firme. Respira.',
      use_chair: 'Agárrate de la silla si lo necesitas.',
      step_in_frame: 'Da un paso atrás para que la cámara te vea completo.',
      combo: '¡Combo! ¡Sigue con esa energía!',
      boss_hit: '¡Bum! ¡Golpe directo!',
      stop_ok: 'Nos detuvimos. Lo hiciste bien. ¿Quieres probar la versión sentada?',
      pain_ok: 'Paremos ese movimiento. Tu comodidad es lo primero.',
      session_done: '¡Sí! Sesión completa. ¡Increíble trabajo hoy!',
    },
    calm: {
      breathe_in: 'Inhala despacio.',
      breathe_out: 'Y exhala.',
      soften: 'Relaja los hombros.',
      well_done: 'Muy bien. Llévate esta calma contigo.',
    },
  },
  'ar-AE': {
    coach: {
      great_rep: 'رائع!',
      nice_form: 'أداء ممتاز! استمر هكذا!',
      halfway: 'وصلت إلى المنتصف! أنت رائع!',
      last_three: 'ثلاث مرات فقط! أنهِ بقوة، أنت تستطيع!',
      stand_tall: 'قف مستقيمًا وانظر إلى الأمام.',
      knees_out: 'اجعل ركبتيك في خط واحد مع قدميك.',
      arms_higher: 'ارفع ذراعيك أعلى قليلًا إن كان ذلك مريحًا.',
      slow_down: 'ببطء، تحكّم في الحركة.',
      hold_steady: 'اثبت. تنفّس.',
      use_chair: 'أمسك الكرسي إذا احتجت.',
      step_in_frame: 'تراجع قليلًا حتى تراك الكاميرا بالكامل.',
      combo: 'كومبو! واصل بهذه القوة!',
      boss_hit: 'بوم! إصابة مباشرة!',
      stop_ok: 'توقفنا. أحسنت. هل تريد تجربة الحركة جالسًا؟',
      pain_ok: 'لنوقف هذه الحركة. راحتك أولًا.',
      session_done: 'نعم! انتهت الجلسة. عمل رائع اليوم!',
    },
    calm: {
      breathe_in: 'خذ نفسًا ببطء.',
      breathe_out: 'والآن أخرج النفس.',
      soften: 'أرخِ كتفيك.',
      well_done: 'أحسنت. احتفظ بهذا الهدوء معك.',
    },
  },
};

/** In-game cue lines for a style + coach language (English for anything not translated, and for kids). */
export const cueLines = (style, language) => ({ ...CUE_LINES[style], ...(CUE_TRANSLATIONS[lang(language)]?.[style] ?? {}) });

export const familyCompletionText = (name, gameName, minutes) => `${name} finished today's PlayMotion session ✓ (${gameName}, ${minutes} min).`;

export const inactivityText = (name, days) =>
  `We haven't seen ${name} on PlayMotion for ${days} days. A quick call or message might be a nice nudge.`;

export const reminderText = {
  session: "It's PlayMotion time! A few minutes of movement is waiting for you on the TV.",
  water: 'Water break! A glass of water now keeps your energy up.',
};
