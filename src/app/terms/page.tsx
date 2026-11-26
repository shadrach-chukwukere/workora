import type { Metadata } from "next";
import Link from "next/link";
import { PublicHeader } from "@/components/layout/public-header";
import { PublicFooter } from "@/components/layout/public-footer";

const description = "Workora Terms of Service — the terms governing your use of the platform.";

export const metadata: Metadata = {
  title: "Terms of Service",
  description,
  alternates: { canonical: "/terms" },
  openGraph: {
    type: "website",
    url: "/terms",
    title: "Terms of Service · Workora",
    description,
    siteName: "Workora",
  },
  twitter: {
    card: "summary_large_image",
    title: "Terms of Service · Workora",
    description,
  },
};

const headingClass = "text-xl font-semibold text-neutral-900 mb-3 mt-8";
const bodyClass = "text-neutral-600 leading-relaxed mb-6";

export default function TermsPage() {
  return (
    <div className="bg-white">
      <PublicHeader />
      <main className="container-page py-16 lg:py-24 max-w-3xl mx-auto">
        <h1 className="text-2xl font-semibold text-neutral-900 mb-2">Terms of Service</h1>
        <p className="text-sm text-neutral-500 mb-8">Last updated: 23 November 2026</p>
        <p className={bodyClass}>
          By accessing or using Workora, you agree to these Terms of Service. Please read them carefully. If
          you do not agree, do not use the platform.
        </p>

        <h2 className={headingClass}>Eligibility</h2>
        <p className={bodyClass}>
          You must be at least 18 years old and legally able to enter into a contract to create an account and
          use Workora. You may not use the platform if you are barred from doing so under applicable law.
        </p>

        <h2 className={headingClass}>Accounts and Security</h2>
        <p className={bodyClass}>
          You are responsible for providing accurate account information and for all activity under your
          account. Keep your password, one-time codes, and devices secure. If you enable a passkey, you are
          responsible for the device and biometric or device unlock method you use. Workora stores only the
          public-key credential, not your biometric data. Sign out at the end of a session on a shared device;
          signing out clears your local sign-in state and reloads the app. Notify us immediately of any
          unauthorised access.
        </p>

        <h2 className={headingClass}>Public Profiles, Headlines, and About</h2>
        <p className={bodyClass}>
          Workora profiles are public. A freelancer’s headline is the short note shown below their name in
          search results, profiles, and the workspace—it is not rendered on the banner. A freelancer’s About
          is the longer public description of their experience and how they work. For clients, the public
          title is the company name or account name, and the About section is the public company description
          shown on client profiles and project pages.
        </p>
        <p className={bodyClass}>
          You are responsible for the accuracy of your headline, About, company details, contact links,
          portfolio, and other profile content. Do not include sensitive personal information, confidential
          client information, false credentials, or anything you do not have the right to publish. Workora may
          remove or hide content that violates these Terms or harms the marketplace.
        </p>

        <h2 className={headingClass}>Connections</h2>
        <p className={bodyClass}>
          You may connect with (follow) other freelancers and clients. Follower and following counts are shown
          as connections on public profiles and in dashboards. Connecting is not an endorsement, a job offer,
          or a contract, and does not guarantee that the other person will respond. You can disconnect at any
          time. Do not use connections to spam, harass, scrape, or mislead other users.
        </p>

        <h2 className={headingClass}>Projects, Payments, and Fees</h2>
        <p className={bodyClass}>
          Clients post projects and fund approved milestones before work starts. Freelancers are paid when a
          milestone is approved or a dispute is decided. Payments and payouts are processed by Paystack; we do
          not store your full card or bank credentials on Workora servers. Clients pay no platform fee on top
          of the contract amount. Freelancers pay an 8% commission on milestone releases. You are responsible
          for any taxes, duties, or reporting obligations arising from your use of the platform.
        </p>
        <p className={bodyClass}>
          Workora facilitates payments but does not guarantee project outcomes. Disputes must be raised through
          the platform so funds can be handled under these Terms. Any off-platform payment arrangement that
          avoids platform fees or escrow protections is not permitted and may result in account suspension.
        </p>

        <h2 className={headingClass}>Identity Verification</h2>
        <p className={bodyClass}>
          We may ask you to verify your identity, especially before payouts or when required by law, our
          payment provider, or a dispute. Verification documents are stored privately and are not shown on
          your public profile. You confirm that documents you submit are valid and belong to you. Providing
          false information or failing verification may limit your access to payouts or result in suspension.
        </p>

        <h2 className={headingClass}>Content and Intellectual Property</h2>
        <p className={bodyClass}>
          You retain ownership of the content and media you upload, including your About, portfolio items,
          banners, and project covers. By publishing content on Workora, you grant us a worldwide,
          non-exclusive licence to host, reproduce, display, and distribute it as needed to operate and promote
          the marketplace, including through public profile and project pages and third-party media hosting.
          You must have the rights and permissions needed to grant this licence.
        </p>

        <h2 className={headingClass}>Acceptable Use</h2>
        <ul className={`list-disc space-y-2 pl-5 ${bodyClass}`}>
          <li>Do not use Workora for illegal, fraudulent, abusive, harassing, or discriminatory conduct.</li>
          <li>Do not upload malware, phishing content, infringing material, or content you do not own.</li>
          <li>Do not misrepresent your identity, skills, company, availability, credentials, or reviews.</li>
          <li>Do not spam, scrape, or harvest other users’ data or contact details.</li>
          <li>Do not interfere with the platform, security controls, payments, or other users’ access.</li>
          <li>
            Do not use an AI agent, MCP client, or script to bypass verification, rate limits, confirmation steps,
            or another user’s privacy settings.
          </li>
        </ul>

        <h2 className={headingClass}>AI Agent and MCP Access</h2>
        <p className={bodyClass}>
          Workora may offer a remote MCP endpoint for AI assistants. Agents act only with the permissions you grant
          through OAuth 2.1 in your own browser and under your own account. Scoped access, per-user authorization,
          input validation, rate limits, and explicit confirmation for consequential actions apply to every agent
          operation. Agents cannot move money, manage payouts, create accounts, bypass security checks, or access
          another user’s private data. You are responsible for the assistants you authorize and for reviewing the
          actions they take on your behalf; you may revoke any connection in your account settings.
        </p>

        <h2 className={headingClass}>Third-Party Services</h2>
        <p className={bodyClass}>
          Workora integrates with Paystack for payments, Google and GitHub for optional sign-in, and hosting,
          database, and media providers such as Vercel, Render, and Neon. Their services are governed by their
          own terms and privacy policies. We are not responsible for third-party outages or actions, but we
          will work to keep the marketplace secure and available.
        </p>

        <h2 className={headingClass}>Suspension and Termination</h2>
        <p className={bodyClass}>
          We may limit, suspend, or terminate access to Workora if you breach these Terms, create risk for
          users or the platform, fail verification, or are required to do so by law. You may stop using the
          platform at any time; certain obligations, payment records, and dispute terms survive termination.
        </p>

        <h2 className={headingClass}>Disclaimers and Limitation of Liability</h2>
        <p className={bodyClass}>
          Workora provides a marketplace and payment coordination tools. We do not guarantee that any project,
          freelancer, client, payment, or outcome will meet your expectations. To the maximum extent permitted
          by law, Workora is not liable for indirect, incidental, special, or consequential damages, lost
          profits, or losses arising from user content, off-platform agreements, or third-party services.
        </p>

        <h2 className={headingClass}>Changes to These Terms</h2>
        <p className={bodyClass}>
          We may update these Terms as the platform changes. The “Last updated” date at the top will reflect
          the latest version. Continued use of Workora after an update means you accept the revised Terms.
        </p>

        <h2 className={headingClass}>Contact Us</h2>
        <p className={bodyClass}>
          If you have questions about these Terms, contact us at{" "}
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
