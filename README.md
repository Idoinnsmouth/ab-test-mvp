# A/B Test MVP

Small A/B testing dashboard built with Next.js App Router, tRPC, Prisma (SQLite) and shadcn/ui.

## Install & Run
Requirements: Node.js 20+, npm 10+, SQLite (bundled).

```bash
cd ab-test-mvp
npm install
npm run db:migrate
npm run dev    # http://localhost:3000
```

### Assignment service (Go)

The Next.js app now delegates sticky assignment decisions to the Go microservice in `micro-service/`.

```bash
cd ab-test-mvp/micro-service
ASSIGNMENTS_DATABASE_URL="file:../prisma/db.sqlite" PORT=8080 go run ./cmd/server
```

Update `.env` so `ASSIGNMENT_SERVICE_URL` points to the running service (default `http://localhost:8080`). Both apps share the same SQLite file, so variants/assignments stay in sync.

Production build:

```bash
npm run build
npm run start
```

### Docker / Compose

Spin up both the Next.js app and Go assignment service with a shared SQLite volume:

```bash
docker compose up --build
```

Services:

- `web`: Next.js + Prisma. Requires `DATABASE_URL=file:/data/db.sqlite` and `ASSIGNMENT_SERVICE_URL=http://assignment-service:8080`.
- `assignment-service`: Go microservice compiled from `micro-service/`, sharing the same SQLite file via `ASSIGNMENTS_DATABASE_URL=file:/data/db.sqlite`.

The compose file (at repo root) already wires these values and mounts the `sqlite_data` volume so both containers see the same DB. The web container still runs `prisma migrate deploy` on startup.

## Storage Choice

- SQLite keeps the stack lightweight and portable.
- Prisma schema enforces relations: Experiments → Variants/Assignments with cascades.
- Sticky assignments stored in a dedicated `Assignment` table; unique `(experimentId,userId)` ensures determinism.

## Assumptions

1. No authentication/authorization (single-tenant admin UI).
2. Experiments must have ≥2 variants; weights are integers 0–100.
3. Sticky assignment uses weighted random selection with persistence.
4. Dark theme UX via shadcn/ui components; no additional theming requirements.
5. Deploy target supports running Prisma migrations at startup (entrypoint handles this).

## Next Steps

1. Automated tests for cross-service assignment flow.
2. Seed script to create sample experiments/variants for demos.
3. Add roles with NextAuth (viewer/editor/admin)
4. Analytics (per-variant counts, conversion hooks).
5. Deployment recipe for Vercel/Fly.io with externalized SQLite or Turso.
