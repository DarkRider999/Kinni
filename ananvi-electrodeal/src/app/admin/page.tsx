import { BarChart3, Package, Tag, Users, TrendingUp, AlertTriangle, CheckCircle, RefreshCw } from 'lucide-react';
import Navbar from '@/components/layout/Navbar';
import Footer from '@/components/layout/Footer';

export const metadata = { title: 'Admin Dashboard | ANANVI ElectroDeal' };

const stats = [
  { label: 'Total Products', value: '52,841', delta: '+1,204 this week', positive: true, icon: Package },
  { label: 'Active Coupons', value: '347', delta: '+18 today', positive: true, icon: Tag },
  { label: 'Registered Users', value: '108,320', delta: '+2,350 this week', positive: true, icon: Users },
  { label: 'Price Updates / Day', value: '1.2M', delta: 'Last run: 3 min ago', positive: true, icon: RefreshCw },
];

const recentAlerts = [
  { type: 'error', msg: 'Noon.com scraper returned 403 — rate limited', time: '12 min ago' },
  { type: 'warning', msg: 'Coupon SAVE150AED success rate dropped below 60%', time: '1 hour ago' },
  { type: 'success', msg: 'Amazon.ae price sync completed — 9,420 products updated', time: '3 hours ago' },
  { type: 'success', msg: 'AI research module processed 142 queries today', time: '5 hours ago' },
  { type: 'warning', msg: 'Sharaf DG product images CDN latency spike detected', time: '6 hours ago' },
];

const retailers = [
  { name: 'Amazon.ae', products: 18240, lastSync: '5 min ago', status: 'active' },
  { name: 'Noon.com', products: 14890, lastSync: '14 min ago', status: 'error' },
  { name: 'Sharaf DG', products: 8320, lastSync: '8 min ago', status: 'active' },
  { name: 'Jumbo Electronics', products: 4210, lastSync: '11 min ago', status: 'active' },
  { name: 'Carrefour UAE', products: 3980, lastSync: '9 min ago', status: 'active' },
  { name: 'Revibe', products: 2140, lastSync: '7 min ago', status: 'active' },
];

const alertColors = {
  error: 'text-red-400 bg-red-400/10 border-red-400/20',
  warning: 'text-yellow-400 bg-yellow-400/10 border-yellow-400/20',
  success: 'text-green-400 bg-green-400/10 border-green-400/20',
};

export default function AdminPage() {
  return (
    <main className="min-h-screen bg-navy-950 pt-20">
      <Navbar />

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-16">
        <div className="mb-10 flex items-center justify-between flex-wrap gap-4">
          <div>
            <p className="text-xs font-mono text-electric-cyan uppercase tracking-widest mb-1">Control Center</p>
            <h1 className="font-display font-black text-4xl text-white">Admin Dashboard</h1>
          </div>
          <span className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-green-400/10 border border-green-400/20 text-xs font-mono text-green-400">
            <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
            All systems operational
          </span>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
          {stats.map(({ label, value, delta, positive, icon: Icon }) => (
            <div key={label} className="glass-card rounded-xl p-5 border border-white/8">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-mono text-silver-500 uppercase tracking-wider">{label}</span>
                <Icon size={14} className="text-electric-cyan" />
              </div>
              <p className="font-display font-black text-2xl text-white mb-1">{value}</p>
              <p className={`text-xs font-mono ${positive ? 'text-green-400' : 'text-red-400'}`}>{delta}</p>
            </div>
          ))}
        </div>

        <div className="grid lg:grid-cols-2 gap-6 mb-10">
          {/* Retailer status */}
          <div className="glass-card rounded-2xl border border-white/8 overflow-hidden">
            <div className="p-4 border-b border-white/5 flex items-center justify-between">
              <h2 className="font-display font-bold text-sm text-white">Retailer Sync Status</h2>
              <span className="text-xs font-mono text-silver-500">6 retailers</span>
            </div>
            <div className="divide-y divide-white/5">
              {retailers.map((r) => (
                <div key={r.name} className="flex items-center gap-3 p-3">
                  <span className={`w-2 h-2 rounded-full flex-shrink-0 ${r.status === 'active' ? 'bg-green-400' : 'bg-red-400'}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white font-medium">{r.name}</p>
                    <p className="text-xs font-mono text-silver-500">{r.products.toLocaleString()} products</p>
                  </div>
                  <span className="text-xs font-mono text-silver-600 whitespace-nowrap">{r.lastSync}</span>
                </div>
              ))}
            </div>
          </div>

          {/* System alerts */}
          <div className="glass-card rounded-2xl border border-white/8 overflow-hidden">
            <div className="p-4 border-b border-white/5 flex items-center justify-between">
              <h2 className="font-display font-bold text-sm text-white">System Alerts</h2>
              <AlertTriangle size={14} className="text-yellow-400" />
            </div>
            <div className="divide-y divide-white/5">
              {recentAlerts.map((a, i) => (
                <div key={i} className="p-3 flex items-start gap-3">
                  <span className={`mt-0.5 px-1.5 py-0.5 rounded text-xs font-mono border ${alertColors[a.type as keyof typeof alertColors]}`}>
                    {a.type}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-silver-300 leading-relaxed">{a.msg}</p>
                    <p className="text-xs text-silver-600 mt-0.5">{a.time}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Quick actions */}
        <div>
          <h2 className="font-display font-bold text-white text-sm mb-4">Quick Actions</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'Force Sync All', icon: RefreshCw, color: 'text-electric-cyan' },
              { label: 'Add Coupon', icon: Tag, color: 'text-green-400' },
              { label: 'View Reports', icon: BarChart3, color: 'text-purple-400' },
              { label: 'Manage Users', icon: Users, color: 'text-pink-400' },
            ].map(({ label, icon: Icon, color }) => (
              <button key={label} className="glass-card rounded-xl p-4 border border-white/8 hover:border-electric-blue/30 transition-colors flex flex-col items-center gap-2 group">
                <Icon size={18} className={`${color} group-hover:scale-110 transition-transform`} />
                <span className="text-xs font-mono text-silver-400">{label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      <Footer />
    </main>
  );
}
