'use client';

import React from 'react';

export interface AccountListItem {
  id: string;
  email: string;
  name: string;
  role: string;
  status?: string | null;
  createdAt?: string | Date | null;
}

export interface VirtualizedAccountTableProps {
  items: AccountListItem[];
  onEdit?: (item: AccountListItem) => void;
  onDeactivate?: (item: AccountListItem) => void;
}

export function VirtualizedAccountTableExample({ items, onEdit, onDeactivate }: VirtualizedAccountTableProps) {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="grid grid-cols-[minmax(220px,1.4fr)_minmax(180px,1fr)_120px_120px] gap-4 border-b border-slate-200 bg-slate-50 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
        <div>Account</div>
        <div>Email</div>
        <div>Role</div>
        <div className="text-right">Actions</div>
      </div>
      <div className="max-h-[640px] overflow-auto">
        {items.map((item) => (
          <div
            key={item.id}
            className="grid grid-cols-[minmax(220px,1.4fr)_minmax(180px,1fr)_120px_120px] gap-4 border-b border-slate-100 px-4 py-3 text-sm last:border-b-0 hover:bg-slate-50"
          >
            <div className="min-w-0">
              <div className="truncate font-medium text-slate-900">{item.name || item.email}</div>
              <div className="text-xs text-slate-500">{item.status || 'Active'}</div>
            </div>
            <div className="truncate text-slate-600">{item.email}</div>
            <div className="text-slate-600">{item.role}</div>
            <div className="flex justify-end gap-2">
              <button className="rounded-lg border border-slate-200 px-3 py-1 text-xs" onClick={() => onEdit?.(item)}>
                Edit
              </button>
              <button className="rounded-lg border border-red-200 px-3 py-1 text-xs text-red-700" onClick={() => onDeactivate?.(item)}>
                Disable
              </button>
            </div>
          </div>
        ))}
        {items.length === 0 ? <div className="px-4 py-10 text-center text-sm text-slate-500">No accounts found.</div> : null}
      </div>
    </div>
  );
}
