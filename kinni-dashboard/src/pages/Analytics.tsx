import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Card } from '../components/ui/Card';
import { formatMoney } from '../config';

const revenue = ['Dec', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov'].map((m, i) => ({ m, v: Math.round(14000 + i * 950 + 2400 * Math.sin(i * 1.1)) }));
const top = [{ n: 'Ceremonial Matcha', v: 6840 }, { n: 'Jasmine Pearls', v: 4120 }, { n: 'Milk Oolong', v: 3390 }, { n: 'Bergamot Grey', v: 2950 }, { n: 'Chamomile Calm', v: 1710 }];
const regions = [
  { name: 'California', pct: 24, x: 12, y: 52 }, { name: 'New York', pct: 18, x: 86, y: 34 }, { name: 'Texas', pct: 13, x: 48, y: 74 },
  { name: 'Illinois', pct: 9, x: 64, y: 38 }, { name: 'Washington', pct: 7, x: 16, y: 16 }, { name: 'Colorado', pct: 6, x: 36, y: 46 },
];
const axis = { tickLine: false, axisLine: false, tick: { fill: 'var(--text-muted)', fontSize: 11 } };
const tip = { contentStyle: { background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }, formatter: (v: number) => formatMoney(v) };

export default function Analytics() {
  return (
    <div className="page">
      <div className="page-head"><div><h2 className="page-title">Analytics</h2><div className="page-sub">Trailing 12 months · all channels</div></div></div>
      <div className="grid-4">
        {[['Revenue, 12 mo', '$221,480'], ['Orders', '6,912'], ['Avg. order value', '$32.04'], ['Returning customers', '41%']].map(([l, v]) => (
          <Card key={l}><div className="stat-label">{l}</div><div className="stat-value">{v}</div></Card>
        ))}
      </div>
      <Card title="Revenue over time" subtitle="Monthly gross sales">
        <div style={{ height: 240 }}>
          <ResponsiveContainer>
            <AreaChart data={revenue} margin={{ left: -8, right: 4, top: 8 }}>
              <defs><linearGradient id="revFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="var(--blue)" stopOpacity={0.4} /><stop offset="100%" stopColor="var(--blue)" stopOpacity={0} /></linearGradient></defs>
              <CartesianGrid stroke="var(--chart-grid)" vertical={false} />
              <XAxis dataKey="m" {...axis} /><YAxis {...axis} tickFormatter={(v: number) => `$${v / 1000}k`} width={48} />
              <Tooltip {...tip} />
              <Area type="monotone" dataKey="v" name="Revenue" stroke="var(--blue-light)" strokeWidth={2} fill="url(#revFill)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </Card>
      <div className="grid-2">
        <Card title="Top products" subtitle="Revenue, last 30 days">
          <div style={{ height: 230 }}>
            <ResponsiveContainer>
              <BarChart data={top} layout="vertical" margin={{ left: 20, right: 12 }}>
                <CartesianGrid stroke="var(--chart-grid)" horizontal={false} />
                <XAxis type="number" {...axis} tickFormatter={(v: number) => `$${v / 1000}k`} />
                <YAxis type="category" dataKey="n" {...axis} width={110} />
                <Tooltip {...tip} cursor={{ fill: 'var(--bg-card-hover)' }} />
                <Bar dataKey="v" name="Revenue" fill="var(--blue)" radius={[0, 4, 4, 0]} barSize={14} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card title="Where customers are" subtitle="Share of orders by state">
          <div style={{ position: 'relative', height: 140, borderRadius: 10, background: 'radial-gradient(circle at 30% 40%, var(--blue-dim), transparent 60%), var(--bg-input)', border: '1px solid var(--border)', marginBottom: 12 }}>
            {regions.map((r) => (
              <span key={r.name} title={`${r.name} ${r.pct}%`} style={{ position: 'absolute', left: `${r.x}%`, top: `${r.y}%`, width: 6 + r.pct, height: 6 + r.pct, borderRadius: '50%', background: 'var(--blue)', opacity: 0.75, transform: 'translate(-50%,-50%)', boxShadow: '0 0 0 4px var(--blue-dim)' }} />
            ))}
          </div>
          {regions.slice(0, 4).map((r) => (
            <div key={r.name} className="row" style={{ marginBottom: 6, fontSize: 12 }}>
              <span style={{ width: 90 }}>{r.name}</span>
              <span style={{ flex: 1, height: 6, borderRadius: 4, background: 'var(--bg-card-hover)' }}><span style={{ display: 'block', height: '100%', width: `${r.pct * 4}%`, borderRadius: 4, background: 'var(--blue)' }} /></span>
              <span className="muted mono" style={{ width: 32, textAlign: 'right' }}>{r.pct}%</span>
            </div>
          ))}
        </Card>
      </div>
    </div>
  );
}
