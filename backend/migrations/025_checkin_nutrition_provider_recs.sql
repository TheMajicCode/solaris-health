-- 025: Additive sprint migration
-- 1. Daily check-ins gain nutrition (meal quality) capture.
-- 2. Recommendations can deep-link to a bookable practitioner profile.
-- 3. Seed a Vitality Assessment template + questions if none is active
--    (fixes blank assessment steps found in the technical audit).
-- 4. Repair broken audio library URLs (Pixabay CDN returns 403) by pointing
--    at locally hosted ambient tracks served from the frontend.
-- All statements are idempotent and strictly additive.

-- 1. Check-in nutrition capture -------------------------------------------
ALTER TABLE daily_checkins ADD COLUMN IF NOT EXISTS nutrition_score INTEGER;
ALTER TABLE daily_checkins ADD COLUMN IF NOT EXISTS meal_notes TEXT;

-- 2. Recommendation -> practitioner deep link ------------------------------
ALTER TABLE recommendations
  ADD COLUMN IF NOT EXISTS linked_provider_id UUID REFERENCES provider_profiles(id);

-- 3. Assessment template + questions seed (only when no active template) ---
DO $$
DECLARE
  tpl_id UUID;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM assessment_templates WHERE status = 'active') THEN
    INSERT INTO assessment_templates (name, version, status, description)
    VALUES (
      'Solaris Vitality Assessment',
      'v1',
      'active',
      'Whole-person baseline across Mind, Body, Heart and Spirit plus core body systems.'
    )
    RETURNING id INTO tpl_id;

    -- Aspect questions (Mind / Body / Heart / Spirit)
    INSERT INTO assessment_questions
      (template_id, section_key, aspect_key, question_text, helper_text, question_type, low_label, high_label, sort_order)
    VALUES
      (tpl_id, 'aspects', 'mental',    'How clear and focused has your mind felt lately?',            'Think about concentration, memory and mental calm over the past two weeks.', 'scale', 'Foggy', 'Sharp', 1),
      (tpl_id, 'aspects', 'physical',  'How strong and energized does your body feel day to day?',    'Consider stamina, strength and how easily you move through your day.',      'scale', 'Depleted', 'Vibrant', 2),
      (tpl_id, 'aspects', 'emotional', 'How balanced and connected have your emotions felt?',         'Reflect on your relationships, mood stability and sense of belonging.',     'scale', 'Heavy', 'Open', 3),
      (tpl_id, 'aspects', 'spiritual', 'How aligned do you feel with your purpose and inner life?',   'Consider meaning, gratitude and moments of stillness in your week.',        'scale', 'Adrift', 'Anchored', 4);

    -- System questions
    INSERT INTO assessment_questions
      (template_id, section_key, system_key, question_text, helper_text, question_type, low_label, high_label, sort_order)
    VALUES
      (tpl_id, 'systems', 'bioelectrical',  'How steady is your overall energy through the day?',            'Sharp afternoon crashes suggest a lower score.',                    'scale', 'Crashes', 'Steady', 10),
      (tpl_id, 'systems', 'hydration',      'How consistently do you drink water throughout the day?',       'A good target is around 8 glasses spread across the day.',          'scale', 'Rarely', 'Consistently', 11),
      (tpl_id, 'systems', 'circadian',      'How regular and restorative is your sleep?',                    'Consider bedtime consistency and how rested you wake up.',          'scale', 'Erratic', 'Restorative', 12),
      (tpl_id, 'systems', 'microbiome',     'How comfortable is your digestion after meals?',                'Bloating, discomfort or irregularity suggest a lower score.',       'scale', 'Uncomfortable', 'At ease', 13),
      (tpl_id, 'systems', 'respiratory',    'How easy and full does your breathing feel?',                   'Notice breath during light activity and at rest.',                  'scale', 'Restricted', 'Effortless', 14),
      (tpl_id, 'systems', 'neurological',   'How well do you handle stress without feeling overwhelmed?',    'Consider how quickly you recover after a stressful moment.',        'scale', 'Overwhelmed', 'Resilient', 15),
      (tpl_id, 'systems', 'cardiovascular', 'How does your heart and stamina respond to movement?',          'Think of climbing stairs or a brisk walk.',                         'scale', 'Strained', 'Strong', 16),
      (tpl_id, 'systems', 'nutritional',    'How nourishing are your meals on a typical day?',               'Whole foods, vegetables and protein raise this score.',             'scale', 'Processed', 'Nourishing', 17);
  END IF;
END $$;

-- 4. Audio library: locally hosted ambient tracks --------------------------
UPDATE audio_library SET audio_url = '/audio/deep-restoration.mp3'
  WHERE title = 'Deep Nervous-System Restoration (Full Session)'
    AND audio_url NOT LIKE '/audio/%';
UPDATE audio_library SET audio_url = '/audio/evening-body-scan.mp3'
  WHERE title = 'Evening Body Scan'
    AND audio_url NOT LIKE '/audio/%';
UPDATE audio_library SET audio_url = '/audio/grounding-breath-reset.mp3'
  WHERE title = 'Grounding Breath: 5-Minute Reset'
    AND audio_url NOT LIKE '/audio/%';
UPDATE audio_library SET audio_url = '/audio/morning-grounding-breath.mp3'
  WHERE title = 'Morning Grounding Breath'
    AND audio_url NOT LIKE '/audio/%';
UPDATE audio_library SET audio_url = '/audio/evening-wind-down.mp3'
  WHERE title = 'Releasing the Day: Evening Wind-Down'
    AND audio_url NOT LIKE '/audio/%';
