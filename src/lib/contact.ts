import { z } from "zod";
import {
  GithubIcon,
  Globe02Icon,
  InstagramIcon,
  Link01Icon,
  Linkedin01Icon,
  NewTwitterIcon,
  type IconName,
} from "@/lib/icons";

/** Contact details stored on the user row. All links are optional. */
export interface ContactDetails {
  email?: string | null;
  phone?: string | null;
  github_url?: string | null;
  linkedin_url?: string | null;
  twitter_url?: string | null;
  instagram_url?: string | null;
  website_url?: string | null;
  portfolio_url?: string | null;
}

/** Field metadata shared by the settings forms and the public profile view. */
export const CONTACT_LINK_FIELDS = [
  { key: "github_url", label: "GitHub", placeholder: "github.com/yourname", icon: GithubIcon },
  { key: "linkedin_url", label: "LinkedIn", placeholder: "linkedin.com/in/yourname", icon: Linkedin01Icon },
  { key: "twitter_url", label: "X / Twitter", placeholder: "x.com/yourname", icon: NewTwitterIcon },
  { key: "instagram_url", label: "Instagram", placeholder: "instagram.com/yourname", icon: InstagramIcon },
  { key: "website_url", label: "Website", placeholder: "yourwebsite.com", icon: Globe02Icon },
  { key: "portfolio_url", label: "Portfolio", placeholder: "yourportfolio.com", icon: Link01Icon },
] as const satisfies ReadonlyArray<{
  key: keyof ContactDetails;
  label: string;
  placeholder: string;
  icon: IconName;
}>;

/** Accepts bare domains and normalises them to a full https URL. */
const optionalContactUrl = z
  .string()
  .trim()
  .max(500)
  .transform((value) => {
    if (!value) return "";
    return /^https?:\/\//i.test(value) ? value : `https://${value}`;
  })
  .pipe(z.union([z.literal(""), z.string().url("Enter a valid URL")]));

const optionalPhone = z
  .string()
  .trim()
  .max(40)
  .refine((value) => value === "" || /^[+\d\s().-]{7,40}$/.test(value), "Enter a valid phone number");

/** Spread `contactSchema.shape` into a settings form schema. */
export const contactSchema = z.object({
  phone: optionalPhone,
  github_url: optionalContactUrl,
  linkedin_url: optionalContactUrl,
  twitter_url: optionalContactUrl,
  instagram_url: optionalContactUrl,
  website_url: optionalContactUrl,
  portfolio_url: optionalContactUrl,
});

export type ContactFormValues = z.infer<typeof contactSchema>;

/** Build the PATCH /users/me payload for contact fields (empty string clears). */
export function toContactPayload(values: ContactFormValues): Record<string, string | null> {
  return {
    phone: values.phone || null,
    github_url: values.github_url || null,
    linkedin_url: values.linkedin_url || null,
    twitter_url: values.twitter_url || null,
    instagram_url: values.instagram_url || null,
    website_url: values.website_url || null,
    portfolio_url: values.portfolio_url || null,
  };
}

/** Display text for a link, without the scheme or trailing slash. */
export function displayLink(value: string): string {
  return value.replace(/^https?:\/\//i, "").replace(/\/$/, "");
}
