import { useEffect, useState } from 'react';
import { Check } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { config } from '../config';

const tabs = ['General', 'Payments', 'Shipping', 'Notifications', 'Team'] as const;
type Tab = (typeof tabs)[number];

const Field = ({ label, value, hint }: { label: string; value: string; hint?: string }) => (
  <div className="field"><label>{label}</label><input className="input" defaultValue={value} />{hint && <span className="field-hint">{hint}</span>}</div>
);
function Toggle({ label, on: initial }: { label: string; on: boolean }) {
  const [on, setOn] = useState(initial);
  return <button type="button" className="row" style={{ justifyContent: 'space-between', width: '100%', padding: '8px 0' }} onClick={() => setOn(!on)}><span>{label}</span><span className={`switch ${on ? 'is-on' : ''}`} /></button>;
}

const panels: Record<Tab, JSX.Element> = {
  General: <div className="grid-2"><Field label="Store name" value={config.storeName} /><Field label="Contact email" value={config.userEmail} /><Field label="Currency" value={config.currency} /><Field label="Timezone" value="America/Chicago" /></div>,
  Payments: <div className="grid-2"><Field label="Payout account" value="•••• 4021" /><Field label="Payout schedule" value="Every Tuesday" /><Field label="Statement descriptor" value="KINANDLEAF" hint="Shown on customer card statements" /><Field label="Tax rate" value="8.25%" /></div>,
  Shipping: <div className="grid-2"><Field label="Ship from" value="1420 Elm St, Austin TX" /><Field label="Default carrier" value="USPS Ground Advantage" /><Field label="Free shipping over" value="$45.00" /><Field label="Handling time" value="1 business day" /></div>,
  Notifications: <div><Toggle label="New order" on /><Toggle label="Low stock alerts" on /><Toggle label="Daily sales digest" on={false} /><Toggle label="Chat messages" on /></div>,
  Team: <div className="grid-2"><Field label="Owner" value={`${config.userName} · ${config.userEmail}`} /><Field label="Invite teammate" value="" hint="They’ll get an email invite" /><Field label="Packer" value="Sam Ruiz · sam@kiandleaf.co" /><Field label="Default role" value="Staff" /></div>,
};

export default function Settings() {
  const [tab, setTab] = useState<Tab>('General');
  const [saved, setSaved] = useState(false);
  useEffect(() => { if (!saved) return; const t = window.setTimeout(() => setSaved(false), 1800); return () => window.clearTimeout(t); }, [saved]);
  return (
    <div className="page">
      <div className="page-head"><div><h2 className="page-title">Settings</h2><div className="page-sub">{config.storeName} store preferences</div></div></div>
      <div className="tabs">{tabs.map((t) => <button key={t} className={tab === t ? 'is-active' : ''} onClick={() => setTab(t)}>{t}</button>)}</div>
      <Card title={tab}>
        <form key={tab} onSubmit={(e) => { e.preventDefault(); setSaved(true); }}>
          {panels[tab]}
          <div className="row" style={{ justifyContent: 'flex-end', marginTop: 16 }}><Button type="submit" variant="primary">Save changes</Button></div>
        </form>
      </Card>
      {saved && <div className="toast"><Check size={14} color="var(--green)" /> {tab} settings saved</div>}
    </div>
  );
}
