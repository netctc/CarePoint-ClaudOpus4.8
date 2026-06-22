declare module 'react' {
  export function useState<T>(initial: T): [T, (value: any) => void];
  export function useEffect(effect: any, deps?: any[]): void;
  export function useMemo<T>(factory: () => T, deps: any[]): T;
  export function useCallback<T extends (...args: any[]) => any>(fn: T, deps: any[]): T;
  export type FormEvent = any;
}
declare module 'react/jsx-runtime' {
  export const Fragment: any;
  export function jsx(type: any, props: any, key?: any): any;
  export function jsxs(type: any, props: any, key?: any): any;
}
declare module 'next/link' { const Link: any; export default Link; }
declare module 'next/navigation' {
  export function useParams<T=any>(): T;
  export function useSearchParams(): { get(name: string): string | null };
}
declare module 'next' { export type Metadata = any; }
declare namespace JSX { interface IntrinsicElements { [elemName: string]: any; } }
declare module '@/components/shared/evidence-panel' { export const EvidencePanel: any; }
declare module '@/components/shared/workspace-state-strip' { export const WorkspaceStateStrip: any; }
declare module '@/components/shared/stat-card' { export const StatCard: any; }
declare module '@/services/api-client' { export const providerApi: any; }
declare module '@/services/mock-api' {
  export function getDashboardData(): any;
  export function getQueueData(): any;
  export function getAppointmentById(id: string): any;
  export function getCalendarData(): any;
  export function getOnboardingData(): any;
  export function getSlotTemplateData(): any;
  export function getPatientChartSummary(patientId: string): any;
  export function getTelehealthWaitingRoom(id?: string): any;
  export function getEncounterNoteDraft(encounterId: string): any;
  export function getOrderComposerData(): any;
  export function getPrescriptionComposerData(): any;
  export function getMessagingInboxData(): any;
  export function getMessageThreadById(threadId: string): any;
  export function getLabOrderInboxData(): any;
  export function getLabResultById(id: string): any;
  export function getRpmProgramData(): any;
  export function getRpmPatientById(patientId: string): any;
  export function getAlertData(): any;
  export function getPerformanceAnalyticsData(): any;
  export function getBillingPayoutsData(): any;
  export function getFacilitySettingsData(): any;
  export function getTeamRolesData(): any;
  export function getComplianceAuditData(): any;
}
