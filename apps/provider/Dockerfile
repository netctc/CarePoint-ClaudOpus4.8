# syntax=docker/dockerfile:1
FROM node:22-bookworm-slim@sha256:83f487e0a63425e5b4d146fb5e5be574bcbe1b7b843d3ebafdd95eaf7767a7e5
WORKDIR /app

ENV NODE_ENV=production     NEXT_TELEMETRY_DISABLED=1     PORT=3000     HOSTNAME=0.0.0.0

ARG NEXT_PUBLIC_API_BASE_URL=http://localhost:4000
ENV NEXT_PUBLIC_API_BASE_URL=${NEXT_PUBLIC_API_BASE_URL}

COPY package*.json ./
COPY apps/admin/package*.json apps/admin/
COPY apps/provider/package*.json apps/provider/
COPY packages/contracts/package*.json packages/contracts/
COPY services/api/package*.json services/api/

RUN npm ci --include=dev

COPY . .

RUN npm run build --workspace @care-center/contracts  && npm run build --workspace @care-center/provider  && npm prune --omit=dev

EXPOSE 3000
CMD ["npm", "run", "start", "--workspace", "@care-center/provider"]
