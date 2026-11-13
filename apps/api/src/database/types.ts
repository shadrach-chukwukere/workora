import type { ColumnType, Generated } from "kysely";

export type JsonObject = Record<string, unknown>;
export type JsonValue = JsonObject | JsonObject[] | string | number | boolean | null;

type Timestamp = ColumnType<Date, Date | undefined, Date | undefined>;

export interface UsersTable {
  id: Generated<string>;
  name: string;
  email: string;
  email_verified: ColumnType<boolean, boolean | undefined, boolean | undefined>;
  image: string | null;
  account_type: ColumnType<"freelancer" | "client" | "admin", "freelancer" | "client" | "admin" | undefined, "freelancer" | "client" | "admin" | undefined>;
  status: Generated<"active" | "suspended" | "restricted">;
  failed_logins: Generated<number>;
  locked_until: Date | null;
  created_at: Timestamp;
  updated_at: Timestamp;
}

export interface SessionsTable {
  id: Generated<string>;
  user_id: string;
  token: string;
  expires_at: Date;
  ip_address: string | null;
  user_agent: string | null;
  created_at: Timestamp;
  updated_at: Timestamp;
}

export interface AccountsTable {
  id: Generated<string>;
  user_id: string;
  account_id: string;
  provider_id: string;
  access_token: string | null;
  refresh_token: string | null;
  id_token: string | null;
  access_token_expires_at: Date | null;
  refresh_token_expires_at: Date | null;
  scope: string | null;
  password: string | null;
  created_at: Timestamp;
  updated_at: Timestamp;
}

export interface VerificationsTable {
  id: Generated<string>;
  identifier: string;
  value: string;
  expires_at: Date;
  created_at: Timestamp;
  updated_at: Timestamp;
}

export interface PermissionsTable {
  id: Generated<string>;
  key: string;
  description: string;
}

export interface RolesTable {
  id: Generated<string>;
  key: string;
  name: string;
  description: string | null;
  created_at: Timestamp;
}

export interface RolePermissionsTable {
  role_id: string;
  permission_id: string;
}

export interface UserRolesTable {
  user_id: string;
  role_id: string;
}

export interface FreelancerProfilesTable {
  user_id: string;
  headline: string;
  about: Generated<string>;
  hourly_rate_minor: number | null;
  currency: Generated<string>;
  availability: Generated<"available" | "limited" | "unavailable">;
  response_time_hours: Generated<number>;
  location: string | null;
  timezone: string | null;
  experience_level: "entry" | "intermediate" | "expert" | null;
  verified_identity: Generated<boolean>;
  verified_at: Date | null;
  rating_avg: string | null;
  rating_count: Generated<number>;
  completed_count: Generated<number>;
  earnings_minor: Generated<number>;
  created_at: Timestamp;
  updated_at: Timestamp;
}

export interface ClientProfilesTable {
  user_id: string;
  company_name: string | null;
  company_size: "1-10" | "11-50" | "51-200" | "201-1000" | "1000+" | null;
  industry: string | null;
  website: string | null;
  about: Generated<string>;
  rating_avg: string | null;
  rating_count: Generated<number>;
  spent_minor: Generated<number>;
  projects_count: Generated<number>;
  created_at: Timestamp;
  updated_at: Timestamp;
}

export interface CategoriesTable {
  id: Generated<string>;
  slug: string;
  name: string;
  description: string;
  parent_id: string | null;
  kind: Generated<"category" | "specialty">;
  sort_order: Generated<number>;
  created_at: Timestamp;
}

export interface SkillsTable {
  id: Generated<string>;
  slug: string;
  name: string;
  created_at: Timestamp;
}

export interface FreelancerSkillsTable {
  freelancer_id: string;
  skill_id: string;
}

export interface PortfolioProjectsTable {
  id: Generated<string>;
  freelancer_id: string;
  title: string;
  summary: string;
  description: Generated<string>;
  role: string | null;
  year: number | null;
  project_url: string | null;
  image_url: string | null;
  sort_order: Generated<number>;
  created_at: Timestamp;
}

export interface WorkExperiencesTable {
  id: Generated<string>;
  freelancer_id: string;
  company: string;
  role: string;
  start_date: ColumnType<Date, Date | string, Date | string | undefined>;
  end_date: ColumnType<Date, Date | string | undefined, Date | string | null | undefined> | null;
  description: Generated<string>;
  created_at: Timestamp;
}

export interface EducationTable {
  id: Generated<string>;
  freelancer_id: string;
  school: string;
  degree: string;
  field: string | null;
  start_year: number;
  end_year: number | null;
  created_at: Timestamp;
}

export interface CertificationsTable {
  id: Generated<string>;
  freelancer_id: string;
  name: string;
  issuer: string | null;
  year: number | null;
  credential_url: string | null;
  created_at: Timestamp;
}

export interface ProjectsTable {
  id: Generated<string>;
  client_id: string;
  title: string;
  summary: string;
  description: string;
  category_id: string | null;
  status: Generated<"draft" | "open" | "in_progress" | "paused" | "completed" | "cancelled" | "flagged">;
  budget_type: "fixed" | "hourly";
  budget_min_minor: number | null;
  budget_max_minor: number | null;
  currency: Generated<string>;
  experience_level: "entry" | "intermediate" | "expert" | null;
  duration_bucket: "lt-1m" | "1-3m" | "3-6m" | "gt-6m" | null;
  proposals_count: Generated<number>;
  invited_only: Generated<boolean>;
  published_at: Date | null;
  deadline: Date | null;
  close_reason: string | null;
  created_at: Timestamp;
  updated_at: Timestamp;
}

export interface ProjectSkillsTable {
  project_id: string;
  skill_id: string;
  position: Generated<number>;
}

export interface SavedProjectsTable {
  user_id: string;
  project_id: string;
  created_at: Timestamp;
}

export interface ProposalsTable {
  id: Generated<string>;
  project_id: string;
  freelancer_id: string;
  cover_letter: string;
  bid_type: "fixed" | "hourly";
  bid_amount_minor: number;
  duration_days: number | null;
  status: Generated<"pending" | "shortlisted" | "accepted" | "rejected" | "withdrawn">;
  submitted_at: Timestamp;
  updated_at: Timestamp;
}

export interface ProposalAttachmentsTable {
  id: Generated<string>;
  proposal_id: string;
  file_name: string;
  url: string;
  size_bytes: number;
  created_at: Timestamp;
}

export interface ContractsTable {
  id: Generated<string>;
  project_id: string;
  client_id: string;
  freelancer_id: string;
  proposal_id: string | null;
  title_snapshot: string;
  total_minor: number;
  currency: Generated<string>;
  status: Generated<"active" | "completed" | "cancelled" | "paused" | "disputed">;
  started_at: Timestamp;
  ended_at: Date | null;
  cancel_reason: string | null;
  created_at: Timestamp;
  updated_at: Timestamp;
}

export interface ContractMilestonesTable {
  id: Generated<string>;
  contract_id: string;
  title: string;
  description: Generated<string>;
  amount_minor: number;
  sequencing: Generated<number>;
  status: Generated<"upcoming" | "funded" | "in_review" | "revision" | "approved" | "paid" | "cancelled">;
  due_date: Date | null;
  funded_at: Date | null;
  in_review_at: Date | null;
  approved_at: Date | null;
  paid_at: Date | null;
  created_at: Timestamp;
  updated_at: Timestamp;
}

export interface ContractDeliverablesTable {
  id: Generated<string>;
  contract_id: string;
  milestone_id: string | null;
  title: string;
  note: Generated<string>;
  url: string | null;
  submitted_by: string;
  submitted_at: Timestamp;
}

export interface ContractEventsTable {
  id: Generated<string>;
  contract_id: string;
  actor_id: string | null;
  kind: string;
  payload: ColumnType<JsonValue, JsonValue, JsonValue>;
  created_at: Timestamp;
}

export interface SubscriptionPlansTable {
  id: Generated<string>;
  code: string;
  name: string;
  audience: "freelancer" | "client";
  price_minor: Generated<number>;
  currency: Generated<string>;
  interval: "monthly" | "annual";
  features: Generated<string[]>;
  is_highlighted: Generated<boolean>;
  is_active: Generated<boolean>;
  sort_order: Generated<number>;
  created_at: Timestamp;
}

export interface SubscriptionsTable {
  id: Generated<string>;
  user_id: string;
  plan_id: string;
  status: Generated<"active" | "canceled" | "past_due">;
  interval: "monthly" | "annual";
  amount_minor: number;
  currency: Generated<string>;
  provider: Generated<"stripe" | "paystack" | "manual">;
  provider_subscription_id: string | null;
  started_at: Timestamp;
  current_period_end: Date | null;
  canceled_at: Date | null;
  created_at: Timestamp;
  updated_at: Timestamp;
}

export interface PaymentMethodsTable {
  id: Generated<string>;
  user_id: string;
  provider: "stripe" | "paystack";
  provider_method_id: string;
  brand: string | null;
  last_four: string | null;
  exp_month: number | null;
  exp_year: number | null;
  is_default: Generated<boolean>;
  created_at: Timestamp;
}

export interface ProcessedWebhooksTable {
  id: string;
  provider: "stripe" | "paystack" | "resend";
  received_at: Timestamp;
  payload: ColumnType<JsonValue, JsonValue, JsonValue>;
}

export interface PaymentsTable {
  id: Generated<string>;
  user_id: string;
  provider: "stripe" | "paystack";
  type: Generated<"payment" | "payout">;
  kind: "milestone" | "subscription" | "topup" | "payout_fee";
  provider_ref: string;
  amount_minor: number;
  fee_minor: Generated<number>;
  currency: string;
  status: Generated<"pending" | "succeeded" | "failed" | "refunded">;
  contract_id: string | null;
  milestone_id: string | null;
  metadata: Generated<JsonObject>;
  created_at: Timestamp;
  updated_at: Timestamp;
}

export interface PayoutsTable {
  id: Generated<string>;
  user_id: string;
  provider: Generated<"stripe" | "paystack" | "manual">;
  provider_ref: string | null;
  amount_minor: number;
  fee_minor: Generated<number>;
  currency: string;
  status: Generated<"pending" | "processing" | "paid" | "failed" | "cancelled">;
  note: string | null;
  created_at: Timestamp;
  updated_at: Timestamp;
}

export interface RefundsTable {
  id: Generated<string>;
  payment_id: string;
  amount_minor: number;
  reason: string;
  status: Generated<"requested" | "approved" | "rejected" | "processed">;
  requested_by: string;
  decided_by: string | null;
  created_at: Timestamp;
  updated_at: Timestamp;
}

export interface TransactionsTable {
  id: Generated<string>;
  user_id: string;
  type: "milestone" | "commission" | "refund" | "withdrawal" | "topup" | "payout" | "payment";
  amount_minor: number;
  currency: string;
  status: Generated<"pending" | "completed" | "failed">;
  counterparty_id: string | null;
  contract_id: string | null;
  payment_id: string | null;
  payout_id: string | null;
  description: string;
  created_at: Timestamp;
}

export interface PlatformFeesTable {
  id: Generated<string>;
  contract_id: string | null;
  milestone_id: string | null;
  amount_minor: number;
  rate_bps: number;
  currency: string;
  created_at: Timestamp;
}

export interface InvoicesTable {
  id: Generated<string>;
  user_id: string;
  kind: "subscription" | "payment";
  ref: string;
  amount_minor: number;
  currency: string;
  issued_at: Timestamp;
  status: Generated<"open" | "paid" | "void">;
  created_at: Timestamp;
}

export interface ConversationsTable {
  id: Generated<string>;
  kind: Generated<"direct" | "contract">;
  contract_id: string | null;
  created_at: Timestamp;
}

export interface ConversationParticipantsTable {
  conversation_id: string;
  user_id: string;
  joined_at: Timestamp;
  last_read_at: Date | null;
  is_muted: Generated<boolean>;
}

export interface MessagesTable {
  id: Generated<string>;
  conversation_id: string;
  sender_id: string | null;
  body: string;
  edited_at: Date | null;
  deleted_at: Date | null;
  created_at: Timestamp;
}

export interface MessageAttachmentsTable {
  id: Generated<string>;
  message_id: string;
  file_name: string;
  url: string;
  mime_type: string;
  size_bytes: number;
  created_at: Timestamp;
}

export interface NotificationsTable {
  id: Generated<string>;
  user_id: string;
  type: "proposal" | "contract" | "message" | "payment" | "review" | "verification" | "system" | "dispute";
  title: string;
  body: string;
  url: string | null;
  entity_type: string | null;
  entity_id: string | null;
  is_read: Generated<boolean>;
  created_at: Timestamp;
}

export interface NotificationPreferencesTable {
  user_id: string;
  email_proposal: Generated<boolean>;
  email_contract: Generated<boolean>;
  email_payment: Generated<boolean>;
  email_review: Generated<boolean>;
  email_marketing: Generated<boolean>;
  updated_at: Timestamp;
}

export interface ReviewsTable {
  id: Generated<string>;
  contract_id: string;
  reviewer_id: string;
  reviewee_id: string;
  rating: number;
  comment: Generated<string>;
  created_at: Timestamp;
}

export interface ReviewReportsTable {
  id: Generated<string>;
  review_id: string;
  reporter_id: string;
  reason: string;
  status: Generated<"open" | "reviewed" | "dismissed">;
  created_at: Timestamp;
}

export interface DisputesTable {
  id: Generated<string>;
  contract_id: string;
  opened_by: string;
  assigned_to: string | null;
  status: Generated<"open" | "under_review" | "resolved" | "withdrawn" | "closed">;
  reason: string;
  details: string;
  amount_minor: number;
  currency: Generated<string>;
  resolution: string | null;
  resolution_outcome: "freelancer" | "client" | "split" | "no_action" | null;
  opened_at: Timestamp;
  resolved_at: Date | null;
  updated_at: Timestamp;
}

export interface DisputeEvidenceTable {
  id: Generated<string>;
  dispute_id: string;
  file_name: string;
  url: string;
  mime_type: string;
  uploaded_by: string;
  created_at: Timestamp;
}

export interface DisputeNotesTable {
  id: Generated<string>;
  dispute_id: string;
  author_id: string;
  body: string;
  created_at: Timestamp;
}

export interface VerificationRequestsTable {
  id: Generated<string>;
  user_id: string;
  status: Generated<"pending" | "info_requested" | "approved" | "rejected">;
  document_type: string;
  submitted_at: Timestamp;
  decided_at: Date | null;
  decided_by: string | null;
  notes: string | null;
}

export interface VerificationDocumentsTable {
  id: Generated<string>;
  request_id: string;
  file_name: string;
  url: string;
  mime_type: string;
  size_bytes: number;
  created_at: Timestamp;
}

export interface AdminLogsTable {
  id: Generated<string>;
  actor_id: string;
  action: string;
  target_type: string;
  target_id: string | null;
  before_json: JsonObject | null;
  after_json: JsonObject | null;
  ip: string | null;
  request_id: string | null;
  created_at: Timestamp;
}

export interface ModerationActionsTable {
  id: Generated<string>;
  actor_id: string;
  target_type: string;
  target_id: string;
  action: string;
  reason: string;
  created_at: Timestamp;
}

export interface PlatformSettingsTable {
  key: string;
  value: JsonObject;
  updated_by: string | null;
  updated_at: Timestamp;
}

export interface ReportsTable {
  id: Generated<string>;
  kind: string;
  params: Generated<JsonObject>;
  generated_by: string;
  created_at: Timestamp;
}

export interface DB {
  users: UsersTable;
  sessions: SessionsTable;
  accounts: AccountsTable;
  verifications: VerificationsTable;
  permissions: PermissionsTable;
  roles: RolesTable;
  role_permissions: RolePermissionsTable;
  user_roles: UserRolesTable;
  freelancer_profiles: FreelancerProfilesTable;
  client_profiles: ClientProfilesTable;
  categories: CategoriesTable;
  skills: SkillsTable;
  freelancer_skills: FreelancerSkillsTable;
  portfolio_projects: PortfolioProjectsTable;
  work_experiences: WorkExperiencesTable;
  education: EducationTable;
  certifications: CertificationsTable;
  projects: ProjectsTable;
  project_skills: ProjectSkillsTable;
  saved_projects: SavedProjectsTable;
  proposals: ProposalsTable;
  proposal_attachments: ProposalAttachmentsTable;
  contracts: ContractsTable;
  contract_milestones: ContractMilestonesTable;
  contract_deliverables: ContractDeliverablesTable;
  contract_events: ContractEventsTable;
  subscription_plans: SubscriptionPlansTable;
  subscriptions: SubscriptionsTable;
  payment_methods: PaymentMethodsTable;
  processed_webhooks: ProcessedWebhooksTable;
  payments: PaymentsTable;
  payouts: PayoutsTable;
  refunds: RefundsTable;
  transactions: TransactionsTable;
  platform_fees: PlatformFeesTable;
  invoices: InvoicesTable;
  conversations: ConversationsTable;
  conversation_participants: ConversationParticipantsTable;
  messages: MessagesTable;
  message_attachments: MessageAttachmentsTable;
  notifications: NotificationsTable;
  notification_preferences: NotificationPreferencesTable;
  reviews: ReviewsTable;
  review_reports: ReviewReportsTable;
  disputes: DisputesTable;
  dispute_evidence: DisputeEvidenceTable;
  dispute_notes: DisputeNotesTable;
  verification_requests: VerificationRequestsTable;
  verification_documents: VerificationDocumentsTable;
  admin_logs: AdminLogsTable;
  moderation_actions: ModerationActionsTable;
  platform_settings: PlatformSettingsTable;
  reports: ReportsTable;
}
