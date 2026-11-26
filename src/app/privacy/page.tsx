import type { Metadata } from "next";
import Link from "next/link";
import { PublicHeader } from "@/components/layout/public-header";
import { PublicFooter } from "@/components/layout/public-footer";

const description = "Workora Privacy Policy — how we collect, use, and protect your information.";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description,
  alternates: { canonical: "/privacy" },
  openGraph: {
    type: "website",
    url: "/privacy",
    title: "Privacy Policy · Workora",
    description,
    siteName: "Workora",
  },
  twitter: {
    card: "summary_large_image",
    title: "Privacy Policy · Workora",
    description,
  },
};

const headingClass = "text-xl font-semibold text-neutral-900 mb-3 mt-8";
const bodyClass = "text-neutral-600 leading-relaxed mb-6";

export default function PrivacyPage() {
  return (
    <div className="bg-white">
      <PublicHeader />
      <main className="container-page py-16 lg:py-24 max-w-3xl mx-auto">
        <h1 className="text-2xl font-semibold text-neutral-900 mb-2">Privacy Policy</h1>
        <p className="text-sm text-neutral-500 mb-8">Last updated: 23 November 2026</p>
        <p className={bodyClass}>
          Workora is committed to protecting your privacy. This policy explains what information we collect,
          why we collect it, who can see it, and the choices you have. By using Workora, you agree to this
          policy.
        </p>

        <h2 className={headingClass}>Information We Collect</h2>
        <ul className={`list-disc space-y-2 pl-5 ${bodyClass}`}>
          <li>
            <strong className="font-semibold text-neutral-800">Account and identity information:</strong>{" "}
            your name, email address, account type, email verification status, and authentication details.
            If you sign in with Google or GitHub, we receive basic profile information and your profile image,
            which is mirrored to our media storage so your avatar keeps working.
          </li>
          <li>
            <strong className="font-semibold text-neutral-800">Profile and public content:</strong>{" "}
            freelancers provide a headline (the short note shown under their name), an About section,
            location, hourly rate, availability, response time, skills, portfolio, work history, profile photo,
            and banner. Clients provide a company name, company size, industry, About section, and profile
            photo. Any phone number or social/portfolio links you add to your contact details are also treated
            as profile content.
          </li>
          <li>
            <strong className="font-semibold text-neutral-800">Project and marketplace activity:</strong>{" "}
            projects and briefs, proposals, contracts, milestones, messages, reviews, disputes, saved items,
            and connections you make with other freelancers or clients.
          </li>
          <li>
            <strong className="font-semibold text-neutral-800">Payment information:</strong>{" "}
            payments and payouts are processed by Paystack. We receive transaction references, amounts,
            statuses, and payout status. We do not store your full card number or full bank credentials on
            Workora servers.
          </li>
          <li>
            <strong className="font-semibold text-neutral-800">Verification documents:</strong>{" "}
            if you start identity verification, you may submit identity documents. These are kept private and
            are not part of your public profile.
          </li>
          <li>
            <strong className="font-semibold text-neutral-800">Technical and security data:</strong>{" "}
            sign-in sessions, cookies, passkey public-key credentials and device metadata, and basic logs such
            as IP address and browser/user-agent information used to protect accounts and prevent abuse.
          </li>
        </ul>

        <h2 className={headingClass}>What Is Public</h2>
        <p className={bodyClass}>
          Workora is a marketplace, so certain profile information is public. Freelancer public profiles at
          <code className="mx-1 rounded bg-neutral-100 px-1.5 py-0.5 text-[13px]">/freelancers/[id]</code>
          show your name, avatar, banner, headline, About, location, rate, availability, ratings, portfolio,
          skills, work history, and any contact details you add. Client public profiles at
          <code className="mx-1 rounded bg-neutral-100 px-1.5 py-0.5 text-[13px]">/clients/[id]</code>
          show your name or company name, avatar, industry, company size, About, ratings, and any contact
          details you add. Client About is also shown on public project pages. Follower and following counts,
          shown as connections, may also be visible on public profiles.
        </p>
        <p className={bodyClass}>
          We do not currently provide a separate privacy toggle for individual contact fields. If you do not
          want a phone number or link shown publicly, remove it from your settings. Please do not put
          passwords, government ID numbers, private addresses, or other sensitive information in your
          headline, About, portfolio, or project content.
        </p>

        <h2 className={headingClass}>How We Use Your Information</h2>
        <p className={bodyClass}>
          We use your information to create and secure accounts, display public profiles, match freelancers
          and clients, publish projects and proposals, manage contracts and milestone payments, verify
          identity where required, process payouts, provide support, prevent fraud and abuse, and improve the
          platform. We may send service messages about your account, projects, payments, or security.
        </p>

        <h2 className={headingClass}>Media, Storage, and Third-Party Services</h2>
        <p className={bodyClass}>
          Profile photos, banners, and project cover images are uploaded to Vercel Blob and served by public
          URLs so they can appear on public pages. Identity documents use private access and are not publicly
          linked. We use Vercel for web hosting and media storage, Render for the API, Neon for the database,
          Paystack for payments, and Google/GitHub when you choose those sign-in providers. These providers
          process data on our behalf under their own privacy terms.
        </p>

        <h2 className={headingClass}>Cookies, Sessions, and Passkeys</h2>
        <p className={bodyClass}>
          We use authentication cookies to keep you signed in and local/session browser storage for interface
          and sign-in state. Signing out ends your session, clears stored sign-in state, and reloads the app at
          the login page. If you enable a passkey, Workora stores a public-key credential, credential ID, and
          device metadata—not your fingerprint, face scan, or PIN. Your biometric data stays on your device
          and is never sent to Workora. You can remove passkeys from settings.
        </p>

        <h2 className={headingClass}>Retention and Security</h2>
        <p className={bodyClass}>
          We keep profile and account information while your account is active and for as long as needed to
          provide the service, resolve disputes, comply with legal obligations, and protect the marketplace.
          Public profile content remains visible until you edit or remove it or your account is closed.
          Transaction, verification, and dispute records may be retained longer where required. We use HTTPS,
          access controls, and private storage for sensitive documents, but no system can be guaranteed
          completely secure.
        </p>

        <h2 className={headingClass}>Your Choices</h2>
        <p className={bodyClass}>
          You can update your headline, About, contact details, media, and company details in settings at any
          time. You can add or remove connections, revoke passkeys, and sign out to clear your local session.
          To request access to, correction of, or deletion of your personal information, contact us using the
          details below. We may need to verify your identity before acting on a request.
        </p>

        <h2 className={headingClass}>Children</h2>
        <p className={bodyClass}>
          Workora is not intended for anyone under 18. We do not knowingly collect personal information from
          children.
        </p>

        <h2 className={headingClass}>Changes to This Policy</h2>
        <p className={bodyClass}>
          We may update this policy as the platform changes. The “Last updated” date at the top will reflect
          the latest version. Material changes will be communicated through the platform where appropriate.
        </p>

        <h2 className={headingClass}>Contact Us</h2>
        <p className={bodyClass}>
          If you have questions about this Privacy Policy, contact us at{" "}
          <Link href="/contact" className="text-brand-600 hover:underline">
            support@workora.com
          </Link>
          .
        </p>
      </main>
      <PublicFooter />
    </div>
  );
}
