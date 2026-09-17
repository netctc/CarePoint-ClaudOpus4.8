# syntax=docker/dockerfile:1
FROM node:22-bookworm-slim@sha256:83f487e0a63425e5b4d146fb5e5be574bcbe1b7b843d3ebafdd95eaf7767a7e5
WORKDIR /app

ENV NODE_ENV=production     NEXT_TELEMETRY_DISABLED=1     PORT=3001     HOSTNAME=0.0.0.0

ARG NEXT_PUBLIC_API_BASE_URL=http://localhost:4000
ARG NEXT_PUBLIC_ALLOW_DEMO_SIGNIN=false
ENV NEXT_PUBLIC_API_BASE_URL=${NEXT_PUBLIC_API_BASE_URL}
ENV NEXT_PUBLIC_ALLOW_DEMO_SIGNIN=${NEXT_PUBLIC_ALLOW_DEMO_SIGNIN}

COPY package*.json ./
COPY apps/admin/package*.json apps/admin/
COPY apps/provider/package*.json apps/provider/
COPY packages/contracts/package*.json packages/contracts/
COPY services/api/package*.json services/api/

RUN npm ci --include=dev

COPY . .

RUN npm run build --workspace @care-center/contracts  && npm run build --workspace @care-center/admin  && npm prune --omit=dev

RUN rm -rf /usr/local/lib/node_modules/npm /usr/local/bin/npm /usr/local/bin/npx

EXPOSE 3001
CMD ["node", "node_modules/next/dist/bin/next", "start", "apps/admin", "-p", "3001"]
