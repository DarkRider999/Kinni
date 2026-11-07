import type { Order } from '../../types';
import PackingQueue from './PackingQueue';
import RunningLow from './RunningLow';
import SalesChart from './SalesChart';
import SalesSources from './SalesSources';
import StatCard from './StatCard';
import s from './Dashboard.module.css';

export default function Dashboard({ orders }: { orders: Order[] }) {
  return (
    <div className="page">
      <div className={s.kpis}>
        <StatCard label="Today so far" value="$244" delta="+18% vs last Sunday" />
        <StatCard label="Last 7 days" value="$6,413" delta="+5.5% vs the week before" />
        <StatCard label="Orders today" value="6" delta="+200% vs last Sunday" spark={[1, 2, 1, 2, 3, 2, 4, 3, 5, 6]} />
      </div>
      <SalesChart />
      <div className={s.widgets}>
        <PackingQueue orders={orders} />
        <RunningLow />
        <SalesSources />
      </div>
    </div>
  );
}
