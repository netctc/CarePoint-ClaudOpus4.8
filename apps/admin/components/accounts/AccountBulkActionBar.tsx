'use client';

import { useMemo, useState } from 'react';
import { runAccountBulkStatus, type AccountBulkOperation } from '../../lib/accounts/bulkApi';

type Props = {
  selectedAccountIds: string[];
  onCompleted?: () => void;
  facilityId?: string | null;
};

const OPERATIONS: Array<{ value: AccountBulkOperation; label: string }> = [
  { value: 'DEACTIVATE', label: 'Deactivate' },
  { value: 'REACTIVATE', label: 'Reactivate' },
  { value: 'LOCK', label: 'Lock' },
  { value: 'UNLOCK', label: 'Unlock' },
];

export function AccountBulkActionBar({ selectedAccountIds, onCompleted, facilityId }: Props) {
  const [operation, setOperation] = useState<AccountBulkOperation>('DEACTIVATE');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = useMemo(
    () => selectedAccountIds.length > 0 && reason.trim().length >= 8 && !busy,
    [selectedAccountIds.length, reason, busy],
  );

  async function submit() {
    setBusy(true);
    setMessage(null);
    setError(null);
    try {
      const result = await runAccountBulkStatus({
        accountIds: selectedAccountIds,
        operation,
        reason: reason.trim(),
        facilityId: facilityId ?? null,
      });
      setMessage(`Bulk job ${result.jobId} completed: ${result.updated} updated, ${result.skipped?.length ?? 0} skipped.`);
      setReason('');
      onCompleted?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Bulk action failed');
    } finally {
      setBusy(false);
    }
  }

  if (selectedAccountIds.length === 0) return null;

  return (
    <section className="rounded-2xl border bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-sm font-semibold text-slate-900">Bulk account action</p>
          <p className="text-sm text-slate-600">{selectedAccountIds.length} account(s) selected. A reason is required for audit.</p>
        </div>

        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-slate-700">Operation</span>
          <select
            className="rounded-xl border px-3 py-2"
            value={operation}
            onChange={(event) => setOperation(event.target.value as AccountBulkOperation)}
          >
            {OPERATIONS.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </label>

        <label className="min-w-[280px] flex-1 text-sm">
          <span className="font-medium text-slate-700">Audit reason</span>
          <input
            className="mt-1 w-full rounded-xl border px-3 py-2"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="Example: requested by compliance team"
          />
        </label>

        <button
          className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
          disabled={!canSubmit}
          onClick={submit}
          type="button"
        >
          {busy ? 'Applying…' : 'Apply'}
        </button>
      </div>

      {message ? <p className="mt-3 text-sm text-emerald-700">{message}</p> : null}
      {error ? <p className="mt-3 text-sm text-red-700">{error}</p> : null}
    </section>
  );
}
