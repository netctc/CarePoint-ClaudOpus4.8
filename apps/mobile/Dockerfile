# syntax=docker/dockerfile:1
FROM ghcr.io/cirruslabs/flutter:3.44.0@sha256:46691e311715845de03a3ba4753a475476936805b29431b1f00f1816981033f8 AS builder
WORKDIR /app

ARG API_BASE_URL=http://localhost:4000

COPY . .
WORKDIR /app/apps/mobile

RUN LOCK_SHA="$(sha256sum pubspec.lock | cut -d' ' -f1)" \
 && flutter config --enable-web \
 && flutter pub get --enforce-lockfile \
 && test "$LOCK_SHA" = "$(sha256sum pubspec.lock | cut -d' ' -f1)" \
 && flutter build web --release --dart-define=API_BASE_URL=${API_BASE_URL}

FROM nginx:1.27-alpine@sha256:65645c7bb6a0661892a8b03b89d0743208a18dd2f3f17a54ef4b76fb8e2f2a10
COPY apps/mobile/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/apps/mobile/build/web /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
