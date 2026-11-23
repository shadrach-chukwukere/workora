import { Suspense } from "react";
import Link from "next/link";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { PublicHeader } from "@/components/layout/public-header";
import { PublicFooter } from "@/components/layout/public-footer";
import { getSessionAccount } from "@/components/layout/session-guard";
import { Avatar } from "@/components/ui/avatar";
import { Pagination } from "@/components/ui/pagination";
import { ConnectionToggleButton } from "@/components/profile/connection-toggle";
import { apiServerOr } from "@/lib/api-data";
import { apiServer } from "@/lib/api-server";
import { connectionProfileHref, connectionSubtitle, type ConnectionList } from "@/lib/connections";
import { Icon, UserMultiple02Icon } from "@/lib/icons";
import { cn } from "@/lib/utils";

export const metadata = {
  title: "Connections · Workora",
  description: "Public followers and following lists for Workora freelancers and clients.",
};

type ConnectionsSearchParams = {
  user?: string | string[];
  tab?: string | string[];
  page?: string | string[];
};

const UUID_RE = /^[0-9a-fA-F-]{36}$/;
const PER_PAGE = 12;

function first(value?: string | string[]): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function positiveInt(value?: string): number {
  const parsed = Number.parseInt(value ?? "1", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}

async function loadConnections(
  userId: string,
  tab: "followers" | "following",
  page: number,
  cookie: string | undefined,
): Promise<ConnectionList | null> {
  try {
    return await apiServer<ConnectionList>(
      `/api/v1/connections/${encodeURIComponent(userId)}/${tab}?page=${page}&perPage=${PER_PAGE}`,
      undefined,
      cookie,
    );
  } catch {
    return null;
  }
}

export default async function ConnectionsPage({
  searchParams,
}: {
  searchParams: Promise<ConnectionsSearchParams>;
}) {
  const query = await searchParams;
  const requestedUserId = first(query.user);
  const activeTab = first(query.tab) === "following" ? "following" : "followers";
  const page = positiveInt(first(query.page));

  if (requestedUserId && !UUID_RE.test(requestedUserId)) notFound();

  const viewer = await getSessionAccount();
  const targetId = requestedUserId || viewer?.userId || null;
  if (!targetId) {
    return (
      <div className="min-h-dvh bg-white">
        <PublicHeader />
        <main id="main-content" className="container-page py-12">
          <h1 className="text-2xl font-semibold tracking-tight text-neutral-900">Connections</h1>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-neutral-600">
            Follow people from their public profiles, then view their followers and following lists here.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link href="/find-talent" className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700">
              Find talent
            </Link>
            <Link href="/find-work" className="rounded-lg border border-neutral-200 px-4 py-2 text-sm font-medium text-neutral-800 hover:bg-neutral-50">
              Find work
            </Link>
          </div>
        </main>
        <PublicFooter />
      </div>
    );
  }

  const target = await apiServerOr<{
    user: { id: string; name: string; image: string | null; headline?: string | null; company_name?: string | null };
  } | null>(`/api/v1/users/${encodeURIComponent(targetId)}`, null, true);
  if (!target) notFound();

  const cookieStore = await cookies();
  const cookie = cookieStore
    .getAll()
    .map((item) => `${item.name}=${item.value}`)
    .join("; ");

  const [followers, following] = await Promise.all([
    loadConnections(targetId, "followers", activeTab === "followers" ? page : 1, cookie || undefined),
    loadConnections(targetId, "following", activeTab === "following" ? page : 1, cookie || undefined),
  ]);

  const list = activeTab === "followers" ? followers : following;
  const total = list?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PER_PAGE));
  const currentPage = Math.min(page, totalPages);
  const displayName = target.user.name;
  const isOwnNetwork = viewer?.userId === targetId;
  const listHref = (tab: "followers" | "following") =>
    `/connections?user=${encodeURIComponent(targetId)}&tab=${tab}`;

  return (
    <div className="min-h-dvh bg-white">
      <PublicHeader account={viewer} />
      <main id="main-content" className="container-page py-8">
        <div className="flex items-center gap-3">
          <Avatar src={target.user.image} name={displayName} size="lg" alt="" />
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold tracking-tight text-neutral-900">
              {isOwnNetwork ? "Your connections" : `${displayName}’s connections`}
            </h1>
            <p className="mt-1 text-sm text-neutral-500">
              Public followers and following lists on Workora.
            </p>
          </div>
        </div>

        <div className="mt-6 flex gap-6 border-b border-neutral-200" role="tablist" aria-label="Connection lists">
          {(["followers", "following"] as const).map((tab) => {
            const count = tab === "followers" ? followers?.total ?? 0 : following?.total ?? 0;
            const isActive = activeTab === tab;
            return (
              <Link
                key={tab}
                href={listHref(tab)}
                role="tab"
                aria-selected={isActive}
                className={cn(
                  "-mb-px inline-flex items-center gap-2 border-b-2 pb-3 text-sm font-medium capitalize transition-colors",
                  isActive
                    ? "border-brand-600 text-brand-700"
                    : "border-transparent text-neutral-500 hover:text-neutral-900",
                )}
              >
                {tab}
                <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs tabular-nums text-neutral-600">
                  {count}
                </span>
              </Link>
            );
          })}
        </div>

        <section className="mt-5 max-w-3xl" aria-live="polite">
          {list && list.users.length > 0 ? (
            <>
              <ul className="divide-y divide-neutral-100 rounded-xl border border-neutral-200 bg-white">
                {list.users.map((person) => (
                  <li key={person.id} className="flex items-center gap-3 p-4">
                    <Link
                      href={connectionProfileHref(person)}
                      className="flex min-w-0 flex-1 items-center gap-3 rounded-lg"
                    >
                      <Avatar src={person.image} name={person.name} size="sm" alt="" />
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium text-neutral-900">{person.name}</span>
                        <span className="block truncate text-xs text-neutral-500">{connectionSubtitle(person)}</span>
                      </span>
                    </Link>
                    <ConnectionToggleButton
                      targetId={person.id}
                      targetName={person.name}
                      viewerId={viewer?.userId ?? null}
                      connected={person.connected}
                      className="shrink-0"
                    />
                  </li>
                ))}
              </ul>
              <div className="mt-6">
                <Suspense fallback={<p className="text-center text-sm text-neutral-500">Loading pages…</p>}>
                  <Pagination page={currentPage} totalPages={totalPages} />
                </Suspense>
              </div>
              <p className="mt-3 text-center text-xs text-neutral-400">
                Page {currentPage} of {totalPages} · {total} {activeTab}
              </p>
            </>
          ) : (
            <div className="rounded-xl border border-neutral-200 bg-neutral-50 px-6 py-12 text-center">
              <span className="mx-auto inline-flex size-10 items-center justify-center rounded-full bg-white text-neutral-400 shadow-sm">
                <Icon icon={UserMultiple02Icon} size={18} strokeWidth={1.8} />
              </span>
              <p className="mt-3 text-sm font-medium text-neutral-800">
                No {activeTab} yet
              </p>
              <p className="mt-1 text-xs text-neutral-500">
                {activeTab === "followers"
                  ? "When someone connects with this profile, they’ll appear here."
                  : "When this profile connects with someone, they’ll appear here."}
              </p>
            </div>
          )}
        </section>
      </main>
      <PublicFooter />
    </div>
  );
}
