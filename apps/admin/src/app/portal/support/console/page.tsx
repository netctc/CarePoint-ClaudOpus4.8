import Link from 'next/link';
import { cookies } from 'next/headers';
import { DataSourceBanner } from '@/components/admin/data-source-banner';
import { SupportAdminActions } from '@/components/admin/support-admin-actions';
import { PortalShell } from '@/components/layout/portal-shell';
import { SupportConsoleTable } from '@/components/admin/support-console-table';
import { StatusBadge } from '@/components/ui/status-badge';
import { loadIntegratedSupportWorkspace } from '@/lib/api/admin-server';
import { getAdminPortalCopy } from '@/lib/i18n/admin-portal-copy';
import { normalizeAdminLocale } from '@/lib/i18n/admin-dictionary';

function tone(priority: string) {
  if (priority === 'P1') return 'danger';
  if (priority === 'P2') return 'warning';
  return 'info';
}

export default async function SupportConsolePage() {
  const cookieStore = await cookies();
  const locale = normalizeAdminLocale(cookieStore.get('cc_locale')?.value);
  const copy = getAdminPortalCopy(locale).supportConsole;
  const result = await loadIntegratedSupportWorkspace();
  const selected = result.data.workspace.selectedTicket;
  const selectedItem = result.data.items.find((item) => item.ticketRef === selected.ticketRef) || result.data.items[0];

  return (
    <PortalShell currentPath="/portal/support/console">
      <DataSourceBanner source={result.source} error={result.error} />

      <div className="hero-panel">
        <div className="hero-panel-grid">
          <div className="hero-copy">
            <div className="page-eyebrow">{copy.eyebrow}</div>
            <h2 className="hero-title">{copy.title}</h2>
            <p className="hero-subtitle">
              {copy.subtitle}
            </p>
            <div className="hero-actions">
              <Link className="button primary" href={selectedItem ? `/portal/support/console/${selectedItem.id}` : '/portal/support/console'}>{copy.openTicket}</Link>
              <button className="button secondary">{copy.applyMacro}</button>
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
                  <h3 className="section-title" style={{ marginBottom: 6 }}>{copy.selectedTicket}</h3>
                  <div style={{ fontWeight: 800, fontSize: 22 }}>{selected.ticketRef}</div>
                </div>
                <StatusBadge tone={tone(selected.priority)}>{selected.priority}</StatusBadge>
              </div>
              <div className="detail-list">
                <div><span className="detail-label">{copy.owner}</span><strong>{selected.owner}</strong></div>
                <div><span className="detail-label">{copy.linkedDomain}</span><strong>{selected.linkedDomain}</strong></div>
                <div><span className="detail-label">{copy.counterparty}</span><strong>{selected.maskedCounterparty}</strong></div>
              </div>
            </div>

            <div className="mini-card">
              <h3 className="section-title">{copy.maskingControl}</h3>
              <div className="banner warning">{copy.maskingText}</div>
            </div>
          </div>
        </div>
      </div>

      <SupportConsoleTable items={result.data.items} />

      <div className="split-shell">
        <div className="card">
          <h3 className="section-title">{copy.approvedMacros}</h3>
          <div className="chip-row">
            {result.data.workspace.macros.map((macro) => (
              <span key={macro} className="chip">{macro}</span>
            ))}
          </div>
        </div>

        <div className="info-stack">
          {result.data.selectedItemId ? <SupportAdminActions itemId={result.data.selectedItemId} disabled={result.source !== 'api'} /> : null}
          <div className="card">
            <h3 className="section-title">{copy.escalationControls}</h3>
            <ul className="data-points muted">
              {selected.escalationOptions.map((option) => (
                <li key={option}>{option}</li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </PortalShell>
  );
}