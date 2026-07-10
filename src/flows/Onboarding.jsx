import React, { useState, useEffect } from 'react';
import { useApp } from '../state/AppContext.jsx';
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

const SkipBtn = ({ onSkip }) => (
  <button onClick={onSkip} className="btn-tertiary" style={{ position: 'absolute', top: 18, right: 18, background: 'none', border: 'none', cursor: 'pointer' }}>Skip</button>
);

function Splash() {
  return (
    <div className="center col full" style={{ flex: 1, gap: 26 }}>
      <div className="floaty fade-in" style={{ position: 'relative' }}>
        <div style={{ position: 'absolute', inset: -40, borderRadius: '50%', background: 'radial-gradient(circle, rgba(78,222,163,0.25), transparent 70%)', animation: 'glowPulse 3s ease-in-out infinite' }} />
        <SolarisMark size={96} />
      </div>
      <div className="text-center fade-up delay-2">
        <Wordmark size="2.6rem" />
        <p className="serif gold" style={{ fontStyle: 'italic', fontSize: '1.05rem', marginTop: 6 }}>Enter the Golden Age</p>
      </div>
      <p className="eyebrow fade-up delay-4" style={{ position: 'absolute', bottom: 40 }}>Autonomous Health Protocol 4.0</p>
    </div>
  );
}

function Welcome({ onNext, onSkip }) {
  return (
    <div className="center col full text-center" style={{ flex: 1, gap: 22, position: 'relative' }}>
      <SkipBtn onSkip={onSkip} />
      <div className="fade-up"><Pill /></div>
      <h1 className="display fade-up delay-1" style={{ fontSize: '2.8rem' }}>
        Heal <span className="gold">•</span> Learn <span className="gold">•</span> Earn
      </h1>
      <p className="muted fade-up delay-2" style={{ fontSize: '1.05rem', maxWidth: 320, lineHeight: 1.6 }}>
        You are not broken. Your body is speaking. <span className="mint">Solaris helps you listen.</span>
      </p>
      <div className="fade-up delay-3" style={{ marginTop: 8 }}>
        <Button onClick={onNext}>Start My Journey <ArrowRight size={18} /></Button>
      </div>
    </div>
  );
}

const Pill = () => (
  <span className="pill" style={{ background: 'rgba(78,222,163,0.1)' }}><Sparkles size={13} /> Welcome to the Sanctuary</span>
);

function GoldenAge({ onNext, onSkip }) {
  return (
    <div className="center col full text-center" style={{ flex: 1, gap: 20, position: 'relative' }}>
      <SkipBtn onSkip={onSkip} />
      <div className="floaty"><SolarisMark size={72} /></div>
      <p className="eyebrow fade-up gold">The Golden Age</p>
      <h1 className="display fade-up delay-1" style={{ fontSize: '2.3rem', maxWidth: 340 }}>
        A sanctuary of precision <span className="mint">and wellness</span>
      </h1>
      <p className="muted fade-up delay-2" style={{ fontSize: '1rem', maxWidth: 320, lineHeight: 1.65 }}>
        Where futuristic technology meets the warmth of human healing. Your body has ancient wisdom — we give it a modern voice.
      </p>
      <div className="fade-up delay-3" style={{ marginTop: 8 }}>
        <Button onClick={onNext}>Continue <ArrowRight size={18} /></Button>
      </div>
    </div>
  );
}

function HealLearnEarn({ onNext, onSkip }) {
  const items = [
    { icon: Heart, title: 'Heal', text: 'Restore your biological rhythms with nature\u2019s wisdom and ancient practice.' },
    { icon: GraduationCap, title: 'Learn', text: 'Understand your 360° health across mind, body, emotion and spirit.' },
    { icon: Coins, title: 'Earn', text: 'Your vitality is an asset. Generate SOL tokens for every milestone of your journey.' },
  ];
  return (
    <div className="col full" style={{ flex: 1, gap: 18, justifyContent: 'center', position: 'relative' }}>
      <SkipBtn onSkip={onSkip} />
      <div className="text-center">
        <p className="eyebrow gold fade-up">The Solaris Promise</p>
        <h1 className="display fade-up delay-1" style={{ fontSize: '2.1rem', marginTop: 6 }}>Heal · Learn · Earn</h1>
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
      <Button onClick={onNext} className="fade-up delay-5" style={{ marginTop: 6 }}>Continue <ArrowRight size={18} /></Button>
    </div>
  );
}

function SolarisMethod({ onNext, onSkip }) {
  return (
    <div className="center col full text-center" style={{ flex: 1, gap: 20, position: 'relative' }}>
      <SkipBtn onSkip={onSkip} />
      <p className="eyebrow gold fade-up">The Method</p>
      <h1 className="display fade-up delay-1" style={{ fontSize: '2.2rem', maxWidth: 340 }}>The Solaris Method</h1>
      <p className="muted fade-up delay-2" style={{ fontSize: '0.98rem', maxWidth: 330, lineHeight: 1.65 }}>
        A holistic ecosystem designed to reconnect your biological rhythms with nature's wisdom — through technology and ancient practice.
      </p>
      <div className="card-low fade-up delay-3" style={{ padding: '1.1rem 1.3rem', borderRadius: 'var(--radius-md)', maxWidth: 340 }}>
        <p className="serif" style={{ fontStyle: 'italic', fontSize: '1.05rem', lineHeight: 1.5 }}>
          "Traditional medicine looks for symptoms. Solaris looks for harmony."
        </p>
      </div>
      <div className="fade-up delay-4" style={{ marginTop: 6 }}>
        <Button onClick={onNext}>Continue <ArrowRight size={18} /></Button>
      </div>
    </div>
  );
}

function BodySpeaking({ onNext }) {
  return (
    <div className="center col full text-center" style={{ flex: 1, gap: 24 }}>
      <div className="floaty" style={{ position: 'relative' }}>
        <div style={{ position: 'absolute', inset: -30, borderRadius: '50%', background: 'radial-gradient(circle, rgba(255,185,95,0.18), transparent 70%)', animation: 'glowPulse 3.5s ease-in-out infinite' }} />
        <SolarisMark size={80} />
      </div>
      <h1 className="display fade-up delay-1" style={{ fontSize: '2.1rem', maxWidth: 330 }}>
        Your body is <span className="gold">speaking</span>
      </h1>
      <p className="muted fade-up delay-2" style={{ fontSize: '1rem', maxWidth: 320, lineHeight: 1.65 }}>
        Begin with a cinematic assessment of your 4 Aspects of Being and 8 Body Systems. In minutes, you'll see your whole self — reflected back.
      </p>
      <div className="fade-up delay-3" style={{ marginTop: 8 }}>
        <Button onClick={onNext}>Begin Journey <ArrowRight size={18} /></Button>
      </div>
      <div className="row gap-1 center muted fade-up delay-4" style={{ fontSize: '0.75rem' }}>
        <Shield size={14} color="var(--primary)" /> SECURE · PRIVATE · SOVEREIGN
      </div>
    </div>
  );
}
