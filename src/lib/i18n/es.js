// Spanish catalog. Node F — Solaris en/es locale foundation.
// Non-safety keys are translated. SAFETY_KEYS (consent/legal/clinical/crisis) are
// intentionally left as the REVIEW_PENDING sentinel: they MUST NOT be machine-
// translated. i18n/index.js detects the sentinel and the locale system surfaces the
// English source at runtime while flagging a release blocker until a human-reviewed
// Spanish translation is supplied. See src/__tests__/i18n.locale.test.jsx.
import { REVIEW_PENDING } from './constants.js';

export default {
  // ── Welcome / onboarding ──
  'welcome.beginEn': 'Begin in English',
  'welcome.beginEs': 'Comenzar en español',
  'welcome.headline': 'Sanar • Aprender • Ganar',
  'welcome.subhead': 'No estás roto. Tu cuerpo está hablando. Solaris te ayuda a escuchar.',
  'welcome.start': 'Comenzar mi camino',
  'welcome.skip': 'Omitir',

  // ── Primary navigation ──
  'nav.home': 'Inicio',
  'nav.explore': 'Explorar',
  'nav.journey': 'Camino',
  'nav.communications': 'Comunicaciones',
  'nav.growth': 'Crecimiento',
  'nav.clients': 'Clientes',
  'nav.bookings': 'Reservas',
  'nav.messages': 'Mensajes',
  'nav.more': 'Más',
  'nav.dashboard': 'Panel',
  'nav.health': 'Salud',
  'nav.coach': 'LUCA',
  'nav.economic': 'Economía',
  'nav.journal': 'Diario',
  'nav.media': 'Multimedia',

  // ── Common actions ──
  'action.book': 'Reservar cita',
  'action.save': 'Guardar',
  'action.dismiss': 'Descartar',
  'action.view': 'Ver',
  'action.retry': 'Reintentar',
  'action.cancel': 'Cancelar',
  'action.confirm': 'Confirmar',
  'action.continue': 'Continuar',
  'action.back': 'Atrás',
  'action.close': 'Cerrar',
  'action.expand': 'Expandir',
  'action.collapse': 'Contraer',

  // ── Messages filters (Communications) ──
  'msg.filterAll': 'Todos',
  'msg.filterBookings': 'Reservas',
  'msg.filterUnread': 'No leídos',

  // ── Dashboard · LUCA recommendation cards ──
  'dash.lucaRecommends': 'LUCA recomienda',
  'dash.personalizedForYou': 'Personalizado para ti',
  'dash.curatedJourney': 'Camino personalizado para ti',

  // ── Language switcher ──
  'lang.label': 'Idioma',
  'lang.english': 'English',
  'lang.spanish': 'Español',

  // ── Portal switching (Node E5) ──
  'portal.switchToPractitioner': 'Cambiar al portal de profesional',
  'portal.switchToMember': 'Cambiar a miembro',
  'portal.myPractice': 'Mi práctica',

  // ── Join Solaris (Node G) ──
  'join.title': 'Unirse a Solaris',
  'join.applyPractitioner': 'Postularme como profesional',
  'join.addPractice': 'También quiero agregar una práctica, clínica, lugar u oferta.',
  'join.addOrClaim': 'Agregar o reclamar una práctica',
  'status.draft': 'Borrador',
  'status.submitted': 'Enviado',
  'status.underReview': 'En revisión',
  'status.needsInfo': 'Información requerida',
  'status.approved': 'Aprobado',
  'status.rejected': 'Rechazado',
  'status.suspended': 'Suspendido',

  // ── LUCA (intelligence layer) ──
  'luca.whyThis': 'Por qué apareció esto',
  'luca.assumptions': 'Supuestos',
  'luca.unknowns': 'Lo que no sabemos',
  'luca.simulatedBadge': 'Vista previa beta \u2014 Simulado',
  'luca.draftBadge': 'Borrador \u2014 no enviado',

  // ── Empty / error states ──
  'empty.noAvailability': 'No hay horarios disponibles ahora. Vuelve pronto.',
  'empty.noResults': 'Aún no hay nada que mostrar.',
  'error.generic': 'Algo salió mal. Inténtalo de nuevo.',
  'error.offline': 'Parece que no tienes conexión.',

  // ── Spanish preview meta-notices (reviewed — NOT clinical content) ──
  'preview.spanishBadge': 'Vista previa en español',
  'preview.spanishDisclosure': 'El español es una vista previa temprana. Los avisos de seguridad, consentimiento, privacidad, clínicos, legales y de crisis se muestran en inglés revisado hasta que se apruebe una traducción al español calificada.',
  'preview.safetyReviewPending': 'La traducción al español de este aviso importante está en revisión. Se muestra en inglés revisado para mantener su exactitud.',

  // ── SAFETY / LEGAL / CLINICAL / CRISIS — REVIEWED TRANSLATION REQUIRED ──
  // Do NOT machine-translate. Left as REVIEW_PENDING until a qualified human review.
  'safety.consentToShare': REVIEW_PENDING,
  'safety.notMedicalAdvice': REVIEW_PENDING,
  'safety.crisis': REVIEW_PENDING,
  'safety.dataUse': REVIEW_PENDING,
};
