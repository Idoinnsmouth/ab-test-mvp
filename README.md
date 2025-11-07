# A/B Test MVP

Small A/B testing dashboard built with Next.js App Router, tRPC, Prisma (SQLite) and shadcn/ui.

## Install & Run
Requirements: Node.js 20+, npm 10+, SQLite (bundled).

```bash
cd ab-test-mvp
npm install
npm run dev    # http://localhost:3000
```

Production build:

```bash
npm run build
npm run start
```

### Docker

```bash
docker build -t ab-test-mvp .
docker run --rm -p 3000:3000 --name ab-test-mvp ab-test-mvp
```

The entrypoint runs `prisma migrate deploy` before `next start`.
To persist the SQLite DB, mount a volume and override `DATABASE_URL`, e.g.

```
docker run --rm -p 3000:3000 \
  -v $(pwd)/data:/data \
  -e DATABASE_URL=file:/data/db.sqlite \
  ab-test-mvp
```

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

1. Go microservice for assignment logic
2. Automated tests for assignment logic
3. Seed script to create sample experiments/variants for demos.
4. Add roles with NextAuth (viewer/editor/admin)
5. Analytics (per-variant counts, conversion hooks).
6. Deployment recipe for Vercel/Fly.io with externalized SQLite or Turso.
