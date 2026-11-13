import { redirect } from "next/navigation";
import { apiServer, ApiServerError, sessionCookie } from "@/lib/api-server";
import { ProjectsClient, type OwnProject } from "./projects-client";

interface OwnProjectsResponse {
  projects: OwnProject[];
}

interface ContractsResponse {
  contracts: { total_minor: string | number }[];
}

function isAuth(error: unknown): boolean {
  return error instanceof ApiServerError && (error.status === 401 || error.status === 403);
}

export default async function ClientProjectsPage() {
  const cookie = await sessionCookie();

  let projects: OwnProjectsResponse;
  let contractsRes: ContractsResponse;
  try {
    [projects, contractsRes] = await Promise.all([
      apiServer<OwnProjectsResponse>("/api/v1/users/me/projects", undefined, cookie),
      apiServer<ContractsResponse>("/api/v1/contracts", undefined, cookie),
    ]);
  } catch (error) {
    if (isAuth(error)) redirect("/login");
    throw error;
  }

  const lifetimeSpendMinor = (contractsRes.contracts ?? []).reduce((sum, c) => sum + Number(c.total_minor), 0);

  return <ProjectsClient projects={projects.projects ?? []} lifetimeSpendMinor={lifetimeSpendMinor} />;
}
