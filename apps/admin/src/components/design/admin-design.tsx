import type { ButtonHTMLAttributes, ReactNode } from 'react';

export type AdminTone = 'default' | 'primary' | 'success' | 'warning' | 'danger' | 'neutral';

function cx(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(' ');
}

export function AdminPageHeader({
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
    <header className={cx('cp-admin-v12-page-header', className)}>
      <div className="cp-admin-v12-page-header__copy">
        {eyebrow ? <span className="cp-admin-v12-eyebrow">{eyebrow}</span> : null}
        <h1>{title}</h1>
        {description ? <p>{description}</p> : null}
      </div>
      {actions ? <div className="cp-admin-v12-page-header__actions">{actions}</div> : null}
    </header>
  );
}

export function AdminSectionCard({
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
    <section className={cx('cp-admin-v12-card', className)}>
      {title || description || actions ? (
        <div className="cp-admin-v12-card__header">
          <div>
            {title ? <h2>{title}</h2> : null}
            {description ? <p>{description}</p> : null}
          </div>
          {actions ? <div className="cp-admin-v12-card__actions">{actions}</div> : null}
        </div>
      ) : null}
      {children}
    </section>
  );
}

export function AdminKpiCard({
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
  tone?: AdminTone;
  children?: ReactNode;
}) {
  return (
    <article className={cx('cp-admin-v12-kpi', `cp-admin-v12-kpi--${tone}`)}>
      <div className="cp-admin-v12-kpi__topline">
        <span>{label}</span>
        {badge ? <strong>{badge}</strong> : null}
      </div>
      <div className="cp-admin-v12-kpi__value">{value}</div>
      {detail ? <p>{detail}</p> : null}
      {children ? <div className="cp-admin-v12-kpi__body">{children}</div> : null}
    </article>
  );
}

export function AdminActionButton({
  children,
  tone = 'default',
  type = 'button',
  className,
  ...props
}: {
  children: ReactNode;
  tone?: AdminTone;
  type?: 'button' | 'submit' | 'reset';
  className?: string;
} & Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'className' | 'type'>) {
  return (
    <button type={type} className={cx('cp-admin-v12-button', `cp-admin-v12-button--${tone}`, className)} {...props}>
      {children}
    </button>
  );
}

export function AdminStatusPill({ children, tone = 'neutral' }: { children: ReactNode; tone?: AdminTone }) {
  return <span className={cx('cp-admin-v12-pill', `cp-admin-v12-pill--${tone}`)}>{children}</span>;
}

export function AdminTable({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className="cp-admin-v12-table-wrap">
      <table className={cx('cp-admin-v12-table', className)}>{children}</table>
    </div>
  );
}

export function AdminGrid({ children, columns = 3, className }: { children: ReactNode; columns?: 1 | 2 | 3 | 4; className?: string }) {
  return <div className={cx('cp-admin-v12-grid', `cp-admin-v12-grid--${columns}`, className)}>{children}</div>;
}
