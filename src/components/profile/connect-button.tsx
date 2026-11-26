"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ApiError, api } from "@/lib/api";
import type { ConnectionStatus } from "@/lib/connections";
import { Icon, PlusSignIcon, Tick02Icon, UserMultiple02Icon } from "@/lib/icons";
import { cn } from "@/lib/utils";

interface ConnectButtonProps {
  targetId: string;
  targetName?: string;
  viewerId: string | null;
  isSelf: boolean;
  initialConnected?: boolean;
  initialFollowersCount?: number;
  initialFollowingCount?: number;
  fullWidth?: boolean;
  /** Hide the extra follower/following links when the parent already shows them. */
  showCounts?: boolean;
}

function Counts({
  targetId,
  followers,
  following,
}: {
  targetId: string;
  followers: number;
  following: number;
}) {
  const listHref = (tab: "followers" | "following") =>
    `/connections?user=${encodeURIComponent(targetId)}&tab=${tab}`;
  const countClass = "connection-count-bump font-semibold text-neutral-900 tabular-nums";

  return (
    <div className="mt-3 flex items-center justify-center gap-4 text-[12px] text-neutral-500">
      <Link href={listHref("followers")} className="inline-flex items-center gap-1.5 transition-colors hover:text-brand-700" aria-label={`View ${followers} followers`}>
        <strong key={`followers-${followers}`} className={countClass}>
          {followers}
        </strong>
        followers
      </Link>
      <span aria-hidden className="h-3 w-px bg-neutral-200" />
      <Link href={listHref("following")} className="inline-flex items-center gap-1.5 transition-colors hover:text-brand-700" aria-label={`View ${following} following`}>
        <strong key={`following-${following}`} className={countClass}>
          {following}
        </strong>
        following
      </Link>
    </div>
  );
}

/** Animated connect/follow control with live connection counts. */
export function ConnectButton({
  targetId,
  targetName = "this member",
  viewerId,
  isSelf,
  initialConnected = false,
  initialFollowersCount = 0,
  initialFollowingCount = 0,
  fullWidth = false,
  showCounts = true,
}: ConnectButtonProps) {
  const [connected, setConnected] = useState(initialConnected);
  const [followers, setFollowers] = useState(initialFollowersCount);
  const [following, setFollowing] = useState(initialFollowingCount);
  const [pending, setPending] = useState(false);
  const [burst, setBurst] = useState(false);
  const burstTimer = useRef<number | null>(null);
  const pathname = usePathname();
  const router = useRouter();
  const loginHref = `/login?next=${encodeURIComponent(pathname || "/")}`;

  useEffect(() => {
    if (!viewerId || isSelf) return;
    let active = true;
    api<ConnectionStatus>(`/api/v1/connections/${encodeURIComponent(targetId)}/status`)
      .then((status) => {
        if (!active) return;
        setConnected(status.connected);
        setFollowers(status.followersCount);
        setFollowing(status.followingCount);
      })
      .catch(() => {
        // Keep the server-rendered counts if the status check fails.
      });
    return () => {
      active = false;
    };
  }, [targetId, viewerId, isSelf]);

  useEffect(() => {
    return () => {
      if (burstTimer.current !== null) window.clearTimeout(burstTimer.current);
    };
  }, []);

  async function toggle() {
    if (pending) return;
    const next = !connected;
    setPending(true);
    try {
      const status = await api<ConnectionStatus>(
        `/api/v1/connections/${encodeURIComponent(targetId)}`,
        { method: next ? "POST" : "DELETE" },
      );
      setConnected(status.connected);
      setFollowers(status.followersCount);
      setFollowing(status.followingCount);
      if (status.connected) {
        setBurst(true);
        if (burstTimer.current !== null) window.clearTimeout(burstTimer.current);
        burstTimer.current = window.setTimeout(() => setBurst(false), 720);
      }
      toast.success(status.connected ? `You’re connected with ${targetName}` : "Connection removed", {
        description: status.connected
          ? "Their work and updates will be easier to find on Workora."
          : "You can connect again any time.",
      });
      router.refresh();
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        window.location.assign(loginHref);
        return;
      }
      toast.error("Couldn’t update the connection", {
        description: error instanceof Error ? error.message : "Please try again.",
      });
    } finally {
      setPending(false);
    }
  }

  const wrapperClass = cn("relative", fullWidth && "w-full");

  if (isSelf) {
    return (
      <div className={wrapperClass}>
        <Button variant="secondary" size="md" disabled className={fullWidth ? "w-full" : "w-auto"}>
          <Icon icon={UserMultiple02Icon} size={16} strokeWidth={1.8} />
          Your network
        </Button>
        {showCounts ? <Counts targetId={targetId} followers={followers} following={following} /> : null}
      </div>
    );
  }

  if (!viewerId) {
    return (
      <div className={wrapperClass}>
        <Button href={loginHref} variant="primary" size="md" className={fullWidth ? "w-full" : "w-auto"}>
          <Icon icon={PlusSignIcon} size={16} strokeWidth={1.8} />
          Connect
        </Button>
        {showCounts ? <Counts targetId={targetId} followers={followers} following={following} /> : null}
      </div>
    );
  }

  return (
    <div className={wrapperClass}>
      <Button
        type="button"
        onClick={toggle}
        loading={pending}
        aria-pressed={connected}
        aria-label={connected ? `Disconnect from ${targetName}` : `Connect with ${targetName}`}
        variant={connected ? "secondary" : "primary"}
        size="md"
        className={cn(
          "group relative transition-all duration-300 hover:-translate-y-0.5 active:scale-[0.98]",
          fullWidth ? "w-full" : "w-auto",
          connected
            ? "border-brand-200 bg-brand-50 text-brand-800 hover:border-brand-300 hover:bg-brand-100"
            : "shadow-sm hover:shadow-md",
        )}
      >
        {burst ? <span aria-hidden className="connection-ring pointer-events-none absolute inset-0 rounded-lg" /> : null}
        <span aria-hidden className="relative grid size-4 shrink-0 place-items-center">
          <Icon
            icon={PlusSignIcon}
            size={16}
            strokeWidth={2}
            className={cn(
              "absolute transition-all duration-300",
              connected ? "-rotate-90 scale-50 opacity-0" : "rotate-0 scale-100 opacity-100",
            )}
          />
          <Icon
            icon={Tick02Icon}
            size={16}
            strokeWidth={2.2}
            className={cn(
              "absolute transition-all duration-300",
              connected ? "connection-pop rotate-0 scale-100 opacity-100" : "rotate-90 scale-50 opacity-0",
            )}
          />
        </span>
        <span className="relative">{connected ? "Connected" : "Connect"}</span>
      </Button>
      {showCounts ? <Counts targetId={targetId} followers={followers} following={following} /> : null}
    </div>
  );
}
