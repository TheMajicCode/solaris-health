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

  // ── Onboarding ──
  'ob.splash.holistic': 'Salud Holística',
  'ob.splash.goldenAge': 'Entra en la Edad Dorada',
  'ob.splash.protocol': 'Protocolo de Salud Soberana',
  'ob.welcome.pill': 'Bienvenido al Santuario',
  'ob.golden.eyebrow': 'La Edad Dorada',
  'ob.golden.titleHead': 'Un santuario de precisión',
  'ob.golden.titleAccent': 'y bienestar',
  'ob.golden.body': 'Donde la tecnología futurista se encuentra con la calidez de la sanación humana. Tu cuerpo tiene una sabiduría ancestral — nosotros le damos una voz moderna.',
  'ob.hle.eyebrow': 'La Promesa Solaris',
  'ob.hle.title': 'Sanar · Aprender · Ganar',
  'ob.hle.healTitle': 'Sanar',
  'ob.hle.healBody': 'Restaura tus ritmos biológicos con la sabiduría de la naturaleza y la práctica ancestral.',
  'ob.hle.learnTitle': 'Aprender',
  'ob.hle.learnBody': 'Comprende tu salud en 360° a través de mente, cuerpo, emoción y espíritu.',
  'ob.hle.earnTitle': 'Ganar',
  'ob.hle.earnBody': 'Tu vitalidad es un activo. Genera tokens SOL por cada hito de tu camino.',
  'ob.method.eyebrow': 'El Método',
  'ob.method.title': 'El Método Solaris',
  'ob.method.body': 'Un ecosistema holístico diseñado para reconectar tus ritmos biológicos con la sabiduría de la naturaleza — a través de la tecnología y la práctica ancestral.',
  'ob.method.quote': '"La medicina tradicional busca síntomas. Solaris busca armonía."',
  'ob.speaking.titleHead': 'Tu cuerpo está',
  'ob.speaking.titleAccent': 'hablando',
  'ob.speaking.body': 'Comienza con una evaluación cinematográfica de tus 4 Aspectos del Ser y 8 Sistemas Corporales. En minutos, verás tu ser completo — reflejado de vuelta.',
  'ob.speaking.begin': 'Comenzar el camino',
  'ob.speaking.trust': 'SEGURO · PRIVADO · SOBERANO',

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
  'action.signOut': 'Cerrar sesión',
  'session.unavailableTitle': 'Solaris no está disponible temporalmente',
  'session.unavailableBody': 'No pudimos conectar con Solaris en este momento. Tu sesión está a salvo — inténtalo de nuevo en un momento.',
  'session.retrying': 'Reconectando...',
  'action.cancel': 'Cancelar',
  'action.confirm': 'Confirmar',
  'action.continue': 'Continuar',
  'action.back': 'Atrás',
  'action.close': 'Cerrar',
  'action.expand': 'Expandir',
  'action.collapse': 'Contraer',
  'action.maximize': 'Pantalla completa',
  'action.minimize': 'Minimizar',
  'luca.online': 'En línea',
  'luca.offlineMode': 'Modo sin conexión',
  'luca.paused': 'En pausa',
  'luca.tagline': 'Inteligencia centrada en el corazón',
  'luca.voiceOn': 'Voz activada',
  'luca.voiceOff': 'Voz desactivada',
  'luca.message': 'mensaje',
  'luca.messages': 'mensajes',

  // ── Messages filters (Communications) ──
  'msg.filterAll': 'Todos',
  'msg.filterBookings': 'Reservas',
  'msg.filterUnread': 'No leídos',

  // ── Communications binder (folders) ──
  'comm.withOthers': 'Con otras personas',
  'comm.withOthersSub': 'Mensajes seguros con tus profesionales',
  'comm.withYourself': 'Contigo mismo',
  'comm.withYourselfSub': 'Tu diario, crecimiento y contenido privados',

  // ── Privacy & Sharing (Beta, device-local) ──
  'share.sectionTitle': 'Privacidad y uso compartido',
  'share.sectionHint': 'Elige qué estás dispuesto a compartir con tus profesionales de forma predeterminada. Compartir es opcional y puedes cambiarlo cuando quieras.',
  'share.savedOnDevice': 'Guardado en este dispositivo',
  'share.whatIShare': 'Qué comparto',
  'share.messagePractitioner': 'Enviar mensaje al profesional',
  'share.opening': 'Abriendo…',
  'share.bookingOverrideTitle': 'Qué comparto para esta reserva',
  'share.bookingOverrideHint': 'Estas opciones se aplican solo a esta cita y anulan tus valores predeterminados.',
  'share.usingDefaults': 'Usando los valores predeterminados de tu cuenta',
  'share.useDefaults': 'Usar mis valores predeterminados',
  'share.saveDefaults': 'Guardar valores de uso compartido',
  'share.cat.checkins': 'Registros diarios',
  'share.cat.checkins.hint': 'Registros de ánimo, energía y síntomas que anotas en Solaris.',
  'share.cat.journalSummaries': 'Reflexiones del diario',
  'share.cat.journalSummaries.hint': 'Resúmenes de las reflexiones privadas que decidas mostrar.',
  'share.cat.assessments': 'Resultados de evaluaciones',
  'share.cat.assessments.hint': 'Resultados de las evaluaciones que hayas completado.',
  'share.cat.passport': 'Datos básicos del Pasaporte de Salud',
  'share.cat.passport.hint': 'Datos básicos no clínicos del pasaporte que decidas compartir.',
  'share.cat.contact': 'Datos de contacto',
  'share.cat.contact.hint': 'Un teléfono o correo para coordinar la cita.',

  // ── Dashboard · LUCA recommendation cards ──
  'dash.lucaRecommends': 'LUCA recomienda',
  'dash.personalizedForYou': 'Personalizado para ti',
  'dash.curatedJourney': 'Camino personalizado para ti',
  'dash.viewProvider': 'Ver profesional',
  'dash.explore': 'Explorar',

  // ── Language switcher ──
  'lang.label': 'Idioma',
  'lang.english': 'English',
  'lang.spanish': 'Español',

  // ── Account / profile menu ──
  'menu.myProfile': 'Mi perfil',
  'menu.settings': 'Ajustes',
  'menu.identityData': 'Identidad y datos',

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
  // K1.2 §4 — mensajes de error de autenticación/API clasificados y seguros.
  'error.unavailable': 'Solaris no está disponible temporalmente. Inténtalo de nuevo en un momento.',
  'error.timeout': 'La solicitud tardó demasiado. Revisa tu conexión e inténtalo de nuevo.',
  'error.forbidden': 'No tienes acceso para hacer eso.',
  'error.fieldsRequired': 'Introduce tu correo electrónico y contraseña.',
  'error.login.invalid': 'El correo electrónico o la contraseña son incorrectos.',
  'error.register.exists': 'Ya existe una cuenta con este correo electrónico. Inicia sesión.',
  'error.register.password': 'Tu contraseña debe tener al menos 8 caracteres e incluir una letra y un número.',
  'error.register.inviteOnly': 'Solaris es actualmente solo por invitación. Únete a la lista de espera para solicitar acceso.',
  'error.register.inviteWaitlistCta': 'Unirse a la lista de espera',

  // K1.2 §4/§5 — mensajes de campos y validación en el dispositivo (seguros).
  'auth.err.signinFields': 'Ingresa tu correo y contraseña para iniciar sesión.',
  'auth.err.signupFields': 'Completa todos los campos para continuar.',
  'auth.err.profileFields': 'Completa los campos obligatorios del perfil.',
  'auth.err.invalidNsec': 'Eso no parece una clave nsec válida.',
  'auth.err.phraseInvalid': 'Eso no parece una frase de recuperación válida de 12 palabras.',
  'auth.err.generateFailed': 'No se pudo generar una clave de identidad. Inténtalo de nuevo.',
  'auth.err.confirmSaved': 'Confirma que has guardado tu clave privada para continuar.',
  'auth.err.identityNoAccount': 'Aún no hay ninguna cuenta de Solaris vinculada a esta clave de identidad. Crea una cuenta para continuar.',
  'auth.err.saveProfile': 'No pudimos guardar tu perfil. Tu cuenta está lista — intenta guardar de nuevo.',
  'auth.err.activate': 'No pudimos completar tu inicio de sesión. Inténtalo de nuevo.',

  // K1.2 §5 — UI ordinaria del flujo de autenticación (bienvenida, inicio de
  // sesión, crear cuenta, perfil). El texto de clave de identidad / custodia /
  // soberanía permanece en inglés revisado.
  'auth.welcome.lede': 'Elige cómo quieres comenzar tu camino de salud soberana.',
  'auth.welcome.betaBadge': 'Beta · Solo por invitación',
  'auth.welcome.signinEmail': 'Iniciar sesión con correo y contraseña',
  'auth.welcome.signinKey': 'Iniciar sesión con clave de identidad',
  'auth.welcome.createAccount': 'Crear una cuenta de Solaris',
  'auth.welcome.inviteNote': 'Solaris está en Beta solo por invitación. Los miembros invitados pueden iniciar sesión arriba.',
  'auth.welcome.browse': 'Explorar profesionales',
  'auth.signin.title': 'Bienvenido de nuevo',
  'auth.signin.lede': 'Inicia sesión con el correo y la contraseña de tu cuenta de Solaris.',
  'auth.signin.busy': 'Iniciando sesión…',
  'auth.signin.submit': 'Iniciar sesión',
  'auth.create.title': 'Crea tu cuenta',
  'auth.create.lede': 'Solo lo esencial para empezar — puedes añadir tu clave de identidad de Solaris más tarde.',
  'auth.create.busy': 'Creando tu cuenta…',
  'auth.transition.copy': ', tu cuenta está lista — ahora viene la parte que nadie más te da.',
  'auth.profile.title': 'Tu perfil',
  'auth.profile.lede': 'Algunos datos para personalizar tu camino en Solaris.',
  'auth.profile.busy': 'Creando tu cuenta de Solaris…',
  'auth.profile.submit': 'Continuar a mi evaluación',
  'auth.field.email': 'Correo electrónico',
  'auth.field.password': 'Contraseña',
  'auth.field.firstName': 'Nombre',
  'auth.field.lastName': 'Apellido',
  'auth.field.dob': 'Fecha de nacimiento',
  'auth.field.country': 'País',
  'auth.field.city': 'Ciudad / ubicación actual',
  'auth.field.cityPlaceholder': 'Tu ciudad actual',
  'auth.field.timezone': 'Zona horaria',
  'auth.field.language': 'Idioma',
  'auth.field.contactEmail': 'Correo de contacto',
  'auth.field.phone': 'Teléfono',
  'auth.field.optional': '(opcional)',

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
