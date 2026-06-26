import React, { useEffect, useState } from 'react';
import { api } from '../lib/api.js';
import { VitalityRing, RadarChart, Card, Spinner, Button, bandColor, TBD } from '../components/ui.jsx';
import { Activity, Brain, Heart, Sparkles, FileText, Upload, Plus, X, Check, Calendar } from 'lucide-react';

const ASPECT_ICONS = { physical: Activity, mental: Brain, emotional: Heart, spiritual: Sparkles };
const SYS_SHORT = { bioelectrical: 'Bio', hydration: 'Hydr', circadian: 'Circ', microbiome: 'Micro', respiratory: 'Resp', neurological: 'Neuro', cardiovascular: 'Cardio', nutritional: 'Nutri' };

export default function HealthPassport() {
  const [data, setData] = useState(null);
  const [docs, setDocs] = useState([]);
  const [checkins, setCheckins] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCheckin, setShowCheckin] = useState(false);

  const load = async () => {
    const [latest, d, ci] = await Promise.all([api.getLatestAssessment(), api.getDocuments(), api.getCheckins()]);
    setData(latest); setDocs(d.documents || []); setCheckins(ci.checkins || []);
  };
  useEffect(() => { load().finally(() => setLoading(false)); }, []);

  if (loading) return <div className="page"><Spinner label="Loading your Health Passport…" /></div>;

  const resp = data?.response;
  const systems = data?.systems || [];
  const aspects = data?.aspects || [];
  const radar = systems.map((s) => ({ name: s.system_name, short: SYS_SHORT[s.system_key] || s.system_key, score: s.score }));

  const onFile = (type) => (e) => {
    const files = Array.from(e.target.files || []);
    files.forEach((file) => {
      const reader = new FileReader();
      reader.onload = async () => {
        await api.uploadDocument({ documentType: type, fileName: file.name, fileData: reader.result, mimeType: file.type, description: 'Uploaded to Health Passport' });
        const d = await api.getDocuments(); setDocs(d.documents || []);
      };
      reader.readAsDataURL(file);
    });
  };

  return (
    <div className="page col gap-4">
      <div className="fade-up">
        <p className="eyebrow gold">Health Passport</p>
        <h1 className="display" style={{ fontSize: '1.7rem', marginTop: 4 }}>Your 360° Health</h1>
        <p className="muted" style={{ fontSize: '0.85rem' }}>Every signal, unified and sovereign — owned by you.</p>
      </div>

      {!resp ? (
        <Card className="text-center"><p className="muted">No assessment yet. Complete the Solaris Method to populate your passport.</p></Card>
      ) : (
        <>
          <div className="center fade-up delay-1"><VitalityRing score={resp.vitality_score} sub="360° Vitality" /></div>

          {/* 4 Aspects */}
          <Card className="fade-up delay-2">
            <p className="eyebrow" style={{ marginBottom: 14 }}>4 Aspects of Being</p>
            <div className="row wrap gap-2">
              {aspects.map((a) => {
                const Icon = ASPECT_ICONS[a.aspect_key] || Sparkles;
                return (
                  <div key={a.aspect_key} className="card-low col" style={{ flex: '1 1 44%', padding: '0.9rem', borderRadius: 'var(--radius-sm)' }}>
                    <div className="between" style={{ marginBottom: 8 }}>
                      <Icon size={18} color="var(--primary)" />
                      <span style={{ fontWeight: 700, fontSize: '1.1rem' }}>{a.score}</span>
                    </div>
                    <div style={{ fontSize: '0.82rem', fontWeight: 600 }}>{a.aspect_name}</div>
                    <Bar value={a.score} />
                  </div>
                );
              })}
            </div>
          </Card>

          {/* Radar */}
          <Card className="fade-up delay-3">
            <p className="eyebrow" style={{ marginBottom: 8 }}>8 Body Systems</p>
            <div className="center"><RadarChart data={radar} size={270} /></div>
            <div className="col gap-1" style={{ marginTop: 12 }}>
              {systems.map((s) => (
                <div key={s.system_key} className="between" style={{ padding: '0.5rem 0', borderBottom: '1px solid rgba(220,226,248,0.05)' }}>
                  <div className="row gap-2">
                    <span className={`dot ${s.severity_band}`} />
                    <span style={{ fontSize: '0.86rem' }}>{s.system_name}</span>
                  </div>
                  <div className="row gap-2">
                    <span className="label muted" style={{ color: bandColor(s.severity_band) }}>{s.severity_band}</span>
                    <span style={{ fontWeight: 700, fontSize: '0.9rem', width: 28, textAlign: 'right' }}>{s.score}</span>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </>
      )}

      {/* Documents */}
      <Card className="fade-up delay-3">
        <div className="between" style={{ marginBottom: 12 }}>
          <p className="eyebrow">Labs, Imaging & Photos</p>
          <span className="pill muted">{docs.length}</span>
        </div>
        <div className="row gap-2" style={{ marginBottom: docs.length ? 14 : 0 }}>
          <UploadTile icon={FileText} label="Add document" accept=".pdf,.png,.jpg,.jpeg,.txt" onChange={onFile('lab')} />
          <UploadTile icon={Upload} label="Add photo" accept="image/*" onChange={onFile('photo')} />
        </div>
        <div className="col gap-2">
          {docs.map((d) => (
            <div key={d.id} className="row gap-2 card-low" style={{ padding: '0.7rem 0.9rem', borderRadius: 'var(--radius-sm)' }}>
              <FileText size={15} color="var(--primary)" />
              <span style={{ fontSize: '0.84rem', flex: 1 }}>{d.file_name}</span>
              <span className="label muted">{d.document_type}</span>
            </div>
          ))}
        </div>
      </Card>

      {/* Progress timeline */}
      <Card className="fade-up delay-4">
        <div className="between" style={{ marginBottom: 12 }}>
          <p className="eyebrow">Progress Timeline</p>
          <button className="btn-tertiary" style={{ padding: 0, background: 'none', border: 'none', cursor: 'pointer', display: 'flex', gap: 4, alignItems: 'center' }} onClick={() => setShowCheckin(!showCheckin)}>
            <Plus size={14} /> Check-in
          </button>
        </div>
        {showCheckin && <CheckinForm onSaved={async () => { setShowCheckin(false); const ci = await api.getCheckins(); setCheckins(ci.checkins || []); }} />}
        <div className="col gap-2">
          {checkins.slice(0, 7).map((c) => (
            <div key={c.id} className="row gap-3 card-low" style={{ padding: '0.7rem 0.9rem', borderRadius: 'var(--radius-sm)' }}>
              <Calendar size={15} color="var(--secondary)" />
              <span style={{ fontSize: '0.82rem', flex: 1 }}>{new Date(c.checkin_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
              <span className="label muted">E {c.energy_score} · M {c.mood_score}</span>
              <span className="label muted">{Number(c.sleep_hours).toFixed(1)}h</span>
            </div>
          ))}
          {checkins.length === 0 && <p className="muted" style={{ fontSize: '0.85rem' }}>No check-ins yet — log your first above.</p>}
        </div>
      </Card>

      {/* FHIR export note + TBD */}
      <Card className="fade-up delay-5" style={{ background: 'rgba(78,222,163,0.05)', border: '1px solid rgba(78,222,163,0.12)' }}>
        <div className="between">
          <div>
            <p className="label mint" style={{ marginBottom: 4 }}>Data Sovereignty</p>
            <p className="muted" style={{ fontSize: '0.82rem' }}>Your data is FHIR-aligned and fully exportable, always.</p>
          </div>
          <TBD label="Export · soon" />
        </div>
      </Card>
    </div>
  );
}

function Bar({ value }) {
  return (
    <div style={{ height: 4, background: 'var(--surface-container-highest)', borderRadius: 999, marginTop: 8, overflow: 'hidden' }}>
      <div style={{ width: `${value}%`, height: '100%', background: 'linear-gradient(90deg,var(--primary),var(--primary-container))', borderRadius: 999 }} />
    </div>
  );
}

function UploadTile({ icon: Icon, label, accept, onChange }) {
  return (
    <label className="card-low center col gap-1" style={{ flex: 1, padding: '1.1rem 1rem', borderRadius: 'var(--radius-sm)', cursor: 'pointer', border: '1px dashed rgba(78,222,163,0.22)', textAlign: 'center' }}>
      <Icon size={20} color="var(--primary)" />
      <span style={{ fontSize: '0.75rem', fontWeight: 500 }}>{label}</span>
      <input type="file" accept={accept} multiple onChange={onChange} style={{ display: 'none' }} />
    </label>
  );
}

function CheckinForm({ onSaved }) {
  const [f, setF] = useState({ energyScore: 70, moodScore: 70, sleepHours: 7, hydrationGlasses: 6, movementMinutes: 30 });
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: Number(e.target.value) });
  const save = async () => { setBusy(true); try { await api.createCheckin(f); onSaved(); } finally { setBusy(false); } };
  const Row = ({ label, k, min, max, step = 1, unit }) => (
    <div style={{ marginBottom: 12 }}>
      <div className="between"><span style={{ fontSize: '0.82rem' }}>{label}</span><span className="mint" style={{ fontWeight: 700, fontSize: '0.82rem' }}>{f[k]}{unit}</span></div>
      <input className="sol-range" type="range" min={min} max={max} step={step} value={f[k]} onChange={set(k)} />
    </div>
  );
  return (
    <div className="card-low" style={{ padding: '1rem', borderRadius: 'var(--radius-sm)', marginBottom: 14 }}>
      <Row label="Energy" k="energyScore" min={0} max={100} />
      <Row label="Mood" k="moodScore" min={0} max={100} />
      <Row label="Sleep" k="sleepHours" min={0} max={12} step={0.5} unit="h" />
      <Row label="Hydration" k="hydrationGlasses" min={0} max={12} unit=" glasses" />
      <Row label="Movement" k="movementMinutes" min={0} max={120} step={5} unit="m" />
      <Button className="btn-block" onClick={save} disabled={busy}>{busy ? 'Saving…' : <><Check size={15} /> Save check-in (+5)</>}</Button>
    </div>
  );
}
