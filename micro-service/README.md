# Assignment Micro-service (Go)

This directory contains a tiny Go HTTP service that exposes two endpoints:

- `GET /health` – quick readiness/liveness check.
- `POST /assign` – deterministic variant selection for a `(userId, experimentId)` pair backed by the Prisma SQLite database.

Assignments are persisted alongside the rest of the app data, so both the Go service and the Next.js app read the same sticky choices.

## Layout

```
micro-service/
├── cmd/server/main.go          # wires config + HTTP server
├── internal/assignments        # deterministic sticky assignment logic
├── internal/httpserver         # JSON handlers, routing, persistence wiring
└── internal/storage            # thin Prisma-compatible SQLite access
```

## Running locally

```bash
cd ab-test-mvp/micro-service
ASSIGNMENTS_DATABASE_URL="file:../prisma/db.sqlite" PORT=8080 go run ./cmd/server
```

The DSN must point to the same SQLite file Prisma uses; when running from this directory the relative path above matches the default `DATABASE_URL`.

## Request example

```bash
curl -X POST http://localhost:8080/assign \
  -H "Content-Type: application/json" \
  -d '{
        "experimentId": "experiment_a",
        "userId": "user-123"
      }'
```

Response:

```json
{
  "experimentId": "experiment_a",
  "userId": "user-123",
  "variantKey": "A"
}
```
