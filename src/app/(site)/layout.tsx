import { PublicHeader } from "@/components/layout/public-header";
import { PublicFooter } from "@/components/layout/public-footer";
import { getSessionAccount } from "@/components/layout/session-guard";

export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const account = await getSessionAccount();
  return (
    <>
      <PublicHeader account={account} />
      <main id="main-content">{children}</main>
      <PublicFooter />
    </>
  );
}
