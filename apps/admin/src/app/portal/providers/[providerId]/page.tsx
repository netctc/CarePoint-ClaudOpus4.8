import Link from 'next/link';
import { cookies } from 'next/headers';
import { notFound } from 'next/navigation';
import { DataSourceBanner } from '@/components/admin/data-source-banner';
import { DetailStateStrip, EvidenceCardGrid, MetadataGrid } from '@/components/admin/detail-primitives';
import { PortalShell } from '@/components/layout/portal-shell';
import { StatusBadge } from '@/components/ui/status-badge';
import { loadIntegratedProviderProfile } from '@/lib/api/admin-server';
import { formatUtcDateTime } from '@/lib/formatters';
import { getAdminDetailCopy } from '@/lib/i18n/admin-detail-copy';
import { normalizeAdminLocale } from '@/lib/i18n/admin-dictionary';

function toneForStatus(status: string) {
  if (status === 'APPROVED') return 'success';
  if (status === 'REQUEST_CHANGES' || status === 'READY_FOR_REVIEW') return 'warning';
  return 'danger';
}

export default async function ProviderProfilePage({
  params,
}: {
  params: Promise<{ providerId: string }>;
}) {
  const { providerId } = await params;
  const cookieStore = await cookies();
  const locale = normalizeAdminLocale(cookieStore.get('cc_locale')?.value);
  const copy = getAdminDetailCopy(locale).providerProfile;

  try {
    const result = await loadIntegratedProviderProfile(providerId);
    const detail = result.data;
    const checklistEntries = Object.entries(detail.onboarding.checklist);
    const completedItems = checklistEntries.filter(([, value]) => value).length;
    const completionScore = checklistEntries.length
      ? Math.round((completedItems / checklistEntries.length) * 100)
      : 0;
    const blockers = checklistEntries.filter(([, value]) => !value).map(([key]) => key);
    const latestReviewNote = typeof detail.onboarding.latestReview?.details?.note === 'string'
      ? detail.onboarding.latestReview.details.note
      : null;

    return (
      <PortalShell currentPath="/portal/providers">
        <DataSourceBanner source={result.source} error={result.error} />

        <div className="admin-v17-provider-workspace admin-v17-provider-detail">
        <div className="hero-panel">
          <div className="hero-panel-grid">
            <div className="hero-copy">
              <div className="page-breadcrumbs">
                <span>{copy.breadcrumbs.providers}</span><span>•</span><span>{copy.breadcrumbs.directory}</span><span>•</span><span>{detail.profile.name}</span>
              </div>
              <div className="tag-group">
                <span className="page-eyebrow">{copy.eyebrow}</span>
                <StatusBadge tone={toneForStatus(detail.onboarding.status)}>{detail.onboarding.status}</StatusBadge>
              </div>
              <h2 className="hero-title">{detail.profile.name}</h2>
              <p className="hero-subtitle">
                {copy.subtitle}
              </p>
              <div className="tag-group">
                <span className="tag">{detail.profile.role}</span>
                <span className="tag">{detail.profile.specialty || copy.specialtyPending}</span>
                <span className="tag">{copy.storage}: {detail.onboarding.storageMode}</span>
              </div>
              <div className="hero-actions">
                <Link className="button secondary" href="/portal/providers">{copy.backToDirectory}</Link>
                <Link className="button secondary" href={`/portal/providers/onboarding/${providerId}`}>{copy.openOnboardingReview}</Link>
                <Link className="button secondary" href="/portal/payments/reconciliation">{copy.viewPayoutReadiness}</Link>
              </div>
            </div>

            <div className="info-stack">
              <div className="soft-card">
                <div className="panel-header">
                  <div>
                    <h3 className="section-title" style={{ marginBottom: 6 }}>{copy.readiness}</h3>
                    <div style={{ fontWeight: 800, fontSize: 22 }}>{completionScore}% {copy.complete}</div>
                  </div>
                  <span className="tag">{copy.designApplied}</span>
                </div>
                <div className="detail-list">
                  <div><span className="detail-label">{copy.email}</span><strong>{detail.profile.email}</strong></div>
                  <div><span className="detail-label">{copy.license}</span><strong>{detail.profile.licenseNumber || copy.pending}</strong></div>
                  <div><span className="detail-label">{copy.joined}</span><strong>{formatUtcDateTime(detail.profile.joinedAt)}</strong></div>
                </div>
              </div>
              <div className="mini-card">
                <h3 className="section-title">{copy.recentMetrics}</h3>
                <div className="metric-grid-3">
                  <div className="surface-tile"><div className="hero-metric-label">{copy.recentAppointments}</div><div className="hero-metric-value">{detail.metrics.recentAppointments}</div></div>
                  <div className="surface-tile"><div className="hero-metric-label">{copy.completed}</div><div className="hero-metric-value">{detail.metrics.completedAppointments}</div></div>
                  <div className="surface-tile"><div className="hero-metric-label">{copy.payments}</div><div className="hero-metric-value">{detail.metrics.recentPayments}</div></div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <DetailStateStrip
          items={[
            {
              label: 'Checklist coverage',
              value: `${completedItems}/${checklistEntries.length}`,
              detail: blockers.length ? `${blockers.length} blockers still open before clean approval.` : 'All onboarding controls currently satisfied.',
              tone: blockers.length ? 'warning' : 'success',
            },
            {
              label: 'Review posture',
              value: detail.onboarding.latestReview?.action || 'Pending first review',
              detail: latestReviewNote || 'No reviewer note has been recorded yet.',
              tone: detail.onboarding.latestReview ? 'info' : 'neutral',
            },
            {
              label: 'Operational readiness',
              value: detail.metrics.completedAppointments > 0 ? 'Live activity' : 'Pre-go-live',
              detail: `${detail.metrics.recentAppointments} recent appointments and ${detail.metrics.recentPayments} recent payments observed.`,
              tone: detail.metrics.completedAppointments > 0 ? 'success' : 'warning',
            },
          ]}
        />

        <div className="split-shell" style={{ marginTop: 24 }}>
          <div className="info-stack">
            <div className="card">
              <h3 className="section-title">Identity and configuration</h3>
              <MetadataGrid
                items={[
                  { label: 'Provider name', value: detail.profile.name, detail: 'Canonical admin directory label.' },
                  { label: 'Primary role', value: detail.profile.role, detail: 'Used for queue routing and scope checks.' },
                  { label: 'Specialty', value: detail.profile.specialty || 'Not captured', detail: 'Visible in provider discovery and assignment flows.' },
                  { label: 'Assigned services', value: detail.profile.services.length ? detail.profile.services.join(', ') : 'None assigned', detail: 'Commercial and scheduling scope.' },
                  { label: 'Storage mode', value: detail.onboarding.storageMode, detail: 'Indicates whether onboarding is persisted in live state or mock fallback.' },
                  { label: 'Latest actor', value: detail.onboarding.latestReview?.actor?.name || detail.onboarding.latestReview?.actor?.email || 'System', detail: 'Most recent explicit workflow owner.' },
                ]}
              />
            </div>

            <div className="card">
              <h3 className="section-title">Checklist and evidence packet</h3>
              <EvidenceCardGrid
                items={[
                  {
                    title: 'Onboarding control coverage',
                    meta: `${completedItems} complete · ${blockers.length} open`,
                    description: 'The redesign groups onboarding controls into a single auditable evidence packet so approval, change requests, and escalation can happen without switching context.',
                    bullets: checklistEntries.map(([key, value]) => `${value ? 'Complete' : 'Missing'} — ${key.replace(/([A-Z])/g, ' $1').replace(/^./, (char) => char.toUpperCase())}`),
                    badges: [
                      { label: detail.onboarding.status, tone: toneForStatus(detail.onboarding.status) },
                      { label: blockers.length ? 'Needs follow-up' : 'Ready set', tone: blockers.length ? 'warning' : 'success' },
                    ],
                  },
                  {
                    title: 'Latest review evidence',
                    meta: detail.onboarding.latestReview ? formatUtcDateTime(detail.onboarding.latestReview.createdAt) : 'No action yet',
                    description: detail.onboarding.latestReview
                      ? 'The latest workflow decision is displayed here with actor, action, and note context to support downstream audit, payout, and access-linked review.'
                      : 'No formal review action has been recorded yet, so the workspace keeps the provider in a pending review posture.',
                    bullets: detail.onboarding.latestReview
                      ? [
                          `Action: ${detail.onboarding.latestReview.action}`,
                          `Actor: ${detail.onboarding.latestReview.actor?.name || detail.onboarding.latestReview.actor?.email || 'System'}`,
                          `Note: ${latestReviewNote || 'No note recorded'}`,
                        ]
                      : ['Open the onboarding review route to create the first explicit decision record.'],
                    badges: [
                      { label: detail.onboarding.latestReview ? 'Audit linked' : 'Awaiting action', tone: detail.onboarding.latestReview ? 'info' : 'warning' },
                    ],
                  },
                ]}
              />
            </div>

            <div className="card">
              <h3 className="section-title">Onboarding audit history</h3>
              <div className="timeline-list">
                {detail.onboarding.history.length ? detail.onboarding.history.map((entry) => (
                  <div key={entry.id} className="timeline-item">
                    <div style={{ fontWeight: 700 }}>{formatUtcDateTime(entry.createdAt)}</div>
                    <div>{entry.action}</div>
                    <div className="muted">{entry.actor?.name || entry.actor?.email || 'System'}</div>
                    <div className="muted">{typeof entry.details?.note === 'string' ? entry.details.note : 'No note recorded'}</div>
                  </div>
                )) : <div className="banner info">No onboarding history has been returned yet.</div>}
              </div>
            </div>
          </div>

          <div className="info-stack">
            <div className="card">
              <h3 className="section-title">Decision support</h3>
              <ul className="data-points muted">
                <li>Approve only when credential, identity, finance, and service assignment checks are all explicitly complete.</li>
                <li>Route finance-related blockers into reconciliation and payout review before changing booking eligibility.</li>
                <li>Use request-changes when evidence is incomplete but provider activation remains strategically desirable.</li>
                <li>Escalate repeated checklist regressions into safety or audit review if a live provider loses mandatory coverage.</li>
              </ul>
            </div>

            <div className="card">
              <h3 className="section-title">Cross-workflow links</h3>
              <div className="list-stack">
                <Link className="list-row" href={`/portal/providers/onboarding/${providerId}`}>
                  <div>
                    <div className="list-row-title">Onboarding review workspace</div>
                    <div className="muted">Action-focused approval and change-request controls.</div>
                  </div>
                  <strong>Open</strong>
                </Link>
                <Link className="list-row" href="/portal/payments/reconciliation">
                  <div>
                    <div className="list-row-title">Payments reconciliation</div>
                    <div className="muted">Use when payout readiness or settlement dependencies affect activation.</div>
                  </div>
                  <strong>Open</strong>
                </Link>
                <Link className="list-row" href="/portal/audit/logs">
                  <div>
                    <div className="list-row-title">Audit logs</div>
                    <div className="muted">Review admin actions and approval history around this provider workflow.</div>
                  </div>
                  <strong>Open</strong>
                </Link>
              </div>
            </div>

            <div className="card">
              <h3 className="section-title">Design-extension opportunities</h3>
              <ul className="data-points muted">
                <li>Provider quality scorecards can slot into this workspace as a subroute without changing the shell.</li>
                <li>Credential expiry and payout variance drilldowns can reuse the same evidence-card pattern.</li>
                <li>Organization-level governance can share this layout while swapping practitioner metrics for facility KPIs.</li>
              </ul>
            </div>
          </div>
        </div>
        </div>
      </PortalShell>
    );
  } catch {
    notFound();
  }
}
