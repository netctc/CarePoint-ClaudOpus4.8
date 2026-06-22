export type AccountSortBy = 'createdAt' | 'email' | 'firstName' | 'lastName' | 'role' | 'status';
export type SortDirection = 'asc' | 'desc';

export interface NormalizedAccountListQuery {
  page: number;
  pageSize: number;
  skip: number;
  take: number;
  q?: string;
  role?: string;
  status?: string;
  organizationId?: string;
  sortBy: AccountSortBy;
  sortDir: SortDirection;
}

export interface AccountListPage<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  sortBy: AccountSortBy;
  sortDir: SortDirection;
}

const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = 25;
const MAX_PAGE_SIZE = 100;
const SORTABLE_FIELDS = new Set<AccountSortBy>(['createdAt', 'email', 'firstName', 'lastName', 'role', 'status']);

function readString(value: unknown): string | undefined {
  if (Array.isArray(value)) return readString(value[0]);
  if (value == null) return undefined;
  const text = String(value).trim();
  return text.length > 0 ? text : undefined;
}

function readPositiveInteger(value: unknown, fallback: number, max?: number): number {
  const parsed = Number.parseInt(readString(value) ?? '', 10);
  if (!Number.isFinite(parsed) || parsed < 1) return fallback;
  return Math.min(parsed, max ?? parsed);
}

function normalizeSortBy(value: unknown): AccountSortBy {
  const candidate = readString(value) as AccountSortBy | undefined;
  if (candidate && SORTABLE_FIELDS.has(candidate)) return candidate;
  return 'createdAt';
}

function normalizeSortDir(value: unknown): SortDirection {
  return readString(value)?.toLowerCase() === 'asc' ? 'asc' : 'desc';
}

export function normalizeAccountListQuery(query: Record<string, unknown>): NormalizedAccountListQuery {
  const page = readPositiveInteger(query.page, DEFAULT_PAGE);
  const pageSize = readPositiveInteger(query.pageSize ?? query.limit, DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE);
  const sortBy = normalizeSortBy(query.sortBy);
  const sortDir = normalizeSortDir(query.sortDir);

  return {
    page,
    pageSize,
    skip: (page - 1) * pageSize,
    take: pageSize,
    q: readString(query.q ?? query.search),
    role: readString(query.role),
    status: readString(query.status),
    organizationId: readString(query.organizationId),
    sortBy,
    sortDir,
  };
}

export function buildAccountListPage<T>(params: {
  items: T[];
  total: number;
  query: NormalizedAccountListQuery;
}): AccountListPage<T> {
  const totalPages = Math.max(1, Math.ceil(params.total / params.query.pageSize));
  return {
    items: params.items,
    page: params.query.page,
    pageSize: params.query.pageSize,
    total: params.total,
    totalPages,
    hasNextPage: params.query.page < totalPages,
    hasPreviousPage: params.query.page > 1,
    sortBy: params.query.sortBy,
    sortDir: params.query.sortDir,
  };
}

export function buildAccountSearchWhere(query: NormalizedAccountListQuery, forcedOrganizationId?: string) {
  const where: Record<string, unknown> = {};
  const organizationId = forcedOrganizationId ?? query.organizationId;

  if (organizationId) where.organizationId = organizationId;
  if (query.role) where.role = query.role;
  if (query.status) where.status = query.status;

  if (query.q) {
    where.OR = [
      { email: { contains: query.q, mode: 'insensitive' } },
      { firstName: { contains: query.q, mode: 'insensitive' } },
      { lastName: { contains: query.q, mode: 'insensitive' } },
    ];
  }

  return where;
}

export function buildAccountOrderBy(query: NormalizedAccountListQuery) {
  return [{ [query.sortBy]: query.sortDir }, { id: 'asc' }];
}
