# syntax=docker/dockerfile:1
# CarePoint PostgreSQL runtime.
# Keep the official PostgreSQL 16.15 / Alpine 3.24 image pinned by digest, but
# replace the Go-based gosu helper with Alpine's minimal su-exec 0.3-r0.
# The upstream postgres entrypoint invokes "gosu user command"; su-exec uses
# the same invocation shape for this privilege-drop use case.
FROM postgres:16-alpine@sha256:866efe7070b471f3a5397edac0e5edd65c23ff056587c6e47c07d008caaedd28

RUN apk add --no-cache su-exec=0.3-r0 \
 && rm -f /usr/local/bin/gosu \
 && ln -s /sbin/su-exec /usr/local/bin/gosu \
 && test "$(readlink /usr/local/bin/gosu)" = "/sbin/su-exec" \
 && su-exec nobody true
