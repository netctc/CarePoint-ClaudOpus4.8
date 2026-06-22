import type { AdminRole } from '@/lib/rbac/roles';

export type AdminSession = {
  id: string;
  name: string;
  email: string;
  role: AdminRole;
  orgName: string;
  mfaEnabled: boolean;
};

export const MOCK_ADMIN_SESSION: AdminSession = {
  id: 'admin-001',
  name: 'Sarah Malik',
  email: 'sarah.malik@platform.example',
  role: 'super_admin',
  orgName: 'CarePoint Platform Operations',
  mfaEnabled: true
};
