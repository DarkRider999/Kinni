import { config } from '../../config';
import styles from './Header.module.css';

interface Props {
  pageLabel: string;
}

export default function Header({ pageLabel }: Props) {
  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  })();

  return (
    <header className={styles.header}>
      <div className={styles.left}>
        <h1 className={styles.greeting}>
          {greeting}, {config.userName.split(' ')[0]}
        </h1>
        <p className={styles.breadcrumb}>
          {config.reportDate}&nbsp;·&nbsp;{pageLabel}
        </p>
      </div>
      <div className={styles.actions}>
        <button className="btn btn--ghost btn--icon" title="Search">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
          </svg>
        </button>
        <button className="btn btn--ghost btn--icon" title="Notifications">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
            <path d="M13.73 21a2 2 0 0 1-3.46 0" />
          </svg>
        </button>
        <button className="btn btn--primary">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M12 5v14M5 12h14" />
          </svg>
          Create
        </button>
      </div>
    </header>
  );
}
