import { redirect } from "next/navigation";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { requireSession } from "@/components/layout/session-guard";
import { PageHeader } from "@/components/ui/page-blocks";
import { ConnectionRow } from "@/components/profile/connections-card";
import { apiOptional, apiServer, isAuthError, sessionCookie } from "@/lib/api-server";
import type { ConnectionList } from "@/lib/connections";

export const metadata = {
  title: "Connections · Workora",
  description: "Your Workora network of followers and people you follow.",
};

export default async function ConnectionsPage() {
  const account = await requireSession();
  const cookie = await sessionCookie();

  let followers: ConnectionList | null;
  let following: ConnectionList | null;
  try {
    [followers, following] = await Promise.all([
      apiOptional(apiServer<ConnectionList>("/api/v1/connections/me/followers?perPage=50", undefined, cookie)),
      apiOptional(apiServer<ConnectionList>("/api/v1/connections/me/following?perPage=50", undefined, cookie)),
    ]);
  } catch (error) {
    if (isAuthError(error)) redirect("/login");
    throw error;
  }

  return (
    <DashboardShell
      role={account.role}
      account={{
        userId: account.userId,
        role: account.role,
        userName: account.name,
        email: account.email,
        image: account.image,
      }}
    >
      <div className="flex flex-col gap-6">
        <PageHeader
          title="Connections"
          description="Your professional network on Workora — clients and freelancers you follow, and people following your work."
        />

        <div className="grid gap-6 lg:grid-cols-2">
          <section className="card flex flex-col p-5">
            <div className="flex items-baseline justify-between border-b border-neutral-100 pb-4">
              <h2 className="text-sm font-semibold text-neutral-900">Followers</h2>
              <span className="text-2xl font-semibold tabular-nums text-neutral-900">{followers?.total ?? 0}</span>
            </div>
            {followers && followers.users.length > 0 ? (
              <ul className="divide-y divide-neutral-100">
                {followers.users.map((person) => <ConnectionRow key={person.id} person={person} />)}
              </ul>
            ) : (
              <p className="py-8 text-sm text-neutral-500">
                No followers yet. Share your public profile so clients and freelancers can find you.
              </p>
            )}
          </section>

          <section className="card flex flex-col p-5">
            <div className="flex items-baseline justify-between border-b border-neutral-100 pb-4">
              <h2 className="text-sm font-semibold text-neutral-900">Following</h2>
              <span className="text-2xl font-semibold tabular-nums text-neutral-900">{following?.total ?? 0}</span>
            </div>
            {following && following.users.length > 0 ? (
              <ul className="divide-y divide-neutral-100">
                {following.users.map((person) => <ConnectionRow key={person.id} person={person} />)}
              </ul>
            ) : (
              <p className="py-8 text-sm text-neutral-500">
                You’re not following anyone yet. Open a public profile and tap Connect to build your network.
              </p>
            )}
          </section>
        </div>
      </div>
    </DashboardShell>
  );
}
