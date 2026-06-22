import React from 'react';

export function AccountStatusBadgeExample({ status }: { status?: string | null }) {
  const normalized = (status || 'ACTIVE').toUpperCase();
  const isActive = normalized === 'ACTIVE';
  const isDisabled = normalized === 'DISABLED' || normalized === 'INACTIVE' || normalized === 'SUSPENDED';

  const className = isActive
    ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
    : isDisabled
      ? 'border-red-200 bg-red-50 text-red-700'
      : 'border-slate-200 bg-slate-50 text-slate-700';

  return <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${className}`}>{normalized}</span>;
}
