const baseUrl = (process.env.NEXT_PUBLIC_SITE_URL?.trim() || "https://workora.com").replace(/\/+$/, "");

const content = `# Workora

A freelance marketplace with public projects, public freelancer and client profiles, and a documented API for AI agents.

## Documentation

- [AI agents and MCP tools](${baseUrl}/ai): Plain-language guide to Workora's agent capabilities, permissions, confirmation steps and limits.
- [OpenAPI specification](${baseUrl}/openapi.json): Machine-readable HTTP API description for the public and authenticated endpoints.

## Public marketplace

- [Find work](${baseUrl}/find-work): Browse open projects with public budgets, skills and proposal counts.
- [Find talent](${baseUrl}/find-talent): Search public freelancer profiles with rates, skills and availability.

## Policies

- [Privacy policy](${baseUrl}/privacy): How Workora collects, uses and shares information.
- [Terms of service](${baseUrl}/terms): Platform rules, public profiles and the 8% freelancer commission with no client fee.
`;

export function GET() {
  return new Response(content, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
