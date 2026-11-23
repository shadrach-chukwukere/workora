"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ApiError, api } from "@/lib/api";
import type { ConnectionStatus } from "@/lib/connections";
import { Icon, PlusSignIcon, Tick02Icon } from "@/lib/icons";

/**
 * Compact follow/unfollow control for connection lists. The initial state is
 * supplied by the public list API so no extra status request is needed.
 */
export function ConnectionToggleButton({
  targetId,
  targetName,
  viewerId,
  connected,
  className,
}: {
  targetId: string;
  targetName: string;
  viewerId: string | null;
  connected: boolean;
  className?: string;
}) {
  const router = useRouter();
  const [following, setFollowing] = useState(connected);
  const [pending, setPending] = useState(false);

  async function toggle() {
    if (pending) return;
    const next = !following;
    setPending(true);
    try {
      const status = await api<ConnectionStatus>(
        `/api/v1/connections/${encodeURIComponent(targetId)}`,
        { method: next ? "POST" : "DELETE" },
      );
      setFollowing(status.connected);
      toast.success(status.connected ? `Connected with ${targetName}` : `Disconnected from ${targetName}`);
      router.refresh();
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        window.location.assign("/login?next=/connections");
        return;
      }
      toast.error("Couldn’t update the connection", {
        description: error instanceof Error ? error.message : "Please try again.",
      });
    } finally {
      setPending(false);
    }
  }

  if (!viewerId) {
    return (
      <Button
        href="/login?next=/connections"
        size="sm"
        variant="primary"
        className={className}
        aria-label={`Sign in to connect with ${targetName}`}
      >
        <Icon icon={PlusSignIcon} size={14} strokeWidth={2} />
        Connect
      </Button>
    );
  }

  return (
    <Button
      type="button"
      size="sm"
      variant={following ? "secondary" : "primary"}
      loading={pending}
      aria-pressed={following}
      aria-label={following ? `Disconnect from ${targetName}` : `Connect with ${targetName}`}
      title={following ? "Click to disconnect" : "Click to connect"}
      onClick={() => void toggle()}
      className={className}
    >
      <Icon
        icon={following ? Tick02Icon : PlusSignIcon}
        size={14}
        strokeWidth={2}
        className={following ? "text-brand-700" : undefined}
      />
      {following ? "Connected" : "Connect"}
    </Button>
  );
}
