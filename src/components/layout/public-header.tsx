"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { DropdownMenu } from "@/components/ui/dropdown-menu";
import { Logo } from "@/components/ui/logo";
import { HeaderSearch } from "@/components/layout/header-search";
import { NavDropdown, type NavDropdownItem } from "@/components/layout/nav-dropdown";
import { publicNav } from "@/lib/navigation";
import {
  Icon,
  Logout01Icon,
  Menu01Icon,
  Search01Icon,
  MultiplicationSignIcon,
  Home01Icon,
  Settings01Icon,
  UserAccountIcon,
  Briefcase02Icon,
  Pen01Icon,
} from "@/lib/icons";
import { workspacePathForRole, type SessionAccount } from "@/lib/workspace";
import { cn } from "@/lib/utils";
import { signOut } from "@/lib/sign-out";
import { ArrowRight01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";

interface PublicHeaderProps {
  /** Signed-in account resolved server-side; null when signed out. */
  account?: SessionAccount | null;
}

const hireTalentItems: NavDropdownItem[] = [
  { label: "Find talent", href: "/find-talent", description: "Browse vetted freelancers by skill", icon: <Icon icon={UserAccountIcon} size={16} strokeWidth={1.8} /> },
  { label: "Post a project", href: "/client/post-project", description: "Share your brief and get proposals", icon: <Icon icon={Pen01Icon} size={16} strokeWidth={1.8} /> },
];

const findWorkItems: NavDropdownItem[] = [
  { label: "Browse briefs", href: "/find-work", description: "Open projects with public budgets", icon: <Icon icon={Briefcase02Icon} size={16} strokeWidth={1.8} /> },
  { label: "Saved projects", href: "/freelancer/saved", description: "Keep the briefs you want to revisit", icon: <Icon icon={Settings01Icon} size={16} strokeWidth={1.8} /> },
];

export function PublicHeader({ account = null }: PublicHeaderProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    if (menuOpen) {
      document.body.classList.add("menu-open");
    } else {
      document.body.classList.remove("menu-open");
    }
    return () => {
      document.body.classList.remove("menu-open");
    };
  }, [menuOpen]);

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);
  const workspace = workspacePathForRole(account?.role);
  const settingsHref = account ? `/${account.role}/settings` : "/login";

  const handleSignOut = async () => {
    if (signingOut) return;
    setSigningOut(true);
    setMenuOpen(false);
    toast.success("Signed out");
    await signOut("/login");
  };

  const accountItems = account
    ? [
        { type: "label" as const, label: `${account.name} · ${account.email}` },
        { type: "item" as const, label: "Open dashboard", onClick: () => router.push(workspace) },
        { type: "item" as const, label: "Account settings", onClick: () => router.push(settingsHref) },
        { type: "separator" as const },
        {
          type: "item" as const,
          label: signingOut ? "Signing out…" : "Sign out",
          danger: true,
          disabled: signingOut,
          onClick: handleSignOut,
        },
      ]
    : [];

  return (
    <>
      <a href="#main-content" className="skip-link">
        Skip to content
      </a>

      <header className="sticky top-0 z-40 bg-white/80 backdrop-blur supports-backdrop-filter:bg-white/94 border-b border-neutral-200/50">
        <div className="container-page flex h-14 w-full items-center justify-between gap-x-3 px-4 sm:px-6 lg:px-8">
          {/* Brand — always visible on left */}
          <div className="flex min-w-0 shrink-0 items-center gap-2">
            <Logo className="shrink-0" size="sm" />
          </div>

          {/* Primary navigation (desktop only) */}
          <nav aria-label="Primary" className="hidden items-center gap-1 shrink-0 md:flex md:ml-4">
            <NavDropdown label="Hire talent" items={hireTalentItems} active={isActive("/find-talent")} />
            <NavDropdown label="Find work" items={findWorkItems} active={isActive("/find-work")} />
            {publicNav
              .filter((item) => item.href === "/pricing")
              .map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "inline-flex items-center rounded-lg px-2.5 py-2 text-sm font-medium transition-colors hover:bg-neutral-100 hover:text-neutral-900",
                    isActive(item.href) ? "text-neutral-900" : "text-neutral-600",
                  )}
                  aria-current={isActive(item.href) ? "page" : undefined}
                >
                  {item.label}
                </Link>
              ))}
          </nav>

          {/* Right side: search (desktop), account actions, hamburger */}
          <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
            {/* Search — desktop only */}
            <div className="hidden md:flex items-center">
              <HeaderSearch />
            </div>

            {/* Account actions — signed in */}
            {account ? (
              <>
                <Link
                  href={workspace}
                  className="hidden sm:inline-flex items-center gap-2 rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm font-medium text-neutral-700 transition-colors hover:bg-neutral-50 hover:text-neutral-900"
                >
                  <Icon icon={Home01Icon} size={14} strokeWidth={1.8} className="shrink-0" />
                  Dashboard
                </Link>
                <DropdownMenu
                  label="Account menu"
                  trigger={
                    <button
                      type="button"
                      aria-label="Account menu"
                      className="inline-flex size-10 items-center justify-center rounded-full text-neutral-600 ring-1 ring-neutral-200 transition-shadow hover:ring-brand-300 touch-target"
                    >
                      <Avatar src={account.image} name={account.name} size="sm" />
                    </button>
                  }
                  items={accountItems}
                />
              </>
            ) : (
              <>
                <Button
                  href="/login"
                  size="md"
                  className="hidden sm:inline-flex items-center gap-1.5 rounded-full border border-neutral-200 bg-white px-3.5 py-2 text-sm font-medium text-neutral-700 transition-colors hover:bg-neutral-50 hover:text-neutral-900"
                >
                  Log in
                </Button>
                <Button href="/register" size="md" className="hidden sm:inline-flex rounded-full px-4">
                  Get started
                  <HugeiconsIcon icon={ArrowRight01Icon} />
                </Button>
              </>
            )}

            {/* Hamburger — mobile only */}
            <button
              type="button"
              onClick={() => setMenuOpen(true)}
              aria-label="Open menu"
              className="inline-flex size-10 items-center justify-center rounded-full border border-neutral-200 bg-white text-neutral-600 transition-colors hover:border-neutral-300 hover:bg-neutral-50 md:hidden touch-target"
            >
              <Icon icon={Menu01Icon} size={19} strokeWidth={1.8} />
            </button>
          </div>
        </div>
      </header>

      {/* Mobile drawer */}
      {menuOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Site menu">
          <button type="button" aria-label="Close menu" className="absolute inset-0 bg-neutral-900/40 backdrop-blur-sm" onClick={() => setMenuOpen(false)} />
          <div className="anim-pop absolute inset-y-0 right-0 flex w-full max-w-[85vw] flex-col border-l border-neutral-200 bg-white shadow-dropdown">
            <div className="flex h-14 items-center justify-between border-b border-neutral-200 px-4">
              <Logo size="md" />
              <button
                type="button"
                onClick={() => setMenuOpen(false)}
                aria-label="Close menu"
                className="inline-flex size-10 items-center justify-center rounded-full text-neutral-600 hover:bg-neutral-100 touch-target"
              >
                <Icon icon={MultiplicationSignIcon} size={20} strokeWidth={1.8} />
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
                  className="w-full h-10 rounded-xl border border-neutral-200 bg-white pl-10 pr-4 text-sm text-neutral-900 placeholder:text-neutral-400 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600"
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
                  <Link href={workspace} className="mt-2 flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium text-neutral-800 hover:bg-neutral-50">
                    <Icon icon={Home01Icon} size={15} strokeWidth={1.8} className="shrink-0" />
                    Open dashboard
                  </Link>
                  <Link href={settingsHref} className="mt-1 flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm text-neutral-600 hover:bg-neutral-50 hover:text-neutral-900">
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
                  onClick={handleSignOut}
                  disabled={signingOut}
                  className="flex w-full items-center justify-center gap-2 rounded-lg border border-neutral-200 bg-white py-2.5 text-sm font-medium text-neutral-700 transition-colors hover:bg-neutral-50 disabled:opacity-50 touch-target"
                >
                  <Icon icon={Logout01Icon} size={15} strokeWidth={1.8} className="shrink-0" />
                  {signingOut ? "Signing out…" : "Sign out"}
                </button>
              ) : (
                <div className="flex flex-col items-center gap-2">
                  <Button href="/login" variant="secondary" size="md" className="w-full rounded-full">
                    Log in
                  </Button>
                  <Button href="/register" size="md" className="w-full rounded-full">
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