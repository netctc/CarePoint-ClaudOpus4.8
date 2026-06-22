import Link from 'next/link';
import { cookies } from 'next/headers';
import { notFound } from 'next/navigation';
import { CatalogAdminActions } from '@/components/admin/catalog-admin-actions';
import { DataSourceBanner } from '@/components/admin/data-source-banner';
import { DetailStateStrip, EvidenceCardGrid, MetadataGrid } from '@/components/admin/detail-primitives';
import { PortalShell } from '@/components/layout/portal-shell';
import { StatusBadge } from '@/components/ui/status-badge';
import { loadIntegratedCatalogWorkspace } from '@/lib/api/admin-server';
import { getAdminDetailCopy } from '@/lib/i18n/admin-detail-copy';
import { normalizeAdminLocale } from '@/lib/i18n/admin-dictionary';

function tone(status: string) {
  if (status === 'Active') return 'success';
  if (status === 'Draft') return 'warning';
  return 'neutral';
}

export default async function ServiceCatalogDetailPage({
  params,
}: {
  params: Promise<{ serviceId: string }>;
}) {
  const { serviceId } = await params;
  const cookieStore = await cookies();
  const locale = normalizeAdminLocale(cookieStore.get('cc_locale')?.value);
  const copy = getAdminDetailCopy(locale).serviceDetail;
  const result = await loadIntegratedCatalogWorkspace();
  const service = result.data.items.find((item) => item.id === serviceId);

  if (!service) {
    notFound();
  }

  const selectedTemplate = result.data.workspace.selectedTemplate;
  const detail = selectedTemplate.name === service.serviceName
    ? selectedTemplate
    : {
        name: service.serviceName,
        version: service.status === 'Draft' ? 'Draft vNext' : service.status === 'Active' ? 'Controlled live version' : 'Archive snapshot',
        owner: 'Catalog operations team',
        rolloutState: service.downstreamImpact,
        dependencies: [
          `Category: ${service.category}`,
          `Template: ${service.template}`,
          service.status === 'Archived' ? 'Historical references only' : 'Pricing, reporting, and booking mappings should be revalidated before publish',
        ],
      };
  const apiItem = result.data.apiItems?.find((item) => item.id === service.id);
  const dependencyCount = detail.dependencies.length;
  const serviceModes = apiItem?.serviceModes?.length ? apiItem.serviceModes.join(', ') : 'Consult template controlled modes';
  const tags = apiItem?.tags?.length ? apiItem.tags.join(', ') : 'No API tags returned';

  const releaseCards = [
    {
      title: 'Taxonomy definition',
      meta: `Template ${service.template}`,
      description: 'Service naming, category placement, and template ownership stay visible before a publish or archive decision is made.',
      bullets: [
        `Category: ${service.category}`,
        `Owner: ${detail.owner}`,
        `Lifecycle: ${service.status}`,
      ],
      badges: [{ label: service.status, tone: tone(service.status) }],
    },
    {
      title: 'Booking and provider exposure',
      meta: 'Downstream operational impact',
      description: 'Use this checkpoint to confirm where the service definition surfaces downstream before any change is promoted.',
      bullets: [
        service.downstreamImpact,
        `Modes: ${serviceModes}`,
        'Any visible change should be validated against booking, provider, and support experiences.',
      ],
      badges: [{ label: dependencyCount > 2 ? 'Linked systems' : 'Scoped impact', tone: dependencyCount > 2 ? 'warning' : 'info' }],
    },
    {
      title: 'Reporting and pricing bindings',
      meta: 'Control gates before release',
      description: 'A service should not be promoted until pricing assumptions, reporting keys, and operational rollouts remain coherent.',
      bullets: [
        ...detail.dependencies,
        `Tags: ${tags}`,
      ],
      badges: [{ label: 'Governed change', tone: 'info' }],
    },
    {
      title: 'Rollout packet',
      meta: detail.version,
      description: 'Reviewers should capture why the service is being introduced, changed, or archived and what teams will be affected.',
      bullets: [
        `Rollout state: ${detail.rolloutState}`,
        service.status === 'Archived' ? 'Archive path should retain reference integrity for historical reporting.' : 'Published changes should align with the current service-version strategy.',
        'Any manual override should be traceable in the audit log.',
      ],
      badges: [{ label: detail.version, tone: 'neutral' }],
    },
  ];

  return (
    <PortalShell currentPath="/portal/catalog/services">
      <DataSourceBanner source={result.source} error={result.error} />

      <div className="admin-v18-governance-workspace admin-v18-catalog-detail">
        <div className="hero-panel admin-v18-hero-panel">
        <div className="hero-panel-grid">
          <div className="hero-copy">
            <div className="page-breadcrumbs">
              <span>{copy.breadcrumbs.catalog}</span>
              <span>•</span>
              <span>{copy.breadcrumbs.services}</span>
              <span>•</span>
              <span>{service.serviceName}</span>
            </div>
            <div className="page-eyebrow">{copy.eyebrow}</div>
            <h2 className="hero-title">{copy.title}</h2>
            <p className="hero-subtitle">
              {copy.subtitle}
            </p>
            <div className="hero-actions">
              <Link className="button secondary" href="/portal/catalog/services">{copy.backToCatalog}</Link>
              <button className="button primary">{copy.previewImpact}</button>
            </div>
            <div className="hero-metrics">
              <div className="hero-metric">
                <div className="hero-metric-label">{copy.service}</div>
                <div className="hero-metric-value">{service.serviceName}</div>
                <div className="hero-metric-detail">Current category and template assignment.</div>
              </div>
              <div className="hero-metric">
                <div className="hero-metric-label">{copy.lifecycle}</div>
                <div className="hero-metric-value">{service.status}</div>
                <div className="hero-metric-detail">{copy.lifecycleDetail}</div>
              </div>
              <div className="hero-metric">
                <div className="hero-metric-label">{copy.template}</div>
                <div className="hero-metric-value">{service.template}</div>
                <div className="hero-metric-detail">{copy.templateDetail}</div>
              </div>
            </div>
          </div>

          <div className="info-stack">
            <div className="soft-card">
              <div className="panel-header">
                <div>
                  <h3 className="section-title" style={{ marginBottom: 6 }}>{copy.releasePosture}</h3>
                  <div style={{ fontWeight: 800, fontSize: 22 }}>{detail.version}</div>
                </div>
                <StatusBadge tone={tone(service.status)}>{service.status}</StatusBadge>
              </div>
              <div className="detail-list">
                <div><span className="detail-label">{copy.owner}</span><strong>{detail.owner}</strong></div>
                <div><span className="detail-label">{copy.category}</span><strong>{service.category}</strong></div>
                <div><span className="detail-label">{copy.impact}</span><strong>{service.downstreamImpact}</strong></div>
              </div>
            </div>

            <div className="mini-card">
              <h3 className="section-title">{copy.rolloutState}</h3>
              <div className="banner info">{detail.rolloutState}</div>
            </div>
          </div>
        </div>
      </div>

        <DetailStateStrip
        items={[
          {
            label: 'Dependency count',
            value: String(dependencyCount),
            detail: 'Number of explicit catalog, pricing, campaign, or reporting dependencies currently surfaced.',
            tone: dependencyCount > 2 ? 'warning' : 'info',
          },
          {
            label: 'Service modes',
            value: apiItem?.serviceModes?.length ? String(apiItem.serviceModes.length) : 'Default',
            detail: 'Returned service delivery modes or fallback template modes for this record.',
            tone: apiItem?.serviceModes?.length ? 'success' : 'neutral',
          },
          {
            label: 'Release readiness',
            value: service.status === 'Archived' ? 'Archive' : service.status === 'Draft' ? 'Review' : 'Live',
            detail: 'Summarizes whether the route is operating as a draft workspace, live definition, or historical reference.',
            tone: service.status === 'Draft' ? 'warning' : service.status === 'Active' ? 'success' : 'neutral',
          },
        ]}
      />


        <div className="split-shell admin-v18-secondary-grid">
        <div className="info-stack">
          <div className="card">
            <h3 className="section-title">Release packet and evidence views</h3>
            <EvidenceCardGrid items={releaseCards} />
          </div>

          <div className="card">
            <h3 className="section-title">Catalog metadata</h3>
            <MetadataGrid
              items={[
                {
                  label: 'Rollout state',
                  value: detail.rolloutState,
                  detail: 'Visible operational state that downstream teams should review before approving a change.',
                },
                {
                  label: 'Version owner',
                  value: detail.owner,
                  detail: 'Defines who owns the current controlled change packet.',
                },
                {
                  label: 'Published tags',
                  value: tags,
                  detail: 'Useful for reporting, filtering, and downstream service discovery contexts.',
                },
                {
                  label: 'Duration profile',
                  value: apiItem?.durationMinutes ? `${apiItem.durationMinutes} minutes` : 'Not returned',
                  detail: 'Duration should remain aligned with booking slot rules and clinical expectations.',
                },
              ]}
            />
          </div>
        </div>

        <div className="info-stack">
          {apiItem ? <CatalogAdminActions serviceId={apiItem.id} status={apiItem.status} disabled={result.source !== 'api'} /> : null}
          <div className="card admin-v18-surface-card">
            <h3 className="section-title">Publish and archive gates</h3>
            <ul className="data-points muted">
              {result.data.workspace.guardrails.map((rule) => (
                <li key={rule}>{rule}</li>
              ))}
              <li>Review pricing and support dependencies before pushing changes into a live market.</li>
              <li>Archive decisions should confirm that historical analytics and reporting remain interpretable.</li>
            </ul>
          </div>

          <div className="card admin-v18-surface-card">
            <h3 className="section-title">Recommended secondary states</h3>
            <ul className="data-points muted">
              <li>Draft review with pending taxonomy edits</li>
              <li>Dependency warning state when pricing or campaign bindings still conflict</li>
              <li>Publish-ready state after booking, reporting, and support checks are complete</li>
              <li>Archive-safe state with historical references preserved</li>
            </ul>
          </div>
        </div>
        </div>
      </div>
    </PortalShell>
  );
}
