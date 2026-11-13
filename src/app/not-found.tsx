import Link from "next/link";
import { Button } from "@/components/ui/button";
import { LogoMark } from "@/components/ui/logo";

export default function NotFound() {
 return (
 <div className="container-page flex min-h-[70vh] flex-col items-center justify-center py-16 text-center">
 <Link href="/" aria-label="Workora home" className="inline-flex">
 <LogoMark size={40} />
 </Link>
 <p className="mt-6 text-[11px] font-semibold uppercase tracking-[0.12em] text-neutral-400">Error 404</p>
 <h1 className="mt-2 text-3xl font-semibold tracking-tight text-neutral-900">This page does not exist.</h1>
 <p className="mt-2 max-w-md text-neutral-600">
 The link may be old, or the resource may have moved. The marketplace you came for is one click away.
 </p>
 <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
 <Button href="/" size="md">
 Back to home
 </Button>
 <Button href="/find-work" variant="secondary" size="md">
 Browse open briefs
 </Button>
 </div>
 </div>
 );
}
