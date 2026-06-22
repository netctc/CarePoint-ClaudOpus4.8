import type { AdminRole } from '@/lib/rbac/roles';

const DATE_TIME_FORMATTER = new Intl.DateTimeFormat('en-GB', {
  year: 'numeric',
  month: 'short',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
  timeZone: 'UTC',
});

export function formatUtcDateTime(value: string | null | undefined): string {
  if (!value) return '—';

  const normalized = value.includes('T') ? value : value.replace(' ', 'T');
  const date = new Date(normalized);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return `${DATE_TIME_FORMATTER.format(date)} UTC`;
}

export function formatAdminRole(role: AdminRole): string {
  switch (role) {
    case 'super_admin':
      return 'Super Admin';
    case 'ops_admin':
      return 'Operations Admin';
    case 'provider_reviewer':
      return 'Provider Reviewer';
    case 'finance_admin':
      return 'Finance Admin';
    case 'support_admin':
      return 'Support Admin';
    case 'safety_admin':
      return 'Safety Admin';
    case 'readonly_auditor':
      return 'Read-only Auditor';
    default:
      return role;
  }
}
