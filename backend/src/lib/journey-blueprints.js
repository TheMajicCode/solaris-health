/**
 * journey-blueprints.js — rich, human-authored guided-journey plans.
 *
 * Each blueprint is a complete, practical program a member can begin. Unlike the
 * static milestone list (journeys.js), a blueprint describes the *actual steps*
 * the member will do — a varied mix of daily habits, audio sessions, hands-on
 * activities/exercises, reflective journalling and a recommended practitioner.
 *
 * When a member begins a journey we:
 *   1. seed their To-Do list (member_todos) from `steps`,
 *   2. seed a few core daily habits (member_habits) from `habits`,
 *   3. resolve the practitioner step to a real, bookable provider, and
 *   4. resolve audio steps to a real track in audio_library.
 *
 * Step kinds (drives the icon + CTA + where it takes the member):
 *   checkin      → opens the daily check-in                (action: start_checkin)
 *   habit        → a daily habit, also seeded into the tracker (action: navigate 'journal')
 *   audio        → play a specific guided audio session     (action: play_audio, target resolved to audio id)
 *   activity     → a concrete exercise/activity to do       (action: navigate <tab> or none)
 *   reflection   → a journalling prompt                      (action: navigate 'journal')
 *   practitioner → connect with a recommended practitioner   (action: open_listing, target resolved to provider id)
 *   navigate     → go somewhere useful in the app            (action: navigate <tab>)
 *
 * `dimension` maps every step to one of the four growth dimensions the Journal
 * hub is organised around: mind, body, heart, spirit.
 */

// Practitioner focus per journey (provider_type + a warm human label).
const JOURNEY_FOCUS = {
  detox:          { type: 'nutritionist', label: 'a nutrition specialist' },
  heavy_metal:    { type: 'doctor',       label: 'a functional-medicine doctor' },
  menopause:      { type: 'doctor',       label: 'a doctor who supports hormonal health' },
  optimal_health: { type: 'wellness',     label: 'a wellness practitioner' },
  smile:          { type: 'doctor',       label: 'a holistic dentist or doctor' },
  thyroid:        { type: 'doctor',       label: 'a functional-medicine doctor' },
  sugar:          { type: 'nutritionist', label: 'a nutrition specialist' },
  nurture_mama:   { type: 'doctor',       label: 'a supportive doctor' },
  your_path:      { type: 'wellness',     label: 'a wellness practitioner' },
};

// Reusable step fragments (keeps blueprints readable + consistent).
const S = {
  checkin: {
    key: 'checkin', kind: 'checkin', dimension: 'mind',
    title: 'Complete your daily check-in',
    detail: 'Tune into how your Mind, Body, Heart and Spirit feel today — it grounds the whole journey.',
    action: { type: 'start_checkin', target: null },
  },
  hydration: {
    key: 'hydration', kind: 'habit', dimension: 'body',
    title: 'Hydration — drink water consistently',
    detail: 'Sip water through the day to help your kidneys and liver flush out waste. Aim for 8 glasses.',
    habit: { name: 'Drink 8 glasses of water', icon: '💧' },
    action: { type: 'navigate', target: 'journal' },
  },
  nutrientFood: {
    key: 'nutrient_food', kind: 'habit', dimension: 'body',
    title: 'Nutrient-dense food',
    detail: 'Eat plenty of fresh vegetables, fruit and fibre while cutting back on ultra-processed items and added sugar.',
    habit: { name: 'Eat a plate of vegetables & fruit', icon: '🥗' },
    action: { type: 'navigate', target: 'journal' },
  },
  movement: {
    key: 'movement', kind: 'habit', dimension: 'body',
    title: 'Regular movement',
    detail: 'Move for at least 20 minutes — a walk, gentle run or stretch — to support circulation and metabolic health.',
    habit: { name: 'Move for 20 minutes', icon: '🚶' },
    action: { type: 'navigate', target: 'journal' },
  },
  sleep: {
    key: 'sleep', kind: 'habit', dimension: 'body',
    title: 'Quality sleep',
    detail: 'Give your body adequate nightly rest to repair cells and keep your immune system strong. Aim for 7–8 hours.',
    habit: { name: 'Sleep 7–8 hours', icon: '😴' },
    action: { type: 'navigate', target: 'journal' },
  },
  morningBreath: {
    key: 'morning_breath', kind: 'audio', dimension: 'spirit',
    title: 'Start with a grounding breath',
    detail: 'A short guided breath session to set a calm, intentional tone for the day.',
    audioMatch: /morning|grounding breath/i,
    action: { type: 'play_audio', target: null },
  },
  windDown: {
    key: 'wind_down', kind: 'audio', dimension: 'spirit',
    title: 'Evening wind-down session',
    detail: 'Release the day with a guided audio session so you fall asleep more easily.',
    audioMatch: /wind-down|evening|releasing the day/i,
    action: { type: 'play_audio', target: null },
  },
  bodyScan: {
    key: 'body_scan', kind: 'audio', dimension: 'spirit',
    title: 'Evening body scan',
    detail: 'A 10-minute body scan to notice tension and let it go before bed.',
    audioMatch: /body scan/i,
    action: { type: 'play_audio', target: null },
  },
  gratitude: {
    key: 'gratitude', kind: 'reflection', dimension: 'heart',
    title: 'Write three things you are grateful for',
    detail: 'A two-minute gratitude note in your Journal shifts your nervous system toward calm.',
    action: { type: 'navigate', target: 'journal' },
  },
  practitioner: {
    key: 'practitioner', kind: 'practitioner', dimension: 'body',
    title: 'Connect with a recommended practitioner',
    detail: 'When you are ready, book a session with a practitioner matched to this journey.',
    action: { type: 'open_listing', target: null }, // target resolved at seed time
  },
};

// Small helper to clone a fragment and override fields.
const step = (frag, over = {}) => ({ ...frag, ...over });

/* ------------------------------------------------------------------
   Blueprints. Each: label, tagline, overview, weeks, habits[], steps[].
------------------------------------------------------------------- */
const BLUEPRINTS = {
  detox: {
    type: 'detox',
    label: 'Gentle Detox & Cleanse',
    tagline: 'Reset your body’s natural detox pathways with gentle, guided support.',
    overview:
      'Over the next few weeks you’ll support your liver, kidneys and gut with steady hydration, nutrient-dense food, daily movement and restorative rest — plus breathwork and a check-in with a nutrition specialist.',
    weeks: 6,
    habits: [S.hydration.habit, S.nutrientFood.habit, S.movement.habit, S.sleep.habit],
    steps: [
      step(S.checkin),
      step(S.hydration),
      step(S.nutrientFood, {
        detail: 'Build meals around fresh vegetables, fruit and fibre; cut ultra-processed foods and added sugar to lighten your liver’s load.',
      }),
      step(S.movement, {
        title: 'Move to support circulation',
        detail: 'A 20-minute walk after meals helps digestion and moves lymph — one of your body’s detox channels.',
      }),
      step(S.morningBreath),
      {
        key: 'warm_lemon', kind: 'activity', dimension: 'body',
        title: 'Activity: warm lemon water each morning',
        detail: 'Start the day with a glass of warm water and fresh lemon before coffee — a gentle nudge for digestion.',
        action: { type: 'navigate', target: 'journal' },
      },
      {
        key: 'dry_brush', kind: 'activity', dimension: 'body',
        title: 'Activity: 3-minute dry-brushing before your shower',
        detail: 'Brush toward the heart in long strokes to stimulate lymph flow and circulation.',
        action: { type: 'navigate', target: 'journal' },
      },
      step(S.sleep),
      step(S.gratitude, {
        title: 'Reflect: notice how your body feels lighter',
        detail: 'Jot one line in your Journal about any shift in energy, digestion or clarity you notice.',
      }),
      step(S.practitioner, {
        title: 'Connect with a nutrition specialist',
        detail: 'A nutritionist can tailor your detox to your body — book when you feel ready.',
      }),
    ],
  },

  optimal_health: {
    type: 'optimal_health',
    label: 'Optimal Health',
    tagline: 'A steady path to your fullest Mind, Body, Heart & Spirit.',
    overview:
      'A balanced foundation for whole-person wellbeing: daily check-ins, the four pillars (hydration, nourishment, movement, sleep), breathwork for the nervous system, gratitude for the heart, and a wellness practitioner in your corner.',
    weeks: 8,
    habits: [S.hydration.habit, S.nutrientFood.habit, S.movement.habit, S.sleep.habit],
    steps: [
      step(S.checkin),
      step(S.hydration),
      step(S.nutrientFood),
      step(S.movement),
      step(S.sleep),
      step(S.morningBreath),
      {
        key: 'sunlight', kind: 'activity', dimension: 'spirit',
        title: 'Activity: 10 minutes of morning sunlight',
        detail: 'Step outside within an hour of waking to anchor your circadian rhythm and lift your mood.',
        action: { type: 'navigate', target: 'journal' },
      },
      step(S.gratitude),
      step(S.practitioner, {
        title: 'Connect with a wellness practitioner',
        detail: 'A wellness practitioner can help you personalise and sustain these foundations.',
      }),
    ],
  },

  menopause: {
    type: 'menopause',
    label: 'Menopause Support',
    tagline: 'Grounded, warm guidance through a season of change.',
    overview:
      'Support your body and mind through hormonal change with steadying nutrition, strength-building movement, cooling breathwork for hot flushes, protective sleep, and a doctor who understands hormonal health.',
    weeks: 8,
    habits: [
      S.hydration.habit,
      { name: 'Eat protein & phytoestrogens', icon: '🥗' },
      { name: 'Strength or weight-bearing movement', icon: '🏋️' },
      S.sleep.habit,
    ],
    steps: [
      step(S.checkin),
      step(S.hydration),
      step(S.nutrientFood, {
        title: 'Nourish for hormonal balance',
        detail: 'Prioritise protein, calcium and phytoestrogen-rich foods (flax, soy, legumes) to steady energy and support bone health.',
        habit: { name: 'Eat protein & phytoestrogens', icon: '🥗' },
      }),
      step(S.movement, {
        title: 'Strength & weight-bearing movement',
        detail: 'Add 2–3 sessions of strength or weight-bearing exercise each week to protect bone density and mood.',
        habit: { name: 'Strength or weight-bearing movement', icon: '🏋️' },
      }),
      {
        key: 'cooling_breath', kind: 'audio', dimension: 'spirit',
        title: 'Cooling breath for hot flushes',
        detail: 'When a flush rises, a slow guided breath can ease its intensity. Practice it now so it’s familiar.',
        audioMatch: /grounding breath|reset/i,
        action: { type: 'play_audio', target: null },
      },
      step(S.windDown, {
        detail: 'Night sweats disrupt sleep — an evening wind-down session helps your body settle.',
      }),
      step(S.gratitude, {
        title: 'Reflect: honour what your body is doing',
        detail: 'Write a few kind words to yourself about this transition in your Journal.',
      }),
      step(S.practitioner, {
        title: 'Connect with a hormonal-health doctor',
        detail: 'A doctor who supports menopause can discuss options tailored to you.',
      }),
    ],
  },

  sugar: {
    type: 'sugar',
    label: 'Balance Your Blood Sugar',
    tagline: 'Steady energy, fewer crashes — one gentle habit at a time.',
    overview:
      'Even out your energy by taming sugar spikes: hydrate, build balanced plates, walk after meals, sleep well, and lean on a nutrition specialist for lasting change.',
    weeks: 6,
    habits: [
      S.hydration.habit,
      { name: 'Protein & fibre at every meal', icon: '🍳' },
      { name: '10-minute walk after meals', icon: '🚶' },
      S.sleep.habit,
    ],
    steps: [
      step(S.checkin),
      step(S.hydration),
      step(S.nutrientFood, {
        title: 'Build a blood-sugar-friendly plate',
        detail: 'Pair protein, fibre and healthy fat with any carbs to blunt the spike. Cut sugary drinks first.',
        habit: { name: 'Protein & fibre at every meal', icon: '🍳' },
      }),
      {
        key: 'walk_after_meals', kind: 'habit', dimension: 'body',
        title: 'Walk 10 minutes after meals',
        detail: 'A short walk after eating helps your muscles soak up glucose and softens the post-meal crash.',
        habit: { name: '10-minute walk after meals', icon: '🚶' },
        action: { type: 'navigate', target: 'journal' },
      },
      step(S.morningBreath, {
        title: 'Breathe before you reach for sugar',
        detail: 'Cravings often ride on stress. A short breath session can let the urge pass.',
      }),
      step(S.sleep, {
        detail: 'Poor sleep raises next-day cravings and insulin resistance — protect your 7–8 hours.',
      }),
      step(S.gratitude),
      step(S.practitioner, {
        title: 'Connect with a nutrition specialist',
        detail: 'A nutritionist can build a sustainable plan around your tastes and routine.',
      }),
    ],
  },

  thyroid: {
    type: 'thyroid',
    label: 'Thyroid & Energy',
    tagline: 'Support your thyroid and rebuild steady energy.',
    overview:
      'Nourish your thyroid with the right nutrients, gentle movement, restorative rest and stress-lowering breathwork — and bring your labs to a functional-medicine doctor.',
    weeks: 8,
    habits: [
      S.hydration.habit,
      { name: 'Thyroid-supportive nutrition', icon: '🥗' },
      { name: 'Gentle daily movement', icon: '🚶' },
      S.sleep.habit,
    ],
    steps: [
      step(S.checkin),
      step(S.hydration),
      step(S.nutrientFood, {
        title: 'Thyroid-supportive nutrition',
        detail: 'Include selenium (brazil nuts), zinc, iodine-rich foods and protein; limit ultra-processed foods.',
        habit: { name: 'Thyroid-supportive nutrition', icon: '🥗' },
      }),
      step(S.movement, {
        title: 'Gentle daily movement',
        detail: 'Low-intensity movement supports metabolism without over-taxing a tired system.',
        habit: { name: 'Gentle daily movement', icon: '🚶' },
      }),
      step(S.bodyScan),
      step(S.sleep),
      {
        key: 'add_labs', kind: 'navigate', dimension: 'body',
        title: 'Add your thyroid panel to your Passport',
        detail: 'Upload recent TSH / T3 / T4 results so your care team can see the full picture.',
        action: { type: 'navigate', target: 'health' },
      },
      step(S.practitioner, {
        title: 'Connect with a functional-medicine doctor',
        detail: 'Bring your labs to a doctor who treats the whole thyroid picture.',
      }),
    ],
  },

  heavy_metal: {
    type: 'heavy_metal',
    label: 'Heavy-Metal Detox',
    tagline: 'A careful, guided approach to reducing your metal burden.',
    overview:
      'Gently support your body’s detox pathways with hydration, binding foods, sweat and rest — always alongside a functional-medicine doctor who can test and guide safely.',
    weeks: 8,
    habits: [
      S.hydration.habit,
      { name: 'Eat cilantro / chlorella-rich foods', icon: '🌿' },
      { name: 'Sweat (sauna or exercise)', icon: '🔥' },
      S.sleep.habit,
    ],
    steps: [
      step(S.checkin),
      step(S.hydration, {
        detail: 'Generous water intake is essential to flush mobilised metals — aim for 8–10 glasses.',
      }),
      step(S.nutrientFood, {
        title: 'Binding & supportive foods',
        detail: 'Include cilantro, chlorella, cruciferous vegetables and fibre to bind and carry metals out.',
        habit: { name: 'Eat cilantro / chlorella-rich foods', icon: '🌿' },
      }),
      {
        key: 'sweat', kind: 'habit', dimension: 'body',
        title: 'Sweat it out',
        detail: 'Sauna or exercise that makes you sweat is one of the body’s routes for releasing metals.',
        habit: { name: 'Sweat (sauna or exercise)', icon: '🔥' },
        action: { type: 'navigate', target: 'journal' },
      },
      step(S.bodyScan),
      {
        key: 'add_labs', kind: 'navigate', dimension: 'body',
        title: 'Add your heavy-metal test results',
        detail: 'Upload any test results to your Passport so your doctor can guide the protocol.',
        action: { type: 'navigate', target: 'health' },
      },
      step(S.practitioner, {
        title: 'Connect with a functional-medicine doctor',
        detail: 'Heavy-metal detox should be supervised — book a doctor before intensifying.',
      }),
    ],
  },

  smile: {
    type: 'smile',
    label: 'Smile & Oral Wellness',
    tagline: 'Whole-body health begins in the mouth — minimally invasive & holistic.',
    overview:
      'Care for your smile as a gateway to whole-body health: hydration, tooth-friendly nutrition, a daily oral-care ritual and a holistic dentist.',
    weeks: 4,
    habits: [
      S.hydration.habit,
      { name: 'Tooth-friendly eating', icon: '🦷' },
      { name: 'Oil pull / gentle oral care', icon: '🪥' },
    ],
    steps: [
      step(S.checkin),
      step(S.hydration, {
        detail: 'Water rinses away food and acid between meals and keeps saliva protective.',
      }),
      step(S.nutrientFood, {
        title: 'Tooth-friendly eating',
        detail: 'Favour whole foods rich in calcium and vitamin K2; limit sugar and acidic drinks that erode enamel.',
        habit: { name: 'Tooth-friendly eating', icon: '🦷' },
      }),
      {
        key: 'oral_ritual', kind: 'habit', dimension: 'body',
        title: 'Daily oral-care ritual',
        detail: 'Gentle brushing, flossing and (optionally) oil pulling — a two-minute ritual for a healthier mouth.',
        habit: { name: 'Oil pull / gentle oral care', icon: '🪥' },
        action: { type: 'navigate', target: 'journal' },
      },
      step(S.gratitude, { title: 'Reflect: smile at yourself in the mirror', detail: 'A small act of self-kindness — note how it feels in your Journal.' }),
      step(S.practitioner, {
        title: 'Connect with a holistic dentist',
        detail: 'A minimally-invasive, holistic dentist can support your whole-body oral health.',
      }),
    ],
  },

  nurture_mama: {
    type: 'nurture_mama',
    label: 'Nurture Mama',
    tagline: 'Holistic care for the whole arc of motherhood — body, mind, spirit.',
    overview:
      'Gentle, nourishing support through the seasons of motherhood: hydration, restorative nutrition, soft movement, rest whenever you can, and a supportive doctor.',
    weeks: 6,
    habits: [
      S.hydration.habit,
      { name: 'Nourishing, warming meals', icon: '🍲' },
      { name: 'Gentle movement / stretch', icon: '🧘' },
      { name: 'Rest when baby rests', icon: '😴' },
    ],
    steps: [
      step(S.checkin),
      step(S.hydration, { detail: 'Hydration supports energy and, if nursing, milk supply — keep water within reach.' }),
      step(S.nutrientFood, {
        title: 'Nourishing, warming meals',
        detail: 'Favour warm, iron- and protein-rich foods to replenish your body.',
        habit: { name: 'Nourishing, warming meals', icon: '🍲' },
      }),
      step(S.movement, {
        title: 'Gentle movement & stretch',
        detail: 'Soft movement — a walk with the pram, gentle stretches — rebuilds strength without strain.',
        habit: { name: 'Gentle movement / stretch', icon: '🧘' },
      }),
      step(S.windDown, { title: 'Rest when you can', detail: 'A short wind-down session can turn even a brief rest into real recovery.' }),
      step(S.gratitude, {
        title: 'Reflect: a note to yourself as a mother',
        detail: 'Write one gentle, honest line in your Journal — no performance, just presence.',
      }),
      step(S.practitioner, {
        title: 'Connect with a supportive doctor',
        detail: 'A doctor who understands the motherhood arc can support you and baby.',
      }),
    ],
  },

  your_path: {
    type: 'your_path',
    label: 'Your Own Path',
    tagline: 'A flexible foundation you shape around your own goals.',
    overview:
      'Not sure where to start? This balanced foundation covers the essentials — check-ins, the four pillars, breathwork and reflection — and a wellness practitioner to help you find your direction.',
    weeks: 6,
    habits: [S.hydration.habit, S.nutrientFood.habit, S.movement.habit, S.sleep.habit],
    steps: [
      step(S.checkin),
      step(S.hydration),
      step(S.nutrientFood),
      step(S.movement),
      step(S.sleep),
      step(S.morningBreath),
      step(S.gratitude),
      {
        key: 'explore', kind: 'navigate', dimension: 'mind',
        title: 'Explore wellness resources',
        detail: 'Browse the media library and marketplace to discover what resonates with you.',
        action: { type: 'navigate', target: 'media' },
      },
      step(S.practitioner, {
        title: 'Connect with a wellness practitioner',
        detail: 'A practitioner can help you turn these foundations into a plan that’s truly yours.',
      }),
    ],
  },
};

const VALID_TYPES = Object.keys(BLUEPRINTS);

// Short, ordered list for the "Begin a guided journey" grid on Explore.
const OFFER_ORDER = ['detox', 'optimal_health', 'menopause', 'sugar', 'thyroid', 'nurture_mama'];

function getBlueprint(type) {
  return BLUEPRINTS[type] || null;
}

// Public-safe summary for the offers grid / plan preview (no internal regex).
function planSummary(type) {
  const bp = BLUEPRINTS[type];
  if (!bp) return null;
  return {
    type: bp.type,
    label: bp.label,
    tagline: bp.tagline,
    overview: bp.overview,
    weeks: bp.weeks,
    focus: JOURNEY_FOCUS[type] || null,
    stepCount: bp.steps.length,
    habits: bp.habits,
    steps: bp.steps.map((s) => ({
      key: s.key,
      kind: s.kind,
      title: s.title,
      detail: s.detail,
      dimension: s.dimension,
      action: s.action,
    })),
  };
}

module.exports = { BLUEPRINTS, VALID_TYPES, OFFER_ORDER, JOURNEY_FOCUS, getBlueprint, planSummary };
