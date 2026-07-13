/**
 * Coverage Module API Client
 *
 * Provides CRUD operations for all coverage sub-modules:
 * - Insurance Providers
 * - Coverage Plans
 * - Policies
 * - Geographic Coverage
 * - Network Providers
 * - Coverage Validation
 */

import { readCookie } from '@/lib/auth/browser-session';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:4000';

/* ─── Types ─────────────────────────────────────────────────────── */

export interface InsuranceProvider {
  id: string;
  name: string;
  code: string;
  type: string;
  contactInfo: { phone?: string; email?: string; address?: string };
  status: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface CoveragePlan {
  id: string;
  insuranceProviderId: string;
  insuranceProviderName?: string;
  name: string;
  type: string;
  coverage: string;
  deductible: number;
  copay: number;
  coinsurance: number;
  status: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface CoveragePolicy {
  id: string;
  name: string;
  rules: Record<string, unknown>;
  status: string;
  version: number;
  effectiveDate: string;
  auditTrail?: Array<{ action: string; actor: string; timestamp: string; details?: string }>;
  createdAt?: string;
  updatedAt?: string;
}

export interface GeographicCoverage {
  id: string;
  planId: string;
  planName?: string;
  country: string;
  state: string;
  city: string;
  zipCodes: string[];
  radius?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface NetworkProvider {
  id: string;
  planId: string;
  planName?: string;
  providerId: string;
  providerName?: string;
  inNetwork: boolean;
  tier: string;
  effectiveDate: string;
  terminationDate?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface CoverageValidationResult {
  covered: boolean;
  copay: number;
  priorAuthRequired: boolean;
  exclusions: string[];
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
}

export interface CoverageStats {
  activePlans: number;
  insuranceProviders: number;
  pendingValidations: number;
  coverageRate: number;
}

/* ─── Helpers ───────────────────────────────────────────────────── */

function getToken(): string {
  return readCookie('cc_admin_access_token') ?? readCookie('cc_access_token') ?? '';
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getToken();
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init?.headers ?? {}),
    },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `API request failed: ${response.status}`);
  }

  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

function buildQuery(params: Record<string, string | number | undefined | null>): string {
  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value != null && value !== '') {
      searchParams.set(key, String(value));
    }
  });
  const qs = searchParams.toString();
  return qs ? `?${qs}` : '';
}

/* ─── Coverage Stats ────────────────────────────────────────────── */

export function getCoverageStats(): Promise<CoverageStats> {
  return request<CoverageStats>('/api/admin/coverage/stats');
}

/* ─── Insurance Providers ───────────────────────────────────────── */

export function getInsuranceProviders(params?: {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
  type?: string;
  sortBy?: string;
  sortDir?: string;
}): Promise<PaginatedResponse<InsuranceProvider>> {
  return request<PaginatedResponse<InsuranceProvider>>(
    `/api/admin/coverage/insurance-providers${buildQuery(params ?? {})}`
  );
}

export function getInsuranceProvider(id: string): Promise<InsuranceProvider> {
  return request<InsuranceProvider>(`/api/admin/coverage/insurance-providers/${id}`);
}

export function createInsuranceProvider(
  data: Omit<InsuranceProvider, 'id' | 'createdAt' | 'updatedAt'>
): Promise<InsuranceProvider> {
  return request<InsuranceProvider>('/api/admin/coverage/insurance-providers', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export function updateInsuranceProvider(
  id: string,
  data: Partial<Omit<InsuranceProvider, 'id' | 'createdAt' | 'updatedAt'>>
): Promise<InsuranceProvider> {
  return request<InsuranceProvider>(`/api/admin/coverage/insurance-providers/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export function deleteInsuranceProvider(id: string): Promise<void> {
  return request<void>(`/api/admin/coverage/insurance-providers/${id}`, {
    method: 'DELETE',
  });
}

/* ─── Coverage Plans ────────────────────────────────────────────── */

export function getCoveragePlans(params?: {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
  type?: string;
  insuranceProviderId?: string;
  sortBy?: string;
  sortDir?: string;
}): Promise<PaginatedResponse<CoveragePlan>> {
  return request<PaginatedResponse<CoveragePlan>>(
    `/api/admin/coverage/plans${buildQuery(params ?? {})}`
  );
}

export function getCoveragePlan(id: string): Promise<CoveragePlan> {
  return request<CoveragePlan>(`/api/admin/coverage/plans/${id}`);
}

export function createCoveragePlan(
  data: Omit<CoveragePlan, 'id' | 'createdAt' | 'updatedAt' | 'insuranceProviderName'>
): Promise<CoveragePlan> {
  return request<CoveragePlan>('/api/admin/coverage/plans', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export function updateCoveragePlan(
  id: string,
  data: Partial<Omit<CoveragePlan, 'id' | 'createdAt' | 'updatedAt' | 'insuranceProviderName'>>
): Promise<CoveragePlan> {
  return request<CoveragePlan>(`/api/admin/coverage/plans/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export function deleteCoveragePlan(id: string): Promise<void> {
  return request<void>(`/api/admin/coverage/plans/${id}`, {
    method: 'DELETE',
  });
}

/* ─── Coverage Policies ─────────────────────────────────────────── */

export function getCoveragePolicies(params?: {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
  sortBy?: string;
  sortDir?: string;
}): Promise<PaginatedResponse<CoveragePolicy>> {
  return request<PaginatedResponse<CoveragePolicy>>(
    `/api/admin/coverage/policies${buildQuery(params ?? {})}`
  );
}

export function getCoveragePolicy(id: string): Promise<CoveragePolicy> {
  return request<CoveragePolicy>(`/api/admin/coverage/policies/${id}`);
}

export function createCoveragePolicy(
  data: Omit<CoveragePolicy, 'id' | 'createdAt' | 'updatedAt' | 'auditTrail' | 'version'>
): Promise<CoveragePolicy> {
  return request<CoveragePolicy>('/api/admin/coverage/policies', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export function updateCoveragePolicy(
  id: string,
  data: Partial<Omit<CoveragePolicy, 'id' | 'createdAt' | 'updatedAt' | 'auditTrail' | 'version'>>
): Promise<CoveragePolicy> {
  return request<CoveragePolicy>(`/api/admin/coverage/policies/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export function deleteCoveragePolicy(id: string): Promise<void> {
  return request<void>(`/api/admin/coverage/policies/${id}`, {
    method: 'DELETE',
  });
}

export function publishCoveragePolicy(id: string): Promise<CoveragePolicy> {
  return request<CoveragePolicy>(`/api/admin/coverage/policies/${id}/publish`, {
    method: 'POST',
  });
}

export function suspendCoveragePolicy(id: string): Promise<CoveragePolicy> {
  return request<CoveragePolicy>(`/api/admin/coverage/policies/${id}/suspend`, {
    method: 'POST',
  });
}

export function archiveCoveragePolicy(id: string): Promise<CoveragePolicy> {
  return request<CoveragePolicy>(`/api/admin/coverage/policies/${id}/archive`, {
    method: 'POST',
  });
}

export function rollbackCoveragePolicy(id: string, version: number): Promise<CoveragePolicy> {
  return request<CoveragePolicy>(`/api/admin/coverage/policies/${id}/rollback`, {
    method: 'POST',
    body: JSON.stringify({ version }),
  });
}

/* ─── Geographic Coverage ───────────────────────────────────────── */

export function getGeographicCoverage(params?: {
  page?: number;
  limit?: number;
  search?: string;
  planId?: string;
  country?: string;
  state?: string;
  sortBy?: string;
  sortDir?: string;
}): Promise<PaginatedResponse<GeographicCoverage>> {
  return request<PaginatedResponse<GeographicCoverage>>(
    `/api/admin/coverage/geographic${buildQuery(params ?? {})}`
  );
}

export function getGeographicCoverageItem(id: string): Promise<GeographicCoverage> {
  return request<GeographicCoverage>(`/api/admin/coverage/geographic/${id}`);
}

export function createGeographicCoverage(
  data: Omit<GeographicCoverage, 'id' | 'createdAt' | 'updatedAt' | 'planName'>
): Promise<GeographicCoverage> {
  return request<GeographicCoverage>('/api/admin/coverage/geographic', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export function updateGeographicCoverage(
  id: string,
  data: Partial<Omit<GeographicCoverage, 'id' | 'createdAt' | 'updatedAt' | 'planName'>>
): Promise<GeographicCoverage> {
  return request<GeographicCoverage>(`/api/admin/coverage/geographic/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export function deleteGeographicCoverage(id: string): Promise<void> {
  return request<void>(`/api/admin/coverage/geographic/${id}`, {
    method: 'DELETE',
  });
}

/* ─── Network Providers ─────────────────────────────────────────── */

export function getNetworkProviders(params?: {
  page?: number;
  limit?: number;
  search?: string;
  planId?: string;
  inNetwork?: boolean;
  tier?: string;
  sortBy?: string;
  sortDir?: string;
}): Promise<PaginatedResponse<NetworkProvider>> {
  const { inNetwork, ...rest } = params ?? {};
  const queryParams: Record<string, string | number | undefined | null> = { ...rest };
  if (inNetwork != null) {
    queryParams.inNetwork = inNetwork ? 'true' : 'false';
  }
  return request<PaginatedResponse<NetworkProvider>>(
    `/api/admin/coverage/network${buildQuery(queryParams)}`
  );
}

export function getNetworkProvider(id: string): Promise<NetworkProvider> {
  return request<NetworkProvider>(`/api/admin/coverage/network/${id}`);
}

export function createNetworkProvider(
  data: Omit<NetworkProvider, 'id' | 'createdAt' | 'updatedAt' | 'planName' | 'providerName'>
): Promise<NetworkProvider> {
  return request<NetworkProvider>('/api/admin/coverage/network', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export function updateNetworkProvider(
  id: string,
  data: Partial<Omit<NetworkProvider, 'id' | 'createdAt' | 'updatedAt' | 'planName' | 'providerName'>>
): Promise<NetworkProvider> {
  return request<NetworkProvider>(`/api/admin/coverage/network/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export function deleteNetworkProvider(id: string): Promise<void> {
  return request<void>(`/api/admin/coverage/network/${id}`, {
    method: 'DELETE',
  });
}

/* ─── Coverage Validation ───────────────────────────────────────── */

export function validateCoverage(
  patientId: string,
  serviceId: string,
  planId: string
): Promise<CoverageValidationResult> {
  return request<CoverageValidationResult>('/api/admin/coverage/validate', {
    method: 'POST',
    body: JSON.stringify({ patientId, serviceId, planId }),
  });
}
