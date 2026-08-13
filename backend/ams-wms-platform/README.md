# AMS/WMS Platform — Python Business Backend Migration

Enterprise redesign of the original React + Java Spring Boot (DDD/Clean
Architecture) platform. Java is now a **dedicated authentication server
only**; every business module runs on a **Python/FastAPI backend**.

**Start here:**
- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — diagrams (overall,
  package, sequence, deployment, auth flow, business flow, database flow,
  Kafka flow)
- [`docs/MIGRATION_NOTES.md`](docs/MIGRATION_NOTES.md) — exactly what was
  ported, what was a placeholder in the source and stayed a documented
  placeholder, and every architectural decision made along the way

## Layout

```
backend/
  auth-service/       Java/Spring Boot — login, JWT, RBAC, user mgmt, audit. No business logic.
  business-service/    Python/FastAPI — every business module (see its own README)
  common/                Trimmed Java library shared by auth-service only
frontend/                React/Vite/TypeScript — unchanged in spirit, now calls two backends
deploy/
  docker/                 otel-collector + Prometheus configs used by docker-compose
  k8s/                     Plain Kubernetes manifests (base + dev overlay via Kustomize)
  helm/ams-wms/             Helm chart covering the same deployment
docs/                    Architecture diagrams + migration notes
docker-compose.yml         Full local stack: 2× Postgres, Kafka (KRaft), Redis,
                            auth-service, business-service, frontend, Prometheus, Grafana, OTel
pom.xml                     Root Maven parent — now only builds common + auth-service
```

## Run everything locally

```bash
docker compose up --build
```

Then:
- Frontend: http://localhost:5173 (dev seed login: `admin` / see
  `backend/auth-service/README.md` for the password)
- business-service docs: http://localhost:8000/docs
- auth-service actuator: http://localhost:8080/actuator/health
- Grafana: http://localhost:3000 (admin/admin)

Each service also has its own README with instructions to run it standalone
outside Docker (`backend/auth-service/README.md`,
`backend/business-service/README.md`).

## What's been verified in this sandbox

- Every Python file in `business-service` compiles (`py_compile`) and the
  FastAPI app assembles with all three module routers registered
  (`/api/receiving/grn`, `/api/returns`, `/webhooks/events`)
- Domain unit tests pass (6/6) — pure business-rule tests, no I/O
- **Full integration test against a real PostgreSQL 16 instance**:
  Alembic migrations (0001–0004) apply cleanly; `ConfirmGrnUseCase` and
  `CreateReturnUseCase` run end-to-end through the Unit of Work → SQLAlchemy
  repository → outbox pattern, confirmed by querying `outbox_event`
  directly; the over-quantity business rule ported from the Java
  `ReceiptLine` correctly rejects an invalid receipt
- API contract preservation verified: `ConfirmGrnRequest` parses camelCase
  (`poId`, `itemCode`) exactly as the original Java DTOs serialized, and
  responses serialize back to camelCase
- Frontend: `tsc -b` and `vite build` both succeed with zero errors

**Not verified in this sandbox** (network restrictions — only PyPI/npm/
GitHub-adjacent registries were reachable, not Maven Central): the Java
`auth-service` Maven build. The code follows the same Spring Boot
conventions as the original repository; compile it in your own environment
or CI before deploying. Kafka/Redis integration (vs. just Postgres) was
also not exercised end-to-end here — `docker compose up` is the fastest way
to verify that locally.
