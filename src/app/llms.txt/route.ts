const baseUrl = (process.env.NEXT_PUBLIC_SITE_URL?.trim() || "https://workora.com").replace(/\/+$/, "");

const content = `# Workora

A freelance marketplace where clients post projects with public budgets and freelancers submit proposals. Work, messages, contracts and reviews stay attached to funded milestones.

Public pages are crawlable without an account. Browser agents can use the same labelled forms, buttons and navigation as people; private actions still require the normal sign-in and permissions.

## Documentation for agents

- [Workora for AI agents](${baseUrl}/ai): How agents discover and use the website, including WebMCP tools, public pages, account flows and limits.
- [OpenAPI specification](${baseUrl}/openapi.json): Machine-readable description of public and authenticated HTTP endpoints.
- [robots.txt](${baseUrl}/robots.txt): Crawler rules.
- [sitemap.xml](${baseUrl}/sitemap.xml): Public page index.

## Public marketplace

- [Find work](${baseUrl}/find-work): Browse open projects with budgets, skills and proposal counts.
- [Find talent](${baseUrl}/find-talent): Search public freelancer profiles with rates, skills and availability.
- [Categories](${baseUrl}/categories): Marketplace categories.
- [About Workora](${baseUrl}/about): How hiring, proposals, milestones and escrow work.

## Account flows

- [Register](${baseUrl}/register): Existing account creation flow; email verification still applies.
- [Sign in](${baseUrl}/login): Existing authentication flow.

## Policies

- [Privacy policy](${baseUrl}/privacy): How Workora collects, uses and shares information.
- [Terms of service](${baseUrl}/terms): Platform rules, public profiles and the 8% freelancer commission with no client fee.
`;

export function GET() {
  return new Response(content, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
