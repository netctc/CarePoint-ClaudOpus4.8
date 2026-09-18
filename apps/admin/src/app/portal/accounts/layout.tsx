import type { ReactNode } from 'react';

export default function AccountsLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <div
        role="status"
        style={{
          margin: '0 0 16px',
          padding: '12px 16px',
          border: '1px solid var(--border-subtle, #d6dbe3)',
          borderRadius: 12,
          background: 'var(--surface-subtle, #f7f8fa)',
          fontSize: 14,
          lineHeight: 1.5,
        }}
      >
        <strong>Release account security policy:</strong>{' '}
        every newly created or imported account requires an explicit unique temporary password of at least 16 characters. There is no supported platform default. Any legacy optional/default wording or template value shown below is rejected by the release API and must not be reused.
      </div>
      {children}
    </>
  );
}
