# Workora Local API contract

Base URL: `http://localhost:3010` (same origin at `http://localhost:3000` via Next rewrites).

Auth: Better Auth cookies on `/api/auth/*`. Client components call relative `/api/...` and the proxy carries cookies. Server components import from `@/lib/api` (`api()`, `getSession()`).

Response envelope for `/api/v1/*`:
```json
{ "success": true,  "message": "...", "data": <payload> }
{ "success": false, "message": "...", "error": { "code": "...", "details": { } } }
```

Known working routes (tested 2026-11-08):

## Auth (Better Auth)
- POST /api/auth/sign-up/email        { name, email, password } -> 200 ok
- POST /api/auth/sign-in/email        { email, password }        -> 200 ok (sets session cookie)
- POST /api/auth/sign-out             -> 200
- GET  /api/auth/get-session          -> { user } | null
- POST /api/auth/forget-password       { email }
- POST /api/auth/reset-password       { token, newPassword }
- POST /api/auth/change-password      { currentPassword, newPassword } (authed)
- GET  /api/auth/get-session?         = include session cookie

## Users
- GET    /api/v1/users/me              -> { user }
- PATCH  /api/v1/users/me              -> { name?, image? }
- PATCH  /api/v1/users/me/account-type -> { accountType: "freelancer" | "client" }
- GET    /api/v1/users/:id             -> { user }

## Catalog (public)
- GET /api/v1/categories               -> active launch-focus categories only
- GET /api/v1/skills                   -> { skills[{id,slug,name}] }
- GET /api/v1/skills/:slug             -> { }
- GET /api/v1/subscription-plans       -> { plans[{id,code,name,audience,price,interval,features,is_highlighted,is_active,sort_order}] }
- GET /api/v1/freelancers              -> query: q, category (launch category slug), availability, min_rate, max_rate, sort (recommended|rating|rate_asc|rate_desc|newest), page, perPage; recommended favors curated, verified, confidence-adjusted ratings, completed work and response time
- GET /api/v1/freelancers/:id          (public profile – not yet implemented; use /users/:id instead)

## Projects (public list + ownership)
- GET  /api/v1/projects                -> public list (open only)
- GET  /api/v1/projects/:id
- POST /api/v1/projects                -> client only; new projects must use a launch-focus category
- PUT  /api/v1/projects/:id            -> owner client only; partial update
- POST /api/v1/projects/:id/publish    -> owner client only
- POST /api/v1/projects/:id/close      -> owner client or admin
- POST /api/v1/projects/:id/save       -> toggle saved
- DELETE /api/v1/projects/:id/save     -> remove saved
- POST /api/v1/projects/:id/skills     -> { skillIds: string[] }
- GET  /api/v1/users/me/saved-projects -> list saved

## Proposals (API routes – authenticated)
- POST  /api/v1/projects/:id/proposals  -> freelancer only; { coverLetter, bidType, bidAmountMinor, durationDays }
- GET   /api/v1/proposals/me            -> ?status, ?sort=newest|oldest, ?page&?perPage
- GET   /api/v1/proposals/:id
- DELETE /api/v1/proposals/:id          -> withdraw own (pending|shortlisted)
- POST  /api/v1/proposals/:id/shortlist -> client only (project owner)
- POST  /api/v1/proposals/:id/reject    -> client only
- POST  /api/v1/proposals/:id/accept    -> client only; creates contract, updates project -> in_progress
- GET   /api/v1/projects/:id/proposals  -> client only; paginated list

## Contracts
- GET    /api/v1/contracts              -> authed; paginated list of contracts where user is client OR freelancer
- GET    /api/v1/contracts/:id          -> participants only; includes milestones[]
- POST   /api/v1/contracts/:id/cancel   -> participants; { reason }
- POST   /api/v1/contracts/:id/complete -> client only; all milestones paid/cancelled

## Milestones
- POST   /api/v1/contracts/:contractId/milestones                -> client only; { title, description, amountMinor, dueDate?, sequencing? }
- GET    /api/v1/contracts/:contractId/milestones                -> participants
- POST   /api/v1/contracts/:contractId/milestones/:milestoneId/submit         -> freelancer; in_review
- POST   /api/v1/contracts/:contractId/milestones/:milestoneId/approve        -> client; transfers the funded Stripe charge to the freelancer's connected account (8% platform fee)
- POST   /api/v1/contracts/:contractId/milestones/:milestoneId/request-revision -> client; { note }
- GET    /api/v1/contracts/:contractId/milestones/:milestoneId/deliverables  -> participants

## Conversations / Messages
- POST   /api/v1/conversations          -> { participantIds: uuid[], contractId? }
- GET    /api/v1/conversations          -> list (last message preview, unread count)
- POST   /api/v1/conversations/:id/read -> mark read
- POST   /api/v1/conversations/:id/messages -> { body, attachments? }
- GET    /api/v1/conversations/:id/messages?page=&amp;perPage=
- DELETE /api/v1/conversations/:id/messages/:messageId -> sender only (tombstone)
- PATCH  /api/v1/conversations/:id/messages/:messageId -> sender only, 15-minute window

## Notifications
- GET  /api/v1/notifications            -> ?unread=true|1
- GET  /api/v1/notifications/unread-count
- POST /api/v1/notifications/mark-all-read
- POST /api/v1/notifications/:id/read
- DELETE /api/v1/notifications/:id
- DELETE /api/v1/notifications          -> delete all read

## Reviews
- POST  /api/v1/contracts/:contractId/reviews -> contract participant only; { rating 1-5, comment }
- GET   /api/v1/users/:id/reviews             -> public; { reviews, averageRating, total }
- POST  /api/v1/reviews/:id/report            -> { reason }
- DELETE /api/v1/reviews/:id                  -> author or admin
- GET    /api/v1/reviews/:id

## Payments
- POST   /api/v1/payments/initialize         -> client only; milestone-only; returns a hosted Stripe Checkout URL after validating the exact milestone amount and currency
- POST   /api/v1/payments/verify             -> { reference }; reads the caller's stored payment status, but does not confirm payment by itself
- POST   /api/v1/webhooks/payments           -> Stripe-signed webhook; marks milestones funded only after successful payment confirmation
- POST   /api/v1/payments/connect/onboarding -> freelancer only; { country: ISO 3166-1 alpha-2 code }; returns a Stripe Express onboarding link
- GET    /api/v1/payments/connect/status     -> freelancer's Stripe onboarding/payout status
- GET    /api/v1/payments/transactions       -> ?type, ?status, ?dateFrom, ?dateTo
- GET    /api/v1/payments/transactions/:id
- Direct card storage, subscriptions and top-ups are not supported by the real-money payment flow.

## Subscriptions (demo only)
- GET    /api/v1/subscription-plans
- POST   /api/v1/subscriptions          -> { planId, interval? }
- GET    /api/v1/subscriptions/me
- POST   /api/v1/subscriptions/:id/cancel
- GET    /api/v1/subscriptions/invoices
- GET    /api/v1/subscriptions/:id/invoices

## Verification
- POST   /api/v1/uploads/presign                 -> authenticated; verification scope returns a private upload URL and object key
- POST   /api/v1/verification-requests           -> freelancer only; { documentType, documentKey, documentName }
- POST   /api/v1/verification-requests/:id/document -> freelancer only; replace document after an admin requests more information
- GET    /api/v1/verification-requests/me
- GET    /api/v1/verification-requests           -> admin only
- GET    /api/v1/verification-requests/:id/document -> verification admin only; short-lived private download URL
- POST   /api/v1/verification-requests/:id/approve     -> admin
- POST   /api/v1/verification-requests/:id/reject      -> admin; { reason }
- POST   /api/v1/verification-requests/:id/request-info -> admin; { notes }
- GET    /api/v1/verification-requests/:id             -> admin

## Disputes
- POST   /api/v1/contracts/:id/disputes     -> participant only; { reason, details, amountMinor? }
- GET    /api/v1/disputes/me
- GET    /api/v1/disputes/:id               -> participant or admin
- POST   /api/v1/disputes/:id/evidence      -> { fileName, url, mimeType? }
- POST   /api/v1/disputes/:id/notes         -> admin only
- POST   /api/v1/disputes/:id/resolve       -> admin only; { outcome, resolution }
- POST   /api/v1/disputes/:id/withdraw      -> opener only

## Admin (all require admin accountType + admin.* permission)
- GET    /api/v1/admin/overview
- GET    /api/v1/admin/users           -> ?q, ?status
- POST   /api/v1/admin/users/:id/suspend
- POST   /api/v1/admin/users/:id/activate
- POST   /api/v1/admin/users/:id/restrict
- POST   /api/v1/admin/impersonate

## Reports (admin)
- GET    /api/v1/reports/users.csv
- GET    /api/v1/reports/transactions.csv
- GET    /api/v1/reports/contracts.csv

## Freelancers / Clients
- GET    /api/v1/freelancers           -> searchable list (see filters)
- GET    /api/v1/clients/:id
- PATCH  /api/v1/clients/me            -> { company_name, company_size, industry, about }

## Added 2026-11-08 — admin + me read endpoints
- GET /api/v1/users/me/projects?status=      -> caller's own projects (client), snake_case rows with category_name
- GET /api/v1/users/me/project-proposals     -> proposals received on caller's own projects (client), includes freelancer/project names
- GET /api/v1/users/me/reviews               -> reviews written BY caller, subject_name + contract_title
- GET /api/v1/users/me/portfolio             -> caller's portfolio_projects rows
- POST /api/v1/users/me/portfolio            -> { title, description?, tags?: string[], year?, project_url?, image_url? }
- PATCH /api/v1/users/me/portfolio/:id       -> partial update
- DELETE /api/v1/users/me/portfolio/:id
- PATCH /api/v1/freelancers/me               -> { headline?, location?, hourly_rate_minor?, availability?, response_time_hours? } (freelancer)
- GET /api/v1/admin/projects?status=&q=&categoryId=&page=&perPage=  -> all projects + category_name + client names
- GET /api/v1/admin/contracts?status=&q=     -> contracts + client/freelancer names + milestone tallies
- GET /api/v1/admin/transactions?type=&status=&q=&limit=  -> full ledger with user_name
- GET /api/v1/admin/disputes?status=         -> all disputes + names + contract title
- GET /api/v1/admin/reviews?q=&reported=true -> all reviews + reported flag
- GET /api/v1/admin/subscriptions            -> subscriptions + plan + user
- GET /api/v1/admin/categories               -> categories + projects_count + skills_count
- POST /api/v1/admin/categories              -> { slug, name, ... } — admin.moderation permission
- PATCH /api/v1/admin/categories/:id         -> { name?, description?, sort_order?, is_launch_focus?, launch_rank? } — admin.moderation
- PATCH /api/v1/admin/freelancers/:id/curation -> { is_featured, featured_rank? } — admin.users; controls curated placement
- GET /api/v1/admin/analytics/monthly?months=12 -> { months: [{ month, signups, projectsPosted, contractsStarted, volumeMinor }] }
- GET /api/v1/admin/users accepts accountType=freelancer|client|admin
