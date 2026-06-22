# ============================================================================
# CarePoint - helper de desarrollo y producción (GNU make).
# En Windows usa WSL o Git Bash. En Linux/macOS funciona directo.
#
#   make help            Lista los objetivos disponibles.
#   make setup           Instalación inicial (npm + prisma + deps Python).
#   make dev             Levanta infra + todos los servicios (en paralelo).
#   make test-api        Tests de integración del API.
#   make prod-up         Levanta TODO en producción vía Docker (dokploy).
# ============================================================================

SHELL := /bin/bash
DOKPLOY := deploy/dokploy/docker-compose.dokploy.yml
FLUTTER_API ?= http://localhost:4000

.PHONY: help setup install infra infra-down db db-reset gen-secrets \
        dev dev-api dev-admin dev-provider dev-worker dev-celery \
        mobile-patient mobile-provider build build-backend build-web test-api \
        prod-build prod-up prod-down prod-logs

help:
	@echo "CarePoint - objetivos make:"
	@echo "  setup           npm install + prisma generate + db push + deps Python"
	@echo "  infra           levanta Postgres + Redis (docker)"
	@echo "  infra-down      detiene Postgres + Redis"
	@echo "  db / db-reset   prisma db push / reset+seed de piloto"
	@echo "  gen-secrets     genera secretos fuertes"
	@echo "  dev             infra + API + Admin + Provider + worker + celery (paralelo)"
	@echo "  dev-api|dev-admin|dev-provider|dev-worker|dev-celery (individuales)"
	@echo "  mobile-patient|mobile-provider (Flutter; FLUTTER_API=$(FLUTTER_API))"
	@echo "  build|build-backend|build-web   compilaciones"
	@echo "  test-api        tests de integración del API"
	@echo "  prod-build|prod-up|prod-down|prod-logs   Docker (dokploy)"

# ---------- setup / infra ----------
setup: install db
	npm run setup:python-worker
	@echo "Setup completo. Arranca con: make dev"

install:
	npm install
	npm run prisma:generate

infra:
	docker compose up -d postgres redis

infra-down:
	docker compose down

db:
	npm run db:push

db-reset:
	npm run db:reset:pilot

gen-secrets:
	npm run gen:secrets

# ---------- dev ----------
# Levanta todo en paralelo y espera; Ctrl-C detiene todos (bash/WSL/Git Bash).
dev: infra
	@echo "Levantando API, Admin, Provider, PyWorker y Celery (Ctrl-C para parar)..."
	@trap 'kill 0' INT TERM; \
	npm run dev:api & \
	npm run dev:admin & \
	npm run dev:provider & \
	npm run dev:python-worker & \
	npm run worker:python & \
	wait

dev-api:
	npm run dev:api
dev-admin:
	npm run dev:admin
dev-provider:
	npm run dev:provider
dev-worker:
	npm run dev:python-worker
dev-celery:
	npm run worker:python

mobile-patient:
	cd apps/mobile && flutter run --dart-define=API_BASE_URL=$(FLUTTER_API)
mobile-provider:
	cd apps/provider_mobile && flutter run --dart-define=API_BASE_URL=$(FLUTTER_API)

# ---------- build / test ----------
build:
	npm run build
build-backend:
	npm run build:backend
build-web:
	npm run build:web
test-api:
	npm run test:api

# ---------- producción (Docker / dokploy) ----------
prod-build:
	docker compose -f $(DOKPLOY) build
prod-up:
	docker compose -f $(DOKPLOY) up -d
prod-down:
	docker compose -f $(DOKPLOY) down
prod-logs:
	docker compose -f $(DOKPLOY) logs -f
