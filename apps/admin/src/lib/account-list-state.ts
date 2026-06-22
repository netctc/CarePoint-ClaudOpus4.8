export type AccountSortBy = 'createdAt' | 'email' | 'firstName' | 'lastName' | 'role' | 'status';
export type SortDirection = 'asc' | 'desc';

export interface AccountListQueryState {
  page: number;
  pageSize: number;
  q: string;
  role: string;
  status: string;
  sortBy: AccountSortBy;
  sortDir: SortDirection;
}

export interface AccountListResponse<T> {
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

export const defaultAccountListQueryState: AccountListQueryState = {
  page: 1,
  pageSize: 25,
  q: '',
  role: '',
  status: '',
  sortBy: 'createdAt',
  sortDir: 'desc',
};

export function accountListQueryToSearchParams(state: AccountListQueryState): string {
  const params = new URLSearchParams();
  params.set('page', String(state.page));
  params.set('pageSize', String(state.pageSize));
  if (state.q.trim()) params.set('q', state.q.trim());
  if (state.role) params.set('role', state.role);
  if (state.status) params.set('status', state.status);
  params.set('sortBy', state.sortBy);
  params.set('sortDir', state.sortDir);
  return params.toString();
}

export function withAccountListFilterReset(
  state: AccountListQueryState,
  patch: Partial<AccountListQueryState>,
): AccountListQueryState {
  return { ...state, ...patch, page: 1 };
}

export function toggleAccountListSort(state: AccountListQueryState, sortBy: AccountSortBy): AccountListQueryState {
  if (state.sortBy === sortBy) {
    return { ...state, sortDir: state.sortDir === 'asc' ? 'desc' : 'asc', page: 1 };
  }
  return { ...state, sortBy, sortDir: 'asc', page: 1 };
}
