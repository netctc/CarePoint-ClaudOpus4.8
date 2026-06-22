import type { ButtonHTMLAttributes, ReactNode } from 'react';

export type ProviderTone = 'default' | 'primary' | 'success' | 'warning' | 'danger' | 'neutral';

function cx(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(' ');
}

export function ProviderPageHeader({
  eyebrow,
  title,
  description,
  actions,
  className,
}: {
  eyebrow?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <header className={cx('cp-provider-v12-page-header', className)}>
      <div className="cp-provider-v12-page-header__copy">
        {eyebrow ? <span className="cp-provider-v12-eyebrow">{eyebrow}</span> : null}
        <h1>{title}</h1>
        {description ? <p>{description}</p> : null}
      </div>
      {actions ? <div className="cp-provider-v12-page-header__actions">{actions}</div> : null}
    </header>
  );
}

export function ProviderSectionCard({
  title,
  description,
  actions,
  children,
  className,
}: {
  title?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cx('cp-provider-v12-card', className)}>
      {title || description || actions ? (
        <div className="cp-provider-v12-card__header">
          <div>
            {title ? <h2>{title}</h2> : null}
            {description ? <p>{description}</p> : null}
          </div>
          {actions ? <div className="cp-provider-v12-card__actions">{actions}</div> : null}
        </div>
      ) : null}
      {children}
    </section>
  );
}

export function ProviderKpiCard({
  label,
  value,
  detail,
  badge,
  tone = 'default',
  children,
}: {
  label: ReactNode;
  value: ReactNode;
  detail?: ReactNode;
  badge?: ReactNode;
  tone?: ProviderTone;
  children?: ReactNode;
}) {
  return (
    <article className={cx('cp-provider-v12-kpi', `cp-provider-v12-kpi--${tone}`)}>
      <div className="cp-provider-v12-kpi__topline">
        <span>{label}</span>
        {badge ? <strong>{badge}</strong> : null}
      </div>
      <div className="cp-provider-v12-kpi__value">{value}</div>
      {detail ? <p>{detail}</p> : null}
      {children ? <div className="cp-provider-v12-kpi__body">{children}</div> : null}
    </article>
  );
}

export function ProviderActionButton({
  children,
  tone = 'default',
  type = 'button',
  className,
  ...props
}: {
  children: ReactNode;
  tone?: ProviderTone;
  type?: 'button' | 'submit' | 'reset';
  className?: string;
} & Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'className' | 'type'>) {
  return (
    <button type={type} className={cx('cp-provider-v12-button', `cp-provider-v12-button--${tone}`, className)} {...props}>
      {children}
    </button>
  );
}

export function ProviderStatusPill({ children, tone = 'neutral' }: { children: ReactNode; tone?: ProviderTone }) {
  return <span className={cx('cp-provider-v12-pill', `cp-provider-v12-pill--${tone}`)}>{children}</span>;
}

export function ProviderTable({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className="cp-provider-v12-table-wrap">
      <table className={cx('cp-provider-v12-table', className)}>{children}</table>
    </div>
  );
}

export function ProviderGrid({ children, columns = 3, className }: { children: ReactNode; columns?: 1 | 2 | 3 | 4; className?: string }) {
  return <div className={cx('cp-provider-v12-grid', `cp-provider-v12-grid--${columns}`, className)}>{children}</div>;
}
