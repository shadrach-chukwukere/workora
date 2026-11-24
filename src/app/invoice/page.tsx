import Link from "next/link";
import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-blocks";
import { Icon, Download01Icon, File01Icon, Wallet01Icon, CheckmarkCircle02Icon } from "@/lib/icons";
import { apiServer, sessionCookie } from "@/lib/api-server";
import { getSessionAccount } from "@/components/layout/session-guard";
import { onboardingDestination, safeNextPath, withNext } from "@/lib/workspace";
import { formatMoney, formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { PaystackButton } from "@/components/ui/paystack-button/PaystackButton";

interface Invoice {
  id: string;
  contractId: string;
  projectTitle: string;
  clientName: string;
  clientEmail: string;
  freelancerName: string;
  freelancerEmail: string;
  amountMinor: number;
  feeMinor: number;
  netMinor: number;
  status: "draft" | "sent" | "paid" | "void";
  issuedAt: string;
  dueAt: string;
  paidAt: string | null;
  pdfUrl: string | null;
}

interface InvoiceResponse {
  invoice: Invoice;
}

export default async function InvoicePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const cookie = await sessionCookie();
  const sp = await searchParams;
  const id = Array.isArray(sp.id) ? sp.id[0] : sp.id;
  const next = safeNextPath(sp.next) ?? (id ? `/invoice?id=${encodeURIComponent(id)}` : "/invoice");
  const account = await getSessionAccount();
  if (!account) redirect(withNext("/login", next));
  if (account.needsRoleSelection || (account.needsVerification && account.role !== "admin")) {
    redirect(onboardingDestination(account, next));
  }

  if (!id) redirect("/client/transactions");

  let invoice: Invoice | null = null;
  try {
    const data = await apiServer<InvoiceResponse>(`/api/v1/invoices/${encodeURIComponent(id)}`, undefined, cookie);
    invoice = data.invoice;
  } catch {
    // Render the fallback redirect outside the try/catch (redirect throws).
  }
  if (!invoice) redirect("/client/transactions");

  const amount = formatMoney(invoice.amountMinor / 100);
  const fee = formatMoney(invoice.feeMinor / 100);
  const net = formatMoney(invoice.netMinor / 100);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={`Invoice #${invoice.id.slice(-8)}`}
        description={`${invoice.projectTitle} · ${formatDate(invoice.issuedAt)}`}
        actions={
          <div className="flex items-center gap-2">
            {invoice.pdfUrl ? (
              <a href={invoice.pdfUrl} target="_blank" rel="noopener noreferrer">
                <Button variant="secondary" size="md">
                  <Icon icon={Download01Icon} size={16} strokeWidth={1.8} className="mr-1.5" />
                  Download PDF
                </Button>
              </a>
            ) : null}
            <Button size="md" onClick={() => window.print()}>
              <Icon icon={Download01Icon} size={16} strokeWidth={1.8} className="mr-1.5" />
              Print
            </Button>
          </div>
        }
      />

      {/* Invoice header: brand + meta */}
      <section className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-6 border border-neutral-200 rounded-xl bg-white p-6 sm:p-8">
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <span className="inline-flex size-10 items-center justify-center rounded-lg bg-brand-100 text-brand-700">
              <Icon icon={Wallet01Icon} size={18} strokeWidth={1.8} />
            </span>
            <span className="text-[13px] font-medium text-neutral-500 uppercase tracking-wider">Workora</span>
          </div>
          <h2 className="mt-1 text-xl font-semibold text-neutral-900">Invoice</h2>
          <p className="text-sm text-neutral-500">Milestone payment — {invoice.projectTitle}</p>
        </div>

        <div className="grid gap-4 lg:grid-cols-2 lg:gap-8">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-neutral-400">Bill to</p>
            <p className="mt-1 text-sm font-semibold text-neutral-900">{invoice.clientName}</p>
            <p className="text-sm text-neutral-500">{invoice.clientEmail}</p>
          </div>
          <div className="text-right">
            <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-neutral-400">Invoice details</p>
            <dl className="mt-1 text-sm space-y-1">
              <dt className="text-neutral-500">Invoice date</dt>
              <dd className="font-semibold text-neutral-900">{formatDate(invoice.issuedAt)}</dd>
              <dt className="text-neutral-500">Due date</dt>
              <dd className="font-semibold text-neutral-900">{formatDate(invoice.dueAt)}</dd>
              <dt className="text-neutral-500">Status</dt>
              <dd className="inline-flex items-center gap-1 font-semibold">
                <Badge
                  tone={invoice.status === "paid" ? "success" : invoice.status === "sent" ? "brand" : "neutral"}
                  className={cn("text-[11px] px-2 py-0.5", invoice.status === "paid" ? "text-emerald-700 bg-emerald-100" : "")}
                >
                  {invoice.status.charAt(0).toUpperCase() + invoice.status.slice(1)}
                </Badge>
              </dd>
            </dl>
          </div>
        </div>
      </section>

      {/* Line items */}
      <section className="card overflow-hidden">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="border-b border-neutral-100 bg-neutral-50/80">
              <th className="px-5 py-4 text-left text-xs font-medium text-neutral-500">Description</th>
              <th className="px-5 py-4 text-right text-xs font-medium text-neutral-500">Amount</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-neutral-100 last:border-0">
              <td className="px-5 py-4">
                <p className="font-medium text-neutral-900">{invoice.projectTitle}</p>
              </td>
              <td className="px-5 py-4 text-right font-semibold text-neutral-900 tabular-nums">{amount}</td>
            </tr>
            <tr className="border-b border-neutral-100 last:border-0">
              <td className="px-5 py-4 text-neutral-500">Platform fee (8%)</td>
              <td className="px-5 py-4 text-right text-neutral-500 tabular-nums">- {fee} <PaystackButton
                amount={invoice.feeMinor / 100}
                email={invoice.clientEmail || ''}
                onSuccess={(ref, amt) => console.log('Payment:', ref, amt)}
                className="mt-1 align-middle"
              /></td>
            </tr>
            <tr>
              <td className="px-5 py-4 font-semibold text-neutral-900">Net to freelancer</td>
              <td className="px-5 py-4 text-right font-semibold text-neutral-900 tabular-nums">{net}</td>
            </tr>
          </tbody>
        </table>
      </section>

      {/* Footer: parties + note */}
      <section className="grid gap-6 lg:grid-cols-2">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-neutral-400">Client</p>
          <p className="mt-1 text-sm text-neutral-700">{invoice.clientName}</p>
          <p className="text-sm text-neutral-500">{invoice.clientEmail}</p>
        </div>
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-neutral-400">Freelancer</p>
          <p className="mt-1 text-sm text-neutral-700">{invoice.freelancerName}</p>
          <p className="text-sm text-neutral-500">{invoice.freelancerEmail}</p>
        </div>
      </section>

      <p className="mt-6 text-[12px] text-neutral-500">
        This invoice is generated by Workora. Milestone funds are held in escrow and released upon client approval.{" "}
        <Link href="/help/escrow" className="font-medium text-brand-700 hover:text-brand-800">Learn about escrow</Link>.
      </p>
    </div>
  );
}
