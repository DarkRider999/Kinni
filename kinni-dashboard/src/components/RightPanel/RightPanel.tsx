import { formatMoney } from '../../config';
import styles from './RightPanel.module.css';

interface Props {
  open: boolean;
}

const GOAL_TARGET = 24000;
const GOAL_BOOKED = 244;
const GOAL_PACE = 792;
const GOAL_PREV = 24677;

const VISITOR_BARS = [3, 5, 2, 8, 6, 12, 15, 10, 9, 14, 11, 7, 13, 16, 18, 14, 10, 12, 8, 11, 15, 13, 9, 7, 11, 14, 12, 10];
const LIVE_COUNT = 38;
const CONVERSION = '2.5%';
const TOP_PAGE = 'Ceremonial Matcha';
const CARTS_OPEN = 2;

function DonutProgress({ value, max }: { value: number; max: number }) {
  const pct = Math.min(value / max, 1);
  const r = 42;
  const circ = 2 * Math.PI * r;
  const dash = pct * circ;
  return (
    <svg className={styles.donut} viewBox="0 0 100 100">
      <circle cx="50" cy="50" r={r} fill="none" stroke="var(--border)" strokeWidth="8" />
      <circle
        cx="50" cy="50" r={r} fill="none"
        stroke="var(--blue)" strokeWidth="8"
        strokeDasharray={`${dash} ${circ}`}
        strokeLinecap="round"
        transform="rotate(-90 50 50)"
        style={{ transition: 'stroke-dasharray 1s ease' }}
      />
      <text x="50" y="46" textAnchor="middle" fill="var(--text-primary)" fontSize="14" fontWeight="700">
        {Math.round(pct * 100)}%
      </text>
      <text x="50" y="58" textAnchor="middle" fill="var(--text-muted)" fontSize="8">
        of {formatMoney(max / 1000)}k
      </text>
    </svg>
  );
}

export default function RightPanel({ open }: Props) {
  if (!open) return null;
  const maxBar = Math.max(...VISITOR_BARS);

  return (
    <aside className={styles.panel}>
      {/* November goal */}
      <div className={`card ${styles.card}`}>
        <div className="card-head">
          <div>
            <p className="card-title">November goal</p>
            <p className="card-sub">21 days to go</p>
          </div>
          <button className="btn btn--ghost btn--icon btn--sm" title="Edit goal">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
            </svg>
          </button>
        </div>
        <DonutProgress value={GOAL_BOOKED} max={GOAL_TARGET} />
        <div className={styles.goalStats}>
          <div className={styles.goalStat}>
            <span className="stat-label">Booked</span>
            <span className={styles.goalVal}>{formatMoney(GOAL_BOOKED)}</span>
          </div>
          <div className={styles.goalStat}>
            <span className="stat-label">Daily pace needed</span>
            <span className={styles.goalVal}>{formatMoney(GOAL_PACE)}</span>
          </div>
          <div className={styles.goalStat}>
            <span className="stat-label">October finished</span>
            <span className={styles.goalVal}>{formatMoney(GOAL_PREV)}</span>
          </div>
        </div>
      </div>

      {/* Live store */}
      <div className={`card ${styles.card}`}>
        <div className="card-head">
          <p className="card-title">Live store</p>
          <span className="badge badge--green">
            <span className="badge-dot" />
            Visitors
          </span>
        </div>
        <div className={styles.liveCount}>
          <span className={styles.liveNum}>{LIVE_COUNT}</span>
          <span className={styles.liveSub}>on the site</span>
        </div>
        {/* Sparkline bars */}
        <div className={styles.sparkline}>
          {VISITOR_BARS.map((v, i) => (
            <div
              key={i}
              className={styles.sparkBar}
              style={{ height: `${(v / maxBar) * 100}%` }}
            />
          ))}
        </div>
        <div className={styles.liveStats}>
          <div className={styles.liveStat}>
            <span className="stat-label">Carts open</span>
            <span className={styles.liveStatVal}>{CARTS_OPEN}</span>
          </div>
          <div className={styles.liveStat}>
            <span className="stat-label">Converting, 30 days</span>
            <span className={styles.liveStatVal}>{CONVERSION}</span>
          </div>
          <div className={styles.liveStat}>
            <span className="stat-label">Top page</span>
            <span className={`${styles.liveStatVal} ${styles.topPage}`}>{TOP_PAGE}</span>
          </div>
        </div>
        <div className={styles.checkoutBadge}>
          <span className="badge badge--green">
            <span className="badge-dot" />
            Checkout healthy
          </span>
        </div>
      </div>
    </aside>
  );
}
