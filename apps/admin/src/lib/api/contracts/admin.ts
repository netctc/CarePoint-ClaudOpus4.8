export type KpiCardContract = {
  id: string;
  label: string;
  value: string;
  trend: string;
};

export type OperationsDashboardContract = {
  kpis: KpiCardContract[];
  supportBacklog: number;
  safetyIncidentsOpen: number;
  uptime: string;
};

export type ProviderOnboardingItemContract = {
  id: string;
  providerName: string;
  organizationName: string;
  city: string;
  specialty: string;
  submittedAt: string;
  slaHoursRemaining: number;
  docStatus: 'Complete' | 'Missing items' | 'Needs recheck';
  riskFlag: 'Low' | 'Medium' | 'High';
};

export type ProviderVerificationDetailContract = {
  id: string;
  providerName: string;
  organizationName: string;
  licenseNumber: string;
  cityCoverage: string[];
  mandatoryDocs: { name: string; status: 'Received' | 'Missing' | 'Rejected' }[];
  checks: { label: string; result: 'Pass' | 'Review' | 'Fail' }[];
  riskNotes: string[];
};

export type ProviderMasterItemContract = {
  id: string;
  providerName: string;
  organizationName: string;
  providerType: 'Individual' | 'Institutional' | 'Organization-based';
  accessScopeLabel?: string;
  primaryFacility?: string;
  specialty: string;
  primaryMarket: string;
  operatingStatus: 'Active' | 'Restricted' | 'Pending re-verification' | 'Suspended';
  credentialHealth: 'Healthy' | 'Expiring soon' | 'Action required';
  bookingEligibility: 'Eligible' | 'Limited' | 'Blocked';
  payoutReadiness: 'Ready' | 'Pending' | 'On hold';
  linkedOpenItems: number;
  lastReviewedAt: string;
};

export type ProviderProfileContract = {
  id: string;
  providerName: string;
  organizationName: string;
  providerType: 'Individual' | 'Institutional' | 'Organization-based';
  accessScopeLabel?: string;
  primaryFacility?: string;
  specialty: string;
  primaryMarket: string;
  licenseNumber: string;
  operatingStatus: 'Active' | 'Restricted' | 'Pending re-verification' | 'Suspended';
  bookingEligibility: 'Eligible' | 'Limited' | 'Blocked';
  payoutReadiness: 'Ready' | 'Pending' | 'On hold';
  credentialHealth: 'Healthy' | 'Expiring soon' | 'Action required';
  telehealthEligible: boolean;
  inPersonEligible: boolean;
  lastReviewedAt: string;
  rosterSummary: {
    activeBookings7d: number;
    completionRate: string;
    refundRate: string;
    csat: string;
  };
  credentials: { name: string; status: 'Valid' | 'Expiring soon' | 'Missing' | 'Rejected'; expiry?: string }[];
  linkedQueues: {
    onboardingStatus: 'Approved' | 'Pending update' | 'Rejected';
    supportTicketsOpen: number;
    safetyCasesOpen: number;
    payoutExceptionsOpen: number;
  };
  timeline: { at: string; event: string }[];
  statusChangeGuardrails: string[];
};

export type BookingControlItemContract = {
  id: string;
  bookingRef: string;
  patientName: string;
  providerName: string;
  channel: 'Telehealth' | 'In-Person';
  status: 'Scheduled' | 'Delayed' | 'Escalated' | 'Cancelled';
  incidentTag?: string;
  city: string;
  scheduledAt: string;
  slaState: 'On track' | 'At risk' | 'Breached';
  adminOwner: string;
  downstreamImpact: string;
  nextAction: string;
};

export type ServiceCatalogItemContract = {
  id: string;
  category: string;
  serviceName: string;
  template: string;
  status: 'Active' | 'Draft' | 'Archived';
  downstreamImpact: string;
};

export type CoverageRegionContract = {
  id: string;
  region: string;
  cities: string[];
  weekendCalendar: string;
  telehealthEnabled: boolean;
  inPersonEnabled: boolean;
  status: 'Enabled' | 'Limited' | 'Disabled';
  blockedFacilities?: string[];
  blockedChannels?: string[];
  cityExceptions?: string[];
};

export type TelehealthOpsSessionContract = {
  id: string;
  sessionRef: string;
  providerName: string;
  patientInitials: string;
  region: string;
  state: 'Healthy' | 'Degraded' | 'Failed';
  failureRate: string;
  supportHook: string;
  roomState: 'Waiting room' | 'Live' | 'Reconnect loop' | 'Closed';
  roomType: 'Scheduled consult' | 'Urgent consult' | 'Follow-up';
  issueOwner: string;
  lastHeartbeatAt: string;
  metadataAccess: 'Metadata only' | 'Escalated metadata';
};

export type SettlementBatchContract = {
  id: string;
  batchRef: string;
  gateway: string;
  status: 'Cleared' | 'Pending' | 'Mismatch';
  amount: string;
  aging: string;
};

export type RefundCaseContract = {
  id: string;
  caseRef: string;
  bookingRef: string;
  party: string;
  reasonCode: string;
  evidenceStatus: 'Complete' | 'Needs review' | 'Missing';
  policy: string;
  amount: string;
};

export type PricingRuleContract = {
  id: string;
  ruleName: string;
  market: string;
  commissionModel: string;
  effectiveFrom: string;
  status: 'Draft' | 'Published' | 'Scheduled';
};

export type ModerationReviewContract = {
  id: string;
  reviewRef: string;
  providerName: string;
  fraudScore: 'Low' | 'Medium' | 'High';
  disputeOpen: boolean;
  moderationState: 'Queued' | 'Redacted' | 'Removed' | 'Approved';
};

export type SupportTicketContract = {
  id: string;
  ticketRef: string;
  channel: 'Patient' | 'Provider';
  subject: string;
  piiMasking: 'Masked' | 'Restricted';
  status: 'Open' | 'Escalated' | 'Waiting on reply' | 'Resolved';
  sla: string;
  owner: string;
  priority: 'P1' | 'P2' | 'P3';
  linkedDomain: 'Bookings' | 'Refunds' | 'Telehealth' | 'Provider Ops';
  nextMilestone: string;
};

export type SafetyCaseContract = {
  id: string;
  caseRef: string;
  severity: 'Minor' | 'Major' | 'Critical';
  summary: string;
  status: 'Open' | 'Escalated' | 'Pending approval' | 'Closed';
  timeline: { at: string; event: string }[];
  actions: string[];
  dualApprovalRequired: boolean;
  category: 'Clinical' | 'Operational' | 'Medication';
  investigator: string;
  linkedSource: string;
  nextReviewAt: string;
  approvals: { reviewer: string; decision: 'Pending' | 'Approved' | 'Changes requested'; at?: string }[];
  closureGuardrails: string[];
};

export type PolicyTemplateContract = {
  id: string;
  templateName: string;
  policyArea: string;
  country: string;
  version: string;
  status: 'Draft' | 'Published' | 'Archived';
};


export type AccessGrantContract = {
  id: string;
  userName: string;
  role: string;
  grantScope: string;
  mfaStatus: 'Enabled' | 'Pending' | 'Bypassed';
  accessReview: 'Due' | 'Certified' | 'Expired';
};

export type AuditLogContract = {
  id: string;
  timestamp: string;
  actor: string;
  action: string;
  target: string;
  purpose: string;
  outcome: 'Success' | 'Denied' | 'Escalated';
};

export type ReportDefinitionContract = {
  id: string;
  reportName: string;
  domain: string;
  dataScope: string;
  schedule: string;
  status: 'Draft' | 'Scheduled' | 'Last run complete';
};

export type CampaignContract = {
  id: string;
  campaignName: string;
  segment: string;
  channel: 'Push' | 'SMS' | 'Email' | 'In-App';
  approvalState: 'Approved' | 'Needs legal review' | 'Draft';
  runState: 'Scheduled' | 'Paused' | 'Sent';
};

export type IntegrationSettingContract = {
  id: string;
  integrationName: string;
  category: string;
  status: 'Enabled' | 'Disabled' | 'Pending rotation';
  secretState: 'Masked' | 'Rotated recently' | 'Review required';
  lastChangedAt: string;
};
