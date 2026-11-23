import Link from "next/link";
import { Avatar } from "@/components/ui/avatar";
import {
  connectionProfileHref,
  connectionSubtitle,
  type ConnectionList,
  type ConnectionUser,
} from "@/lib/connections";
import { ArrowRight02Icon, Icon, UserMultiple02Icon } from "@/lib/icons";

function ConnectionRow({ person }: { person: ConnectionUser }) {
  return (
    <li>
      <Link href={connectionProfileHref(person)} className="flex items-center gap-2.5 rounded-lg px-1 py-2 transition-colors hover:bg-neutral-50">
        <Avatar src={person.image} name={person.name} size="sm" alt="" />
        <span className="min-w-0">
          <span className="block truncate text-[13px] font-medium text-neutral-900">{person.name}</span>
          <span className="block truncate text-[11px] text-neutral-500">{connectionSubtitle(person)}</span>
        </span>
      </Link>
    </li>
  );
}

export function ConnectionsCard({
  followers,
  following,
  viewAllHref = "/connections",
}: {
  followers: ConnectionList | null;
  following: ConnectionList | null;
  viewAllHref?: string;
}) {
  const followerUsers = followers?.users ?? [];
  const followingUsers = following?.users ?? [];
  return (
    <section className="card flex flex-col p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-neutral-900">Connections</h2>
        <Link href={viewAllHref} className="inline-flex items-center gap-1 text-[13px] font-medium text-brand-700 hover:text-brand-800">
          View all
          <Icon icon={ArrowRight02Icon} size={14} strokeWidth={1.8} />
        </Link>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-3">
        <div className="rounded-lg bg-neutral-50 p-3">
          <p className="text-xl font-semibold tabular-nums text-neutral-900">{followers?.total ?? 0}</p>
          <p className="text-xs text-neutral-500">Followers</p>
        </div>
        <div className="rounded-lg bg-neutral-50 p-3">
          <p className="text-xl font-semibold tabular-nums text-neutral-900">{following?.total ?? 0}</p>
          <p className="text-xs text-neutral-500">Following</p>
        </div>
      </div>
      <div className="mt-4">
        <p className="flex items-center gap-1.5 text-xs font-medium text-neutral-500">
          <Icon icon={UserMultiple02Icon} size={13} strokeWidth={1.8} />
          Recent followers
        </p>
        {followerUsers.length > 0 ? (
          <ul className="mt-1 divide-y divide-neutral-100">
            {followerUsers.map((person) => <ConnectionRow key={person.id} person={person} />)}
          </ul>
        ) : (
          <p className="mt-2 text-[13px] text-neutral-500">No followers yet. Share your public profile to grow your network.</p>
        )}
      </div>
      <div className="mt-4 border-t border-neutral-100 pt-4">
        <p className="text-xs font-medium text-neutral-500">People you follow</p>
        {followingUsers.length > 0 ? (
          <ul className="mt-1 divide-y divide-neutral-100">
            {followingUsers.map((person) => <ConnectionRow key={person.id} person={person} />)}
          </ul>
        ) : (
          <p className="mt-2 text-[13px] text-neutral-500">Connect with clients and freelancers you want to work with.</p>
        )}
      </div>
    </section>
  );
}

export { ConnectionRow };
