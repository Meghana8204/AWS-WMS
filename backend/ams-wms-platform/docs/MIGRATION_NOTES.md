# Migration notes

Source project: React + Spring Boot (Java), DDD/Clean Architecture, three
Maven modules with business logic (`warehouse-core`, `logistics-returns`,
`platform`) plus a shared `common` library implementing the outbox
pattern.

## What was actually implemented in the source (and therefore migrated)

| Java module.package | Python equivalent | Status |
|---|---|---|
| `warehouse-core` / `receiving` | `business-service/app/modules/receiving` | Fully ported: `GoodsReceiptNote`, `ReceiptLine`, `GoodsReceivedEvent`, `ConfirmGrnUseCase`, `GetGrnUseCase`, `GrnRepository` (+ SQLAlchemy impl), `GrnController` (+ FastAPI router) |
| `logistics-returns` / `returns` | `business-service/app/modules/returns` | Fully ported: `ReturnRequest`, `ReturnLine`, `ReturnRequestedEvent`, `CreateReturnUseCase`, `GetReturnUseCase`, repository + router |
| `platform` / `notification` | `business-service/app/modules/notification` | Fully ported. Transport changed: the original `EventWebhookController` (HTTP) is kept for backward compatibility, but the primary path is now a Kafka consumer (`app/workers/notification_consumer.py`) calling the same `RecordIncomingEventUseCase` |
| `common` (outbox pattern) | `business-service/app/events`, `app/kafka`, `app/workers/outbox_relay.py` | Ported and re-targeted: `OutboxEvent`/`OutboxRelay` kept, `HttpEventDeliveryClient` replaced by a Kafka producer per the target architecture |
| `common` (domain base classes) | `business-service/app/common/domain` | `AggregateRoot`, `DomainEvent`, `DomainRuleViolationException`, `NotFoundException` ported directly |
| — (no Java identity module existed) | `backend/auth-service` (new) | Built from scratch per the target architecture: login/refresh/logout, RS256 JWT + JWKS, RBAC, user management, audit log |

## What was NOT implemented in the source, and therefore not migrated

These were all empty `package-info.java` placeholders in the Java project
with no domain/application/infrastructure code — there was nothing to
translate. Each has a Python placeholder package with a `MIGRATION_NOTES.md`
describing intended scope and the exact four-layer pattern to follow,
consistent with `receiving`/`returns`/`notification`:

`quality`, `storage`, `assembly`, `dispatch`, `procurement`, `gate`,
`disposition`, `shipment`, `traceability`, `masterdata`, `erp`, `approval`.

Nothing was silently dropped: every placeholder from the source tree has a
corresponding placeholder package in `business-service/app/modules/`.

## Architectural decisions made during the migration

- **One business database, not one per module.** The source used one
  database per Maven module (`warehouse_core`, `logistics_returns`,
  `platform`) with an outbox table replicated in each. Consolidating into
  `business-service` (one Python deployable) means one `ams_business`
  database and one shared `outbox_event` table — still per-transaction
  atomic with each module's own writes, just no longer duplicated schema.
  If/when a module is split into its own microservice later, give it its
  own database and outbox table again; nothing about the pattern prevents
  that.
- **HTTP outbox delivery → Kafka.** The source's `HttpEventDeliveryClient`
  POSTed events to `platform`'s webhook. Per the target architecture, the
  outbox relay now publishes to Kafka topics (`app/kafka/producer.py`) and
  `notification` subscribes via a consumer group instead. The webhook
  endpoint is retained for compatibility, not removed.
- **JWT validated locally, not synchronously per request.** `business-
  service` fetches auth-service's JWKS once and caches it
  (`jwks_cache_ttl_seconds`, default 300s), re-fetching only on a key-id
  cache miss (covers key rotation). This was an explicit requirement, not
  something the source project had an equivalent of (it had no auth at
  all).
- **API contracts preserved via camelCase aliasing.** The Java DTOs
  (Jackson records) serialized as camelCase (`poId`, `itemCode`, `grnId`,
  ...). Pydantic defaults to the Python attribute name (snake_case), so
  `business-service`'s schemas use an `ApiModel` base
  (`app/common/api_model.py`) with a camelCase alias generator — the
  frontend's request/response shapes did not need to change.
- **Seed data preserved.** The original `V1__init_receiving.sql` Flyway
  seed (one purchase order, `PO-1001`, line `ITEM-A` × 100) is reproduced
  in Alembic migration `0001_init_receiving.py`, so the same manual test
  from the source README still works unchanged.

## Known gaps / follow-ups

- `procurement` is a placeholder, but `receiving` depends on a read-side
  `PurchaseOrder` snapshot today (seeded directly via migration). When
  `procurement` is built out, it should own and publish that data instead
  of it being seeded static rows.
- Auth-service's Maven build was not run in this sandbox (only npm/PyPI/
  GitHub-adjacent registries were reachable, not Maven Central) — same
  caveat the original repository's own README already carried for the
  Java build. Business-service's Python dependencies were not `pip
  install`-verified end-to-end either, for the same network reason.
- No CI pipeline was generated (out of scope of what was requested); add
  one before relying on this for production releases.
