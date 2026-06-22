export type AccountBulkOperation = 'DEACTIVATE' | 'REACTIVATE' | 'LOCK' | 'UNLOCK';

export type BulkStatusPayload = {
  accountIds: string[];
  operation: AccountBulkOperation;
  reason: string;
  facilityId?: string | null;
};

export type ImportPreviewIssue = {
  rowNumber: number;
  field?: string;
  code: string;
  message: string;
};

export type ImportPreview = {
  totalRows: number;
  validRows: number;
  invalidRows: number;
  duplicateEmails: string[];
  issues: ImportPreviewIssue[];
  normalizedRows: Array<Record<string, unknown>>;
};

const JSON_HEADERS = { 'Content-Type': 'application/json' };

export async function runAccountBulkStatus(payload: BulkStatusPayload) {
  const response = await fetch('/api/admin/accounts/bulk/status', {
    method: 'POST',
    headers: JSON_HEADERS,
    credentials: 'include',
    body: JSON.stringify(payload),
  });

  return readJsonOrThrow(response);
}

export async function previewAccountCsvImport(csvText: string, facilityId?: string | null): Promise<ImportPreview> {
  const response = await fetch('/api/admin/accounts/import/preview', {
    method: 'POST',
    headers: JSON_HEADERS,
    credentials: 'include',
    body: JSON.stringify({ csvText, dryRun: true, facilityId: facilityId ?? null }),
  });

  return readJsonOrThrow(response);
}

export async function commitAccountCsvImport(args: {
  csvText: string;
  idempotencyKey: string;
  reason: string;
  facilityId?: string | null;
}) {
  const response = await fetch('/api/admin/accounts/import/commit', {
    method: 'POST',
    headers: JSON_HEADERS,
    credentials: 'include',
    body: JSON.stringify({
      csvText: args.csvText,
      idempotencyKey: args.idempotencyKey,
      reason: args.reason,
      facilityId: args.facilityId ?? null,
    }),
  });

  return readJsonOrThrow(response);
}

export function buildAccountsExportUrl(filters: Record<string, string | undefined | null>) {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value) params.set(key, value);
  });
  const query = params.toString();
  return `/api/admin/accounts/export${query ? `?${query}` : ''}`;
}

async function readJsonOrThrow(response: Response) {
  const text = await response.text();
  const payload = text ? JSON.parse(text) : null;
  if (!response.ok) {
    const message = payload?.error ?? payload?.message ?? `Request failed with ${response.status}`;
    throw new Error(message);
  }
  return payload;
}
