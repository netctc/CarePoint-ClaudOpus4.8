import Link from 'next/link';
import { cookies } from 'next/headers';
import { notFound } from 'next/navigation';
import { DataSourceBanner } from '@/components/admin/data-source-banner';
import { DetailStateStrip, EvidenceCardGrid, MetadataGrid, type EvidenceCardItem } from '@/components/admin/detail-primitives';
import { SupportAdminActions } from '@/components/admin/support-admin-actions';
import { PortalShell } from '@/components/layout/portal-shell';
import { StatusBadge } from '@/components/ui/status-badge';
import { loadIntegratedSupportWorkspace } from '@/lib/api/admin-server';
import { getAdminDetailCopy } from '@/lib/i18n/admin-detail-copy';
import { normalizeAdminLocale } from '@/lib/i18n/admin-dictionary';

function priorityTone(priority: string) {
  if (priority === 'P1') return 'danger';
  if (priority === 'P2') return 'warning';
  return 'info';
}

function statusTone(status: string) {
  if (status === 'Resolved') return 'success';
  if (status === 'Escalated') return 'warning';
  return 'info';
}

export default async function SupportTicketDetailPage({
  params,
}: {
  params: Promise<{ ticketId: string }>;
}) {
  const { ticketId } = await params;
  const result = await loadIntegratedSupportWorkspace();
  const item = result.data.items.find((entry) => entry.id === ticketId);

  if (!item) {
    notFound();
  }

  const selected = result.data.workspace.selectedTicket.ticketRef === item.ticketRef
    ? result.data.workspace.selectedTicket
    : {
        ticketRef: item.ticketRef,
        owner: item.owner,
        priority: item.priority,
        linkedDomain: item.linkedDomain,
        maskedCounterparty: `${item.channel} requester (${item.piiMasking.toLowerCase()})`,
        timeline: [
          'Ticket routed into support operations workspace.',
          `Current milestone: ${item.nextMilestone}`,
          item.status === 'Escalated' ? 'Escalation route is currently active.' : 'Awaiting next operator action.',
        ],
        escalationOptions: result.data.workspace.selectedTicket.escalationOptions,
        guardrails: result.data.workspace.selectedTicket.guardrails,
      };

  const evidenceCards: EvidenceCardItem[] = [
    {
      title: 'Intake context',
      meta: `${item.channel} support lane`,
      description: 'The masked request context stays visible so operators can understand the issue without exposing unnecessary personal data.',
      bullets: [
        `Requester: ${selected.maskedCounterparty}`,
        `Linked domain: ${selected.linkedDomain}`,
        `Current milestone: ${item.nextMilestone}`,
      ],
      badges: [{ label: item.priority, tone: priorityTone(item.priority) }],
    },
    {
      title: 'Timeline evidence',
      meta: selected.ticketRef,
      description: 'This compact timeline captures the operational history that should remain exportable and safe for audit review.',
      bullets: selected.timeline,
      badges: [{ label: item.status, tone: statusTone(item.status) }],
    },
    {
      title: 'Masking and privacy state',
      meta: item.piiMasking,
      description: 'A deeper support view should always preserve requester masking posture and show when elevated access would be required.',
      bullets: [
        'Masked views should be preferred unless a higher-privilege purpose is explicitly granted.',
        'Exports should stay redacted and traceable.',
        'Macros must not introduce or reveal sensitive context outside the allowed scope.',
      ],
      badges: [{ label: item.piiMasking, tone: item.piiMasking === 'Masked' ? 'success' : 'warning' }],
    },
    {
      title: 'Escalation preparation',
      meta: 'Operational handoff support',
      description: 'Keeps the next handoff routes and evidence expectations visible before the operator changes owner or queue.',
      bullets: selected.escalationOptions,
      badges: [{ label: 'Escalation routes', tone: 'info' }],
    },
  ];

  return (
    <PortalShell currentPath="/portal/support/console">
      <DataSourceBanner source={result.source} error={result.error} />

      <div className="hero-panel">
        <div className="hero-panel-grid">
          <div className="hero-copy">
            <div className="page-breadcrumbs">
              <span>Support</span>
              <span>•</span>
              <span>Console</span>
              <span>•</span>
              <span>{item.ticketRef}</span>
            </div>
            <div className="page-eyebrow">A-12a · Ticket detail</div>
            <h2 className="hero-title">Ticket detail workspace with masked context, escalation history, and support-safe evidence views</h2>
            <p className="hero-subtitle">
              This detail route now carries the deeper support states needed for real operations: masked intake context, timeline evidence, privacy posture, and handoff preparation across domains.
            </p>
            <div className="hero-actions">
              <Link className="button secondary" href="/portal/support/console">Back to support queue</Link>
              <button className="button primary">Export masked timeline</button>
            </div>
            <div className="hero-metrics">
              <div className="hero-metric">
                <div className="hero-metric-label">Priority</div>
                <div className="hero-metric-value">{item.priority}</div>
                <div className="hero-metric-detail">Determines speed and escalation path in the support workspace.</div>
              </div>
              <div className="hero-metric">
                <div className="hero-metric-label">Status</div>
                <div className="hero-metric-value">{item.status}</div>
                <div className="hero-metric-detail">Current ticket operating state and ownership posture.</div>
              </div>
              <div className="hero-metric">
                <div className="hero-metric-label">Linked domain</div>
                <div className="hero-metric-value">{item.linkedDomain}</div>
                <div className="hero-metric-detail">Primary domain responsible for the next intervention.</div>
              </div>
            </div>
          </div>

          <div className="info-stack">
            <div className="soft-card">
              <div className="panel-header">
                <div>
                  <h3 className="section-title" style={{ marginBottom: 6 }}>Ticket posture</h3>
                  <div style={{ fontWeight: 800, fontSize: 22 }}>{selected.ticketRef}</div>
                </div>
                <div className="chip-row">
                  <StatusBadge tone={priorityTone(item.priority)}>{item.priority}</StatusBadge>
                  <StatusBadge tone={statusTone(item.status)}>{item.status}</StatusBadge>
                </div>
              </div>
              <div className="detail-list">
                <div><span className="detail-label">Owner</span><strong>{selected.owner}</strong></div>
                <div><span className="detail-label">Requester</span><strong>{selected.maskedCounterparty}</strong></div>
                <div><span className="detail-label">SLA</span><strong>{item.sla}</strong></div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <DetailStateStrip
        items={[
          {
            label: 'Priority lane',
            value: item.priority,
            detail: 'Drives speed, staffing, and escalation urgency within the support console.',
            tone: priorityTone(item.priority),
          },
          {
            label: 'Masking mode',
            value: item.piiMasking,
            detail: 'Shows whether the operator is expected to stay in a masked, redacted, or elevated-access safe view.',
            tone: item.piiMasking === 'Masked' ? 'success' : 'warning',
          },
          {
            label: 'Handoff state',
            value: item.status === 'Escalated' ? 'Escalated' : 'In queue',
            detail: 'Helps teams distinguish active cross-domain escalations from tickets still being worked locally.',
            tone: item.status === 'Escalated' ? 'warning' : 'info',
          },
        ]}
      />

      <div className="split-shell">
        <div className="info-stack">
          <div className="card">
            <h3 className="section-title">Secondary support views and evidence</h3>
            <EvidenceCardGrid items={evidenceCards} />
          </div>

          <div className="card">
            <h3 className="section-title">Ticket metadata</h3>
            <MetadataGrid
              items={[
                {
                  label: 'Owner',
                  value: selected.owner,
                  detail: 'Person or queue currently responsible for the next operator action.',
                },
                {
                  label: 'Linked domain',
                  value: selected.linkedDomain,
                  detail: 'Important for routing the next escalation or cross-functional handoff.',
                },
                {
                  label: 'Current milestone',
                  value: item.nextMilestone,
                  detail: 'Keeps the workflow checkpoint visible across ticket transitions.',
                },
                {
                  label: 'SLA note',
                  value: item.sla,
                  detail: 'Maintains timing context for support leadership and audit exports.',
                },
              ]}
            />
          </div>
        </div>

        <div className="info-stack">
          <SupportAdminActions itemId={ticketId} disabled={result.source !== 'api'} />
          <div className="card">
            <h3 className="section-title">Masking and escalation guardrails</h3>
            <ul className="data-points muted">
              {selected.guardrails.map((rule) => (
                <li key={rule}>{rule}</li>
              ))}
            </ul>
          </div>
          <div className="card">
            <h3 className="section-title">Decision notes to preserve</h3>
            <ul className="data-points muted">
              <li>Record why the ticket stayed in support, was escalated, or was resolved locally.</li>
              <li>Reference any macro or scripted response that materially affected the outcome.</li>
              <li>Keep requester masking posture visible during every export or handoff.</li>
              <li>Preserve the linked domain and owner transition whenever responsibility changes.</li>
            </ul>
          </div>
        </div>
      </div>
    </PortalShell>
  );
}
