'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { DeviceApprovalGate } from '@/components/admin/device-approval-gate';

/**
 * Portal entry page — shows device approval checkboxes before granting
 * access to the admin dashboard. If already approved in the current session,
 * redirects directly to the dashboard.
 */
export default function PortalIndexPage() {
  const router = useRouter();
  const [showGate, setShowGate] = useState(false);

  useEffect(() => {
    try {
      const approved = sessionStorage.getItem('cp_admin_device_approved');
      if (approved === '1') {
        router.replace('/portal/dashboard');
        return;
      }
    } catch {
      // sessionStorage unavailable — show the gate
    }
    setShowGate(true);
  }, [router]);

  if (!showGate) return null;

  return <DeviceApprovalGate />;
}
