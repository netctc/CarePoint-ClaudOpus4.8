import Link from 'next/link';
import { cookies } from 'next/headers';
import { PortalShell } from '@/components/layout/portal-shell';
import { StatCard } from '@/components/ui/stat-card';
import { StatusBadge } from '@/components/ui/status-badge';
import { DataSourceBanner } from '@/components/admin/data-source-banner';
import { AdminIcon } from '@/components/ui/admin-icon';
import { loadIntegratedDashboard, loadIntegratedPaymentsWorkspace, loadRefillRequests } from '@/lib/api/admin-server';
import { formatUtcDateTime } from '@/lib/formatters';
import { getAdminDictionary, normalizeAdminLocale } from '@/lib/i18n/admin-dictionary';

function barHeight(value: number, max: number) {
  if (max <= 0) return 18;
  return Math.max(18, Math.round((value / max) * 220));
}

function settlementTone(status: string) {
  const normalized = status.toLowerCase();
  if (normalized.includes('clear') || normalized.includes('release') || normalized.includes('posted')) return 'success';
  if (normalized.includes('pending') || normalized.includes('process')) return 'info';
  if (normalized.includes('hold') || normalized.includes('mismatch')) return 'warning';
  return 'neutral';
}

export default async function DashboardPage() {
  const cookieStore = await cookies();
  const locale = normalizeAdminLocale(cookieStore.get('cc_locale')?.value);
  const t = getAdminDictionary(locale);

  const [result, refillResult, paymentsResult] = await Promise.all([
    loadIntegratedDashboard(),
    loadRefillRequests(),
    loadIntegratedPaymentsWorkspace(),
  ]);

  const { dashboard, providerDirectory, providerQueue, auditLogs, governedRefillSummary, subjectSummary } = result.data;
  const settlements = paymentsResult.data.items;

  const providersPendingAction = providerDirectory.filter((item) => item.operatingStatus !== 'Active').length;
  const queueAtRisk = providerQueue.filter((item) => item.slaHoursRemaining <= 6).length;
  const activeProviders = providerDirectory.filter((item) => item.operatingStatus === 'Active').length;
  const pendingProviders = providerDirectory.filter((item) => item.operatingStatus === 'Pending re-verification').length;
  const restrictedProviders = providerDirectory.filter((item) => item.operatingStatus === 'Restricted').length;
  const suspendedProviders = providerDirectory.filter((item) => item.operatingStatus === 'Suspended').length;
  const pendingDocs = providerQueue.filter((item) => item.docStatus !== 'Complete').length;
  const highRisk = providerQueue.filter((item) => item.riskFlag === 'High').length;
  const activePharmacyQueue = refillResult.summary?.pharmacyQueue ?? refillResult.data.filter((item) => String(item.assignedRole).toUpperCase() === 'PHARMACIST').length;
  const refillAging = refillResult.summary?.agedOver24h ?? refillResult.data.filter((item) => {
    const updatedAt = new Date((item as { updatedAtIso?: string }).updatedAtIso ?? 0).getTime();
    return Number.isFinite(updatedAt) && Date.now() - updatedAt >= 24 * 60 * 60 * 1000;
  }).length;
  const governedExportReady = governedRefillSummary?.summary?.exportReadyCount ?? 0;
  const governedEscalations = governedRefillSummary?.summary?.escalationCount ?? 0;
  const governedFailedDeliveries = governedRefillSummary?.failedDeliveries ?? governedRefillSummary?.summary?.failedDeliveryCount ?? 0;

  const operationalAlerts = [
    {
      id: 'alert-provider-sla',
      category: t.dashboard.queueCategory,
      title: `${queueAtRisk} ${t.dashboard.queueAtRiskTitle}`,
      detail: t.dashboard.queueAtRiskDetail,
      time: t.dashboard.liveQueue,
      tone: queueAtRisk > 0 ? ('warning' as const) : ('success' as const),
      href: '/portal/providers/onboarding',
      cta: t.dashboard.openQueue,
    },
    {
      id: 'alert-provider-status',
      category: t.dashboard.credentialReviewCategory,
      title: `${providersPendingAction} ${t.dashboard.providerInactiveTitle}`,
      detail: t.dashboard.providerInactiveDetail,
      time: t.dashboard.directorySnapshot,
      tone: providersPendingAction > 0 ? ('danger' as const) : ('success' as const),
      href: '/portal/providers',
      cta: t.dashboard.inspectProviders,
    },
    {
      id: 'alert-refills',
      category: t.dashboard.pharmacyQueueCategory,
      title: `${refillAging} ${t.dashboard.refillAgedTitle}`,
      detail: `${activePharmacyQueue} ${t.dashboard.refillAgedDetailSuffix}`,
      time: t.dashboard.governedRefillAudit,
      tone: refillAging > 0 ? ('warning' as const) : ('success' as const),
      href: '/portal/safety/incidents',
      cta: t.dashboard.reviewSignals,
    },
  ];

  const quickLinks = [
    { label: t.dashboard.quickOnboarding, href: '/portal/providers/onboarding', meta: t.dashboard.quickOnboardingMeta },
    { label: t.dashboard.quickBooking, href: '/portal/bookings/control-tower', meta: t.dashboard.quickBookingMeta },
    { label: t.dashboard.quickRefunds, href: '/portal/payments/refunds', meta: t.dashboard.quickRefundsMeta },
  ];

  const chartItems = [
    { label: t.common.live, value: activeProviders },
    { label: 'Pending', value: pendingProviders },
    { label: 'Restricted', value: restrictedProviders },
    { label: 'Suspended', value: suspendedProviders },
    { label: 'Docs', value: pendingDocs },
    { label: 'SLA', value: queueAtRisk },
  ];
  const maxChartValue = Math.max(...chartItems.map((item) => item.value), 1);

  return (
    <PortalShell currentPath="/portal/dashboard">
      <DataSourceBanner source={result.source} error={result.error} />

      <div className="dashboard-hero">
        <div>
          <h2>{t.dashboard.title}</h2>
          <p className="dashboard-subtitle">{t.dashboard.subtitle}</p>
        </div>
        <div className="inline-actions">
          <button className="button secondary">
            <AdminIcon name="download" />
            {t.dashboard.downloadReport}
          </button>
          <button className="button primary">
            <AdminIcon name="sync" />
            {t.dashboard.systemSync}
          </button>
        </div>
      </div>

      <div className="grid-4">
        {dashboard.kpis.map((item) => (
          <StatCard key={item.id} label={item.label} value={item.value} trend={item.trend} />
        ))}
        <StatCard label={t.dashboard.activeProviders} value={String(activeProviders)} trend={t.dashboard.activeProvidersTrend} tone="success" />
      </div>

      <div className="dashboard-layout">
        <div className="dashboard-column">
          <section className="section-card">
            <div className="section-header">
              <div className="section-header-title">
                <span className="icon-wrap" aria-hidden="true">
                  <AdminIcon name="alert" />
                </span>
                <span>{t.dashboard.operationsControl}</span>
              </div>
              <StatusBadge tone={operationalAlerts.some((item) => item.tone !== 'success') ? 'warning' : 'success'}>
                {operationalAlerts.filter((item) => item.tone !== 'success').length} {t.common.urgent}
              </StatusBadge>
            </div>

            <div className="alert-list">
              {operationalAlerts.map((alert) => (
                <div key={alert.id} className={`alert-card ${alert.tone === 'danger' ? 'danger' : alert.tone === 'warning' ? 'warning' : 'success'}`}>
                  <div className="alert-meta">
                    <span className={`alert-category ${alert.tone === 'danger' ? 'danger' : alert.tone === 'warning' ? 'warning' : 'success'}`}>{alert.category}</span>
                    <span>{alert.time}</span>
                  </div>
                  <p className="alert-card-title">{alert.title}</p>
                  <p className="muted">{alert.detail}</p>
                  <Link className="text-link" href={alert.href}>
                    {alert.cta} →
                  </Link>
                </div>
              ))}
            </div>
          </section>

          <section className="section-card" style={{ background: 'rgba(198, 215, 245, 0.85)' }}>
            <div className="section-header">
              <div className="section-header-title">
                <span className="icon-wrap" aria-hidden="true">
                  <AdminIcon name="queue" />
                </span>
                <span>{t.dashboard.commandCenter}</span>
              </div>
            </div>

            <div className="command-list">
              {quickLinks.map((item) => (
                <Link key={item.href} href={item.href} className="command-card">
                  <div className="command-copy">
                    <div className="mini-card-icon" aria-hidden="true">
                      <AdminIcon name={item.label.includes('Refund') || item.label.includes('استرداد') ? 'money' : item.label.includes('Booking') || item.label.includes('حجز') ? 'bookings' : 'providers'} />
                    </div>
                    <div>
                      <p className="command-card-title">{item.label}</p>
                      <p className="command-meta">{item.meta}</p>
                    </div>
                  </div>
                  <span className="text-link" style={{ marginTop: 0 }}>{t.common.open}</span>
                </Link>
              ))}
            </div>
          </section>
        </div>

        <div className="dashboard-column">
          <section className="card chart-card">
            <div className="chart-toolbar">
              <div>
                <h3 style={{ margin: 0, fontSize: 18 }}>{t.dashboard.providerGrowth}</h3>
                <p className="muted" style={{ margin: '4px 0 0' }}>{t.dashboard.providerGrowthSubtitle}</p>
              </div>
              <div className="segmented-control" aria-hidden="true">
                <span className="active">{t.common.current}</span>
                <span>{t.common.weekly}</span>
              </div>
            </div>

            <div className="bar-chart" aria-label={t.dashboard.providerGrowth}>
              {chartItems.map((item) => (
                <div key={item.label} className="bar-column">
                  <div className="bar-track">
                    <div className="bar-value" style={{ height: barHeight(item.value, maxChartValue) }} />
                  </div>
                  <div className="bar-label">{item.label}</div>
                </div>
              ))}
            </div>

            <div className="legend-row">
              <span className="legend-item"><span className="legend-dot" /> {t.dashboard.directoryState}</span>
              <span className="legend-item"><span className="legend-dot alt" /> {t.dashboard.queuePressure}</span>
            </div>
          </section>

          <section className="card dashboard-table-card">
            <div className="dashboard-table-header">
              <div>
                <h3 style={{ margin: 0, fontSize: 18 }}>{t.dashboard.recentSettlements}</h3>
              </div>
              <Link className="text-link" href="/portal/payments/reconciliation" style={{ marginTop: 0 }}>
                {t.dashboard.viewLedger}
              </Link>
            </div>

            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>{t.dashboard.reconciliationId}</th>
                    <th>{t.dashboard.gateway}</th>
                    <th>{t.dashboard.amount}</th>
                    <th>{t.dashboard.status}</th>
                    <th>{t.dashboard.aging}</th>
                  </tr>
                </thead>
                <tbody>
                  {settlements.slice(0, 4).map((settlement) => (
                    <tr key={settlement.id}>
                      <td style={{ fontWeight: 800 }}>{settlement.batchRef}</td>
                      <td>{settlement.gateway}</td>
                      <td style={{ fontWeight: 800 }}>{settlement.amount}</td>
                      <td>
                        <StatusBadge tone={settlementTone(settlement.status)}>{settlement.status}</StatusBadge>
                      </td>
                      <td>{settlement.aging}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>


          <section className="card dashboard-table-card">
            <div className="dashboard-table-header">
              <div>
                <h3 style={{ margin: 0, fontSize: 18 }}>{t.dashboard.subjectContextSummary}</h3>
                <p className="muted" style={{ margin: '4px 0 0' }}>{t.dashboard.subjectContextSubtitle}</p>
              </div>
              <StatusBadge tone={(subjectSummary?.familyCount ?? 0) > 0 ? 'info' : 'success'}>{subjectSummary?.familyCount ?? 0} {t.dashboard.familySubjects}</StatusBadge>
            </div>
            <div className="metric-grid">
              <div className="metric-item"><div>{t.dashboard.subjectTotal}</div><div>{subjectSummary?.total ?? 0}</div></div>
              <div className="metric-item"><div>{t.dashboard.selfProfiles}</div><div>{subjectSummary?.selfCount ?? 0}</div></div>
              <div className="metric-item"><div>{t.dashboard.familySubjects}</div><div>{subjectSummary?.familyCount ?? 0}</div></div>
              <div className="metric-item"><div>{t.dashboard.topRelationship}</div><div>{subjectSummary?.topRelationship ?? '—'}</div></div>
            </div>
          </section>
        </div>
      </div>

      <div className="grid-3">
        <div className="card">
          <div className="page-header" style={{ marginBottom: 10 }}>
            <div>
              <h3 style={{ margin: 0, fontSize: 18 }}>{t.dashboard.governedRefillSummary}</h3>
            </div>
            <StatusBadge tone={governedEscalations > 0 || governedFailedDeliveries > 0 ? 'warning' : 'success'}>
              {governedExportReady > 0 ? t.common.auditReady : t.common.noQueue}
            </StatusBadge>
          </div>
          <p className="muted" style={{ marginTop: 0 }}>{governedExportReady} {t.dashboard.exportSummaryTextPart1} {governedEscalations} {t.dashboard.exportSummaryTextPart2} {governedFailedDeliveries} {t.dashboard.exportSummaryTextPart3}</p>
          <div className="inline-actions">
            <Link className="button secondary" href="/portal/audit/logs">{t.dashboard.auditView}</Link>
            <Link className="button primary" href="/portal/reports/builder">{t.dashboard.reportBuilder}</Link>
          </div>
        </div>

        <div className="card">
          <div className="page-header" style={{ marginBottom: 10 }}>
            <div>
              <h3 style={{ margin: 0, fontSize: 18 }}>{t.dashboard.providerQueueSnapshot}</h3>
            </div>
            <StatusBadge tone={highRisk > 0 ? 'warning' : 'success'}>{highRisk > 0 ? t.common.needsReview : t.common.stable}</StatusBadge>
          </div>
          <div className="metric-list">
            <div className="metric-item"><div>{t.dashboard.pendingDocuments}</div><div>{pendingDocs}</div></div>
            <div className="metric-item"><div>{t.dashboard.highRiskSubmissions}</div><div>{highRisk}</div></div>
            <div className="metric-item"><div>{t.dashboard.itemsUnderSla}</div><div>{queueAtRisk}</div></div>
          </div>
        </div>

        <div className="card">
          <div className="page-header" style={{ marginBottom: 10 }}>
            <div>
              <h3 style={{ margin: 0, fontSize: 18 }}>{t.dashboard.recentAuditActivity}</h3>
            </div>
            <StatusBadge tone="info">{t.common.liveTrail}</StatusBadge>
          </div>
          <div className="metric-list">
            {auditLogs.slice(0, 3).map((audit) => (
              <div key={audit.id} className="metric-item">
                <div>
                  <div style={{ fontWeight: 800 }}>{audit.action}</div>
                  <div className="muted">{audit.target} · {audit.purpose || t.dashboard.recentAuditFallbackPurpose}</div>
                </div>
                <div className="muted">{formatUtcDateTime(audit.timestamp)}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </PortalShell>
  );
}
