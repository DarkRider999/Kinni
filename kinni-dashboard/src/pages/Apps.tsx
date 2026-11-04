import { useState } from 'react';
import type { LucideIcon } from 'lucide-react';
import { CreditCard, Instagram, Mail, Sparkles, Star, Truck } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';

const apps: { id: string; name: string; desc: string; icon: LucideIcon; color: string; installed: boolean }[] = [
  { id: 'ship', name: 'ShipRelay', desc: 'Buy labels and sync tracking to every order.', icon: Truck, color: '#14B8A6', installed: true },
  { id: 'ig', name: 'Instagram Shop', desc: 'Tag products in posts and sell from stories.', icon: Instagram, color: '#F59E0B', installed: true },
  { id: 'mail', name: 'Steep Mail', desc: 'Email campaigns and abandoned-cart flows.', icon: Mail, color: '#3B82F6', installed: false },
  { id: 'rev', name: 'Leafy Reviews', desc: 'Collect photo reviews after delivery.', icon: Star, color: '#EAB308', installed: false },
  { id: 'pay', name: 'Split Pay', desc: 'Let customers pay in four installments.', icon: CreditCard, color: '#8B5CF6', installed: false },
  { id: 'ai', name: 'Blend Writer', desc: 'Draft product descriptions from tasting notes.', icon: Sparkles, color: '#22C55E', installed: false },
];

export default function Apps() {
  const [installed, setInstalled] = useState(() => new Set(apps.filter((a) => a.installed).map((a) => a.id)));
  const toggle = (id: string) => setInstalled((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  return (
    <div className="page">
      <div className="page-head"><div><h2 className="page-title">Apps</h2><div className="page-sub">{installed.size} installed · {apps.length} available</div></div></div>
      <div className="grid-3">
        {apps.map(({ id, name, desc, icon: Icon, color }) => (
          <Card key={id}>
            <div className="row" style={{ marginBottom: 10 }}>
              <span className="avatar" style={{ borderRadius: 9, width: 36, height: 36, background: `${color}26`, color }}><Icon size={17} /></span>
              <strong style={{ flex: 1 }}>{name}</strong>
            </div>
            <p className="muted" style={{ margin: '0 0 14px', fontSize: 12, minHeight: 34 }}>{desc}</p>
            <Button size="sm" variant={installed.has(id) ? 'outline' : 'primary'} onClick={() => toggle(id)}>{installed.has(id) ? 'Installed · Remove' : 'Install'}</Button>
          </Card>
        ))}
      </div>
    </div>
  );
}
