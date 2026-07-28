/**
 * intake-templates.js — the four canonical Solaris Health intake templates.
 *
 * Each template's `fields` is an ordered array of field definitions consumed by
 * the dynamic <IntakeForm /> renderer. Supported field types:
 *   text · email · date · phone · textarea · select · radio ·
 *   checkbox_group · scale (1–N slider) · likert (1–5 agreement) · file · statement
 *
 * The dental template is intentionally bilingual (English / Spanish) per clinic
 * requirements. Solaris branding only — no third-party clinic names.
 */

const GENERAL = {
  clinic_type: 'general',
  name: 'General Wellness Intake',
  description: 'A warm, whole-person starting point — Mind, Body, Heart, and Spirit — so your practitioner can prepare for your first session.',
  fields: [
    { key: 'full_name', type: 'text', label: 'Full name', required: true },
    { key: 'dob', type: 'date', label: 'Date of birth', required: true },
    { key: 'email', type: 'email', label: 'Email', required: true },
    { key: 'phone', type: 'phone', label: 'Phone', required: false },
    { key: 'reason', type: 'textarea', label: 'Primary reason for your visit', required: true, placeholder: 'What brings you in? What are you hoping to explore together?' },
    { key: 'medications', type: 'textarea', label: 'Current medications', placeholder: 'Name and dose, if known — or "none".' },
    { key: 'allergies', type: 'text', label: 'Allergies', placeholder: 'Foods, medications, environmental — or "none".' },
    { key: 'conditions', type: 'checkbox_group', label: 'Any health conditions you live with?', options: ['Diabetes', 'Heart disease', 'Thyroid disorder', 'Autoimmune', 'Gastrointestinal', 'Chronic fatigue', 'None'] },
    { key: 'smoking', type: 'radio', label: 'Do you smoke?', options: ['No', 'Yes', 'Vape'] },
    { key: 'supplements', type: 'textarea', label: 'Current supplements', placeholder: 'Anything you take regularly.' },
    { key: 'goals', type: 'textarea', label: 'Your wellness goals', placeholder: 'What would thriving look and feel like for you?' },
    { key: 'comm_pref', type: 'radio', label: 'Preferred way to stay in touch', options: ['Email', 'WhatsApp', 'Phone'] },
    { key: 'notes', type: 'textarea', label: 'Anything else you would like us to know?' },
  ],
};

const DENTAL = {
  clinic_type: 'dental',
  name: 'Dental Intake · Formulario Dental',
  description: 'For dental clinics — bilingual (English / Español). Helps us prepare for your first visit and care for your whole smile.',
  fields: [
    { key: 'full_name', type: 'text', label: 'Full name / Nombre completo', required: true },
    { key: 'dob', type: 'date', label: 'Date of birth / Fecha de nacimiento', required: true },
    { key: 'email', type: 'email', label: 'Email address / Correo electrónico', required: true },
    { key: 'phone', type: 'phone', label: 'Phone number / Número de teléfono', required: false },
    { key: 'address', type: 'text', label: 'Current address / Dirección' },
    { key: 'referral', type: 'select', label: 'How did you hear about us? / ¿Dónde escuchaste de nosotros?', options: ['Referral / Recomendación', 'Search engine / Buscador', 'Social media / Redes sociales', 'AI / Inteligencia artificial', 'Other / Otro'] },
    { key: 'reason', type: 'textarea', label: 'Primary reason for visit / Razón principal de la visita', required: true },
    { key: 'last_visit_12mo', type: 'radio', label: 'Have you seen a dentist in the last 12 months? / ¿Has visto a un dentista en los últimos 12 meses?', options: ['Yes / Sí', 'No'] },
    { key: 'concerns', type: 'textarea', label: 'Current dental concerns / Dolores o dudas actuales' },
    { key: 'oral_satisfaction', type: 'scale', label: 'Satisfaction with your oral health / Satisfacción con tu salud oral', min: 1, max: 10 },
    { key: 'conditions', type: 'checkbox_group', label: 'Systemic conditions / Condiciones sistémicas', options: ['Diabetes', 'Heart disease / Hypertension · Enfermedad cardíaca / Hipertensión', 'Autoimmune / Autoinmune', 'Thyroid / Tiroides', 'Gastrointestinal', 'Chronic fatigue / Fatiga crónica'] },
    { key: 'smoking', type: 'radio', label: 'Do you smoke? / ¿Fumas?', options: ['No', 'Yes / Sí', 'Vape', 'Both / Ambos'] },
    { key: 'years_smoked', type: 'text', label: 'Years smoked (if applicable) / Años fumando (si aplica)' },
    { key: 'substance_statement', type: 'textarea', label: 'Substance use — for your safety during care / Uso de sustancias — para tu seguridad durante el tratamiento', placeholder: 'Shared confidentially to keep sedation and treatment safe.' },
    { key: 'substance_reason', type: 'radio', label: 'If applicable, reason / Si aplica, motivo', options: ['Recreational / Recreativo', 'Medical / Médico', 'Both / Ambos', 'N/A'] },
    { key: 'agree_brush', type: 'likert', label: 'I brush twice daily / Me cepillo dos veces al día' },
    { key: 'agree_floss', type: 'likert', label: 'I floss daily / Uso hilo dental a diario' },
    { key: 'agree_natural', type: 'likert', label: 'I use natural toothpaste / Uso pasta dental natural' },
    { key: 'agree_mercury', type: 'likert', label: 'I am concerned about mercury / metal fillings / Me preocupan las amalgamas de mercurio / metal' },
    { key: 'allergies', type: 'text', label: 'Known allergies / Alergias conocidas' },
    { key: 'comm_pref', type: 'radio', label: 'Communication preference / Preferencia de contacto', options: ['Email', 'WhatsApp', 'Phone / Teléfono'] },
    { key: 'travel_duration', type: 'text', label: 'Travel duration, for international cases / Duración del viaje (casos internacionales)' },
    { key: 'accommodation', type: 'radio', label: 'Accommodation required? / ¿Necesitas alojamiento?', options: ['Yes / Sí', 'No', 'Maybe / Quizás'] },
    { key: 'attachments', type: 'file', label: 'X-rays or dental history photos / Radiografías o fotos de tu historial dental' },
  ],
};

const HORMONAL = {
  clinic_type: 'hormonal',
  name: 'Hormonal & Menopause Support Intake',
  description: 'A gentle, thorough look at the hormonal season you are in, so your care can meet your body where it is.',
  fields: [
    { key: 'full_name', type: 'text', label: 'Full name', required: true },
    { key: 'dob', type: 'date', label: 'Date of birth', required: true },
    { key: 'email', type: 'email', label: 'Email', required: true },
    { key: 'symptoms', type: 'checkbox_group', label: 'Which symptoms are present for you?', options: ['Hot flashes', 'Sleep issues', 'Mood changes', 'Weight gain', 'Brain fog', 'Fatigue', 'Joint pain', 'Low libido'] },
    { key: 'last_period', type: 'date', label: 'Date of your last period' },
    { key: 'menstrual_history', type: 'textarea', label: 'Menstrual history', placeholder: 'Cycle regularity, changes you have noticed.' },
    { key: 'hrt_history', type: 'radio', label: 'Any history of hormone therapy?', options: ['No', 'Yes'] },
    { key: 'hrt_details', type: 'textarea', label: 'If yes, please share details' },
    { key: 'stress_level', type: 'scale', label: 'Current stress level', min: 1, max: 10 },
    { key: 'sleep_quality', type: 'scale', label: 'Sleep quality', min: 1, max: 10 },
    { key: 'diet_type', type: 'text', label: 'Diet type', placeholder: 'e.g. omnivore, plant-based, Mediterranean.' },
    { key: 'exercise_freq', type: 'text', label: 'Exercise frequency' },
    { key: 'goals', type: 'textarea', label: 'Your wellness goals' },
    { key: 'comm_pref', type: 'radio', label: 'Communication preference', options: ['Email', 'WhatsApp', 'Phone'] },
  ],
};

const THYROID = {
  clinic_type: 'thyroid',
  name: 'Thyroid Support Intake',
  description: 'Focused on your thyroid story — symptoms, history, and labs — to support balanced, whole-person care.',
  fields: [
    { key: 'full_name', type: 'text', label: 'Full name', required: true },
    { key: 'dob', type: 'date', label: 'Date of birth', required: true },
    { key: 'email', type: 'email', label: 'Email', required: true },
    { key: 'symptoms', type: 'checkbox_group', label: 'Which symptoms are present for you?', options: ['Fatigue', 'Weight changes', 'Hair loss', 'Brain fog', 'Anxiety', 'Cold/Heat sensitivity', 'Constipation/Diarrhea', 'Heart palpitations'] },
    { key: 'diagnosis', type: 'checkbox_group', label: 'Any thyroid diagnosis?', options: ["Hashimoto's", 'Hypothyroid', 'Hyperthyroid', 'Graves', 'None', 'Other'] },
    { key: 'medications', type: 'textarea', label: 'Current thyroid medications', placeholder: 'Name and dose, if known.' },
    { key: 'last_tsh', type: 'text', label: 'Last TSH result (if known)' },
    { key: 'family_history', type: 'textarea', label: 'Family thyroid history' },
    { key: 'stress_level', type: 'scale', label: 'Current stress level', min: 1, max: 10 },
    { key: 'sleep_quality', type: 'scale', label: 'Sleep quality', min: 1, max: 10 },
    { key: 'goals', type: 'textarea', label: 'Your wellness goals' },
    { key: 'comm_pref', type: 'radio', label: 'Communication preference', options: ['Email', 'WhatsApp', 'Phone'] },
  ],
};

/* ============================================================
 * A5 — Foundational (Part A) + Part B variants, fully bilingual.
 * Every field carries label_en/label_es; options are {en,es}.
 * Part A foundational fields (keys in FOUNDATIONAL_KEYS) write into the
 * member's Digital Sovereign Passport "Foundational Health Data" (L2).
 * ============================================================ */

// Consent line shown at the top of every A5 form (template variables resolved client-side).
const A5_CONSENT = {
  en: 'Your answers live in YOUR Sovereign Passport — you own them and can export them anytime. They are shared with {practitioner_name} to prepare your care. This is never used for diagnosis without a licensed practitioner.',
  es: 'Tus respuestas viven en TU Pasaporte Soberano — son tuyas y puedes exportarlas cuando quieras. Se comparten con {practitioner_name} para preparar tu atención. Nunca se usa para diagnóstico sin un profesional licenciado.',
};

const opt = (en, es) => ({ en, es });

// Part A field keys that map to the Passport Foundational Health Data section (A5 §1: 1–5, 8–15).
const FOUNDATIONAL_KEYS = [
  'full_name', 'date_of_birth', 'email', 'phone', 'address',
  'systemic_conditions', 'medications_supplements', 'allergies',
  'smoking_status', 'smoking_years', 'substance_use', 'substance_reason', 'substance_method',
];

const FOUNDATIONAL_FIELDS = [
  { key: 'full_name', type: 'text', required: true, label_en: 'Full Name', label_es: 'Nombre completo' },
  { key: 'date_of_birth', type: 'date', required: true, label_en: 'Date of Birth', label_es: 'Fecha de nacimiento' },
  { key: 'email', type: 'email', required: true, label_en: 'Email Address', label_es: 'Correo electrónico', prefill: 'email' },
  { key: 'phone', type: 'phone', required: true, label_en: 'Phone Number', label_es: 'Número de teléfono' },
  { key: 'address', type: 'text', required: true, label_en: 'Current Address/Location', label_es: 'Dirección actual' },
  { key: 'referral_source', type: 'select', required: true, label_en: 'How did you hear about {clinic_name}?', label_es: '¿Dónde escuchaste de nosotros?', allowOther: true,
    options: [opt('Referral (Friend/Family)', 'Amigo o familiar'), opt('Solaris network', 'Red Solaris'), opt('Search Engine (Google, Bing…)', 'Buscador web'), opt('Facebook', 'Facebook'), opt('Instagram', 'Instagram'), opt('TikTok', 'TikTok'), opt('X', 'X'), opt('Website', 'Sitio web'), opt('AI (ChatGPT, Grok, Gemini…)', 'IA'), opt('Other', 'Otro')] },
  { key: 'visit_reason', type: 'textarea', required: true, label_en: 'What is the primary reason for your visit?', label_es: '¿Cuál es la razón principal de tu visita?' },
  { key: 'systemic_conditions', type: 'checkbox_group', required: true, label_en: 'Please select any conditions you have been diagnosed with', label_es: 'Selecciona si padeces alguna enfermedad diagnosticada',
    options: [opt('Diabetes', 'Diabetes'), opt('Heart Disease / High Blood Pressure', 'Problemas del corazón / hipertensión'), opt('Autoimmune Disorder (Lupus, RA…)', 'Enfermedades autoinmunes'), opt('Thyroid Disorder', 'Problemas de tiroides'), opt("Gastrointestinal Issues (IBS, Crohn's…)", 'Enfermedades gastrointestinales'), opt('Chronic Fatigue / Fibromyalgia', 'Fatiga crónica / Fibromialgia'), opt('None of the above', 'Ninguna de las anteriores'), opt('Other', 'Otra')] },
  { key: 'medications_supplements', type: 'textarea', required: true, label_en: 'Are you currently taking any medications, supplements, or homeopathic remedies? Please list them.', label_es: '¿Tomas algún medicamento, suplemento o medicina homeopática? Haz la lista.' },
  { key: 'allergies', type: 'textarea', required: true, label_en: 'Do you have any known allergies (medication, latex, metals, food)? Please specify.', label_es: '¿Tienes alguna alergia conocida (medicamentos, látex, metales, alimentos)? Especifica.' },
  { key: 'smoking_status', type: 'select', label_en: 'Do you currently smoke?', label_es: '¿Fumas?',
    options: [opt('Yes', 'Sí'), opt('No', 'No'), opt('Yes, vape / e-cigarettes', 'Sí, vape o cigarrillos electrónicos'), opt('Yes, both', 'Sí, ambos')] },
  { key: 'smoking_years', type: 'number', label_en: 'For how many years?', label_es: '¿Cuántos años llevas fumando?', showIf: { field: 'smoking_status', notEquals: 'No' } },
  { key: 'substance_use', type: 'select', allowOther: true, label_en: 'Do you currently use any substances?', label_es: '¿Consumes actualmente alguna sustancia?',
    helper_en: 'Certain habits and substances may affect anesthesia, bleeding, healing, or response to treatment. This is used strictly for clinical safety.',
    helper_es: 'Ciertos hábitos y sustancias pueden afectar la anestesia, el sangrado, la cicatrización o la respuesta al tratamiento. Se usa exclusivamente con fines clínicos y de seguridad.',
    options: [opt('Yes', 'Sí'), opt('No', 'No'), opt('Cannabis / Marijuana', 'Cannabis / Marihuana'), opt('CBD', 'CBD'), opt('Other', 'Otra')] },
  { key: 'substance_reason', type: 'select', label_en: 'Reason for use', label_es: 'Razón de uso', showIf: { field: 'substance_use', notEquals: 'No' },
    options: [opt('Recreational', 'Recreación'), opt('Medical', 'Médica'), opt('Both', 'Ambas'), opt('N/A', 'Ninguna')] },
  { key: 'substance_method', type: 'text', label_en: 'Method of use', label_es: 'Método de uso', showIf: { field: 'substance_use', notEquals: 'No' } },
  { key: 'communication_pref', type: 'select', required: true, allowOther: true, label_en: 'Preferred communication', label_es: '¿Cómo prefieres comunicarte?',
    options: [opt('Email', 'Correo'), opt('WhatsApp', 'WhatsApp'), opt('Other', 'Otro')] },
  { key: 'uploads', type: 'file', label_en: 'Upload any X-rays, labs, or medical history', label_es: 'Sube radiografías, laboratorios o historial médico' },
  // Traveling Patient module (default ON for clinics serving health travelers)
  { key: 'visit_duration_dates', type: 'textarea', module: 'traveling', label_en: 'If visiting from abroad, how long do you plan to stay and roughly which dates? Most treatment plans recommend {recommended_stay}.', label_es: 'Si vienes del extranjero, ¿cuánto tiempo planeas quedarte y en qué fechas aproximadas? La mayoría de los planes recomiendan {recommended_stay}.' },
  { key: 'accommodation_needed', type: 'select', module: 'traveling', allowOther: true, label_en: "Would you like accommodation through the clinic's discounted hotel or Airbnb partners?", label_es: '¿Necesitas alojamiento con los hoteles o socios de Airbnb con descuento de la clínica?',
    options: [opt('No', 'No'), opt('Yes', 'Sí'), opt('Maybe', 'Quizás'), opt('Other', 'Otro')] },
];

const FOUNDATIONAL = {
  clinic_type: 'foundational',
  name: 'Foundational Health Data · Datos fundamentales de salud',
  description: 'Part A — the whole-person foundation that lives in your Sovereign Passport. Complete once; reuse everywhere.',
  consent: A5_CONSENT,
  part: 'A',
  fields: FOUNDATIONAL_FIELDS,
};

// Part B — Variant 1: Dental
const DENTAL_V1 = {
  clinic_type: 'dental', // overwrites the legacy dental template with the A5 bilingual variant
  name: 'Dental Intake (Part B) · Formulario Dental',
  description: "Part B for dental clinics — combined with your Foundational Health Data.",
  consent: A5_CONSENT,
  part: 'B',
  variant: 'dental',
  fields: [
    { key: 'dentist_last_12mo', type: 'radio', required: true, label_en: 'Have you seen a dentist in the last 12 months?', label_es: '¿Has visitado algún dentista en los últimos 12 meses?', options: [opt('Yes', 'Sí'), opt('No', 'No')] },
    { key: 'dental_concerns', type: 'textarea', label_en: 'Any current dental concerns or pain? Please describe.', label_es: '¿Tienes algún dolor o duda sobre el estado de tus dientes? Descríbelo.' },
    { key: 'oral_health_satisfaction', type: 'scale', min: 1, max: 10, label_en: 'Rate your overall oral health satisfaction', label_es: 'Satisfacción con tu salud bucal' },
    { key: 'oral_brush', type: 'likert', label_en: 'I brush my teeth at least twice daily.', label_es: 'Me cepillo los dientes al menos dos veces al día.' },
    { key: 'oral_floss', type: 'likert', label_en: 'I floss daily.', label_es: 'Uso hilo dental a diario.' },
    { key: 'oral_natural', type: 'likert', label_en: 'I use a natural/fluoride-free toothpaste.', label_es: 'Utilizo pasta de dientes natural / sin flúor.' },
    { key: 'oral_mercury', type: 'likert', label_en: 'I am concerned about mercury/metal in my dental work.', label_es: 'Me preocupa el mercurio / metal en mi trabajo dental.' },
    { key: 'dental_uploads', type: 'file', label_en: 'If you have no records, photos of your mouth from multiple angles help a lot.', label_es: 'Si no tienes nada, fotos de tu boca desde varios ángulos nos ayudan mucho.' },
  ],
};

// Part B — Variant 2: Holistic / General Wellness
const HOLISTIC_V2 = {
  clinic_type: 'holistic',
  name: 'Holistic Wellness Intake (Part B) · Bienestar holístico',
  description: 'Part B for holistic / general-wellness practitioners.',
  consent: A5_CONSENT,
  part: 'B',
  variant: 'holistic',
  fields: [
    { key: 'health_goals', type: 'textarea', required: true, label_en: 'What are your top 1–3 health goals right now?', label_es: '¿Cuáles son tus 1–3 metas de salud principales ahora?' },
    { key: 'energy_level', type: 'scale', min: 1, max: 10, label_en: 'Typical daily energy', label_es: 'Energía diaria típica' },
    { key: 'sleep_quality', type: 'scale', min: 1, max: 10, label_en: 'Sleep quality', label_es: 'Calidad del sueño' },
    { key: 'stress_level', type: 'scale', min: 1, max: 10, label_en: 'Current stress', label_es: 'Estrés actual' },
    { key: 'digestion', type: 'scale', min: 1, max: 10, label_en: 'Digestive comfort', label_es: 'Comodidad digestiva' },
    { key: 'prior_holistic_care', type: 'textarea', label_en: "Holistic practices you've tried (nutrition, acupuncture, breathwork…)", label_es: 'Prácticas holísticas que has probado' },
    { key: 'current_practitioners', type: 'text', label_en: 'Practitioners currently supporting you', label_es: 'Profesionales que te acompañan actualmente' },
  ],
};

// Part B — Variant 3: Mental Health / Emotional Wellness
const MENTAL_V3 = {
  clinic_type: 'mental_health',
  name: 'Mental & Emotional Wellness Intake (Part B) · Bienestar mental',
  description: 'Part B for mental-health / emotional-wellness practitioners.',
  consent: A5_CONSENT,
  part: 'B',
  variant: 'mental_health',
  fields: [
    { key: 'support_reason', type: 'textarea', required: true, label_en: 'What brings you to seek support right now?', label_es: '¿Qué te trae a buscar apoyo en este momento?' },
    { key: 'current_stress', type: 'scale', min: 1, max: 10, label_en: 'Current stress', label_es: 'Estrés actual' },
    { key: 'sleep_quality', type: 'scale', min: 1, max: 10, label_en: 'Sleep quality', label_es: 'Calidad del sueño' },
    { key: 'support_system', type: 'select', label_en: 'Support around you', label_es: 'Apoyo a tu alrededor', options: [opt('Strong', 'Fuerte'), opt('Some', 'Algo'), opt('Limited', 'Limitado'), opt('Prefer not to say', 'Prefiero no decir')] },
    { key: 'prior_therapy', type: 'radio', label_en: 'Have you worked with a therapist or coach before?', label_es: '¿Has trabajado antes con un terapeuta o coach?', options: [opt('Yes', 'Sí'), opt('No', 'No')] },
    { key: 'safety_note', type: 'statement', label_en: 'This form is not for emergencies. If you are in crisis, contact local emergency services or a crisis line now — your practitioner will also go through this with you.', label_es: 'Este formulario no es para emergencias. Si estás en crisis, contacta a los servicios de emergencia locales ahora.' },
  ],
};

// Specialty → Part B variant (A5 §3): dental → V1, wellness → V2, mental health → V3.
const SPECIALTY_VARIANT = {
  dental: 'dental', dentist: 'dental',
  holistic: 'holistic', wellness: 'holistic', nutrition: 'holistic', nutritionist: 'holistic', naturopath: 'holistic',
  mental_health: 'mental_health', 'mental-health': 'mental_health', therapist: 'mental_health', psychologist: 'mental_health', coach: 'mental_health',
};

const TEMPLATES = [FOUNDATIONAL, GENERAL, DENTAL_V1, HOLISTIC_V2, MENTAL_V3, HORMONAL, THYROID];

/** Idempotently upsert the four system templates. Returns id keyed by clinic_type. */
async function seedIntakeTemplates(db) {
  const ids = {};
  for (const t of TEMPLATES) {
    const existing = await db.query(
      'SELECT id FROM intake_form_templates WHERE clinic_type=$1 AND is_system=TRUE',
      [t.clinic_type]
    );
    const consent = t.consent ? JSON.stringify(t.consent) : null;
    if (existing.rows[0]) {
      await db.query(
        'UPDATE intake_form_templates SET name=$2, description=$3, fields_json=$4, is_active=TRUE, part=$5, variant=$6, consent_json=$7 WHERE id=$1',
        [existing.rows[0].id, t.name, t.description, JSON.stringify(t.fields), t.part || null, t.variant || null, consent]
      );
      ids[t.clinic_type] = existing.rows[0].id;
    } else {
      const ins = await db.query(
        `INSERT INTO intake_form_templates (clinic_type, name, description, fields_json, is_active, is_system, part, variant, consent_json)
         VALUES ($1,$2,$3,$4,TRUE,TRUE,$5,$6,$7) RETURNING id`,
        [t.clinic_type, t.name, t.description, JSON.stringify(t.fields), t.part || null, t.variant || null, consent]
      );
      ids[t.clinic_type] = ins.rows[0].id;
    }
  }
  return ids;
}

module.exports = { TEMPLATES, seedIntakeTemplates, FOUNDATIONAL_KEYS, FOUNDATIONAL, SPECIALTY_VARIANT };
