import Link from 'next/link';
import { cookies } from 'next/headers';
import { notFound } from 'next/navigation';
import { DetailStateStrip, EvidenceCardGrid, MetadataGrid } from '@/components/admin/detail-primitives';
import { PortalShell } from '@/components/layout/portal-shell';
import { StatusBadge } from '@/components/ui/status-badge';
import { loadIntegratedTelehealthWorkspace } from '@/lib/api/admin-server';
import { getAdminDetailCopy } from '@/lib/i18n/admin-detail-copy';
import { normalizeAdminLocale } from '@/lib/i18n/admin-dictionary';

function toneForState(state: string) {
  if (state === 'Healthy') return 'success';
  if (state === 'Degraded') return 'warning';
  return 'danger';
}

export default async function TelehealthIncidentDetailPage({ params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await params;
  const cookieStore = await cookies();
  const locale = normalizeAdminLocale(cookieStore.get('cc_locale')?.value);
  const copy = getAdminDetailCopy(locale).telehealthDetail;
  const result = await loadIntegratedTelehealthWorkspace();
  const session = result.data.items.find((item) => item.id === sessionId) || result.data.items[0];
  const selected = result.data.workspace.selectedSession;

  if (!session) {
    notFound();
  }

  const severity = session.state === 'Failed' ? 'Critical' : session.state === 'Degraded' ? 'Elevated' : 'Normal';

  return (
    <PortalShell currentPath="/portal/telehealth/operations">
      <div className="page-breadcrumbs"><span>{copy.breadcrumbs.telehealth}</span><span>•</span><span>{copy.breadcrumbs.operations}</span><span>•</span><span>{session.sessionRef}</span></div>
      <div className="hero-panel">
        <div className="hero-panel-grid">
          <div className="hero-copy">
            <div className="tag-group">
              <span className="page-eyebrow">{copy.eyebrow}</span>
              <StatusBadge tone={toneForState(session.state)}>{session.state}</StatusBadge>
            </div>
            <h2 className="hero-title">{session.sessionRef} {copy.titleSuffix}</h2>
            <p className="hero-subtitle">
              {copy.subtitle}
            </p>
            <div className="hero-actions">
              <Link className="button secondary" href="/portal/telehealth/operations">{copy.backToBoard}</Link>
              <Link className="button secondary" href="/portal/support/console">{copy.openSupport}</Link>
              <Link className="button secondary" href="/portal/safety/incidents">{copy.openSafety}</Link>
            </div>
          </div>
          <div className="info-stack">
            <div className="soft-card">
              <div className="panel-header">
                <div>
                  <h3 className="section-title" style={{ marginBottom: 6 }}>{copy.sessionState}</h3>
                  <div style={{ fontWeight: 800, fontSize: 22 }}>{session.providerName}</div>
                </div>
                <StatusBadge tone={toneForState(session.state)}>{severity}</StatusBadge>
              </div>
              <div className="detail-list">
                <div><span className="detail-label">{copy.roomState}</span><strong>{session.roomState}</strong></div>
                <div><span className="detail-label">{copy.issueOwner}</span><strong>{session.issueOwner}</strong></div>
                <div><span className="detail-label">{copy.failureRate}</span><strong>{session.failureRate}</strong></div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <DetailStateStrip
        items={[
          {
            label: copy.supportPosture,
            value: session.supportHook,
            detail: 'Current session-level intervention or monitoring route.',
            tone: session.state === 'Healthy' ? 'success' : 'warning',
          },
          {
            label: copy.metadataExposure,
            value: session.metadataAccess,
            detail: 'Clinical content remains excluded from this admin workspace.',
            tone: 'info',
          },
          {
            label: 'Escalation need',
            value: severity,
            detail: session.state === 'Failed' ? 'Link or open support and safety work items immediately.' : 'Continue monitoring with operational follow-up as needed.',
            tone: session.state === 'Failed' ? 'danger' : session.state === 'Degraded' ? 'warning' : 'success',
          },
        ]}
      />

      <div className="split-shell" style={{ marginTop: 24 }}>
        <div className="info-stack">
          <div className="card">
            <h3 className="section-title">Incident metadata</h3>
            <MetadataGrid
              items={[
                { label: 'Session reference', value: session.sessionRef, detail: 'Primary correlation handle for ops and support.' },
                { label: 'Provider', value: session.providerName, detail: 'Operational owner on the clinical side of the encounter.' },
                { label: 'Patient marker', value: session.patientInitials, detail: 'Masked reference only.' },
                { label: 'Region', value: session.region, detail: 'Useful for market-specific outage patterns.' },
                { label: 'Room type', value: session.roomType, detail: 'Determines urgency expectations and join flows.' },
                { label: 'Last heartbeat', value: session.lastHeartbeatAt, detail: 'Most recent telemetry heartbeat captured.' },
              ]}
            />
          </div>

          <div className="card">
            <h3 className="section-title">Evidence-safe triage packet</h3>
            <EvidenceCardGrid
              items={[
                {
                  title: 'Observed telemetry cues',
                  meta: session.roomState,
                  description: 'The redesigned evidence packet keeps the triage team inside a metadata-safe lane while still showing enough operational context to classify the failure correctly.',
                  bullets: [
                    `Failure rate: ${session.failureRate}`,
                    `Support routing: ${session.supportHook}`,
                    `Monitoring owner: ${session.issueOwner}`,
                    `Room type: ${session.roomType}`,
                  ],
                  badges: [{ label: session.state, tone: toneForState(session.state) }],
                },
                {
                  title: 'Exception and guardrail context',
                  meta: 'Governance-safe view',
                  description: 'These controls document why the session can be investigated operationally without exposing consultation content, and when higher-severity handling should create linked work items.',
                  bullets: [...selected.metadata, ...selected.guardrails],
                  badges: [
                    { label: 'Metadata only', tone: 'info' },
                    { label: severity, tone: session.state === 'Failed' ? 'danger' : 'warning' },
                  ],
                },
              ]}
            />
          </div>

          <div className="card">
            <h3 className="section-title">Operational next actions</h3>
            <div className="timeline-list">
              {[
                `Validate room state transition from ${session.roomState} and confirm whether rejoin attempts are still active.`,
                `Notify ${session.issueOwner} if the session remains ${session.state.toLowerCase()} after the next heartbeat window.`,
                'Attach support notes and preserve correlation identifiers before handoff.',
                'Open a safety-linked review when urgent or repeated failure patterns could affect care continuity.',
              ].map((item) => (
                <div key={item} className="timeline-item">
                  <div style={{ fontWeight: 700 }}>Action</div>
                  <div className="muted">{item}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="info-stack">
          <div className="card">
            <h3 className="section-title">Exception queue context</h3>
            <ul className="data-points muted">
              {result.data.workspace.exceptionQueue.map((item) => <li key={item}>{item}</li>)}
            </ul>
          </div>

          <div className="card">
            <h3 className="section-title">Cross-workflow links</h3>
            <div className="list-stack">
              <Link className="list-row" href="/portal/support/console">
                <div>
                  <div className="list-row-title">Support console</div>
                  <div className="muted">Create or update linked support work on telehealth failures.</div>
                </div>
                <strong>Open</strong>
              </Link>
              <Link className="list-row" href="/portal/safety/incidents">
                <div>
                  <div className="list-row-title">Safety cases</div>
                  <div className="muted">Escalate operational failures with patient-safety implications.</div>
                </div>
                <strong>Open</strong>
              </Link>
              <Link className="list-row" href="/portal/audit/logs">
                <div>
                  <div className="list-row-title">Audit logs</div>
                  <div className="muted">Preserve evidence of interventions, ownership, and final resolution.</div>
                </div>
                <strong>Open</strong>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </PortalShell>
  );
}
