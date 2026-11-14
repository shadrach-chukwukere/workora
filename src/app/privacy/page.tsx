import Link from "next/link";

export const metadata = {
  title: "Privacy Policy · Workora",
  description: "Workora Privacy Policy — how we collect, use, and protect your information.",
};

export default function PrivacyPage() {
  return (
    <div className="container-page py-16 lg:py-24 max-w-3xl mx-auto">
      <h1 className="text-2xl font-semibold text-neutral-900 mb-6">Privacy Policy</h1>
      <p className="text-neutral-600 leading-relaxed mb-6">
        Workora is committed to protecting your privacy. This policy explains what information we collect,
        how we use it, and how we protect your data.
      </p>
      <h2 className="text-xl font-semibold text-neutral-900 mb-3 mt-8">Information We Collect</h2>
      <p className="text-neutral-600 leading-relaxed mb-6">
        We collect information you provide directly to us, such as your name, email address, and
        payment details, when you create an account or post a project.
      </p>
      <h2 className="text-xl font-semibold text-neutral-900 mb-3 mt-8">How We Use Your Information</h2>
      <p className="text-neutral-600 leading-relaxed mb-6">
        We use your information to provide and improve our services, communicate with you, and
        process payments.
      </p>
      <h2 className="text-xl font-semibold text-neutral-900 mb-3 mt-8">Contact Us</h2>
      <p className="text-neutral-600 leading-relaxed mb-6">
        If you have questions about this Privacy Policy, contact us at{" "}
        <Link href="/contact" className="text-brand-600 hover:underline">
          support@workora.com
        </Link>
        .
      </p>
    </div>
  );
}
