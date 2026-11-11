import type { ButtonHTMLAttributes, ReactNode } from 'react';

type Variant = 'primary' | 'ghost' | 'outline' | 'warn';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: 'sm' | 'md';
  icon?: ReactNode;
  /** Square icon-only button. */
  iconOnly?: boolean;
  active?: boolean;
}

export function Button({
  variant = 'ghost',
  size = 'md',
  icon,
  iconOnly = false,
  active = false,
  className = '',
  children,
  type = 'button',
  ...rest
}: ButtonProps) {
  const classes = [
    'btn',
    `btn--${variant}`,
    size === 'sm' ? 'btn--sm' : '',
    iconOnly ? 'btn--icon' : '',
    active ? 'btn--active' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');
  return (
    <button type={type} className={classes} {...rest}>
      {icon}
      {children}
    </button>
  );
}
