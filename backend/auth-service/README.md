# auth-service

Dedicated Java (Spring Boot) Authentication Server. Contains **only**:
login, logout, JWT issuance (RS256) + validation, refresh tokens (rotated,
stored hashed), user management, role/permission management (RBAC),
password encryption (BCrypt), and audit logging.

No business logic lives here — see `docs/ARCHITECTURE.md`.

## Endpoints

| Method | Path                      | Auth           | Purpose                              |
|--------|---------------------------|----------------|---------------------------------------|
| POST   | `/auth/login`              | public          | username/password -> access + refresh token |
| POST   | `/auth/refresh`             | public (token in body) | rotate refresh token, issue new access token |
| POST   | `/auth/logout`               | Bearer          | revoke a refresh token                 |
| GET    | `/.well-known/jwks.json`      | public          | RSA public key, for local JWT validation by business-service |
| POST   | `/api/users`                    | ADMIN           | create a user                          |
| GET    | `/api/users`                     | ADMIN           | list users                             |
| GET    | `/api/users/{id}`                 | ADMIN           | get a user                             |
| DELETE | `/api/users/{id}`                   | ADMIN           | disable a user                         |

## Run locally

```bash
# from repo root
mvn -pl backend/common -am install
mvn -pl backend/auth-service spring-boot:run
```

Needs Postgres reachable per `application.yml` (`DB_HOST`/`DB_PORT`/`DB_NAME`/
`DB_USER`/`DB_PASSWORD`, defaults point at `localhost:5432/ams_auth`).
Flyway creates the schema and seeds RBAC data (`V1__init_auth.sql`,
`V2__seed_rbac.sql`) — including permissions matching what
`business-service`'s routers require (`receiving:read`, `receiving:write`,
`returns:read`, `returns:write`) and three roles (`ADMIN`,
`WAREHOUSE_OPERATOR`, `RETURNS_CLERK`).

**Dev-only seed user:** `admin` / `ChangeMe123!` — rotate or delete this
before using any shared/deployed environment.

**Note:** this sandbox could only reach npm/PyPI/GitHub registries, not
Maven Central, so `mvn clean install` has not actually been run against
this module — same caveat the original repo's README carried. Run it first
in your IDE/CI; the pattern is applied consistently with the original
project's Spring Boot conventions, so any failure is most likely a small
typo, not a structural issue.

## Signing keys

`src/main/resources/keys/dev-{private,public}.pem` is a throwaway RSA
keypair generated for local development only — **never use it outside
local dev.** In every other environment, `JWT_PRIVATE_KEY_PATH` /
`JWT_PUBLIC_KEY_PATH` point at a Kubernetes-mounted secret (see
`deploy/k8s/base/auth-secrets.yaml`).

## How the Python business-service trusts this service

1. `business-service` fetches `GET /.well-known/jwks.json` once, caches it
   for `jwks_cache_ttl_seconds` (default 300s).
2. Every incoming request's JWT is verified against the cached public key
   **locally** — no call back into `auth-service` per request.
3. `roles` and `permissions` claims embedded in the token are what
   `require_permission(...)` checks — see
   `backend/business-service/app/security/dependencies.py`.
