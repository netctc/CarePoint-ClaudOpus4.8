import { createHash, createHmac } from 'crypto';
import type {
  HybridPythonCanaryAssignment,
  HybridPythonCanaryAssignmentRequest,
  HybridPythonCanaryRolloutAction,
  HybridPythonCanaryRolloutPlan,
  HybridPythonCanaryRolloutState,
  HybridPythonCanaryGate,
  HybridPythonContractManifest,
  HybridPythonContractTestVector,
  HybridPythonContractValidationReport,
  HybridPythonEvidenceBundle,
  HybridPythonJobAccepted,
  HybridPythonJobCancel,
  HybridPythonJobEnvelope,
  HybridPythonJobRecord,
  HybridPythonReleaseChecklistReport,
  HybridPythonRolloutReadinessReport,
  HybridPythonShadowComparisonInput,
  HybridPythonShadowComparisonSummary,
} from '@care-center/contracts';
import { env } from './env';
import { notFound, serviceUnavailable } from './http';

export type HybridPythonRoutingDecision = {
  enabled: boolean;
  routeToPython: boolean;
  shadowMode: boolean;
  canaryPercent: number;
  bucket: number;
  reason: string;
  source: 'disabled' | 'forced' | 'node-local' | 'python-control-plane' | 'control-plane-fallback' | string;
  route?: string | null;
  assignment?: HybridPythonCanaryAssignment | null;
  controlPlaneError?: string | null;
};

export type HybridPythonRequestContext = {
  requestId?: string;
  actorUserId?: string;
  organizationId?: string;
  subjectKey?: string;
  forcePython?: boolean;
  route?: string;
  jobType?: string;
};

export type HybridPythonJobSummary = {
  total?: number;
  totalJobs: number;
  byStatus: Record<string, number>;
  byJobType: Record<string, number>;
  inFlightJobs?: number;
  failedJobs?: number;
  succeededJobs?: number;
  latestUpdatedAt?: string | null;
};

function stableBucket(value: string) {
  const digest = createHash('sha256').update(value).digest();
  return digest[0] % 100;
}

function stableJobId(idempotencyKey: string) {
  return `job_${createHash('sha256').update(idempotencyKey).digest('hex').slice(0, 24)}`;
}

function decisionKey(input: HybridPythonRequestContext) {
  return input.subjectKey || input.organizationId || input.actorUserId || input.requestId || 'carepoint-default';
}

export function getHybridPythonRoutingDecision(input: HybridPythonRequestContext = {}): HybridPythonRoutingDecision {
  const bucket = stableBucket(decisionKey(input));
  const route = input.route ?? env.hybridPythonDefaultRoute;
  if (!env.hybridPythonEnabled && !input.forcePython) {
    return {
      enabled: false,
      routeToPython: false,
      shadowMode: false,
      canaryPercent: env.hybridPythonCanaryPercent,
      bucket,
      reason: 'feature-disabled',
      source: 'disabled',
      route,
      assignment: null,
      controlPlaneError: null,
    };
  }

  if (input.forcePython) {
    return {
      enabled: true,
      routeToPython: true,
      shadowMode: false,
      canaryPercent: env.hybridPythonCanaryPercent,
      bucket,
      reason: 'forced',
      source: 'forced',
      route,
      assignment: null,
      controlPlaneError: null,
    };
  }

  const routeToPython = bucket < env.hybridPythonCanaryPercent;
  return {
    enabled: true,
    routeToPython,
    shadowMode: env.hybridPythonShadowMode && !routeToPython,
    canaryPercent: env.hybridPythonCanaryPercent,
    bucket,
    reason: routeToPython ? 'canary-selected' : 'canary-not-selected',
    source: 'node-local',
    route,
    assignment: null,
    controlPlaneError: null,
  };
}

function controlPlaneErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

export async function resolveHybridPythonRoutingDecision(input: HybridPythonRequestContext = {}): Promise<HybridPythonRoutingDecision> {
  const local = getHybridPythonRoutingDecision(input);
  if (!local.enabled || input.forcePython || !env.hybridPythonUseControlPlaneAssignment) {
    return local;
  }

  try {
    const assignment = await getHybridPythonCanaryAssignment(
      {
        subjectKey: input.subjectKey ?? decisionKey(input),
        route: input.route ?? env.hybridPythonDefaultRoute,
        organizationId: input.organizationId ?? null,
        actorUserId: input.actorUserId ?? null,
        jobType: (input.jobType as HybridPythonCanaryAssignmentRequest['jobType']) ?? null,
      },
      input.requestId,
    );

    return {
      enabled: true,
      routeToPython: assignment.routeToPython,
      shadowMode: env.hybridPythonShadowMode && assignment.shadowMode,
      canaryPercent: assignment.canaryPercent,
      bucket: assignment.bucket,
      reason: assignment.reason,
      source: 'python-control-plane',
      route: assignment.route,
      assignment,
      controlPlaneError: null,
    };
  } catch (error) {
    const message = controlPlaneErrorMessage(error);
    if (env.hybridPythonControlPlaneFailOpen) {
      return {
        ...local,
        source: 'control-plane-fallback',
        reason: `control-plane-unavailable-fail-open:${local.reason}`,
        controlPlaneError: message,
      };
    }
    return {
      ...local,
      routeToPython: false,
      shadowMode: env.hybridPythonShadowMode,
      source: 'control-plane-fallback',
      reason: 'control-plane-unavailable-fail-closed',
      controlPlaneError: message,
    };
  }
}

function buildPythonSignature(input: {
  secret: string;
  method: string;
  pathWithQuery: string;
  timestamp: string;
  bodyText: string;
}) {
  const bodyHash = createHash('sha256').update(input.bodyText).digest('hex');
  const canonical = [input.method.toUpperCase(), input.pathWithQuery, input.timestamp, bodyHash].join('\n');
  const digest = createHmac('sha256', input.secret).update(canonical).digest('hex');
  return `sha256=${digest}`;
}

async function callPythonService<T>(
  path: string,
  options: { method?: string; body?: unknown; requestId?: string } = {},
): Promise<T> {
  const url = new URL(path, env.pythonServicesBaseUrl);
  const method = options.method ?? 'GET';
  const bodyText = options.body === undefined ? '' : JSON.stringify(options.body);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), env.pythonServicesTimeoutMs);

  try {
    const headers: Record<string, string> = {
      accept: 'application/json',
      'content-type': 'application/json',
    };
    if (options.requestId) headers['x-request-id'] = options.requestId;
    if (env.pythonServicesSharedSecret) {
      const timestamp = Math.floor(Date.now() / 1000).toString();
      const pathWithQuery = `${url.pathname}${url.search}`;
      headers['x-carepoint-python-secret'] = env.pythonServicesSharedSecret;
      headers['x-carepoint-python-timestamp'] = timestamp;
      headers['x-carepoint-python-signature'] = buildPythonSignature({
        secret: env.pythonServicesSharedSecret,
        method,
        pathWithQuery,
        timestamp,
        bodyText,
      });
    }

    const response = await fetch(url, {
      method,
      headers,
      body: options.body === undefined ? undefined : bodyText,
      signal: controller.signal,
    });

    const text = await response.text();
    const data = text ? JSON.parse(text) : null;
    if (!response.ok) {
      if (response.status === 404) throw notFound('Python job not found');
      throw serviceUnavailable('Python service returned a non-success response', { status: response.status, path, data });
    }
    return data as T;
  } catch (error) {
    if (error instanceof Error && 'statusCode' in error) throw error;
    throw serviceUnavailable('Python service unavailable', {
      path,
      message: error instanceof Error ? error.message : String(error),
    });
  } finally {
    clearTimeout(timeout);
  }
}

async function recordShadowJob(job: HybridPythonJobEnvelope, context: HybridPythonRequestContext) {
  try {
    await callPythonService('/api/v1/shadow/jobs/record', {
      method: 'POST',
      requestId: context.requestId,
      body: {
        route: '/api/hybrid-python/jobs',
        method: 'POST',
        correlationId: job.correlationId,
        organizationId: job.organizationId,
        actorUserId: job.actorUserId,
        payloadShape: {
          jobType: job.jobType,
          payloadKeys: Object.keys(job.payload ?? {}).sort(),
        },
      },
    });
    return null;
  } catch (error) {
    if (!env.hybridPythonShadowFailOpen) throw error;
    return error instanceof Error ? error.message : String(error);
  }
}

export async function getHybridPythonServiceStatus(requestId?: string) {
  const [live, ready, manifest, summary, metrics, shadow, comparisons, canaryGate, contracts, rolloutReadiness, rolloutState] = await Promise.allSettled([
    callPythonService('/livez', { requestId }),
    callPythonService('/readyz', { requestId }),
    callPythonService('/api/v1/manifest', { requestId }),
    callPythonService<HybridPythonJobSummary>('/api/v1/jobs/summary', { requestId }),
    callPythonService('/api/v1/jobs/metrics', { requestId }),
    callPythonService('/api/v1/shadow/jobs', { requestId }),
    callPythonService('/api/v1/shadow/comparisons', { requestId }),
    callPythonService('/api/v1/canary/gate?minComparisons=0', { requestId }),
    callPythonService('/api/v1/contracts/manifest', { requestId }),
    callPythonService('/api/v1/rollout/readiness?minComparisons=0', { requestId }),
    callPythonService('/api/v1/canary/rollout', { requestId }),
  ]);

  return {
    enabled: env.hybridPythonEnabled,
    shadowMode: env.hybridPythonShadowMode,
    canaryPercent: env.hybridPythonCanaryPercent,
    shadowFailOpen: env.hybridPythonShadowFailOpen,
    useControlPlaneAssignment: env.hybridPythonUseControlPlaneAssignment,
    controlPlaneFailOpen: env.hybridPythonControlPlaneFailOpen,
    defaultRoute: env.hybridPythonDefaultRoute,
    baseUrl: env.pythonServicesBaseUrl,
    signedRequests: Boolean(env.pythonServicesSharedSecret),
    live: live.status === 'fulfilled' ? live.value : { ok: false, error: live.reason?.message ?? 'unknown' },
    ready: ready.status === 'fulfilled' ? ready.value : { ok: false, error: ready.reason?.message ?? 'unknown' },
    manifest: manifest.status === 'fulfilled' ? manifest.value : { ok: false, error: manifest.reason?.message ?? 'unknown' },
    summary: summary.status === 'fulfilled' ? summary.value : { ok: false, error: summary.reason?.message ?? 'unknown' },
    metrics: metrics.status === 'fulfilled' ? metrics.value : { ok: false, error: metrics.reason?.message ?? 'unknown' },
    shadow: shadow.status === 'fulfilled' ? shadow.value : { ok: false, error: shadow.reason?.message ?? 'unknown' },
    comparisons: comparisons.status === 'fulfilled' ? comparisons.value : { ok: false, error: comparisons.reason?.message ?? 'unknown' },
    canaryGate: canaryGate.status === 'fulfilled' ? canaryGate.value : { ok: false, error: canaryGate.reason?.message ?? 'unknown' },
    contracts: contracts.status === 'fulfilled' ? contracts.value : { ok: false, error: contracts.reason?.message ?? 'unknown' },
    rolloutReadiness: rolloutReadiness.status === 'fulfilled' ? rolloutReadiness.value : { ok: false, error: rolloutReadiness.reason?.message ?? 'unknown' },
    rolloutState: rolloutState.status === 'fulfilled' ? rolloutState.value : { ok: false, error: rolloutState.reason?.message ?? 'unknown' },
  };
}

export async function getHybridPythonJobStatus(idempotencyKeyOrJobId: string, requestId?: string): Promise<HybridPythonJobRecord> {
  const encoded = encodeURIComponent(idempotencyKeyOrJobId);
  return callPythonService<HybridPythonJobRecord>(`/api/v1/jobs/status/${encoded}`, { requestId });
}

export async function getHybridPythonJobSummary(requestId?: string): Promise<HybridPythonJobSummary> {
  return callPythonService<HybridPythonJobSummary>('/api/v1/jobs/summary', { requestId });
}

export async function getHybridPythonJobMetrics(requestId?: string): Promise<Record<string, unknown>> {
  return callPythonService<Record<string, unknown>>('/api/v1/jobs/metrics', { requestId });
}

export async function getHybridPythonShadowRecords(options: { limit?: number; requestId?: string } = {}): Promise<Record<string, unknown>> {
  const params = new URLSearchParams();
  if (options.limit) params.set('limit', String(options.limit));
  const suffix = params.toString() ? `?${params.toString()}` : '';
  return callPythonService<Record<string, unknown>>(`/api/v1/shadow/jobs${suffix}`, { requestId: options.requestId });
}

export async function listHybridPythonJobs(
  options: { limit?: number; status?: string; requestId?: string } = {},
): Promise<HybridPythonJobRecord[]> {
  const params = new URLSearchParams();
  if (options.limit) params.set('limit', String(options.limit));
  if (options.status) params.set('status', options.status);
  const suffix = params.toString() ? `?${params.toString()}` : '';
  return callPythonService<HybridPythonJobRecord[]>(`/api/v1/jobs${suffix}`, { requestId: options.requestId });
}

export async function cancelHybridPythonJob(
  idempotencyKeyOrJobId: string,
  payload: HybridPythonJobCancel,
  requestId?: string,
): Promise<HybridPythonJobRecord> {
  const encoded = encodeURIComponent(idempotencyKeyOrJobId);
  return callPythonService<HybridPythonJobRecord>(`/api/v1/jobs/${encoded}/cancel`, {
    method: 'POST',
    requestId,
    body: payload,
  });
}

export async function enqueueHybridPythonJob(
  job: HybridPythonJobEnvelope,
  context: HybridPythonRequestContext = {},
): Promise<HybridPythonJobAccepted & { decision: HybridPythonRoutingDecision; shadowError?: string | null }> {
  const hydratedJob: HybridPythonJobEnvelope = {
    ...job,
    correlationId: job.correlationId ?? context.requestId,
    organizationId: job.organizationId ?? context.organizationId,
    actorUserId: job.actorUserId ?? context.actorUserId,
  };
  const decision = await resolveHybridPythonRoutingDecision({
    ...context,
    subjectKey: job.idempotencyKey,
    jobType: job.jobType,
    route: context.route ?? env.hybridPythonDefaultRoute,
  });
  let shadowError: string | null = null;

  if (!decision.routeToPython && decision.shadowMode) {
    shadowError = await recordShadowJob(hydratedJob, context);
  }

  if (!decision.routeToPython) {
    return {
      accepted: false,
      jobId: stableJobId(hydratedJob.idempotencyKey),
      jobType: hydratedJob.jobType,
      idempotencyKey: hydratedJob.idempotencyKey,
      correlationId: hydratedJob.correlationId ?? null,
      routedTo: 'node-api-retained',
      queued: false,
      taskId: null,
      dryRun: hydratedJob.dryRun,
      status: 'accepted',
      duplicate: false,
      result: null,
      decision,
      shadowError,
    };
  }

  const accepted = await callPythonService<HybridPythonJobAccepted>('/api/v1/jobs/enqueue', {
    method: 'POST',
    requestId: context.requestId,
    body: hydratedJob,
  });

  return { ...accepted, decision, shadowError };
}


export async function recordHybridPythonShadowComparison(
  input: HybridPythonShadowComparisonInput,
  requestId?: string,
): Promise<{ accepted: boolean; record: unknown; summary: HybridPythonShadowComparisonSummary }> {
  return callPythonService<{ accepted: boolean; record: unknown; summary: HybridPythonShadowComparisonSummary }>('/api/v1/shadow/comparisons/record', {
    method: 'POST',
    requestId,
    body: input,
  });
}

export async function getHybridPythonShadowComparisons(
  options: { limit?: number; outcome?: string; requestId?: string } = {},
): Promise<HybridPythonShadowComparisonSummary> {
  const params = new URLSearchParams();
  if (options.limit) params.set('limit', String(options.limit));
  if (options.outcome) params.set('outcome', options.outcome);
  const suffix = params.toString() ? `?${params.toString()}` : '';
  return callPythonService<HybridPythonShadowComparisonSummary>(`/api/v1/shadow/comparisons${suffix}`, {
    requestId: options.requestId,
  });
}

export async function getHybridPythonCanaryGate(
  options: { maxMismatchRate?: number; maxFailedJobs?: number; minComparisons?: number; requestId?: string } = {},
): Promise<HybridPythonCanaryGate> {
  const params = new URLSearchParams();
  if (options.maxMismatchRate !== undefined) params.set('maxMismatchRate', String(options.maxMismatchRate));
  if (options.maxFailedJobs !== undefined) params.set('maxFailedJobs', String(options.maxFailedJobs));
  if (options.minComparisons !== undefined) params.set('minComparisons', String(options.minComparisons));
  const suffix = params.toString() ? `?${params.toString()}` : '';
  return callPythonService<HybridPythonCanaryGate>(`/api/v1/canary/gate${suffix}`, { requestId: options.requestId });
}

export async function getHybridPythonCanaryRollout(
  options: { route?: string; requestId?: string } = {},
): Promise<HybridPythonCanaryRolloutState> {
  const params = new URLSearchParams();
  if (options.route) params.set('route', options.route);
  const suffix = params.toString() ? `?${params.toString()}` : '';
  return callPythonService<HybridPythonCanaryRolloutState>(`/api/v1/canary/rollout${suffix}`, { requestId: options.requestId });
}

export async function planHybridPythonCanaryRollout(
  payload: HybridPythonCanaryRolloutPlan,
  requestId?: string,
): Promise<HybridPythonCanaryRolloutState> {
  return callPythonService<HybridPythonCanaryRolloutState>('/api/v1/canary/rollout/plan', {
    method: 'POST',
    requestId,
    body: payload,
  });
}

export async function advanceHybridPythonCanaryRollout(
  payload: HybridPythonCanaryRolloutAction,
  requestId?: string,
): Promise<HybridPythonCanaryRolloutState> {
  return callPythonService<HybridPythonCanaryRolloutState>('/api/v1/canary/rollout/advance', {
    method: 'POST',
    requestId,
    body: payload,
  });
}

export async function pauseHybridPythonCanaryRollout(
  payload: HybridPythonCanaryRolloutAction,
  requestId?: string,
): Promise<HybridPythonCanaryRolloutState> {
  return callPythonService<HybridPythonCanaryRolloutState>('/api/v1/canary/rollout/pause', {
    method: 'POST',
    requestId,
    body: payload,
  });
}

export async function resumeHybridPythonCanaryRollout(
  payload: HybridPythonCanaryRolloutAction,
  requestId?: string,
): Promise<HybridPythonCanaryRolloutState> {
  return callPythonService<HybridPythonCanaryRolloutState>('/api/v1/canary/rollout/resume', {
    method: 'POST',
    requestId,
    body: payload,
  });
}

export async function rollbackHybridPythonCanaryRollout(
  payload: HybridPythonCanaryRolloutAction,
  requestId?: string,
): Promise<HybridPythonCanaryRolloutState> {
  return callPythonService<HybridPythonCanaryRolloutState>('/api/v1/canary/rollout/rollback', {
    method: 'POST',
    requestId,
    body: payload,
  });
}

export async function getHybridPythonCanaryAssignment(
  payload: HybridPythonCanaryAssignmentRequest,
  requestId?: string,
): Promise<HybridPythonCanaryAssignment> {
  return callPythonService<HybridPythonCanaryAssignment>('/api/v1/canary/assignment', {
    method: 'POST',
    requestId,
    body: payload,
  });
}

export async function runHybridPythonArtifactGc(
  options: { dryRun?: boolean; requestId?: string } = {},
): Promise<Record<string, unknown>> {
  const params = new URLSearchParams();
  params.set('dryRun', String(options.dryRun ?? true));
  return callPythonService<Record<string, unknown>>(`/api/v1/artifacts/gc?${params.toString()}`, {
    method: 'POST',
    requestId: options.requestId,
  });
}


export async function getHybridPythonContractManifest(requestId?: string): Promise<HybridPythonContractManifest> {
  return callPythonService<HybridPythonContractManifest>('/api/v1/contracts/manifest', { requestId });
}

export async function getHybridPythonContractTestVectors(requestId?: string): Promise<HybridPythonContractTestVector[]> {
  return callPythonService<HybridPythonContractTestVector[]>('/api/v1/contracts/test-vectors', { requestId });
}

export async function validateHybridPythonContract(
  job: HybridPythonJobEnvelope,
  requestId?: string,
): Promise<HybridPythonContractValidationReport> {
  return callPythonService<HybridPythonContractValidationReport>('/api/v1/contracts/validate', {
    method: 'POST',
    requestId,
    body: job,
  });
}

export async function replayHybridPythonContracts(
  job: HybridPythonJobEnvelope,
  requestId?: string,
): Promise<HybridPythonJobAccepted> {
  return callPythonService<HybridPythonJobAccepted>('/api/v1/jobs/enqueue', {
    method: 'POST',
    requestId,
    body: job,
  });
}

export async function runHybridPythonPrivacyPreflight(
  job: HybridPythonJobEnvelope,
  requestId?: string,
): Promise<HybridPythonJobAccepted> {
  return callPythonService<HybridPythonJobAccepted>('/api/v1/jobs/enqueue', {
    method: 'POST',
    requestId,
    body: job,
  });
}


export async function runHybridPythonReleaseDecision(
  job: HybridPythonJobEnvelope,
  requestId?: string,
): Promise<HybridPythonJobAccepted> {
  return callPythonService<HybridPythonJobAccepted>('/api/v1/jobs/enqueue', {
    method: 'POST',
    requestId,
    body: job,
  });
}

export async function runHybridPythonRollbackDrill(
  job: HybridPythonJobEnvelope,
  requestId?: string,
): Promise<HybridPythonJobAccepted> {
  return callPythonService<HybridPythonJobAccepted>('/api/v1/jobs/enqueue', {
    method: 'POST',
    requestId,
    body: job,
  });
}


export async function runHybridPythonPostDeployVerify(
  job: HybridPythonJobEnvelope,
  requestId?: string,
): Promise<HybridPythonJobAccepted> {
  return callPythonService<HybridPythonJobAccepted>('/api/v1/jobs/enqueue', {
    method: 'POST',
    requestId,
    body: job,
  });
}

export async function runHybridPythonChangeTicketBundle(
  job: HybridPythonJobEnvelope,
  requestId?: string,
): Promise<HybridPythonJobAccepted> {
  return callPythonService<HybridPythonJobAccepted>('/api/v1/jobs/enqueue', {
    method: 'POST',
    requestId,
    body: job,
  });
}

export async function runHybridPythonOperationalHandoff(
  job: HybridPythonJobEnvelope,
  requestId?: string,
): Promise<HybridPythonJobAccepted> {
  return callPythonService<HybridPythonJobAccepted>('/api/v1/jobs/enqueue', {
    method: 'POST',
    requestId,
    body: job,
  });
}

export async function runHybridPythonIncidentSimulation(
  job: HybridPythonJobEnvelope,
  requestId?: string,
): Promise<HybridPythonJobAccepted> {
  return callPythonService<HybridPythonJobAccepted>('/api/v1/jobs/enqueue', {
    method: 'POST',
    requestId,
    body: job,
  });
}

export async function runHybridPythonCapacityPlan(
  job: HybridPythonJobEnvelope,
  requestId?: string,
): Promise<HybridPythonJobAccepted> {
  return callPythonService<HybridPythonJobAccepted>('/api/v1/jobs/enqueue', {
    method: 'POST',
    requestId,
    body: job,
  });
}

export async function runHybridPythonAlertPolicyReview(
  job: HybridPythonJobEnvelope,
  requestId?: string,
): Promise<HybridPythonJobAccepted> {
  return callPythonService<HybridPythonJobAccepted>('/api/v1/jobs/enqueue', {
    method: 'POST',
    requestId,
    body: job,
  });
}

export async function runHybridPythonDependencyReadiness(
  job: HybridPythonJobEnvelope,
  requestId?: string,
): Promise<HybridPythonJobAccepted> {
  return callPythonService<HybridPythonJobAccepted>('/api/v1/jobs/enqueue', {
    method: 'POST',
    requestId,
    body: job,
  });
}

export async function runHybridPythonProductionReadiness(
  job: HybridPythonJobEnvelope,
  requestId?: string,
): Promise<HybridPythonJobAccepted> {
  return callPythonService<HybridPythonJobAccepted>('/api/v1/jobs/enqueue', {
    method: 'POST',
    requestId,
    body: job,
  });
}

export async function runHybridPythonDataRetentionReview(
  job: HybridPythonJobEnvelope,
  requestId?: string,
): Promise<HybridPythonJobAccepted> {
  return callPythonService<HybridPythonJobAccepted>('/api/v1/jobs/enqueue', {
    method: 'POST',
    requestId,
    body: job,
  });
}

export async function runHybridPythonAuditTrailReview(
  job: HybridPythonJobEnvelope,
  requestId?: string,
): Promise<HybridPythonJobAccepted> {
  return callPythonService<HybridPythonJobAccepted>('/api/v1/jobs/enqueue', {
    method: 'POST',
    requestId,
    body: job,
  });
}


export async function runHybridPythonSecurityPostureReview(
  job: HybridPythonJobEnvelope,
  requestId?: string,
): Promise<HybridPythonJobAccepted> {
  return callPythonService<HybridPythonJobAccepted>('/api/v1/jobs/enqueue', {
    method: 'POST',
    requestId,
    body: job,
  });
}

export async function runHybridPythonSupplyChainReview(
  job: HybridPythonJobEnvelope,
  requestId?: string,
): Promise<HybridPythonJobAccepted> {
  return callPythonService<HybridPythonJobAccepted>('/api/v1/jobs/enqueue', {
    method: 'POST',
    requestId,
    body: job,
  });
}

export async function runHybridPythonSchemaMigrationRehearsal(
  job: HybridPythonJobEnvelope,
  requestId?: string,
): Promise<HybridPythonJobAccepted> {
  return callPythonService<HybridPythonJobAccepted>('/api/v1/jobs/enqueue', {
    method: 'POST',
    requestId,
    body: job,
  });
}

export async function runHybridPythonBackupRestoreDrill(
  job: HybridPythonJobEnvelope,
  requestId?: string,
): Promise<HybridPythonJobAccepted> {
  return callPythonService<HybridPythonJobAccepted>('/api/v1/jobs/enqueue', {
    method: 'POST',
    requestId,
    body: job,
  });
}


export async function runHybridPythonObservabilityCoverageReview(
  job: HybridPythonJobEnvelope,
  requestId?: string,
): Promise<HybridPythonJobAccepted> {
  return callPythonService<HybridPythonJobAccepted>('/api/v1/jobs/enqueue', {
    method: 'POST',
    requestId,
    body: job,
  });
}

export async function runHybridPythonFeatureFlagReview(
  job: HybridPythonJobEnvelope,
  requestId?: string,
): Promise<HybridPythonJobAccepted> {
  return callPythonService<HybridPythonJobAccepted>('/api/v1/jobs/enqueue', {
    method: 'POST',
    requestId,
    body: job,
  });
}


export async function runHybridPythonDomainMigrationReadiness(
  job: HybridPythonJobEnvelope,
  requestId?: string,
): Promise<HybridPythonJobAccepted> {
  return callPythonService<HybridPythonJobAccepted>('/api/v1/jobs/enqueue', {
    method: 'POST',
    requestId,
    body: job,
  });
}

export async function runHybridPythonCutoverPlan(
  job: HybridPythonJobEnvelope,
  requestId?: string,
): Promise<HybridPythonJobAccepted> {
  return callPythonService<HybridPythonJobAccepted>('/api/v1/jobs/enqueue', {
    method: 'POST',
    requestId,
    body: job,
  });
}


export async function runHybridPythonOwnerRegistryReview(
  job: HybridPythonJobEnvelope,
  requestId?: string,
): Promise<HybridPythonJobAccepted> {
  return callPythonService<HybridPythonJobAccepted>('/api/v1/jobs/enqueue', {
    method: 'POST',
    requestId,
    body: job,
  });
}

export async function runHybridPythonPostCutoverMonitor(
  job: HybridPythonJobEnvelope,
  requestId?: string,
): Promise<HybridPythonJobAccepted> {
  return callPythonService<HybridPythonJobAccepted>('/api/v1/jobs/enqueue', {
    method: 'POST',
    requestId,
    body: job,
  });
}


export async function runHybridPythonLegacyPathDecommission(
  job: HybridPythonJobEnvelope,
  requestId?: string,
): Promise<HybridPythonJobAccepted> {
  return callPythonService<HybridPythonJobAccepted>('/api/v1/jobs/enqueue', {
    method: 'POST',
    requestId,
    body: job,
  });
}

export async function runHybridPythonSteadyStateOpsReview(
  job: HybridPythonJobEnvelope,
  requestId?: string,
): Promise<HybridPythonJobAccepted> {
  return callPythonService<HybridPythonJobAccepted>('/api/v1/jobs/enqueue', {
    method: 'POST',
    requestId,
    body: job,
  });
}


export async function runHybridPythonQueueResilienceReview(
  job: HybridPythonJobEnvelope,
  requestId?: string,
): Promise<HybridPythonJobAccepted> {
  return callPythonService<HybridPythonJobAccepted>('/api/v1/jobs/enqueue', {
    method: 'POST',
    requestId,
    body: job,
  });
}

export async function runHybridPythonArtifactIntegrityReview(
  job: HybridPythonJobEnvelope,
  requestId?: string,
): Promise<HybridPythonJobAccepted> {
  return callPythonService<HybridPythonJobAccepted>('/api/v1/jobs/enqueue', {
    method: 'POST',
    requestId,
    body: job,
  });
}

export async function runHybridPythonRunbookFreshnessReview(
  job: HybridPythonJobEnvelope,
  requestId?: string,
): Promise<HybridPythonJobAccepted> {
  return callPythonService<HybridPythonJobAccepted>('/api/v1/jobs/enqueue', { method: 'POST', requestId, body: job });
}

export async function runHybridPythonSupportEscalationReview(
  job: HybridPythonJobEnvelope,
  requestId?: string,
): Promise<HybridPythonJobAccepted> {
  return callPythonService<HybridPythonJobAccepted>('/api/v1/jobs/enqueue', { method: 'POST', requestId, body: job });
}

export async function runHybridPythonCostGuardrailReview(job: HybridPythonJobEnvelope, requestId?: string): Promise<HybridPythonJobAccepted> { return callPythonService<HybridPythonJobAccepted>('/api/v1/jobs/enqueue', { method: 'POST', requestId, body: job }); }
export async function runHybridPythonEnvironmentParityReview(job: HybridPythonJobEnvelope, requestId?: string): Promise<HybridPythonJobAccepted> { return callPythonService<HybridPythonJobAccepted>('/api/v1/jobs/enqueue', { method: 'POST', requestId, body: job }); }
export async function runHybridPythonAccessControlReview(job: HybridPythonJobEnvelope, requestId?: string): Promise<HybridPythonJobAccepted> { return callPythonService<HybridPythonJobAccepted>('/api/v1/jobs/enqueue', { method: 'POST', requestId, body: job }); }
export async function runHybridPythonDataQualityReview(job: HybridPythonJobEnvelope, requestId?: string): Promise<HybridPythonJobAccepted> { return callPythonService<HybridPythonJobAccepted>('/api/v1/jobs/enqueue', { method: 'POST', requestId, body: job }); }
export async function runHybridPythonCiStagingValidationReview(job: HybridPythonJobEnvelope, requestId?: string): Promise<HybridPythonJobAccepted> { return callPythonService<HybridPythonJobAccepted>('/api/v1/jobs/enqueue', { method: 'POST', requestId, body: job }); }
export async function runHybridPythonReleaseClosureReview(job: HybridPythonJobEnvelope, requestId?: string): Promise<HybridPythonJobAccepted> { return callPythonService<HybridPythonJobAccepted>('/api/v1/jobs/enqueue', { method: 'POST', requestId, body: job }); }
export async function runHybridPythonProductionCanaryObservationReview(job: HybridPythonJobEnvelope, requestId?: string): Promise<HybridPythonJobAccepted> { return callPythonService<HybridPythonJobAccepted>('/api/v1/jobs/enqueue', { method: 'POST', requestId, body: job }); }
export async function runHybridPythonIncidentResponseReadinessReview(job: HybridPythonJobEnvelope, requestId?: string): Promise<HybridPythonJobAccepted> { return callPythonService<HybridPythonJobAccepted>('/api/v1/jobs/enqueue', { method: 'POST', requestId, body: job }); }
export async function runHybridPythonTrafficPromotionReadinessReview(job: HybridPythonJobEnvelope, requestId?: string): Promise<HybridPythonJobAccepted> { return callPythonService<HybridPythonJobAccepted>('/api/v1/jobs/enqueue', { method: 'POST', requestId, body: job }); }
export async function runHybridPythonEvidenceRetentionAuditReview(job: HybridPythonJobEnvelope, requestId?: string): Promise<HybridPythonJobAccepted> { return callPythonService<HybridPythonJobAccepted>('/api/v1/jobs/enqueue', { method: 'POST', requestId, body: job }); }
export async function runHybridPythonSloErrorBudgetReview(job: HybridPythonJobEnvelope, requestId?: string): Promise<HybridPythonJobAccepted> { return callPythonService<HybridPythonJobAccepted>('/api/v1/jobs/enqueue', { method: 'POST', requestId, body: job }); }
export async function runHybridPythonAutoRollbackSafeguardReview(job: HybridPythonJobEnvelope, requestId?: string): Promise<HybridPythonJobAccepted> { return callPythonService<HybridPythonJobAccepted>('/api/v1/jobs/enqueue', { method: 'POST', requestId, body: job }); }
export async function runHybridPythonThirdPartyDependencyReview(job: HybridPythonJobEnvelope, requestId?: string): Promise<HybridPythonJobAccepted> { return callPythonService<HybridPythonJobAccepted>('/api/v1/jobs/enqueue', { method: 'POST', requestId, body: job }); }
export async function runHybridPythonCapacityScalingReadinessReview(job: HybridPythonJobEnvelope, requestId?: string): Promise<HybridPythonJobAccepted> { return callPythonService<HybridPythonJobAccepted>('/api/v1/jobs/enqueue', { method: 'POST', requestId, body: job }); }
export async function runHybridPythonCompliancePrivacyEvidenceReview(job: HybridPythonJobEnvelope, requestId?: string): Promise<HybridPythonJobAccepted> { return callPythonService<HybridPythonJobAccepted>('/api/v1/jobs/enqueue', { method: 'POST', requestId, body: job }); }
export async function runHybridPythonDisasterRecoveryBackupReview(job: HybridPythonJobEnvelope, requestId?: string): Promise<HybridPythonJobAccepted> { return callPythonService<HybridPythonJobAccepted>('/api/v1/jobs/enqueue', { method: 'POST', requestId, body: job }); }
export async function runHybridPythonChangeMigrationReadinessReview(job: HybridPythonJobEnvelope, requestId?: string): Promise<HybridPythonJobAccepted> { return callPythonService<HybridPythonJobAccepted>('/api/v1/jobs/enqueue', { method: 'POST', requestId, body: job }); }
export async function runHybridPythonConfigurationSecretRotationReview(job: HybridPythonJobEnvelope, requestId?: string): Promise<HybridPythonJobAccepted> { return callPythonService<HybridPythonJobAccepted>('/api/v1/jobs/enqueue', { method: 'POST', requestId, body: job }); }
export async function runHybridPythonMaintenanceWindowReadinessReview(job: HybridPythonJobEnvelope, requestId?: string): Promise<HybridPythonJobAccepted> { return callPythonService<HybridPythonJobAccepted>('/api/v1/jobs/enqueue', { method: 'POST', requestId, body: job }); }
export async function runHybridPythonAuditForensicsReadinessReview(job: HybridPythonJobEnvelope, requestId?: string): Promise<HybridPythonJobAccepted> { return callPythonService<HybridPythonJobAccepted>('/api/v1/jobs/enqueue', { method: 'POST', requestId, body: job }); }
export async function runHybridPythonBusinessContinuityReadinessReview(job: HybridPythonJobEnvelope, requestId?: string): Promise<HybridPythonJobAccepted> { return callPythonService<HybridPythonJobAccepted>('/api/v1/jobs/enqueue', { method: 'POST', requestId, body: job }); }
export async function runHybridPythonRunbookDrillVerificationReview(job: HybridPythonJobEnvelope, requestId?: string): Promise<HybridPythonJobAccepted> { return callPythonService<HybridPythonJobAccepted>('/api/v1/jobs/enqueue', { method: 'POST', requestId, body: job }); }
export async function runHybridPythonPostIncidentLearningReview(job: HybridPythonJobEnvelope, requestId?: string): Promise<HybridPythonJobAccepted> { return callPythonService<HybridPythonJobAccepted>('/api/v1/jobs/enqueue', { method: 'POST', requestId, body: job }); }
export async function runHybridPythonTechDebtGovernanceReview(job: HybridPythonJobEnvelope, requestId?: string): Promise<HybridPythonJobAccepted> { return callPythonService<HybridPythonJobAccepted>('/api/v1/jobs/enqueue', { method: 'POST', requestId, body: job }); }
export async function runHybridPythonVendorResilienceReview(job: HybridPythonJobEnvelope, requestId?: string): Promise<HybridPythonJobAccepted> { return callPythonService<HybridPythonJobAccepted>('/api/v1/jobs/enqueue', { method: 'POST', requestId, body: job }); }
export async function runHybridPythonKnowledgeTransferReadinessReview(job: HybridPythonJobEnvelope, requestId?: string): Promise<HybridPythonJobAccepted> { return callPythonService<HybridPythonJobAccepted>('/api/v1/jobs/enqueue', { method: 'POST', requestId, body: job }); }

export async function getHybridPythonRolloutReadiness(
  options: {
    currentCanaryPercent?: number;
    targetCanaryPercent?: number;
    jobType?: string;
    maxMismatchRate?: number;
    maxFailedJobs?: number;
    minComparisons?: number;
    requestId?: string;
  } = {},
): Promise<HybridPythonRolloutReadinessReport> {
  const params = new URLSearchParams();
  if (options.currentCanaryPercent !== undefined) params.set('currentCanaryPercent', String(options.currentCanaryPercent));
  if (options.targetCanaryPercent !== undefined) params.set('targetCanaryPercent', String(options.targetCanaryPercent));
  if (options.jobType) params.set('jobType', options.jobType);
  if (options.maxMismatchRate !== undefined) params.set('maxMismatchRate', String(options.maxMismatchRate));
  if (options.maxFailedJobs !== undefined) params.set('maxFailedJobs', String(options.maxFailedJobs));
  if (options.minComparisons !== undefined) params.set('minComparisons', String(options.minComparisons));
  const suffix = params.toString() ? `?${params.toString()}` : '';
  return callPythonService<HybridPythonRolloutReadinessReport>(`/api/v1/rollout/readiness${suffix}`, { requestId: options.requestId });
}


export async function getHybridPythonReleaseChecklist(requestId?: string): Promise<HybridPythonReleaseChecklistReport> {
  return callPythonService<HybridPythonReleaseChecklistReport>('/api/v1/release/checklist', { requestId });
}

export async function getHybridPythonEvidenceBundle(requestId?: string): Promise<HybridPythonEvidenceBundle> {
  return callPythonService<HybridPythonEvidenceBundle>('/api/v1/evidence/bundle', { requestId });
}

export async function runHybridPythonArchitectureOwnershipReview(job: HybridPythonJobEnvelope, requestId?: string): Promise<HybridPythonJobAccepted> { return callPythonService<HybridPythonJobAccepted>('/api/v1/jobs/enqueue', { method: 'POST', requestId, body: job }); }
export async function runHybridPythonExecutiveMetricsGovernanceReview(job: HybridPythonJobEnvelope, requestId?: string): Promise<HybridPythonJobAccepted> { return callPythonService<HybridPythonJobAccepted>('/api/v1/jobs/enqueue', { method: 'POST', requestId, body: job }); }
export async function runHybridPythonDomainAdoptionReadinessReview(job: HybridPythonJobEnvelope, requestId?: string): Promise<HybridPythonJobAccepted> { return callPythonService<HybridPythonJobAccepted>('/api/v1/jobs/enqueue', { method: 'POST', requestId, body: job }); }
export async function runHybridPythonPhaseTwoRolloutGovernanceReview(job: HybridPythonJobEnvelope, requestId?: string): Promise<HybridPythonJobAccepted> { return callPythonService<HybridPythonJobAccepted>('/api/v1/jobs/enqueue', { method: 'POST', requestId, body: job }); }
export async function runHybridPythonDomainPilotExecutionReview(job: HybridPythonJobEnvelope, requestId?: string): Promise<HybridPythonJobAccepted> { return callPythonService<HybridPythonJobAccepted>('/api/v1/jobs/enqueue', { method: 'POST', requestId, body: job }); }
export async function runHybridPythonPhaseTwoExpansionControlReview(job: HybridPythonJobEnvelope, requestId?: string): Promise<HybridPythonJobAccepted> { return callPythonService<HybridPythonJobAccepted>('/api/v1/jobs/enqueue', { method: 'POST', requestId, body: job }); }
export async function runHybridPythonDomainOutcomeMeasurementReview(job: HybridPythonJobEnvelope, requestId?: string): Promise<HybridPythonJobAccepted> { return callPythonService<HybridPythonJobAccepted>('/api/v1/jobs/enqueue', { method: 'POST', requestId, body: job }); }
export async function runHybridPythonPhaseTwoFeedbackAdoptionReview(job: HybridPythonJobEnvelope, requestId?: string): Promise<HybridPythonJobAccepted> { return callPythonService<HybridPythonJobAccepted>('/api/v1/jobs/enqueue', { method: 'POST', requestId, body: job }); }
export async function runHybridPythonDomainGraduationReadinessReview(job: HybridPythonJobEnvelope, requestId?: string): Promise<HybridPythonJobAccepted> { return callPythonService<HybridPythonJobAccepted>('/api/v1/jobs/enqueue', { method: 'POST', requestId, body: job }); }
export async function runHybridPythonPhaseTwoLearningConsolidationReview(job: HybridPythonJobEnvelope, requestId?: string): Promise<HybridPythonJobAccepted> { return callPythonService<HybridPythonJobAccepted>('/api/v1/jobs/enqueue', { method: 'POST', requestId, body: job }); }
export async function runHybridPythonDomainWideAdoptionReadinessReview(job: HybridPythonJobEnvelope, requestId?: string): Promise<HybridPythonJobAccepted> { return callPythonService<HybridPythonJobAccepted>('/api/v1/jobs/enqueue', { method: 'POST', requestId, body: job }); }
export async function runHybridPythonPhaseTwoSupportTransitionReview(job: HybridPythonJobEnvelope, requestId?: string): Promise<HybridPythonJobAccepted> { return callPythonService<HybridPythonJobAccepted>('/api/v1/jobs/enqueue', { method: 'POST', requestId, body: job }); }
export async function runHybridPythonDomainAdoptionStabilizationReview(job: HybridPythonJobEnvelope, requestId?: string): Promise<HybridPythonJobAccepted> { return callPythonService<HybridPythonJobAccepted>('/api/v1/jobs/enqueue', { method: 'POST', requestId, body: job }); }
export async function runHybridPythonPhaseTwoValueRealizationReview(job: HybridPythonJobEnvelope, requestId?: string): Promise<HybridPythonJobAccepted> { return callPythonService<HybridPythonJobAccepted>('/api/v1/jobs/enqueue', { method: 'POST', requestId, body: job }); }

export async function runHybridPythonPhaseTwoClosureAcceptanceReview(job: HybridPythonJobEnvelope, requestId?: string): Promise<HybridPythonJobAccepted> { return callPythonService<HybridPythonJobAccepted>('/api/v1/jobs/enqueue', { method: 'POST', requestId, body: job }); }
export async function runHybridPythonPhaseThreeTransitionReadinessReview(job: HybridPythonJobEnvelope, requestId?: string): Promise<HybridPythonJobAccepted> { return callPythonService<HybridPythonJobAccepted>('/api/v1/jobs/enqueue', { method: 'POST', requestId, body: job }); }
export async function runHybridPythonPhaseThreeDomainWaveReadinessReview(job: HybridPythonJobEnvelope, requestId?: string): Promise<HybridPythonJobAccepted> { return callPythonService<HybridPythonJobAccepted>('/api/v1/jobs/enqueue', { method: 'POST', requestId, body: job }); }
export async function runHybridPythonPhaseThreeOperatingModelAlignmentReview(job: HybridPythonJobEnvelope, requestId?: string): Promise<HybridPythonJobAccepted> { return callPythonService<HybridPythonJobAccepted>('/api/v1/jobs/enqueue', { method: 'POST', requestId, body: job }); }
export async function runHybridPythonPhaseThreeWaveExecutionReview(job: HybridPythonJobEnvelope, requestId?: string): Promise<HybridPythonJobAccepted> { return callPythonService<HybridPythonJobAccepted>('/api/v1/jobs/enqueue', { method: 'POST', requestId, body: job }); }
export async function runHybridPythonPhaseThreeAdoptionValueTrackingReview(job: HybridPythonJobEnvelope, requestId?: string): Promise<HybridPythonJobAccepted> { return callPythonService<HybridPythonJobAccepted>('/api/v1/jobs/enqueue', { method: 'POST', requestId, body: job }); }
export async function runHybridPythonPhaseThreeGapRemediationReview(job: HybridPythonJobEnvelope, requestId?: string): Promise<HybridPythonJobAccepted> { return callPythonService<HybridPythonJobAccepted>('/api/v1/jobs/enqueue', { method: 'POST', requestId, body: job }); }
export async function runHybridPythonMigrationStageCompletionReadinessReview(job: HybridPythonJobEnvelope, requestId?: string): Promise<HybridPythonJobAccepted> { return callPythonService<HybridPythonJobAccepted>('/api/v1/jobs/enqueue', { method: 'POST', requestId, body: job }); }
export async function runHybridPythonPhaseThreeRemediationClosureReview(job: HybridPythonJobEnvelope, requestId?: string): Promise<HybridPythonJobAccepted> { return callPythonService<HybridPythonJobAccepted>('/api/v1/jobs/enqueue', { method: 'POST', requestId, body: job }); }
export async function runHybridPythonExecutiveOperationalHandoffReview(job: HybridPythonJobEnvelope, requestId?: string): Promise<HybridPythonJobAccepted> { return callPythonService<HybridPythonJobAccepted>('/api/v1/jobs/enqueue', { method: 'POST', requestId, body: job }); }
export async function runHybridPythonGlobalTaskStatusTrackingReview(job: HybridPythonJobEnvelope, requestId?: string): Promise<HybridPythonJobAccepted> { return callPythonService<HybridPythonJobAccepted>('/api/v1/jobs/enqueue', { method: 'POST', requestId, body: job }); }
export async function runHybridPythonProjectStateHealthReview(job: HybridPythonJobEnvelope, requestId?: string): Promise<HybridPythonJobAccepted> { return callPythonService<HybridPythonJobAccepted>('/api/v1/jobs/enqueue', { method: 'POST', requestId, body: job }); }
export async function runHybridPythonFinalAcceptanceEvidenceReview(job: HybridPythonJobEnvelope, requestId?: string): Promise<HybridPythonJobAccepted> { return callPythonService<HybridPythonJobAccepted>('/api/v1/jobs/enqueue', { method: 'POST', requestId, body: job }); }
export async function runHybridPythonStageExitReadinessReview(job: HybridPythonJobEnvelope, requestId?: string): Promise<HybridPythonJobAccepted> { return callPythonService<HybridPythonJobAccepted>('/api/v1/jobs/enqueue', { method: 'POST', requestId, body: job }); }
export async function runHybridPythonStageClosureCertificationReview(job: HybridPythonJobEnvelope, requestId?: string): Promise<HybridPythonJobAccepted> { return callPythonService<HybridPythonJobAccepted>('/api/v1/jobs/enqueue', { method: 'POST', requestId, body: job }); }
export async function runHybridPythonPostClosureOperationalTransitionReview(job: HybridPythonJobEnvelope, requestId?: string): Promise<HybridPythonJobAccepted> { return callPythonService<HybridPythonJobAccepted>('/api/v1/jobs/enqueue', { method: 'POST', requestId, body: job }); }
export async function runHybridPythonPostClosureMonitoringReview(job: HybridPythonJobEnvelope, requestId?: string): Promise<HybridPythonJobAccepted> { return callPythonService<HybridPythonJobAccepted>('/api/v1/jobs/enqueue', { method: 'POST', requestId, body: job }); }
export async function runHybridPythonSteadyStateTransferValidationReview(job: HybridPythonJobEnvelope, requestId?: string): Promise<HybridPythonJobAccepted> { return callPythonService<HybridPythonJobAccepted>('/api/v1/jobs/enqueue', { method: 'POST', requestId, body: job }); }
export async function runHybridPythonSteadyStateOperationalAssuranceReview(job: HybridPythonJobEnvelope, requestId?: string): Promise<HybridPythonJobAccepted> { return callPythonService<HybridPythonJobAccepted>('/api/v1/jobs/enqueue', { method: 'POST', requestId, body: job }); }
export async function runHybridPythonContinuousImprovementBacklogReview(job: HybridPythonJobEnvelope, requestId?: string): Promise<HybridPythonJobAccepted> { return callPythonService<HybridPythonJobAccepted>('/api/v1/jobs/enqueue', { method: 'POST', requestId, body: job }); }
export async function runHybridPythonStableOperationsOptimizationReview(job: HybridPythonJobEnvelope, requestId?: string): Promise<HybridPythonJobAccepted> { return callPythonService<HybridPythonJobAccepted>('/api/v1/jobs/enqueue', { method: 'POST', requestId, body: job }); }
export async function runHybridPythonRecurringMaintenanceCycleReadinessReview(job: HybridPythonJobEnvelope, requestId?: string): Promise<HybridPythonJobAccepted> { return callPythonService<HybridPythonJobAccepted>('/api/v1/jobs/enqueue', { method: 'POST', requestId, body: job }); }

export async function runHybridPythonMaintenanceCycleExecutionReview(job: HybridPythonJobEnvelope, requestId?: string): Promise<HybridPythonJobAccepted> { return callPythonService<HybridPythonJobAccepted>('/api/v1/jobs/enqueue', { method: 'POST', requestId, body: job }); }
export async function runHybridPythonLongTermOperabilitySustainabilityReview(job: HybridPythonJobEnvelope, requestId?: string): Promise<HybridPythonJobAccepted> { return callPythonService<HybridPythonJobAccepted>('/api/v1/jobs/enqueue', { method: 'POST', requestId, body: job }); }
export async function runHybridPythonRecurringOperationalMaturityAuditReview(job: HybridPythonJobEnvelope, requestId?: string): Promise<HybridPythonJobAccepted> { return callPythonService<HybridPythonJobAccepted>('/api/v1/jobs/enqueue', { method: 'POST', requestId, body: job }); }
export async function runHybridPythonStableStateContinuityControlReview(job: HybridPythonJobEnvelope, requestId?: string): Promise<HybridPythonJobAccepted> { return callPythonService<HybridPythonJobAccepted>('/api/v1/jobs/enqueue', { method: 'POST', requestId, body: job }); }
export async function runHybridPythonOperationalResilienceGovernanceReview(job: HybridPythonJobEnvelope, requestId?: string): Promise<HybridPythonJobAccepted> { return callPythonService<HybridPythonJobAccepted>('/api/v1/jobs/enqueue', { method: 'POST', requestId, body: job }); }
export async function runHybridPythonRecoveryCapabilityValidationReview(job: HybridPythonJobEnvelope, requestId?: string): Promise<HybridPythonJobAccepted> { return callPythonService<HybridPythonJobAccepted>('/api/v1/jobs/enqueue', { method: 'POST', requestId, body: job }); }
export async function runHybridPythonOperationalResilienceOptimizationReview(job: HybridPythonJobEnvelope, requestId?: string): Promise<HybridPythonJobAccepted> { return callPythonService<HybridPythonJobAccepted>('/api/v1/jobs/enqueue', { method: 'POST', requestId, body: job }); }
export async function runHybridPythonAutomatedContinuityPreparednessReview(job: HybridPythonJobEnvelope, requestId?: string): Promise<HybridPythonJobAccepted> { return callPythonService<HybridPythonJobAccepted>('/api/v1/jobs/enqueue', { method: 'POST', requestId, body: job }); }
export async function runHybridPythonAutomatedContinuityExecutionValidationReview(job: HybridPythonJobEnvelope, requestId?: string): Promise<HybridPythonJobAccepted> { return callPythonService<HybridPythonJobAccepted>('/api/v1/jobs/enqueue', { method: 'POST', requestId, body: job }); }
export async function runHybridPythonOperationalResilienceFeedbackLoopReview(job: HybridPythonJobEnvelope, requestId?: string): Promise<HybridPythonJobAccepted> { return callPythonService<HybridPythonJobAccepted>('/api/v1/jobs/enqueue', { method: 'POST', requestId, body: job }); }
export async function runHybridPythonFinalClosureEvidencePackageReview(job: HybridPythonJobEnvelope, requestId?: string): Promise<HybridPythonJobAccepted> { return callPythonService<HybridPythonJobAccepted>('/api/v1/jobs/enqueue', { method: 'POST', requestId, body: job }); }
export async function runHybridPythonGlobalImplementationCompletionChecklistReview(job: HybridPythonJobEnvelope, requestId?: string): Promise<HybridPythonJobAccepted> { return callPythonService<HybridPythonJobAccepted>('/api/v1/jobs/enqueue', { method: 'POST', requestId, body: job }); }
export async function runHybridPythonFinalOperationalHandoverReview(job: HybridPythonJobEnvelope, requestId?: string): Promise<HybridPythonJobAccepted> { return callPythonService<HybridPythonJobAccepted>('/api/v1/jobs/enqueue', { method: 'POST', requestId, body: job }); }
export async function runHybridPythonPhaseClosureCertificationReview(job: HybridPythonJobEnvelope, requestId?: string): Promise<HybridPythonJobAccepted> { return callPythonService<HybridPythonJobAccepted>('/api/v1/jobs/enqueue', { method: 'POST', requestId, body: job }); }
