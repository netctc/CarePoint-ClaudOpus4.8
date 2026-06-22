import Link from 'next/link';
import { StatusBadge } from '@/components/ui/status-badge';
import type { ProviderVerificationDetailContract } from '@/lib/api/contracts/admin';

function tone(result: 'Pass' | 'Review' | 'Fail') {
  if (result === 'Pass') return 'success';
  if (result === 'Review') return 'warning';
  return 'danger';
}

function docTone(status: 'Received' | 'Missing' | 'Rejected') {
  if (status === 'Received') return 'success';
  if (status === 'Missing') return 'warning';
  return 'danger';
}

export function ProviderReviewPanel({ detail }: { detail: ProviderVerificationDetailContract }) {
  const hasBlockingItem =
    detail.mandatoryDocs.some((doc) => doc.status !== 'Received') ||
    detail.checks.some((check) => check.result !== 'Pass');

  return (
    <div className="grid-2-balanced">
      <div className="stack-lg">
        <div className="card">
          <div className="page-header" style={{ marginBottom: 18 }}>
            <div>
              <h2 style={{ fontSize: 24, marginBottom: 6 }}>{detail.providerName}</h2>
              <p>
                {detail.organizationName} · License {detail.licenseNumber}
              </p>
            </div>
            <div className="chip-row">
              {detail.cityCoverage.map((city) => (
                <span key={city} className="chip">
                  {city}
                </span>
              ))}
            </div>
          </div>

          <div className="banner info" style={{ marginBottom: 16 }}>
            Final queue decisions create the initial provider master record and downstream finance onboarding state.
          </div>

          <h3 className="section-title">Mandatory documentation</h3>
          <div className="metric-list">
            {detail.mandatoryDocs.map((doc) => (
              <div key={doc.name} className="metric-item">
                <div>{doc.name}</div>
                <StatusBadge tone={docTone(doc.status)}>{doc.status}</StatusBadge>
              </div>
            ))}
          </div>

          <h3 className="section-title" style={{ marginTop: 22 }}>Verification checks</h3>
          <div className="metric-list">
            {detail.checks.map((check) => (
              <div key={check.label} className="metric-item">
                <div>{check.label}</div>
                <StatusBadge tone={tone(check.result)}>{check.result}</StatusBadge>
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <h3 className="section-title">Risk notes</h3>
          <ul className="simple-list muted">
            {detail.riskNotes.map((note) => (
              <li key={note}>{note}</li>
            ))}
          </ul>
        </div>
      </div>

      <div className="stack-lg">
        <div className="card">
          <h3 className="section-title">Decision workspace</h3>
          <div className={hasBlockingItem ? 'banner warning' : 'banner info'} style={{ marginBottom: 16 }}>
            {hasBlockingItem
              ? 'Approval is blocked until all mandatory documentation is received and all checks pass or are formally escalated.'
              : 'Submission is approval-ready. Capture a reviewer note before finalizing the outcome.'}
          </div>

          <div className="label">
            Review outcome
            <select className="select" defaultValue="">
              <option value="">Select outcome</option>
              <option>Approve provider</option>
              <option>Request changes</option>
              <option>Reject application</option>
              <option>Escalate high-risk review</option>
            </select>
          </div>

          <div className="label" style={{ marginTop: 14 }}>
            Reviewer note
            <textarea className="textarea" placeholder="Enter audit-ready rationale, blocked checks, missing evidence, and next actions." />
          </div>

          <div className="label" style={{ marginTop: 14 }}>
            Follow-up owner
            <select className="select" defaultValue="">
              <option value="">Select owner</option>
              <option>Provider Ops</option>
              <option>Finance onboarding</option>
              <option>Compliance review</option>
              <option>Safety / quality</option>
            </select>
          </div>

          <div className="inline-actions" style={{ marginTop: 16 }}>
            <button className="button primary">Save decision</button>
            <button className="button secondary">Add internal note</button>
            <button className="button danger">Reject application</button>
          </div>
        </div>

        <div className="card">
          <h3 className="section-title">Expected audit trail</h3>
          <ul className="simple-list muted">
            <li>provider_review.detail_view</li>
            <li>provider_review.note_added</li>
            <li>provider_review.decision_recorded</li>
          </ul>
          <div className="inline-actions" style={{ marginTop: 16 }}>
            <Link className="button secondary" href="/portal/providers/onboarding">
              Back to queue
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
