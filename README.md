<div align="center">

# Workora

### Find your next great collaboration.

A full-stack freelance marketplace where clients can publish projects and connect with freelancers—from discovery and proposals to contracts, milestone delivery, and communication.

[![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19-149eca?logo=react)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178c6?logo=typescript)](https://www.typescriptlang.org/)
[![Fastify](https://img.shields.io/badge/API-Fastify-000000?logo=fastify)](https://fastify.dev/)

</div>

---

## About

Workora is a freelance marketplace built to support the end-to-end working relationship between clients and freelancers. Clients can list projects, review proposals, and manage contracts; freelancers can discover opportunities, submit proposals, and share work for review. The platform also includes messaging, notifications, reviews, verification workflows, and administrative tools.

The repository contains a **Next.js web application** and a separate **Fastify API**. The API contract is documented in [`docs/api-contract.md`](docs/api-contract.md).

> **Project status:** Workora is under active development. Payment and subscription flows include demo-mode behavior; do not treat demo transactions as real payments.

## Highlights

- **Two-sided marketplace:** client and freelancer account types, searchable freelancer listings, and project discovery.
- **Project workflow:** create, publish, update, close, and save projects; categorize work and associate skills.
- **Proposals and hiring:** submit proposals, shortlist or reject candidates, and accept a proposal to start a contract.
- **Contracts and milestones:** organize delivery into milestones, submit work, request revisions, and approve milestone completion.
- **Communication:** conversations, message history, unread counts, and notifications.
- **Profiles and trust:** freelancer and client profiles, reviews, portfolio entries, and freelancer verification requests.
- **Payments and plans:** payment methods, transaction history, subscriptions, and invoices, with demo-mode payment handling.
- **Operations:** admin views and workflows for users, projects, contracts, transactions, disputes, reviews, categories, and reports.
- **Typed validation:** TypeScript throughout, with Zod used by the API and frontend forms.

## Tech stack

| Area | Technologies |
| --- | --- |
| Web application | Next.js 16, React 19, TypeScript |
| Styling and UI | Tailwind CSS 4, Hugeicons, Sonner |
| Forms and validation | React Hook Form, Zod, `@hookform/resolvers` |
| Tables and charts | TanStack React Table, Recharts |
| API | Fastify 5, TypeScript, Zod |
| Authentication | Better Auth, cookie-based sessions |
| Database | PostgreSQL, Kysely; PGlite is available for local development |
| File storage | S3-compatible storage (optional; required for upload endpoints) |
| Integrations | Stripe, Paystack, Resend (configuration-dependent) |

## Repository layout

```text
.
├── apps/
│   └── api/                 # Fastify API, database, migrations, and tests
├── docs/
│   └── api-contract.md      # API routes, payloads, and response format
├── src/
│   ├── app/                 # Next.js routes and page layouts
│   ├── assets/              # Static and visual assets
│   ├── components/          # Shared UI components
│   └── lib/                 # Frontend utilities and API helpers
├── .env.example             # Frontend API proxy configuration
└── package.json             # Frontend scripts and dependencies
```

## Getting started

### Requirements

- Node.js **22 or later** (the API package specifies `>=22`)
- npm
- A PostgreSQL database for a persistent database setup, or PGlite for local development

### 1. Clone and install the web app

```bash
git clone https://github.com/shadrach-chukwukere/workora.git
cd workora
npm install
```

### 2. Configure and start the API

In a second terminal:

```bash
cd apps/api
npm install
cp .env.example .env
```

Edit `apps/api/.env` before starting. Configure a database and an `AUTH_SECRET`. For a local PGlite setup, use the PGlite options described in the environment file; for PostgreSQL, set `DATABASE_URL` to your database connection string. Keep real credentials out of version control.

Run the database migrations and start the API:

```bash
npm run migrate
npm run dev
```

The API listens on `http://localhost:3010` by default. See [`apps/api/.env.example`](apps/api/.env.example) for all available settings, including CORS, email, payments, and object storage.

### 3. Configure and start the web app

In another terminal, from the repository root:

```bash
cp .env.example .env.local
npm run dev
```

The frontend runs at [http://localhost:3000](http://localhost:3000). Its `/api/*` requests are proxied to the API using `API_URL` (default: `http://localhost:3010`).

### Optional API setup

The API package provides commands for seeding development data, creating an admin account, and running tests:

```bash
cd apps/api
npm run seed
npm run admin:create
npm test
```

Use these commands only after configuring the API environment and database. Review the command prompts and project configuration before creating privileged accounts.

## Useful commands

### Web app (repository root)

| Command | Description |
| --- | --- |
| `npm run dev` | Start the Next.js development server |
| `npm run build` | Build the web app for production |
| `npm run start` | Start the production web server |
| `npm run typecheck` | Run the TypeScript compiler without emitting files |

### API (`apps/api`)

| Command | Description |
| --- | --- |
| `npm run dev` | Start the API in watch mode |
| `npm run build` | Compile the API to `dist/` |
| `npm run start` | Start the compiled API |
| `npm run typecheck` | Type-check the API |
| `npm run migrate` | Apply database migrations |
| `npm run seed` | Load seed data |
| `npm test` | Run the API test suite |
| `npm run test:watch` | Run API tests in watch mode |
| `npm run admin:create` | Run the admin-account creation utility |

## API overview

The API base URL in local development is `http://localhost:3010`; the web app proxies API requests through its own origin. Most versioned endpoints use a consistent response envelope:

```json
{
  "success": true,
  "message": "...",
  "data": {}
}
```

The API contract documents authentication, users, freelancer discovery, projects, proposals, contracts, milestones, conversations, notifications, reviews, payments, subscriptions, verification, disputes, admin operations, and reports. Refer to [`docs/api-contract.md`](docs/api-contract.md) for routes, authorization notes, parameters, and payloads.

## Environment configuration

- **Web app:** copy `.env.example` to `.env.local`; set `API_URL` if the API is not running on the default local address.
- **API:** copy `apps/api/.env.example` to `apps/api/.env` and set values appropriate for your environment.
- **Secrets:** use strong, unique secrets outside local development. Never commit `.env` files, API keys, database passwords, or payment-provider secrets.
- **Optional integrations:** email, payment providers, and S3-compatible object storage can be configured independently. The API environment example describes which features remain unavailable when an integration is not configured.

## Development notes

- Authentication uses Better Auth session cookies. Frontend API calls should follow the proxy and helper patterns already used in the project.
- Payment routes include explicit demo-mode behavior. Configure and verify real payment integrations before any production use.
- The API test suite is available under `apps/api`; run it after backend changes.
- Check the API contract when changing endpoints so frontend and backend behavior stay aligned.

## Contributing

Contributions and feedback are welcome. A good contribution workflow is:

1. Open an issue describing the bug, proposal, or improvement.
2. Create a focused branch for your change.
3. Keep frontend and API contract changes in sync.
4. Run relevant type checks and API tests.
5. Open a pull request with a concise summary and testing notes.

Please avoid including secrets, private data, or real payment credentials in issues, logs, screenshots, and pull requests.

## License

No license is currently specified in this repository. Unless a license is added, standard copyright restrictions apply; please contact the repository owner before redistributing or reusing the code.

---

<div align="center">

Built with care for better client–freelancer collaboration.

</div>
