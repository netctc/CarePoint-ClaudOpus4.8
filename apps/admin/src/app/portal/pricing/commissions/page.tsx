import Link from 'next/link';
import { DataSourceBanner } from '@/components/admin/data-source-banner';
import { PricingAdminActions } from '@/components/admin/pricing-admin-actions';
import { PricingRulesTable } from '@/components/admin/pricing-rules-table';
import { PortalShell } from '@/components/layout/portal-shell';
import { loadIntegratedPricingWorkspace } from '@/lib/api/admin-server';

export default async function PricingRulesPage() {
  const result = await loadIntegratedPricingWorkspace();
  const selectedApi = result.data.apiItems?.[0];

  return (
    <PortalShell currentPath="/portal/pricing/commissions">
      <DataSourceBanner source={result.source} error={result.error} />

      <div className="hero-panel">
        <div className="hero-panel-grid">
          <div className="hero-copy">
            <div className="page-eyebrow">A-10 · Pricing and commission rules</div>
            <h2 className="hero-title">Commission governance with publish control, scenario simulation, and conflict visibility</h2>
            <p className="hero-subtitle">
              The new pricing design transforms this module into a full governance workspace: versioned rules, pre-publish simulations, and explicit conflict review before finance-impacting changes go live.
            </p>
            <div className="hero-actions">
              <Link className="button primary" href="/portal/pricing/simulator">Open simulator</Link>
              <button className="button secondary">Compare rule versions</button>
            </div>
            <div className="hero-metrics">
              {result.data.workspace.summary.map((item) => (
                <div key={item.label} className="hero-metric">
                  <div className="hero-metric-label">{item.label}</div>
                  <div className="hero-metric-value">{item.value}</div>
                  <div className="hero-metric-detail">{item.detail}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="info-stack">
            <div className="soft-card">
              <div className="panel-header">
                <div>
                  <h3 className="section-title" style={{ marginBottom: 6 }}>Recommended addition</h3>
                  <div style={{ fontWeight: 800, fontSize: 22 }}>Pricing rule simulator</div>
                </div>
                <span className="tag">New page</span>
              </div>
              <p className="muted" style={{ marginTop: 0 }}>The new design package includes a dedicated simulation page to validate gross, provider, and platform outcomes before publishing.</p>
              <Link className="button secondary" href="/portal/pricing/simulator">Open simulation workspace</Link>
            </div>
            <div className="mini-card">
              <h3 className="section-title">Guardrails before publish</h3>
              <ul className="data-points muted">
                {result.data.workspace.guardrails.map((rule) => (
                  <li key={rule}>{rule}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>

      <div className="split-shell">
        <div className="info-stack">
          <PricingRulesTable items={result.data.items} />
          <div className="card">
            <h3 className="section-title">Simulation preview</h3>
            <div className="list-stack">
              {result.data.workspace.simulations.map((simulation) => (
                <div key={simulation.scenario} className="list-row">
                  <div>
                    <div className="list-row-title">{simulation.scenario}</div>
                    <div className="muted">Gross: {simulation.gross}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div>Provider: {simulation.provider}</div>
                    <div className="muted">Platform: {simulation.platform}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="info-stack">
          {selectedApi ? <PricingAdminActions ruleId={selectedApi.id} serviceCode={selectedApi.serviceCode} amountMinor={selectedApi.baseAmountMinor} disabled={result.source !== 'api'} /> : null}
          <div className="card">
            <h3 className="section-title">Rule scheduler</h3>
            <div className="label">
              Selected rule
              <input className="input" defaultValue={selectedApi?.name || 'Select a live rule'} />
            </div>
            <div className="label" style={{ marginTop: 14 }}>
              Service code
              <input className="input" defaultValue={selectedApi?.serviceCode || ''} />
            </div>
            <div className="label" style={{ marginTop: 14 }}>
              Publish note
              <textarea className="textarea" placeholder="Explain overlap checks, affected services, and rollback expectations." />
            </div>
          </div>
        </div>
      </div>
    </PortalShell>
  );
}
