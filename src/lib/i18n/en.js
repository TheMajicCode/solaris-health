// English catalog (source locale). Node F — Solaris en/es locale foundation.
// Every key here MUST also exist in es.js (enforced by src/__tests__/i18n.locale.test.jsx
// which FAILS CI on divergence). Keys under i18n SAFETY_KEYS carry consent / legal /
// clinical / crisis meaning and MUST NOT be machine-translated — see es.js.
export default {
  // ── Welcome / onboarding ──
  'welcome.beginEn': 'Begin in English',
  'welcome.beginEs': 'Comenzar en español',
  'welcome.headline': 'Heal • Learn • Earn',
  'welcome.subhead': 'You are not broken. Your body is speaking. Solaris helps you listen.',
  'welcome.start': 'Start My Journey',
  'welcome.skip': 'Skip',

  // ── Primary navigation ──
  'nav.home': 'Home',
  'nav.explore': 'Explore',
  'nav.journey': 'Journey',
  'nav.communications': 'Communications',
  'nav.growth': 'Growth',
  'nav.clients': 'Clients',
  'nav.bookings': 'Bookings',
  'nav.messages': 'Messages',
  'nav.more': 'More',
  'nav.dashboard': 'Dashboard',
  'nav.health': 'Health',
  'nav.coach': 'LUCA',
  'nav.economic': 'Economic',
  'nav.journal': 'Journal',
  'nav.media': 'Media',

  // ── Common actions ──
  'action.book': 'Book Appointment',
  'action.save': 'Save',
  'action.dismiss': 'Dismiss',
  'action.view': 'View',
  'action.retry': 'Retry',
  'action.cancel': 'Cancel',
  'action.confirm': 'Confirm',
  'action.continue': 'Continue',
  'action.back': 'Back',
  'action.close': 'Close',
  'action.expand': 'Expand',
  'action.collapse': 'Collapse',

  // ── Messages filters (Communications) ──
  'msg.filterAll': 'All',
  'msg.filterBookings': 'Bookings',
  'msg.filterUnread': 'Unread',

  // ── Dashboard · LUCA recommendation cards ──
  'dash.lucaRecommends': 'LUCA Recommends',
  'dash.personalizedForYou': 'Personalized for you',
  'dash.curatedJourney': 'Curated Journey for You',

  // ── Language switcher ──
  'lang.label': 'Language',
  'lang.english': 'English',
  'lang.spanish': 'Español',

  // ── Portal switching (Node E5) ──
  'portal.switchToPractitioner': 'Switch to Practitioner portal',
  'portal.switchToMember': 'Switch to Member',
  'portal.myPractice': 'My Practice',

  // ── Join Solaris (Node G) ──
  'join.title': 'Join Solaris',
  'join.applyPractitioner': 'Apply as a practitioner',
  'join.addPractice': 'I also want to add a practice, clinic, venue, or offering.',
  'join.addOrClaim': 'Add or claim a practice',
  'status.draft': 'Draft',
  'status.submitted': 'Submitted',
  'status.underReview': 'Under review',
  'status.needsInfo': 'Needs information',
  'status.approved': 'Approved',
  'status.rejected': 'Rejected',
  'status.suspended': 'Suspended',

  // ── LUCA (intelligence layer) ──
  'luca.whyThis': 'Why this surfaced',
  'luca.assumptions': 'Assumptions',
  'luca.unknowns': 'What we don\u2019t know',
  'luca.simulatedBadge': 'Beta preview \u2014 Simulated',
  'luca.draftBadge': 'Draft \u2014 not sent',

  // ── Empty / error states ──
  'empty.noAvailability': 'No open times right now. Check back soon.',
  'empty.noResults': 'Nothing to show yet.',
  'error.generic': 'Something went wrong. Please try again.',
  'error.offline': 'You appear to be offline.',

  // ── Spanish preview meta-notices (translatable — NOT clinical content) ──
  'preview.spanishBadge': 'Spanish preview',
  'preview.spanishDisclosure': 'Spanish is an early preview. Safety, consent, privacy, clinical, legal, and crisis notices are shown in reviewed English until a qualified Spanish translation is approved.',
  'preview.safetyReviewPending': 'Spanish translation of this important notice is under review. It is shown in reviewed English to keep it accurate.',

  // ── SAFETY / LEGAL / CLINICAL / CRISIS (reviewed translation required) ──
  'safety.consentToShare': 'By continuing you consent to share this information with your selected practitioner.',
  'safety.notMedicalAdvice': 'Solaris and LUCA provide organizational support only and do not provide medical, legal, or financial advice.',
  'safety.crisis': 'If you are in crisis or think you may harm yourself or others, contact your local emergency number immediately.',
  'safety.dataUse': 'Your health information is private. It is never used to train models or shared without your explicit consent.',
};
