import type {
  AlertItem,
  BillingPayoutsData,
  ComplianceAuditData,
  FacilitySettingsData,
  DashboardData,
  EncounterNoteDraft,
  LabOrderInboxData,
  LabResultReview,
  MessageThread,
  PerformanceAnalyticsData,
  MessagingInboxData,
  OnboardingData,
  OrderComposerData,
  PatientChartSummary,
  PrescriptionComposerData,
  QueueItem,
  TeamRolesData,
  RpmPatientDetail,
  RpmProgramData,
  SlotTemplateData,
  TelehealthWaitingRoomData,
} from '@/types/provider';

const queueItems: QueueItem[] = [
  {
    id: 'appt-1001',
    time: '09:30 AM',
    patientName: 'Amina Hassan',
    reason: 'Follow-up consultation',
    visitType: 'In-Person',
    status: 'Checked In',
    statusVariant: 'success',
    assignedTo: 'Dr. Sarah Chen',
    paymentState: 'Paid',
    allergies: 'Penicillin',
    fileLabel: 'CBC result attached',
  },
  {
    id: 'appt-1002',
    time: '10:00 AM',
    patientName: 'Omar Khalid',
    reason: 'Blood pressure review',
    visitType: 'Telehealth',
    status: 'Waiting',
    statusVariant: 'warning',
    assignedTo: 'Dr. Sarah Chen',
    paymentState: 'Pending',
    allergies: 'No known allergies',
    fileLabel: 'RPM readings synced',
  },
  {
    id: 'appt-1003',
    time: '10:30 AM',
    patientName: 'Layla Nasser',
    reason: 'Dermatology check',
    visitType: 'In-Person',
    status: 'Confirmed',
    statusVariant: 'info',
    assignedTo: 'Dr. Sarah Chen',
    paymentState: 'Authorized',
    allergies: 'Latex',
    fileLabel: 'Photo upload received',
  },
];

const patientCharts: PatientChartSummary[] = [
  {
    patientId: 'patient-1001',
    patientName: 'Omar Khalid',
    status: 'Assigned to provider',
    dob: '12 Feb 1984',
    allergies: 'No known allergies',
    concerns: 'Hypertension follow-up and medication adherence review',
    medications: ['Lisinopril 10 mg daily', 'Atorvastatin 20 mg nightly', 'Aspirin 81 mg daily'],
    problems: ['Hypertension', 'Elevated LDL', 'Sleep disturbance'],
    labs: [
      { name: 'CBC', date: 'Yesterday', status: 'Reviewed', variant: 'success' },
      { name: 'Lipid panel', date: '2 days ago', status: 'Needs follow-up', variant: 'warning' },
      { name: 'Renal function', date: 'Last week', status: 'Normal', variant: 'info' },
    ],
  },
];

const encounterDrafts: EncounterNoteDraft[] = [
  {
    encounterId: 'enc-1002',
    patientName: 'Omar Khalid',
    visitType: 'Telehealth follow-up',
    primaryDiagnosis: 'Essential hypertension',
    codingHint: 'Problem-focused follow-up with medication review',
    signatureRequired: true,
    soap: {
      subjective:
        'Patient reports improved adherence, mild morning headache, and home blood pressure values trending down over the last 3 days.',
      objective: 'Latest RPM readings average 128/82 mmHg. No acute distress reported. Medication reconciliation completed.',
      assessment: 'Hypertension improving with ongoing treatment. Continue monitoring and reinforce adherence and diet changes.',
      plan:
        'Continue current antihypertensive regimen, repeat renal function panel in 2 weeks, and schedule follow-up if readings rise above threshold.',
    },
    templates: ['Hypertension follow-up SOAP', 'Medication adherence counseling', 'RPM review summary'],
  },
];

const orderComposer: OrderComposerData = {
  encounterId: 'enc-1002',
  patientName: 'Omar Khalid',
  reason: 'Hypertension follow-up with medication monitoring',
  requestedBy: 'Dr. Sarah Chen',
  orderGroups: [
    {
      title: 'Laboratory order',
      description: 'Renal function and electrolytes panel for medication safety review.',
      status: 'Recommended',
      variant: 'info',
    },
    {
      title: 'Imaging order',
      description: 'No imaging needed at this time based on current presentation.',
      status: 'Optional',
      variant: 'warning',
    },
    {
      title: 'External referral',
      description: 'Cardiology referral available if home readings worsen or symptoms escalate.',
      status: 'Standby',
      variant: 'success',
    },
  ],
  commonSelections: ['Renal function panel', 'Electrolytes', 'Cardiology referral', 'Dietitian consult'],
};

const prescriptionComposer: PrescriptionComposerData = {
  patientName: 'Omar Khalid',
  drug: 'Lisinopril',
  dosage: '10 mg tablet',
  frequency: 'Once daily',
  duration: '30 days',
  complianceChecks: [
    {
      label: 'Allergy review',
      detail: 'No medication allergy conflicts detected for the selected drug.',
      status: 'Clear',
      variant: 'success',
    },
    {
      label: 'Controlled drug policy',
      detail: 'Selected medication does not trigger controlled-substance restrictions.',
      status: 'Not restricted',
      variant: 'info',
    },
    {
      label: 'Renal monitoring',
      detail: 'Recent lab review is recommended within two weeks.',
      status: 'Monitor',
      variant: 'warning',
    },
  ],
  shortcuts: ['5 mg once daily', '10 mg once daily', '30-day supply', '90-day supply'],
};

const messagingInbox: MessagingInboxData = {
  overdueCount: 2,
  threads: [
    {
      id: 'thread-2001',
      subject: 'Follow-up on blood pressure readings',
      preview: 'Patient shared updated RPM values and asked whether medication timing should change.',
      counterparty: 'Omar Khalid / Cardiology team',
      sla: '1h remaining',
      status: 'Open',
      variant: 'warning',
      owner: 'Nurse Amira',
    },
    {
      id: 'thread-2002',
      subject: 'Lab order scheduling question',
      preview: 'Lab coordinator asked to confirm whether fasting is required for the next collection.',
      counterparty: 'Central Lab / Care team',
      sla: 'Overdue',
      status: 'Needs owner',
      variant: 'danger',
      owner: 'Unassigned',
    },
  ],
};

const messageThreads: MessageThread[] = [
  {
    id: 'thread-2001',
    subject: 'Follow-up on blood pressure readings',
    status: 'Open',
    variant: 'warning',
    owner: 'Nurse Amira',
    messages: [
      {
        id: 'm1',
        author: 'Omar Khalid',
        time: '09:10 AM',
        body: 'My blood pressure has improved this week. Should I keep taking my medication at night?',
      },
      {
        id: 'm2',
        author: 'Nurse Amira',
        time: '09:18 AM',
        body: 'Thank you. We are reviewing your latest readings with the provider and will confirm the plan shortly.',
      },
      {
        id: 'm3',
        author: 'Dr. Sarah Chen',
        time: '09:26 AM',
        body: 'RPM trend reviewed. Continue the current dosing schedule for now and monitor readings daily.',
        internal: true,
      },
      {
        id: 'm4',
        author: 'Nurse Amira',
        time: '09:31 AM',
        body: 'Please continue the current schedule and we will recheck your lab work in two weeks.',
      },
    ],
  },
];

const telehealthSessions: TelehealthWaitingRoomData[] = [
  {
    appointmentId: 'appt-1002',
    patientName: 'Omar Khalid',
    reason: 'Blood pressure review',
    provider: 'Dr. Sarah Chen',
    eta: 'Starts in 5 min',
    consentReady: true,
    deviceChecks: [
      { label: 'Microphone', detail: 'Input level detected and clear', status: 'Ready', variant: 'success' },
      { label: 'Camera', detail: 'Camera permission granted', status: 'Ready', variant: 'success' },
      { label: 'Network', detail: 'Latency slightly elevated but stable', status: 'Monitor', variant: 'warning' },
    ],
    checklist: [
      'Confirm identity and date of birth',
      'Verify telehealth consent and policy banner',
      'Review most recent vitals and RPM trend',
      'Prepare quick note and prescription shortcuts',
    ],
  },
];

const labOrderInbox: LabOrderInboxData = {
  pendingCount: 3,
  items: [
    {
      id: 'lab-3001',
      patientName: 'Amina Hassan',
      testName: 'CBC + CRP',
      requestedAt: 'Today, 08:40 AM',
      location: 'Central Lab - Riyadh',
      status: 'Pending acceptance',
      variant: 'warning',
      nextStep: 'Accept and assign collection slot',
    },
    {
      id: 'lab-3002',
      patientName: 'Omar Khalid',
      testName: 'Renal function panel',
      requestedAt: 'Today, 09:05 AM',
      location: 'Virtual order / partner lab',
      status: 'Needs scheduling',
      variant: 'info',
      nextStep: 'Confirm fasting and schedule pickup',
    },
    {
      id: 'lab-3003',
      patientName: 'Layla Nasser',
      testName: 'Allergy screen',
      requestedAt: 'Yesterday, 04:30 PM',
      location: 'North Branch - Riyadh',
      status: 'Rejected with reason',
      variant: 'danger',
      nextStep: 'Review rejection reason and update order',
    },
  ],
};

const labResults: LabResultReview[] = [
  {
    id: 'result-4001',
    patientName: 'Omar Khalid',
    testName: 'Renal function panel',
    collectedAt: 'Today, 07:45 AM',
    orderingProvider: 'Dr. Sarah Chen',
    resultStatus: 'Ready for verification',
    variant: 'warning',
    values: [
      { label: 'Creatinine', value: '1.1 mg/dL', referenceRange: '0.7 - 1.3', flag: 'Normal', variant: 'success' },
      { label: 'Potassium', value: '5.3 mmol/L', referenceRange: '3.5 - 5.1', flag: 'High', variant: 'warning' },
      { label: 'eGFR', value: '78 mL/min', referenceRange: '>60', flag: 'Normal', variant: 'success' },
    ],
    comments: [
      'Mild potassium elevation; correlate with current ACE inhibitor use.',
      'Result suitable for provider review and release once comment is finalized.',
    ],
  },
];

const rpmProgram: RpmProgramData = {
  enrolledCount: 24,
  alertingCount: 4,
  patients: [
    {
      patientId: 'patient-1001',
      patientName: 'Omar Khalid',
      device: 'Omron BP Monitor',
      adherence: '92% this week',
      thresholdStatus: '1 caution trend',
      variant: 'warning',
      latestReading: '128/82 mmHg • 2h ago',
    },
    {
      patientId: 'patient-1004',
      patientName: 'Maha Saleh',
      device: 'Apple Watch',
      adherence: '98% this week',
      thresholdStatus: 'Within threshold',
      variant: 'success',
      latestReading: '74 bpm • 40m ago',
    },
    {
      patientId: 'patient-1005',
      patientName: 'Yousef Rahman',
      device: 'Glucometer',
      adherence: '61% this week',
      thresholdStatus: 'Needs outreach',
      variant: 'danger',
      latestReading: '182 mg/dL • Yesterday',
    },
  ],
};

const rpmPatients: RpmPatientDetail[] = [
  {
    patientId: 'patient-1001',
    patientName: 'Omar Khalid',
    programStatus: 'Active and monitored',
    variant: 'success',
    device: 'Omron BP Monitor',
    thresholds: [
      { label: 'Blood pressure threshold', value: 'Above 140/90 mmHg', status: 'Monitor', variant: 'warning' },
      { label: 'Missed readings threshold', value: 'More than 2 missed days', status: 'Active', variant: 'info' },
    ],
    readings: [
      { time: 'Today 08:10 AM', metric: 'Blood pressure', value: '128/82 mmHg', status: 'Within target', variant: 'success' },
      { time: 'Yesterday 08:05 AM', metric: 'Blood pressure', value: '141/92 mmHg', status: 'Caution', variant: 'warning' },
      { time: '2 days ago 08:16 AM', metric: 'Pulse', value: '76 bpm', status: 'Normal', variant: 'success' },
    ],
    outreachLog: [
      { time: 'Yesterday 11:20 AM', by: 'Nurse Amira', note: 'Called patient to reinforce medication adherence after elevated reading.' },
      { time: 'Last week', by: 'Dr. Sarah Chen', note: 'Reviewed trend and maintained current care plan.' },
    ],
  },
];

const alerts: AlertItem[] = [
  {
    id: 'alert-1',
    title: 'Telehealth consent missing',
    detail: 'One scheduled telehealth appointment cannot start until consent is completed.',
    severity: 'High',
    variant: 'danger',
    owner: 'Front Desk',
    sla: '30 min',
    source: 'Telehealth',
  },
  {
    id: 'alert-2',
    title: 'Critical RPM reading requires outreach',
    detail: 'A glucose result exceeded the configured escalation threshold overnight.',
    severity: 'High',
    variant: 'danger',
    owner: 'Nurse Triage',
    sla: '15 min',
    source: 'RPM',
  },
  {
    id: 'alert-3',
    title: 'Lab result pending verification',
    detail: 'A released result is waiting for reviewer sign-off based on lab policy.',
    severity: 'Medium',
    variant: 'warning',
    owner: 'Lab Supervisor',
    sla: '2 h',
    source: 'Laboratory',
  },
];

export function getDashboardData(): DashboardData {
  return {
    kpis: {
      todaysAppointments: 18,
      waitingPatients: 4,
      unreadMessages: 7,
      openAlerts: 3,
    },
    queue: queueItems.map((item) => ({
      id: item.id,
      patientName: item.patientName,
      time: item.time,
      reason: item.reason,
      status: item.status,
      statusVariant: item.statusVariant,
    })),
    alerts: [
      {
        id: 'alert-1',
        title: 'Missing consent on telehealth visit',
        detail: 'One scheduled video visit cannot start until telehealth consent is confirmed.',
        severity: 'High',
        severityVariant: 'danger',
      },
      {
        id: 'alert-2',
        title: 'Unreviewed abnormal result',
        detail: 'A newly posted lab result requires provider review and release.',
        severity: 'Medium',
        severityVariant: 'warning',
      },
    ],
  };
}

export function getQueueData() {
  return queueItems;
}

export function getAppointmentById(id: string) {
  return queueItems.find((item) => item.id === id) ?? null;
}

export function getCalendarData() {
  return {
    selectedLocation: 'Central Clinic - Riyadh',
    locations: ['Central Clinic - Riyadh', 'North Branch - Riyadh', 'Virtual Care'],
    days: [
      {
        label: 'Monday',
        date: '04 Nov',
        blocks: [
          { time: '09:00 - 12:00', type: 'Clinic consultations' },
          { time: '01:00 - 03:00', type: 'Telehealth sessions' },
        ],
      },
      {
        label: 'Tuesday',
        date: '05 Nov',
        blocks: [
          { time: '10:00 - 12:00', type: 'Follow-up visits' },
          { time: '02:00 - 05:00', type: 'General clinic' },
        ],
      },
      {
        label: 'Wednesday',
        date: '06 Nov',
        blocks: [
          { time: '09:30 - 11:30', type: 'Virtual care' },
          { time: '01:30 - 04:00', type: 'Specialty slots' },
        ],
      },
      {
        label: 'Thursday',
        date: '07 Nov',
        blocks: [
          { time: '08:30 - 12:30', type: 'Clinic consultations' },
          { time: '02:00 - 03:30', type: 'Admin and documentation' },
        ],
      },
    ],
  };
}

export function getOnboardingData(): OnboardingData {
  return {
    orgName: 'CarePoint Provider Group',
    primaryFacility: 'Central Clinic - Riyadh',
    licenseNumber: 'KSA-MOH-428881',
    checklist: [
      {
        label: 'Clinical license upload',
        detail: 'Primary provider license and supporting verification documents uploaded.',
        status: 'Received',
        variant: 'success',
      },
      {
        label: 'Organization documents',
        detail: 'Commercial registration and facility documents still require final review.',
        status: 'Under review',
        variant: 'warning',
      },
      {
        label: 'Bank payout details',
        detail: 'Beneficiary validation is still incomplete.',
        status: 'Missing',
        variant: 'danger',
      },
    ],
  };
}

export function getSlotTemplateData(): SlotTemplateData {
  return {
    templateName: 'Weekday hypertension follow-up',
    duration: '20 minutes',
    buffer: '10 minutes',
    capacity: 12,
    service: 'Cardiology follow-up',
    location: 'Central Clinic - Riyadh',
    services: ['Cardiology follow-up', 'General consultation', 'Telehealth review'],
    locations: ['Central Clinic - Riyadh', 'North Branch - Riyadh', 'Virtual Care'],
    pattern: [
      { day: 'Sunday', hours: '09:00 - 01:00 PM' },
      { day: 'Monday', hours: '09:00 - 01:00 PM' },
      { day: 'Tuesday', hours: '10:00 - 02:00 PM' },
      { day: 'Wednesday', hours: '09:00 - 12:00 PM' },
      { day: 'Thursday', hours: 'Telehealth only • 11:00 - 02:00 PM' },
    ],
  };
}

export function getPatientChartSummary(patientId: string) {
  return patientCharts.find((item) => item.patientId === patientId) ?? null;
}

export function getTelehealthWaitingRoom(appointmentId: string) {
  return telehealthSessions.find((item) => item.appointmentId === appointmentId) ?? null;
}

export function getEncounterNoteDraft(encounterId: string) {
  return encounterDrafts.find((item) => item.encounterId === encounterId) ?? null;
}

export function getOrderComposerData() {
  return orderComposer;
}

export function getPrescriptionComposerData() {
  return prescriptionComposer;
}

export function getMessagingInboxData() {
  return messagingInbox;
}

export function getMessageThreadById(threadId: string) {
  return messageThreads.find((item) => item.id === threadId) ?? null;
}

export function getLabOrderInboxData() {
  return labOrderInbox;
}

export function getLabResultById(id: string) {
  return labResults.find((item) => item.id === id) ?? null;
}

export function getRpmProgramData() {
  return rpmProgram;
}

export function getRpmPatientById(patientId: string) {
  return rpmPatients.find((item) => item.patientId === patientId) ?? null;
}

export function getAlertData() {
  return alerts;
}


const billingData: BillingPayoutsData = {
  revenueCards: [
    { label: 'Current month revenue', value: 'SAR 182,400', detail: 'Across consultations, labs, and telehealth' },
    { label: 'Pending payouts', value: 'SAR 28,600', detail: 'Awaiting settlement and finance approval' },
    { label: 'Open invoices', value: '14', detail: 'Provider, lab, and partner invoices requiring review' },
  ],
  payoutBatches: [
    { id: 'pay-7001', period: '01 Nov - 15 Nov', amount: 'SAR 12,450', status: 'Scheduled', variant: 'info' },
    { id: 'pay-7002', period: '16 Oct - 31 Oct', amount: 'SAR 15,890', status: 'Processed', variant: 'success' },
    { id: 'pay-7003', period: '01 Oct - 15 Oct', amount: 'SAR 10,260', status: 'Held for review', variant: 'warning' },
  ],
  invoices: [
    { id: 'inv-8101', counterparty: 'Central Lab Services', date: '12 Nov 2025', amount: 'SAR 6,200', status: 'Approved', variant: 'success' },
    { id: 'inv-8102', counterparty: 'Telehealth Media Vendor', date: '10 Nov 2025', amount: 'SAR 3,480', status: 'Pending', variant: 'warning' },
    { id: 'inv-8103', counterparty: 'North Branch Supplies', date: '08 Nov 2025', amount: 'SAR 1,940', status: 'Rejected', variant: 'danger' },
  ],
};

const analyticsData: PerformanceAnalyticsData = {
  metrics: [
    { label: 'No-show rate', value: '4.8%', detail: 'Down 0.9% vs prior month' },
    { label: 'Utilization', value: '82%', detail: 'Average across active providers' },
    { label: 'Patient satisfaction', value: '4.7 / 5', detail: 'Based on released encounter surveys' },
    { label: 'Telehealth completion', value: '93%', detail: 'Completed without reschedule' },
  ],
  utilization: [
    { label: 'Week 1', value: 74 },
    { label: 'Week 2', value: 79 },
    { label: 'Week 3', value: 82 },
    { label: 'Week 4', value: 86 },
  ],
  satisfaction: [
    { label: 'Cardiology', value: 94 },
    { label: 'Dermatology', value: 91 },
    { label: 'Family Medicine', value: 89 },
    { label: 'Telehealth', value: 96 },
  ],
};

const teamRolesData: TeamRolesData = {
  members: [
    { id: 'usr-1', name: 'Dr. Sarah Chen', role: 'Provider', facility: 'Central Clinic - Riyadh', mfaStatus: 'Enabled', status: 'Active', variant: 'success' },
    { id: 'usr-2', name: 'Nurse Amira', role: 'Nurse', facility: 'Central Clinic - Riyadh', mfaStatus: 'Enabled', status: 'Active', variant: 'success' },
    { id: 'usr-3', name: 'Omar Fahad', role: 'Front Desk', facility: 'North Branch - Riyadh', mfaStatus: 'Pending', status: 'Invite sent', variant: 'warning' },
    { id: 'usr-4', name: 'Maha Adel', role: 'Finance', facility: 'Organization', mfaStatus: 'Enabled', status: 'Suspended', variant: 'danger' },
  ],
};

const facilitySettingsData: FacilitySettingsData = {
  facilities: [
    { id: 'fac-1', name: 'Central Clinic - Riyadh', address: 'Olaya District, Riyadh', serviceModes: ['In-Person', 'Telehealth'], publishStatus: 'Published', variant: 'success' },
    { id: 'fac-2', name: 'North Branch - Riyadh', address: 'King Fahd Road, Riyadh', serviceModes: ['In-Person'], publishStatus: 'Draft changes', variant: 'warning' },
    { id: 'fac-3', name: 'Virtual Care Hub', address: 'Remote service configuration', serviceModes: ['Telehealth'], publishStatus: 'Published', variant: 'info' },
  ],
  serviceMatrix: [
    { service: 'General consultation', channel: 'In-Person', price: 'SAR 150', effectiveDate: '01 Dec 2025' },
    { service: 'Cardiology follow-up', channel: 'Telehealth', price: 'SAR 180', effectiveDate: '01 Dec 2025' },
    { service: 'Dermatology review', channel: 'In-Person', price: 'SAR 210', effectiveDate: '15 Dec 2025' },
  ],
};

const complianceData: ComplianceAuditData = {
  policyIssues: [
    { id: 'cmp-1', title: 'Telehealth consent gap', detail: 'One future appointment is blocked until the latest consent version is accepted.', status: 'Open', variant: 'danger' },
    { id: 'cmp-2', title: 'Access review pending', detail: 'Quarterly review for finance exports is due this week.', status: 'Due soon', variant: 'warning' },
    { id: 'cmp-3', title: 'MFA coverage', detail: 'All privileged provider accounts except one have MFA enabled.', status: 'Monitor', variant: 'info' },
  ],
  accessLogs: [
    { id: 'log-1', actor: 'Dr. Sarah Chen', action: 'Viewed patient chart', target: 'patient-1001', time: 'Today 09:42 AM', outcome: 'Allowed' },
    { id: 'log-2', actor: 'Nurse Amira', action: 'Released patient message', target: 'thread-2001', time: 'Today 09:31 AM', outcome: 'Allowed' },
    { id: 'log-3', actor: 'Maha Adel', action: 'Downloaded payout statement', target: 'pay-7002', time: 'Yesterday 03:15 PM', outcome: 'Logged' },
  ],
};

export function getBillingPayoutsData(): BillingPayoutsData {
  return billingData;
}

export function getPerformanceAnalyticsData(): PerformanceAnalyticsData {
  return analyticsData;
}

export function getTeamRolesData(): TeamRolesData {
  return teamRolesData;
}

export function getFacilitySettingsData(): FacilitySettingsData {
  return facilitySettingsData;
}

export function getComplianceAuditData(): ComplianceAuditData {
  return complianceData;
}
