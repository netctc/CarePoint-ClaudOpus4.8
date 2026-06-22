'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { EvidencePanel } from '@/components/shared/evidence-panel';
import { WorkspaceStateStrip } from '@/components/shared/workspace-state-strip';
import { providerApi } from '@/services/api-client';
import { appendProviderSubjectParams } from '@/lib/subject-links';
import { useProviderLocale } from '@/components/i18n/provider-locale-provider';
import { getProviderDetailCopy } from '@/lib/i18n/provider-detail-copy';

function patientNameFromThread(thread: any) {
  return thread?.patientName || thread?.participantLabel || thread?.messages?.find((item: any) => !item.isMine)?.senderName || 'Patient';
}

function patientInitials(name: string) {
  return name.split(' ').filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase() ?? '').join('') || 'PT';
}

function formatDateTime(value?: string | null, locale?: string) {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString(locale);
}

export default function ConversationThreadPage() {
  const { locale, dir } = useProviderLocale();
  const copy = getProviderDetailCopy(locale).threadDetail;
  const params = useParams<{ threadId: string }>();
  const { threadId } = params;
  const [thread, setThread] = useState<any>(null);
  const [draft, setDraft] = useState('');
  const [urgentNote, setUrgentNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [urgentSaving, setUrgentSaving] = useState(false);

  async function load() {
    try {
      setError(null);
      setThread(await providerApi.thread(threadId));
    } catch (err) {
      setError(err instanceof Error ? err.message : copy.unableLoad);
    }
  }

  useEffect(() => {
    load();
  }, [threadId]);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!draft.trim()) return;
    setSending(true);
    try {
      await providerApi.sendMessage(threadId, draft.trim());
      setDraft('');
      await load();
    } finally {
      setSending(false);
    }
  }

  async function updateUrgent(mode: 'acknowledge' | 'escalate' | 'resolve') {
    setUrgentSaving(true);
    setError(null);
    try {
      if (mode === 'acknowledge') await providerApi.acknowledgeUrgentThread(threadId, urgentNote || copy.acknowledgedDefault);
      if (mode === 'escalate') await providerApi.escalateUrgentThread(threadId, { note: urgentNote || copy.escalatedDefault, queue: 'Clinical Safety', severity: 'HIGH', ownerName: 'Clinical Safety' });
      if (mode === 'resolve') await providerApi.resolveUrgentThread(threadId, urgentNote || copy.resolvedDefault);
      setUrgentNote('');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : copy.unableUrgent);
    } finally {
      setUrgentSaving(false);
    }
  }

  const patientName = useMemo(() => patientNameFromThread(thread), [thread]);
  const urgentEscalation = thread?.urgentEscalation;
  const messages = thread?.messages ?? [];
  const latestInbound = [...messages].reverse().find((item: any) => !item.isMine);
  const chartHref = thread?.patientId ? appendProviderSubjectParams(`/portal/chart/${thread.patientId}`, thread) : null;

  if (error) return <div className="status-chip status-danger">{error}</div>;
  if (!thread) return <div className="status-chip status-info">{copy.loading}</div>;

  return (
    <div className="page-stack" dir={dir}>
      <section className="page-header split-header">
        <div>
          <span className="eyebrow">PR-17</span>
          <h1>{thread.subject ?? copy.titleFallback}</h1>
          <p className="muted">Clinical conversation workspace with urgent escalation controls, patient context, and secure reply composer.</p>
        </div>
        <div className="header-actions">
          <Link href="/portal/messages" className="btn btn-secondary">Back to inbox</Link>
          <Link href="/portal/queue" className="btn btn-primary">Queue workspace</Link>
        </div>
      </section>

      {urgentEscalation ? (
        <div className="banner banner-warning">
          <div>
            <strong>Urgent symptom flag</strong>
            <p className="muted small">Symptoms: {(urgentEscalation.symptoms ?? []).join(', ')}. {urgentEscalation.guidance}</p>
          </div>
          <div className="action-row wrap-row">
            <button className="btn btn-secondary" type="button" disabled={urgentSaving} onClick={() => void updateUrgent('acknowledge')}>{copy.acknowledge}</button>
            <button className="btn btn-primary" type="button" disabled={urgentSaving} onClick={() => void updateUrgent('escalate')}>Escalate now</button>
            <button className="btn btn-secondary" type="button" disabled={urgentSaving} onClick={() => void updateUrgent('resolve')}>Resolve flag</button>
          </div>
        </div>
      ) : null}

      <WorkspaceStateStrip
        items={[
          { label: 'Messages', value: String(messages.length), tone: 'info' },
          { label: 'Patient', value: patientName, tone: 'info' },
          { label: 'Urgent state', value: urgentEscalation ? 'Flagged' : 'Routine', tone: urgentEscalation ? 'warning' : 'success' },
          { label: 'Last reply', value: formatDateTime(messages[messages.length - 1]?.createdAt), tone: 'info' },
        ]}
      />

      <section className="conversation-shell">
        <article className="conversation-center panel-card">
          <div className="conversation-day-pill">Secure thread</div>
          <div className="chat-thread provider-chat-thread">
            {messages.map((message: any) => (
              <div key={message.id} className={`message-row ${message.isMine ? 'message-row-self' : ''}`}>
                {!message.isMine ? <span className="message-avatar">{patientInitials(message.senderName || patientName)}</span> : null}
                <div className={`message-bubble ${message.isMine ? 'message-internal' : ''}`}>
                  <div className="message-meta">
                    <strong>{message.senderName}</strong>
                    <span className="muted small">{formatDateTime(message.createdAt)}</span>
                  </div>
                  <p>{message.body}</p>
                </div>
              </div>
            ))}
          </div>

          <form className="composer-shell" onSubmit={onSubmit}>
            <div className="composer-toolbar">
              <span>Clinical template</span>
              <span>Patient education</span>
              <span>Secure attachment</span>
            </div>
            <div className="composer-input-row">
              <textarea value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="Write a secure message update" />
              <button className="composer-send" type="submit" disabled={sending}>{sending ? '…' : '→'}</button>
            </div>
          </form>
        </article>

        <div className="workspace-side-stack">
          <article className="panel-card conversation-right-rail">
            <div className="profile-avatar-large">{patientInitials(patientName)}</div>
            <h2>{patientName}</h2>
            <p className="muted">Current thread participant</p>
            <div className="profile-stat-list detail-list">
              <div><span className="detail-label">Participant label</span><strong>{thread.participantLabel ?? patientName}</strong></div>
              <div><span className="detail-label">Latest inbound</span><strong>{formatDateTime(latestInbound?.createdAt)}</strong></div>
              <div><span className="detail-label">Escalation queue</span><strong>{urgentEscalation?.queue ?? 'Routine inbox'}</strong></div>
            </div>
            <div className="conversation-action-grid">
              <Link href="/portal/telehealth" className="mini-action-card">Telehealth</Link>
              {chartHref ? <Link href={chartHref} className="mini-action-card">Chart</Link> : <span className="mini-action-card muted">Chart unavailable</span>}
              <Link href="/portal/orders/new" className="mini-action-card">Orders</Link>
              <Link href="/portal/prescriptions/new" className="mini-action-card">Rx</Link>
            </div>
          </article>

          <EvidencePanel
            title={copy.conversationEvidence}
            badge="Audit ready"
            items={[
              { title: 'Clinical summary', detail: 'Use the thread record as a patient communication artifact paired with chart documentation when advice changes care.' },
              { title: 'Urgency note', detail: urgentEscalation?.guidance ?? 'No urgent escalation note is currently attached to this thread.' },
              { title: 'Next handoff', detail: 'Route to chart, order, prescription, or telehealth before closing the clinical loop.' },
            ]}
          />

          <article className="panel-card">
            <div className="panel-header"><h2>Urgent action note</h2></div>
            <label className="field">
              <span>Operational note</span>
              <textarea value={urgentNote} onChange={(event) => setUrgentNote(event.target.value)} placeholder="Capture rationale for acknowledge, escalate, or resolve" />
            </label>
          </article>
        </div>
      </section>
    </div>
  );
}
