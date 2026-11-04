import { useMemo, useState } from 'react';
import { Area, AreaChart, CartesianGrid, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { formatMoney } from '../../config';
import s from './Dashboard.module.css';

type Range = '1M' | '6M' | '30D' | '7D';
interface Point { label: string; value: number; prev: number }

/** Scale a shape so it sums to `total` exactly (integers). */
function fit(shape: number[], total: number): number[] {
  const sum = shape.reduce((a, b) => a + b, 0);
  const out = shape.map((v) => Math.round((v / sum) * total));
  out[out.length - 1] += total - out.reduce((a, b) => a + b, 0);
  return out;
}
const wave = (n: number, seed: number) => Array.from({ length: n }, (_, i) => 1 + 0.35 * Math.sin(i * 0.9 + seed) + 0.2 * Math.cos(i * 2.3 + seed * 2));

// Oct 3 → Nov 1: 23 days summing to 17,101, six days to 6,169, today $244 → 30D $23,514, 7D $6,413.
const daily = [...fit(wave(23, 1), 17101), ...fit(wave(6, 4), 6169), 244];
const prevDaily = fit(wave(30, 2.2), 23514 + 33);
const dayLabel = (i: number) => {
  const d = new Date(2026, 9, 3 + i);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};
const series30: Point[] = daily.map((v, i) => ({ label: dayLabel(i), value: v, prev: prevDaily[i] }));
const months = ['Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov'];
const weekly = fit(wave(26, 0.5), 131800);
const weeklyPrev = fit(wave(26, 3), 124300);
const series6m: Point[] = weekly.map((v, i) => ({ label: `${months[Math.floor(i / 4.4)]} wk${(i % 4) + 1}`, value: v, prev: weeklyPrev[i] }));

export default function SalesChart() {
  const [range, setRange] = useState<Range>('30D');
  const [showPrev, setShowPrev] = useState(false);
  const data = useMemo(() => (range === '6M' ? series6m : range === '7D' ? series30.slice(-7) : series30), [range]);
  const total = data.reduce((a, p) => a + p.value, 0);
  const delta = total - data.reduce((a, p) => a + p.prev, 0);

  return (
    <section className={`card ${s.sales}`}>
      <header className="card-head">
        <div>
          <h3 className="card-title">Sales studio</h3>
          <div className="card-sub">{formatMoney(total)} in this range · {delta < 0 ? '–' : '+'}{Math.abs(delta).toLocaleString()} on the same stretch before</div>
        </div>
        <div className="row">
          <button className={`btn btn--sm ${showPrev ? 'btn--active' : 'btn--outline'}`} onClick={() => setShowPrev((p) => !p)}>Previous</button>
          <div className="segmented">
            {(['1M', '6M', '30D', '7D'] as Range[]).map((r) => (
              <button key={r} className={range === r ? 'is-active' : ''} onClick={() => setRange(r)}>{r}</button>
            ))}
          </div>
        </div>
      </header>
      <div className={s.chart}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 8, right: 4, left: -12, bottom: 0 }}>
            <defs>
              <linearGradient id="salesFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--blue)" stopOpacity={0.45} />
                <stop offset="100%" stopColor="var(--blue)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="var(--chart-grid)" vertical={false} />
            <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: 'var(--text-muted)', fontSize: 11 }} interval={range === '7D' ? 0 : 'preserveStartEnd'} minTickGap={24} />
            <YAxis tickLine={false} axisLine={false} tick={{ fill: 'var(--text-muted)', fontSize: 11 }} tickFormatter={(v: number) => `$${v >= 1000 ? `${(v / 1000).toFixed(1)}k` : v}`} width={48} />
            <Tooltip cursor={{ stroke: 'var(--border-strong)' }} content={({ active, payload, label }) =>
              active && payload?.length ? (
                <div className="chart-tip"><span className="muted">{label}</span><strong>{formatMoney(Number(payload[0].value))}</strong></div>
              ) : null} />
            {showPrev && <Line type="monotone" dataKey="prev" stroke="var(--text-muted)" strokeDasharray="4 4" dot={false} strokeWidth={1.5} />}
            <Area type="monotone" dataKey="value" stroke="var(--blue-light)" strokeWidth={2} fill="url(#salesFill)" activeDot={{ r: 4, fill: '#fff', stroke: 'var(--blue)' }} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}
