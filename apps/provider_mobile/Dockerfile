# syntax=docker/dockerfile:1
FROM ghcr.io/cirruslabs/flutter:3.44.0@sha256:46691e311715845de03a3ba4753a475476936805b29431b1f00f1816981033f8 AS builder
WORKDIR /app

ARG API_BASE_URL=http://localhost:4000

COPY . .
WORKDIR /app/apps/provider_mobile

RUN LOCK_SHA="$(sha256sum pubspec.lock | cut -d' ' -f1)" \
 && flutter config --enable-web \
 && flutter pub get --enforce-lockfile \
 && test "$LOCK_SHA" = "$(sha256sum pubspec.lock | cut -d' ' -f1)" \
 && flutter build web --release --dart-define=API_BASE_URL=${API_BASE_URL}

FROM nginx:1.30.5-alpine3.24-slim@sha256:2853ea34f0e5448adfd4f6ec9c2a7974f28260730adc7a4be4e87600294fe5a2
COPY apps/provider_mobile/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/apps/provider_mobile/build/web /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
