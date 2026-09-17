# syntax=docker/dockerfile:1
FROM node:22-bookworm-slim@sha256:83f487e0a63425e5b4d146fb5e5be574bcbe1b7b843d3ebafdd95eaf7767a7e5
WORKDIR /app

ARG DATABASE_URL=postgresql://carecenter:change-me@postgres:5432/care_center
ARG DIRECT_URL=postgresql://carecenter:change-me@postgres:5432/care_center
ARG REDIS_URL=redis://redis:6379

ENV DATABASE_URL=${DATABASE_URL}     DIRECT_URL=${DIRECT_URL}     REDIS_URL=${REDIS_URL}

RUN apt-get update  && apt-get install -y --no-install-recommends openssl ca-certificates  && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
COPY apps/admin/package*.json apps/admin/
COPY apps/provider/package*.json apps/provider/
COPY packages/contracts/package*.json packages/contracts/
COPY services/api/package*.json services/api/

RUN npm ci --include=dev

COPY . .

RUN npm run build --workspace @care-center/contracts  && npm run prisma:generate --workspace @care-center/api  && npm run build --workspace @care-center/api  && npm prune --omit=dev

ENV NODE_ENV=production
EXPOSE 4000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 CMD node -e "fetch('http://127.0.0.1:'+(process.env.API_PORT||4000)+'/livez').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
# start:prod applies pending Prisma migrations (prisma migrate deploy) before
# launching the API, so a fresh production database gets its schema created.
CMD ["npm", "run", "start:prod", "--workspace", "@care-center/api"]
