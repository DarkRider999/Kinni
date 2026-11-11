import { navigate } from '../../router';
import { config } from '../../config';
import type { RouteId } from '../../types';
import styles from './Sidebar.module.css';

interface NavItem {
  id: RouteId;
  label: string;
  badge?: number | string;
  icon: string;
}

const SHOP_ITEMS: NavItem[] = [
  { id: 'home', label: 'Dashboard', icon: '▤' },
  { id: 'orders', label: 'Orders', badge: 3, icon: '📦' },
  { id: 'products', label: 'Products', badge: '+4', icon: '🏷' },
  { id: 'analytics', label: 'Analytics', icon: '📈' },
  { id: 'customers', label: 'Customers', icon: '👥' },
];
const MONEY_ITEMS: NavItem[] = [
  { id: 'finances', label: 'Finances', icon: '💳' },
  { id: 'invoices', label: 'Invoices', icon: '🧾' },
  { id: 'discounts', label: 'Discounts', icon: '🏷' },
];
const TALK_ITEMS: NavItem[] = [
  { id: 'chats', label: 'Chats', badge: 1, icon: '💬' },
  { id: 'email', label: 'Email', badge: 2, icon: '✉️' },
  { id: 'apps', label: 'Apps', icon: '⚙️' },
];

interface Props {
  route: RouteId;
  dark: boolean;
  onToggleDark: () => void;
}

function NavLink({ item, active }: { item: NavItem; active: boolean }) {
  return (
    <button
      className={`${styles.navLink} ${active ? styles.navLinkActive : ''}`}
      onClick={() => navigate(item.id)}
    >
      <span className={styles.navIcon}>{item.icon}</span>
      <span className={styles.navLabel}>{item.label}</span>
      {item.badge !== undefined && (
        <span className={`${styles.navBadge} ${active ? styles.navBadgeActive : ''}`}>
          {item.badge}
        </span>
      )}
    </button>
  );
}

export default function Sidebar({ route, dark, onToggleDark }: Props) {
  return (
    <aside className={styles.sidebar}>
      {/* Logo */}
      <div className={styles.logo}>
        <div className={styles.logoIcon}>
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <rect width="18" height="18" rx="5" fill="#3B82F6" />
            <path d="M4 9h10M9 4v10" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </div>
        <div className={styles.logoText}>
          <span className={styles.logoApp}>{config.appName}</span>
          <span className={styles.logoStore}>{config.storeName}</span>
        </div>
        <button className={`btn btn--ghost btn--icon btn--sm ${styles.logoSettings}`} title="Settings">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="3" />
            <path d="M12 2v3M12 19v3M4.22 4.22l2.12 2.12M17.66 17.66l2.12 2.12M2 12h3M19 12h3M4.22 19.78l2.12-2.12M17.66 6.34l2.12-2.12" />
          </svg>
        </button>
      </div>

      {/* Search */}
      <div className={styles.search}>
        <svg className={styles.searchIcon} width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
        </svg>
        <input className={styles.searchInput} placeholder="Search…" />
        <span className={styles.searchKbd}>⌘K</span>
      </div>

      {/* Nav */}
      <nav className={styles.nav}>
        <span className={styles.sectionLabel}>SHOP</span>
        {SHOP_ITEMS.map((item) => (
          <NavLink key={item.id} item={item} active={route === item.id} />
        ))}

        <span className={styles.sectionLabel}>MONEY</span>
        {MONEY_ITEMS.map((item) => (
          <NavLink key={item.id} item={item} active={route === item.id} />
        ))}

        <span className={styles.sectionLabel}>TALK</span>
        {TALK_ITEMS.map((item) => (
          <NavLink key={item.id} item={item} active={route === item.id} />
        ))}

        <div className={styles.divider} />
        <NavLink item={{ id: 'settings', label: 'Settings', icon: '⚙️' }} active={route === 'settings'} />
      </nav>

      {/* Footer */}
      <div className={styles.footer}>
        <div className={styles.darkToggleRow}>
          <span className={styles.darkLabel}>Dark mode</span>
          <button
            className={`switch ${dark ? 'is-on' : ''}`}
            onClick={onToggleDark}
            aria-label="Toggle dark mode"
          />
        </div>
        <div className={styles.user}>
          <div className={`avatar ${styles.userAvatar}`} style={{ background: '#3B82F6' }}>
            {config.userName.split(' ').map((n) => n[0]).join('')}
          </div>
          <div className={styles.userInfo}>
            <span className={styles.userName}>{config.userName}</span>
            <span className={styles.userEmail}>{config.userEmail}</span>
          </div>
          <span className={`badge badge--blue ${styles.userBadge}`}>11</span>
        </div>
      </div>
    </aside>
  );
}
