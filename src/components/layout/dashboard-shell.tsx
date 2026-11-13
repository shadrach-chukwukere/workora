"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { toast } from "sonner";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { DropdownMenu } from "@/components/ui/dropdown-menu";
import { LogoMark } from "@/components/ui/logo";
import { navForRole } from "@/lib/navigation";
import {
  Alert02Icon,
  Analytics02Icon,
  Briefcase02Icon,
  Building01Icon,
  ChartLineIcon,
  CreditCardIcon,
  CrownIcon,
  Dollar01Icon,
  File02Icon,
  HandshakeIcon,
  Home01Icon,
  Image02Icon,
  JobSearchIcon,
  Icon,
  Menu01Icon,
  Message01Icon,
  MultiplicationSignIcon,
  Notification01Icon,
  Pen01Icon,
  Payment01Icon,
  SentIcon,
  Settings01Icon,
  StampIcon,
  StarIcon,
  Tag01Icon,
  UserCircleIcon,
  UserMultiple02Icon,
  Wallet01Icon,
} from "@/lib/icons";
import type { IconName } from "@/lib/icons";
import { cn } from "@/lib/utils";

type AccountRole = "freelancer" | "client" | "admin";

/** Session shape passed from the server-side layout (after SessionGuard runs). */
export interface Account {
  userId: string;
  role: AccountRole;
  userName: string;
  email: string;
  image: string | null;
}

interface DashboardShellProps {
  role: AccountRole;
  account: Account;
  children: React.ReactNode;
}

const AccountContext = createContext<Account>({
  userId: "",
  role: "freelancer",
  userName: "",
  email: "",
  image: null,
});

export const useAccount = () => useContext(AccountContext);

const NAV_ICONS: Record<string, IconName> = {
  Home01Icon,
  JobSearchIcon,
  SentIcon,
  HandshakeIcon,
  Message01Icon,
  Wallet01Icon,
  CreditCardIcon,
  Image02Icon,
  StarIcon,
  Settings01Icon,
  Pen01Icon,
  Briefcase02Icon,
  File02Icon,
  Payment01Icon,
  UserMultiple02Icon,
  UserCircleIcon,
  Building01Icon,
  Alert02Icon,
  Tag01Icon,
  StampIcon,
  CrownIcon,
  ChartLineIcon,
  Notification01Icon,
  Analytics02Icon,
};

interface NotificationPayload {
  id: string;
  type: "proposal" | "contract" | "message" | "payment" | "review" | "verification" | "system" | "dispute";
  title: string;
  body: string;
  url: string | null;
  is_read: boolean;
  created_at: string;
}

export function DashboardShell({ role, account, children }: DashboardShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [bellOpen, setBellOpen] = useState(false);

  useEffect(() => {
    setDrawerOpen(false);
    setBellOpen(false);
  }, [pathname]);

  const userId = account.userId;
  const sections = navForRole[role];

  const isActive = (href: string, exact?: boolean) =>
    exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);

  const sidebar = (
    <div
      className={cn(
        "flex h-full w-[256px] shrink-0 flex-col",
        role === "admin" ? "bg-neutral-900 text-neutral-200" : "border-r border-neutral-200 bg-white text-neutral-900"
      )}
    >
      <div className={cn("flex h-16 shrink-0 items-center justify-between px-4", role === "admin" ? "" : "border-b border-neutral-200")}>
        <Link href="/" aria-label="Workora public site" className="flex items-center gap-2">
          <LogoMark size={22} />
          <span className={cn("text-[15px] font-semibold tracking-tight", role === "admin" ? "text-white" : "text-neutral-900")}>
            Workora
          </span>
        </Link>
        <button
          type="button"
          onClick={() => setDrawerOpen(false)}
          aria-label="Close menu"
          className="inline-flex size-8 items-center justify-center rounded-lg text-neutral-400 hover:bg-neutral-100 lg:hidden"
        >
          <Icon icon={MultiplicationSignIcon} size={16} strokeWidth={1.8} />
        </button>
      </div>

      <nav aria-label={`${role} navigation`} className="flex-1 overflow-y-auto px-3 py-4">
        <p className={cn("mb-3 px-2 text-[11px] font-semibold uppercase tracking-[0.12em]", role === "admin" ? "text-neutral-500" : "text-neutral-400")}>
          {role === "freelancer" ? "Freelancer workspace" : role === "client" ? "Client workspace" : "Admin console"}
        </p>
        {sections.map((section) => (
          <div key={section.title} className="mb-5 last:mb-0">
            <p className={cn("mb-1.5 px-2 text-[11px] font-semibold uppercase tracking-[0.12em]", role === "admin" ? "text-neutral-600" : "text-neutral-400")}>
              {section.title}
            </p>
            <ul className="space-y-0.5">
              {section.items.map((item) => {
                const active = isActive(item.href, item.exact);
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "flex items-center gap-2.5 rounded-lg px-2 py-2 text-sm font-medium transition-colors",
                        role === "admin"
                          ? active
                            ? "bg-brand-600/10 text-brand-700 border border-brand-200/50"
                            : "text-neutral-500 hover:bg-neutral-800/50 hover:text-neutral-300"
                          : active
                          ? "bg-brand-50 text-brand-800"
                          : "text-neutral-600 hover:bg-neutral-50 hover:text-neutral-900",
                      )}
                    >
                      <Icon icon={NAV_ICONS[item.icon] ?? Home01Icon} size={16} strokeWidth={1.8} className="shrink-0 text-inherit" />
                      <span className="min-w-0 flex-1 truncate">{item.label}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className={cn("shrink-0 p-3", role === "admin" ? "" : "border-t border-neutral-200")}>
        <div className={cn("flex items-center gap-2.5 rounded-xl p-2", role === "admin" ? "bg-neutral-800" : "bg-neutral-50")}>
          <Avatar src={account.image} name={account.userName} size="sm" />
          <div className="min-w-0 flex-1">
            <p className={cn("truncate text-[13px] font-semibold", role === "admin" ? "text-white" : "text-neutral-900")}>
              {account.userName}
            </p>
            <p className="truncate text-[11px] text-neutral-500">{account.email}</p>
          </div>
          <DropdownMenu
            label="Account"
            className="shrink-0"
            trigger={
              <button type="button" aria-label="Account menu" className="inline-flex size-7 items-center justify-center rounded-lg text-neutral-400 hover:text-neutral-800">
                <Icon icon={UserMultiple02Icon} size={16} strokeWidth={1.8} />
              </button>
            }
            items={[
              { type: "item" as const, label: "Account settings", onClick: () => router.push(`/${role}/settings`) },
              { type: "separator" },
              {
                type: "item" as const,
                label: "Sign out",
                danger: true,
                onClick: () => {
                  fetch("/api/auth/sign-out", { method: "POST", credentials: "include" }).catch(() => {});
                  toast.success("Signed out");
                  router.push("/login");
                  router.refresh();
                },
              },
            ]}
          />
        </div>
      </div>
    </div>
  );

  return (
    <AccountContext.Provider value={account}>
      <div className="min-h-screen bg-neutral-50">
        <aside className="fixed inset-y-0 left-0 z-40 hidden lg:block">{sidebar}</aside>

        {drawerOpen ? (
          <div className="fixed inset-0 z-50 lg:hidden">
            <button type="button" aria-label="Close menu" className="absolute inset-0 bg-neutral-900/40 backdrop-blur-sm" onClick={() => setDrawerOpen(false)} />
            <div className="anim-pop absolute inset-y-0 left-0">
              <div className="h-full shadow-overlay">{sidebar}</div>
            </div>
          </div>
        ) : null}

        <div className="lg:pl-[256px]">
          <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-neutral-200 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/[0.92] px-4 sm:px-6">
            <button
              type="button"
              onClick={() => setDrawerOpen(true)}
              aria-label="Open menu"
              className="inline-flex size-9 items-center justify-center rounded-full text-neutral-600 hover:bg-neutral-100 lg:hidden"
            >
              <Icon icon={Menu01Icon} size={18} strokeWidth={1.8} />
            </button>

            <div className="min-w-0 flex-1" />

            <NotificationsBell open={bellOpen} setOpen={setBellOpen} />
          </header>

          <div className="mx-auto w-full px-4 py-6 sm:px-6 lg:px-10 lg:py-8">
            <div className={cn("mx-auto", role === "admin" ? "max-w-7xl" : "max-w-6xl")}>{children}</div>
          </div>
        </div>
      </div>
    </AccountContext.Provider>
  );
}

const NOTIFICATION_ICONS: Record<NotificationPayload["type"], { icon: IconName; className: string }> = {
  proposal: { icon: SentIcon, className: "text-brand-700 bg-brand-100" },
  message: { icon: Message01Icon, className: "text-sky-700 bg-sky-100" },
  contract: { icon: HandshakeIcon, className: "text-amber-800 bg-amber-100" },
  payment: { icon: Dollar01Icon, className: "text-emerald-800 bg-emerald-100" },
  review: { icon: StarIcon, className: "text-brand-700 bg-brand-100" },
  verification: { icon: StampIcon, className: "text-brand-700 bg-brand-100" },
  dispute: { icon: Alert02Icon, className: "text-amber-800 bg-amber-100" },
  system: { icon: Notification01Icon, className: "text-neutral-700 bg-neutral-100" },
};

function NotificationsBell({
  open,
  setOpen,
}: {
  open: boolean;
  setOpen: (v: boolean) => void;
}) {
  const router = useRouter();
  const [items, setItems] = useState<NotificationPayload[]>([]);
  const [loading, setLoading] = useState(true);
  const unread = items.filter((n) => !n.is_read).length;

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch("/api/v1/notifications", { cache: "no-store", credentials: "include" });
        const json = (await res.json()) as { success: boolean; data?: { notifications: NotificationPayload[] } };
        if (!cancelled && json?.success && json.data) setItems(json.data.notifications);
      } catch {
        // keep previous list on network error
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const markAllRead = async () => {
    setItems((list) => list.map((n) => ({ ...n, is_read: true })));
    await fetch("/api/v1/notifications/mark-all-read", { method: "POST", credentials: "include" }).catch(() => {});
  };

  const openItem = (n: NotificationPayload) => {
    setItems((list) => list.map((it) => (it.id === n.id ? { ...it, is_read: true } : it)));
    setOpen(false);
    if (n.url) router.push(n.url);
  };

  return (
    <div className="relative">
      <button
        type="button"
        aria-label={`Notifications${unread ? `, ${unread} unread` : ""}`}
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        className="relative inline-flex size-9 items-center justify-center rounded-full text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900"
      >
        <Icon icon={Notification01Icon} size={18} strokeWidth={1.8} />
        {unread > 0 ? <span aria-hidden className="absolute right-1 top-1 size-2 rounded-full bg-brand-600 ring-2 ring-white" /> : null}
      </button>

      {open ? (
        <>
          <button type="button" aria-hidden tabIndex={-1} className="fixed inset-0 z-30 cursor-default" onClick={() => setOpen(false)} />
          <div role="dialog" aria-label="Notifications" className="anim-pop absolute right-0 top-11 z-40 w-[380px] max-w-[calc(100vw-2rem)] overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-dropdown">
            <div className="flex items-center justify-between border-b border-neutral-100 px-4 py-3">
              <p className="text-sm font-semibold text-neutral-900">Notifications</p>
              {unread > 0 ? (
                <button type="button" onClick={markAllRead} className="text-xs font-medium text-brand-700 hover:text-brand-800">
                  Mark all read
                </button>
              ) : null}
            </div>
            <ul className="max-h-[400px] overflow-y-auto">
              {loading ? (
                <li className="px-4 py-10 text-center text-sm text-neutral-500">Loading…</li>
              ) : items.length === 0 ? (
                <li className="px-4 py-10 text-center text-sm text-neutral-500">You're all caught up.</li>
              ) : (
                items.map((n) => {
                  const meta = NOTIFICATION_ICONS[n.type];
                  return (
                    <li key={n.id}>
                      <button
                        type="button"
                        onClick={() => openItem(n)}
                        className={cn("flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-neutral-50", !n.is_read && "bg-brand-50/50")}
                      >
                        <span aria-hidden className={cn("mt-0.5 inline-flex size-8 shrink-0 items-center justify-center rounded-full", meta.className)}>
                          <Icon icon={meta.icon} size={15} strokeWidth={1.8} />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-[13px] font-semibold text-neutral-900">{n.title}</span>
                          <span className="mt-0.5 block line-clamp-2 text-xs text-neutral-500">{n.body}</span>
                          <span className="mt-1 block text-[11px] text-neutral-400">{new Date(n.created_at).toLocaleString()}</span>
                        </span>
                        {!n.is_read ? <span aria-hidden className="mt-1.5 size-2 shrink-0 rounded-full bg-brand-600" /> : null}
                      </button>
                    </li>
                  );
                })
              )}
            </ul>
          </div>
        </>
      ) : null}
    </div>
  );
}
