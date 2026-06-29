/**
 * DocumentUpload — drag-and-drop file picker that converts a single file to a
 * base64 data URL for the provider application flow.
 *
 * Props:
 *   label        field label (e.g. "Medical degree")
 *   hint         small helper text
 *   accept       file accept string (default PDF/JPG/PNG)
 *   value        current value { document_name, document_data, mime_type }
 *   onChange     (fileObj | null) => void
 *   required     boolean (renders a marker)
 */
import React, { useCallback, useRef, useState } from 'react';
import { UploadCloud, FileText, Image as ImageIcon, X, Check, AlertCircle } from 'lucide-react';

const MAX_BYTES = 10 * 1024 * 1024; // 10 MB
const ALLOWED = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'];

export default function DocumentUpload({
  label, hint, accept = '.pdf,.jpg,.jpeg,.png', value = null, onChange, required = false,
}) {
  const inputRef = useRef(null);
  const [drag, setDrag] = useState(false);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const handleFile = useCallback((file) => {
    setErr('');
    if (!file) return;
    const mime = (file.type || '').toLowerCase();
    if (mime && !ALLOWED.includes(mime)) {
      setErr('Unsupported type. Use PDF, JPG or PNG.');
      return;
    }
    if (file.size > MAX_BYTES) {
      setErr('File exceeds the 10 MB limit.');
      return;
    }
    setBusy(true);
    const reader = new FileReader();
    reader.onload = () => {
      setBusy(false);
      onChange?.({
        document_name: file.name,
        document_data: reader.result, // data URL
        mime_type: mime || 'application/octet-stream',
        size: file.size,
      });
    };
    reader.onerror = () => { setBusy(false); setErr('Could not read file.'); };
    reader.readAsDataURL(file);
  }, [onChange]);

  const onDrop = useCallback((e) => {
    e.preventDefault(); setDrag(false);
    const file = e.dataTransfer?.files?.[0];
    handleFile(file);
  }, [handleFile]);

  const isImage = value?.mime_type?.startsWith('image/');

  return (
    <div className="du">
      <label className="du-label">
        {label} {required && <span className="du-req">*</span>}
      </label>
      {hint && <p className="du-hint">{hint}</p>}

      {!value ? (
        <div
          className={`du-drop ${drag ? 'on' : ''}`}
          onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
          onDragLeave={() => setDrag(false)}
          onDrop={onDrop}
          onClick={() => inputRef.current?.click()}
          role="button"
          tabIndex={0}
        >
          <UploadCloud size={26} />
          <div className="du-drop-main">
            {busy ? 'Reading file…' : 'Drag & drop or click to upload'}
          </div>
          <div className="du-drop-sub">PDF, JPG or PNG · max 10 MB</div>
          <input
            ref={inputRef}
            type="file"
            accept={accept}
            hidden
            onChange={(e) => handleFile(e.target.files?.[0])}
          />
        </div>
      ) : (
        <div className="du-file">
          <div className="du-file-ico">
            {isImage ? <ImageIcon size={20} /> : <FileText size={20} />}
          </div>
          <div className="du-file-meta">
            <div className="du-file-name">{value.document_name}</div>
            <div className="du-file-ok"><Check size={13} /> Ready to submit</div>
          </div>
          {isImage && (
            <img className="du-thumb" src={value.document_data} alt="preview" />
          )}
          <button className="du-remove" onClick={() => { onChange?.(null); setErr(''); }} aria-label="Remove">
            <X size={16} />
          </button>
        </div>
      )}

      {err && <div className="du-err"><AlertCircle size={14} /> {err}</div>}

      <style>{CSS}</style>
    </div>
  );
}

const CSS = `
.luca .du{margin-bottom:14px}
.luca .du-label{display:block;font-size:13px;font-weight:700;color:var(--ink);margin-bottom:2px}
.luca .du-req{color:var(--danger)}
.luca .du-hint{font-size:12px;color:var(--muted);margin:0 0 8px}
.luca .du-drop{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;
  padding:22px 16px;border:1.5px dashed var(--line-2);border-radius:var(--r-sm);background:var(--surface-2);
  color:var(--muted);cursor:pointer;text-align:center;transition:all .15s}
.luca .du-drop:hover,.luca .du-drop.on{border-color:var(--teal);background:var(--mint-soft);color:var(--teal-d)}
.luca .du-drop-main{font-size:13px;font-weight:600;color:var(--ink)}
.luca .du-drop-sub{font-size:11px;color:var(--muted)}
.luca .du-file{display:flex;align-items:center;gap:12px;padding:12px;border:1px solid var(--mint-line);
  border-radius:var(--r-sm);background:var(--mint-soft)}
.luca .du-file-ico{width:38px;height:38px;border-radius:10px;display:grid;place-items:center;
  background:var(--surface);color:var(--teal-d);border:1px solid var(--mint-line);flex-shrink:0}
.luca .du-file-meta{flex:1;min-width:0}
.luca .du-file-name{font-size:13px;font-weight:600;color:var(--ink);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.luca .du-file-ok{display:inline-flex;align-items:center;gap:4px;font-size:11px;color:var(--teal-d);font-weight:600;margin-top:2px}
.luca .du-thumb{width:42px;height:42px;border-radius:8px;object-fit:cover;border:1px solid var(--mint-line)}
.luca .du-remove{width:30px;height:30px;border-radius:8px;border:1px solid var(--line);background:var(--surface);
  cursor:pointer;display:grid;place-items:center;color:var(--muted);flex-shrink:0}
.luca .du-remove:hover{color:var(--danger);border-color:var(--danger-soft)}
.luca .du-err{display:flex;align-items:center;gap:6px;font-size:12px;color:var(--danger-ink);
  background:var(--danger-soft);padding:6px 10px;border-radius:8px;margin-top:8px}
`;
