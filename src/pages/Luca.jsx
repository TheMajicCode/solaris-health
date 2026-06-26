import React, { useEffect, useRef, useState } from 'react';
import { api } from '../lib/api.js';
import { Spinner } from '../components/ui.jsx';
import { Bot, Send, Plus } from 'lucide-react';

const SUGGESTIONS = ['Explain my vitality score', 'Suggest a routine', 'Help me sleep better', 'Find a practitioner'];

export default function Luca() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const endRef = useRef(null);

  useEffect(() => {
    (async () => {
      try { const { messages } = await api.getLucaMessages(); setMessages(messages || []); }
      finally { setLoading(false); }
    })();
  }, []);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, sending]);

  const send = async (text) => {
    const content = (text ?? input).trim();
    if (!content || sending) return;
    setInput('');
    setMessages((m) => [...m, { role: 'user', content }]);
    setSending(true);
    try {
      const { reply } = await api.sendLucaMessage(content);
      setMessages((m) => [...m, { role: 'assistant', content: reply }]);
    } catch {
      setMessages((m) => [...m, { role: 'assistant', content: 'I had trouble responding just now. Please try again.' }]);
    } finally { setSending(false); }
  };

  if (loading) return <div className="page"><Spinner label="Waking LUCA…" /></div>;

  return (
    <div className="page col" style={{ minHeight: 'calc(100vh - 64px)', paddingBottom: 110 }}>
      <div className="text-center fade-up" style={{ marginBottom: 16 }}>
        <p className="eyebrow gold">Your AI Health Concierge</p>
        <h1 className="display" style={{ fontSize: '1.6rem', marginTop: 4 }}>LUCA</h1>
        <p className="muted" style={{ fontSize: '0.8rem' }}>Guide · educator · navigator — never a diagnosis</p>
      </div>

      <div className="col gap-3" style={{ flex: 1 }}>
        {messages.length === 0 && (
          <div className="card glass center col text-center gap-2" style={{ padding: '2rem 1.4rem' }}>
            <div className="center floaty" style={{ width: 56, height: 56, borderRadius: 16, background: 'linear-gradient(135deg,var(--primary),var(--primary-container))' }}>
              <Bot size={28} color="#00271a" />
            </div>
            <h3 className="serif" style={{ fontSize: '1.2rem' }}>How can I support you today?</h3>
            <p className="muted" style={{ fontSize: '0.85rem' }}>Ask me about your results, habits, or finding the right care.</p>
          </div>
        )}
        {messages.map((m, i) => <Bubble key={i} role={m.role} content={m.content} />)}
        {sending && <Bubble role="assistant" content="…" />}
        <div ref={endRef} />
      </div>

      {/* Suggestions */}
      <div className="scroll-x fade-up" style={{ margin: '14px 0 10px' }}>
        {SUGGESTIONS.map((s) => (
          <button key={s} className="chip" onClick={() => send(s)} style={{ flexShrink: 0 }}>{s}</button>
        ))}
      </div>

      {/* Input */}
      <div className="glass row gap-2" style={{ padding: '0.5rem 0.5rem 0.5rem 1rem', borderRadius: 999, position: 'sticky', bottom: 96 }}>
        <Plus size={20} color="var(--outline)" />
        <input className="input" value={input} onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && send()} placeholder="Type a message…"
          style={{ background: 'transparent', border: 'none', boxShadow: 'none', padding: '0.5rem 0' }} />
        <button onClick={() => send()} className="center" style={{ width: 42, height: 42, borderRadius: 999, border: 'none', cursor: 'pointer', background: 'linear-gradient(135deg,var(--primary),var(--primary-container))', flexShrink: 0 }}>
          <Send size={18} color="#00271a" />
        </button>
      </div>
    </div>
  );
}

function Bubble({ role, content }) {
  const isUser = role === 'user';
  return (
    <div className="fade-up" style={{ alignSelf: isUser ? 'flex-end' : 'flex-start', maxWidth: '86%' }}>
      {!isUser && <div className="row gap-1" style={{ marginBottom: 5 }}>
        <Bot size={14} color="var(--primary)" /><span className="label mint" style={{ fontSize: '0.66rem' }}>LUCA AI</span>
      </div>}
      {isUser && <div className="label gold" style={{ textAlign: 'right', marginBottom: 5, fontSize: '0.66rem' }}>YOU</div>}
      <div style={{
        padding: '0.85rem 1.1rem', borderRadius: 18, lineHeight: 1.5, fontSize: '0.9rem',
        background: isUser ? 'transparent' : 'rgba(16,185,129,0.10)',
        border: isUser ? '1px solid rgba(255,185,95,0.3)' : '1px solid rgba(78,222,163,0.18)',
        borderBottomRightRadius: isUser ? 4 : 18, borderBottomLeftRadius: isUser ? 18 : 4,
      }}>{content}</div>
    </div>
  );
}
