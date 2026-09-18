import { readFileSync } from 'node:fs';

const checks = [];

function assert(condition, message) {
  checks.push({ passed: Boolean(condition), message });
}

function read(path) {
  return readFileSync(path, 'utf8');
}

const workflow = read('.github/workflows/ci.yml');
const compose = read('deploy/vps/docker-compose.yml');
const apiDockerfile = read('services/api/Dockerfile');
const adminDockerfile = read('apps/admin/Dockerfile');
const providerDockerfile = read('apps/provider/Dockerfile');
const pythonDockerfile = read('services/python-worker/Dockerfile');
const patientDockerfile = read('apps/mobile/Dockerfile');
const providerMobileDockerfile = read('apps/provider_mobile/Dockerfile');
const caddyDockerfile = read('deploy/vps/Caddy.Dockerfile');
const pythonRequirements = read('services/python-worker/requirements.txt');
const packageLock = JSON.parse(read('package-lock.json'));

const NODE_IMAGE = 'node:22-bookworm-slim@sha256:83f487e0a63425e5b4d146fb5e5be574bcbe1b7b843d3ebafdd95eaf7767a7e5';
const PYTHON_IMAGE = 'python:3.12-slim@sha256:78387bc3881b8273120a12ebe6c1ab22b018ccc2c9adf565ae1ac9b536e184ea';
const FLUTTER_IMAGE = 'ghcr.io/cirruslabs/flutter:3.44.0@sha256:46691e311715845de03a3ba4753a475476936805b29431b1f00f1816981033f8';
const NGINX_IMAGE = 'nginx:1.30.5-alpine3.24-slim@sha256:2853ea34f0e5448adfd4f6ec9c2a7974f28260730adc7a4be4e87600294fe5a2';
const POSTGRES_IMAGE = 'postgres:16-alpine@sha256:866efe7070b471f3a5397edac0e5edd65c23ff056587c6e47c07d008caaedd28';
const REDIS_IMAGE = 'redis:7-alpine@sha256:ff02b58f971e7d7d156a1267e283fcbbeee91773b6aa36c49dac28ecfe28eadf';
const CADDY_BUILDER_IMAGE = 'golang:1.26.6-alpine3.23@sha256:e57c41c1d5864341031181b0db34b9a537bb5773eb6428e4e5bdaea0f9135406';
const CADDY_VERSION = 'v2.11.4';
const CADDY_COMMIT = 'e2eee6a7fce366321294c9c2a79f3146891dcbdf';
const CI_POSTGRES_IMAGE = 'postgres:16@sha256:f1c3376c26f2609ab9f29f71f824103fe2fcd8ee0346485cb6122a4f93df6f94';
const CI_REDIS_IMAGE = 'redis:7@sha256:71da9275c5f3fcb97d0fa0c8c5b36cc995327265420f17a04bfd544f458059f7';
const FLUTTER_ARCHIVE = 'https://storage.googleapis.com/flutter_infra_release/releases/stable/linux/flutter_linux_3.44.0-stable.tar.xz';
const FLUTTER_ARCHIVE_SHA256 = 'e1ec95e6c550458a34de93580cb85dac24da0e9bedb9bb42811f050ac5a0c7d5';

assert((workflow.match(/runs-on:\s*ubuntu-24\.04/g) ?? []).length === 3, 'CI jobs use the release-pinned Ubuntu 24.04 runner family');
assert(workflow.includes(`image: ${CI_POSTGRES_IMAGE}`), 'CI PostgreSQL service is pinned by digest');
assert(workflow.includes(`image: ${CI_REDIS_IMAGE}`), 'CI Redis service is pinned by digest');
assert((workflow.match(/node-version:\s*['"]?22\.23\.2['"]?/g) ?? []).length === 2, 'CI Node runtime is pinned to 22.23.2');
assert(workflow.includes("python-version: '3.12.14'"), 'CI Python runtime is pinned to 3.12.14');
assert(workflow.includes('python -m pip install --upgrade pip==26.2.1'), 'CI pip runtime is pinned to 26.2.1');
assert(workflow.includes(FLUTTER_ARCHIVE), 'CI Flutter SDK uses the exact 3.44.0 release archive');
assert(workflow.includes(FLUTTER_ARCHIVE_SHA256), 'CI verifies the Flutter SDK archive checksum');
assert(!workflow.includes('subosito/flutter-action@'), 'CI does not depend on a mutable transitive Flutter setup action chain');
assert(workflow.includes('flutter pub get --enforce-lockfile'), 'CI enforces committed Flutter lockfiles');
assert(workflow.includes('git diff --exit-code -- pubspec.lock'), 'CI fails if Flutter dependency resolution rewrites a lockfile');

for (const [name, dockerfile] of [
  ['API', apiDockerfile],
  ['Admin', adminDockerfile],
  ['Provider', providerDockerfile],
]) {
  assert(dockerfile.includes(`FROM ${NODE_IMAGE}`), `${name} Node base image is pinned by digest`);
  assert(dockerfile.includes('npm prune --omit=dev'), `${name} runtime prunes development-only Node dependencies after build`);
  assert(dockerfile.includes('rm -rf /usr/local/lib/node_modules/npm /usr/local/bin/npm /usr/local/bin/npx'), `${name} runtime removes the bundled npm CLI after build`);
  assert(dockerfile.includes('libpcre2-8-0=10.42-1+deb12u1'), `${name} runtime pins the patched Debian pcre2 package`);
}

assert(pythonDockerfile.includes(`FROM ${PYTHON_IMAGE}`), 'Python worker base image is pinned by digest');
assert(pythonDockerfile.includes('python -m pip install --upgrade pip==26.2.1 setuptools==78.1.1'), 'Python worker build pins pip and patched setuptools');
assert(pythonDockerfile.includes("m.version('msgpack') == '1.2.1'"), 'Python worker verifies the effective patched msgpack runtime version');
assert(pythonDockerfile.includes('python -m pip uninstall -y pip setuptools wheel'), 'Python worker removes build/package-manager tooling from the final runtime');
assert(pythonDockerfile.includes("u.find_spec('pip') is None"), 'Python worker verifies pip/setuptools/wheel are absent from the final runtime');
for (const packagePin of [
  'perl-base=5.40.1-6+deb13u1',
  'libsqlite3-0=3.46.1-7+deb13u2',
  'gzip=1.13-1+deb13u1',
  'libpcre2-8-0=10.46-1~deb13u2',
]) {
  assert(pythonDockerfile.includes(packagePin), `Python worker runtime pins patched package ${packagePin}`);
}

for (const [name, dockerfile] of [
  ['Patient Web', patientDockerfile],
  ['Provider Mobile Web', providerMobileDockerfile],
]) {
  assert(dockerfile.includes(`FROM ${FLUTTER_IMAGE} AS builder`), `${name} Flutter builder image is pinned to 3.44.0 by digest`);
  assert(dockerfile.includes(`FROM ${NGINX_IMAGE}`), `${name} Nginx runtime image is pinned by digest`);
  assert(dockerfile.includes('flutter pub get --enforce-lockfile'), `${name} build enforces the committed Flutter lockfile`);
}

const resolvedNodeSecurityVersions = {
  'node_modules/next': '16.3.3',
  'node_modules/sharp': '0.35.4',
  'node_modules/engine.io': '6.6.10',
  'node_modules/socket.io-adapter': '2.5.8',
  'node_modules/socket.io-parser': '4.2.7',
  'node_modules/ws': '8.21.3',
};
for (const [packagePath, version] of Object.entries(resolvedNodeSecurityVersions)) {
  assert(packageLock.packages?.[packagePath]?.version === version, `${packagePath} is locked to patched version ${version}`);
}

assert(compose.includes(`image: ${POSTGRES_IMAGE}`), 'Production PostgreSQL image is pinned by digest');
assert(compose.includes(`image: ${REDIS_IMAGE}`), 'Production Redis image is pinned by digest');
assert(compose.includes('dockerfile: deploy/vps/Caddy.Dockerfile'), 'Production Caddy edge uses the reproducible patched build');
assert(!compose.includes('image: caddy:'), 'Production Caddy edge does not fall back to the stock Caddy image');
assert(caddyDockerfile.includes(`FROM ${CADDY_BUILDER_IMAGE} AS builder`), 'Caddy builder image is pinned by digest');
assert(caddyDockerfile.includes(`ARG CADDY_VERSION=${CADDY_VERSION}`), 'Caddy source build preserves the exact v2.11.4 tag');
assert(caddyDockerfile.includes(`ARG CADDY_COMMIT=${CADDY_COMMIT}`), 'Caddy source is pinned to the exact v2.11.4 commit');
assert(caddyDockerfile.includes('git fetch --depth=1 origin tag "${CADDY_VERSION}"'), 'Caddy build fetches the signed upstream release tag instead of an untagged shallow commit');
assert(caddyDockerfile.includes('git describe --exact-match --tags HEAD'), 'Caddy build verifies the checked-out commit still resolves to the release tag');
for (const dependencyPin of [
  'golang.org/x/crypto@v0.55.0',
  'golang.org/x/net@v0.58.0',
  'golang.org/x/text@v0.41.0',
  'google.golang.org/grpc@v1.83.2',
]) {
  assert(caddyDockerfile.includes(dependencyPin), `Caddy build pins patched dependency ${dependencyPin}`);
}
assert(caddyDockerfile.includes('CGO_ENABLED=0 go build'), 'Caddy is built as a static binary');
assert(caddyDockerfile.includes('FROM scratch'), 'Caddy runtime uses a scratch image with no package-manager surface');

const requirementLines = pythonRequirements
  .split(/\r?\n/)
  .map((line) => line.trim())
  .filter((line) => line && !line.startsWith('#'));
assert(requirementLines.length > 0, 'Python worker declares direct requirements');
assert(requirementLines.includes('msgpack==1.2.1'), 'Python worker pins patched msgpack 1.2.1');
assert(
  requirementLines.every((line) => /^[A-Za-z0-9_.-]+(?:\[[A-Za-z0-9_.-]+(?:,[A-Za-z0-9_.-]+)*\])?==[^\s]+$/.test(line)),
  'Python worker direct requirements use exact versions instead of open ranges',
);

const failed = checks.filter((check) => !check.passed);
for (const check of checks) {
  console.log(`${check.passed ? 'PASS' : 'FAIL'} ${check.message}`);
}

if (failed.length > 0) {
  console.error(`Runtime pin verification failed: ${failed.length}/${checks.length} checks failed.`);
  process.exit(1);
}

console.log(`Runtime pin verification passed: ${checks.length}/${checks.length} checks.`);
