/**
 * Customise the dashboard here: store identity, the signed-in user and the
 * accent colour. `accentColor` is applied to the `--blue` CSS variable family
 * at startup (see main.tsx), so every primary button, chart and highlight
 * follows it.
 */
export const config = {
  storeName: 'Kin & Leaf',
  appName: 'Cirrel',
  userName: 'Noor Haddad',
  userEmail: 'noor@kiandleaf.co',
  currency: 'USD',
  accentColor: '#3B82F6',
  /** Date the demo data is anchored to (shown in the header breadcrumb). */
  reportDate: 'Sunday, November 1',
};

export const formatMoney = (value: number, fractionDigits = 0): string =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: config.currency,
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(value);

export const initials = (name: string): string =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');

export const firstName = (name: string): string => name.split(/\s+/)[0] ?? name;
