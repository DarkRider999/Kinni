import { useState } from 'react';
import { Archive, Reply } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';

const seed = [
  { id: 1, from: 'Fern & Co. Café', subject: 'Wholesale reorder for November', preview: 'Hi Noor, we’d like to bump our matcha order…', body: 'Hi Noor,\n\nWe’d like to bump our Ceremonial Matcha order to 6 kg for November and add 2 kg of Jasmine Pearls. Same delivery window as last month works.\n\nThanks!\nPriya', time: '8:41 AM', unread: true },
  { id: 2, from: 'Stripe', subject: 'Your payout of $1,842.10 is on the way', preview: 'A payout to your account ending 4021…', body: 'A payout of $1,842.10 to your bank account ending in 4021 has been initiated and should arrive within 2 business days.', time: '7:02 AM', unread: true },
  { id: 3, from: 'Thea Novak', subject: 'Loved the Milk Oolong!', preview: 'Just wanted to say the oolong was…', body: 'Just wanted to say the Milk Oolong was incredible. Any chance it’s coming back in stock soon? I’d love a larger pouch.\n\n— Thea', time: 'Yesterday', unread: false },
];

export default function Email() {
  const [mails, setMails] = useState(seed);
  const [openId, setOpenId] = useState(1);
  const open = mails.find((m) => m.id === openId);
  const select = (id: number) => { setOpenId(id); setMails((ms) => ms.map((m) => (m.id === id ? { ...m, unread: false } : m))); };
  const archive = (id: number) => { const rest = mails.filter((m) => m.id !== id); setMails(rest); setOpenId(rest[0]?.id ?? 0); };
  return (
    <div className="page">
      <div className="page-head"><div><h2 className="page-title">Email</h2><div className="page-sub">{mails.filter((m) => m.unread).length} unread · hello@kinandleaf.co</div></div></div>
      <Card style={{ padding: 0, display: 'grid', gridTemplateColumns: '300px 1fr', minHeight: 460, overflow: 'hidden' }}>
        <div style={{ borderRight: '1px solid var(--border)' }}>
          {mails.map((m) => (
            <button key={m.id} onClick={() => select(m.id)} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '12px 14px', borderBottom: '1px solid var(--border)', background: m.id === openId ? 'var(--bg-card-hover)' : undefined }}>
              <div className="row" style={{ justifyContent: 'space-between' }}><strong style={{ fontWeight: m.unread ? 700 : 500 }}>{m.unread && <span className="badge-dot" style={{ display: 'inline-block', color: 'var(--blue)', marginRight: 6 }} />}{m.from}</strong><span className="faint" style={{ fontSize: 11 }}>{m.time}</span></div>
              <div style={{ fontSize: 12, marginTop: 2, fontWeight: m.unread ? 600 : 400 }}>{m.subject}</div>
              <div className="faint" style={{ fontSize: 11, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.preview}</div>
            </button>
          ))}
          {mails.length === 0 && <div className="faint" style={{ padding: 16 }}>Inbox zero.</div>}
        </div>
        <div style={{ padding: 20 }}>
          {open ? (
            <>
              <div className="row" style={{ justifyContent: 'space-between', marginBottom: 12 }}>
                <div><h3 style={{ margin: 0, fontSize: 15 }}>{open.subject}</h3><div className="muted" style={{ fontSize: 12 }}>{open.from} · {open.time}</div></div>
                <div className="row"><Button size="sm" variant="outline" icon={<Reply size={12} />}>Reply</Button><Button size="sm" variant="outline" icon={<Archive size={12} />} onClick={() => archive(open.id)}>Archive</Button></div>
              </div>
              <p style={{ whiteSpace: 'pre-line', lineHeight: 1.6, color: 'var(--text-secondary)' }}>{open.body}</p>
            </>
          ) : <div className="faint">Select an email</div>}
        </div>
      </Card>
    </div>
  );
}
