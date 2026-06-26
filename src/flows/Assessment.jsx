import React, { useState, useEffect } from 'react';
import { useApp } from '../state/AppContext.jsx';
import { api } from '../lib/api.js';
import { SolarisMark, Wordmark, Button, Chip, Spinner, VitalityRing, RadarChart } from '../components/ui.jsx';
import { ArrowRight, ArrowLeft, Activity, Brain, Heart, Sparkles, Upload, FileText, X, Check } from 'lucide-react';

const ASPECT_ICONS = { physical: Activity, mental: Brain, emotional: Heart, spiritual: Sparkles };
const ASPECT_LABELS = { physical: 'VITALITY', mental: 'CLARITY', emotional: 'BALANCE', spiritual: 'ALIGNMENT' };

const GOALS = [
  'Improve energy', 'Better sleep', 'Reduce stress', 'Oral & whole-body health',
  'Reduce pain', 'Find a practitioner', 'Explore holistic care', 'Recover & optimize',
];
const SYS_SHORT = { bioelectrical: 'Bio', hydration: 'Hydr', circadian: 'Circ', microbiome: 'Micro', respiratory: 'Resp', neurological: 'Neuro', cardiovascular: 'Cardio', nutritional: 'Nutri' };

export default function Assessment() {
  const { user, refreshUser, setTab } = useApp();
  const [phase, setPhase] = useState('loading'); // loading | intro | goals | aspects | systems | intake | submitting | reveal
  const [questions, setQuestions] = useState([]);
  const [goals, setGoals] = useState([]);
  const [aspects, setAspects] = useState({ physical: 50, mental: 50, emotional: 50, spiritual: 50 });
  const [systems, setSystems] = useState({});
  const [docs, setDocs] = useState([]);
  const [result, setResult] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const { questions } = await api.getTemplate();
        setQuestions(questions);
        const sysInit = {};
        questions.filter((q) => q.section_key === 'systems').forEach((q) => { sysInit[q.system_key] = 50; });
        setSystems(sysInit);
        setPhase('intro');
      } catch { setPhase('intro'); }
    })();
  }, []);

  const aspectQs = questions.filter((q) => q.section_key === 'aspects');
  const systemQs = questions.filter((q) => q.section_key === 'systems');

  const submit = async () => {
    setPhase('submitting');
    try {
      // Save goals to profile
      await api.saveProfile({ goals, consentPrivacy: true, consentAiGuidance: true });
      // Upload docs
      for (const d of docs) {
        await api.uploadDocument({ documentType: d.type, fileName: d.name, fileData: d.data, mimeType: d.mime, description: 'Onboarding intake' });
      }
      const answers = [
        ...aspectQs.map((q) => ({ questionId: q.id, aspectKey: q.aspect_key, value: aspects[q.aspect_key] })),
        ...systemQs.map((q) => ({ questionId: q.id, systemKey: q.system_key, value: systems[q.system_key] })),
      ];
      const res = await api.submitAssessment({ aspects, systems, answers });
      setResult(res);
      // NOTE: don't refreshUser() here — that flips onboardingStatus to 'complete'
      // and Root would unmount this flow before the reveal screen shows.
      setPhase('reveal');
    } catch (e) {
      alert('Could not submit: ' + e.message);
      setPhase('intake');
    }
  };

  if (phase === 'loading') return <FrameWrap><Spinner label="Preparing your assessment…" /></FrameWrap>;

  return (
    <FrameWrap>
      {phase === 'intro' && <Intro name={user?.firstName} onStart={() => setPhase('goals')} />}
      {phase === 'goals' && <GoalsStep goals={goals} setGoals={setGoals} onNext={() => setPhase('aspects')} onBack={() => setPhase('intro')} />}
      {phase === 'aspects' && <AspectsStep aspectQs={aspectQs} aspects={aspects} setAspects={setAspects} onNext={() => setPhase('systems')} onBack={() => setPhase('goals')} />}
      {phase === 'systems' && <SystemsStep systemQs={systemQs} systems={systems} setSystems={setSystems} onNext={() => setPhase('intake')} onBack={() => setPhase('aspects')} />}
      {phase === 'intake' && <IntakeStep docs={docs} setDocs={setDocs} onNext={submit} onBack={() => setPhase('systems')} />}
      {phase === 'submitting' && <Submitting />}
      {phase === 'reveal' && <Reveal result={result} systems={systems} aspects={aspects} onEnter={async () => { setTab('home'); await refreshUser(); }} />}
    </FrameWrap>
  );
}

const FrameWrap = ({ children }) => (
  <div className="app-frame" style={{ paddingBottom: 0, minHeight: '100vh' }}>
    <div className="sol-bg" />
    {children}
  </div>
);

function StepHeader({ title, step, total, onBack }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <div className="between" style={{ marginBottom: 12 }}>
        {onBack ? <button onClick={onBack} className="btn-tertiary" style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', gap: 4, alignItems: 'center' }}><ArrowLeft size={15} /> Back</button> : <span />}
        <span className="label gold">Step {String(step).padStart(2, '0')} / {String(total).padStart(2, '0')}</span>
      </div>
      <h1 className="display" style={{ fontSize: '1.9rem' }}>{title}</h1>
      <div style={{ height: 4, background: 'var(--surface-container-highest)', borderRadius: 999, marginTop: 12, overflow: 'hidden' }}>
        <div style={{ width: `${(step / total) * 100}%`, height: '100%', background: 'linear-gradient(90deg,var(--primary),var(--primary-container))', borderRadius: 999, transition: 'width 0.6s var(--ease)' }} />
      </div>
    </div>
  );
}

function Intro({ name, onStart }) {
  return (
    <div className="page center col text-center" style={{ minHeight: '100vh', gap: 22 }}>
      <div className="floaty"><SolarisMark size={76} /></div>
      <p className="eyebrow gold">The Solaris Method</p>
      <h1 className="display" style={{ fontSize: '2.1rem', maxWidth: 340 }}>
        {name ? `${name}, let's` : "Let's"} look at the harmony of your inner landscape
      </h1>
      <p className="muted" style={{ maxWidth: 320, lineHeight: 1.65 }}>
        This isn't a test — it's a reflection of where you are today. We'll explore your 4 Aspects of Being and 8 Body Systems.
      </p>
      <Button onClick={onStart}>Begin Assessment <ArrowRight size={18} /></Button>
    </div>
  );
}

function GoalsStep({ goals, setGoals, onNext, onBack }) {
  const toggle = (g) => setGoals(goals.includes(g) ? goals.filter((x) => x !== g) : [...goals, g]);
  return (
    <div className="page" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <StepHeader title="Why are you here?" step={1} total={5} onBack={onBack} />
      <p className="muted" style={{ marginBottom: 18 }}>Choose what matters most right now. This guides your personalized path.</p>
      <div className="row wrap gap-2">
        {GOALS.map((g) => <Chip key={g} active={goals.includes(g)} onClick={() => toggle(g)}>{g}</Chip>)}
      </div>
      <div style={{ marginTop: 'auto', paddingTop: 24 }}>
        <Button className="btn-block" onClick={onNext} disabled={goals.length === 0}>Continue <ArrowRight size={18} /></Button>
      </div>
    </div>
  );
}

function SliderCard({ icon: Icon, label, title, helper, low, high, value, onChange }) {
  return (
    <div className="card" style={{ padding: '1.3rem', marginBottom: 16 }}>
      <div className="between" style={{ marginBottom: 12 }}>
        <div className="center" style={{ width: 44, height: 44, borderRadius: 14, background: 'rgba(78,222,163,0.12)' }}>
          <Icon size={20} color="var(--primary)" />
        </div>
        <span className="label muted">{label}</span>
      </div>
      <h3 className="serif" style={{ fontSize: '1.3rem', marginBottom: 6 }}>{title}</h3>
      <p className="muted" style={{ fontSize: '0.85rem', lineHeight: 1.5, marginBottom: 18 }}>{helper}</p>
      <input className="sol-range" type="range" min="0" max="100" value={value} onChange={(e) => onChange(Number(e.target.value))} />
      <div className="between" style={{ marginTop: 8 }}>
        <span className="label muted">{low}</span>
        <span className="mint" style={{ fontWeight: 700, fontSize: '0.9rem' }}>{value}</span>
        <span className="label muted">{high}</span>
      </div>
    </div>
  );
}

function AspectsStep({ aspectQs, aspects, setAspects, onNext, onBack }) {
  return (
    <div className="page" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <StepHeader title="4 Aspects of Being" step={2} total={5} onBack={onBack} />
      <p className="muted" style={{ marginBottom: 18 }}>A reflection of your mental, emotional, physical and spiritual health.</p>
      {aspectQs.map((q) => (
        <SliderCard key={q.aspect_key} icon={ASPECT_ICONS[q.aspect_key] || Sparkles} label={ASPECT_LABELS[q.aspect_key] || ''}
          title={q.aspect_key.charAt(0).toUpperCase() + q.aspect_key.slice(1) + ' Health'} helper={q.question_text}
          low={q.low_label} high={q.high_label} value={aspects[q.aspect_key]}
          onChange={(v) => setAspects({ ...aspects, [q.aspect_key]: v })} />
      ))}
      <div style={{ paddingTop: 8 }}>
        <Button className="btn-block" onClick={onNext}>Save & Continue <ArrowRight size={18} /></Button>
      </div>
    </div>
  );
}

function SystemsStep({ systemQs, systems, setSystems, onNext, onBack }) {
  return (
    <div className="page" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <StepHeader title="8 Body Systems" step={3} total={5} onBack={onBack} />
      <p className="muted" style={{ marginBottom: 18 }}>Tune into how each system feels today. There are no wrong answers.</p>
      {systemQs.map((q) => (
        <SliderCard key={q.system_key} icon={Activity} label={(q.system_key || '').toUpperCase()}
          title={q.question_text.length > 50 ? (SYS_SHORT[q.system_key] ? q.system_key.charAt(0).toUpperCase() + q.system_key.slice(1) : q.system_key) : q.question_text}
          helper={q.question_text} low={q.low_label} high={q.high_label} value={systems[q.system_key]}
          onChange={(v) => setSystems({ ...systems, [q.system_key]: v })} />
      ))}
      <div style={{ paddingTop: 8 }}>
        <Button className="btn-block" onClick={onNext}>Save & Continue <ArrowRight size={18} /></Button>
      </div>
    </div>
  );
}

function IntakeStep({ docs, setDocs, onNext, onBack }) {
  const onFile = (type) => (e) => {
    const files = Array.from(e.target.files || []);
    files.forEach((file) => {
      const reader = new FileReader();
      reader.onload = () => setDocs((d) => [...d, { name: file.name, mime: file.type, type, data: reader.result }]);
      reader.readAsDataURL(file);
    });
  };
  const remove = (i) => setDocs(docs.filter((_, idx) => idx !== i));
  return (
    <div className="page" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <StepHeader title="Add your health context" step={4} total={5} onBack={onBack} />
      <p className="muted" style={{ marginBottom: 18 }}>Optional: upload recent labs, imaging, or a photo. These stay private in your Health Passport and help LUCA personalize your path.</p>

      <div className="row gap-2" style={{ marginBottom: 16 }}>
        <UploadTile icon={FileText} label="Upload labs / docs" accept=".pdf,.png,.jpg,.jpeg,.txt" onChange={onFile('lab')} />
        <UploadTile icon={Upload} label="Upload a photo" accept="image/*" onChange={onFile('photo')} />
      </div>

      {docs.length > 0 && (
        <div className="col gap-2" style={{ marginBottom: 16 }}>
          {docs.map((d, i) => (
            <div key={i} className="card-low between" style={{ padding: '0.8rem 1rem', borderRadius: 'var(--radius-sm)' }}>
              <div className="row gap-2"><FileText size={16} color="var(--primary)" /><span style={{ fontSize: '0.85rem' }}>{d.name}</span></div>
              <button onClick={() => remove(i)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={16} color="var(--outline)" /></button>
            </div>
          ))}
        </div>
      )}

      <div style={{ marginTop: 'auto', paddingTop: 20 }}>
        <Button className="btn-block" onClick={onNext}>Reveal My Results <ArrowRight size={18} /></Button>
        <button onClick={onNext} className="btn-tertiary btn-block" style={{ marginTop: 10, background: 'none', border: 'none', cursor: 'pointer' }}>Skip for now</button>
      </div>
    </div>
  );
}

function UploadTile({ icon: Icon, label, accept, onChange }) {
  return (
    <label className="card-low center col gap-2" style={{ flex: 1, padding: '1.5rem 1rem', borderRadius: 'var(--radius-md)', cursor: 'pointer', border: '1px dashed rgba(78,222,163,0.25)', textAlign: 'center' }}>
      <Icon size={24} color="var(--primary)" />
      <span style={{ fontSize: '0.8rem', fontWeight: 500 }}>{label}</span>
      <input type="file" accept={accept} multiple onChange={onChange} style={{ display: 'none' }} />
    </label>
  );
}

function Submitting() {
  return (
    <div className="page center col text-center" style={{ minHeight: '100vh', gap: 22 }}>
      <div className="floaty" style={{ position: 'relative' }}>
        <div style={{ position: 'absolute', inset: -30, borderRadius: '50%', background: 'radial-gradient(circle, rgba(78,222,163,0.25), transparent 70%)', animation: 'glowPulse 2s ease-in-out infinite' }} />
        <SolarisMark size={72} />
      </div>
      <h2 className="display" style={{ fontSize: '1.6rem' }}>Reading your signals…</h2>
      <p className="muted">LUCA is mapping your 360° health picture.</p>
    </div>
  );
}

function Reveal({ result, systems, aspects, onEnter }) {
  const vitality = result?.vitality ?? 0;
  const topFocus = result?.topFocus || [];
  const summary = result?.summary || {};
  const radar = Object.entries(systems).map(([k, v]) => ({ name: k, short: SYS_SHORT[k] || k, score: v }));
  return (
    <div className="page col" style={{ minHeight: '100vh', gap: 18 }}>
      <div className="text-center fade-up" style={{ marginTop: 10 }}>
        <p className="eyebrow gold">Your Personalized Starting Path</p>
        <h1 className="display" style={{ fontSize: '1.9rem', marginTop: 6 }}>{summary.headline || 'Your reflection'}</h1>
      </div>
      <div className="center fade-up delay-1"><VitalityRing score={vitality} sub="360° Vitality" /></div>

      <div className="card fade-up delay-2">
        <p className="eyebrow" style={{ marginBottom: 12 }}>Your 8 Body Systems</p>
        <div className="center"><RadarChart data={radar} size={260} /></div>
      </div>

      <div className="card fade-up delay-3">
        <p className="eyebrow" style={{ marginBottom: 10 }}>Top 3 Focus Areas</p>
        {topFocus.map((f, i) => (
          <div key={i} className="row gap-3" style={{ padding: '0.6rem 0', borderBottom: i < topFocus.length - 1 ? '1px solid rgba(220,226,248,0.06)' : 'none' }}>
            <div className="center" style={{ width: 30, height: 30, borderRadius: 999, background: 'rgba(255,185,95,0.14)', color: 'var(--tertiary)', fontWeight: 700, fontSize: '0.85rem' }}>{i + 1}</div>
            <div style={{ flex: 1 }}><div style={{ fontWeight: 600, fontSize: '0.95rem' }}>{f.name}</div></div>
            <div className="mint" style={{ fontWeight: 700 }}>{f.score}</div>
          </div>
        ))}
      </div>

      <div className="card-low fade-up delay-4" style={{ background: 'rgba(78,222,163,0.06)', border: '1px solid rgba(78,222,163,0.15)' }}>
        <div className="row gap-2" style={{ marginBottom: 6 }}><Check size={16} color="var(--primary)" /><span className="label mint">+75 LOVE points earned</span></div>
        <p className="muted" style={{ fontSize: '0.85rem' }}>Assessment & onboarding complete. LUCA has prepared your first habits and matched practitioners.</p>
      </div>

      <Button className="btn-block fade-up delay-5" onClick={onEnter}>Enter My Sovereign Hub <ArrowRight size={18} /></Button>
    </div>
  );
}
