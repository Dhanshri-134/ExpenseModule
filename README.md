This is the production Next.js ERP frontend for ACM development.

## Getting Started

### Environment

Create `apps/web/.env.local` from `apps/web/.env.example`.

Supabase Auth setup notes: `apps/web/Documentation/AUTH_SETUP.md`.

Run the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Engineering Commands

```bash
npm run lint
npm run build
npm run check
npm run perf:baseline
```

`npm run perf:baseline` expects an existing production build and reads `.next/build-manifest.json`.

## Governance

Architecture and performance guardrails live in:

- `apps/web/Documentation/ENGINEERING_GOVERNANCE.md`

These rules are intentionally compatibility-first to protect live routes, workflows, and financial behavior while the codebase continues its incremental migration.
