export type FetchJsonResult<T> = {
  data: T | null;
  ok: boolean;
  status: number;
  degraded: boolean;
  error: string | null;
};

export async function fetchJsonWithTimeout<T>(
  input: RequestInfo | URL,
  init: RequestInit & { timeoutMs?: number } = {},
): Promise<FetchJsonResult<T>> {
  const timeoutMs = init.timeoutMs ?? 8000;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(input, {
      ...init,
      signal: controller.signal,
      cache: init.cache ?? 'no-store',
    });

    const data = response.headers.get('content-type')?.includes('application/json')
      ? ((await response.json()) as T)
      : null;

    return {
      data,
      ok: response.ok,
      status: response.status,
      degraded: !response.ok,
      error: response.ok ? null : `Request failed with status ${response.status}`,
    };
  } catch (error) {
    return {
      data: null,
      ok: false,
      status: 0,
      degraded: true,
      error: error instanceof Error ? error.message : 'Request failed',
    };
  } finally {
    clearTimeout(timer);
  }
}
