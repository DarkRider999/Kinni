import { useState } from 'react';
import { Send } from 'lucide-react';
import { Card } from '../components/ui/Card';
import { initials } from '../config';

interface Msg { from: 'them' | 'me'; text: string; time: string }
const seed: { id: string; name: string; color: string; unread: boolean; msgs: Msg[] }[] = [
  { id: 'a', name: 'Sofia Moreno', color: '#3B82F6', unread: true, msgs: [
    { from: 'them', text: 'Hi! Is the Ceremonial Matcha good for lattes or just whisking?', time: '9:12' },
    { from: 'me', text: 'Both! For lattes use about 2g and a splash of hot water first.', time: '9:15' },
    { from: 'them', text: 'Perfect, adding a second tin to my order!', time: '9:18' },
  ] },
  { id: 'b', name: 'Jose Tarif', color: '#F59E0B', unread: false, msgs: [
    { from: 'them', text: 'My order KL-49904 shows sent, any tracking?', time: 'Yesterday' },
    { from: 'me', text: 'Yes — USPS 9400 1118 49904, arriving Tuesday.', time: 'Yesterday' },
  ] },
];

export default function Chats() {
  const [threads, setThreads] = useState(seed);
  const [activeId, setActiveId] = useState('a');
  const [draft, setDraft] = useState('');
  const active = threads.find((t) => t.id === activeId)!;
  const open = (id: string) => { setActiveId(id); setThreads((ts) => ts.map((t) => (t.id === id ? { ...t, unread: false } : t))); };
  const send = () => {
    if (!draft.trim()) return;
    setThreads((ts) => ts.map((t) => (t.id === activeId ? { ...t, msgs: [...t.msgs, { from: 'me', text: draft.trim(), time: 'now' }] } : t)));
    setDraft('');
  };
  return (
    <div className="page">
      <div className="page-head"><div><h2 className="page-title">Chats</h2><div className="page-sub">Storefront messages</div></div></div>
      <Card style={{ padding: 0, display: 'grid', gridTemplateColumns: '240px 1fr', height: 520, overflow: 'hidden' }}>
        <div style={{ borderRight: '1px solid var(--border)', padding: 8 }}>
          {threads.map((t) => (
            <button key={t.id} onClick={() => open(t.id)} className="row" style={{ width: '100%', padding: 10, borderRadius: 8, textAlign: 'left', background: t.id === activeId ? 'var(--bg-card-hover)' : undefined }}>
              <span className="avatar" style={{ background: t.color }}>{initials(t.name)}</span>
              <span style={{ flex: 1, minWidth: 0 }}>
                <strong style={{ display: 'block', fontWeight: 500 }}>{t.name}</strong>
                <span className="faint" style={{ fontSize: 11, display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.msgs[t.msgs.length - 1].text}</span>
              </span>
              {t.unread && <span className="badge-dot" style={{ color: 'var(--blue)' }} />}
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          <div className="row" style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)' }}><strong>{active.name}</strong><span className="faint" style={{ fontSize: 11 }}>· usually replies in minutes</span></div>
          <div style={{ flex: 1, overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {active.msgs.map((m, i) => (
              <div key={i} style={{ alignSelf: m.from === 'me' ? 'flex-end' : 'flex-start', maxWidth: '70%' }}>
                <div style={{ padding: '8px 12px', borderRadius: 12, background: m.from === 'me' ? 'var(--blue)' : 'var(--bg-card-hover)', color: m.from === 'me' ? '#fff' : undefined }}>{m.text}</div>
                <div className="faint" style={{ fontSize: 10, marginTop: 2, textAlign: m.from === 'me' ? 'right' : 'left' }}>{m.time}</div>
              </div>
            ))}
          </div>
          <form className="row" style={{ padding: 12, borderTop: '1px solid var(--border)' }} onSubmit={(e) => { e.preventDefault(); send(); }}>
            <input className="input" placeholder={`Reply to ${active.name}`} value={draft} onChange={(e) => setDraft(e.target.value)} />
            <button className="btn btn--primary btn--icon" type="submit" aria-label="Send"><Send size={14} /></button>
          </form>
        </div>
      </Card>
    </div>
  );
}
