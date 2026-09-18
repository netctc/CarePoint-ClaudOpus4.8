import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ProviderReviewActions } from '@/components/admin/provider-review-actions';
import { PortalShell } from '@/components/layout/portal-shell';
import { StatusBadge } from '@/components/ui/status-badge';
import { loadIntegratedProviderReview } from '@/lib/api/admin-server';
import { formatUtcDateTime } from '@/lib/formatters';

function tone(result: 'Pass' | 'Review' | 'Fail') {
  if (result === 'Pass') return 'success';
  if (result === 'Review') return 'warning';
  return 'danger';
}

function docTone(status: 'Received' | 'Missing' | 'Rejected') {
  if (status === 'Received') return 'success';
  if (status === 'Missing') return 'warning';
  return 'danger';
}

type OnboardingStatus = 'DRAFT' | 'SUBMITTED' | 'IN_REVIEW' | 'CHANGES_REQUESTED' | 'APPROVED' | 'REJECTED';

const PROGRESSION_STEPS: { key: OnboardingStatus; label: string }[] = [
  { key: 'DRAFT', label: 'Draft' },
  { key: 'SUBMITTED', label: 'Submitted' },
  { key: 'IN_REVIEW', label: 'In Review' },
  { key: 'APPROVED', label: 'Approved' },
];

function getStepIndex(status: string | null | undefined): number {
  if (!status) return 0;
  const upper = status.toUpperCase().replace(/[\s-]+/g, '_');
  if (upper === 'REJECTED') return -1; // special case
  if (upper === 'CHANGES_REQUESTED') return 2; // sits at In Review stage
  const idx = PROGRESSION_STEPS.findIndex((s) => s.key === upper);
  return idx >= 0 ? idx : 0;
}

export default async function ProviderOnboardingReviewPage({ params }: { params: Promise<{ providerId: string }> }) {
  const { providerId } = await params;

  try {
    const result = await loadIntegratedProviderReview(providerId);
    const detail = result.data.detail;
    const apiDetail = result.data.apiDetail;
    const docsReceived = detail.mandatoryDocs.filter((doc) => doc.status === 'Received').length;
    const checksPassed = detail.checks.filter((check) => check.result === 'Pass').length;
    const hasBlockingItem = docsReceived !== detail.mandatoryDocs.length || checksPassed !== detail.checks.length;
    const rawRequestedFields = apiDetail?.onboarding.persistedState?.requestedFields;
    const requestedFields = Array.isArray(rawRequestedFields) ? rawRequestedFields : [];

    const currentStatus: string = apiDetail?.onboarding.persistedState?.status || 'DRAFT';
    const stepIndex = getStepIndex(currentStatus);
    const isRejected = currentStatus.toUpperCase() === 'REJECTED';

    const reviewTimeline = apiDetail?.onboarding.history?.length ? apiDetail.onboarding.history : [];

    return (
      <PortalShell currentPath="/portal/providers/onboarding">
        <div className="admin-v17-provider-workspace admin-v17-provider-detail">
          {/* Breadcrumb & navigation */}
          <div style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Link className="button secondary" href="/portal/providers/onboarding">← Back to Queue</Link>
            <Link className="button secondary" href={`/portal/providers/${providerId}`}>Open Provider Profile</Link>
          </div>

          {/* Provider header */}
          <div className="card" style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800 }}>{detail.providerName}</h2>
                <div className="muted" style={{ marginTop: 4 }}>
                  {detail.organizationName} · License: {detail.licenseNumber} · {detail.cityCoverage.join(', ')}
                </div>
              </div>
              <StatusBadge tone={isRejected ? 'danger' : hasBlockingItem ? 'warning' : 'success'}>
                {isRejected ? 'Rejected' : hasBlockingItem ? 'Blocked' : 'Ready'}
              </StatusBadge>
            </div>
          </div>

          {/* Status progression indicator */}
          <div className="card" style={{ marginBottom: 16 }}>
            <div className="status-progression" style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
              {PROGRESSION_STEPS.map((step, i) => {
                const isActive = i === stepIndex && !isRejected;
                const isCompleted = i < stepIndex && !isRejected;
                const isFinalRejected = isRejected && i === PROGRESSION_STEPS.length - 1;
                return (
                  <div
                    key={step.key}
                    style={{
                      flex: 1,
                      textAlign: 'center',
                      position: 'relative',
                    }}
                  >
                    <div
                      style={{
                        width: 32,
                        height: 32,
                        borderRadius: '50%',
                        margin: '0 auto 6px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 14,
                        fontWeight: 700,
                        color: '#fff',
                        background: isFinalRejected
                          ? '#dc2626'
                          : isCompleted
                            ? '#16a34a'
                            : isActive
                              ? '#2563eb'
                              : '#d1d5db',
                      }}
                    >
                      {isCompleted ? '✓' : isFinalRejected ? '✗' : i + 1}
                    </div>
                    <div
                      style={{
                        fontSize: 12,
                        fontWeight: isActive || isCompleted ? 700 : 400,
                        color: isActive ? '#2563eb' : isCompleted ? '#16a34a' : '#6b7280',
                      }}
                    >
                      {isFinalRejected ? 'Rejected' : step.label}
                    </div>
                    {/* Connector line */}
                    {i < PROGRESSION_STEPS.length - 1 && (
                      <div
                        style={{
                          position: 'absolute',
                          top: 16,
                          left: '50%',
                          width: '100%',
                          height: 2,
                          background: isCompleted ? '#16a34a' : '#d1d5db',
                          zIndex: 0,
                        }}
                      />
                    )}
                  </div>
                );
              })}
            </div>
            {currentStatus.toUpperCase() === 'CHANGES_REQUESTED' && (
              <div className="banner warning" style={{ marginTop: 12 }}>
                Changes requested — awaiting provider resubmission.
              </div>
            )}
          </div>

          {/* Summary metrics strip */}
          <div className="admin-v17-intelligence-strip" aria-label="Review metrics" style={{ marginBottom: 16 }}>
            <div className={`admin-v17-lane-card ${docsReceived === detail.mandatoryDocs.length ? 'admin-v17-lane-card--green' : 'admin-v17-lane-card--amber'}`}>
              <span>Documents</span>
              <strong>{docsReceived}/{detail.mandatoryDocs.length}</strong>
            </div>
            <div className={`admin-v17-lane-card ${checksPassed === detail.checks.length ? 'admin-v17-lane-card--green' : 'admin-v17-lane-card--amber'}`}>
              <span>Checks Passed</span>
              <strong>{checksPassed}/{detail.checks.length}</strong>
            </div>
            <div className={`admin-v17-lane-card ${requestedFields.length ? 'admin-v17-lane-card--amber' : 'admin-v17-lane-card--blue'}`}>
              <span>Corrections</span>
              <strong>{requestedFields.length}</strong>
            </div>
          </div>

          <div className="split-shell">
            {/* Left column: Document review panels */}
            <div className="info-stack">
              {/* Document review panel */}
              <div className="card">
                <h3 className="section-title">Document Review</h3>
                <table style={{ width: '100%' }}>
                  <thead>
                    <tr>
                      <th>Document</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detail.mandatoryDocs.map((doc) => (
                      <tr key={doc.name}>
                        <td style={{ fontWeight: 600 }}>{doc.name}</td>
                        <td><StatusBadge tone={docTone(doc.status)}>{doc.status}</StatusBadge></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Verification checks panel */}
              <div className="card">
                <h3 className="section-title">Verification Checks</h3>
                <table style={{ width: '100%' }}>
                  <thead>
                    <tr>
                      <th>Check</th>
                      <th>Result</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detail.checks.map((check) => (
                      <tr key={check.label}>
                        <td style={{ fontWeight: 600 }}>{check.label}</td>
                        <td><StatusBadge tone={tone(check.result)}>{check.result}</StatusBadge></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Review history */}
              <div className="card">
                <h3 className="section-title">Review History</h3>
                {reviewTimeline.length ? (
                  <div className="timeline-list">
                    {reviewTimeline.map((entry) => (
                      <div key={entry.id} className="timeline-item">
                        <div style={{ fontWeight: 800 }}>{formatUtcDateTime(entry.createdAt)}</div>
                        <div>{entry.action}</div>
                        <div className="muted">{entry.actor?.name || entry.actor?.email || 'System'}</div>
                        {typeof entry.details?.note === 'string' && (
                          <div className="muted">{String(entry.details.note)}</div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="banner info">No review history recorded yet.</div>
                )}
              </div>
            </div>

            {/* Right column: Actions */}
            <div className="info-stack">
              <ProviderReviewActions providerId={providerId} disabled={!apiDetail} />
            </div>
          </div>
        </div>
      </PortalShell>
    );
  } catch {
    notFound();
  }
}
