import Link from 'next/link';
import { DetailStateStrip, EvidenceCardGrid, MetadataGrid } from '@/components/admin/detail-primitives';
import { PortalShell } from '@/components/layout/portal-shell';
import { loadIntegratedPricingWorkspace } from '@/lib/api/admin-server';

export default async function PricingRuleSimulatorPage() {
  const result = await loadIntegratedPricingWorkspace();
  const scenario = result.data.workspace.simulations[0];

  return (
    <PortalShell currentPath="/portal/pricing/commissions">
      <div className="page-breadcrumbs"><span>Pricing</span><span>•</span><span>Rules</span><span>•</span><span>Simulator</span></div>

      <div className="hero-panel">
        <div className="hero-panel-grid">
          <div className="hero-copy">
            <div className="page-eyebrow">A-10B · Pricing rule simulator</div>
            <h2 className="hero-title">Scenario simulation before pricing publication</h2>
            <p className="hero-subtitle">
              The pricing simulator now includes assumptions, release checks, and evidence-friendly output so operators can compare scenario outcomes before scheduling or publishing a rule.
            </p>
            <div className="hero-actions">
              <Link className="button secondary" href="/portal/pricing/commissions">Back to pricing rules</Link>
              <Link className="button secondary" href="/portal/payments/reconciliation">Open payment impacts</Link>
            </div>
            <div className="hero-metrics">
              <div className="hero-metric"><div className="hero-metric-label">Scenario</div><div className="hero-metric-value">{scenario.scenario}</div><div className="hero-metric-detail">Baseline simulation pulled from the pricing workspace.</div></div>
              <div className="hero-metric"><div className="hero-metric-label">Gross</div><div className="hero-metric-value">{scenario.gross}</div><div className="hero-metric-detail">Before commissions and platform adjustments.</div></div>
              <div className="hero-metric"><div className="hero-metric-label">Platform share</div><div className="hero-metric-value">{scenario.platform}</div><div className="hero-metric-detail">Expected retained platform amount.</div></div>
            </div>
          </div>
          <div className="info-stack">
            <div className="soft-card">
              <h3 className="section-title">Simulation inputs</h3>
              <div className="label">Market<input className="input" defaultValue="Riyadh" /></div>
              <div className="label" style={{ marginTop: 14 }}>Service<input className="input" defaultValue="Primary care telehealth" /></div>
              <div className="label" style={{ marginTop: 14 }}>Gross amount<input className="input" defaultValue="180" /></div>
              <div className="label" style={{ marginTop: 14 }}>Rule mode<select className="select" defaultValue="Published"><option>Published</option><option>Scheduled</option><option>Draft</option></select></div>
            </div>
          </div>
        </div>
      </div>

      <DetailStateStrip
        items={[
          {
            label: 'Scenario mode',
            value: scenario.scenario,
            detail: 'Comparison scenario currently loaded into the simulator.',
            tone: 'info',
          },
          {
            label: 'Provider share',
            value: scenario.provider,
            detail: 'Projected amount reaching the provider after rule application.',
            tone: 'success',
          },
          {
            label: 'Release posture',
            value: 'Simulation only',
            detail: 'Results should be validated against publish guardrails before release.',
            tone: 'warning',
          },
        ]}
      />

      <div className="split-shell" style={{ marginTop: 24 }}>
        <div className="info-stack">
          <div className="card">
            <h3 className="section-title">Outcome preview</h3>
            <div className="metric-grid-3">
              <div className="surface-tile"><div className="hero-metric-label">Gross</div><div className="hero-metric-value">{scenario.gross}</div></div>
              <div className="surface-tile"><div className="hero-metric-label">Provider</div><div className="hero-metric-value">{scenario.provider}</div></div>
              <div className="surface-tile"><div className="hero-metric-label">Platform</div><div className="hero-metric-value">{scenario.platform}</div></div>
            </div>
          </div>

          <div className="card">
            <h3 className="section-title">Simulation evidence packet</h3>
            <EvidenceCardGrid
              items={[
                {
                  title: 'Modeled commercial outcome',
                  meta: scenario.scenario,
                  description: 'The simulator now produces a design-consistent evidence packet that can be reviewed with finance, provider operations, and commercial owners before rule publication.',
                  bullets: [
                    `Gross amount: ${scenario.gross}`,
                    `Provider share: ${scenario.provider}`,
                    `Platform share: ${scenario.platform}`,
                  ],
                  badges: [
                    { label: 'Pre-publish', tone: 'warning' },
                    { label: 'Commercial check', tone: 'info' },
                  ],
                },
                {
                  title: 'Guardrails',
                  meta: 'Release validation',
                  description: 'These checks reduce drift between what is simulated here and what booking and payment flows will actually enforce after publish.',
                  bullets: result.data.workspace.guardrails,
                  badges: [{ label: 'Governed release', tone: 'info' }],
                },
              ]}
            />
          </div>
        </div>

        <div className="info-stack">
          <div className="card">
            <h3 className="section-title">Assumption summary</h3>
            <MetadataGrid
              items={[
                { label: 'Market', value: 'Riyadh', detail: 'Primary deployment market in this simulated example.' },
                { label: 'Service', value: 'Primary care telehealth', detail: 'Commercial service definition under evaluation.' },
                { label: 'Gross amount', value: '180', detail: 'Input amount before distribution logic applies.' },
                { label: 'Rule mode', value: 'Published', detail: 'Operators should compare draft, scheduled, and published behavior before release.' },
              ]}
            />
          </div>
        </div>
      </div>
    </PortalShell>
  );
}
