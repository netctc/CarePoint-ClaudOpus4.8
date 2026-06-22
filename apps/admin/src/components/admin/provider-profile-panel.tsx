import { StatusBadge } from '@/components/ui/status-badge';
import type { ProviderProfileContract } from '@/lib/api/contracts/admin';
import { formatUtcDateTime } from '@/lib/formatters';

function toneForStatus(status: ProviderProfileContract['operatingStatus']) {
  if (status === 'Active') return 'success';
  if (status === 'Pending re-verification') return 'warning';
  return 'danger';
}

function toneForCredential(status: ProviderProfileContract['credentialHealth']) {
  if (status === 'Healthy') return 'success';
  if (status === 'Expiring soon') return 'warning';
  return 'danger';
}

function toneForBooking(status: ProviderProfileContract['bookingEligibility']) {
  if (status === 'Eligible') return 'success';
  if (status === 'Limited') return 'warning';
  return 'danger';
}

function toneForPayout(status: ProviderProfileContract['payoutReadiness']) {
  if (status === 'Ready') return 'success';
  if (status === 'Pending') return 'warning';
  return 'danger';
}

function toneForCredentialLine(status: 'Valid' | 'Expiring soon' | 'Missing' | 'Rejected') {
  if (status === 'Valid') return 'success';
  if (status === 'Expiring soon') return 'warning';
  return 'danger';
}

export function ProviderProfilePanel({ detail }: { detail: ProviderProfileContract }) {
  return (
    <div className="stack-lg">
      <div className="grid-3">
        <div className="card">
          <h3 className="section-title">Operating status</h3>
          <div className="metric-list">
            <div className="metric-item">
              <div>Status</div>
              <StatusBadge tone={toneForStatus(detail.operatingStatus)}>{detail.operatingStatus}</StatusBadge>
            </div>
            <div className="metric-item">
              <div>Booking eligibility</div>
              <StatusBadge tone={toneForBooking(detail.bookingEligibility)}>{detail.bookingEligibility}</StatusBadge>
            </div>
            <div className="metric-item">
              <div>Payout readiness</div>
              <StatusBadge tone={toneForPayout(detail.payoutReadiness)}>{detail.payoutReadiness}</StatusBadge>
            </div>
            <div className="metric-item">
              <div>Credential health</div>
              <StatusBadge tone={toneForCredential(detail.credentialHealth)}>{detail.credentialHealth}</StatusBadge>
            </div>
          </div>
        </div>

        <div className="card">
          <h3 className="section-title">Profile summary</h3>
          <div className="metric-list">
            <div className="metric-item"><div>Type</div><div>{detail.providerType}</div></div>
            <div className="metric-item"><div>Specialty</div><div>{detail.specialty}</div></div>
            <div className="metric-item"><div>Primary market</div><div>{detail.primaryMarket}</div></div>
            <div className="metric-item"><div>License</div><div>{detail.licenseNumber}</div></div>
            <div className="metric-item"><div>Last reviewed</div><div>{formatUtcDateTime(detail.lastReviewedAt)}</div></div>
          </div>
        </div>

        <div className="card">
          <h3 className="section-title">7-day operating snapshot</h3>
          <div className="metric-list">
            <div className="metric-item"><div>Active bookings</div><div>{detail.rosterSummary.activeBookings7d}</div></div>
            <div className="metric-item"><div>Completion rate</div><div>{detail.rosterSummary.completionRate}</div></div>
            <div className="metric-item"><div>Refund rate</div><div>{detail.rosterSummary.refundRate}</div></div>
            <div className="metric-item"><div>CSAT</div><div>{detail.rosterSummary.csat}</div></div>
          </div>
        </div>
      </div>

      <div className="grid-2-balanced">
        <div className="stack-lg">
          <div className="card">
            <div className="page-header" style={{ marginBottom: 18 }}>
              <div>
                <h2 style={{ fontSize: 24, marginBottom: 6 }}>{detail.providerName}</h2>
                <p>{detail.organizationName}</p>
              </div>
              <div className="chip-row">
                <span className="chip">{detail.telehealthEligible ? 'Telehealth enabled' : 'Telehealth off'}</span>
                <span className="chip">{detail.inPersonEligible ? 'In-person enabled' : 'In-person off'}</span>
              </div>
            </div>

            <h3 className="section-title">Credentials</h3>
            <div className="metric-list">
              {detail.credentials.map((credential) => (
                <div key={credential.name} className="metric-item">
                  <div>
                    <div style={{ fontWeight: 700 }}>{credential.name}</div>
                    <div className="muted">{credential.expiry ? `Expires ${credential.expiry}` : 'No expiry recorded'}</div>
                  </div>
                  <StatusBadge tone={toneForCredentialLine(credential.status)}>{credential.status}</StatusBadge>
                </div>
              ))}
            </div>
          </div>

          <div className="card">
            <h3 className="section-title">Linked queues and dependencies</h3>
            <div className="metric-list">
              <div className="metric-item"><div>Onboarding record</div><div>{detail.linkedQueues.onboardingStatus}</div></div>
              <div className="metric-item"><div>Support tickets open</div><div>{detail.linkedQueues.supportTicketsOpen}</div></div>
              <div className="metric-item"><div>Safety cases open</div><div>{detail.linkedQueues.safetyCasesOpen}</div></div>
              <div className="metric-item"><div>Payout exceptions open</div><div>{detail.linkedQueues.payoutExceptionsOpen}</div></div>
            </div>
          </div>
        </div>

        <div className="stack-lg">
          <div className="card">
            <h3 className="section-title">Status change actions</h3>
            <div className="label">
              Effective status
              <select className="select" defaultValue={detail.operatingStatus}>
                <option>Active</option>
                <option>Restricted</option>
                <option>Pending re-verification</option>
                <option>Suspended</option>
              </select>
            </div>
            <div className="label" style={{ marginTop: 14 }}>
              Reason code
              <select className="select" defaultValue="">
                <option value="">Select reason</option>
                <option>Credential gap</option>
                <option>Safety investigation</option>
                <option>Payout compliance hold</option>
                <option>Manual leadership override</option>
              </select>
            </div>
            <div className="label" style={{ marginTop: 14 }}>
              Audit-ready note
              <textarea className="textarea" placeholder="Explain the status change, effective time, downstream impact, and required follow-up." />
            </div>
            <div className="inline-actions" style={{ marginTop: 16 }}>
              <button className="button primary">Save status change</button>
              <button className="button secondary">Request re-verification</button>
              <button className="button danger">Suspend bookings</button>
            </div>
          </div>

          <div className="card">
            <h3 className="section-title">Guardrails before save</h3>
            <ul className="simple-list muted">
              {detail.statusChangeGuardrails.map((rule) => (
                <li key={rule}>{rule}</li>
              ))}
            </ul>
          </div>

          <div className="card">
            <h3 className="section-title">Timeline</h3>
            <div className="timeline-list">
              {detail.timeline.map((entry) => (
                <div key={`${entry.at}-${entry.event}`} className="timeline-item">
                  <div style={{ fontWeight: 700 }}>{formatUtcDateTime(entry.at)}</div>
                  <div className="muted">{entry.event}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
