"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { DropdownMenu } from "@/components/ui/dropdown-menu";
import { Logo } from "@/components/ui/logo";
import { publicNav } from "@/lib/navigation";
import { Icon, Logout01Icon, Menu01Icon, Search01Icon, MultiplicationSignIcon, Home01Icon, Settings01Icon } from "@/lib/icons";
import { workspacePathForRole, type SessionAccount } from "@/lib/workspace";
import { cn } from "@/lib/utils";
import { ArrowRight01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";

interface PublicHeaderProps {
  /** Signed-in account resolved server-side; null when signed out. */
  account?: SessionAccount | null;
}

export function PublicHeader({ account = null }: PublicHeaderProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  useEffect(() => {
    document.body.style.overflow = menuOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [menuOpen]);

  useEffect(() => {
    setMenuOpen(false);
    setSearchOpen(false);
  }, [pathname]);

  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);
  const workspace = workspacePathForRole(account?.role);
  const settingsHref = account ? `/${account.role}/settings` : "/login";

  const signOut = async () => {
    await fetch("/api/auth/sign-out", { method: "POST", credentials: "include" }).catch(() => {});
    toast.success("Signed out");
    setMenuOpen(false);
    router.push("/");
    router.refresh();
  };

  const accountItems = account
    ? [
        { type: "label" as const, label: `${account.name} · ${account.email}` },
        { type: "item" as const, label: "Open dashboard", onClick: () => router.push(workspace) },
        { type: "item" as const, label: "Account settings", onClick: () => router.push(settingsHref) },
        { type: "separator" as const },
        { type: "item" as const, label: "Sign out", danger: true, onClick: signOut },
      ]
    : [];

  return (
    <>
      <a href="#main-content" className="skip-link">
        Skip to content
      </a>

      <header className="sticky top-0 z-40 border-neutral-200 bg-white/95 backdrop-blur supports-backdrop-filter:bg-white/92">
        <div className="container-page flex h-16 items-center gap-x-6">
          {/* Brand - left, generous whitespace around it */}
          <div className="flex shrink-0 items-center gap-2.5">
            <Logo className="shrink-0" size="md" />
          </div>

          {/* Primary navigation - text links, centered-left */}
          <nav aria-label="Primary" className="hidden md:flex items-center gap-8 shrink-0 md:ml-10">
            {publicNav.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="text-sm font-medium text-neutral-600 transition-colors hover:text-neutral-900"
                aria-current={isActive(item.href) ? "page" : undefined}
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-2 shrink-0">
            {account ? (
              <>
                <Link href={workspace} className="hidden sm:inline-flex items-center gap-2 rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm font-medium text-neutral-700 transition-colors hover:bg-neutral-50 hover:text-neutral-900">
                  <Icon icon={Home01Icon} size={14} strokeWidth={1.8} className="shrink-0" />
                  Dashboard
                </Link>
                <DropdownMenu
                  label="Account menu"
                  trigger={
                    <button type="button" aria-label="Account menu" className="inline-flex size-9 items-center justify-center rounded-full text-neutral-600 hover:bg-neutral-100">
                      <Avatar src={account.image} name={account.name} size="sm" />
                    </button>
                  }
                  items={accountItems}
                />
              </>
            ) : (
              <>
                  <Button href="/login" size={"md"} className="hidden md:inline-flex items-center gap-1.5 rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm font-medium text-neutral-700 transition-colors hover:bg-neutral-50 hover:text-neutral-900">
                    Log in
                  </Button>
                <Button href="/register" size="md" className="hidden md:inline-flex">
                  Get started
                  <HugeiconsIcon icon={ArrowRight01Icon}/>
                </Button>
              </>
            )}

            <button
              type="button"
              onClick={() => setMenuOpen(true)}
              aria-label="Open menu"
              className="inline-flex size-9 items-center justify-center rounded-full text-neutral-600 hover:bg-neutral-100 md:hidden"
            >
              <Icon icon={Menu01Icon} size={18} strokeWidth={1.8} />
            </button>
          </div>
        </div>
      </header>

      {/* Mobile drawer */}
      {menuOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Site menu">
          <button type="button" aria-label="Close menu" className="absolute inset-0 bg-neutral-900/40 backdrop-blur-sm" onClick={() => setMenuOpen(false)} />
          <div className="anim-pop absolute inset-y-0 right-0 flex w-full max-w-[85vw] flex-col border-l border-neutral-200 bg-white shadow-dropdown">
            <div className="flex h-16 items-center justify-between border-b border-neutral-200 px-4">
              <Logo size="md" />
              <button
                type="button"
                onClick={() => setMenuOpen(false)}
                aria-label="Close menu"
                className="inline-flex size-9 items-center justify-center rounded-full text-neutral-600 hover:bg-neutral-100"
              >
                <Icon icon={MultiplicationSignIcon} size={18} strokeWidth={1.8} />
              </button>
            </div>
            <div className="border-b border-neutral-50 px-4 py-2">
              <form action="/find-talent" method="get" className="relative w-full">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400">
                  <Icon icon={Search01Icon} size={15} strokeWidth={1.8} />
                </span>
                <input
                  type="search"
                  name="q"
                  placeholder="Search talent, skills or keywords"
                  className="w-full h-9 rounded-xl border border-neutral-200 bg-white pl-10 pr-4 text-sm text-neutral-900 placeholder:text-neutral-400 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600"
                />
              </form>
            </div>
            <nav aria-label="Mobile" className="flex-1 overflow-y-auto px-4 py-3">
              {publicNav.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "block rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                    isActive(item.href) ? "bg-brand-50 text-brand-800" : "text-neutral-800 hover:bg-neutral-50 hover:text-neutral-900"
                  )}
                >
                  {item.label}
                </Link>
              ))}
              {account ? (
                <div className="mt-4 border-t border-neutral-100 pt-4">
                  <p className="px-3 pb-2 text-xs font-medium text-neutral-400">Signed in</p>
                  <div className="flex items-center gap-3 rounded-lg px-3 py-2.5">
                    <Avatar src={account.image} name={account.name} size="sm" />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-neutral-900">{account.name}</p>
                      <p className="truncate text-xs text-neutral-500">{account.email}</p>
                    </div>
                  </div>
                  <Link href={workspace} className="mt-2 block rounded-lg px-3 py-2.5 text-sm font-medium text-neutral-800 hover:bg-neutral-50">
                    <Icon icon={Home01Icon} size={15} strokeWidth={1.8} className="shrink-0" />
                    Open dashboard
                  </Link>
                  <Link href={settingsHref} className="mt-1 block rounded-lg px-3 py-2.5 text-sm text-neutral-600 hover:bg-neutral-50 hover:text-neutral-900">
                    <Icon icon={Settings01Icon} size={15} strokeWidth={1.8} className="shrink-0" />
                    Account settings
                  </Link>
                </div>
              ) : null}
            </nav>
            <div className="border-t border-neutral-200 p-4">
              {account ? (
                <button
                  type="button"
                  onClick={signOut}
                  className="flex w-full items-center justify-center gap-2 rounded-lg border border-neutral-200 bg-white py-2.5 text-sm font-medium text-neutral-700 transition-colors hover:bg-neutral-50"
                >
                  <Icon icon={Logout01Icon} size={15} strokeWidth={1.8} className="shrink-0" />
                  Sign out
                </button>
              ) : (
                <div className="flex items-center gap-2">
                  <Button href="/login" variant="secondary" size="md" className="flex-1">
                    Log in
                  </Button>
                  <Button href="/register" size="md" className="flex-1">
                    Get started
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
