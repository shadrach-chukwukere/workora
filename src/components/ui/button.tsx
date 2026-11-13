import Link from "next/link";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-lg font-medium text-sm transition-[background-color,border-color,color] active:bg-opacity-90 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        primary: "bg-brand-600 text-white hover:bg-brand-700",
        secondary: "border border-neutral-200 bg-white text-neutral-900 hover:bg-neutral-50 hover:border-neutral-300",
        ghost: "text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900",
        accent: "bg-brand-100 text-brand-800 hover:bg-brand-200",
        danger: "bg-rose-600 text-white hover:bg-rose-700",
        "danger-outline": "border border-rose-200 bg-white text-rose-700 hover:bg-rose-50 hover:border-rose-300",
        link: "text-brand-700 hover:text-brand-800 hover:underline underline-offset-2",
        "link-quiet": "text-neutral-600 hover:text-neutral-900 hover:underline underline-offset-2",
      },
      size: {
        sm: "h-8 px-3 text-[13px]",
        md: "h-9 px-3.5",
        lg: "h-11 px-5 text-sm",
        "icon-sm": "size-8",
        icon: "size-9",
        "icon-lg": "size-11",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
  VariantProps<typeof buttonVariants> {
  href?: string;
  external?: boolean;
  loading?: boolean;
}

function Spinner({ className }: { className?: string }) {
  return <span aria-hidden className={cn("size-4 shrink-0 animate-spin rounded-full border-2 border-current border-t-transparent opacity-60", className)} />;
}

export function Button({
  className,
  variant,
  size,
  href,
  external,
  loading,
  children,
  disabled,
  type,
  ...props
}: ButtonProps) {
  const classes = cn(buttonVariants({ variant, size }), className);
  if (href) {
    if (external) {
      return (
        <a href={href} target="_blank" rel="noopener noreferrer" className={classes}>
          {children}
        </a>
      );
    }
    return (
      <Link href={href} className={classes}>
        {children}
      </Link>
    );
  }
  return (
    <button
      type={type ?? "button"}
      className={classes}
      disabled={disabled ?? loading}
      {...props}
    >
      {loading ? <Spinner /> : null}
      {children}
    </button>
  );
}
