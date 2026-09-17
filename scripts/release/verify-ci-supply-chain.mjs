import { readFileSync } from 'node:fs';

const workflowPath = '.github/workflows/ci.yml';
const workflow = readFileSync(workflowPath, 'utf8');
const checks = [];

function assert(condition, message) {
  checks.push({ passed: Boolean(condition), message });
}

assert(
  /(^|\n)permissions:\s*\n\s{2}contents:\s*read\s*($|\n)/m.test(workflow),
  'CI declares least-privileged contents: read permission',
);
assert(!/(^|\n)\s{2,}[A-Za-z0-9_-]+:\s*write\s*($|\n)/m.test(workflow), 'CI declares no write-scoped GITHUB_TOKEN permission');
assert(!/(^|\n)\s*pull_request_target\s*:/m.test(workflow), 'CI does not use pull_request_target for untrusted pull-request code');

const remoteUses = [...workflow.matchAll(/^\s*-\s+uses:\s+([^\s#]+)(?:\s+#.*)?$/gm)]
  .map((match) => match[1])
  .filter((reference) => !reference.startsWith('./'));

assert(remoteUses.length > 0, 'CI contains remote actions to validate');
for (const reference of remoteUses) {
  const atIndex = reference.lastIndexOf('@');
  const target = atIndex >= 0 ? reference.slice(atIndex + 1) : '';
  assert(/^[0-9a-f]{40}$/i.test(target), `${reference} is pinned to a full 40-character commit SHA`);
}

const failed = checks.filter((check) => !check.passed);
for (const check of checks) {
  console.log(`${check.passed ? 'PASS' : 'FAIL'} ${check.message}`);
}

if (failed.length > 0) {
  console.error(`CI supply-chain verification failed: ${failed.length}/${checks.length} checks failed.`);
  process.exit(1);
}

console.log(`CI supply-chain verification passed: ${checks.length}/${checks.length} checks.`);
