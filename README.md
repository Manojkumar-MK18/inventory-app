# POS & Inventory (multi-business)

Multi-tenant POS + inventory for small Indian retail shops. Next.js (App Router) +
MongoDB Atlas + Mongoose. See the business guide for the full plan.

## The one rule

`app/` and `actions/` NEVER query the DB directly. They go through `repositories/`,
which inject `businessId` from the server session. `models/plugins/tenant.ts` throws
if any query runs without `businessId`. Three walls between Shop A and Shop B.

## Layers

```
app/          routes (UI + server), grouped (auth) public / (app) protected
actions/      Server Actions — session check -> Zod -> role -> repo (thin)
repositories/ ONLY place that touches the DB; injects businessId
models/       Mongoose schemas (+ tenant plugin)
lib/          db, money (paise), tax (GST), fy (IST), session (Ctx)
schemas/      Zod — shared client + server
tests/        tax + tenant-isolation (never skip these)
```

## Money & GST invariants

- All money is **integer paise**. Never floats. (`lib/money.ts`)
- Tax rounded **per line** (half up), then total rounded to nearest rupee. (`lib/tax.ts`)
- FY computed from **IST** date, not UTC. (`lib/fy.ts`)
- Server computes all prices/tax — client sends only product IDs + qty.

## Getting started

```bash
npm install
cp .env.example .env.local      # fill MONGODB_URI, AUTH_SECRET, SMTP_*
npm test                        # tax + money + fy tests (no DB needed)
npm run dev
```

## Status

Scaffolded: Days 1–3 foundation + the sale transaction (saleRepo). Next: Auth.js
wiring (`lib/session.ts` getContext), the POS screen, and the invoice PDF.
See "Where to start" in the handover notes.
