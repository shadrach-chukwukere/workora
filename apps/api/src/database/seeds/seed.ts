import type { Kysely } from "kysely"
import type { DB } from "../types.js";
import { hash } from "@node-rs/argon2";
import { sql } from "kysely";

/**
 * Deterministic seed for local development and integration tests. Idempotent: every insert
 * uses ON CONFLICT DO NOTHING. Not production data; integration tests invent their own rows.
 */
export async function seed(db: Kysely<DB>): Promise<void> {
  /* ------------------------------- permissions ------------------------------ */
  const permissions = [
    ["admin.access", "Open the admin console"],
    ["admin.users", "Manage users"],
    ["admin.moderation", "Moderate projects, listings and reviews"],
    ["admin.transactions", "Review financial records"],
    ["admin.verification", "Decide identity verification"],
    ["admin.disputes", "Resolve disputes"],
    ["admin.subscriptions", "Manage subscriptions and billing"],
    ["admin.reports", "Generate platform reports"],
    ["admin.settings", "Change platform settings"],
    ["admin.analytics", "View platform analytics"],
  ] as const;

  for (const [key, description] of permissions) {
    await sql`INSERT INTO permissions (key, description) VALUES (${key}, ${description}) ON CONFLICT (key) DO NOTHING`.execute(db);
  }

  const roles = [
    ["admin.owner", "Console owner", "Full access to every admin permission"],
    ["admin.trust", "Trust & safety", "Verification, disputes and moderation"],
    ["admin.finance", "Finance", "Transactions, subscriptions and reports"],
    ["client.standard", "Client", "Standard client access"],
    ["freelancer.standard", "Freelancer", "Standard freelancer access"],
  ] as const;

  for (const [key, name, description] of roles) {
    await sql`INSERT INTO roles (key, name, description) VALUES (${key}, ${name}, ${description}) ON CONFLICT (key) DO NOTHING`.execute(db);
  }

  /* --------------------------------- users --------------------------------- */
  const rhea = { id: "00000000-0000-4000-8000-0000000000a1", name: "Rhea Malhotra", email: "rhea@workora.example" };
  const amara = { id: "00000000-0000-4000-8000-0000000000a2", name: "Amara Okafor", email: "amara@workora.example" };
  const naomi = { id: "00000000-0000-4000-8000-0000000000a3", name: "Naomi Fields", email: "naomi@workora.example" };

  const users = [
    { ...rhea, accountType: "admin" as const },
    { ...amara, accountType: "freelancer" as const },
    { ...naomi, accountType: "client" as const },
  ];

  for (const u of users) {
    await sql`INSERT INTO users (id, name, email, email_verified, account_type) VALUES (${u.id}, ${u.name}, ${u.email}, true, ${u.accountType}) ON CONFLICT (id) DO NOTHING`.execute(db);
  }

  /* ------------------------- user-role bindings --------------------------- */
  const roleRows = await sql<{ id: string; key: string }>`SELECT id, key FROM roles`.execute(db).then((r) => r.rows);
  const roleId = (key: string): string => roleRows.find((r) => r.key === key)!.id as string;
  await sql`INSERT INTO user_roles (user_id, role_id) VALUES (${amara.id}, ${roleId("freelancer.standard")}) ON CONFLICT DO NOTHING`.execute(db);
  await sql`INSERT INTO user_roles (user_id, role_id) VALUES (${naomi.id}, ${roleId("client.standard")}) ON CONFLICT DO NOTHING`.execute(db);
  for (const role of ["admin.owner", "admin.trust", "admin.finance"]) {
    await sql`INSERT INTO user_roles (user_id, role_id) VALUES (${rhea.id}, ${roleId(role)}) ON CONFLICT DO NOTHING`.execute(db);
  }

  /* --------------------------- role-permissions --------------------------- */
  const permissionRows = await sql<{ id: string; key: string }>`SELECT id, key FROM permissions`.execute(db).then((r) => r.rows);
  const permissionId = (key: string): string => permissionRows.find((p) => p.key === key)!.id as string;
  const bind = (role: string, permission: string) =>
    sql`INSERT INTO role_permissions (role_id, permission_id) VALUES (${roleId(role)}, ${permissionId(permission)}) ON CONFLICT DO NOTHING`.execute(db);

  for (const permission of ["admin.access", "admin.users", "admin.moderation", "admin.transactions", "admin.verification", "admin.disputes", "admin.subscriptions", "admin.reports", "admin.settings", "admin.analytics"]) {
    await bind("admin.owner", permission);
  }
  for (const permission of ["admin.access", "admin.moderation", "admin.verification", "admin.disputes", "admin.analytics"]) {
    await bind("admin.trust", permission);
  }
  for (const permission of ["admin.access", "admin.transactions", "admin.subscriptions", "admin.reports", "admin.analytics"]) {
    await bind("admin.finance", permission);
  }

  /* ------------------------------- catalog -------------------------------- */
  const categories = [
    { slug: "web-development", name: "Web Development", description: "Sites, web apps and front ends" },
    { slug: "product-design", name: "Product Design", description: "Interfaces, systems and prototypes" },
    { slug: "data-ai-ml", name: "Data, AI & ML", description: "Pipelines, modelling and analytics" },
    { slug: "marketing", name: "Marketing", description: "Growth, content and campaigns" },
    { slug: "mobile-development", name: "Mobile Development", description: "iOS, Android and cross-platform apps" },
    { slug: "writing-editing", name: "Writing & Editing", description: "Copy, technical documentation and content" },
    { slug: "video-photography", name: "Video & Photography", description: "Editorial, product and social video" },
    { slug: "business-admin", name: "Business & Admin", description: "Operations, bookkeeping and support" },
    { slug: "education-coaching", name: "Education & Coaching", description: "Tutoring, training and advisory" },
  ] as const;

  for (const category of categories) {
    await sql`INSERT INTO categories (slug, name, description) VALUES (${category.slug}, ${category.name}, ${category.description}) ON CONFLICT DO NOTHING`.execute(db);
  }

  const skills = [
    { slug: "next-js", name: "Next.js" },
    { slug: "typescript", name: "TypeScript" },
    { slug: "postgres", name: "PostgreSQL" },
    { slug: "react", name: "React" },
    { slug: "figma", name: "Figma" },
    { slug: "aws", name: "AWS" },
    { slug: "python", name: "Python" },
  ] as const;

  for (const skill of skills) {
    await sql`INSERT INTO skills (slug, name) VALUES (${skill.slug}, ${skill.name}) ON CONFLICT DO NOTHING`.execute(db);
  }

  /* ---------------------------- subscription plans ------------------------ */
  const plans = [
    { code: "starter-f", name: "Starter", audience: "freelancer", price: 0, interval: "monthly", features: ["Profile page", "Portfolio", "Proposals included"] },
    { code: "pro-f", name: "Professional", audience: "freelancer", price: 1900, interval: "monthly", features: ["Everything in Starter", "Premium placement", "Advanced analytics"] },
    { code: "expert-f", name: "Expert", audience: "freelancer", price: 3900, interval: "monthly", features: ["Everything in Professional", "ID verification badge", "Invite-only projects"] },
    { code: "starter-c", name: "Starter", audience: "client", price: 0, interval: "monthly", features: ["Post projects", "Unlimited applicants"] },
    { code: "business-c", name: "Business", audience: "client", price: 4900, interval: "monthly", features: ["Everything in Starter", "Premium support", "Talent matching"] },
  ] as const;

  for (const plan of plans) {
    await sql`INSERT INTO subscription_plans (code, name, audience, price_minor, interval, features)
      VALUES (${plan.code}, ${plan.name}, ${plan.audience}, ${plan.price}, ${plan.interval}, ${JSON.stringify(plan.features)}::jsonb)
      ON CONFLICT (code) DO NOTHING`.execute(db);
  }

  /* ------------------------------- profiles ------------------------------- */
  await sql`INSERT INTO freelancer_profiles (user_id, headline, about, hourly_rate_minor, experience_level, location, timezone, response_time_hours, rating_avg, rating_count, completed_count, earnings_minor, verified_identity)
    VALUES (${amara.id}, 'Product engineer for SaaS teams', 'Ten years building commerce and internal tooling; recent work on analytics platforms.', 7500, 'expert', 'Lagos, Nigeria', 'Africa/Lagos', 3, 4.9, 38, 41, 31200000, true)
    ON CONFLICT (user_id) DO NOTHING`.execute(db);

  await sql`INSERT INTO freelancer_skills (freelancer_id, skill_id)
    SELECT p.user_id, s.id
    FROM freelancer_profiles p, skills s
    WHERE p.user_id = ${amara.id} AND s.slug IN ('next-js', 'typescript', 'postgres')
    ON CONFLICT DO NOTHING`.execute(db);

  await sql`INSERT INTO client_profiles (user_id, company_name, company_size, industry, about, rating_avg, rating_count, projects_count)
    VALUES (${naomi.id}, 'Loopwork', '51-200', 'Software', 'Work operations for modern teams', 4.7, 21, 21)
    ON CONFLICT (user_id) DO NOTHING`.execute(db);

  /* --------------------------------- demo logins ---------------------------------- */
  // Local development only. The password is `workora-demo` for the three seeded users.
  // These intentionally mirror the Better Auth credential flow so the demo
  // works out of the box on a clean DB. Never run this on a real deployment.
  const demoPasswordHash = await hash("workora-demo");
  const demoAccounts = [
    { userId: "00000000-0000-4000-8000-0000000000a1", email: "rhea@workora.example" },
    { userId: "00000000-0000-4000-8000-0000000000a2", email: "amara@workora.example" },
    { userId: "00000000-0000-4000-8000-0000000000a3", email: "naomi@workora.example" },
  ];
  for (const account of demoAccounts) {
    await sql`
      INSERT INTO accounts (user_id, account_id, provider_id, password, created_at, updated_at)
      VALUES (${account.userId}, ${account.userId}, 'credential', ${demoPasswordHash}, now(), now())
      ON CONFLICT DO NOTHING
    `.execute(db);
  }

  /* ------------------------------- one live project -------------------------- */
  const projectId = "00000000-0000-4000-8000-0000000000p1".replace("p", "e");
  await sql`INSERT INTO projects (id, client_id, title, summary, description, category_id, status, budget_type, budget_min_minor, budget_max_minor, experience_level, proposals_count, published_at, deadline)
    VALUES (${projectId}, ${naomi.id}, 'Clinic analytics dashboard', 'Multi-tenant dashboard for a healthcare analytics platform',
      'Build a multi-tenant analytics dashboard for a healthcare SaaS: data pipeline KPIs, cohort retention reports and investor-facing summary pages. Includes design in Figma.',
      (SELECT id FROM categories WHERE slug = 'data-ai-ml'), 'open', 'fixed', 450000, 650000, 'intermediate', 12, now() - interval '2 days', CURRENT_DATE + interval '30 days')
    ON CONFLICT (id) DO NOTHING`.execute(db);

  await sql`INSERT INTO project_skills (project_id, skill_id)
    SELECT ${projectId}, id FROM skills WHERE slug IN ('next-js', 'typescript', 'postgres', 'python')
    ON CONFLICT DO NOTHING`.execute(db);

  /* ------------------------------- subscription --------------------------- */
  await sql`INSERT INTO subscriptions (user_id, plan_id, status, interval, amount_minor)
    SELECT ${amara.id}, id, 'active', 'monthly', 1900 FROM subscription_plans WHERE code = 'pro-f'
    ON CONFLICT DO NOTHING`.execute(db);

  console.log("seed: done");
}

whenRequired(import.meta.url, process.argv[1], async () => {
  const { db, closeDb } = await import("../connection.js");
  const instance = await db();
  await seed(instance);
  await closeDb();
});

function whenRequired(metaUrl: string, argv: string | undefined, fn: () => Promise<void>): void {
  if (argv && metaUrl.replace(/\\/g, "/").endsWith(argv.replace(/\\/g, "/"))) {
    void fn().catch((error) => {
      console.error(error);
      process.exit(1);
    });
  }
}
