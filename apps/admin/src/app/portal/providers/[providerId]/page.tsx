'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { PortalShell } from '@/components/layout/portal-shell';
import { StatusBadge } from '@/components/ui/status-badge';
import { adminApi } from '@/lib/api-client';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type TabId = 'overview' | 'schedule' | 'patients' | 'performance' | 'reviews';

interface ProviderProfile {
  name: string;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
  roleLabel: string;
  specialty: string | null;
  licenseNumber: string | null;
  services: string[];
  organizationId: string;
  organizationName: string | null;
  status: string;
  onboardingStatus: string | null;
  joinedAt: string;
}

interface Credential {
  id: string;
  type: string;
  status: string;
  expiresAt: string | null;
  createdAt: string;
}

interface AppointmentItem {
  id: string;
  patientId: string;
  patientName: string;
  service: string;
  location: string;
  startsAt: string;
  endsAt: string;
  status: string;
}

interface PatientItem {
  id: string;
  name: string;
  email: string;
  lastAppointment: string;
  appointmentCount: number;
}

interface PerformanceMetrics {
  completionRate: number;
  avgDurationMinutes: number;
  cancellationRate: number;
  totalAppointments: number;
  completedAppointments: number;
  cancelledAppointments: number;
}

interface ProviderDetailData {
  id: string;
  userId: string;
  profile: ProviderProfile;
  credentials: Credential[];
  appointments: {
    upcoming: AppointmentItem[];
    past: AppointmentItem[];
  };
  assignedPatients: PatientItem[];
  medicalCenters: string[];
  reviews: unknown[];
  ratings: { average: number | null; count: number };
  performance: PerformanceMetrics;
}

// ---------------------------------------------------------------------------
// Tab Components
// ---------------------------------------------------------------------------

function OverviewTab({ data }: { data: ProviderDetailData }) {
  const { profile, credentials, medicalCenters } = data;

  return (
    <div className="info-stack" style={{ gap: 20 }}>
      <div className="card">
        <h3 className="section-title">Professional Information</h3>
        <div className="detail-list">
          <div><span className="detail-label">Full Name</span><strong>{profile.name}</strong></div>
          <div><span className="detail-label">Email</span><strong>{profile.email}</strong></div>
          <div><span className="detail-label">Role</span><strong>{profile.roleLabel}</strong></div>
          <div><span className="detail-label">Specialty</span><strong>{profile.specialty || 'Not specified'}</strong></div>
          <div><span className="detail-label">License Number</span><strong>{profile.licenseNumber || 'Pending'}</strong></div>
          <div><span className="detail-label">Status</span><StatusBadge tone={profile.status === 'ACTIVE' ? 'success' : 'danger'}>{profile.status}</StatusBadge></div>
          <div><span className="detail-label">Onboarding</span><StatusBadge tone={profile.onboardingStatus === 'APPROVED' ? 'success' : 'warning'}>{profile.onboardingStatus || 'Pending'}</StatusBadge></div>
          <div><span className="detail-label">Organization</span><strong>{profile.organizationName || 'N/A'}</strong></div>
          <div><span className="detail-label">Joined</span><strong>{new Date(profile.joinedAt).toLocaleDateString()}</strong></div>
        </div>
      </div>

      <div className="card">
        <h3 className="section-title">Services</h3>
        {profile.services.length > 0 ? (
          <div className="tag-group">
            {profile.services.map((s, i) => (
              <span key={i} className="tag">{s}</span>
            ))}
          </div>
        ) : (
          <p className="muted">No services assigned</p>
        )}
      </div>

      <div className="card">
        <h3 className="section-title">Credentials & Certifications</h3>
        {credentials.length > 0 ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Type</th>
                  <th>Status</th>
                  <th>Expires</th>
                  <th>Uploaded</th>
                </tr>
              </thead>
              <tbody>
                {credentials.map((cred) => (
                  <tr key={cred.id}>
                    <td>{cred.type}</td>
                    <td><StatusBadge tone={cred.status === 'VERIFIED' ? 'success' : cred.status === 'EXPIRED' ? 'danger' : 'warning'}>{cred.status}</StatusBadge></td>
                    <td>{cred.expiresAt ? new Date(cred.expiresAt).toLocaleDateString() : '—'}</td>
                    <td>{new Date(cred.createdAt).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="muted">No credential documents on file</p>
        )}
      </div>

      {medicalCenters.length > 0 && (
        <div className="card">
          <h3 className="section-title">Medical Centers</h3>
          <div className="tag-group">
            {medicalCenters.map((loc, i) => (
              <span key={i} className="tag">{loc}</span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ScheduleTab({ data }: { data: ProviderDetailData }) {
  const { appointments } = data;

  return (
    <div className="info-stack" style={{ gap: 20 }}>
      <div className="card">
        <h3 className="section-title">Upcoming Appointments ({appointments.upcoming.length})</h3>
        {appointments.upcoming.length > 0 ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Patient</th>
                  <th>Service</th>
                  <th>Location</th>
                  <th>Date</th>
                  <th>Time</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {appointments.upcoming.map((appt) => (
                  <tr key={appt.id}>
                    <td>{appt.patientName}</td>
                    <td>{appt.service}</td>
                    <td>{appt.location}</td>
                    <td>{new Date(appt.startsAt).toLocaleDateString()}</td>
                    <td>{new Date(appt.startsAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} – {new Date(appt.endsAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
                    <td><StatusBadge tone={appt.status === 'CONFIRMED' ? 'success' : 'warning'}>{appt.status}</StatusBadge></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="muted">No upcoming appointments</p>
        )}
      </div>

      <div className="card">
        <h3 className="section-title">Past Appointments ({appointments.past.length})</h3>
        {appointments.past.length > 0 ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Patient</th>
                  <th>Service</th>
                  <th>Location</th>
                  <th>Date</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {appointments.past.slice(0, 20).map((appt) => (
                  <tr key={appt.id}>
                    <td>{appt.patientName}</td>
                    <td>{appt.service}</td>
                    <td>{appt.location}</td>
                    <td>{new Date(appt.startsAt).toLocaleDateString()}</td>
                    <td><StatusBadge tone={appt.status === 'COMPLETED' ? 'success' : appt.status === 'CANCELLED' ? 'danger' : 'warning'}>{appt.status}</StatusBadge></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="muted">No past appointments in the last 90 days</p>
        )}
      </div>
    </div>
  );
}

function PatientsTab({ data }: { data: ProviderDetailData }) {
  const { assignedPatients, appointments } = data;

  // Patients with upcoming appointments
  const upcomingPatientIds = new Set(appointments.upcoming.map((a) => a.patientId));
  const patientsWithUpcoming = assignedPatients.filter((p) => upcomingPatientIds.has(p.id));
  const patientsHistory = assignedPatients.filter((p) => !upcomingPatientIds.has(p.id));

  return (
    <div className="info-stack" style={{ gap: 20 }}>
      <div className="card">
        <h3 className="section-title">Patients with Upcoming Appointments ({patientsWithUpcoming.length})</h3>
        {patientsWithUpcoming.length > 0 ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Total Visits</th>
                  <th>Last Visit</th>
                </tr>
              </thead>
              <tbody>
                {patientsWithUpcoming.map((patient) => (
                  <tr key={patient.id}>
                    <td><strong>{patient.name}</strong></td>
                    <td>{patient.email}</td>
                    <td>{patient.appointmentCount}</td>
                    <td>{new Date(patient.lastAppointment).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="muted">No patients with upcoming appointments</p>
        )}
      </div>

      <div className="card">
        <h3 className="section-title">All Patients Treated ({assignedPatients.length})</h3>
        {assignedPatients.length > 0 ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Total Visits</th>
                  <th>Last Visit</th>
                </tr>
              </thead>
              <tbody>
                {assignedPatients.map((patient) => (
                  <tr key={patient.id}>
                    <td><strong>{patient.name}</strong></td>
                    <td>{patient.email}</td>
                    <td>{patient.appointmentCount}</td>
                    <td>{new Date(patient.lastAppointment).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="muted">No patients on record</p>
        )}
      </div>
    </div>
  );
}

function PerformanceTab({ data }: { data: ProviderDetailData }) {
  const { performance, ratings } = data;

  return (
    <div className="info-stack" style={{ gap: 20 }}>
      <div className="card">
        <h3 className="section-title">Performance Metrics</h3>
        <div className="metric-grid-3" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16, marginTop: 12 }}>
          <div className="surface-tile" style={{ padding: 16, borderRadius: 12, background: '#f5f7fc' }}>
            <div className="hero-metric-label" style={{ fontSize: 13, color: '#64748b' }}>Completion Rate</div>
            <div className="hero-metric-value" style={{ fontSize: 24, fontWeight: 700 }}>{performance.completionRate}%</div>
          </div>
          <div className="surface-tile" style={{ padding: 16, borderRadius: 12, background: '#f5f7fc' }}>
            <div className="hero-metric-label" style={{ fontSize: 13, color: '#64748b' }}>Avg Duration</div>
            <div className="hero-metric-value" style={{ fontSize: 24, fontWeight: 700 }}>{performance.avgDurationMinutes} min</div>
          </div>
          <div className="surface-tile" style={{ padding: 16, borderRadius: 12, background: '#f5f7fc' }}>
            <div className="hero-metric-label" style={{ fontSize: 13, color: '#64748b' }}>Cancellation Rate</div>
            <div className="hero-metric-value" style={{ fontSize: 24, fontWeight: 700 }}>{performance.cancellationRate}%</div>
          </div>
          <div className="surface-tile" style={{ padding: 16, borderRadius: 12, background: '#f5f7fc' }}>
            <div className="hero-metric-label" style={{ fontSize: 13, color: '#64748b' }}>Total Appointments</div>
            <div className="hero-metric-value" style={{ fontSize: 24, fontWeight: 700 }}>{performance.totalAppointments}</div>
          </div>
          <div className="surface-tile" style={{ padding: 16, borderRadius: 12, background: '#f5f7fc' }}>
            <div className="hero-metric-label" style={{ fontSize: 13, color: '#64748b' }}>Completed</div>
            <div className="hero-metric-value" style={{ fontSize: 24, fontWeight: 700 }}>{performance.completedAppointments}</div>
          </div>
          <div className="surface-tile" style={{ padding: 16, borderRadius: 12, background: '#f5f7fc' }}>
            <div className="hero-metric-label" style={{ fontSize: 13, color: '#64748b' }}>Cancelled</div>
            <div className="hero-metric-value" style={{ fontSize: 24, fontWeight: 700 }}>{performance.cancelledAppointments}</div>
          </div>
        </div>
      </div>

      <div className="card">
        <h3 className="section-title">Ratings</h3>
        <div className="detail-list">
          <div><span className="detail-label">Average Rating</span><strong>{ratings.average != null ? `${ratings.average} / 5.0` : 'No ratings yet'}</strong></div>
          <div><span className="detail-label">Total Reviews</span><strong>{ratings.count}</strong></div>
        </div>
      </div>
    </div>
  );
}

function ReviewsTab() {
  return (
    <div className="info-stack" style={{ gap: 20 }}>
      <div className="card" style={{ textAlign: 'center', padding: '48px 24px' }}>
        <p className="muted" style={{ fontSize: 16 }}>No reviews available</p>
        <p className="muted" style={{ fontSize: 13, marginTop: 8 }}>Patient reviews will appear here once the review system is active.</p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Page Component
// ---------------------------------------------------------------------------

const TABS: { id: TabId; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'schedule', label: 'Schedule' },
  { id: 'patients', label: 'Patients' },
  { id: 'performance', label: 'Performance' },
  { id: 'reviews', label: 'Reviews' },
];

export default function ProviderProfilePage() {
  const params = useParams();
  const providerId = params.providerId as string;

  const [activeTab, setActiveTab] = useState<TabId>('overview');
  const [data, setData] = useState<ProviderDetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Lazy-load: fetch data when activeTab changes (initial load fetches full data once)
  useEffect(() => {
    if (!providerId) return;

    let cancelled = false;
    setLoading(true);
    setError(null);

    // The API returns all data in one call, but we only fetch when needed.
    // On first load or tab switch, we load if data is null.
    // Since the API is comprehensive, we fetch once and cache locally.
    if (data) {
      setLoading(false);
      return;
    }

    (async () => {
      try {
        const result = await adminApi.providerDetail(providerId);
        if (!cancelled) {
          setData(result as ProviderDetailData);
          setLoading(false);
        }
      } catch (err: unknown) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load provider data');
          setLoading(false);
        }
      }
    })();

    return () => { cancelled = true; };
  }, [providerId, activeTab, data]);

  return (
    <PortalShell currentPath="/portal/providers">
      <div className="admin-v17-provider-workspace admin-v17-provider-detail">
        {/* Header */}
        <div style={{ marginBottom: 24 }}>
          <div className="page-breadcrumbs" style={{ marginBottom: 8 }}>
            <Link href="/portal/providers" style={{ color: 'var(--primary)', textDecoration: 'none' }}>Providers</Link>
            <span style={{ margin: '0 8px', color: '#94a3b8' }}>›</span>
            <span>{data?.profile.name || 'Provider Profile'}</span>
          </div>
          {data && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <h2 className="hero-title" style={{ margin: 0 }}>{data.profile.name}</h2>
              <StatusBadge tone={data.profile.status === 'ACTIVE' ? 'success' : 'danger'}>{data.profile.status}</StatusBadge>
            </div>
          )}
        </div>

        {/* Tab navigation */}
        <nav style={{ display: 'flex', gap: 0, borderBottom: '2px solid #e5eaf3', marginBottom: 24 }} role="tablist" aria-label="Provider profile tabs">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              role="tab"
              aria-selected={activeTab === tab.id}
              aria-controls={`tabpanel-${tab.id}`}
              onClick={() => setActiveTab(tab.id)}
              style={{
                padding: '12px 20px',
                border: 'none',
                background: 'none',
                cursor: 'pointer',
                fontWeight: activeTab === tab.id ? 700 : 500,
                fontSize: 14,
                color: activeTab === tab.id ? 'var(--primary)' : '#64748b',
                borderBottom: activeTab === tab.id ? '2px solid var(--primary)' : '2px solid transparent',
                marginBottom: -2,
                transition: 'color 0.15s, border-color 0.15s',
              }}
            >
              {tab.label}
            </button>
          ))}
        </nav>

        {/* Tab content with lazy-loading */}
        <div role="tabpanel" id={`tabpanel-${activeTab}`} aria-labelledby={activeTab}>
          {loading && (
            <div style={{ textAlign: 'center', padding: '48px 0' }}>
              <div className="spinner" style={{ display: 'inline-block', width: 24, height: 24, border: '3px solid #e5eaf3', borderTopColor: 'var(--primary)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
              <p className="muted" style={{ marginTop: 12 }}>Loading provider data...</p>
            </div>
          )}

          {error && (
            <div className="card" style={{ textAlign: 'center', padding: '32px', color: '#dc2626' }}>
              <p>{error}</p>
              <button
                className="button secondary"
                style={{ marginTop: 12 }}
                onClick={() => { setData(null); setError(null); }}
              >
                Retry
              </button>
            </div>
          )}

          {!loading && !error && data && (
            <>
              {activeTab === 'overview' && <OverviewTab data={data} />}
              {activeTab === 'schedule' && <ScheduleTab data={data} />}
              {activeTab === 'patients' && <PatientsTab data={data} />}
              {activeTab === 'performance' && <PerformanceTab data={data} />}
              {activeTab === 'reviews' && <ReviewsTab />}
            </>
          )}
        </div>
      </div>

      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </PortalShell>
  );
}
