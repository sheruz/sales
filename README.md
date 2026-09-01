# AI-Powered Client Acquisition & Sales Automation Platform

Internal SaaS platform for finding, managing, researching, contacting, qualifying, and converting potential clients for software development services.

## Tech Stack

- **Frontend:** Next.js 16, TypeScript, Tailwind CSS v4, shadcn/ui
- **Backend:** Next.js Route Handlers, Service Layer Architecture
- **Database:** PostgreSQL with Prisma ORM
- **Auth:** Session-based with HTTP-only cookies, RBAC
- **AI:** Provider abstraction (OpenAI / Anthropic)
- **Infrastructure:** Docker, Docker Compose

## Prerequisites

- Node.js 22+
- Docker & Docker Compose (for PostgreSQL)
- npm

## Quick Start

### 1. Clone and install

```bash
cd sales-platform
npm install
```

### 2. Environment setup

```bash
cp .env.example .env
```

Edit `.env` with your configuration. At minimum, set:

- `DATABASE_URL`
- `JWT_SECRET` (generate with `openssl rand -base64 32`)

### 3. Start PostgreSQL

```bash
npm run docker:up
```

### 4. Database setup

```bash
npm run db:push
npm run db:seed
```

### 5. Run development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## Default Seed Users

| Email | Role | Password |
|-------|------|----------|
| admin@salesplatform.local | Admin | Admin@123 |
| manager@salesplatform.local | Sales Manager | Admin@123 |
| rep@salesplatform.local | Sales Representative | Admin@123 |

## Environment Variables

See `.env.example` for the full list. Key variables:

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string |
| `JWT_SECRET` | Secret for session tokens (min 32 chars) |
| `AI_PROVIDER` | `openai` or `anthropic` |
| `OPENAI_API_KEY` | OpenAI API key |
| `SMTP_*` | Email SMTP configuration |
| `REDIS_URL` | Optional Redis for job queue |
| `ENCRYPTION_KEY` | For encrypting stored credentials |

## Docker

### Development (PostgreSQL only)

```bash
docker compose up -d postgres
```

### Production (full stack)

```bash
docker compose --profile production up -d
```

### With Redis (for BullMQ jobs)

```bash
docker compose --profile with-redis up -d
```

## Database Commands

```bash
npm run db:generate    # Generate Prisma client
npm run db:push        # Push schema to database
npm run db:migrate     # Create and run migrations
npm run db:seed        # Seed database
npm run db:studio      # Open Prisma Studio
npm run db:reset       # Reset database
```

## Project Structure

```
src/
├── app/                    # Next.js App Router
│   ├── (auth)/             # Auth pages (login, register)
│   ├── dashboard/          # Protected dashboard routes
│   └── api/                # API route handlers
├── components/
│   ├── ui/                 # shadcn/ui components
│   ├── dashboard/          # Dashboard-specific components
│   ├── leads/              # Lead management components
│   ├── campaigns/          # Campaign components
│   ├── conversations/      # Conversation components
│   └── deals/              # Pipeline/deal components
├── lib/
│   ├── db/                 # Database client
│   ├── auth/               # Authentication utilities
│   ├── ai/                 # AI provider abstraction
│   ├── email/              # Email provider abstraction
│   ├── config/             # Environment configuration
│   └── api/                # API utilities
├── services/               # Business logic layer
├── jobs/                   # Background job handlers
├── types/                  # Shared TypeScript types
├── hooks/                  # React hooks
└── utils/                  # Utility functions
```

## Development Phases

See `docs/PROGRESS.md` for implementation status and remaining work.

## Production Build

```bash
npm run build
npm start
```

## License
