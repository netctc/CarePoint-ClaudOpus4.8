# syntax=docker/dockerfile:1
# Reproducible CarePoint edge build.
# Caddy source is pinned to the exact v2.11.4 commit; security-sensitive
# dependencies are pinned to versions identified as fixed by the release scan.
FROM golang:1.26.6-alpine3.23@sha256:e57c41c1d5864341031181b0db34b9a537bb5773eb6428e4e5bdaea0f9135406 AS builder

ARG CADDY_VERSION=v2.11.4
ARG CADDY_COMMIT=e2eee6a7fce366321294c9c2a79f3146891dcbdf

RUN apk add --no-cache git ca-certificates

WORKDIR /src
RUN git init \
 && git remote add origin https://github.com/caddyserver/caddy.git \
 && git fetch --depth=1 origin tag "${CADDY_VERSION}" \
 && git checkout --detach FETCH_HEAD \
 && test "$(git rev-parse HEAD)" = "${CADDY_COMMIT}" \
 && test "$(git describe --exact-match --tags HEAD)" = "${CADDY_VERSION}"

RUN go get \
      golang.org/x/crypto@v0.55.0 \
      golang.org/x/net@v0.58.0 \
      golang.org/x/text@v0.41.0 \
      google.golang.org/grpc@v1.83.2 \
 && go mod tidy \
 && CGO_ENABLED=0 go build -trimpath -ldflags="-s -w -buildid=" -o /out/caddy ./cmd/caddy

RUN mkdir -p /rootfs/etc/ssl/certs /rootfs/etc/caddy \
 && cp /etc/ssl/certs/ca-certificates.crt /rootfs/etc/ssl/certs/ca-certificates.crt \
 && printf '{}\n' > /rootfs/etc/caddy/Caddyfile

FROM scratch
COPY --from=builder /rootfs/ /
COPY --from=builder /out/caddy /usr/bin/caddy

ENV XDG_CONFIG_HOME=/config \
    XDG_DATA_HOME=/data

WORKDIR /srv
VOLUME ["/data", "/config"]
EXPOSE 80 443 443/udp 2019
ENTRYPOINT ["/usr/bin/caddy"]
CMD ["run", "--config", "/etc/caddy/Caddyfile", "--adapter", "caddyfile"]
