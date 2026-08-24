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

  // ── Onboarding cinematic screens (K1.2 §5 — ordinary UI, translatable) ──
  'ob.splash.holistic': 'Holistic Health',
  'ob.splash.goldenAge': 'Enter the Golden Age',
  'ob.splash.protocol': 'Sovereign Health Protocol',
  'ob.welcome.pill': 'Welcome to the Sanctuary',
  'ob.golden.eyebrow': 'The Golden Age',
  'ob.golden.titleHead': 'A sanctuary of precision',
  'ob.golden.titleAccent': 'and wellness',
  'ob.golden.body': 'Where futuristic technology meets the warmth of human healing. Your body has ancient wisdom — we give it a modern voice.',
  'ob.hle.eyebrow': 'The Solaris Promise',
  'ob.hle.title': 'Heal · Learn · Earn',
  'ob.hle.healTitle': 'Heal',
  'ob.hle.healBody': 'Restore your biological rhythms with nature’s wisdom and ancient practice.',
  'ob.hle.learnTitle': 'Learn',
  'ob.hle.learnBody': 'Understand your 360° health across mind, body, emotion and spirit.',
  'ob.hle.earnTitle': 'Earn',
  'ob.hle.earnBody': 'Your vitality is an asset. Generate SOL tokens for every milestone of your journey.',
  'ob.method.eyebrow': 'The Method',
  'ob.method.title': 'The Solaris Method',
  'ob.method.body': "A holistic ecosystem designed to reconnect your biological rhythms with nature's wisdom — through technology and ancient practice.",
  'ob.method.quote': '"Traditional medicine looks for symptoms. Solaris looks for harmony."',
  'ob.speaking.titleHead': 'Your body is',
  'ob.speaking.titleAccent': 'speaking',
  'ob.speaking.body': "Begin with a cinematic assessment of your 4 Aspects of Being and 8 Body Systems. In minutes, you'll see your whole self — reflected back.",
  'ob.speaking.begin': 'Begin Journey',
  'ob.speaking.trust': 'SECURE · PRIVATE · SOVEREIGN',

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
  'action.signOut': 'Sign out',
  'session.unavailableTitle': 'Solaris is temporarily unavailable',
  'session.unavailableBody': "We couldn't reach Solaris just now. Your session is safe — please try again in a moment.",
  'session.retrying': 'Reconnecting…',
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
  // K1.2 §4 — classified, user-safe auth/API error messages (never expose internals).
  'error.unavailable': 'Solaris is temporarily unavailable. Please try again shortly.',
  'error.timeout': 'The request took too long. Check your connection and try again.',
  'error.forbidden': "You don't have access to do that.",
  'error.fieldsRequired': 'Please enter your email and password.',
  'error.login.invalid': 'The email or password is incorrect.',
  'error.register.exists': 'An account already exists for this email. Sign in instead.',
  'error.register.password': 'Your password must be at least 8 characters and include a letter and a number.',
  'error.register.inviteOnly': 'Solaris is currently invite-only. Join the waitlist to request access.',
  'error.register.inviteWaitlistCta': 'Join the waitlist',

  // K1.2 §4/§5 — auth-flow field & on-device validation messages (user-safe).
  'auth.err.signinFields': 'Enter your email and password to sign in.',
  'auth.err.signupFields': 'Please complete every field to continue.',
  'auth.err.profileFields': 'Please complete the required profile fields.',
  'auth.err.invalidNsec': 'That does not look like a valid nsec key.',
  'auth.err.phraseInvalid': 'That does not look like a valid 12-word recovery phrase.',
  'auth.err.generateFailed': 'Could not generate an identity key. Please try again.',
  'auth.err.confirmSaved': 'Please confirm you have saved your private key to continue.',
  'auth.err.identityNoAccount': 'No Solaris account is linked to this identity key yet. Create an account to continue.',
  'auth.err.saveProfile': 'We could not save your profile. Your account is ready — please try saving again.',
  'auth.err.activate': 'We could not finish signing you in. Please try again.',

  // K1.2 §5 — ordinary auth-flow UI (welcome, sign-in, create account, profile).
  // NOTE: identity-key / key-custody / sovereignty copy stays in reviewed English.
  'auth.welcome.lede': "Choose how you'd like to begin your sovereign health journey.",
  'auth.welcome.betaBadge': 'Beta · Invite only',
  'auth.welcome.signinEmail': 'Sign in with email and password',
  'auth.welcome.signinKey': 'Sign in with identity key',
  'auth.welcome.createAccount': 'Create a Solaris account',
  'auth.welcome.inviteNote': 'Solaris is in invite-only Beta. Invited members can sign in above.',
  'auth.welcome.browse': 'Browse practitioners',
  'auth.signin.title': 'Welcome back',
  'auth.signin.lede': 'Sign in with the email and password on your Solaris account.',
  'auth.signin.busy': 'Signing in…',
  'auth.signin.submit': 'Sign in',
  'auth.create.title': 'Create your account',
  'auth.create.lede': 'Just the essentials to get started — you can add your Solaris identity key later.',
  'auth.create.busy': 'Creating your account…',
  'auth.transition.copy': ", your account is ready — now here's the part nobody else gives you.",
  'auth.profile.title': 'Your profile',
  'auth.profile.lede': 'A few details to personalise your Solaris journey.',
  'auth.profile.busy': 'Creating your Solaris account…',
  'auth.profile.submit': 'Continue to my intake',
  'auth.field.email': 'Email',
  'auth.field.password': 'Password',
  'auth.field.firstName': 'First name',
  'auth.field.lastName': 'Last name',
  'auth.field.dob': 'Date of birth',
  'auth.field.country': 'Country',
  'auth.field.city': 'City / current location',
  'auth.field.cityPlaceholder': 'Your current city',
  'auth.field.timezone': 'Timezone',
  'auth.field.language': 'Language',
  'auth.field.contactEmail': 'Contact email',
  'auth.field.phone': 'Phone',
  'auth.field.optional': '(optional)',

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
