'use client';

import { useMemo, useState } from 'react';
import { commitAccountCsvImport, previewAccountCsvImport, type ImportPreview } from '../../lib/accounts/bulkApi';

type Props = {
  open: boolean;
  onClose: () => void;
  onImported?: () => void;
  facilityId?: string | null;
};

export function AccountCsvImportDrawer({ open, onClose, onImported, facilityId }: Props) {
  const [csvText, setCsvText] = useState('');
  const [reason, setReason] = useState('');
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const canPreview = useMemo(() => csvText.trim().length > 0 && !busy, [csvText, busy]);
  const canCommit = useMemo(
    () => Boolean(preview && preview.invalidRows === 0 && preview.validRows > 0 && reason.trim().length >= 8 && !busy),
    [preview, reason, busy],
  );

  if (!open) return null;

  async function runPreview() {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const result = await previewAccountCsvImport(csvText, facilityId);
      setPreview(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'CSV preview failed');
    } finally {
      setBusy(false);
    }
  }

  async function commit() {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const result = await commitAccountCsvImport({
        csvText,
        reason: reason.trim(),
        facilityId: facilityId ?? null,
        idempotencyKey: crypto.randomUUID(),
      });
      setMessage(`Import completed: ${result.created} created, ${result.updated} updated.`);
      setCsvText('');
      setReason('');
      setPreview(null);
      onImported?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'CSV import failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/30">
      <aside className="ml-auto h-full w-full max-w-2xl overflow-auto bg-white p-6 shadow-xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold text-slate-950">Import accounts by CSV</h2>
            <p className="mt-1 text-sm text-slate-600">Preview first. Commit only after validation passes.</p>
          </div>
          <button className="rounded-xl border px-3 py-2 text-sm" onClick={onClose} type="button">
            Close
          </button>
        </div>

        <div className="mt-5 rounded-xl bg-slate-50 p-3 text-sm text-slate-700">
          Required columns: <code>email, displayName, role</code>. Optional: <code>facilityCode, phone, externalReference</code>.
        </div>

        <label className="mt-5 block text-sm font-medium text-slate-700">
          CSV content
          <textarea
            className="mt-2 min-h-[240px] w-full rounded-xl border p-3 font-mono text-sm"
            value={csvText}
            onChange={(event) => setCsvText(event.target.value)}
            placeholder={'email,displayName,role\ndoctor@example.test,Doctor One,DOCTOR'}
          />
        </label>

        <div className="mt-4 flex gap-2">
          <button className="rounded-xl border px-4 py-2 text-sm font-semibold" disabled={!canPreview} onClick={runPreview} type="button">
            {busy ? 'Checking…' : 'Preview'}
          </button>
        </div>

        {preview ? (
          <div className="mt-5 rounded-2xl border p-4">
            <h3 className="font-semibold text-slate-900">Preview result</h3>
            <div className="mt-3 grid grid-cols-3 gap-3 text-sm">
              <Metric label="Total rows" value={preview.totalRows} />
              <Metric label="Valid" value={preview.validRows} />
              <Metric label="Invalid" value={preview.invalidRows} />
            </div>

            {preview.issues.length > 0 ? (
              <div className="mt-4 max-h-48 overflow-auto rounded-xl bg-red-50 p-3 text-sm text-red-800">
                {preview.issues.slice(0, 50).map((issue, index) => (
                  <p key={`${issue.rowNumber}-${issue.code}-${index}`}>
                    Row {issue.rowNumber}: {issue.message}
                  </p>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}

        <label className="mt-5 block text-sm font-medium text-slate-700">
          Commit reason
          <input
            className="mt-2 w-full rounded-xl border px-3 py-2"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="Example: onboarding approved April batch"
          />
        </label>

        <button
          className="mt-4 rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
          disabled={!canCommit}
          onClick={commit}
          type="button"
        >
          Commit import
        </button>

        {message ? <p className="mt-3 text-sm text-emerald-700">{message}</p> : null}
        {error ? <p className="mt-3 text-sm text-red-700">{error}</p> : null}
      </aside>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl bg-slate-50 p-3">
      <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-lg font-semibold text-slate-950">{value}</p>
    </div>
  );
}
