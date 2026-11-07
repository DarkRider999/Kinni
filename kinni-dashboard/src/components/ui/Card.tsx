import type { HTMLAttributes, ReactNode } from 'react';

interface CardProps extends Omit<HTMLAttributes<HTMLElement>, 'title'> {
  title?: ReactNode;
  subtitle?: ReactNode;
  action?: ReactNode;
  children?: ReactNode;
}

export function Card({ title, subtitle, action, children, className = '', ...rest }: CardProps) {
  const hasHead = title !== undefined || subtitle !== undefined || action !== undefined;
  return (
    <section className={`card ${className}`.trim()} {...rest}>
      {hasHead && (
        <header className="card-head">
          <div>
            {title !== undefined && <h3 className="card-title">{title}</h3>}
            {subtitle !== undefined && <div className="card-sub">{subtitle}</div>}
          </div>
          {action}
        </header>
      )}
      {children}
    </section>
  );
}
