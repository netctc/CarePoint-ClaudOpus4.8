# Provider hotfix

- Replaced `import type { ReactNode } from 'react'` with `React.ReactNode` in provider app files to avoid the Next.js type-check failure seen in Dokploy builds.
- This unblocks the provider web build stage.
- The API build may still surface additional issues after provider succeeds.
