import Link from "next/link";
import { Button } from "@/components/ui/button";
import { LogoMark } from "@/components/ui/logo";

export default function NotFound() {
  return (
    <div className="container-page flex min-h-[70vh] flex-col items-center justify-center py-16 text-center">
      <Link href="/" aria-label="Workora home" className="inline-flex">
        <LogoMark size={40} />
      </Link>
      <p className="mt-6 text-[11px] font-semibold uppercase tracking-[0.12em] text-neutral-400">Closed brief</p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight text-neutral-900">
        Project is not accepting proposals
      </h1>
      <p className="mt-2 max-w-md text-neutral-600">
        This brief was either filled, paused or removed by the client. Plenty of other open briefs are one
        click away.
      </p>
      <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
        <Button href="/find-work" size="md">
          Browse open briefs
        </Button>
        <Button href="/" variant="secondary" size="md">
          Back to home
        </Button>
      </div>
    </div>
  );
}
