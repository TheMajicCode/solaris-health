/**
 * ContributionLedger — the member's attested-contribution record.
 * Levels reward what you *give* to the network (referrals, hosting, care
 * milestones…), never money. Members log a contribution, watch it get
 * cryptographically attested (mock signature), and climb the leaderboard.
 */
import React, { useEffect, useState } from 'react';
import {
  Loader2, PlusCircle, Signature, Users, ScrollText, Award, ChevronRight,
} from 'lucide-react';
import { api } from '../../lib/api.js';
import LevelBadge from '../passport/LevelBadge.jsx';
import { levelFor } from '../passport/levels.js';

const KINDS = [
  { value: 'referral', label: 'Referral', points: 25 },
  { value: 'hosting', label: 'Hosting', points: 50 },
  { value: 'maintenance', label: 'Maintenance', points: 15 },
  { value: 'education', label: 'Education', points: 20 },
  { value: 'care_milestone', label: 'Care milestone', points: 100 },
  { value: 'coordination', label: 'Coordination', points: 30 },
];
const fmtDate = (d) => { try { return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }); } catch { return ''; } };

export default function ContributionLedger({ user }) {
  const [tab, setTab] = useState('ledger'); // ledger | leaderboard
  const [events, setEvents] = useState([]);
  const [attestedPoints, setAttestedPoints] = useState(user?.levelPoints || 0);
  const [loading, setLoading] = useState(true);
  const [leaderboard, setLeaderboard] = useState(null);
  const [lbLoading, setLbLoading] = useState(false);

  const [kind, setKind] = useState('referral');
  const [subject, setSubject] = useState('');
  const [evidence, setEvidence] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [flash, setFlash] = useState('');

  const loadEvents = async () => {
    setLoading(true);
    try {
      const r = await api.getMyContributions();
      setEvents(r.events || []);
      if (r.attestedPoints != null) setAttestedPoints(r.attestedPoints);
    } catch { setEvents([]); }
    finally { setLoading(false); }
  };

  useEffect(() => { loadEvents(); }, []);

  const loadLeaderboard = async () => {
    if (leaderboard) return;
    setLbLoading(true);
    try { const r = await api.getLeaderboard(500); setLeaderboard(r.leaderboard || []); }
    catch { setLeaderboard([]); }
    finally { setLbLoading(false); }
  };

  const submit = async (e) => {
    e.preventDefault();
    setSubmitting(true); setFlash('');
    try {
      const r = await api.logContribution({ kind, subjectRef: subject || undefined, evidence: evidence || undefined });
      setSubject(''); setEvidence('');
      if (r.totalPoints != null) setAttestedPoints(r.totalPoints);
      setFlash(`+${r.pointsAwarded} points attested`);
      setTimeout(() => setFlash(''), 2600);
      await loadEvents();
      setLeaderboard(null); // invalidate
    } catch (err) { setFlash(err.message || 'Could not log contribution'); }
    finally { setSubmitting(false); }
  };

  const lv = levelFor(attestedPoints);
  const myId = user?.id;

  return (
    <div className="ctl">
      <div className="ctl-top">
        <div className="ctl-level-big" style={{ borderColor: lv.color }}>
          <div className="ctl-level-badge" style={{ background: lv.soft, color: lv.ink, borderColor: lv.color }}>
            <Award size={18} style={{ color: lv.color }} /> {lv.band}
          </div>
          <div className="ctl-level-pts">
            <span className="ctl-level-pts-val">{lv.points.toLocaleString()}</span>
            <span className="ctl-level-pts-lbl">level points · {events.length} contributions</span>
          </div>
          <div className="ctl-level-bar">
            <div className="ctl-level-bar-fill" style={{ width: `${Math.round(lv.progress * 100)}%`, background: lv.color }} />
          </div>
          <div className="ctl-level-next">
            {lv.nextThreshold ? `${lv.pointsToNext.toLocaleString()} points to next band` : 'Highest band reached'}
          </div>
        </div>

        <form className="ctl-form" onSubmit={submit}>
          <div className="ctl-form-h"><PlusCircle size={15} /> Log a contribution</div>
          <label className="ctl-field">
            <span>Kind</span>
            <select value={kind} onChange={(e) => setKind(e.target.value)}>
              {KINDS.map((k) => <option key={k.value} value={k.value}>{k.label} · +{k.points} pts</option>)}
            </select>
          </label>
          <label className="ctl-field">
            <span>Subject</span>
            <input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="e.g. Referred María to Aura Dental" />
          </label>
          <label className="ctl-field">
            <span>Evidence <em>(optional)</em></span>
            <input value={evidence} onChange={(e) => setEvidence(e.target.value)} placeholder="Link or note" />
          </label>
          <button className="ctl-submit" disabled={submitting}>
            {submitting ? <Loader2 size={14} className="ctl-spin" /> : <Signature size={14} />}
            {submitting ? 'Attesting…' : 'Attest contribution'}
          </button>
          {flash && <div className="ctl-flash">{flash}</div>}
        </form>
      </div>

      <div className="ctl-tabs">
        <button className={`ctl-tab ${tab === 'ledger' ? 'on' : ''}`} onClick={() => setTab('ledger')}>
          <ScrollText size={14} /> My ledger
        </button>
        <button className={`ctl-tab ${tab === 'leaderboard' ? 'on' : ''}`} onClick={() => { setTab('leaderboard'); loadLeaderboard(); }}>
          <Users size={14} /> Top 500
        </button>
      </div>

      {tab === 'ledger' && (
        <div className="ctl-panel">
          {loading ? (
            <div className="ctl-loading"><Loader2 size={18} className="ctl-spin" /> Loading ledger…</div>
          ) : events.length === 0 ? (
            <div className="ctl-empty">No contributions logged yet. Log your first above.</div>
          ) : (
            <table className="ctl-table">
              <thead><tr><th>Date</th><th>Kind</th><th>Subject</th><th>Signature</th><th>Status</th><th className="r">Points</th></tr></thead>
              <tbody>
                {events.map((ev) => (
                  <tr key={ev.id}>
                    <td>{fmtDate(ev.createdAt)}</td>
                    <td><span className="ctl-kind">{String(ev.kind).replace(/_/g, ' ')}</span></td>
                    <td className="ctl-subj">{ev.subjectRef || '—'}</td>
                    <td className="mono ctl-sig">{ev.signatureMock ? `${ev.signatureMock.slice(0, 12)}…` : '—'} <span className="ctl-mock">mock</span></td>
                    <td><span className={`ctl-status ${ev.status}`}>{ev.status}</span></td>
                    <td className="r ctl-pts">+{ev.points}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {tab === 'leaderboard' && (
        <div className="ctl-panel">
          {lbLoading ? (
            <div className="ctl-loading"><Loader2 size={18} className="ctl-spin" /> Loading leaderboard…</div>
          ) : !leaderboard || leaderboard.length === 0 ? (
            <div className="ctl-empty">Leaderboard is empty.</div>
          ) : (
            <div className="ctl-lb">
              {leaderboard.map((row) => (
                <div className={`ctl-lb-row ${row.userId === myId ? 'me' : ''}`} key={row.userId}>
                  <span className="ctl-lb-rank">#{row.rank}</span>
                  <span className="ctl-lb-name">{row.name}{row.userId === myId && <span className="ctl-lb-you">you</span>}</span>
                  <span className="ctl-lb-band" style={{ color: row.color || 'var(--muted)' }}>{row.band || row.level}</span>
                  <span className="ctl-lb-pts">{Number(row.points).toLocaleString()}</span>
                  <ChevronRight size={13} className="ctl-lb-chev" />
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <style>{`
        .luca .ctl-top{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:18px}
        @media(max-width:820px){.luca .ctl-top{grid-template-columns:1fr}}
        .luca .ctl-level-big{background:var(--surface);border:1.5px solid;border-radius:var(--r);padding:18px}
        .luca .ctl-level-badge{display:inline-flex;align-items:center;gap:7px;padding:6px 13px;border-radius:99px;border:1.5px solid;
          font-family:'Space Grotesk',sans-serif;font-weight:700;font-size:15px}
        .luca .ctl-level-pts{margin-top:14px;display:flex;flex-direction:column}
        .luca .ctl-level-pts-val{font-family:'Space Grotesk',sans-serif;font-weight:700;font-size:32px;color:var(--ink);line-height:1}
        .luca .ctl-level-pts-lbl{font-size:12px;color:var(--muted);margin-top:3px}
        .luca .ctl-level-bar{height:9px;border-radius:99px;background:var(--surface-2);margin-top:14px;overflow:hidden}
        .luca .ctl-level-bar-fill{height:100%;border-radius:99px;transition:width .6s ease}
        .luca .ctl-level-next{font-size:11.5px;color:var(--muted);margin-top:8px}
        .luca .ctl-form{background:var(--surface);border:1px solid var(--line);border-radius:var(--r);padding:18px}
        .luca .ctl-form-h{display:flex;align-items:center;gap:7px;font-family:'Space Grotesk',sans-serif;font-weight:700;
          font-size:14px;color:var(--ink);margin-bottom:14px}
        .luca .ctl-form-h svg{color:var(--teal)}
        .luca .ctl-field{display:flex;flex-direction:column;gap:5px;margin-bottom:11px}
        .luca .ctl-field span{font-size:11.5px;font-weight:600;color:var(--muted)}
        .luca .ctl-field em{font-weight:400;font-style:normal;opacity:.7}
        .luca .ctl-field select,.luca .ctl-field input{padding:9px 11px;border:1px solid var(--line);border-radius:var(--r-sm);
          font-size:13px;font-family:'IBM Plex Sans',sans-serif;background:var(--surface);color:var(--ink)}
        .luca .ctl-field select:focus,.luca .ctl-field input:focus{outline:none;border-color:var(--teal)}
        .luca .ctl-submit{width:100%;display:inline-flex;align-items:center;justify-content:center;gap:8px;padding:11px;
          border:none;border-radius:var(--r-sm);background:var(--teal);color:#fff;font-family:'Space Grotesk',sans-serif;
          font-weight:600;font-size:13.5px;cursor:pointer;margin-top:2px}
        .luca .ctl-submit:hover:not(:disabled){background:var(--teal-d)}
        .luca .ctl-submit:disabled{opacity:.7}
        .luca .ctl-flash{margin-top:10px;text-align:center;font-size:12.5px;font-weight:600;color:var(--teal-d);
          background:var(--mint-soft);padding:7px;border-radius:var(--r-sm)}
        .luca .ctl-tabs{display:flex;gap:6px;margin-bottom:14px}
        .luca .ctl-tab{display:inline-flex;align-items:center;gap:6px;padding:8px 15px;border-radius:99px;border:1px solid var(--line);
          background:var(--surface);color:var(--muted);font-weight:600;font-size:12.5px;cursor:pointer}
        .luca .ctl-tab.on{background:var(--ink);color:#fff;border-color:var(--ink)}
        .luca .ctl-panel{background:var(--surface);border:1px solid var(--line);border-radius:var(--r);overflow:hidden}
        .luca .ctl-table{width:100%;border-collapse:collapse;font-size:12.5px}
        .luca .ctl-table th{text-align:left;padding:11px 14px;font-size:10.5px;font-weight:700;text-transform:uppercase;
          letter-spacing:.04em;color:var(--muted);background:var(--surface-2);border-bottom:1px solid var(--line)}
        .luca .ctl-table th.r,.luca .ctl-table td.r{text-align:right}
        .luca .ctl-table td{padding:11px 14px;border-bottom:1px solid var(--line);color:var(--ink)}
        .luca .ctl-table tr:last-child td{border-bottom:none}
        .luca .ctl-kind{text-transform:capitalize;font-weight:600}
        .luca .ctl-subj{color:var(--muted);max-width:220px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
        .luca .mono{font-family:'IBM Plex Mono',monospace}
        .luca .ctl-sig{color:var(--muted)}
        .luca .ctl-mock{font-size:8.5px;font-weight:700;text-transform:uppercase;background:#FBEFD3;color:#8A5F13;padding:1px 5px;border-radius:99px}
        .luca .ctl-status{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.04em;padding:3px 8px;border-radius:99px}
        .luca .ctl-status.attested,.luca .ctl-status.confirmed{background:var(--mint-soft);color:var(--teal-d)}
        .luca .ctl-status.pending{background:var(--surface-2);color:var(--muted)}
        .luca .ctl-pts{font-family:'Space Grotesk',sans-serif;font-weight:700;color:var(--teal-d)}
        .luca .ctl-lb{max-height:520px;overflow:auto}
        .luca .ctl-lb-row{display:flex;align-items:center;gap:12px;padding:10px 16px;border-bottom:1px solid var(--line)}
        .luca .ctl-lb-row:last-child{border-bottom:none}
        .luca .ctl-lb-row.me{background:var(--mint-soft)}
        .luca .ctl-lb-rank{font-family:'Space Grotesk',sans-serif;font-weight:700;font-size:13px;color:var(--muted);width:42px}
        .luca .ctl-lb-name{flex:1;font-size:13px;color:var(--ink);display:flex;align-items:center;gap:7px}
        .luca .ctl-lb-you{font-size:9px;font-weight:700;text-transform:uppercase;background:var(--teal);color:#fff;padding:2px 6px;border-radius:99px}
        .luca .ctl-lb-band{font-size:11.5px;font-weight:600;width:80px}
        .luca .ctl-lb-pts{font-family:'Space Grotesk',sans-serif;font-weight:700;font-size:13px;color:var(--ink);width:70px;text-align:right}
        .luca .ctl-lb-chev{color:var(--muted-2)}
        .luca .ctl-loading,.luca .ctl-empty{padding:34px 20px;text-align:center;color:var(--muted);font-size:13px;
          display:flex;align-items:center;justify-content:center;gap:8px}
        .luca .ctl-spin{animation:spin 1s linear infinite}
        @keyframes spin{to{transform:rotate(360deg)}}
      `}</style>
    </div>
  );
}
