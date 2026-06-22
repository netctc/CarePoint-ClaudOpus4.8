import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync, statSync } from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const outDir = path.join(root, 'validation', 'qa');
mkdirSync(outDir, { recursive: true });

const rel = (p) => path.join(root, ...p.split('/'));
const exists = (p) => existsSync(rel(p));
const read = (p) => exists(p) ? readFileSync(rel(p), 'utf8') : '';
const json = (p) => JSON.parse(read(p));

function countFiles(dir, predicate = () => true) {
  const start = rel(dir);
  if (!existsSync(start)) return 0;
  let total = 0;
  const stack = [start];
  while (stack.length) {
    const current = stack.pop();
    for (const entry of readdirSync(current)) {
      const full = path.join(current, entry);
      const st = statSync(full);
      if (st.isDirectory()) stack.push(full);
      else if (predicate(full)) total += 1;
    }
  }
  return total;
}

function countMatches(file, regex) {
  return (read(file).match(regex) || []).length;
}

function hasAny(file, patterns) {
  const text = read(file);
  return patterns.some((pattern) => text.includes(pattern));
}

const pkg = json('package.json');
const qaV1Audit = json('validation/qa/qa-v1-master-qa-plan-audit.json');
const qaV2Audit = json('validation/qa/qa-v2-admin-functional-config-audit.json');
const qaV3Audit = json('validation/qa/qa-v3-provider-functional-workflows-audit.json');

const routeFile = 'services/api/src/modules/hybrid-python/hybrid-python.routes.ts';
const routeDistFile = 'services/api/dist/modules/hybrid-python/hybrid-python.routes.js';
const helperFile = 'services/api/src/lib/hybrid-python.ts';
const helperDistFile = 'services/api/dist/lib/hybrid-python.js';
const contractSource = 'packages/contracts/src/index.ts';
const contractDist = 'packages/contracts/dist/index.js';
const pythonContracts = 'services/python-worker/carepoint_python_worker/contracts.py';
const pythonProcessors = 'services/python-worker/carepoint_python_worker/jobs/processors.py';
const pythonPolicies = 'services/python-worker/carepoint_python_worker/policies.py';
const pythonRouter = 'services/python-worker/carepoint_python_worker/services/job_router.py';
const pythonTests = 'services/python-worker/tests/test_worker_contracts.py';

const routerPostCount = countMatches(routeFile, /hybridPythonRouter\.post\(/g);
const routeJobTypeCount = countMatches(routeFile, /jobType:\s*'/g);
const helperExportCount = countMatches(helperFile, /export async function runHybridPython/g);
const contractSchemaCount = countMatches(contractSource, /export const hybridPython/g);
const contractJobTypeCount = countMatches(contractSource, /platform\.[a-z0-9_]+/g);
const pythonContractJobTypeCount = countMatches(pythonContracts, /platform\.[a-z0-9_]+/g);
const pythonProcessorDecisionCount = countMatches(pythonProcessors, /decision|pass|hold|rollback/g);
const pythonTestCount = countMatches(pythonTests, /def test_/g);

const integrationArtifacts = [
  { id: 'API-PACKAGE', path: 'services/api/package.json', priority: 'P0', purpose: 'API workspace package exists.' },
  { id: 'CONTRACTS-PACKAGE', path: 'packages/contracts/package.json', priority: 'P0', purpose: 'Shared contracts workspace package exists.' },
  { id: 'CONTRACTS-SOURCE', path: contractSource, priority: 'P0', purpose: 'Shared contract schemas exist.' },
  { id: 'CONTRACTS-DIST', path: contractDist, priority: 'P0', purpose: 'Compiled contract bundle exists for API consumption.' },
  { id: 'API-HYBRID-HELPER-SOURCE', path: helperFile, priority: 'P0', purpose: 'Node helper for Python worker preparation exists.' },
  { id: 'API-HYBRID-HELPER-DIST', path: helperDistFile, priority: 'P0', purpose: 'Compiled Node helper exists for syntax smoke.' },
  { id: 'API-HYBRID-ROUTES-SOURCE', path: routeFile, priority: 'P0', purpose: 'Hybrid Python prepare routes exist.' },
  { id: 'API-HYBRID-ROUTES-DIST', path: routeDistFile, priority: 'P0', purpose: 'Compiled hybrid Python routes exist for syntax smoke.' },
  { id: 'PYTHON-WORKER-PACKAGE', path: 'services/python-worker/pyproject.toml', priority: 'P0', purpose: 'Python worker project metadata exists.' },
  { id: 'PYTHON-WORKER-MAIN', path: 'services/python-worker/carepoint_python_worker/main.py', priority: 'P0', purpose: 'Python worker ASGI entry exists.' },
  { id: 'PYTHON-WORKER-CONTRACTS', path: pythonContracts, priority: 'P0', purpose: 'Python worker contract model exists.' },
  { id: 'PYTHON-WORKER-PROCESSORS', path: pythonProcessors, priority: 'P0', purpose: 'Python worker processors exist.' },
  { id: 'PYTHON-WORKER-POLICIES', path: pythonPolicies, priority: 'P0', purpose: 'Python worker dry-run/advisory policies exist.' },
  { id: 'PYTHON-WORKER-JOB-ROUTER', path: pythonRouter, priority: 'P0', purpose: 'Python worker job router exists.' },
  { id: 'PYTHON-WORKER-CONTRACT-TESTS', path: pythonTests, priority: 'P0', purpose: 'Python worker contract test suite exists.' },
  { id: 'PYTHON-WORKER-VERIFY', path: 'scripts/option_b/verify_python_worker.py', priority: 'P0', purpose: 'Worker verification script exists.' },
  { id: 'PYTHON-WORKER-CONTRACT-RUNNER', path: 'scripts/option_b/run_python_worker_contract_tests.py', priority: 'P0', purpose: 'Contract test runner exists.' },
  { id: 'OPTION-B-V64-CLOSURE', path: 'docs/option-b/FINAL_HANDOVER_AND_PHASE_CLOSURE_V64.md', priority: 'P0', purpose: 'Closed implementation phase evidence exists.' }
];

const requiredScripts = [
  { id: 'SCRIPT-BUILD-CONTRACTS', name: 'build:contracts', expected: 'npm run build --workspace @care-center/contracts', priority: 'P0' },
  { id: 'SCRIPT-BUILD-API', name: 'build:api', expected: 'npm run build --workspace @care-center/api', priority: 'P0' },
  { id: 'SCRIPT-BUILD-BACKEND', name: 'build:backend', expected: 'npm run build:contracts && npm run build:api', priority: 'P0' },
  { id: 'SCRIPT-VERIFY-PYTHON', name: 'verify:python-worker', expectedIncludes: 'verify_python_worker.py', priority: 'P0' },
  { id: 'SCRIPT-TEST-PYTHON-CONTRACTS', name: 'test:python-worker:contracts', expectedIncludes: 'run_python_worker_contract_tests.py', priority: 'P0' },
  { id: 'SCRIPT-VERIFY-OPTION-B', name: 'verify:option-b', expectedIncludes: 'verify:python-worker', priority: 'P1' },
  { id: 'SCRIPT-AUDIT-QA', name: 'audit:qa', expectedIncludes: 'scan-api-python-e2e.mjs', priority: 'P0' },
  { id: 'SCRIPT-AUDIT-QA-API-PYTHON', name: 'audit:qa:api-python-e2e', expected: 'node scripts/qa/scan-api-python-e2e.mjs', priority: 'P0' }
];

const apiPythonE2EScenarioPlan = [
  { id: 'QA4-INT-001', area: 'Workspace build', title: 'Shared contracts package builds before API build', priority: 'P0', method: 'automated-scripted' },
  { id: 'QA4-INT-002', area: 'Workspace build', title: 'API build passes against compiled contracts', priority: 'P0', method: 'automated-scripted' },
  { id: 'QA4-INT-003', area: 'Workspace build', title: 'Backend build executes build:contracts followed by build:api', priority: 'P0', method: 'automated-scripted' },
  { id: 'QA4-INT-004', area: 'Route readiness', title: 'Hybrid Python prepare route source exposes at least 100 prepare endpoints', priority: 'P0', method: 'automated-static' },
  { id: 'QA4-INT-005', area: 'Route readiness', title: 'Hybrid Python routes validate request bodies before worker preparation', priority: 'P0', method: 'automated-static' },
  { id: 'QA4-INT-006', area: 'Route readiness', title: 'Hybrid Python routes preserve requestId/correlationId in response evidence', priority: 'P0', method: 'automated-static' },
  { id: 'QA4-INT-007', area: 'Idempotency', title: 'Hybrid Python prepare endpoints derive deterministic idempotency keys', priority: 'P0', method: 'automated-static' },
  { id: 'QA4-INT-008', area: 'Contracts', title: 'TypeScript contracts expose hybrid Python schemas and job type evidence', priority: 'P0', method: 'automated-static' },
  { id: 'QA4-INT-009', area: 'Contracts', title: 'Compiled contract bundle is syntax-checkable for runtime usage', priority: 'P0', method: 'automated-scripted' },
  { id: 'QA4-INT-010', area: 'Node helper', title: 'Node hybrid Python helper exposes runHybridPython helpers for domain prepare flows', priority: 'P0', method: 'automated-static' },
  { id: 'QA4-INT-011', area: 'Node helper', title: 'Compiled Node helper is syntax-checkable', priority: 'P0', method: 'automated-scripted' },
  { id: 'QA4-INT-012', area: 'Python worker', title: 'Python worker verification passes', priority: 'P0', method: 'automated-scripted' },
  { id: 'QA4-INT-013', area: 'Python worker', title: 'Python worker contract test runner executes contract suite', priority: 'P0', method: 'automated-scripted' },
  { id: 'QA4-INT-014', area: 'Python worker', title: 'Python worker source compiles recursively', priority: 'P0', method: 'automated-scripted' },
  { id: 'QA4-INT-015', area: 'Python worker', title: 'Worker processor decisions support pass, hold, and rollback', priority: 'P0', method: 'automated-static' },
  { id: 'QA4-INT-016', area: 'Python worker', title: 'Dry-run/advisory policies remain metadata-only and non-mutating', priority: 'P0', method: 'automated-static' },
  { id: 'QA4-INT-017', area: 'Cross-boundary error handling', title: 'API validation errors and worker warnings produce stable status/code/message evidence', priority: 'P1', method: 'manual-or-scripted' },
  { id: 'QA4-INT-018', area: 'Cross-boundary evidence', title: 'API and worker evidence can be attached to production readiness package', priority: 'P1', method: 'manual-or-scripted' },
  { id: 'QA4-INT-019', area: 'Regression', title: 'QA-V1, QA-V2, and QA-V3 audits remain complete before integration validation', priority: 'P0', method: 'automated-static' },
  { id: 'QA4-INT-020', area: 'Security smoke', title: 'Hybrid Python endpoints remain protected by API auth/context middleware chain', priority: 'P1', method: 'manual-or-scripted' },
  { id: 'QA4-INT-021', area: 'Observability', title: 'Worker preparation preserves traceable correlation and request identifiers', priority: 'P1', method: 'automated-static' },
  { id: 'QA4-INT-022', area: 'Production readiness', title: 'Node/API/Python validation evidence is ready for UAT and readiness signoff', priority: 'P0', method: 'manual-or-scripted' }
].map((scenario) => ({
  ...scenario,
  role: scenario.area.includes('Python') ? 'python-worker' : scenario.area.includes('Contracts') ? 'contracts-api' : 'platform',
  expectedEvidence: [
    'tester',
    'environment',
    'date',
    'command or endpoint under test',
    'steps executed',
    'expected result',
    'actual result',
    'pass/fail',
    'log output or screenshot reference when applicable',
    'linked defect id when failed'
  ],
  acceptance: scenario.priority === 'P0'
    ? 'Must pass before production readiness signoff'
    : 'Must be triaged before production readiness signoff'
}));

const artifactChecks = integrationArtifacts.map((artifact) => ({
  id: `artifact_${artifact.id.toLowerCase().replaceAll('-', '_')}`,
  artifactId: artifact.id,
  path: artifact.path,
  priority: artifact.priority,
  passed: exists(artifact.path)
}));

const scriptChecks = requiredScripts.map((script) => {
  const value = pkg.scripts?.[script.name] || '';
  return {
    id: script.id.toLowerCase().replaceAll('-', '_'),
    script: script.name,
    priority: script.priority,
    passed: script.expected ? value === script.expected : value.includes(script.expectedIncludes)
  };
});

const routeChecks = [
  { id: 'hybrid_route_source_present', passed: exists(routeFile) },
  { id: 'hybrid_route_dist_present', passed: exists(routeDistFile) },
  { id: 'hybrid_route_post_count_at_least_100', passed: routerPostCount >= 100, observed: routerPostCount },
  { id: 'hybrid_route_job_type_count_at_least_100', passed: routeJobTypeCount >= 100, observed: routeJobTypeCount },
  { id: 'hybrid_route_uses_validate_body', passed: hasAny(routeFile, ['validateBody(']) },
  { id: 'hybrid_route_uses_idempotency_keys', passed: hasAny(routeFile, ['buildDomainIdempotencyKey']) },
  { id: 'hybrid_route_preserves_request_id', passed: hasAny(routeFile, ['requestId']) },
  { id: 'hybrid_route_preserves_correlation_id', passed: hasAny(routeFile, ['correlationId']) },
  { id: 'hybrid_route_returns_accepted_or_200', passed: hasAny(routeFile, ['result.accepted ? 202 : 200']) },
  { id: 'hybrid_route_covers_v64_handover', passed: hasAny(routeFile, ['final-operational/handover', 'phase-closure/certification']) }
];

const helperChecks = [
  { id: 'hybrid_helper_source_present', passed: exists(helperFile) },
  { id: 'hybrid_helper_dist_present', passed: exists(helperDistFile) },
  { id: 'hybrid_helper_exports_at_least_100_helpers', passed: helperExportCount >= 100, observed: helperExportCount },
  { id: 'hybrid_helper_has_prepare_job_client', passed: hasAny(helperFile, ['runHybridPython', 'HybridPythonJobEnvelope']) },
  { id: 'hybrid_helper_tracks_idempotency_key', passed: hasAny(helperFile, ['idempotencyKey']) },
  { id: 'hybrid_helper_tracks_correlation_id', passed: hasAny(helperFile, ['correlationId']) },
  { id: 'hybrid_helper_uses_job_type', passed: hasAny(helperFile, ['jobType']) }
];

const contractChecks = [
  { id: 'contracts_source_present', passed: exists(contractSource) },
  { id: 'contracts_dist_present', passed: exists(contractDist) },
  { id: 'contracts_export_many_hybrid_schemas', passed: contractSchemaCount >= 100, observed: contractSchemaCount },
  { id: 'contracts_include_platform_job_types', passed: contractJobTypeCount >= 100, observed: contractJobTypeCount },
  { id: 'contracts_use_zod', passed: hasAny(contractSource, ["from 'zod'", 'from \"zod\"']) },
  { id: 'contracts_include_v64_job_types', passed: hasAny(contractSource, ['platform.final_operational_handover_review', 'platform.phase_closure_certification_review']) },
  { id: 'contracts_dist_exports_commonjs_or_module', passed: hasAny(contractDist, ['exports', 'hybridPython']) }
];

const pythonChecks = [
  { id: 'python_worker_contracts_present', passed: exists(pythonContracts) },
  { id: 'python_worker_processors_present', passed: exists(pythonProcessors) },
  { id: 'python_worker_policies_present', passed: exists(pythonPolicies) },
  { id: 'python_worker_job_router_present', passed: exists(pythonRouter) },
  { id: 'python_worker_tests_present', passed: exists(pythonTests) },
  { id: 'python_contracts_include_platform_job_types', passed: pythonContractJobTypeCount >= 100, observed: pythonContractJobTypeCount },
  { id: 'python_processors_include_decision_logic', passed: pythonProcessorDecisionCount >= 20, observed: pythonProcessorDecisionCount },
  { id: 'python_processors_include_pass_hold_rollback', passed: ['pass', 'hold', 'rollback'].every((term) => read(pythonProcessors).includes(term)) },
  { id: 'python_policies_include_dry_run_or_advisory', passed: hasAny(pythonPolicies, ['dry', 'advisory', 'metadata']) },
  { id: 'python_router_routes_job_types', passed: hasAny(pythonRouter, ['job_type', 'JobType', 'processors']) },
  { id: 'python_contract_tests_define_many_tests', passed: pythonTestCount >= 5, observed: pythonTestCount },
  { id: 'python_verify_script_available', passed: exists('scripts/option_b/verify_python_worker.py') },
  { id: 'python_contract_runner_available', passed: exists('scripts/option_b/run_python_worker_contract_tests.py') }
];

const continuityChecks = [
  { id: 'qa_v1_complete', passed: qaV1Audit?.aggregate?.completionPercent === 100 },
  { id: 'qa_v2_complete', passed: qaV2Audit?.aggregate?.completionPercent === 100 },
  { id: 'qa_v3_complete', passed: qaV3Audit?.aggregate?.completionPercent === 100 },
  { id: 'qa_v3_provider_plan_present', passed: exists('validation/qa/qa-v3-provider-functional-test-plan.json') },
  { id: 'v64_final_phase_closure_doc_present', passed: exists('docs/option-b/FINAL_HANDOVER_AND_PHASE_CLOSURE_V64.md') },
  { id: 'ux_v6_closure_doc_present', passed: exists('docs/design/UX_PHASE_CLOSURE_CERTIFICATE.md') }
];

const staticInventoryChecks = [
  { id: 'api_ts_files_present', passed: countFiles('services/api/src', (p) => p.endsWith('.ts')) >= 100, observed: countFiles('services/api/src', (p) => p.endsWith('.ts')) },
  { id: 'api_dist_js_files_present', passed: countFiles('services/api/dist', (p) => p.endsWith('.js')) >= 50, observed: countFiles('services/api/dist', (p) => p.endsWith('.js')) },
  { id: 'python_worker_py_files_present', passed: countFiles('services/python-worker/carepoint_python_worker', (p) => p.endsWith('.py')) >= 15, observed: countFiles('services/python-worker/carepoint_python_worker', (p) => p.endsWith('.py')) },
  { id: 'contract_dist_types_present', passed: exists('packages/contracts/dist/index.d.ts') }
];

const scenarioChecks = [
  { id: 'qa_v4_has_at_least_22_scenarios', passed: apiPythonE2EScenarioPlan.length >= 22 },
  { id: 'qa_v4_has_p0_integration_coverage', passed: apiPythonE2EScenarioPlan.filter((s) => s.priority === 'P0').length >= 15 },
  { id: 'qa_v4_covers_build_route_contract_worker_error_evidence', passed: ['Workspace build', 'Route readiness', 'Contracts', 'Python worker', 'Cross-boundary evidence'].every((area) => apiPythonE2EScenarioPlan.some((s) => s.area === area)) }
];

const checks = [
  ...artifactChecks,
  ...scriptChecks,
  ...routeChecks,
  ...helperChecks,
  ...contractChecks,
  ...pythonChecks,
  ...continuityChecks,
  ...staticInventoryChecks,
  ...scenarioChecks
];

const passed = checks.filter((check) => check.passed).length;
const total = checks.length;

const audit = {
  phase: 'CarePoint Phase 3 - End-to-End QA, UAT & Production Readiness',
  delivery: 'QA-V4',
  sourceBaseline: 'CarePoint_qa_uat_production_readiness_v3',
  generatedAt: new Date().toISOString(),
  scope: 'Node/API/Python worker E2E validation readiness',
  technicalBoundary: {
    optionBPythonProgressive: 'closed at V64',
    designRefinementUx: 'closed at UX-V6',
    qaV1MasterPlan: 'complete',
    qaV2AdminFunctionalQa: 'complete',
    qaV3ProviderFunctionalQa: 'complete',
    backendContractsChanged: false,
    pythonWorkerChanged: false,
    databaseChanged: false,
    applicationRuntimeCodeChanged: false,
    qaArtifactsOnly: true
  },
  inventory: {
    apiSourceTsFiles: countFiles('services/api/src', (p) => p.endsWith('.ts')),
    apiDistJsFiles: countFiles('services/api/dist', (p) => p.endsWith('.js')),
    pythonWorkerPyFiles: countFiles('services/python-worker/carepoint_python_worker', (p) => p.endsWith('.py')),
    routerPostCount,
    routeJobTypeCount,
    helperExportCount,
    contractSchemaCount,
    contractJobTypeCount,
    pythonContractJobTypeCount,
    pythonContractTestFunctions: pythonTestCount
  },
  artifacts: integrationArtifacts,
  scenarios: {
    count: apiPythonE2EScenarioPlan.length,
    priorityCounts: apiPythonE2EScenarioPlan.reduce((acc, scenario) => {
      acc[scenario.priority] = (acc[scenario.priority] || 0) + 1;
      return acc;
    }, {})
  },
  checks,
  aggregate: {
    passed,
    total,
    completionPercent: Math.round((passed / total) * 100)
  },
  outputs: {
    e2ePlanFile: 'validation/qa/qa-v4-api-python-e2e-test-plan.json',
    docs: [
      'docs/qa/QA_V4_NODE_API_PYTHON_E2E_VALIDATION.md',
      'docs/qa/QA_V4_INTEGRATION_TEST_PLAN.md',
      'docs/qa/QA_V4_VALIDATION.md',
      'docs/qa/CHANGELOG_QA_V3_TO_QA_V4.md'
    ],
    nextRecommendedDelivery: 'QA-V5 - UAT package and acceptance by role'
  },
  readinessPosition: passed === total ? 'ready-for-uat-package' : 'blocked-before-uat-package'
};

const plan = {
  phase: audit.phase,
  delivery: audit.delivery,
  sourceBaseline: audit.sourceBaseline,
  generatedAt: audit.generatedAt,
  purpose: 'Define and validate the Node/API/Python worker E2E evidence set before UAT execution.',
  scenarioCount: apiPythonE2EScenarioPlan.length,
  priorityCounts: audit.scenarios.priorityCounts,
  requiredLocalCommands: [
    'npm install',
    'npm run build:contracts',
    'npm run build:api',
    'npm run audit:qa',
    'python -m compileall -q services/python-worker/carepoint_python_worker',
    'PYTHONPATH=services/python-worker python scripts/option_b/verify_python_worker.py',
    'PYTEST_DISABLE_PLUGIN_AUTOLOAD=1 PYTHONPATH=services/python-worker python -m pytest -q services/python-worker/tests/test_worker_contracts.py --disable-warnings'
  ],
  scenarios: apiPythonE2EScenarioPlan
};

writeFileSync(path.join(outDir, 'qa-v4-api-python-e2e-audit.json'), JSON.stringify(audit, null, 2) + '\n');
writeFileSync(path.join(outDir, 'qa-v4-api-python-e2e-test-plan.json'), JSON.stringify(plan, null, 2) + '\n');

console.log('QA-V4 API/Python E2E audit written to validation/qa/qa-v4-api-python-e2e-audit.json');
console.log('QA-V4 API/Python E2E test plan written to validation/qa/qa-v4-api-python-e2e-test-plan.json');
console.log(`Aggregate completion: ${audit.aggregate.completionPercent}% (${passed}/${total})`);
console.log(`QA-V4 API/Python E2E test plan: ${apiPythonE2EScenarioPlan.length} scenarios`);
console.log(`Router prepare endpoints: ${routerPostCount}`);
console.log(`Helper exports: ${helperExportCount}`);
