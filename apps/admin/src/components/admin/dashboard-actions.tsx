'use client';

import { useCallback, useState } from 'react';
import { LoadingButton } from '@/components/ui/loading-button';
import { useToast } from '@/components/ui/toast';
import { AdminIcon } from '@/components/ui/admin-icon';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:4000';

function getAccessToken(): string | undefined {
  const match = document.cookie.match(/(?:^|;\s*)cc_admin_access_token=([^;]*)/);
  if (match) return decodeURIComponent(match[1]);
  const fallback = document.cookie.match(/(?:^|;\s*)cc_access_token=([^;]*)/);
  return fallback ? decodeURIComponent(fallback[1]) : undefined;
}

async function apiPost(path: string, body: Record<string, unknown>): Promise<Response> {
  const token = getAccessToken();
  return fetch(`${API_BASE_URL}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
}

export function DashboardActions() {
  const { toast } = useToast();
  const [downloadLoading, setDownloadLoading] = useState(false);
  const [syncLoading, setSyncLoading] = useState(false);

  const handleDownloadReport = useCallback(async () => {
    setDownloadLoading(true);
    try {
      const response = await apiPost('/api/admin/reports/generate', { format: 'csv' });
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || `Request failed: ${response.status}`);
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `admin-report-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      URL.revokeObjectURL(url);

      toast({ variant: 'success', title: 'Report downloaded', description: 'CSV report generated successfully.' });
    } catch (error) {
      toast({
        variant: 'error',
        title: 'Download failed',
        description: error instanceof Error ? error.message : 'Could not generate report.',
        onRetry: handleDownloadReport,
      });
    } finally {
      setDownloadLoading(false);
    }
  }, [toast]);

  const handleSystemSync = useCallback(async () => {
    setSyncLoading(true);
    try {
      const response = await apiPost('/api/admin/system/sync', {});
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || `Request failed: ${response.status}`);
      }

      const data = await response.json();
      const syncedCount = data?.syncedCount ?? data?.data?.syncedCount;
      const description = syncedCount != null
        ? `System sync complete. ${syncedCount} records synced.`
        : 'System sync completed successfully.';

      toast({ variant: 'success', title: 'Sync complete', description });
    } catch (error) {
      toast({
        variant: 'error',
        title: 'Sync failed',
        description: error instanceof Error ? error.message : 'Could not complete system sync.',
        onRetry: handleSystemSync,
      });
    } finally {
      setSyncLoading(false);
    }
  }, [toast]);

  return (
    <div className="inline-actions">
      <LoadingButton variant="secondary" isLoading={downloadLoading} onClick={handleDownloadReport}>
        <AdminIcon name="download" />
        Download Report
      </LoadingButton>
      <LoadingButton variant="primary" isLoading={syncLoading} onClick={handleSystemSync}>
        <AdminIcon name="sync" />
        System Sync
      </LoadingButton>
    </div>
  );
}
