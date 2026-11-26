/** Scopes exposed by the Workora MCP server. Keep in sync with MCP_SCOPES in docs. */
export const MCP_SCOPES = [
  "freelancers:read",
  "projects:read",
  "profile:read",
  "profile:write",
  "messages:read",
  "messages:write",
  "proposals:read",
  "proposals:write",
  "jobs:read",
  "jobs:write",
  "invitations:read",
  "invitations:write",
  "contracts:read",
  "notifications:read",
  "connections:read",
  "messages:read",
  "messages:write",
  "profile:write",
] as const;

export type McpScope = (typeof MCP_SCOPES)[number];

export const SCOPE_DESCRIPTIONS: Record<McpScope, string> = {
  "freelancers:read": "Search freelancers and view public profiles",
  "projects:read": "Search projects and view public project details",
  "profile:read": "Read your own profile and account summary",
  "profile:write": "Update your own public profile fields",
  "messages:read": "Read messages in conversations you already participate in",
  "messages:write": "Send a message in an existing conversation (with confirmation)",
  "proposals:read": "Read your submitted proposals",
  "proposals:write": "Prepare and submit your proposals",
  "jobs:read": "Read your client projects and invitations",
  "jobs:write": "Create job drafts and publish your projects",
  "invitations:read": "Read project invitations",
  "invitations:write": "Accept or decline project invitations",
  "contracts:read": "Read contracts you are a party to",
  "notifications:read": "Read your notifications",
  "connections:read": "Read your connections",
  "messages:read": "Read conversations you participate in",
  "messages:write": "Send messages in conversations you participate in",
  "profile:write": "Edit your own profile fields",
};

export function isMcpScope(value: string): value is McpScope {
  return (MCP_SCOPES as readonly string[]).includes(value);
}

export function parseScopes(input: unknown): McpScope[] {
  if (typeof input !== "string" || input.trim().length === 0) return [];
  const requested = input.split(/\s+/).filter(Boolean);
  if (requested.some((scope) => !isMcpScope(scope))) {
    throw new Error("Requested scope is not supported by Workora");
  }
  return [...new Set(requested)] as McpScope[];
}

export function hasScope(granted: string[], required: McpScope): boolean {
  return granted.includes(required);
}
