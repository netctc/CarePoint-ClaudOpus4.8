export interface AccountMutationErrorPayload {
  error?: string;
  code?: string;
  details?: unknown;
}

export interface AccountMutationRequestOptions {
  apiBaseUrl?: string;
  token?: string;
  headers?: Record<string, string>;
}

export interface AccountMutationResult<T> {
  item: T;
  audit?: {
    attempted: boolean;
    written: boolean;
    error?: string;
  };
}

export interface AccountMutationInput {
  email?: string;
  firstName?: string;
  lastName?: string;
  role?: string;
  status?: string;
  organizationId?: string;
  phone?: string | null;
  locale?: string | null;
}

export class AccountMutationError extends Error {
  status: number;
  code?: string;
  details?: unknown;

  constructor(message: string, status: number, payload?: AccountMutationErrorPayload) {
    super(message);
    this.name = 'AccountMutationError';
    this.status = status;
    this.code = payload?.code;
    this.details = payload?.details;
  }
}

function baseUrl(options?: AccountMutationRequestOptions): string {
  return options?.apiBaseUrl?.replace(/\/$/, '') || '';
}

function mutationHeaders(options?: AccountMutationRequestOptions): HeadersInit {
  return {
    'Content-Type': 'application/json',
    ...(options?.token ? { Authorization: `Bearer ${options.token}` } : {}),
    ...(options?.headers ?? {}),
  };
}

async function readJsonSafe(response: Response): Promise<any> {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return { error: text };
  }
}

async function requestAccountMutation<T>(
  path: string,
  init: RequestInit,
  options?: AccountMutationRequestOptions,
): Promise<AccountMutationResult<T>> {
  const response = await fetch(`${baseUrl(options)}${path}`, {
    ...init,
    headers: mutationHeaders(options),
  });
  const payload = await readJsonSafe(response);

  if (!response.ok) {
    throw new AccountMutationError(payload?.error || `Account mutation failed with status ${response.status}`, response.status, payload);
  }

  return payload as AccountMutationResult<T>;
}

export function createAccount<T>(input: Required<Pick<AccountMutationInput, 'email' | 'role'>> & AccountMutationInput, options?: AccountMutationRequestOptions) {
  return requestAccountMutation<T>('/api/admin/accounts', { method: 'POST', body: JSON.stringify(input) }, options);
}

export function updateAccount<T>(accountId: string, input: AccountMutationInput, options?: AccountMutationRequestOptions) {
  return requestAccountMutation<T>(`/api/admin/accounts/${encodeURIComponent(accountId)}`, { method: 'PATCH', body: JSON.stringify(input) }, options);
}

export function deactivateAccount<T>(accountId: string, reason?: string, options?: AccountMutationRequestOptions) {
  return requestAccountMutation<T>(
    `/api/admin/accounts/${encodeURIComponent(accountId)}/deactivate`,
    { method: 'POST', body: JSON.stringify({ reason }) },
    options,
  );
}

export function reactivateAccount<T>(accountId: string, reason?: string, options?: AccountMutationRequestOptions) {
  return requestAccountMutation<T>(
    `/api/admin/accounts/${encodeURIComponent(accountId)}/reactivate`,
    { method: 'POST', body: JSON.stringify({ reason }) },
    options,
  );
}

export function deleteAccount<T>(accountId: string, options?: AccountMutationRequestOptions) {
  return requestAccountMutation<T>(`/api/admin/accounts/${encodeURIComponent(accountId)}`, { method: 'DELETE' }, options);
}

export function accountMutationErrorMessage(error: unknown): string {
  if (error instanceof AccountMutationError) {
    if (error.code) return `${error.message} (${error.code})`;
    return error.message;
  }
  if (error instanceof Error) return error.message;
  return 'Unexpected account mutation error.';
}
