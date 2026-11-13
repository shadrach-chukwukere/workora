/* Route maps for the three dashboards. Icon names reference src/lib/icons.ts
 (every entry must exist in that surface). Badges are computed by the shell. */

export interface NavItem {
 href: string;
 label: string;
 icon: string;
 /** Which runtime counter drives the badge. */
 badge?: "messages" | "proposals" | "review" | "verification" | "disputes" | "flagged";
 exact?: boolean;
}

export interface NavSection {
 title: string;
 items: NavItem[];
}

export const freelancerNav: NavSection[] = [
 {
 title: "Overview",
 items: [{ href: "/freelancer/dashboard", label: "Dashboard", icon: "Home01Icon", exact: true }],
 },
 {
 title: "Work",
 items: [
 { href: "/freelancer/projects", label: "Find projects", icon: "JobSearchIcon" },
 { href: "/freelancer/proposals", label: "Proposals", icon: "SentIcon", badge: "proposals" },
 { href: "/freelancer/contracts", label: "Contracts", icon: "HandshakeIcon", badge: "review" },
 { href: "/freelancer/messages", label: "Messages", icon: "Message01Icon", badge: "messages" },
 ],
 },
 {
 title: "Money",
 items: [
 { href: "/freelancer/earnings", label: "Earnings", icon: "Wallet01Icon" },
 { href: "/freelancer/transactions", label: "Transactions", icon: "CreditCardIcon" },
 ],
 },
 {
 title: "Reputation",
 items: [
 { href: "/freelancer/portfolio", label: "Portfolio", icon: "Image02Icon" },
 { href: "/freelancer/reviews", label: "Reviews", icon: "StarIcon" },
 { href: "/freelancer/settings", label: "Settings", icon: "Settings01Icon" },
 ],
 },
];

export const clientNav: NavSection[] = [
 {
 title: "Overview",
 items: [{ href: "/client/dashboard", label: "Dashboard", icon: "Home01Icon", exact: true }],
 },
 {
 title: "Hiring",
 items: [
 { href: "/client/post-project", label: "Post a project", icon: "Pen01Icon" },
 { href: "/client/projects", label: "Projects", icon: "Briefcase02Icon" },
 { href: "/client/proposals", label: "Proposals", icon: "File02Icon" },
 { href: "/client/contracts", label: "Contracts", icon: "HandshakeIcon", badge: "review" },
 { href: "/client/messages", label: "Messages", icon: "Message01Icon", badge: "messages" },
 ],
 },
 {
 title: "Money",
 items: [
 { href: "/client/payments", label: "Payments", icon: "Payment01Icon" },
 { href: "/client/transactions", label: "Transactions", icon: "CreditCardIcon" },
 ],
 },
 {
 title: "Reputation",
 items: [
 { href: "/client/reviews", label: "Reviews", icon: "StarIcon" },
 { href: "/client/settings", label: "Settings", icon: "Settings01Icon" },
 ],
 },
];

export const adminNav: NavSection[] = [
 {
 title: "Overview",
 items: [
 { href: "/admin/dashboard", label: "Dashboard", icon: "Home01Icon", exact: true },
 { href: "/admin/analytics", label: "Analytics", icon: "Analytics02Icon" },
 ],
 },
 {
 title: "People",
 items: [
 { href: "/admin/users", label: "Users", icon: "UserMultiple02Icon" },
 { href: "/admin/freelancers", label: "Freelancers", icon: "UserCircleIcon" },
 { href: "/admin/clients", label: "Clients", icon: "Building01Icon" },
 ],
 },
 {
 title: "Marketplace",
 items: [
 { href: "/admin/projects", label: "Listings", icon: "Briefcase02Icon", badge: "flagged" },
 { href: "/admin/contracts", label: "Contracts", icon: "HandshakeIcon" },
 { href: "/admin/transactions", label: "Transactions", icon: "CreditCardIcon" },
 { href: "/admin/disputes", label: "Disputes", icon: "Alert02Icon", badge: "disputes" },
 { href: "/admin/reviews", label: "Reviews", icon: "StarIcon", badge: "review" },
 { href: "/admin/categories", label: "Categories", icon: "Tag01Icon" },
 ],
 },
 {
 title: "Trust & billing",
 items: [
 { href: "/admin/verification", label: "Verification", icon: "StampIcon", badge: "verification" },
 { href: "/admin/subscriptions", label: "Subscriptions", icon: "CrownIcon" },
 ],
 },
 {
 title: "Platform",
 items: [
 { href: "/admin/reports", label: "Reports", icon: "ChartLineIcon" },
 { href: "/admin/notifications", label: "Notifications", icon: "Notification01Icon" },
 { href: "/admin/settings", label: "Settings", icon: "Settings01Icon" },
 ],
 },
];

export const navForRole = {
 freelancer: freelancerNav,
 client: clientNav,
 admin: adminNav,
} as const;

export type NavRoleKey = keyof typeof navForRole;

/* Public site */
export const publicNav = [
 { href: "/find-talent", label: "Find talent" },
 { href: "/find-work", label: "Find work" },
//  { href: "/categories", label: "Categories" },
 { href: "/pricing", label: "Pricing" }] as const;
