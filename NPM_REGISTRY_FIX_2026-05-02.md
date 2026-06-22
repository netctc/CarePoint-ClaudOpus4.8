# NPM registry fix — 2026-05-02

The previous package-lock.json contained tarball `resolved` URLs from the packaging environment:

`packages.applied-caas-gateway1.internal.api.openai.org`

Those URLs are not reachable from a normal local workstation and cause `npm ci` to fail with `ETIMEDOUT`.

This package was cleaned so the lockfile uses the public npm registry for the affected packages, and a project `.npmrc` was added:

```ini
registry=https://registry.npmjs.org/
audit=false
fund=false
```

Run from the repository root:

```bash
npm cache verify
npm ci --registry=https://registry.npmjs.org/
npm run build:api
```

If your global npm config still forces a private registry, check it with:

```bash
npm config get registry
npm config list
```

Then reset it with:

```bash
npm config set registry https://registry.npmjs.org/
```
