import { PortalShell } from '@/components/layout/portal-shell';
import { ProviderOnboardingTable } from '@/components/admin/provider-onboarding-table';
import { loadIntegratedProviderQueue } from '@/lib/api/admin-server';

export default async function ProviderOnboardingQueuePage() {
  const result = await loadIntegratedProviderQueue();
  const items = result.data.items;
  const pendingDocs = items.filter((item) => item.docStatus !== 'Complete').length;
  const highRisk = items.filter((item) => item.riskFlag === 'High').length;
  const slaRisk = items.filter((item) => item.slaHoursRemaining <= 6).length;

  return (
    <PortalShell currentPath="/portal/providers/onboarding">
      <div className="admin-v17-provider-workspace admin-v17-provider-onboarding">
        {/* Stats strip */}
        <div className="admin-v17-intelligence-strip" aria-label="Onboarding queue metrics">
          <div className="admin-v17-lane-card admin-v17-lane-card--blue">
            <span>Total Submissions</span>
            <strong>{items.length}</strong>
          </div>
          <div className="admin-v17-lane-card admin-v17-lane-card--amber">
            <span>Pending Documents</span>
            <strong>{pendingDocs}</strong>
          </div>
          <div className="admin-v17-lane-card admin-v17-lane-card--red">
            <span>High Risk</span>
            <strong>{highRisk}</strong>
          </div>
          <div className="admin-v17-lane-card admin-v17-lane-card--amber">
            <span>SLA at Risk</span>
            <strong>{slaRisk}</strong>
          </div>
        </div>

        {/* Main data table with action bar */}
        <ProviderOnboardingTable items={items} />
      </div>
    </PortalShell>
  );
}
