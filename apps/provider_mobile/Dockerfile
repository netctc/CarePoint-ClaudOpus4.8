# syntax=docker/dockerfile:1
FROM ghcr.io/cirruslabs/flutter:stable AS builder
WORKDIR /app

ARG API_BASE_URL=http://localhost:4000

COPY . .
WORKDIR /app/apps/provider_mobile

RUN flutter config --enable-web  && flutter pub get  && flutter build web --release --dart-define=API_BASE_URL=${API_BASE_URL}

FROM nginx:1.27-alpine
COPY apps/provider_mobile/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/apps/provider_mobile/build/web /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
