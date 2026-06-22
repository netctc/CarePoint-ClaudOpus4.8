'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { EvidencePanel } from '@/components/shared/evidence-panel';
import { WorkspaceStateStrip } from '@/components/shared/workspace-state-strip';
import { StatCard } from '@/components/shared/stat-card';
import { providerApi } from '@/services/api-client';
import { getMessagingInboxData } from '@/services/mock-api';
import { useProviderLocale } from '@/components/i18n/provider-locale-provider';
import { getProviderPortalCopy } from '@/lib/i18n/provider-portal-copy';

function formatDateTime(value?: string | null, locale?: string) {
  if (!value) return 'No recent message';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString(locale);
}

function activityTone(createdAt?: string | null) {
  if (!createdAt) return 'warning';
  const time = new Date(createdAt).getTime();
  if (Number.isNaN(time)) return 'info';
  const diffHours = Math.abs(Date.now() - time) / 36e5;
  if (diffHours <= 4) return 'danger';
  if (diffHours <= 24) return 'warning';
  return 'success';
}

export default function SecureMessagingInboxPage() {
  const { locale, dir } = useProviderLocale();
  const copy = getProviderPortalCopy(locale).messages;
  const fallback = useMemo(() => getMessagingInboxData(), []);
  const [threads, setThreads] = useState<any[]>([]);
  const [source, setSource] = useState<'live' | 'fallback'>('live');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result: any = await providerApi.threads();
      setThreads(result.items ?? []);
      setSource('live');
    } catch (err) {
      setThreads(
        fallback.threads.map((item) => ({
          id: item.id,
          subject: item.subject,
          participantLabel: item.counterparty,
          status: item.status,
          ownerName: item.owner,
          latestMessage: {
            body: item.preview,
            createdAt: item.sla,
          },
        })),
      );
      setSource('fallback');
      setError(err instanceof Error ? err.message : copy.unableLoad);
    } finally {
      setLoading(false);
    }
  }, [copy.unableLoad, fallback.threads]);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    return threads.filter((thread) => {
      if (!query.trim()) return true;
      return [thread.subject ?? '', thread.participantLabel ?? '', thread.latestMessage?.body ?? '', thread.ownerName ?? '']
        .join(' ')
        .toLowerCase()
        .includes(query.trim().toLowerCase());
    });
  }, [threads, query]);

  const stats = useMemo(() => {
    const recent = threads.filter((item) => typeof item.latestMessage?.createdAt === 'string' && item.latestMessage.createdAt.includes('T')).length;
    const unassigned = threads.filter((item) => String(item.ownerName ?? '').toLowerCase().includes('unassigned')).length;
    const active = threads.filter((item) => Boolean(item.latestMessage?.body)).length;
    return { total: threads.length, recent, unassigned, active };
  }, [threads]);

  const escalationItems = useMemo(() => filtered.slice(0, 4).map((thread) => ({
    title: thread.subject ?? copy.conversationLabel,
    detail: `${thread.participantLabel ?? copy.patient} • ${copy.owner}: ${thread.ownerName ?? copy.queue} • ${copy.activity}: ${formatDateTime(thread.latestMessage?.createdAt, locale)}`,
  })), [copy.activity, copy.conversationLabel, copy.owner, copy.patient, copy.queue, filtered, locale]);

  return (
    <div className="page-stack" dir={dir}>
      <section className="page-header split-header">
        <div>
          <span className="eyebrow">PR-16</span>
          <h1>{copy.title}</h1>
          <p className="muted">{copy.subtitle}</p>
        </div>
        <div className="header-actions">
          <button className="btn btn-secondary" onClick={load}>{copy.refresh}</button>
          <Link href="/portal/queue" className="btn btn-primary">{copy.returnToQueue}</Link>
        </div>
      </section>

      <div className={`banner ${source === 'live' ? 'banner-success' : 'banner-warning'}`}>
        <div>
          <strong>{source === 'live' ? copy.liveTitle : copy.fallbackTitle}</strong>
          <p className="muted small">{source === 'live' ? copy.liveText : `${copy.fallbackText} ${error ?? 'Unknown error'}.`}</p>
        </div>
        <span className={`status-chip status-${source === 'live' ? 'success' : 'warning'}`}>{source === 'live' ? 'Live' : 'Fallback'}</span>
      </div>

      <WorkspaceStateStrip
        items={[
          { label: copy.threads, value: String(stats.total), tone: 'info' },
          { label: copy.activeConversations, value: String(stats.active), tone: 'success' },
          { label: copy.unassigned, value: String(stats.unassigned), tone: stats.unassigned ? 'warning' : 'success' },
          { label: copy.recentApiTimestamps, value: String(stats.recent), tone: 'info' },
        ]}
      />

      <section className="stats-grid">
        <StatCard label={copy.inboxTotal} value={String(stats.total)} detail={copy.visibleRole} />
        <StatCard label={copy.needsOwner} value={String(stats.unassigned)} detail={copy.namedResponder} />
        <StatCard label={copy.responseWatch} value={filtered.length ? copy.open : 'Clear'} detail={copy.useThreadDetail} />
        <StatCard label={copy.dataSource} value={source === 'live' ? 'API' : copy.preview} detail={source === 'live' ? copy.liveServices : copy.fallbackSnapshot} />
      </section>

      <section className="workspace-grid top-align-grid">
        <article className="panel-card">
          <div className="panel-header"><h2>{copy.triageWorkspace}</h2><span className="status-chip status-info">{filtered.length} {copy.visible}</span></div>
          <div className="toolbar-card">
            <label className="field compact-field" style={{ flex: 1 }}>
              <span>{copy.search}</span>
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={copy.searchPlaceholder} />
            </label>
          </div>
          <div className="table-card" style={{ padding: 0, border: 0, boxShadow: 'none' }}>
            {loading && !threads.length ? <div className="status-chip status-info" style={{ margin: 20 }}>{copy.loading}</div> : null}
            <table className="data-table">
              <thead>
                <tr>
                  <th>{copy.conversation}</th>
                  <th>{copy.participant}</th>
                  <th>{copy.latestMessage}</th>
                  <th>{copy.owner}</th>
                  <th>{copy.activity}</th>
                  <th>{copy.action}</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((thread) => (
                  <tr key={thread.id}>
                    <td>
                      <strong>{thread.subject ?? copy.untitledConversation}</strong>
                      <div className="muted small">{String(thread.status ?? 'OPEN').replaceAll('_', ' ')}</div>
                    </td>
                    <td>{thread.participantLabel ?? copy.patient}</td>
                    <td>{thread.latestMessage?.body ?? copy.noMessagesYet}</td>
                    <td>{thread.ownerName ?? copy.queue}</td>
                    <td><span className={`status-chip status-${activityTone(thread.latestMessage?.createdAt)}`}>{formatDateTime(thread.latestMessage?.createdAt, locale)}</span></td>
                    <td><Link href={`/portal/messages/${thread.id}`} className="text-link">{copy.openThread}</Link></td>
                  </tr>
                ))}
                {!filtered.length ? (
                  <tr>
                    <td colSpan={6} className="muted">{copy.noThreads}</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </article>

        <div className="workspace-side-stack">
          <EvidencePanel
            title={copy.escalationWatch}
            badge={copy.messaging}
            items={escalationItems.length ? escalationItems : [{ title: copy.noVisibleThreads, detail: copy.noVisibleThreadsText }]}
          />
          <article className="panel-card">
            <div className="panel-header"><h2>{copy.operationalGuidance}</h2></div>
            <div className="timeline-stack">
              <div className="timeline-step"><span className="detail-label">1</span><div><strong>{copy.ownThread}</strong><p className="muted small">{copy.ownThreadText}</p></div></div>
              <div className="timeline-step"><span className="detail-label">2</span><div><strong>{copy.resolveUrgency}</strong><p className="muted small">{copy.resolveUrgencyText}</p></div></div>
              <div className="timeline-step"><span className="detail-label">3</span><div><strong>{copy.routeNextAction}</strong><p className="muted small">{copy.routeNextActionText}</p></div></div>
            </div>
          </article>
        </div>
      </section>
    </div>
  );
}
