/* ─── Domain types ─────────────────────────────────────────────────────────────
 Shared by every mock data module and page. When the real API arrives these
 shapes are the contract the API layer must satisfy. */

export type Role = "freelancer" | "client" | "admin";

export interface User {
 id: string;
 name: string;
 email: string;
 role: Role;
 avatarUrl: string | null;
 country: string;
 city?: string;
 timezone?: string;
 createdAt: string;
 status: "active" | "suspended" | "restricted";
 verified: boolean;
 lastActiveAt: string;
}

export interface CurrentAccount {
 user: User;
 /** Profile is optional for admins, who operate without a marketplace profile. */
 freelancer?: FreelancerProfile;
 client?: ClientProfile;
}

/* ─── Profiles ──────────────────────────────────────────────────────────────── */

export type Availability = "available" | "limited" | "unavailable";
export type ExperienceLevel = "entry" | "intermediate" | "expert";

export interface PortfolioItem {
 id: string;
 title: string;
 description: string;
 imageUrl: string;
 tags: string[];
 link?: string;
 year: number;
}

export interface WorkExperience {
 id: string;
 company: string;
 role: string;
 start: string;
 end?: string;
 current?: boolean;
 description: string;
}

export interface EducationItem {
 id: string;
 school: string;
 degree: string;
 field: string;
 start: string;
 end?: string;
}

export interface FreelancerProfile {
 userId: string;
 username: string;
 headline: string;
 about: string;
 categoryId: string;
 subcategory?: string;
 skills: string[];
 hourlyRate: number;
 experienceLevel: ExperienceLevel;
 availability: Availability;
 rating: number;
 reviewsCount: number;
 completedProjects: number;
 successRate: number;
 responseTimeHours: number;
 totalEarnings: number;
 portfolio: PortfolioItem[];
 experience: WorkExperience[];
 education: EducationItem[];
 certifications: string[];
 languages: { language: string; level: "basic" | "conversational" | "fluent" | "native" }[];
}

export interface ClientProfile {
 userId: string;
 username: string;
 type: "individual" | "business";
 companyName?: string;
 industry: string;
 companySize?: "1-10" | "11-50" | "51-200" | "201-1000" | "1000+";
 about: string;
 website?: string;
 rating: number;
 projectsPosted: number;
 totalSpent: number;
 hourlyRateNote?: string;
}

/* ─── Catalog ───────────────────────────────────────────────────────────────── */

export interface Category {
 id: string;
 name: string;
 slug: string;
 description: string;
 freelancerCount: number;
 projectCount: number;
 skills: string[];
}

/* ─── Projects ──────────────────────────────────────────────────────────────── */

export type BudgetType = "fixed" | "hourly";
export type ProjectDuration = "lt-1m" | "1-3m" | "3-6m" | "gt-6m";
export type ProjectStatus = "draft" | "open" | "in_progress" | "completed" | "cancelled" | "flagged";
export type ProjectLocation = "worldwide" | string;

export interface Project {
 id: string;
 title: string;
 description: string;
 categoryId: string;
 skills: string[];
 budgetType: BudgetType;
 budgetMin?: number;
 budgetMax?: number;
 fixedBudget?: number;
 duration: ProjectDuration;
 experienceLevel: ExperienceLevel;
 status: ProjectStatus;
 location: ProjectLocation;
 clientId: string;
 publishedAt: string;
 deadline: string;
 proposalsCount: number;
 featured: boolean;
 attachmentsCount: number;
 /** Set when a client has marked the project private during review. */
 invitedOnly?: boolean;
}

/* ─── Proposals ─────────────────────────────────────────────────────────────── */

export type ProposalStatus = "pending" | "shortlisted" | "accepted" | "rejected" | "withdrawn";

export interface ProposalMilestone {
 title: string;
 amount: number;
 dueDays: number;
}

export interface Proposal {
 id: string;
 projectId: string;
 freelancerId: string;
 coverLetter: string;
 bidType: BudgetType;
 bid: number;
 timelineWeeks: number;
 milestones?: ProposalMilestone[];
 portfolioItemIds: string[];
 status: ProposalStatus;
 submittedAt: string;
 viewed: boolean;
}

/* ─── Contracts ─────────────────────────────────────────────────────────────── */

export type ContractStatus = "active" | "completed" | "cancelled" | "paused";
export type MilestoneStatus = "upcoming" | "funded" | "in_review" | "revision" | "approved" | "paid";

export interface Milestone {
 id: string;
 title: string;
 description?: string;
 amount: number;
 dueDate: string;
 status: MilestoneStatus;
 submittedAt?: string;
 deliverables?: string;
 feedback?: string;
}

export interface Contract {
 id: string;
 projectId: string;
 clientId: string;
 freelancerId: string;
 title: string;
 budgetType: BudgetType;
 hourlyRate?: number;
 totalValue: number;
 milestones: Milestone[];
 status: ContractStatus;
 startedAt: string;
 completedAt?: string;
 revisionsAllowed: number;
 /** Remaining revision requests, decremented client-side on each request. */
 revisionsLeft: number;
}

/* ─── Money ─────────────────────────────────────────────────────────────────── */

export type TransactionType = "payment" | "payout" | "commission" | "refund" | "withdrawal" | "failed";
export type TransactionStatus = "completed" | "pending" | "failed";

export interface Transaction {
 id: string;
 userId: string;
 type: TransactionType;
 amount: number;
 fee: number;
 net: number;
 method: string;
 status: TransactionStatus;
 date: string;
 relatedContractId?: string;
 description: string;
}

export type WithdrawalStatus = "pending" | "processing" | "paid" | "failed";

export interface Withdrawal {
 id: string;
 userId: string;
 amount: number;
 method: string;
 destination: string;
 status: WithdrawalStatus;
 requestedAt: string;
 expectedAt: string;
 fee: number;
}

export interface EarningsPoint {
 month: string;
 earnings: number;
 commissions: number;
}

/* ─── Reputation ────────────────────────────────────────────────────────────── */

export interface Review {
 id: string;
 contractId: string;
 projectTitle: string;
 authorId: string;
 authorRole: "freelancer" | "client";
 targetId: string;
 rating: number;
 comment: string;
 date: string;
 reply?: { text: string; date: string };
 reported?: boolean;
}

/* ─── Messaging ─────────────────────────────────────────────────────────────── */

export interface MessageAttachment {
 name: string;
 size: string;
 type: string;
}

export interface Message {
 id: string;
 threadId: string;
 senderId: string;
 body: string;
 sentAt: string;
 read: boolean;
 attachments?: MessageAttachment[];
}

export interface Thread {
 id: string;
 participants: string[];
 subject: string;
 projectId?: string;
 unread: number;
 lastMessageAt: string;
}

/* ─── Trust & safety ────────────────────────────────────────────────────────── */

export type DisputeStatus = "open" | "under_review" | "resolved" | "closed";

export interface Dispute {
 id: string;
 contractId: string;
 openedById: string;
 againstId: string;
 reason: string;
 description: string;
 amountAtStake: number;
 status: DisputeStatus;
 openedAt: string;
 resolvedAt?: string;
 evidence: { name: string; size: string; type: string; date: string }[];
 adminNotes?: string;
 resolution?: string;
 messages: { byId: string; role: "freelancer" | "client"; text: string; date: string }[];
}

/* ─── Platform ──────────────────────────────────────────────────────────────── */

export interface Notification {
 id: string;
 userId: string;
 type: "proposal" | "message" | "contract" | "payment" | "system" | "review";
 title: string;
 body: string;
 date: string;
 read: boolean;
 href?: string;
}

export type VerificationStatus = "approved" | "rejected" | "pending" | "info_requested" | "not_submitted";

export interface VerificationRequest {
 id: string;
 userId: string;
 submittedAt: string;
 status: VerificationStatus;
 documentType: string;
 documentRef: string;
 notes?: string;
}

export interface SubscriptionPlan {
 id: string;
 name: string;
 audience: "freelancer" | "client";
 price: number;
 interval: "monthly" | "annual";
 highlight?: boolean;
 features: string[];
 extras?: string;
}

export interface PlatformStat {
 usersCount: number;
 freelancersCount: number;
 clientsCount: number;
 projectsCount: number;
 activeProjects: number;
 contractsCompleted: number;
 revenue: number;
 volume: number;
 pendingVerifications: number;
 openDisputes: number;
}

/* ─── Billing (admin subscriptions page) ───────────────────────────────────── */

export interface Subscription {
 id: string;
 userId: string;
 planId: string;
 status: "active" | "canceled" | "past_due";
 interval: "monthly" | "annual";
 amount: number;
 startedAt: string;
 renewsAt?: string;
 endedAt?: string;
}

/* ─── Analytics series (admin) ─────────────────────────────────────────────── */

export interface MonthlyAnalytics {
 month: string;
 label: string;
 signups: number;
 projectsPosted: number;
 contractsStarted: number;
 volume: number;
 revenue: number;
 /** True when the row only covers part of the month (month-to-date). */
 isPartial?: boolean;
}
