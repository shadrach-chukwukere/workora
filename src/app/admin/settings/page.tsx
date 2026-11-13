import { redirect } from "next/navigation";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/ui/page-blocks";
import { AdminAccessCard } from "@/components/admin/admin-access";
import { MIN_WITHDRAWAL, PLATFORM_FEE_PERCENT } from "@/lib/constants";
import { ApiServerError, apiServer, isAuthError, sessionCookie } from "@/lib/api-server";
import { formatDate } from "@/lib/format";

interface AdminUserRow {
 id: string;
 name: string;
 email: string;
 image: string | null;
 account_type: string;
 status: string;
 created_at: string;
}

export default async function AdminSettingsPage() {
 const cookie = await sessionCookie();

 let admins: AdminUserRow[];
 let meId: string | null = null;
 try {
 const [adminsRes, meRes] = await Promise.all([
 apiServer<{ users: AdminUserRow[] }>("/api/v1/admin/users?accountType=admin", undefined, cookie),
 apiServer<{ user: { id: string } }>("/api/v1/users/me", undefined, cookie),
 ]);
 admins = adminsRes.users;
 meId = meRes.user.id;
 } catch (error) {
 if (isAuthError(error)) redirect("/login");
 if (error instanceof ApiServerError && error.status === 403) return <AdminAccessCard message={error.message} />;
 throw error;
 }

 return (
 <div className="flex flex-col gap-6">
 <PageHeader
 title="Settings"
 description="Platform configuration at a glance. The console is read-only here; changes that matter take a deploy."
 breadcrumbs={[{ label: "Admin", href: "/admin/dashboard" }, { label: "Settings" }]}
 />

 {/* General */}
 <section className="card max-w-2xl p-6">
 <h2 className="text-sm font-semibold text-neutral-900">General</h2>
 <p className="mt-0.5 text-xs text-neutral-500">Identity and defaults, fixed at deploy time. Nothing here is editable from the console yet.</p>
 <dl className="mt-4 grid gap-4 sm:grid-cols-2">
 <ReadOnlyRow label="Platform" value="Workora" />
 <ReadOnlyRow label="Environment" value="Local development" />
 <ReadOnlyRow label="Data" value="Demo data" />
 <ReadOnlyRow label="Default currency" value="USD" />
 <ReadOnlyRow label="Default locale" value="en-US" />
 <ReadOnlyRow label="Console access" value="Admin accounts only" />
 </dl>
 </section>

 {/* Fees & limits */}
 <section className="card max-w-2xl p-6">
 <h2 className="text-sm font-semibold text-neutral-900">Fees & limits</h2>
 <p className="mt-0.5 text-xs text-neutral-500">Code-level constants. Changing them takes a deploy; there is no live fee editor.</p>
 <dl className="mt-4 grid gap-4 sm:grid-cols-2">
 <ReadOnlyRow
 label="Platform fee"
 value={`${PLATFORM_FEE_PERCENT}%`}
 hint={`${PLATFORM_FEE_PERCENT}% (code-level default). Only freelancers pay the fee, out of each released milestone. Changing takes a deploy.`}
 />
 <ReadOnlyRow
 label="Minimum withdrawal"
 value={`$${MIN_WITHDRAWAL}`}
 hint="Minimum net per withdrawal request, before any payout rail fee."
 />
 </dl>
 </section>

 {/* Team */}
 <section className="card max-w-3xl">
 <div className="border-b border-neutral-100 px-5 py-4">
 <h2 className="text-sm font-semibold text-neutral-900">Console access</h2>
 <p className="mt-0.5 text-xs text-neutral-500">
 Staff accounts from the live users table. Roles are assigned in deploy configuration; the console cannot change them yet.
 </p>
 </div>
 <div className="overflow-x-auto">
 <table className="w-full min-w-[560px] text-sm">
 <thead>
 <tr className="border-b border-neutral-100 text-left text-xs font-medium text-neutral-500">
 <th scope="col" className="px-5 py-2.5">Name</th>
 <th scope="col" className="px-5 py-2.5">Role</th>
 <th scope="col" className="px-5 py-2.5">Status</th>
 <th scope="col" className="px-5 py-2.5">Joined</th>
 </tr>
 </thead>
 <tbody className="divide-y divide-neutral-100">
 {admins.map((u) => {
 const isSelf = u.id === meId;
 return (
 <tr key={u.id}>
 <td className="px-5 py-3">
 <div className="flex items-center gap-3">
 <Avatar src={u.image ?? undefined} name={u.name} size="sm" />
 <div className="min-w-0">
 <p className="truncate font-medium text-neutral-900">
 {u.name}
 {isSelf ? <span className="ml-1.5 text-xs font-normal text-neutral-500">(you)</span> : null}
 </p>
 <p className="truncate text-xs text-neutral-500">{u.email}</p>
 </div>
 </div>
 </td>
 <td className="px-5 py-3">
 <Badge tone="brand">Admin</Badge>
 </td>
 <td className="px-5 py-3">
 <Badge tone={u.status === "active" ? "success" : u.status === "restricted" ? "warning" : "danger"}>
 {u.status[0].toUpperCase() + u.status.slice(1)}
 </Badge>
 </td>
 <td className="px-5 py-3 text-neutral-500">{formatDate(u.created_at)}</td>
 </tr>
 );
 })}
 {admins.length === 0 ? (
 <tr>
 <td colSpan={4} className="px-5 py-6 text-center text-sm text-neutral-500">
 No admin accounts found.
 </td>
 </tr>
 ) : null}
 </tbody>
 </table>
 </div>
 <p className="border-t border-neutral-100 px-5 py-3 text-[11px] text-neutral-400">
 Role distinctions (owner, trust, finance) exist in the seed data but are not surfaced by the API; every console account is labeled Admin.
 Invite and removal flows are managed in the deploy configuration, not here.
 </p>
 </section>
 </div>
 );
}

function ReadOnlyRow({ label, value, hint }: { label: string; value: string; hint?: string }) {
 return (
 <div className="rounded-xl border border-neutral-200 p-4">
 <dt className="text-[11px] font-semibold uppercase tracking-[0.08em] text-neutral-400">{label}</dt>
 <dd className="mt-1 text-sm font-medium text-neutral-900">{value}</dd>
 {hint ? <dd className="mt-1 text-[11px] leading-relaxed text-neutral-500">{hint}</dd> : null}
 </div>
 );
}
