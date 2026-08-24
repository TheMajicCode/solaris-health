import React, { useState, useEffect } from 'react';
import { useApp } from '../state/AppContext.jsx';
import { useLocale } from '../lib/i18n/LocaleContext.jsx';
import { enabledLocales } from '../lib/i18n/index.js';
import { SolarisMark, Wordmark, Button } from '../components/ui.jsx';
import { Shield, ArrowRight, Sparkles, Heart, GraduationCap, Coins } from 'lucide-react';

const SCREENS = [
  { key: 'splash' }, { key: 'welcome' }, { key: 'golden' }, { key: 'hle' }, { key: 'method' }, { key: 'speaking' },
];

export default function Onboarding() {
  const { setAuthView } = useApp();
  const [step, setStep] = useState(0);
  const screen = SCREENS[step].key;
  const next = () => (step < SCREENS.length - 1 ? setStep(step + 1) : setAuthView('auth'));

  // Auto-advance splash
  useEffect(() => {
    if (screen === 'splash') { const t = setTimeout(() => setStep(1), 2600); return () => clearTimeout(t); }
  }, [screen]);

  return (
    <div className="app-frame center" style={{ paddingBottom: 0, minHeight: '100vh' }}>
      <div className="sol-bg" />
      <div className="page full" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
        {screen === 'splash' && <Splash />}
        {screen === 'welcome' && <Welcome onNext={next} onSkip={() => setAuthView('auth')} />}
        {screen === 'golden' && <GoldenAge onNext={next} onSkip={() => setAuthView('auth')} />}
        {screen === 'hle' && <HealLearnEarn onNext={next} onSkip={() => setAuthView('auth')} />}
        {screen === 'method' && <SolarisMethod onNext={next} onSkip={() => setAuthView('auth')} />}
        {screen === 'speaking' && <BodySpeaking onNext={next} />}
        {screen !== 'splash' && (
          <div className="row gap-1 center" style={{ marginTop: 'auto', paddingTop: 24 }}>
            {SCREENS.slice(1).map((s, i) => (
              <span key={s.key} style={{ width: i + 1 === step ? 22 : 7, height: 7, borderRadius: 999,
                background: i + 1 === step ? 'var(--primary)' : 'rgba(220,226,248,0.2)', transition: 'all 0.5s var(--ease)' }} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

const SkipBtn = ({ onSkip }) => {
  const { t } = useLocale();
  return (
    <button onClick={onSkip} className="btn-tertiary" style={{ position: 'absolute', top: 18, right: 18, background: 'none', border: 'none', cursor: 'pointer' }}>{t('welcome.skip')}</button>
  );
};

function Splash() {
  const { t } = useLocale();
  return (
    <div className="center col full" style={{ flex: 1, gap: 20 }}>
      <div className="floaty fade-in" style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ position: 'absolute', inset: -50, borderRadius: '50%', background: 'radial-gradient(circle, rgba(78,222,163,0.22), transparent 65%)', animation: 'glowPulse 3s ease-in-out infinite' }} />
        <img src="/solaris-logo.png" alt="Solaris Holistic Health" style={{ width: 130, height: 130, objectFit: 'contain', filter: 'drop-shadow(0 0 18px rgba(47,190,159,0.5))' }} />
      </div>
      <div className="text-center fade-up delay-2">
        <p className="wordmark" style={{ fontSize: '2.4rem', letterSpacing: '.18em' }}>SOLARIS</p>
        <p style={{ color: 'rgba(47,190,159,0.85)', fontSize: '0.82rem', letterSpacing: '.22em', textTransform: 'uppercase', marginTop: 4 }}>{t('ob.splash.holistic')}</p>
        <p className="serif gold" style={{ fontStyle: 'italic', fontSize: '1.0rem', marginTop: 10 }}>{t('ob.splash.goldenAge')}</p>
      </div>
      <p className="eyebrow fade-up delay-4" style={{ position: 'absolute', bottom: 40 }}>{t('ob.splash.protocol')}</p>
    </div>
  );
}

function Welcome({ onNext, onSkip }) {
  const { t, setLocale, locale } = useLocale();
  const choose = (loc) => { setLocale(loc); onNext(); };
  // Node F honesty gate: Spanish is a preview locale with safety strings still
  // under clinical review. Only surface the Spanish entry when the preview flag
  // enables it (see enabledLocales()); on Stable the button is hidden and
  // setLocale('es') is a no-op regardless.
  const spanishEnabled = enabledLocales().includes('es');
  return (
    <div className="center col full text-center" style={{ flex: 1, gap: 22, position: 'relative' }}>
      <SkipBtn onSkip={onSkip} />
      <div className="fade-up"><Pill /></div>
      <h1 className="display fade-up delay-1" style={{ fontSize: '2.8rem' }}>
        {t('welcome.headline')}
      </h1>
      <p className="muted fade-up delay-2" style={{ fontSize: '1.05rem', maxWidth: 320, lineHeight: 1.6 }}>
        {t('welcome.subhead')}
      </p>
      {/* Node F — explicit language entry. Sets the app-wide locale, persists it
          locally, then proceeds. Either button advances onboarding. */}
      <div className="fade-up delay-3 col" style={{ marginTop: 8, gap: 10, width: '100%', maxWidth: 320 }}>
        <Button onClick={() => choose('en')} aria-label="Begin in English">
          {t('welcome.beginEn')} <ArrowRight size={18} />
        </Button>
        {spanishEnabled && (
          <button
            onClick={() => choose('es')}
            aria-label="Comenzar en español (vista previa)"
            data-testid="welcome-begin-es"
            className="btn-secondary"
            style={{
              width: '100%', padding: '12px 18px', borderRadius: 12, cursor: 'pointer',
              border: '1px solid rgba(159,231,214,.3)', background: 'transparent', color: '#EAFBF4',
              fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontSize: 14, fontWeight: 600,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            }}
          >
            {t('welcome.beginEs')} · {t('preview.spanishBadge')} <ArrowRight size={18} />
          </button>
        )}
      </div>
    </div>
  );
}

const Pill = () => {
  const { t } = useLocale();
  return (
    <span className="pill" style={{ background: 'rgba(78,222,163,0.1)' }}><Sparkles size={13} /> {t('ob.welcome.pill')}</span>
  );
};

function GoldenAge({ onNext, onSkip }) {
  const { t } = useLocale();
  return (
    <div className="center col full text-center" style={{ flex: 1, gap: 20, position: 'relative' }}>
      <SkipBtn onSkip={onSkip} />
      <div className="floaty"><img src="/solaris-logo.png" alt="Solaris" style={{ width: 72, height: 72, objectFit: 'contain', filter: 'drop-shadow(0 0 10px rgba(47,190,159,0.4))' }} /></div>
      <p className="eyebrow fade-up gold">{t('ob.golden.eyebrow')}</p>
      <h1 className="display fade-up delay-1" style={{ fontSize: '2.3rem', maxWidth: 340 }}>
        {t('ob.golden.titleHead')} <span className="mint">{t('ob.golden.titleAccent')}</span>
      </h1>
      <p className="muted fade-up delay-2" style={{ fontSize: '1rem', maxWidth: 320, lineHeight: 1.65 }}>
        {t('ob.golden.body')}
      </p>
      <div className="fade-up delay-3" style={{ marginTop: 8 }}>
        <Button onClick={onNext}>{t('action.continue')} <ArrowRight size={18} /></Button>
      </div>
    </div>
  );
}

function HealLearnEarn({ onNext, onSkip }) {
  const { t } = useLocale();
  const items = [
    { icon: Heart, title: t('ob.hle.healTitle'), text: t('ob.hle.healBody') },
    { icon: GraduationCap, title: t('ob.hle.learnTitle'), text: t('ob.hle.learnBody') },
    { icon: Coins, title: t('ob.hle.earnTitle'), text: t('ob.hle.earnBody') },
  ];
  return (
    <div className="col full" style={{ flex: 1, gap: 18, justifyContent: 'center', position: 'relative' }}>
      <SkipBtn onSkip={onSkip} />
      <div className="text-center">
        <p className="eyebrow gold fade-up">{t('ob.hle.eyebrow')}</p>
        <h1 className="display fade-up delay-1" style={{ fontSize: '2.1rem', marginTop: 6 }}>{t('ob.hle.title')}</h1>
      </div>
      {items.map((it, i) => (
        <div key={it.title} className={`card row gap-3 fade-up delay-${i + 2}`} style={{ padding: '1.1rem' }}>
          <div className="center" style={{ width: 48, height: 48, borderRadius: 14, background: 'rgba(78,222,163,0.12)', flexShrink: 0 }}>
            <it.icon size={22} color="var(--primary)" />
          </div>
          <div>
            <h4 style={{ fontSize: '1.1rem' }}>{it.title}</h4>
            <p className="muted" style={{ fontSize: '0.85rem', lineHeight: 1.5 }}>{it.text}</p>
          </div>
        </div>
      ))}
      <Button onClick={onNext} className="fade-up delay-5" style={{ marginTop: 6 }}>{t('action.continue')} <ArrowRight size={18} /></Button>
    </div>
  );
}

function SolarisMethod({ onNext, onSkip }) {
  const { t } = useLocale();
  return (
    <div className="center col full text-center" style={{ flex: 1, gap: 20, position: 'relative' }}>
      <SkipBtn onSkip={onSkip} />
      <p className="eyebrow gold fade-up">{t('ob.method.eyebrow')}</p>
      <h1 className="display fade-up delay-1" style={{ fontSize: '2.2rem', maxWidth: 340 }}>{t('ob.method.title')}</h1>
      <p className="muted fade-up delay-2" style={{ fontSize: '0.98rem', maxWidth: 330, lineHeight: 1.65 }}>
        {t('ob.method.body')}
      </p>
      <div className="card-low fade-up delay-3" style={{ padding: '1.1rem 1.3rem', borderRadius: 'var(--radius-md)', maxWidth: 340 }}>
        <p className="serif" style={{ fontStyle: 'italic', fontSize: '1.05rem', lineHeight: 1.5 }}>
          {t('ob.method.quote')}
        </p>
      </div>
      <div className="fade-up delay-4" style={{ marginTop: 6 }}>
        <Button onClick={onNext}>{t('action.continue')} <ArrowRight size={18} /></Button>
      </div>
    </div>
  );
}

function BodySpeaking({ onNext }) {
  const { t } = useLocale();
  return (
    <div className="center col full text-center" style={{ flex: 1, gap: 24 }}>
      <div className="floaty" style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ position: 'absolute', inset: -30, borderRadius: '50%', background: 'radial-gradient(circle, rgba(255,185,95,0.18), transparent 70%)', animation: 'glowPulse 3.5s ease-in-out infinite' }} />
        <img src="/solaris-logo.png" alt="Solaris" style={{ width: 80, height: 80, objectFit: 'contain', filter: 'drop-shadow(0 0 12px rgba(47,190,159,0.45))' }} />
      </div>
      <h1 className="display fade-up delay-1" style={{ fontSize: '2.1rem', maxWidth: 330 }}>
        {t('ob.speaking.titleHead')} <span className="gold">{t('ob.speaking.titleAccent')}</span>
      </h1>
      <p className="muted fade-up delay-2" style={{ fontSize: '1rem', maxWidth: 320, lineHeight: 1.65 }}>
        {t('ob.speaking.body')}
      </p>
      <div className="fade-up delay-3" style={{ marginTop: 8 }}>
        <Button onClick={onNext}>{t('ob.speaking.begin')} <ArrowRight size={18} /></Button>
      </div>
      <div className="row gap-1 center muted fade-up delay-4" style={{ fontSize: '0.75rem' }}>
        <Shield size={14} color="var(--primary)" /> {t('ob.speaking.trust')}
      </div>
    </div>
  );
}
