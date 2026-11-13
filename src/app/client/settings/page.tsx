import { redirect } from "next/navigation";
import { apiServer, ApiServerError, sessionCookie } from "@/lib/api-server";
import { SettingsClient, type AccountInitial, type BusinessInitial } from "./settings-client";

interface MeResponse {
  user: {
    id: string;
    name: string;
    email: string;
    image: string | null;
    account_type: string;
    company_name: string | null;
    company_size: string | null;
    industry: string | null;
    spent_minor: string | number | null;
    projects_count: number | null;
  };
}

interface ClientResponse {
  client: {
    id: string;
    company_name: string | null;
    company_size: string | null;
    industry: string | null;
    about: string | null;
    rating_avg: string | null;
    rating_count: number | null;
  };
}

function isAuth(error: unknown): boolean {
  return error instanceof ApiServerError && (error.status === 401 || error.status === 403);
}

export default async function ClientSettingsPage() {
  const cookie = await sessionCookie();

  let me: MeResponse;
  let client: ClientResponse | null = null;
  try {
    me = await apiServer<MeResponse>("/api/v1/users/me", undefined, cookie);
    try {
      client = await apiServer<ClientResponse>(
        `/api/v1/clients/${encodeURIComponent(me.user.id)}`,
        undefined,
        cookie,
      );
    } catch (error) {
      if (isAuth(error)) redirect("/login");
      /* Optional section: a missing client row should not blank the whole page. */
      client = null;
    }
  } catch (error) {
    if (isAuth(error)) redirect("/login");
    throw error;
  }

  const user = me.user;
  const business: BusinessInitial = {
    companyName: client?.client.company_name ?? user.company_name ?? "",
    companySize: client?.client.company_size ?? user.company_size ?? "",
    industry: client?.client.industry ?? user.industry ?? "",
    about: client?.client.about ?? "",
  };
  const account: AccountInitial = {
    name: user.name,
    email: user.email,
    image: user.image ?? "",
    accountType: user.account_type,
    spentMinor: Number(user.spent_minor ?? 0),
    projectsCount: Number(user.projects_count ?? 0),
  };

  return <SettingsClient business={business} account={account} />;
}
