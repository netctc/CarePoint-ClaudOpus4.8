# syntax=docker/dockerfile:1
FROM node:22-bookworm-slim
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

RUN npm run build --workspace @care-center/contracts  && npm run build --workspace @care-center/admin

EXPOSE 3001
CMD ["npm", "run", "start", "--workspace", "@care-center/admin"]
