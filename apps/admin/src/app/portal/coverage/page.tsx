'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { PortalShell } from '@/components/layout/portal-shell';
import { StatsGrid, type StatItem } from '@/components/ui/stats-grid';
import { getCoverageStats, type CoverageStats } from '@/lib/api/coverage-api';

/* ─── Navigation Tabs ───────────────────────────────────────────── */

const coverageTabs = [
  { label: 'Insurance Providers', href: '/portal/coverage/insurance-providers' },
  { label: 'Plans', href: '/portal/coverage/plans' },
  { label: 'Policies', href: '/portal/coverage/policies' },
  { label: 'Geographic', href: '/portal/coverage/geographic' },
  { label: 'Network', href: '/portal/coverage/network' },
];

/* ─── Main Page Component ───────────────────────────────────────── */

export default function CoverageOverviewPage() {
  const pathname = usePathname();
  const [stats, setStats] = useState<CoverageStats | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchStats = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getCoverageStats();
      setStats(data);
    } catch {
      // Fallback to placeholder stats on error
      setStats({
        activePlans: 0,
        insuranceProviders: 0,
        pendingValidations: 0,
        coverageRate: 0,
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  const statItems: StatItem[] = [
    {
      label: 'Active Plans',
      value: stats?.activePlans ?? '—',
      href: '/portal/coverage/plans?status=active',
    },
    {
      label: 'Insurance Providers',
      value: stats?.insuranceProviders ?? '—',
      href: '/portal/coverage/insurance-providers',
    },
    {
      label: 'Pending Validations',
      value: stats?.pendingValidations ?? '—',
    },
    {
      label: 'Coverage Rate',
      value: stats?.coverageRate != null ? `${stats.coverageRate}%` : '—',
    },
  ];

  return (
    <PortalShell currentPath="/portal/coverage">
      <div style={{ display: 'grid', gap: 24 }}>
        {/* Page Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 800, letterSpacing: '-0.02em' }}>
            Coverage Management
          </h1>
        </div>

        {/* Stats Grid */}
        <StatsGrid items={statItems} loading={loading} />

        {/* Navigation Tabs */}
        <nav aria-label="Coverage sections">
          <div
            style={{
              display: 'flex',
              gap: 4,
              borderBottom: '2px solid var(--border, #e2e8f0)',
              paddingBottom: 0,
              overflowX: 'auto',
            }}
          >
            {coverageTabs.map((tab) => {
              const isActive = pathname === tab.href;
              return (
                <Link
                  key={tab.href}
                  href={tab.href}
                  style={{
                    padding: '12px 20px',
                    fontSize: '0.88rem',
                    fontWeight: 700,
                    color: isActive ? 'var(--primary, #2563eb)' : 'var(--muted, #64748b)',
                    textDecoration: 'none',
                    borderBottom: isActive ? '2px solid var(--primary, #2563eb)' : '2px solid transparent',
                    marginBottom: -2,
                    whiteSpace: 'nowrap',
                    transition: 'color 150ms ease, border-color 150ms ease',
                  }}
                  aria-current={isActive ? 'page' : undefined}
                >
                  {tab.label}
                </Link>
              );
            })}
          </div>
        </nav>

        {/* Quick Access Cards */}
        <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
          <QuickAccessCard
            title="Insurance Providers"
            description="Manage insurance provider directory with contact information and status tracking."
            href="/portal/coverage/insurance-providers"
          />
          <QuickAccessCard
            title="Coverage Plans"
            description="Configure and manage coverage plans with deductibles, copays, and coinsurance."
            href="/portal/coverage/plans"
          />
          <QuickAccessCard
            title="Policies"
            description="Manage coverage policies with version control and publish/suspend workflows."
            href="/portal/coverage/policies"
          />
          <QuickAccessCard
            title="Geographic Coverage"
            description="Define geographic areas covered by each plan including regions and zip codes."
            href="/portal/coverage/geographic"
          />
          <QuickAccessCard
            title="Network Providers"
            description="Manage in-network and out-of-network provider directory by plan and tier."
            href="/portal/coverage/network"
          />
        </section>
      </div>
    </PortalShell>
  );
}

/* ─── Quick Access Card ─────────────────────────────────────────── */

function QuickAccessCard({ title, description, href }: { title: string; description: string; href: string }) {
  return (
    <Link
      href={href}
      style={{
        display: 'block',
        padding: 20,
        background: 'rgba(255, 255, 255, 0.92)',
        border: '1px solid var(--border, #e2e8f0)',
        borderRadius: 16,
        textDecoration: 'none',
        transition: 'border-color 150ms ease, box-shadow 150ms ease',
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLElement).style.borderColor = 'var(--primary, #2563eb)';
        (e.currentTarget as HTMLElement).style.boxShadow = '0 4px 12px rgba(37, 99, 235, 0.08)';
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.borderColor = 'var(--border, #e2e8f0)';
        (e.currentTarget as HTMLElement).style.boxShadow = 'none';
      }}
    >
      <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: 'var(--text, #0f172a)', letterSpacing: '-0.01em' }}>
        {title}
      </h3>
      <p style={{ margin: '8px 0 0', fontSize: '0.84rem', color: 'var(--muted, #64748b)', lineHeight: 1.5 }}>
        {description}
      </p>
    </Link>
  );
}
