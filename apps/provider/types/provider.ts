export type StatusVariant = 'success' | 'warning' | 'info' | 'danger';

export type QueueItem = {
  id: string;
  time: string;
  patientName: string;
  reason: string;
  visitType: 'In-Person' | 'Telehealth';
  status: string;
  statusVariant: StatusVariant;
  assignedTo: string;
  paymentState: string;
  allergies: string;
  fileLabel: string;
};

export type DashboardData = {
  kpis: {
    todaysAppointments: number;
    waitingPatients: number;
    unreadMessages: number;
    openAlerts: number;
  };
  queue: Array<{
    id: string;
    patientName: string;
    time: string;
    reason: string;
    status: string;
    statusVariant: StatusVariant;
  }>;
  alerts: Array<{
    id: string;
    title: string;
    detail: string;
    severity: string;
    severityVariant: 'warning' | 'danger' | 'info';
  }>;
};

export type OnboardingData = {
  orgName: string;
  primaryFacility: string;
  licenseNumber: string;
  checklist: Array<{
    label: string;
    detail: string;
    status: string;
    variant: StatusVariant;
  }>;
};

export type SlotTemplateData = {
  templateName: string;
  duration: string;
  buffer: string;
  capacity: number;
  service: string;
  location: string;
  services: string[];
  locations: string[];
  pattern: Array<{
    day: string;
    hours: string;
  }>;
};

export type PatientChartSummary = {
  patientId: string;
  patientName: string;
  status: string;
  dob: string;
  allergies: string;
  concerns: string;
  medications: string[];
  problems: string[];
  labs: Array<{
    name: string;
    date: string;
    status: string;
    variant: StatusVariant;
  }>;
};

export type TelehealthWaitingRoomData = {
  appointmentId: string;
  patientName: string;
  reason: string;
  provider: string;
  eta: string;
  consentReady: boolean;
  deviceChecks: Array<{
    label: string;
    detail: string;
    status: string;
    variant: StatusVariant;
  }>;
  checklist: string[];
};

export type EncounterNoteDraft = {
  encounterId: string;
  patientName: string;
  visitType: string;
  primaryDiagnosis: string;
  codingHint: string;
  signatureRequired: boolean;
  soap: {
    subjective: string;
    objective: string;
    assessment: string;
    plan: string;
  };
  templates: string[];
};

export type OrderComposerData = {
  encounterId: string;
  patientName: string;
  reason: string;
  requestedBy: string;
  orderGroups: Array<{
    title: string;
    description: string;
    status: string;
    variant: StatusVariant;
  }>;
  commonSelections: string[];
};

export type PrescriptionComposerData = {
  patientName: string;
  drug: string;
  dosage: string;
  frequency: string;
  duration: string;
  complianceChecks: Array<{
    label: string;
    detail: string;
    status: string;
    variant: StatusVariant;
  }>;
  shortcuts: string[];
};

export type MessagingInboxData = {
  overdueCount: number;
  threads: Array<{
    id: string;
    subject: string;
    preview: string;
    counterparty: string;
    sla: string;
    status: string;
    variant: StatusVariant;
    owner: string;
  }>;
};

export type MessageThread = {
  id: string;
  subject: string;
  status: string;
  variant: StatusVariant;
  owner: string;
  messages: Array<{
    id: string;
    author: string;
    time: string;
    body: string;
    internal?: boolean;
  }>;
};

export type LabOrderInboxData = {
  pendingCount: number;
  items: Array<{
    id: string;
    patientName: string;
    testName: string;
    requestedAt: string;
    location: string;
    status: string;
    variant: StatusVariant;
    nextStep: string;
  }>;
};

export type LabResultReview = {
  id: string;
  patientName: string;
  testName: string;
  collectedAt: string;
  orderingProvider: string;
  resultStatus: string;
  variant: StatusVariant;
  values: Array<{
    label: string;
    value: string;
    referenceRange: string;
    flag?: 'High' | 'Low' | 'Normal';
    variant: StatusVariant;
  }>;
  comments: string[];
};

export type RpmProgramData = {
  enrolledCount: number;
  alertingCount: number;
  patients: Array<{
    patientId: string;
    patientName: string;
    device: string;
    adherence: string;
    thresholdStatus: string;
    variant: StatusVariant;
    latestReading: string;
  }>;
};

export type RpmPatientDetail = {
  patientId: string;
  patientName: string;
  programStatus: string;
  variant: StatusVariant;
  device: string;
  thresholds: Array<{
    label: string;
    value: string;
    status: string;
    variant: StatusVariant;
  }>;
  readings: Array<{
    time: string;
    metric: string;
    value: string;
    status: string;
    variant: StatusVariant;
  }>;
  outreachLog: Array<{
    time: string;
    by: string;
    note: string;
  }>;
};

export type AlertItem = {
  id: string;
  title: string;
  detail: string;
  severity: string;
  variant: StatusVariant;
  owner: string;
  sla: string;
  source: string;
};

export type BillingPayoutsData = {
  revenueCards: Array<{
    label: string;
    value: string;
    detail: string;
  }>;
  payoutBatches: Array<{
    id: string;
    period: string;
    amount: string;
    status: string;
    variant: StatusVariant;
  }>;
  invoices: Array<{
    id: string;
    counterparty: string;
    date: string;
    amount: string;
    status: string;
    variant: StatusVariant;
  }>;
};

export type PerformanceAnalyticsData = {
  metrics: Array<{
    label: string;
    value: string;
    detail: string;
  }>;
  utilization: Array<{
    label: string;
    value: number;
  }>;
  satisfaction: Array<{
    label: string;
    value: number;
  }>;
};

export type TeamRolesData = {
  members: Array<{
    id: string;
    name: string;
    role: string;
    facility: string;
    mfaStatus: string;
    status: string;
    variant: StatusVariant;
  }>;
};

export type FacilitySettingsData = {
  facilities: Array<{
    id: string;
    name: string;
    address: string;
    serviceModes: string[];
    publishStatus: string;
    variant: StatusVariant;
  }>;
  serviceMatrix: Array<{
    service: string;
    channel: string;
    price: string;
    effectiveDate: string;
  }>;
};

export type ComplianceAuditData = {
  policyIssues: Array<{
    id: string;
    title: string;
    detail: string;
    status: string;
    variant: StatusVariant;
  }>;
  accessLogs: Array<{
    id: string;
    actor: string;
    action: string;
    target: string;
    time: string;
    outcome: string;
  }>;
};
