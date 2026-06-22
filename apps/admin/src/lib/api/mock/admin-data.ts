import type {
  BookingControlItemContract,
  CoverageRegionContract,
  ModerationReviewContract,
  OperationsDashboardContract,
  PolicyTemplateContract,
  PricingRuleContract,
  ProviderMasterItemContract,
  ProviderOnboardingItemContract,
  ProviderProfileContract,
  ProviderVerificationDetailContract,
  RefundCaseContract,
  SafetyCaseContract,
  ServiceCatalogItemContract,
  SettlementBatchContract,
  SupportTicketContract,
  TelehealthOpsSessionContract,
  AccessGrantContract,
  AuditLogContract,
  ReportDefinitionContract,
  CampaignContract,
  IntegrationSettingContract
} from '@/lib/api/contracts/admin';

export const mockDashboard: OperationsDashboardContract = {
  kpis: [
    { id: 'gmv', label: 'GMV', value: 'SAR 1.24M', trend: '+9.8% vs last week' },
    { id: 'bookings', label: 'Bookings', value: '4,286', trend: '+4.1% vs last week' },
    { id: 'uptime', label: 'Platform Uptime', value: '99.96%', trend: 'Last 7 days' }
  ],
  supportBacklog: 28,
  safetyIncidentsOpen: 3,
  uptime: '99.96%'
};

export const mockProviderQueue: ProviderOnboardingItemContract[] = [
  {
    id: 'prov-101',
    providerName: 'Dr. Abdullah Al-Saud',
    organizationName: 'Riyadh Care Group',
    city: 'Riyadh',
    specialty: 'General Practice',
    submittedAt: '2026-03-24 09:10',
    slaHoursRemaining: 12,
    docStatus: 'Complete',
    riskFlag: 'Low'
  },
  {
    id: 'prov-102',
    providerName: 'Dr. Sarah Chen',
    organizationName: 'North Clinic Network',
    city: 'Jeddah',
    specialty: 'Dermatology',
    submittedAt: '2026-03-24 11:42',
    slaHoursRemaining: 6,
    docStatus: 'Missing items',
    riskFlag: 'Medium'
  },
  {
    id: 'prov-103',
    providerName: 'Al Borg Diagnostics',
    organizationName: 'Al Borg Diagnostics',
    city: 'Dammam',
    specialty: 'Laboratory Services',
    submittedAt: '2026-03-23 15:22',
    slaHoursRemaining: 2,
    docStatus: 'Needs recheck',
    riskFlag: 'High'
  }
];

export const mockProviderDetails: Record<string, ProviderVerificationDetailContract> = {
  'prov-101': {
    id: 'prov-101',
    providerName: 'Dr. Abdullah Al-Saud',
    organizationName: 'Riyadh Care Group',
    licenseNumber: 'LIC-204882',
    cityCoverage: ['Riyadh', 'Diriyah'],
    mandatoryDocs: [
      { name: 'Medical License', status: 'Received' },
      { name: 'National ID', status: 'Received' },
      { name: 'Bank Payout Form', status: 'Received' }
    ],
    checks: [
      { label: 'License verification', result: 'Pass' },
      { label: 'Sanctions screening', result: 'Pass' },
      { label: 'Org compliance', result: 'Pass' }
    ],
    riskNotes: ['Low-risk practitioner profile with complete onboarding evidence.']
  },
  'prov-102': {
    id: 'prov-102',
    providerName: 'Dr. Sarah Chen',
    organizationName: 'North Clinic Network',
    licenseNumber: 'LIC-311904',
    cityCoverage: ['Jeddah'],
    mandatoryDocs: [
      { name: 'Medical License', status: 'Received' },
      { name: 'National ID', status: 'Received' },
      { name: 'Bank Payout Form', status: 'Missing' }
    ],
    checks: [
      { label: 'License verification', result: 'Pass' },
      { label: 'Sanctions screening', result: 'Pass' },
      { label: 'Org compliance', result: 'Review' }
    ],
    riskNotes: ['Payout details still pending. Approval must not proceed until mandatory finance onboarding is complete.']
  },
  'prov-103': {
    id: 'prov-103',
    providerName: 'Al Borg Diagnostics',
    organizationName: 'Al Borg Diagnostics',
    licenseNumber: 'ORG-918277',
    cityCoverage: ['Dammam', 'Khobar'],
    mandatoryDocs: [
      { name: 'Lab License', status: 'Received' },
      { name: 'Commercial Registration', status: 'Received' },
      { name: 'Quality Certificate', status: 'Rejected' }
    ],
    checks: [
      { label: 'License verification', result: 'Pass' },
      { label: 'Quality accreditation', result: 'Fail' },
      { label: 'Sanctions screening', result: 'Pass' }
    ],
    riskNotes: [
      'Quality certificate expired on submission date.',
      'High-risk review required before any re-submission approval.'
    ]
  }
};


export const mockProviderDirectory: ProviderMasterItemContract[] = [
  {
    id: 'prov-201',
    providerName: 'Dr. Layla Hariri',
    organizationName: 'CarePoint Internal Medicine',
    providerType: 'Individual',
    specialty: 'Internal Medicine',
    primaryMarket: 'Beirut',
    operatingStatus: 'Active',
    credentialHealth: 'Healthy',
    bookingEligibility: 'Eligible',
    payoutReadiness: 'Ready',
    linkedOpenItems: 1,
    lastReviewedAt: '2026-03-28 10:20'
  },
  {
    id: 'prov-202',
    providerName: 'Cedars Telehealth Group',
    organizationName: 'Cedars Telehealth Group',
    providerType: 'Organization',
    specialty: 'Multi-specialty Telehealth',
    primaryMarket: 'Riyadh',
    operatingStatus: 'Pending re-verification',
    credentialHealth: 'Expiring soon',
    bookingEligibility: 'Limited',
    payoutReadiness: 'Pending',
    linkedOpenItems: 4,
    lastReviewedAt: '2026-03-27 16:05'
  },
  {
    id: 'prov-203',
    providerName: 'Dr. Omar Haddad',
    organizationName: 'North Clinic Network',
    providerType: 'Individual',
    specialty: 'Dermatology',
    primaryMarket: 'Jeddah',
    operatingStatus: 'Restricted',
    credentialHealth: 'Action required',
    bookingEligibility: 'Blocked',
    payoutReadiness: 'On hold',
    linkedOpenItems: 3,
    lastReviewedAt: '2026-03-29 08:40'
  },
  {
    id: 'prov-204',
    providerName: 'Gulf Diagnostics Lab',
    organizationName: 'Gulf Diagnostics Lab',
    providerType: 'Organization',
    specialty: 'Diagnostics',
    primaryMarket: 'Dammam',
    operatingStatus: 'Suspended',
    credentialHealth: 'Action required',
    bookingEligibility: 'Blocked',
    payoutReadiness: 'On hold',
    linkedOpenItems: 6,
    lastReviewedAt: '2026-03-30 12:15'
  }
];

export const mockProviderProfiles: Record<string, ProviderProfileContract> = {
  'prov-201': {
    id: 'prov-201',
    providerName: 'Dr. Layla Hariri',
    organizationName: 'CarePoint Internal Medicine',
    providerType: 'Individual',
    specialty: 'Internal Medicine',
    primaryMarket: 'Beirut',
    licenseNumber: 'LB-MED-99201',
    operatingStatus: 'Active',
    bookingEligibility: 'Eligible',
    payoutReadiness: 'Ready',
    credentialHealth: 'Healthy',
    telehealthEligible: true,
    inPersonEligible: true,
    lastReviewedAt: '2026-03-28 10:20',
    rosterSummary: {
      activeBookings7d: 46,
      completionRate: '97.8%',
      refundRate: '1.1%',
      csat: '4.8/5'
    },
    credentials: [
      { name: 'Medical license', status: 'Valid', expiry: '2027-11-30' },
      { name: 'Identity document', status: 'Valid', expiry: '2030-04-12' },
      { name: 'Bank payout mandate', status: 'Valid' },
      { name: 'Telehealth compliance attestation', status: 'Valid', expiry: '2026-12-31' }
    ],
    linkedQueues: {
      onboardingStatus: 'Approved',
      supportTicketsOpen: 1,
      safetyCasesOpen: 0,
      payoutExceptionsOpen: 0
    },
    timeline: [
      { at: '2026-03-28 10:20', event: 'Quarterly credential review completed by Provider Ops.' },
      { at: '2026-03-16 13:40', event: 'Telehealth eligibility expanded to include follow-up consultations.' },
      { at: '2026-02-02 09:10', event: 'Provider profile activated for Beirut market.' }
    ],
    statusChangeGuardrails: [
      'Deactivation must show impact on upcoming bookings and telehealth wait rooms before save.',
      'Booking eligibility cannot be blocked without a reason code and effective timestamp.',
      'Any payout hold must create a finance review audit event.'
    ]
  },
  'prov-202': {
    id: 'prov-202',
    providerName: 'Cedars Telehealth Group',
    organizationName: 'Cedars Telehealth Group',
    providerType: 'Organization',
    specialty: 'Multi-specialty Telehealth',
    primaryMarket: 'Riyadh',
    licenseNumber: 'ORG-RYD-22015',
    operatingStatus: 'Pending re-verification',
    bookingEligibility: 'Limited',
    payoutReadiness: 'Pending',
    credentialHealth: 'Expiring soon',
    telehealthEligible: true,
    inPersonEligible: false,
    lastReviewedAt: '2026-03-27 16:05',
    rosterSummary: {
      activeBookings7d: 112,
      completionRate: '94.2%',
      refundRate: '2.9%',
      csat: '4.4/5'
    },
    credentials: [
      { name: 'Organization license', status: 'Expiring soon', expiry: '2026-04-21' },
      { name: 'Commercial registration', status: 'Valid', expiry: '2027-02-01' },
      { name: 'Payout beneficiary verification', status: 'Missing' },
      { name: 'Telehealth policy acknowledgement', status: 'Valid', expiry: '2026-12-31' }
    ],
    linkedQueues: {
      onboardingStatus: 'Pending update',
      supportTicketsOpen: 2,
      safetyCasesOpen: 0,
      payoutExceptionsOpen: 2
    },
    timeline: [
      { at: '2026-03-27 16:05', event: 'Re-verification requested because organization license is nearing expiry.' },
      { at: '2026-03-24 14:00', event: 'Payout beneficiary update requested by Finance.' },
      { at: '2026-01-15 11:35', event: 'Riyadh telehealth roster activated.' }
    ],
    statusChangeGuardrails: [
      'Pending re-verification status must keep existing bookings visible while restricting new booking growth.',
      'Payout readiness cannot move to Ready until beneficiary verification is complete.',
      'Restricted telehealth organizations require support notice before status downgrade.'
    ]
  },
  'prov-203': {
    id: 'prov-203',
    providerName: 'Dr. Omar Haddad',
    organizationName: 'North Clinic Network',
    providerType: 'Individual',
    specialty: 'Dermatology',
    primaryMarket: 'Jeddah',
    licenseNumber: 'KSA-DERM-77291',
    operatingStatus: 'Restricted',
    bookingEligibility: 'Blocked',
    payoutReadiness: 'On hold',
    credentialHealth: 'Action required',
    telehealthEligible: false,
    inPersonEligible: true,
    lastReviewedAt: '2026-03-29 08:40',
    rosterSummary: {
      activeBookings7d: 9,
      completionRate: '90.1%',
      refundRate: '4.6%',
      csat: '4.1/5'
    },
    credentials: [
      { name: 'Medical license', status: 'Valid', expiry: '2026-10-10' },
      { name: 'Identity document', status: 'Valid', expiry: '2028-03-03' },
      { name: 'Bank payout mandate', status: 'Rejected' },
      { name: 'Clinical privilege letter', status: 'Missing' }
    ],
    linkedQueues: {
      onboardingStatus: 'Approved',
      supportTicketsOpen: 1,
      safetyCasesOpen: 1,
      payoutExceptionsOpen: 1
    },
    timeline: [
      { at: '2026-03-29 08:40', event: 'Provider restricted pending missing clinical privilege letter.' },
      { at: '2026-03-28 09:30', event: 'Payout hold applied after beneficiary mismatch.' },
      { at: '2026-01-22 15:00', event: 'Provider roster imported from North Clinic Network.' }
    ],
    statusChangeGuardrails: [
      'Blocked booking eligibility requires explicit reason and end-date review target.',
      'Payout hold must notify Finance and Support queues.',
      'Restriction removal requires all missing credentials to return to valid state.'
    ]
  },
  'prov-204': {
    id: 'prov-204',
    providerName: 'Gulf Diagnostics Lab',
    organizationName: 'Gulf Diagnostics Lab',
    providerType: 'Organization',
    specialty: 'Diagnostics',
    primaryMarket: 'Dammam',
    licenseNumber: 'LAB-99811',
    operatingStatus: 'Suspended',
    bookingEligibility: 'Blocked',
    payoutReadiness: 'On hold',
    credentialHealth: 'Action required',
    telehealthEligible: false,
    inPersonEligible: true,
    lastReviewedAt: '2026-03-30 12:15',
    rosterSummary: {
      activeBookings7d: 0,
      completionRate: '88.0%',
      refundRate: '8.2%',
      csat: '3.8/5'
    },
    credentials: [
      { name: 'Laboratory accreditation', status: 'Rejected' },
      { name: 'Commercial registration', status: 'Valid', expiry: '2027-06-01' },
      { name: 'Payout beneficiary verification', status: 'Valid' },
      { name: 'Quality certificate', status: 'Missing' }
    ],
    linkedQueues: {
      onboardingStatus: 'Rejected',
      supportTicketsOpen: 3,
      safetyCasesOpen: 1,
      payoutExceptionsOpen: 2
    },
    timeline: [
      { at: '2026-03-30 12:15', event: 'Provider suspended after failed quality re-verification.' },
      { at: '2026-03-29 09:00', event: 'Bookings blocked pending safety and compliance review.' },
      { at: '2026-02-10 10:55', event: 'Diagnostics partner added to Eastern market.' }
    ],
    statusChangeGuardrails: [
      'Suspended providers cannot regain eligibility without completed re-verification.',
      'Any unsuspension must require dual approval and a full audit note.',
      'Open diagnostics bookings must be reassigned or canceled before suspension is saved.'
    ]
  }
};

export const mockBookingControl: BookingControlItemContract[] = [
  {
    id: 'b-001',
    bookingRef: 'BK-88291',
    patientName: 'Amina Rahman',
    providerName: 'Dr. Abdullah Al-Saud',
    channel: 'Telehealth',
    status: 'Scheduled',
    city: 'Riyadh',
    scheduledAt: '2026-04-02 09:30',
    slaState: 'On track',
    adminOwner: 'Maya Ops',
    downstreamImpact: 'Waiting room opens in 12 min; no downstream risk yet',
    nextAction: 'Monitor provider join readiness'
  },
  {
    id: 'b-002',
    bookingRef: 'BK-88305',
    patientName: 'Khalid Omar',
    providerName: 'Dr. Sarah Chen',
    channel: 'In-Person',
    status: 'Delayed',
    incidentTag: 'Clinic delay > 20 min',
    city: 'Jeddah',
    scheduledAt: '2026-04-02 10:15',
    slaState: 'At risk',
    adminOwner: 'Rana Support',
    downstreamImpact: 'Support ticket already open; patient notification pending',
    nextAction: 'Offer rebook or wait-time credit'
  },
  {
    id: 'b-003',
    bookingRef: 'BK-88341',
    patientName: 'Laila Noor',
    providerName: 'Al Borg Diagnostics',
    channel: 'In-Person',
    status: 'Escalated',
    incidentTag: 'Coverage mismatch',
    city: 'Dammam',
    scheduledAt: '2026-04-02 11:00',
    slaState: 'Breached',
    adminOwner: 'Khaled Ops',
    downstreamImpact: 'Refund review likely; provider reassignment required',
    nextAction: 'Reassign provider and link refund check'
  },
  {
    id: 'b-004',
    bookingRef: 'BK-88388',
    patientName: 'Mona Saad',
    providerName: 'Cedars Telehealth Group',
    channel: 'Telehealth',
    status: 'Cancelled',
    incidentTag: 'Provider availability revoked',
    city: 'Riyadh',
    scheduledAt: '2026-04-02 13:40',
    slaState: 'Breached',
    adminOwner: 'Omar Dispatch',
    downstreamImpact: 'Cancellation requires refund policy linkage and patient rebook option',
    nextAction: 'Confirm cancel reason and refund pathway'
  }
];

export const mockBookingControlWorkspace = {
  summary: [
    { label: 'Live bookings monitored', value: '184', detail: 'Active today across telehealth and in-person channels' },
    { label: 'Exceptions at risk', value: '17', detail: 'Bookings nearing SLA breach or provider no-show thresholds' },
    { label: 'Manual overrides today', value: '9', detail: 'Status or assignment changes requiring audit-ready reasons' }
  ],
  incidentQueue: [
    { label: 'Coverage mismatch', count: 4, note: 'Mostly diagnostics and weekend schedule changes' },
    { label: 'Clinic delay', count: 7, note: '3 cases already escalated to support' },
    { label: 'Provider no-show', count: 2, note: 'High refund risk if not resolved within 15 min' },
    { label: 'Payment hold', count: 1, note: 'Do not cancel before finance consequence check' }
  ],
  selectedBooking: {
    bookingRef: 'BK-88341',
    patientMasked: 'L.N.',
    providerName: 'Al Borg Diagnostics',
    service: 'CBC Blood Panel',
    market: 'Dammam',
    status: 'Escalated',
    channel: 'In-Person',
    scheduledAt: '2026-04-02 11:00',
    incidentTag: 'Coverage mismatch',
    adminOwner: 'Khaled Ops',
    impactSummary: [
      'Provider lost in-person eligibility for this city after last-night coverage update.',
      'Patient has already checked in at partner site.',
      'Refund case may be required if reassignment cannot occur within 15 minutes.'
    ],
    actions: ['Reassign provider', 'Cancel with reason', 'Open refund review', 'Notify support owner'],
    guardrails: [
      'Administrative overrides require a reason code and audit-ready note.',
      'Cancellation after payment should display downstream refund consequences before save.',
      'Reassignment must respect current coverage and provider availability constraints.'
    ]
  },
  bulkExceptionMonitor: [
    '5 telehealth sessions are waiting on provider join confirmation.',
    '3 bookings cannot be rebooked without weekend-calendar review.',
    '2 cancellation requests are blocked pending payment settlement visibility.'
  ]
};

export const mockServiceCatalog: ServiceCatalogItemContract[] = [
  {
    id: 'svc-001',
    category: 'Primary Care',
    serviceName: 'General Consultation',
    template: '30 min standard visit',
    status: 'Active',
    downstreamImpact: 'Used by 142 provider catalogs'
  },
  {
    id: 'svc-002',
    category: 'Diagnostics',
    serviceName: 'CBC Blood Panel',
    template: 'Lab template v4',
    status: 'Draft',
    downstreamImpact: 'Pending rollout to diagnostics partners'
  },
  {
    id: 'svc-003',
    category: 'Dermatology',
    serviceName: 'Follow-up Review',
    template: '20 min follow-up',
    status: 'Archived',
    downstreamImpact: 'Archived globally; hidden from new catalogs'
  }
];

export const mockServiceCatalogWorkspace = {
  summary: [
    { label: 'Active templates', value: '148', detail: 'Published into live booking and provider catalogs' },
    { label: 'Draft changes', value: '12', detail: 'Awaiting review, dependency check, or rollout decision' },
    { label: 'Dependency warnings', value: '5', detail: 'Services linked to pricing rules, campaigns, or limited coverage markets' }
  ],
  categoryTree: [
    { name: 'Primary Care', count: 34 },
    { name: 'Diagnostics', count: 22 },
    { name: 'Dermatology', count: 18 },
    { name: "Women's Health", count: 16 },
    { name: 'Wellness', count: 11 }
  ],
  selectedTemplate: {
    name: 'General Consultation',
    version: 'v12',
    owner: 'Operations taxonomy team',
    rolloutState: 'Published nationally with controlled provider overrides',
    dependencies: ['Pricing rules: 4', 'Coverage markets: 11', 'Campaign references: 2']
  },
  guardrails: [
    'Published services should be changed through controlled edits or versioned templates.',
    'Archiving must surface any active pricing rule, provider catalog, or campaign dependencies.',
    'New services should not publish until taxonomy, booking, and reporting mappings are complete.'
  ]
};

export const mockCoverage: CoverageRegionContract[] = [
  {
    id: 'cov-001',
    region: 'Riyadh Region',
    cities: ['Riyadh', 'Al Kharj', 'Diriyah'],
    weekendCalendar: 'Fri/Sat',
    telehealthEnabled: true,
    inPersonEnabled: true,
    status: 'Enabled'
  },
  {
    id: 'cov-002',
    region: 'Makkah Region',
    cities: ['Jeddah', 'Makkah', 'Taif'],
    weekendCalendar: 'Fri/Sat',
    telehealthEnabled: true,
    inPersonEnabled: true,
    status: 'Enabled'
  },
  {
    id: 'cov-003',
    region: 'Eastern Region',
    cities: ['Dammam', 'Khobar', 'Dhahran'],
    weekendCalendar: 'Fri/Sat',
    telehealthEnabled: true,
    inPersonEnabled: false,
    status: 'Limited'
  }
];

export const mockCoverageWorkspace = {
  summary: [
    { label: 'Regions enabled', value: '11', detail: 'Markets currently bookable in at least one modality' },
    { label: 'Cities with constraints', value: '4', detail: 'Capacity, provider density, or service coverage gaps detected' },
    { label: 'Pending impact checks', value: '3', detail: 'Coverage changes blocked until downstream bookings are reviewed' }
  ],
  constrainedMarkets: [
    { region: 'Eastern Region', issue: 'In-person diagnostics suspended pending lab staffing recovery', impact: '11 open future bookings require reassignment review' },
    { region: 'Madinah Region', issue: 'Telehealth psychiatry limited to follow-up visits only', impact: 'New-patient campaigns remain blocked' },
    { region: 'Asir Region', issue: 'Weekend operating calendar under revision for Ramadan schedule', impact: 'Appointment templates require revalidation before publish' }
  ],
  weekendRules: [
    'Default production calendar: Friday/Saturday weekend for KSA markets.',
    'Exception templates must declare holiday coverage and provider scheduling coverage.',
    'Disabling a city should surface active booking and provider availability impact before save.'
  ]
};

export const mockTelehealthOps: TelehealthOpsSessionContract[] = [
  {
    id: 'tele-001',
    sessionRef: 'TH-24091',
    providerName: 'Dr. Abdullah Al-Saud',
    patientInitials: 'A.R.',
    region: 'Riyadh',
    state: 'Healthy',
    failureRate: '0.2%',
    supportHook: 'Standard monitoring only',
    roomState: 'Live',
    roomType: 'Scheduled consult',
    issueOwner: 'Auto-monitor',
    lastHeartbeatAt: '2026-04-02 09:08',
    metadataAccess: 'Metadata only'
  },
  {
    id: 'tele-002',
    sessionRef: 'TH-24092',
    providerName: 'Dr. Sarah Chen',
    patientInitials: 'K.O.',
    region: 'Jeddah',
    state: 'Degraded',
    failureRate: '3.8%',
    supportHook: 'Proactive support ping queued',
    roomState: 'Reconnect loop',
    roomType: 'Follow-up',
    issueOwner: 'Noor Support',
    lastHeartbeatAt: '2026-04-02 09:02',
    metadataAccess: 'Metadata only'
  },
  {
    id: 'tele-003',
    sessionRef: 'TH-24093',
    providerName: 'Dr. Reem Hassan',
    patientInitials: 'L.N.',
    region: 'Dammam',
    state: 'Failed',
    failureRate: '12.0%',
    supportHook: 'Escalated to telehealth support',
    roomState: 'Waiting room',
    roomType: 'Urgent consult',
    issueOwner: 'Maya Ops',
    lastHeartbeatAt: '2026-04-02 08:57',
    metadataAccess: 'Escalated metadata'
  },
  {
    id: 'tele-004',
    sessionRef: 'TH-24094',
    providerName: 'Dr. Layla Hariri',
    patientInitials: 'S.M.',
    region: 'Beirut',
    state: 'Healthy',
    failureRate: '0.0%',
    supportHook: 'No manual intervention',
    roomState: 'Waiting room',
    roomType: 'Scheduled consult',
    issueOwner: 'Auto-monitor',
    lastHeartbeatAt: '2026-04-02 09:09',
    metadataAccess: 'Metadata only'
  }
];

export const mockTelehealthWorkspace = {
  summary: [
    { label: 'Sessions observed', value: '63', detail: 'Current and upcoming encounters in the ops monitor' },
    { label: 'Degraded / failed', value: '6', detail: 'Sessions needing support touch or engineering escalation' },
    { label: 'Median join latency', value: '01:42', detail: 'From room open to both participants connected' }
  ],
  failureTrends: [
    { label: 'Network instability', value: '4 sessions', detail: 'Mostly mobile-network reconnect loops' },
    { label: 'Provider device issue', value: '1 session', detail: 'Camera permission revoked mid-session' },
    { label: 'Patient join friction', value: '3 sessions', detail: 'OTP resend and browser compatibility mix' }
  ],
  selectedSession: {
    sessionRef: 'TH-24093',
    providerName: 'Dr. Reem Hassan',
    patientMasked: 'L.N.',
    state: 'Failed',
    roomState: 'Waiting room',
    roomType: 'Urgent consult',
    region: 'Dammam',
    issueOwner: 'Maya Ops',
    supportHook: 'Escalated to telehealth support',
    metadata: [
      'Last heartbeat: 02 Apr 2026 08:57 UTC',
      'Join attempt count: 4',
      'Audio channel failed after room creation',
      'No consultation content exposed in this workspace'
    ],
    guardrails: [
      'Metadata-first monitoring only; content access requires separate privileged workflow.',
      'Resolved status should record root cause and owner in the audit trail.',
      'Critical safety-linked telehealth failures should open or link a safety case.'
    ]
  },
  exceptionQueue: [
    '2 urgent consults are still waiting on provider join confirmation.',
    '1 failed room is linked to an open support escalation.',
    '1 market shows elevated reconnect loops after mobile browser update.'
  ]
};

export const mockSettlements: SettlementBatchContract[] = [
  {
    id: 'set-001',
    batchRef: 'SET-2026-031',
    gateway: 'Mada / HyperPay',
    status: 'Cleared',
    amount: 'SAR 412,800',
    aging: '0 days'
  },
  {
    id: 'set-002',
    batchRef: 'SET-2026-032',
    gateway: 'Apple Pay',
    status: 'Pending',
    amount: 'SAR 96,320',
    aging: '2 days'
  },
  {
    id: 'set-003',
    batchRef: 'SET-2026-033',
    gateway: 'STC Pay',
    status: 'Mismatch',
    amount: 'SAR 22,400',
    aging: '4 days'
  }
];

export const mockRefunds: RefundCaseContract[] = [
  {
    id: 'rf-001',
    caseRef: 'RF-1202',
    bookingRef: 'BK-88291',
    party: 'Patient',
    reasonCode: 'Clinic cancellation',
    evidenceStatus: 'Complete',
    policy: 'Full refund >24h',
    amount: 'SAR 172.50'
  },
  {
    id: 'rf-002',
    caseRef: 'RF-1203',
    bookingRef: 'BK-88311',
    party: 'Provider',
    reasonCode: 'Chargeback - duplicate payment',
    evidenceStatus: 'Needs review',
    policy: 'Finance manual review',
    amount: 'SAR 250.00'
  },
  {
    id: 'rf-003',
    caseRef: 'RF-1204',
    bookingRef: 'BK-88321',
    party: 'Patient',
    reasonCode: 'No-show dispute',
    evidenceStatus: 'Missing',
    policy: 'Partial refund only if evidence supports',
    amount: 'SAR 85.00'
  }
];

export const mockSettlementWorkspace = {
  summary: [
    { label: 'Cleared batches', value: '18', detail: 'Posted successfully in the last 24 hours across active gateways' },
    { label: 'Batches pending review', value: '4', detail: 'Awaiting gateway confirmation, ledger match, or manual reconciliation' },
    { label: 'Mismatch exposure', value: 'SAR 22.4k', detail: 'Unreconciled variance currently blocked from automated payout release' }
  ],
  mismatchWatch: [
    { label: 'Gateway delay', value: '2', detail: 'Apple Pay and STC Pay postings outside expected settlement window' },
    { label: 'Ledger mismatch', value: '1', detail: 'One batch differs from finance ledger totals and needs owner confirmation' },
    { label: 'Refund offset pending', value: '3', detail: 'Refund batches not yet netted against payout-ready positions' }
  ],
  selectedBatch: {
    batchRef: 'SET-2026-033',
    gateway: 'STC Pay',
    status: 'Mismatch',
    amount: 'SAR 22,400',
    aging: '4 days',
    owner: 'Mona Finance',
    postingWindow: '2026-04-01 08:00 to 10:00 UTC',
    variance: 'SAR 1,240 unresolved between gateway export and internal ledger',
    affectedDomains: ['Provider payouts on hold', 'Refund offset check required', 'Month-end finance pack impacted'],
    exceptions: [
      'One diagnostics payout line posted twice in the upstream gateway export.',
      'Two refund reversals are still awaiting gateway acknowledgment.',
      'Batch cannot be marked cleared until finance and payouts totals reconcile.'
    ],
    actions: ['Open reconciliation task', 'Export gateway file', 'Hold downstream payouts'],
    guardrails: [
      'Clearing a mismatched batch should require a reconciled variance note and owner confirmation.',
      'Any payout hold created from reconciliation must be audit logged with impacted amount and reason.',
      'Manual finance overrides should preserve the original gateway file and reconciliation artifact links.'
    ]
  },
  exportQueue: [
    'Daily settlement export for HyperPay is scheduled at 16:00 UTC.',
    'Month-end reconciliation bundle remains blocked until SET-2026-033 is resolved.',
    'Two provider payout files are queued behind pending mismatch clearance.'
  ]
};

export const mockRefundWorkspace = {
  summary: [
    { label: 'Open refund cases', value: '26', detail: 'Patient, provider, and gateway disputes currently awaiting determination' },
    { label: 'Chargebacks at risk', value: '5', detail: 'Cases likely to escalate to gateway or card-network review this week' },
    { label: 'Policy exceptions', value: '3', detail: 'Requests requiring finance or compliance approval before release' }
  ],
  reasonBreakdown: [
    { label: 'Clinic cancellation', value: '9', detail: 'Mostly same-day provider or site availability incidents' },
    { label: 'Duplicate charge', value: '4', detail: 'Needs gateway evidence pack and chargeback decisioning' },
    { label: 'No-show dispute', value: '6', detail: 'Evidence completeness is the largest current blocker' }
  ],
  selectedCase: {
    caseRef: 'RF-1203',
    bookingRef: 'BK-88311',
    counterparty: 'Provider dispute',
    owner: 'Sara Finance',
    amount: 'SAR 250.00',
    reasonCode: 'Chargeback - duplicate payment',
    evidenceStatus: 'Needs review',
    policy: 'Finance manual review',
    queueState: 'Pending evidence decision',
    evidence: [
      'Gateway export received with duplicate authorization marker.',
      'Original booking completion signal is present but post-visit capture timing is inconsistent.',
      'Patient ledger shows one successful charge and one reversal still pending.'
    ],
    timeline: [
      '2026-04-01 08:40 UTC · chargeback warning imported from gateway feed',
      '2026-04-01 09:05 UTC · refund case auto-created and assigned to finance queue',
      '2026-04-01 10:10 UTC · provider disputed duplicate payment classification'
    ],
    recommendedActions: ['Approve manual review', 'Request gateway evidence', 'Link booking timeline'],
    policyChecks: [
      'Reason code is mandatory for approve, deny, and partial-refund outcomes.',
      'Cases with incomplete evidence should not release funds until finance owner confirms documentation sufficiency.',
      'Any policy exception must store the approving owner and rationale in the audit trail.'
    ]
  }
};

export const mockPricingRules: PricingRuleContract[] = [
  {
    id: 'pr-001',
    ruleName: 'Primary Care Telehealth Standard',
    market: 'KSA',
    commissionModel: '18% provider commission',
    effectiveFrom: '2026-04-01',
    status: 'Published'
  },
  {
    id: 'pr-002',
    ruleName: 'Diagnostics Weekend Premium',
    market: 'Riyadh + Jeddah',
    commissionModel: 'Flat SAR 12 platform fee',
    effectiveFrom: '2026-04-15',
    status: 'Scheduled'
  },
  {
    id: 'pr-003',
    ruleName: 'Seasonal Promo Rule',
    market: 'National',
    commissionModel: 'Promo subsidy 10%',
    effectiveFrom: 'Draft',
    status: 'Draft'
  }
];

export const mockPricingWorkspace = {
  summary: [
    { label: 'Published rules', value: '28', detail: 'Currently active in the booking and settlement engines' },
    { label: 'Scheduled changes', value: '6', detail: 'Future-dated market or service rule updates awaiting rollout' },
    { label: 'Conflict checks', value: '2', detail: 'Overlapping scopes require resolution before publish' }
  ],
  simulations: [
    { scenario: 'Primary care telehealth / Riyadh', gross: 'SAR 180', provider: 'SAR 147.60', platform: 'SAR 32.40' },
    { scenario: 'Diagnostics weekend / Jeddah', gross: 'SAR 220', provider: 'SAR 208.00', platform: 'SAR 12.00' },
    { scenario: 'Seasonal promo / National', gross: 'SAR 140', provider: 'SAR 126.00', platform: 'SAR 14.00' }
  ],
  guardrails: [
    'Published rules must not be edited silently in place; changes should use draft or scheduled versions.',
    'Future-dated rules need overlap checks across market, channel, and service scope.',
    'Simulation outcomes should match the same calculation logic used by booking and payment flows.'
  ]
};

export const mockReviewModeration: ModerationReviewContract[] = [
  {
    id: 'rm-001',
    reviewRef: 'REV-7711',
    providerName: 'Dr. Abdullah Al-Saud',
    fraudScore: 'Low',
    disputeOpen: false,
    moderationState: 'Queued'
  },
  {
    id: 'rm-002',
    reviewRef: 'REV-7720',
    providerName: 'North Clinic Network',
    fraudScore: 'Medium',
    disputeOpen: true,
    moderationState: 'Redacted'
  },
  {
    id: 'rm-003',
    reviewRef: 'REV-7728',
    providerName: 'Al Borg Diagnostics',
    fraudScore: 'High',
    disputeOpen: true,
    moderationState: 'Removed'
  }
];

export const mockSupportTickets: SupportTicketContract[] = [
  {
    id: 'sup-001',
    ticketRef: 'TCK-4901',
    channel: 'Patient',
    subject: 'Unable to join telehealth session',
    piiMasking: 'Masked',
    status: 'Open',
    sla: '34 min',
    owner: 'Noor Support',
    priority: 'P1',
    linkedDomain: 'Telehealth',
    nextMilestone: 'Call patient and relaunch room link'
  },
  {
    id: 'sup-002',
    ticketRef: 'TCK-4907',
    channel: 'Provider',
    subject: 'Availability block not publishing',
    piiMasking: 'Restricted',
    status: 'Escalated',
    sla: '12 min',
    owner: 'Rana Ops',
    priority: 'P2',
    linkedDomain: 'Provider Ops',
    nextMilestone: 'Confirm coverage sync and release queue note'
  },
  {
    id: 'sup-003',
    ticketRef: 'TCK-4911',
    channel: 'Patient',
    subject: 'Refund case follow-up',
    piiMasking: 'Masked',
    status: 'Waiting on reply',
    sla: '2h 10m',
    owner: 'Mira Finance',
    priority: 'P2',
    linkedDomain: 'Refunds',
    nextMilestone: 'Await payment gateway evidence'
  },
  {
    id: 'sup-004',
    ticketRef: 'TCK-4913',
    channel: 'Patient',
    subject: 'Clinic delay and reassignment request',
    piiMasking: 'Masked',
    status: 'Resolved',
    sla: 'Closed in 22 min',
    owner: 'Omar Dispatch',
    priority: 'P1',
    linkedDomain: 'Bookings',
    nextMilestone: 'Timeline exported to audit trail'
  }
];

export const mockSupportWorkspace = {
  summary: [
    { label: 'Open tickets', value: '41', detail: 'Across patient and provider support channels' },
    { label: 'SLA at risk', value: '8', detail: 'Priority tickets needing intervention in the next 30 minutes' },
    { label: 'Escalated domains', value: '4', detail: 'Bookings, refunds, telehealth, and provider ops' }
  ],
  macros: [
    'Telehealth reconnect guidance',
    'Booking delay compensation explanation',
    'Refund evidence follow-up',
    'Provider availability sync checklist'
  ],
  selectedTicket: {
    ticketRef: 'TCK-4901',
    owner: 'Noor Support',
    priority: 'P1',
    linkedDomain: 'Telehealth',
    maskedCounterparty: 'Patient A.R.',
    timeline: [
      '09:01 UTC · Ticket opened from telehealth waiting room assistance flow',
      '09:03 UTC · Patient failed OTP retry and requested live help',
      '09:05 UTC · Support macro prepared for reconnect flow',
      '09:07 UTC · Telehealth ops linked to active session TH-24092'
    ],
    escalationOptions: ['Booking control tower', 'Telehealth operations', 'Refunds review', 'Safety case intake'],
    guardrails: [
      'Sensitive data remains masked unless elevated role and purpose are granted.',
      'Macros should not bypass required resolution notes or escalation reason fields.',
      'Exported timelines must record who accessed the support-safe view.'
    ]
  }
};

export const mockSafetyCases: SafetyCaseContract[] = [
  {
    id: 'safe-001',
    caseRef: 'SC-2210',
    severity: 'Major',
    summary: 'Escalated post-visit adverse event report linked to delayed referral follow-up.',
    status: 'Pending approval',
    dualApprovalRequired: true,
    category: 'Clinical',
    investigator: 'Dr. Hiba Nassar',
    linkedSource: 'Support escalation TCK-4908',
    nextReviewAt: '2026-04-02 12:30',
    actions: ['Assign clinical safety lead', 'Collect provider statement', 'Export case summary for review'],
    approvals: [
      { reviewer: 'Safety reviewer', decision: 'Approved', at: '2026-03-25 11:10' },
      { reviewer: 'Medical director', decision: 'Pending' }
    ],
    closureGuardrails: [
      'Major or critical cases require controlled closure transitions with approver record.',
      'Outcome changes after approval should reopen the approval trail.',
      'Linked provider actions must be visible before closure.'
    ],
    timeline: [
      { at: '2026-03-25 08:40', event: 'Case opened by support escalation' },
      { at: '2026-03-25 09:20', event: 'Severity upgraded to Major' },
      { at: '2026-03-25 10:05', event: 'Dual approval workflow started' }
    ]
  },
  {
    id: 'safe-002',
    caseRef: 'SC-2214',
    severity: 'Critical',
    summary: 'Potential medication instruction mismatch under urgent review.',
    status: 'Escalated',
    dualApprovalRequired: true,
    category: 'Medication',
    investigator: 'Dr. Rana Shihab',
    linkedSource: 'Telehealth session TH-24093',
    nextReviewAt: '2026-04-02 10:45',
    actions: ['Freeze downstream notification', 'Notify medical director', 'Review signed encounter note'],
    approvals: [
      { reviewer: 'Safety reviewer', decision: 'Pending' },
      { reviewer: 'Medical director', decision: 'Pending' }
    ],
    closureGuardrails: [
      'Critical medication cases require immediate investigator assignment.',
      'Case cannot close until all urgent actions are completed and documented.',
      'Telehealth-linked incidents should preserve metadata access logs.'
    ],
    timeline: [
      { at: '2026-03-25 11:12', event: 'Case opened from complaint workflow' },
      { at: '2026-03-25 11:25', event: 'Critical routing triggered' }
    ]
  },
  {
    id: 'safe-003',
    caseRef: 'SC-2219',
    severity: 'Minor',
    summary: 'Operational handoff issue caused a delayed follow-up notification.',
    status: 'Open',
    dualApprovalRequired: false,
    category: 'Operational',
    investigator: 'Lina Quality',
    linkedSource: 'Booking BK-88305',
    nextReviewAt: '2026-04-03 09:00',
    actions: ['Review scheduler logs', 'Confirm patient communication path'],
    approvals: [
      { reviewer: 'Safety reviewer', decision: 'Pending' }
    ],
    closureGuardrails: [
      'Minor cases still require documented remediation before closure.',
      'Do not close while linked support escalation remains active.'
    ],
    timeline: [
      { at: '2026-04-01 14:05', event: 'Case opened from booking delay pattern review' }
    ]
  }
];

export const mockSafetyWorkspace = {
  summary: [
    { label: 'Open cases', value: '7', detail: 'Clinical and operational safety incidents under active review' },
    { label: 'Pending approvals', value: '3', detail: 'Cases waiting on dual or senior reviewer decisions' },
    { label: 'Critical response SLA', value: '00:14', detail: 'Median time to investigator assignment this week' }
  ],
  workQueues: [
    '2 critical or medication-linked cases require same-shift review.',
    '1 provider profile has an active restriction linked to a safety case.',
    '2 cases are waiting on support or telehealth evidence collection.'
  ]
};

export const mockPolicyTemplates: PolicyTemplateContract[] = [
  {
    id: 'pol-001',
    templateName: 'Telehealth Consent',
    policyArea: 'Consent',
    country: 'Saudi Arabia',
    version: 'v6.2',
    status: 'Published'
  },
  {
    id: 'pol-002',
    templateName: 'Data Sharing Disclosure',
    policyArea: 'Privacy',
    country: 'Saudi Arabia',
    version: 'v3.4',
    status: 'Draft'
  },
  {
    id: 'pol-003',
    templateName: 'Health Advice Campaign Copy',
    policyArea: 'Communications',
    country: 'Saudi Arabia',
    version: 'v2.1',
    status: 'Archived'
  }
];

export const mockPolicyGovernance = {
  summary: [
    { label: 'Published templates', value: '24', detail: 'Immutable versions currently used in patient/provider journeys' },
    { label: 'Drafts awaiting approval', value: '5', detail: 'Legal, compliance, or safety review still pending' },
    { label: 'Localized variants', value: '9', detail: 'Country or language-specific policy versions under active management' }
  ],
  approvalChecklist: [
    'Published versions are immutable and require a new version for any content change.',
    'Drafts should capture jurisdiction, language, effective date, and approving owners before publish.',
    'Usage references should be checked before archive so active consent or campaign flows are not broken.'
  ],
  versionHistory: [
    { template: 'Telehealth Consent', version: 'v6.2', note: 'Published for KSA flow with minor consent clarification' },
    { template: 'Data Sharing Disclosure', version: 'v3.4', note: 'Draft update for privacy retention wording' },
    { template: 'Health Advice Campaign Copy', version: 'v2.1', note: 'Archived after communications policy refresh' }
  ],
  usageMap: [
    { template: 'Telehealth Consent', usedBy: 'Telehealth booking and waiting room flows' },
    { template: 'Data Sharing Disclosure', usedBy: 'Account creation and profile privacy settings' },
    { template: 'Health Advice Campaign Copy', usedBy: 'Archived campaign templates only' }
  ]
};


export const mockAccessGrants: AccessGrantContract[] = [
  {
    id: 'acc-001',
    userName: 'Noura Admin',
    role: 'Super Admin',
    grantScope: 'Platform-wide',
    mfaStatus: 'Enabled',
    accessReview: 'Due'
  },
  {
    id: 'acc-002',
    userName: 'Khalid Ops',
    role: 'Ops Admin',
    grantScope: 'Operations modules',
    mfaStatus: 'Enabled',
    accessReview: 'Certified'
  },
  {
    id: 'acc-003',
    userName: 'Mona Finance',
    role: 'Finance Admin',
    grantScope: 'Payments and refunds',
    mfaStatus: 'Pending',
    accessReview: 'Expired'
  }
];

export const mockAuditLogs: AuditLogContract[] = [
  {
    id: 'log-001',
    timestamp: '2026-03-27 09:11',
    actor: 'Noura Admin',
    action: 'Override booking status',
    target: 'BK-88341',
    purpose: 'Patient support escalation',
    outcome: 'Success'
  },
  {
    id: 'log-002',
    timestamp: '2026-03-27 09:34',
    actor: 'Mona Finance',
    action: 'Export settlement report',
    target: 'SET-2026-032',
    purpose: 'Month-end reconciliation',
    outcome: 'Success'
  },
  {
    id: 'log-003',
    timestamp: '2026-03-27 10:02',
    actor: 'External user',
    action: 'Attempt super admin grant',
    target: 'RBAC-REQUEST-77',
    purpose: 'Privilege change',
    outcome: 'Denied'
  }
];

export const mockAccessWorkspace = {
  summary: [
    { label: 'Privileged users', value: '14', detail: 'Users with admin roles or scoped operational elevation across the platform' },
    { label: 'Reviews due', value: '6', detail: 'Role grants requiring certification during the current monthly cycle' },
    { label: 'MFA gaps', value: '2', detail: 'Privileged identities missing a confirmed MFA posture' }
  ],
  reviewQueue: [
    '2 finance grants require certification before end-of-week close.',
    '1 super admin request is pending dual control approval.',
    '3 historical grants should be narrowed to least-privilege scopes.'
  ],
  selectedGrant: {
    userName: 'Mona Finance',
    role: 'Finance Admin',
    grantScope: 'Payments and refunds',
    mfaStatus: 'Pending',
    accessReview: 'Expired',
    owner: 'Security governance',
    requestedBy: 'Finance leadership',
    lastCertifiedAt: '2026-02-18 12:20 UTC',
    linkedRisks: [
      'Grant includes refund approvals and settlement exports.',
      'MFA is not yet confirmed for the most recent device enrollment.',
      'Review is overdue against the monthly certification cadence.'
    ],
    actions: ['Revoke grant', 'Re-certify access', 'Force MFA reset'],
    guardrails: [
      'Super admin and finance-admin grants should require a documented business purpose.',
      'Expired reviews should block privilege expansion until certification is complete.',
      'All grant changes must record actor, approver, scope, and reason in the audit trail.'
    ]
  },
  privilegedControls: [
    { label: 'Dual control', value: 'Enabled', detail: 'Required for super admin and emergency privilege grants' },
    { label: 'Break-glass accounts', value: '2', detail: 'Quarterly review and sealed credential procedure required' },
    { label: 'Certification cadence', value: 'Monthly', detail: 'Least-privilege review across all active admin roles' }
  ],
  roleMatrix: [
    'Operations Admin: booking, telehealth, support, and queue workflows without finance release rights.',
    'Finance Admin: settlements, refunds, and payout interventions with audited export capability.',
    'Read-only Auditor: search and export of audit-safe views without mutation rights.'
  ]
};

export const mockAuditWorkspace = {
  summary: [
    { label: 'Events today', value: '1,284', detail: 'Role changes, exports, overrides, and operational interventions captured' },
    { label: 'Denied attempts', value: '18', detail: 'Access or action attempts blocked by policy, RBAC, or missing prerequisites' },
    { label: 'Evidence exports', value: '7', detail: 'Audit-safe packets generated for finance, safety, or compliance review' }
  ],
  selectedLog: {
    timestamp: '2026-03-27 10:02',
    actor: 'External user',
    action: 'Attempt super admin grant',
    target: 'RBAC-REQUEST-77',
    purpose: 'Privilege change',
    outcome: 'Denied',
    source: 'Admin sign-in / grant endpoint',
    correlationId: 'corr-rbac-77412',
    details: [
      'Attempt originated from an unauthenticated external context and was denied before grant creation.',
      'RBAC policy rejected the request because privileged grants require an authenticated internal approver.',
      'Security alert rule was triggered because the requested scope included super admin access.'
    ]
  },
  savedViews: ['Denied privileged actions', 'Finance exports last 7 days', 'Booking overrides requiring follow-up'],
  alertRules: [
    'Trigger high-priority alert on repeated denied privileged attempts from the same source within 30 minutes.',
    'Escalate finance export activity above threshold to security governance review.',
    'Preserve correlation identifiers for cross-linking API, UI, and queue events during investigations.'
  ],
  evidenceChecklist: [
    'Include actor, timestamp, purpose, target, and outcome in every exported packet.',
    'Redact unnecessary personal data from audit exports unless a higher-access workflow justifies disclosure.',
    'Any manual annotation should record who added it and when.'
  ]
};

export const mockReports: ReportDefinitionContract[] = [
  {
    id: 'rep-001',
    reportName: 'Weekly platform KPI pack',
    domain: 'Operations',
    dataScope: 'Aggregated regional metrics',
    schedule: 'Mondays at 08:00',
    status: 'Scheduled'
  },
  {
    id: 'rep-002',
    reportName: 'Provider onboarding SLA monitor',
    domain: 'Provider operations',
    dataScope: 'Queue and reviewer workload',
    schedule: 'On demand',
    status: 'Last run complete'
  },
  {
    id: 'rep-003',
    reportName: 'Refund policy exceptions',
    domain: 'Finance',
    dataScope: 'Case-level summary without PHI',
    schedule: 'Draft',
    status: 'Draft'
  }
];

export const mockCampaigns: CampaignContract[] = [
  {
    id: 'cmp-001',
    campaignName: 'Ramadan support hours update',
    segment: 'All patients and providers in KSA',
    channel: 'In-App',
    approvalState: 'Approved',
    runState: 'Scheduled'
  },
  {
    id: 'cmp-002',
    campaignName: 'Telehealth degradation incident notice',
    segment: 'Affected active sessions',
    channel: 'SMS',
    approvalState: 'Approved',
    runState: 'Sent'
  },
  {
    id: 'cmp-003',
    campaignName: 'Health advice follow-up reminder',
    segment: 'Chronic care cohort',
    channel: 'Push',
    approvalState: 'Needs legal review',
    runState: 'Paused'
  }
];

export const mockIntegrations: IntegrationSettingContract[] = [
  {
    id: 'int-001',
    integrationName: 'HyperPay Gateway',
    category: 'Payments',
    status: 'Enabled',
    secretState: 'Masked',
    lastChangedAt: '2026-03-18 14:20'
  },
  {
    id: 'int-002',
    integrationName: 'National SMS Provider',
    category: 'Messaging',
    status: 'Pending rotation',
    secretState: 'Review required',
    lastChangedAt: '2026-03-25 09:05'
  },
  {
    id: 'int-003',
    integrationName: 'Identity Verification API',
    category: 'Compliance',
    status: 'Enabled',
    secretState: 'Rotated recently',
    lastChangedAt: '2026-03-26 16:40'
  }
];


export const mockReportsWorkspace = {
  summary: [
    { label: 'Saved reports', value: '26', detail: 'Operational, finance, provider, and governance definitions available to admins' },
    { label: 'Scheduled deliveries', value: '11', detail: 'Recurring KPI packs, queue monitors, and compliance summaries' },
    { label: 'Export reviews', value: '4', detail: 'Report runs awaiting recipient confirmation or data-scope review' }
  ],
  selectedReport: {
    reportName: 'Weekly platform KPI pack',
    status: 'Scheduled',
    domain: 'Operations',
    owner: 'Operations analytics',
    schedule: 'Mondays at 08:00 UTC',
    audience: 'Executive ops and market leads',
    scopeNote: 'Aggregated output only; drill-down identifiers stay hidden unless a higher-access workflow is approved.',
    metrics: [
      'Bookings, completion rate, and cancellation trend by market',
      'Telehealth uptime, reconnect loop rate, and support escalations',
      'Provider activation, onboarding SLA, and payout-hold counts'
    ],
    actions: ['Preview columns', 'Edit schedule', 'Run report now'],
    guardrails: [
      'Saved reports should keep a stable metric definition and versioned ownership.',
      'Scheduled deliveries must respect role-scoped audiences and approved recipient lists.',
      'Exports that widen data scope should create an audit event before delivery.'
    ]
  },
  deliveryPacks: [
    { label: 'Executive KPI pack', value: 'Weekly', detail: 'Aggregated platform and market performance summary' },
    { label: 'Queue SLA digest', value: 'Daily', detail: 'Provider onboarding and support queue risk snapshot' },
    { label: 'Finance exception report', value: 'On demand', detail: 'Refund and settlement mismatch review bundle' }
  ],
  exportQueue: [
    '1 finance exception report is waiting on recipient approval because the scope includes case-level trends.',
    '2 scheduled operational digests need updated distribution lists after RBAC changes.',
    'New report definitions should be versioned before replacing existing executive KPIs.'
  ]
};

export const mockCampaignWorkspace = {
  summary: [
    { label: 'Active campaigns', value: '9', detail: 'Scheduled or currently running operational and communication flows' },
    { label: 'Approval holds', value: '3', detail: 'Campaigns waiting on legal, compliance, or policy signoff' },
    { label: 'Suppression checks', value: '2', detail: 'Audience overlaps or send-window conflicts requiring review' }
  ],
  selectedCampaign: {
    campaignName: 'Health advice follow-up reminder',
    approvalState: 'Needs legal review',
    segment: 'Chronic care cohort',
    channel: 'Push',
    owner: 'Engagement operations',
    sendWindow: 'Weekdays 09:00-17:00 local time',
    blocker: 'Campaign cannot launch until health-advice copy and regional targeting exclusions are approved.',
    checks: [
      'Segment excludes active safety and refund escalations before send.',
      'Push copy references the latest policy-approved advice template.',
      'Quiet-hour and timezone rules apply per recipient market.'
    ],
    actions: ['Preview copy', 'Edit audience', 'Request legal approval'],
    guardrails: [
      'Medical or health-advice messaging requires the latest approved policy template.',
      'Audience changes should rerun suppression and overlap checks before save.',
      'Paused or canceled sends should preserve a reason and actor in the audit trail.'
    ]
  },
  deliveryWatch: [
    { label: 'Needs legal review', count: '3', note: 'Copy or policy approvals pending before schedule unlocks' },
    { label: 'Paused campaigns', count: '2', note: 'Suppression or operational incident review in progress' },
    { label: 'Recent sends', count: '6', note: 'Last 24 hours across SMS, push, and in-app channels' }
  ],
  recentOutcomes: [
    'Telehealth degradation incident notice reached 94% of the affected session cohort within 7 minutes.',
    'Ramadan support hours update is scheduled with market-local send windows and approved copy.',
    'One chronic care reminder campaign remains blocked pending legal wording review.'
  ]
};

export const mockIntegrationWorkspace = {
  summary: [
    { label: 'Enabled integrations', value: '14', detail: 'Live connectors across payments, messaging, compliance, and ops' },
    { label: 'Pending rotations', value: '2', detail: 'Credentials or webhooks requiring controlled key rotation' },
    { label: 'Recent config changes', value: '7', detail: 'Feature flags, endpoint toggles, or secret updates in the last week' }
  ],
  selectedIntegration: {
    integrationName: 'National SMS Provider',
    status: 'Pending rotation',
    category: 'Messaging',
    owner: 'Platform reliability',
    environment: 'Production + staging',
    lastRotatedAt: '2026-02-11 08:40 UTC',
    riskNote: 'Credential rotation is overdue and must be completed before the next large-scale campaign window.',
    checks: [
      'Webhook callback endpoint matches the active production environment.',
      'Fallback provider remains configured before rotating primary credentials.',
      'Any sender-ID change must be validated with campaign and support owners.'
    ],
    actions: ['Inspect webhook', 'Disable integration', 'Rotate secret now'],
    guardrails: [
      'Secrets stay masked in the UI and rotation should never reveal previous values.',
      'Environment changes require audit logging with actor, reason, and affected domains.',
      'Disabling a live connector should show downstream impact on campaigns, support, or telehealth flows before save.'
    ]
  },
  changeQueue: [
    { label: 'Rotation required', count: '2', note: 'Messaging and payment connectors with nearing credential expiry' },
    { label: 'Disabled integrations', count: '1', note: 'Legacy sandbox endpoint retained for reference only' },
    { label: 'Feature-flag reviews', count: '4', note: 'Scoped rollout checks for recently changed settings' }
  ],
  platformDependencies: [
    'HyperPay Gateway affects settlements, refunds, and payout reconciliation workflows.',
    'National SMS Provider supports campaign sends, OTP flows, and support notifications.',
    'Identity Verification API is linked to provider onboarding and compliance review outcomes.'
  ]
};

export const mockReviewModerationWorkspace = {
  summary: [
    { label: 'Queued reviews', value: '18', detail: 'Items awaiting moderation, dispute review, or fraud triage' },
    { label: 'High-risk signals', value: '4', detail: 'Reviews with fraud, abuse, or coordination indicators' },
    { label: 'Open disputes', value: '3', detail: 'Provider-submitted challenges needing outcome review' }
  ],
  selectedReview: {
    reviewRef: 'REV-7728',
    providerName: 'Al Borg Diagnostics',
    fraudScore: 'High',
    moderationState: 'Removed',
    disputeOwner: 'Trust and safety',
    evidenceWindow: '48 hours from provider dispute submission',
    riskNote: 'Repeated language patterns and linked account signals suggest coordinated review manipulation.',
    evidence: [
      'Similarity score matched 3 recent removed reviews targeting the same provider cluster.',
      'Device and timing pattern overlaps triggered the fraud-review rule set.',
      'Provider dispute requests reinstatement but does not refute the account-linkage findings.'
    ],
    actions: ['View source evidence', 'Reopen dispute', 'Escalate fraud review'],
    guardrails: [
      'Moderation actions should preserve the original content, actor, and rationale in the audit trail.',
      'Removed reviews with open disputes should keep a clear evidence window and owner.',
      'High-risk fraud outcomes should notify the provider-governance team when pattern thresholds are crossed.'
    ]
  },
  queueSignals: [
    { label: 'High fraud score', count: '4', note: 'Requires same-day trust and safety review' },
    { label: 'Open disputes', count: '3', note: 'Provider response window still active' },
    { label: 'Redaction candidates', count: '5', note: 'Potential PHI or abusive language requiring edited approval' }
  ],
  recentOutcomes: [
    '2 reviews were approved after PHI redaction and dispute closure.',
    '1 coordinated review cluster was removed and routed to provider governance for monitoring.',
    '3 queued reviews remain pending because dispute evidence is still within the response window.'
  ]
};
