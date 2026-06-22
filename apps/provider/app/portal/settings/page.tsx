'use client';

import Link from 'next/link';
import { useProviderLocale } from '@/components/i18n/provider-locale-provider';
import { getProviderPortalCopy } from '@/lib/i18n/provider-portal-copy';

export default function ProviderSettingsIndexPage() {
  const { locale, dir } = useProviderLocale();
  const copy = getProviderPortalCopy(locale).settings;

  return (
    <div className="page-stack" dir={dir}>
      <section className="page-header">
        <div>
          <span className="eyebrow">PR-24</span>
          <h1>{copy.title}</h1>
          <p className="muted">{copy.subtitle}</p>
        </div>
      </section>

      <section className="quick-link-grid">
        <Link href="/portal/settings/facilities" className="quick-link-card">
          <span className="detail-label">{copy.facilitiesLabel}</span>
          <strong>{copy.facilitiesTitle}</strong>
          <p className="muted small">{copy.facilitiesText}</p>
        </Link>
        <Link href="/portal/team" className="quick-link-card">
          <span className="detail-label">{copy.teamLabel}</span>
          <strong>{copy.teamTitle}</strong>
          <p className="muted small">{copy.teamText}</p>
        </Link>
        <Link href="/portal/settings/access" className="quick-link-card">
          <span className="detail-label">HSP access</span>
          <strong>Inter-center access</strong>
          <p className="muted small">Review organization linkage, primary facility scope, and consented cross-facility paths.</p>
        </Link>
        <Link href="/portal/analytics" className="quick-link-card">
          <span className="detail-label">{copy.analyticsLabel}</span>
          <strong>{copy.analyticsTitle}</strong>
          <p className="muted small">{copy.analyticsText}</p>
        </Link>
      </section>

      <section className="workspace-grid top-align-grid">
        <article className="panel-card">
          <div className="panel-header"><h2>{copy.coverageTitle}</h2></div>
          <div className="timeline-stack">
            <div className="timeline-step"><span className="detail-label">1</span><div><strong>{copy.step1Title}</strong><p className="muted small">{copy.step1Text}</p></div></div>
            <div className="timeline-step"><span className="detail-label">2</span><div><strong>{copy.step2Title}</strong><p className="muted small">{copy.step2Text}</p></div></div>
            <div className="timeline-step"><span className="detail-label">3</span><div><strong>{copy.step3Title}</strong><p className="muted small">{copy.step3Text}</p></div></div>
          </div>
        </article>
        <article className="panel-card">
          <div className="panel-header"><h2>{copy.recommendedPath}</h2></div>
          <div className="list-stack">
            <Link href="/portal/settings/facilities" className="btn btn-secondary btn-full">{copy.openFacilities}</Link>
            <Link href="/portal/team" className="btn btn-secondary btn-full">{copy.openTeam}</Link>
            <Link href="/portal/settings/access" className="btn btn-secondary btn-full">Open HSP access</Link>
            <Link href="/portal/billing" className="btn btn-secondary btn-full">{copy.reviewBilling}</Link>
          </div>
        </article>
      </section>
    </div>
  );
}
