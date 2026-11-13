import Link from "next/link";
import { Logo } from "@/components/ui/logo";

const columns: { title: string; links: { label: string; href: string }[] }[] = [
  {
    title: "For freelancers",
    links: [
      { label: "Find work", href: "/find-work" },
      { label: "Browse categories", href: "/categories" },
      { label: "Plans and pricing", href: "/pricing" },
    ],
  },
  {
    title: "For clients",
    links: [
      { label: "Find talent", href: "/find-talent" },
      { label: "How hiring works", href: "/about" },
      { label: "Post a project", href: "/post-project" },
    ],
  },
  {
    title: "Legal",
    links: [
       { label: "About Workora", href: "/about" },
      { label: "Contact", href: "/contact" },
      { label: "Privacy policy", href: "/privacy" },
      { label: "Terms of service", href: "/terms" },
    ],
  },
];

export function PublicFooter() {
  return (
    <footer className="border-t border-neutral-200 bg-white">
      <div className="container-page py-12">
        <div className="grid gap-12 lg:grid-cols-4 justify-center">
          <div className="max-w-65 ">
           <div className="flex justify-center sm:justify-start"> <Logo /></div> 
            <p className="mt-5 text-sm leading-relaxed text-neutral-500 sm:text-left text-center">
              Workora is a global marketplace for vetted independent professionals and the teams who hire them,
              with milestone-based escrow on every contract.
            </p>
          </div>
          {columns.map((col) => (
            <div key={col.title} className="justify-center sm:text-left text-center">
              <p className="text-sm font-semibold text-neutral-900">{col.title}</p>
              <ul className="mt-4 space-y-3">
                {col.links.map((link) => (
                  <li key={link.label}>
                    <Link href={link.href} className="text-sm text-neutral-500 transition-colors hover:text-neutral-900">
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="mt-12 flex flex-row gap-2 border-t border-neutral-100 pt-8 text-xs text-neutral-400  sm:items-center justify-center">
          <div className="text-center">
            <p>© {new Date().getFullYear()} Workora. All rights reserved.</p>
          <p>Milestone payments are held by a licensed payment provider and released on delivery approval.</p>
          </div>
        </div>
      </div>
    </footer>
  );
}
