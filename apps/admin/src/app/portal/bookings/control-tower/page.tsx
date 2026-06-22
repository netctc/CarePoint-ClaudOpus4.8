import { BookingAdminActions } from '@/components/admin/booking-admin-actions';
import { BookingControlTable } from '@/components/admin/booking-control-table';
import { DataSourceBanner } from '@/components/admin/data-source-banner';
import { PortalShell } from '@/components/layout/portal-shell';
import { StatusBadge } from '@/components/ui/status-badge';
import { loadIntegratedBookingWorkspace } from '@/lib/api/admin-server';
import { formatUtcDateTime } from '@/lib/formatters';

export default async function BookingControlTowerPage() {
  const result = await loadIntegratedBookingWorkspace();
  const selected = result.data.workspace.selectedBooking;
  const selectedDocuments = result.data.selectedDocuments ?? [];

  return (
    <PortalShell currentPath="/portal/bookings/control-tower">
      <DataSourceBanner source={result.source} error={result.error} />

      <div className="page-header">
        <div>
          <h2>Booking control tower</h2>
          <p>Supervise live bookings, intervene in exceptions, and capture auditable override decisions.</p>
        </div>
        <div className="inline-actions">
          <button className="button secondary">Export tower snapshot</button>
          <button className="button secondary">Open support handoff</button>
          <button className="button primary">Override booking</button>
        </div>
      </div>

      <div className="grid-3">
        {result.data.workspace.summary.map((item) => (
          <div key={item.label} className="card">
            <h3 className="section-title">{item.label}</h3>
            <div className="kpi-value">{item.value}</div>
            <p className="muted">{item.detail}</p>
          </div>
        ))}
      </div>

      <div className="grid-2-balanced">
        <div className="stack-lg">
          <BookingControlTable items={result.data.items} />

          <div className="card">
            <h3 className="section-title">Bulk exception monitor</h3>
            <ul className="simple-list muted">
              {result.data.workspace.bulkExceptionMonitor.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        </div>

        <div className="stack-lg">
          <div className="card">
            <div className="page-header" style={{ marginBottom: 16 }}>
              <div>
                <h3 className="section-title" style={{ marginBottom: 6 }}>Selected booking detail</h3>
                <div style={{ fontWeight: 700, fontSize: 22 }}>{selected.bookingRef}</div>
              </div>
              <StatusBadge tone="danger">{selected.status}</StatusBadge>
            </div>
            <div className="metric-list">
              <div className="metric-item"><div>Patient</div><div>{selected.patientMasked}</div></div>
              <div className="metric-item"><div>Provider</div><div>{selected.providerName}</div></div>
              <div className="metric-item"><div>Service</div><div>{selected.service}</div></div>
              <div className="metric-item"><div>Market</div><div>{selected.market}</div></div>
              <div className="metric-item"><div>Scheduled</div><div>{formatUtcDateTime(selected.scheduledAt)}</div></div>
              <div className="metric-item"><div>Owner</div><div>{selected.adminOwner}</div></div>
            </div>
            <div className="banner warning" style={{ marginTop: 16 }}>{selected.incidentTag}</div>
          </div>

          <div className="card">
            <h3 className="section-title">Impact summary</h3>
            <ul className="simple-list">
              {selected.impactSummary.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
            <div className="inline-actions" style={{ marginTop: 16 }}>
              {selected.actions.map((action) => (
                <button key={action} className={action === 'Reassign provider' ? 'button primary' : 'button secondary'}>{action}</button>
              ))}
            </div>
          </div>

          {result.data.selectedAppointmentId ? <BookingAdminActions appointmentId={result.data.selectedAppointmentId} providerOptions={result.data.providerOptions} bookingOptions={result.data.bookingOptions} activeHolds={result.data.activeHolds} disabled={result.source !== 'api'} /> : null}


          {result.data.activeHolds?.length ? (
            <div className="card">
              <h3 className="section-title">Active slot holds</h3>
              <div className="metric-list">
                {result.data.activeHolds.map((item) => (
                  <div key={item.id} className="metric-item">
                    <div>
                      <div style={{ fontWeight: 700 }}>{item.label}</div>
                      <div className="muted">{item.detail}</div>
                    </div>
                    <div>{formatUtcDateTime(item.expiresAt)}</div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {selectedDocuments.length ? (
            <div className="card">
              <h3 className="section-title">Booking documents</h3>
              <div className="metric-list">
                {selectedDocuments.map((item) => (
                  <div key={item.id} className="metric-item">
                    <div>
                      <div style={{ fontWeight: 700 }}>{item.label}</div>
                      <div className="muted">{item.detail}</div>
                    </div>
                    <div>{item.status}</div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}


          {result.data.bookingOptions ? (
            <div className="card">
              <h3 className="section-title">Override reason catalog</h3>
              <ul className="simple-list muted">
                {result.data.bookingOptions.overrideReasonCatalog.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          ) : null}

          <div className="card">
            <h3 className="section-title">Override guardrails</h3>
            <ul className="simple-list muted">
              {selected.guardrails.map((rule) => (
                <li key={rule}>{rule}</li>
              ))}
            </ul>
          </div>

          <div className="card">
            <h3 className="section-title">Incident tags</h3>
            <div className="metric-list">
              {result.data.workspace.incidentQueue.map((item) => (
                <div key={item.label} className="metric-item">
                  <div>
                    <div style={{ fontWeight: 700 }}>{item.label}</div>
                    <div className="muted">{item.note}</div>
                  </div>
                  <div>{item.count}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </PortalShell>
  );
}
