/**
 * ApplicationReviewModal — admin detail view for a single provider application.
 *
 * Left  : applicant + business info, services, agreements.
 * Right : verification checklist + document viewer + approve / reject actions.
 *
 * Props:
 *   applicationId  id to load
 *   onClose        ()=>void
 *   onReviewed     ()=>void   — fired after approve/reject (refresh list)
 */
import React, { useEffect, useState, useCallback } from 'react';
import {
  X, Loader2, Check, ShieldCheck, FileText, Image as ImageIcon, Download,
  Mail, MapPin, Phone, Globe, Calendar, AlertCircle, ThumbsUp, ThumbsDown, ExternalLink,
} from 'lucide-react';
import { api } from '../../lib/api.js';

const MEDICAL_TYPES = ['doctor', 'dentist', 'therapist', 'nutritionist'];

const DOC_LABELS = {
  degree: 'Professional degree', issp_license: 'ISSP license', national_id: 'National ID',
  insurance: 'Liability insurance', cssp_number: 'CSSP number', issp_expiry: 'License expiry',
  business_photo: 'Business photo', website: 'Website', social_media: 'Social media', phone: 'Phone',
};

const REQUIRED_MEDICAL = ['degree', 'cssp_number', 'issp_license', 'national_id'];

export default function ApplicationReviewModal({ applicationId, onClose, onReviewed }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [viewDoc, setViewDoc] = useState(null);
  const [acting, setActing] = useState('');
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState('');
  const [checks, setChecks] = useState({});

  const load = useCallback(async () => {
    setLoading(true); setErr('');
    try {
      const res = await api.getApplicationReview(applicationId);
      setData(res);
    } catch (e) {
      setErr(e.message || 'Could not load application.');
    } finally {
      setLoading(false);
    }
  }, [applicationId]);

  useEffect(() => { load(); }, [load]);

  const approve = async () => {
    setActing('approve'); setErr('');
    try {
      await api.approveApplication(applicationId, {});
      onReviewed?.(); onClose?.();
    } catch (e) { setErr(e.message || 'Approve failed.'); setActing(''); }
  };
  const reject = async () => {
    if (!reason.trim()) { setErr('A rejection reason is required.'); return; }
    setActing('reject'); setErr('');
    try {
      await api.rejectApplication(applicationId, { rejection_reason: reason.trim() });
      onReviewed?.(); onClose?.();
    } catch (e) { setErr(e.message || 'Reject failed.'); setActing(''); }
  };

  const app = data?.application;
  const docs = data?.documents || [];
  const agreements = data?.agreements || [];
  const isMedical = app && MEDICAL_TYPES.includes(app.provider_type);
  const appData = app?.application_data || {};
  const fieldDocs = docs.filter((d) => !d.document_data);
  const fileDocs = docs.filter((d) => d.document_data);

  const requiredItems = isMedical ? REQUIRED_MEDICAL : ['website', 'social_media', 'phone'];
  const hasItem = (key) => docs.some((d) => d.document_type === key && (d.document_data || d.field_value));

  return (
    <div className="arm-overlay" onClick={onClose}>
      <div className="arm" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <button className="arm-close" onClick={onClose} aria-label="Close"><X size={20} /></button>

        {loading ? (
          <div className="arm-loading"><Loader2 className="arm-spin" size={28} /> Loading application…</div>
        ) : !app ? (
          <div className="arm-loading"><AlertCircle size={24} /> {err || 'Not found'}</div>
        ) : (
          <>
            <div className="arm-head">
              <div className="arm-head-main">
                <span className={`arm-type ${isMedical ? 'med' : ''}`}>{isMedical ? 'Medical' : 'Non-medical'}</span>
                <h2 className="arm-title">{app.business_name}</h2>
                <div className="arm-sub">{app.provider_type} · applied {new Date(app.submitted_at).toLocaleDateString()}</div>
              </div>
              <span className={`arm-status arm-${app.status}`}>{app.status}</span>
            </div>

            <div className="arm-grid">
              {/* LEFT */}
              <div className="arm-left">
                <div className="arm-card">
                  <div className="arm-card-h">Applicant</div>
                  <div className="arm-person">
                    <div className="arm-avatar">
                      {app.avatar_url ? <img src={app.avatar_url} alt="" /> : (app.first_name?.[0] || '?')}
                    </div>
                    <div>
                      <div className="arm-name">{app.first_name} {app.last_name}</div>
                      <div className="arm-meta"><Mail size={12} /> {app.email}</div>
                    </div>
                  </div>
                  <div className="arm-info">
                    {(appData.address || app.city) && <div className="arm-info-row"><MapPin size={13} /> {[appData.address, appData.city || app.city, appData.country].filter(Boolean).join(', ')}</div>}
                    {(appData.phone) && <div className="arm-info-row"><Phone size={13} /> {appData.phone}</div>}
                    {(appData.website) && <div className="arm-info-row"><Globe size={13} /> <a href={appData.website} target="_blank" rel="noreferrer">{appData.website}</a></div>}
                  </div>
                </div>

                {appData.description && (
                  <div className="arm-card">
                    <div className="arm-card-h">About</div>
                    <p className="arm-desc">{appData.description}</p>
                  </div>
                )}

                {Array.isArray(appData.services) && appData.services.length > 0 && (
                  <div className="arm-card">
                    <div className="arm-card-h">Services ({appData.services.length})</div>
                    {appData.services.map((s, i) => (
                      <div key={i} className="arm-svc"><span>{s.service_name}</span><b>{s.price ? `$${s.price}` : '—'}</b></div>
                    ))}
                  </div>
                )}

                <div className="arm-card">
                  <div className="arm-card-h">Agreements ({agreements.filter((a) => a.agreed).length}/{agreements.length})</div>
                  {agreements.map((a) => (
                    <div key={a.agreement_type} className="arm-agree">
                      <Check size={13} className={a.agreed ? 'ok' : 'no'} />
                      <span>{a.agreement_type.replace(/_/g, ' ')}</span>
                      {a.ip_address && <em className="arm-ip">IP {a.ip_address}</em>}
                    </div>
                  ))}
                </div>
              </div>

              {/* RIGHT */}
              <div className="arm-right">
                <div className="arm-card">
                  <div className="arm-card-h"><ShieldCheck size={14} /> Verification checklist</div>
                  {requiredItems.map((key) => (
                    <label key={key} className="arm-checkrow">
                      <input type="checkbox" checked={checks[key] || false}
                        onChange={(e) => setChecks((c) => ({ ...c, [key]: e.target.checked }))} />
                      <span className={`arm-pill ${hasItem(key) ? 'has' : 'miss'}`}>{hasItem(key) ? 'provided' : 'missing'}</span>
                      <span className="arm-check-lbl">{DOC_LABELS[key] || key}</span>
                    </label>
                  ))}
                </div>

                {fieldDocs.length > 0 && (
                  <div className="arm-card">
                    <div className="arm-card-h">Details</div>
                    {fieldDocs.map((d) => (
                      <div key={d.id} className="arm-field">
                        <span>{DOC_LABELS[d.document_type] || d.document_type}</span>
                        <b>{d.field_value}{d.expiry_date ? ` (exp ${new Date(d.expiry_date).toLocaleDateString()})` : ''}</b>
                      </div>
                    ))}
                  </div>
                )}

                <div className="arm-card">
                  <div className="arm-card-h">Documents ({fileDocs.length})</div>
                  {fileDocs.length === 0 && <p className="arm-muted">No file documents uploaded.</p>}
                  {fileDocs.map((d) => {
                    const img = d.mime_type?.startsWith('image/');
                    return (
                      <div key={d.id} className="arm-doc">
                        <div className="arm-doc-ico">{img ? <ImageIcon size={16} /> : <FileText size={16} />}</div>
                        <div className="arm-doc-meta">
                          <div className="arm-doc-name">{DOC_LABELS[d.document_type] || d.document_type}</div>
                          <div className="arm-doc-file">{d.document_name || d.mime_type}</div>
                        </div>
                        <button className="arm-doc-view" onClick={() => setViewDoc(d)}><ExternalLink size={14} /> View</button>
                      </div>
                    );
                  })}
                </div>

                {err && <div className="arm-err"><AlertCircle size={14} /> {err}</div>}

                {app.status !== 'approved' && (
                  <div className="arm-actions">
                    {!rejecting ? (
                      <>
                        <button className="arm-reject" onClick={() => { setRejecting(true); setErr(''); }} disabled={!!acting}>
                          <ThumbsDown size={15} /> Reject
                        </button>
                        <button className="arm-approve" onClick={approve} disabled={!!acting}>
                          {acting === 'approve' ? <Loader2 size={15} className="arm-spin" /> : <ThumbsUp size={15} />} Approve
                        </button>
                      </>
                    ) : (
                      <div className="arm-reject-box">
                        <textarea className="arm-reason" rows={3} value={reason}
                          onChange={(e) => setReason(e.target.value)}
                          placeholder="Reason for rejection (sent to the applicant)…" />
                        <div className="arm-reject-row">
                          <button className="arm-cancel" onClick={() => { setRejecting(false); setReason(''); }}>Cancel</button>
                          <button className="arm-reject" onClick={reject} disabled={acting === 'reject'}>
                            {acting === 'reject' ? <Loader2 size={15} className="arm-spin" /> : <ThumbsDown size={15} />} Confirm rejection
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </>
        )}

        {viewDoc && (
          <div className="arm-viewer" onClick={() => setViewDoc(null)}>
            <div className="arm-viewer-inner" onClick={(e) => e.stopPropagation()}>
              <div className="arm-viewer-head">
                <span>{DOC_LABELS[viewDoc.document_type] || viewDoc.document_type} · {viewDoc.document_name}</span>
                <div>
                  <a className="arm-viewer-dl" href={viewDoc.document_data} download={viewDoc.document_name}><Download size={15} /></a>
                  <button className="arm-viewer-x" onClick={() => setViewDoc(null)}><X size={18} /></button>
                </div>
              </div>
              <div className="arm-viewer-body">
                {viewDoc.mime_type?.startsWith('image/') ? (
                  <img src={viewDoc.document_data} alt={viewDoc.document_name} />
                ) : (
                  <iframe title="document" src={viewDoc.document_data} />
                )}
              </div>
            </div>
          </div>
        )}

        <style>{CSS}</style>
      </div>
    </div>
  );
}

const CSS = `
.luca .arm-overlay{position:fixed;inset:0;background:rgba(2,18,24,.55);backdrop-filter:blur(4px);z-index:4100;
  display:flex;align-items:flex-start;justify-content:center;padding:24px 16px;overflow-y:auto}
.luca .arm{position:relative;width:100%;max-width:980px;background:var(--surface);border-radius:var(--r-lg);
  box-shadow:0 24px 70px rgba(2,18,24,.4);overflow:hidden;animation:armin .25s ease;max-height:calc(100vh - 48px);display:flex;flex-direction:column}
@keyframes armin{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:none}}
.luca .arm-close{position:absolute;top:14px;right:14px;z-index:30;width:36px;height:36px;border-radius:50%;
  background:var(--surface-2);border:1px solid var(--line);cursor:pointer;display:grid;place-items:center;color:var(--ink)}
.luca .arm-loading{padding:60px;display:flex;flex-direction:column;align-items:center;gap:12px;color:var(--muted)}
.luca .arm-head{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;padding:22px 24px;border-bottom:1px solid var(--line);background:linear-gradient(180deg,var(--surface),var(--surface-2))}
.luca .arm-type{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--teal-d);background:var(--mint-soft);padding:3px 9px;border-radius:7px}
.luca .arm-type.med{color:var(--gold-ink);background:var(--gold-soft)}
.luca .arm-title{font-family:'Space Grotesk',sans-serif;font-size:21px;margin:8px 0 2px;color:var(--ink)}
.luca .arm-sub{font-size:12.5px;color:var(--muted)}
.luca .arm-status{font-size:11.5px;font-weight:700;text-transform:capitalize;padding:5px 12px;border-radius:999px;align-self:center}
.luca .arm-pending{color:var(--gold-ink);background:var(--gold-soft)}
.luca .arm-approved{color:var(--teal-d);background:var(--mint-soft)}
.luca .arm-rejected{color:var(--danger-ink);background:var(--danger-soft)}
.luca .arm-grid{display:grid;grid-template-columns:1fr 1fr;gap:16px;padding:20px 24px;overflow-y:auto}
.luca .arm-left,.luca .arm-right{display:flex;flex-direction:column;gap:14px;min-width:0}
.luca .arm-card{border:1px solid var(--line);border-radius:var(--r-sm);padding:14px;background:var(--surface)}
.luca .arm-card-h{display:flex;align-items:center;gap:6px;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.04em;color:var(--muted-2);margin-bottom:10px}
.luca .arm-person{display:flex;align-items:center;gap:12px}
.luca .arm-avatar{width:44px;height:44px;border-radius:50%;background:var(--teal-d);color:#fff;display:grid;place-items:center;font-weight:700;font-size:17px;overflow:hidden}
.luca .arm-avatar img{width:100%;height:100%;object-fit:cover}
.luca .arm-name{font-size:14.5px;font-weight:700;color:var(--ink)}
.luca .arm-meta{display:flex;align-items:center;gap:5px;font-size:12px;color:var(--muted);margin-top:2px}
.luca .arm-info{margin-top:12px;display:flex;flex-direction:column;gap:7px}
.luca .arm-info-row{display:flex;align-items:center;gap:7px;font-size:12.5px;color:var(--muted-2)}
.luca .arm-info-row a{color:var(--teal-d);text-decoration:none}
.luca .arm-desc{font-size:13px;color:var(--muted-2);line-height:1.6;margin:0}
.luca .arm-svc{display:flex;justify-content:space-between;font-size:13px;padding:5px 0;border-bottom:1px dashed var(--line)}
.luca .arm-svc:last-child{border-bottom:none}
.luca .arm-agree{display:flex;align-items:center;gap:7px;font-size:12.5px;color:var(--muted-2);padding:3px 0;text-transform:capitalize}
.luca .arm-agree .ok{color:var(--teal-d)}.luca .arm-agree .no{color:var(--danger)}
.luca .arm-ip{margin-left:auto;font-style:normal;font-size:10.5px;color:var(--muted);font-family:'IBM Plex Mono',monospace}
.luca .arm-checkrow{display:flex;align-items:center;gap:9px;padding:7px 0;font-size:13px;color:var(--ink);cursor:pointer}
.luca .arm-checkrow input{width:16px;height:16px;accent-color:var(--teal)}
.luca .arm-pill{font-size:10.5px;font-weight:700;padding:2px 8px;border-radius:6px;text-transform:uppercase}
.luca .arm-pill.has{color:var(--teal-d);background:var(--mint-soft)}
.luca .arm-pill.miss{color:var(--danger-ink);background:var(--danger-soft)}
.luca .arm-check-lbl{flex:1}
.luca .arm-field{display:flex;justify-content:space-between;gap:12px;font-size:12.5px;padding:5px 0;border-bottom:1px dashed var(--line)}
.luca .arm-field:last-child{border-bottom:none}
.luca .arm-field span{color:var(--muted)}.luca .arm-field b{color:var(--ink);text-align:right;word-break:break-all}
.luca .arm-doc{display:flex;align-items:center;gap:10px;padding:8px;border:1px solid var(--line);border-radius:10px;margin-bottom:8px}
.luca .arm-doc-ico{width:34px;height:34px;border-radius:8px;background:var(--mint-soft);color:var(--teal-d);display:grid;place-items:center;flex-shrink:0}
.luca .arm-doc-meta{flex:1;min-width:0}
.luca .arm-doc-name{font-size:13px;font-weight:600;color:var(--ink)}
.luca .arm-doc-file{font-size:11px;color:var(--muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.luca .arm-doc-view{display:inline-flex;align-items:center;gap:5px;font-size:12px;font-weight:600;color:var(--teal-d);background:var(--mint-soft);border:1px solid var(--mint-line);border-radius:8px;padding:6px 10px;cursor:pointer}
.luca .arm-muted{font-size:12.5px;color:var(--muted);margin:0}
.luca .arm-err{display:flex;align-items:center;gap:6px;font-size:12.5px;color:var(--danger-ink);background:var(--danger-soft);padding:8px 12px;border-radius:10px}
.luca .arm-actions{display:flex;gap:10px}
.luca .arm-approve,.luca .arm-reject{flex:1;display:inline-flex;align-items:center;justify-content:center;gap:7px;font-size:14px;font-weight:700;border-radius:999px;padding:12px;cursor:pointer;border:none}
.luca .arm-approve{background:var(--teal-d);color:#fff}
.luca .arm-approve:hover{background:var(--teal-d2)}
.luca .arm-reject{background:var(--danger-soft);color:var(--danger-ink)}
.luca .arm-reject:hover{background:var(--danger)}
.luca .arm-approve:disabled,.luca .arm-reject:disabled{opacity:.6;cursor:default}
.luca .arm-reject-box{width:100%}
.luca .arm-reason{width:100%;padding:10px 12px;border:1px solid var(--line-2);border-radius:var(--r-sm);font-family:inherit;font-size:13px;box-sizing:border-box;resize:vertical}
.luca .arm-reject-row{display:flex;gap:10px;margin-top:8px}
.luca .arm-cancel{flex:1;background:var(--surface-2);border:1px solid var(--line);border-radius:999px;padding:10px;cursor:pointer;font-weight:600;color:var(--muted-2)}
.luca .arm-spin{animation:armspin 1s linear infinite}
@keyframes armspin{to{transform:rotate(360deg)}}
.luca .arm-viewer{position:fixed;inset:0;background:rgba(2,18,24,.8);z-index:4200;display:flex;align-items:center;justify-content:center;padding:24px}
.luca .arm-viewer-inner{width:100%;max-width:820px;height:86vh;background:var(--surface);border-radius:var(--r);overflow:hidden;display:flex;flex-direction:column}
.luca .arm-viewer-head{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px 16px;border-bottom:1px solid var(--line);font-size:13px;font-weight:600;color:var(--ink)}
.luca .arm-viewer-head>div{display:flex;align-items:center;gap:6px}
.luca .arm-viewer-dl,.luca .arm-viewer-x{width:34px;height:34px;border-radius:8px;border:1px solid var(--line);background:var(--surface-2);display:grid;place-items:center;color:var(--ink);cursor:pointer;text-decoration:none}
.luca .arm-viewer-body{flex:1;background:var(--canvas);display:grid;place-items:center;overflow:auto}
.luca .arm-viewer-body img{max-width:100%;max-height:100%;object-fit:contain}
.luca .arm-viewer-body iframe{width:100%;height:100%;border:none}
@media(max-width:760px){.luca .arm-grid{grid-template-columns:1fr}}
`;
