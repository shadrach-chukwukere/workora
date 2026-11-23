export interface ConnectionCounts {
  followersCount: number;
  followingCount: number;
}

export interface ConnectionStatus extends ConnectionCounts {
  connected: boolean;
  isSelf: boolean;
}

export interface ConnectionUser {
  id: string;
  name: string;
  image: string | null;
  account_type: "freelancer" | "client" | "admin";
  headline: string | null;
  company_name: string | null;
  connected_at: string;
}

export interface ConnectionList {
  users: ConnectionUser[];
  total: number;
  page: number;
  perPage: number;
}

export function connectionProfileHref(user: Pick<ConnectionUser, "id" | "account_type">): string {
  return user.account_type === "client" ? `/clients/${user.id}` : `/freelancers/${user.id}`;
}

export function connectionSubtitle(user: Pick<ConnectionUser, "headline" | "company_name" | "account_type">): string {
  return user.headline?.trim() || user.company_name?.trim() || (user.account_type === "client" ? "Client" : "Freelancer");
}
