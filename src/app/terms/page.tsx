import Link from "next/link";

export const metadata = {
  title: "Terms of Service · Workora",
  description: "Workora Terms of Service — the terms governing your use of the platform.",
};

export default function TermsPage() {
  return (
    <div className="container-page py-16 lg:py-24 max-w-3xl mx-auto">
      <h1 className="text-2xl font-semibold text-neutral-900 mb-6">Terms of Service</h1>
      <p className="text-neutral-600 leading-relaxed mb-6">
        By accessing or using Workora, you agree to these Terms of Service. Please read them carefully.
      </p>
      <h2 className="text-xl font-semibold text-neutral-900 mb-3 mt-8">Eligibility</h2>
      <p className="text-neutral-600 leading-relaxed mb-6">
        You must be at least 18 years old to create an account and use Workora.
      </p>
      <h2 className="text-xl font-semibold text-neutral-900 mb-3 mt-8">Account Responsibility</h2>
      <p className="text-neutral-600 leading-relaxed mb-6">
        You are responsible for maintaining the confidentiality of your account credentials and for
        all activity under your account.
      </p>
      <h2 className="text-xl font-semibold text-neutral-900 mb-3 mt-8">Fees</h2>
      <p className="text-neutral-600 leading-relaxed mb-6">
        Freelancers pay an 8% commission on milestone releases. Clients pay nothing beyond their
        contract amount.
      </p>
      <h2 className="text-xl font-semibold text-neutral-900 mb-3 mt-8">Contact Us</h2>
      <p className="text-neutral-600 leading-relaxed mb-6">
        If you have questions about these Terms, contact us at{" "}
        <Link href="/contact" className="text-brand-600 hover:underline">
          support@workora.com
        </Link>
        .
      </p>
    </div>
  );
}
