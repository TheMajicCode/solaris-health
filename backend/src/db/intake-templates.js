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

const TEMPLATES = [GENERAL, DENTAL, HORMONAL, THYROID];

/** Idempotently upsert the four system templates. Returns id keyed by clinic_type. */
async function seedIntakeTemplates(db) {
  const ids = {};
  for (const t of TEMPLATES) {
    const existing = await db.query(
      'SELECT id FROM intake_form_templates WHERE clinic_type=$1 AND is_system=TRUE',
      [t.clinic_type]
    );
    if (existing.rows[0]) {
      await db.query(
        'UPDATE intake_form_templates SET name=$2, description=$3, fields_json=$4, is_active=TRUE WHERE id=$1',
        [existing.rows[0].id, t.name, t.description, JSON.stringify(t.fields)]
      );
      ids[t.clinic_type] = existing.rows[0].id;
    } else {
      const ins = await db.query(
        `INSERT INTO intake_form_templates (clinic_type, name, description, fields_json, is_active, is_system)
         VALUES ($1,$2,$3,$4,TRUE,TRUE) RETURNING id`,
        [t.clinic_type, t.name, t.description, JSON.stringify(t.fields)]
      );
      ids[t.clinic_type] = ins.rows[0].id;
    }
  }
  return ids;
}

module.exports = { TEMPLATES, seedIntakeTemplates };
