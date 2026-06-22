import { StatusBadge } from '@/components/ui/status-badge';
import type { SafetyCaseContract } from '@/lib/api/contracts/admin';
import { formatUtcDateTime } from '@/lib/formatters';

function severityTone(severity: SafetyCaseContract['severity']): 'warning' | 'danger' | 'info' {
  if (severity === 'Minor') return 'info';
  if (severity === 'Major') return 'warning';
  return 'danger';
}

function statusTone(status: SafetyCaseContract['status']): 'success' | 'warning' | 'info' {
  if (status === 'Closed') return 'success';
  if (status === 'Escalated' || status === 'Pending approval') return 'warning';
  return 'info';
}

function approvalTone(decision: SafetyCaseContract['approvals'][number]['decision']): 'success' | 'warning' | 'info' {
  if (decision === 'Approved') return 'success';
  if (decision === 'Changes requested') return 'warning';
  return 'info';
}

export function SafetyCasePanel({ item }: { item: SafetyCaseContract }) {
  return (
    <div className="stack-lg">
      <div className="grid-3">
        <div className="card">
          <h3 className="section-title">Case status</h3>
          <div className="metric-list">
            <div className="metric-item">
              <div>Severity</div>
              <StatusBadge tone={severityTone(item.severity)}>{item.severity}</StatusBadge>
            </div>
            <div className="metric-item">
              <div>Status</div>
              <StatusBadge tone={statusTone(item.status)}>{item.status}</StatusBadge>
            </div>
            <div className="metric-item"><div>Category</div><div>{item.category}</div></div>
            <div className="metric-item"><div>Next review</div><div>{formatUtcDateTime(item.nextReviewAt)}</div></div>
          </div>
        </div>

        <div className="card">
          <h3 className="section-title">Ownership</h3>
          <div className="metric-list">
            <div className="metric-item"><div>Investigator</div><div>{item.investigator}</div></div>
            <div className="metric-item"><div>Linked source</div><div>{item.linkedSource}</div></div>
            <div className="metric-item"><div>Dual approval</div><div>{item.dualApprovalRequired ? 'Required' : 'Not required'}</div></div>
          </div>
        </div>

        <div className="card">
          <h3 className="section-title">Immediate controls</h3>
          <div className="inline-actions" style={{ marginBottom: 16 }}>
            <button className="button secondary">Assign investigator</button>
            <button className="button secondary">Change severity</button>
            <button className="button primary">Request approval</button>
          </div>
          <div className="callout warning">
            <strong>Closure rule:</strong> {item.dualApprovalRequired ? 'Dual approval is required before closure or major outcome changes.' : 'Single-reviewer closure path is allowed.'}
          </div>
        </div>
      </div>

      <div className="grid-2-balanced">
        <div className="stack-lg">
          <div className="card">
            <div className="page-header" style={{ marginBottom: 16 }}>
              <div>
                <h2 style={{ fontSize: 22, marginBottom: 4 }}>Case summary</h2>
                <p>{item.caseRef}</p>
              </div>
              <div className="chip-row">
                <span className="chip">{item.category}</span>
                <span className="chip">{item.linkedSource}</span>
              </div>
            </div>
            <p style={{ marginTop: 0 }}>{item.summary}</p>
            <h3 className="section-title">Action plan</h3>
            <ul className="simple-list">
              {item.actions.map((action) => <li key={action}>{action}</li>)}
            </ul>
          </div>

          <div className="card">
            <h3 className="section-title">Timeline</h3>
            <div className="timeline-list">
              {item.timeline.map((entry) => (
                <div className="timeline-item" key={`${entry.at}-${entry.event}`}>
                  <div style={{ fontWeight: 700 }}>{formatUtcDateTime(entry.at)}</div>
                  <div className="muted">{entry.event}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="stack-lg">
          <div className="card">
            <h3 className="section-title">Approval controls</h3>
            <div className="metric-list">
              {item.approvals.map((approval) => (
                <div className="metric-item" key={`${approval.reviewer}-${approval.decision}`}>
                  <div>
                    <div style={{ fontWeight: 700 }}>{approval.reviewer}</div>
                    <div className="muted">{approval.at ? formatUtcDateTime(approval.at) : 'Decision pending'}</div>
                  </div>
                  <StatusBadge tone={approvalTone(approval.decision)}>{approval.decision}</StatusBadge>
                </div>
              ))}
            </div>
            <div className="inline-actions" style={{ marginTop: 16 }}>
              <button className="button secondary">Record decision</button>
              <button className="button primary">Close case</button>
            </div>
          </div>

          <div className="card">
            <h3 className="section-title">Guardrails before closure</h3>
            <ul className="simple-list muted">
              {item.closureGuardrails.map((rule) => (
                <li key={rule}>{rule}</li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
