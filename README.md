# Finance Dashboard Backend

A production-ready **NestJS** backend for a role-based finance dashboard. Built with TypeScript strict mode, Prisma ORM, PostgreSQL, Redis caching, JWT auth, and full OpenAPI documentation.

---

## Table of Contents

- [Architecture Overview](#architecture-overview)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Role-Based Access Control](#role-based-access-control)
- [Quick Start](#quick-start)
- [Environment Variables](#environment-variables)
- [API Reference](#api-reference)
- [Running Tests](#running-tests)
- [Docker Deployment](#docker-deployment)
- [Design Decisions & Assumptions](#design-decisions--assumptions)

---

## Architecture Overview

```
Request
  │
  ▼
Helmet / CORS / Rate Limiter (global middleware)
  │
  ▼
RequestIdInterceptor   ← attaches X-Request-Id to every request/response
  │
  ▼
JwtAuthGuard           ← validates Bearer token (skips @Public() routes)
  │
  ▼
ActiveUserGuard        ← rejects INACTIVE accounts
  │
  ▼
RolesGuard             ← enforces @Roles(...) decorator
  │
  ▼
Controller             ← thin layer, delegates to Service
  │
  ▼
Service                ← business logic, access scoping, ownership checks
  │
  ▼
Repository             ← all Prisma queries isolated here
  │
  ▼
PrismaService          ← single shared DB connection (global module)
  │
  ▼
PostgreSQL

TransformInterceptor   ← wraps all success responses: { success, data, timestamp }
GlobalExceptionFilter  ← catches ALL errors, formats uniformly, never leaks internals
```

---

## Tech Stack

| Concern | Technology |
|---|---|
| Framework | NestJS 10, TypeScript (strict) |
| ORM | Prisma 5 |
| Database | PostgreSQL 16 |
| Cache | Redis 7 via `cache-manager-redis-yet` |
| Auth | JWT (`@nestjs/jwt`, `passport-jwt`, `passport-local`) |
| Validation | `class-validator` + `class-transformer` |
| Logging | `nestjs-pino` (structured JSON + pretty-print in dev) |
| Documentation | `@nestjs/swagger` (OpenAPI 3) |
| Security | `helmet`, `@nestjs/throttler`, CORS |
| Testing | Jest (unit + E2E), Supertest |
| Containerisation | Docker (multi-stage), Docker Compose |

---

## Project Structure

```
src/
├── common/
│   ├── database/
│   │   ├── prisma.module.ts        # Global Prisma module
│   │   └── prisma.service.ts       # Prisma client wrapper
│   ├── decorators/
│   │   ├── current-user.decorator.ts
│   │   ├── public.decorator.ts     # @Public() — skip JWT guard
│   │   └── roles.decorator.ts      # @Roles(Role.ADMIN, ...)
│   ├── dto/
│   │   └── pagination.dto.ts       # Shared pagination + paginate()
│   ├── filters/
│   │   └── http-exception.filter.ts # Global error formatter
│   ├── guards/
│   │   ├── active-user.guard.ts    # Blocks INACTIVE accounts
│   │   ├── jwt-auth.guard.ts       # JWT validation (global)
│   │   └── roles.guard.ts          # RBAC enforcement (global)
│   └── interceptors/
│       ├── request-id.interceptor.ts
│       └── transform.interceptor.ts # { success, data, timestamp }
│
├── config/
│   ├── app.config.ts
│   ├── database.config.ts
│   ├── jwt.config.ts
│   └── redis.config.ts
│
├── modules/
│   ├── auth/
│   │   ├── dto/login.dto.ts
│   │   ├── strategies/
│   │   │   ├── jwt.strategy.ts
│   │   │   └── local.strategy.ts
│   │   ├── auth.controller.ts
│   │   ├── auth.module.ts
│   │   └── auth.service.ts
│   │
│   ├── dashboard/
│   │   ├── dto/dashboard-query.dto.ts
│   │   ├── dashboard.controller.ts
│   │   ├── dashboard.module.ts
│   │   └── dashboard.service.ts
│   │
│   ├── health/
│   │   ├── health.controller.ts
│   │   └── health.module.ts
│   │
│   ├── transactions/
│   │   ├── dto/
│   │   │   ├── create-transaction.dto.ts
│   │   │   ├── transaction-query.dto.ts
│   │   │   └── update-transaction.dto.ts
│   │   ├── transactions.controller.ts
│   │   ├── transactions.module.ts
│   │   ├── transactions.repository.ts
│   │   └── transactions.service.ts
│   │
│   └── users/
│       ├── dto/
│       │   ├── create-user.dto.ts
│       │   ├── update-user.dto.ts
│       │   └── user-query.dto.ts
│       ├── users.controller.ts
│       ├── users.module.ts
│       ├── users.repository.ts
│       └── users.service.ts
│
├── app.module.ts
└── main.ts

prisma/
├── schema.prisma
└── seed.ts

test/
├── auth.e2e-spec.ts
└── jest-e2e.json
```

---

## Role-Based Access Control

| Endpoint | VIEWER | ANALYST | ADMIN |
|---|:---:|:---:|:---:|
| `POST /auth/login` | ✅ | ✅ | ✅ |
| `GET /auth/profile` | ✅ | ✅ | ✅ |
| `POST /users` | ❌ | ❌ | ✅ |
| `GET /users` | ❌ | ❌ | ✅ |
| `GET /users/:id` | ❌ | ❌ | ✅ |
| `PATCH /users/:id` | ❌ | ❌ | ✅ |
| `DELETE /users/:id` | ❌ | ❌ | ✅ |
| `POST /transactions` | ❌ | ❌ | ✅ |
| `GET /transactions` | ❌ | ✅ | ✅ |
| `GET /transactions/:id` | ❌ | ✅ | ✅ |
| `PATCH /transactions/:id` | ❌ | ❌ | ✅ |
| `DELETE /transactions/:id` | ❌ | ❌ | ✅ |
| `GET /dashboard/overview` | ✅ | ✅ | ✅ |
| `GET /dashboard/summary` | ✅ | ✅ | ✅ |
| `GET /dashboard/recent` | ✅ | ✅ | ✅ |
| `GET /dashboard/categories` | ❌ | ✅ | ✅ |
| `GET /dashboard/trends` | ❌ | ✅ | ✅ |

> **Policy summary:**
> - **VIEWER**: can only view dashboard data.
> - **ANALYST**: can view transaction records and dashboard insights.
> - **ADMIN**: can create, update, and manage transaction records and users.

---

## Quick Start

### Prerequisites

- Node.js 20+
- PostgreSQL 14+ running locally (or use Docker Compose)
- Redis 6+ running locally (or use Docker Compose)

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment

```bash
cp .env.example .env
# Edit .env — set DATABASE_URL, JWT_SECRET, JWT_REFRESH_SECRET at minimum
```

### 3. Run database migrations + seed

```bash
npm run prisma:migrate        # Apply migrations
npm run prisma:seed           # Seed with 3 test users + 50 sample transactions
```

### 4. Start in development mode

```bash
npm run start:dev
```

The API is available at `http://localhost:3000/api/v1`
Swagger UI is at `http://localhost:3000/api/docs`

---

## Environment Variables

| Variable | Required | Default | Description |
|---|:---:|---|---|
| `NODE_ENV` | | `development` | `development` / `production` / `test` |
| `PORT` | | `3000` | HTTP port |
| `APP_NAME` | ✅ | — | Application name |
| `DATABASE_URL` | ✅ | — | PostgreSQL connection string |
| `JWT_SECRET` | ✅ | — | Min 32 chars |
| `JWT_EXPIRES_IN` | | `7d` | Access token TTL |
| `JWT_REFRESH_SECRET` | ✅ | — | Min 32 chars |
| `JWT_REFRESH_EXPIRES_IN` | | `30d` | Refresh token TTL |
| `REDIS_HOST` | | `localhost` | Redis host |
| `REDIS_PORT` | | `6379` | Redis port |
| `REDIS_USERNAME` | | `` | Redis username (empty = no auth) |
| `REDIS_PASSWORD` | | `` | Redis password (empty = no auth) |
| `REDIS_TTL` | | `300` | Default cache TTL in seconds |
| `CORS_ORIGINS` | ✅ | — | Comma-separated allowed origins |
| `THROTTLE_TTL` | | `60` | Rate limit window in seconds |
| `THROTTLE_LIMIT` | | `100` | Max requests per window |
| `BCRYPT_ROUNDS` | | `12` | bcrypt salt rounds |

---

## API Reference

All responses are wrapped in the standard envelope:

```json
{
  "success": true,
  "data": { ... },
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

All error responses follow:

```json
{
  "statusCode": 400,
  "error": "Bad Request",
  "message": ["email must be an email"],
  "timestamp": "2024-01-15T10:30:00.000Z",
  "path": "/api/v1/users",
  "requestId": "a1b2c3d4-..."
}
```

### Auth

```
POST /api/v1/auth/login       — Obtain JWT (public)
GET  /api/v1/auth/profile     — Get current user (authenticated)
```

### Users

```
POST   /api/v1/users          — Create user         [ADMIN]
GET    /api/v1/users          — List users           [ADMIN]
GET    /api/v1/users/:id      — Get user by ID       [ADMIN]
PATCH  /api/v1/users/:id      — Update user          [ADMIN]
DELETE /api/v1/users/:id      — Soft-delete user     [ADMIN]
```

**List query params:** `page`, `limit`, `role`, `status`, `search`

### Transactions

```
POST   /api/v1/transactions        — Create transaction  [ADMIN]
GET    /api/v1/transactions        — List transactions   [ANALYST, ADMIN]
GET    /api/v1/transactions/:id    — Get by ID           [ANALYST, ADMIN]
PATCH  /api/v1/transactions/:id    — Update              [ADMIN]
DELETE /api/v1/transactions/:id    — Soft-delete         [ADMIN]
```

**List query params:** `page`, `limit`, `type`, `category`, `dateFrom`, `dateTo`, `amountMin`, `amountMax`, `userId`

### Dashboard

```
GET /api/v1/dashboard/overview    — Full dashboard in one call   [All roles]
GET /api/v1/dashboard/summary     — Income/expense totals        [All roles]
GET /api/v1/dashboard/recent      — Recent activity              [All roles]
GET /api/v1/dashboard/categories  — Category breakdown           [ANALYST, ADMIN]
GET /api/v1/dashboard/trends      — Monthly trends               [ANALYST, ADMIN]
```

**Query params:** `dateFrom`, `dateTo`, `userId` (Admin/Analyst), `trendMonths`

### Health

```
GET /api/v1/health    — Liveness check (public, no auth)
```

---

## Running Tests

### Unit tests

```bash
npm run test              # Run all unit tests
npm run test:cov          # With coverage report
npm run test:watch        # Watch mode
```

### E2E tests

```bash
# Requires a running test database
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/finance_test npm run test:e2e
```

---

## Docker Deployment

### Production (single command)

```bash
docker compose up -d
```

This starts:
- `finance_app` on port 3000
- `finance_postgres` on port 5432
- `finance_redis` on port 6379

### Development with hot reload

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml up
```

### With Adminer (DB GUI)

```bash
docker compose --profile dev up -d
# Adminer available at http://localhost:8080
```

### Seed inside container

```bash
docker compose exec app npx ts-node prisma/seed.ts
```

---

## Design Decisions & Assumptions

### Soft Deletes
All `DELETE` operations set `deletedAt` timestamp rather than hard deleting. Every query filters `deletedAt: null`. This preserves audit trails and foreign key integrity.

### Scoped Data Access
Read access is role-gated at the controller layer and filtered in the service/repository:
- VIEWERs are restricted to dashboard endpoints only
- ANALYSTs/ADMINs can query transaction records
- `userId` remains available for record filtering where permitted

This keeps role intent explicit in both metadata and query behavior.

### Password Validation
Passwords must contain uppercase, lowercase, a digit, and a special character (enforced via regex in DTO). bcrypt rounds are configurable (default 12).

### Transaction Ownership vs Role
The `ANALYST` role is read-only for records and insights. All record mutations (`create`, `update`, `delete`) and user management are reserved for `ADMIN`.

### Redis Cache Strategy
Dashboard endpoints use `CacheInterceptor` with per-route TTLs:
- `/recent` — 30s (high churn)
- `/summary` — 60s
- `/categories` — 120s (insights)
- `/trends` — 300s (insights, slow-moving aggregates)

Cache is keyed by the full request URL so different query parameters produce independent cache entries.

### Monthly Trends via Raw SQL
`getMonthlyTrends` uses a raw Prisma query to leverage PostgreSQL's `EXTRACT()` for efficient date grouping, which Prisma's query builder does not natively support without multiple round trips.

### No Refresh Token Endpoint
Refresh token rotation was omitted for scope reasons. The `JWT_REFRESH_SECRET` config variable is included and the groundwork is laid (separate secret, separate expiry) so a `/auth/refresh` endpoint can be added without schema changes.

### Validation
`whitelist: true` and `forbidNonWhitelisted: true` are set globally. Any request with properties not declared in the DTO will be rejected with HTTP 400, preventing mass-assignment attacks.
