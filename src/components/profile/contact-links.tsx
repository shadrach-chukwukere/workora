import { CONTACT_LINK_FIELDS, displayLink, type ContactDetails } from "@/lib/contact";
import { ArrowUpRight02Icon, Icon, Mail01Icon, PhoneIcon, type IconName } from "@/lib/icons";
import { cn } from "@/lib/utils";

interface ContactLinkItem {
  key: string;
  label: string;
  value: string;
  href: string;
  icon: IconName;
}

/** Read-only contact card used on public profiles. Renders nothing when empty. */
export function ContactLinks({
  contact,
  className,
}: {
  contact?: ContactDetails | null;
  className?: string;
}) {
  const details = contact ?? {};
  const items: ContactLinkItem[] = [];

  if (details.email) {
    items.push({
      key: "email",
      label: "Email",
      value: details.email,
      href: `mailto:${details.email}`,
      icon: Mail01Icon,
    });
  }
  if (details.phone) {
    items.push({
      key: "phone",
      label: "Phone",
      value: details.phone,
      href: `tel:${details.phone.replace(/[^\d+]/g, "")}`,
      icon: PhoneIcon,
    });
  }
  for (const field of CONTACT_LINK_FIELDS) {
    const value = details[field.key];
    if (value) {
      items.push({ key: field.key, label: field.label, value, href: value, icon: field.icon });
    }
  }

  if (items.length === 0) return null;

  return (
    <section className={cn("rounded-xl border border-neutral-200 bg-white p-6", className)}>
      <h2 className="text-sm font-semibold text-neutral-900">Contact & links</h2>
      <ul className="mt-3 space-y-0.5">
        {items.map((item) => {
          const external = item.href.startsWith("http");
          return (
            <li key={item.key}>
              <a
                href={item.href}
                {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                className="flex items-center gap-2.5 rounded-lg px-2 py-2 text-[13px] transition-colors hover:bg-neutral-50"
              >
                <Icon icon={item.icon} size={15} strokeWidth={1.8} className="shrink-0 text-neutral-400" />
                <span className="w-[76px] shrink-0 text-neutral-500">{item.label}</span>
                <span className="min-w-0 flex-1 truncate font-medium text-neutral-900">
                  {external ? displayLink(item.value) : item.value}
                </span>
                {external ? (
                  <Icon icon={ArrowUpRight02Icon} size={13} strokeWidth={1.8} className="shrink-0 text-neutral-400" />
                ) : null}
              </a>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
