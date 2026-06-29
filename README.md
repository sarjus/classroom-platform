# ClassroomHub — Classroom Assignment Management Platform

A modern, full-featured alternative to GitHub Classroom built with Next.js 16, TypeScript, Prisma, and PostgreSQL. Designed for universities and coding bootcamps.

---

## Features

| Module | Description |
|--------|-------------|
| **Authentication** | GitHub OAuth, Google OAuth, Email/Password with JWT sessions |
| **Multi-Role RBAC** | Super Admin, Institution Admin, Faculty, Teaching Assistant, Student |
| **Classroom Management** | Create/archive classrooms, join codes, bulk enrollment |
| **Assignments** | Draft/Publish/Schedule, Markdown instructions, starter repo, deadline policies |
| **Git Integration** | Auto-create GitHub repos, copy starter code, set collaborators |
| **Autograding** | Docker sandbox, 8 languages, hidden test cases, every-push grading |
| **Manual Grading** | Rubric-based grading, inline feedback, grade release control |
| **Analytics** | Submission rates, grade distributions, commit frequency charts |
| **Leaderboard** | Student rankings by average grade |
| **Notifications** | In-app + email, per-event triggers |
| **Discussions** | Per-assignment Q&A with threaded replies |
| **Plagiarism Detection** | Repository similarity analysis |
| **Background Workers** | BullMQ job queues for autograding, notifications, repo setup |
| **Webhooks** | GitHub push webhooks trigger autograding automatically |

---

## Tech Stack

- **Frontend**: Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS v4, Recharts
- **Backend**: Next.js API Routes, Prisma ORM v7, PostgreSQL
- **Auth**: NextAuth.js v5 (GitHub, Google, Credentials)
- **Queue**: BullMQ + Redis
- **Storage**: S3-compatible (MinIO for local dev)
- **Deploy**: Docker, Docker Compose, Nginx, GitHub Actions CI/CD

---

## Quick Start

### Prerequisites

- Node.js 20+
- Docker & Docker Compose
- GitHub OAuth app credentials
- Google OAuth credentials (optional)

### 1. Clone & Install

```bash
git clone https://github.com/your-org/classroom-platform
cd classroom-platform
npm install
```

### 2. Start Infrastructure

```bash
# Start PostgreSQL, Redis, and MinIO
docker compose up postgres redis minio -d
```

### 3. Configure Environment

```bash
cp .env.local .env.local.example
# Edit .env.local with your values
```

Required variables:
```env
DATABASE_URL="postgresql://postgres:password@localhost:5432/classroom_platform"
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="your-secret-min-32-chars"
GITHUB_CLIENT_ID="your-github-oauth-app-client-id"
GITHUB_CLIENT_SECRET="your-github-oauth-app-secret"
```

### 4. Initialize Database

```bash
npm run db:push          # Push schema to database
npm run db:seed          # Seed with demo data
```

### 5. Start Development

```bash
# Terminal 1: Next.js app
npm run dev

# Terminal 2: Autograding worker
npm run worker:autograde

# Terminal 3: Notification worker
npm run worker:notifications

# Terminal 4: Repo setup worker (optional — needs GitHub token)
npm run worker:repos
```

Visit [http://localhost:3000](http://localhost:3000)

---

## Demo Credentials (after seeding)

| Role | Email | Password |
|------|-------|----------|
| Faculty | admin@techuniversity.edu | Admin1234! |
| TA | ta@techuniversity.edu | Admin1234! |
| Student | alice@student.edu | Student123! |
| Student | bob@student.edu | Student123! |

Classroom join code: **CS2026A**

---

## Project Structure

```
classroom-platform/
├── prisma/
│   ├── schema.prisma          # Database schema
│   ├── seed.ts                # Demo data seed
│   └── prisma.config.ts       # Prisma configuration
├── src/
│   ├── app/                   # Next.js App Router pages
│   │   ├── (auth)/            # Login, Register, Error pages
│   │   ├── dashboard/         # Main dashboard
│   │   ├── classrooms/        # Classroom management
│   │   ├── assignments/       # Assignment management
│   │   ├── submissions/       # Submission review & grading
│   │   ├── analytics/         # Analytics dashboards
│   │   ├── leaderboard/       # Student rankings
│   │   ├── notifications/     # Notification center
│   │   ├── settings/          # User settings
│   │   └── api/               # REST API routes
│   │       ├── auth/          # Authentication endpoints
│   │       ├── classrooms/    # Classroom CRUD
│   │       ├── assignments/   # Assignment CRUD
│   │       ├── submissions/   # Submission handling
│   │       ├── grades/        # Grading endpoints
│   │       ├── rubrics/       # Rubric management
│   │       ├── autograding/   # Autograding config
│   │       ├── analytics/     # Analytics data
│   │       ├── notifications/ # Notification management
│   │       └── webhooks/      # GitHub webhooks
│   ├── components/
│   │   ├── ui/                # Base UI components (shadcn style)
│   │   ├── layout/            # Sidebar, Header, AppLayout
│   │   ├── assignments/       # Assignment-specific components
│   │   ├── grading/           # Grade form component
│   │   ├── analytics/         # Chart components
│   │   ├── notifications/     # Notification components
│   │   ├── settings/          # Settings components
│   │   └── providers/         # Context providers
│   ├── lib/
│   │   ├── prisma.ts          # Prisma client singleton
│   │   ├── auth.ts            # NextAuth configuration
│   │   ├── redis.ts           # Redis client
│   │   ├── queue.ts           # BullMQ queue definitions
│   │   ├── github.ts          # GitHub API helpers
│   │   ├── email.ts           # Email sending utilities
│   │   ├── utils.ts           # Shared utilities
│   │   └── validations.ts     # Zod schemas
│   ├── workers/
│   │   ├── autograde.worker.ts    # Autograding job processor
│   │   ├── notification.worker.ts # Notification job processor
│   │   └── repo-setup.worker.ts   # GitHub repo creation worker
│   └── types/
│       └── next-auth.d.ts     # NextAuth type extensions
├── nginx/
│   └── nginx.conf             # Nginx reverse proxy config
├── .github/
│   └── workflows/
│       └── ci.yml             # CI/CD pipeline
├── Dockerfile
├── docker-compose.yml
└── README.md
```

---

## API Reference

### Authentication
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /api/auth/register | Register with email |
| POST | /api/auth/[...nextauth] | NextAuth handlers |

### Classrooms
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/classrooms | List user's classrooms |
| POST | /api/classrooms | Create classroom |
| GET | /api/classrooms/:id | Get classroom detail |
| PATCH | /api/classrooms/:id | Update classroom |
| DELETE | /api/classrooms/:id | Delete classroom |
| POST | /api/classrooms/join | Join via code |

### Assignments
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/assignments | List assignments |
| POST | /api/assignments | Create assignment |
| GET | /api/assignments/:id | Get assignment |
| PATCH | /api/assignments/:id | Update/publish |
| DELETE | /api/assignments/:id | Delete assignment |

### Submissions
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/submissions | List submissions |
| POST | /api/submissions | Accept assignment |

### Grades & Rubrics
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /api/grades | Create/update grade |
| POST | /api/rubrics | Create/update rubric |
| POST | /api/autograding/config | Configure autograding |

### Webhooks
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /api/webhooks/github | GitHub push webhook |

---

## GitHub Classroom Migration

This platform is a drop-in alternative to GitHub Classroom. Key differences:

| Feature | GitHub Classroom | ClassroomHub |
|---------|-----------------|--------------|
| Self-hosted | ❌ | ✅ |
| Multi-institution | ❌ | ✅ |
| Custom autograding | Limited | ✅ Full Docker |
| Analytics | Basic | ✅ Rich dashboards |
| LMS integration | Basic | ✅ REST API |
| Discussion | ❌ | ✅ Per-assignment |
| Plagiarism detection | ❌ | ✅ Built-in |

---

## Production Deployment

### Docker Compose (Recommended)

```bash
# Set production environment variables
cp .env.local .env.production

# Start all services
docker compose up -d

# Run database migrations
docker compose exec app npx prisma migrate deploy
```

### Manual

```bash
npm run build
npm run db:migrate:deploy
npm start
```

### GitHub Actions CI/CD

The included `.github/workflows/ci.yml` handles:
1. TypeScript type checking
2. ESLint linting
3. Test suite
4. Docker image build and push to GHCR
5. SSH deployment to production server

---

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| DATABASE_URL | ✅ | PostgreSQL connection string |
| NEXTAUTH_URL | ✅ | App base URL |
| NEXTAUTH_SECRET | ✅ | JWT secret (min 32 chars) |
| GITHUB_CLIENT_ID | ✅ | GitHub OAuth app client ID |
| GITHUB_CLIENT_SECRET | ✅ | GitHub OAuth app secret |
| GITHUB_TOKEN | For GitHub features | Personal access token |
| GOOGLE_CLIENT_ID | Optional | Google OAuth client ID |
| GOOGLE_CLIENT_SECRET | Optional | Google OAuth secret |
| REDIS_URL | ✅ | Redis connection URL |
| SMTP_HOST | For email | SMTP server host |
| SMTP_USER | For email | SMTP username |
| SMTP_PASS | For email | SMTP password |
| S3_ENDPOINT | For file storage | S3-compatible endpoint |
| S3_ACCESS_KEY | For file storage | S3 access key |
| S3_SECRET_KEY | For file storage | S3 secret key |

---

## License

MIT
