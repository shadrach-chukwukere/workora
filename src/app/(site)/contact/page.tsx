"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/form";
import { Select } from "@/components/ui/select";
import { sendContactMessage } from "./actions";
import { Icon, Message01Icon, Clock01Icon, ShieldCheckIcon, Building01Icon } from "@/lib/icons";

const TOPICS = [
  { value: "project", label: "Project issues" },
  { value: "billing", label: "Billing & escrow" },
  { value: "trust", label: "Trust & safety" },
  { value: "press", label: "Press" },
  { value: "other", label: "Other" },
];

const schema = z.object({
  name: z.string().trim().min(2, "Tell us your name").max(120, "Keep the name under 120 characters"),
  email: z.email("Enter a valid email address"),
  topic: z.string().min(1, "Pick a topic"),
  message: z.string().trim().min(20, "Give us at least 20 characters so we can help").max(4000, "Keep the message under 4,000 characters"),
});

type FormValues = z.infer<typeof schema>;

export default function ContactPage() {
  const [sending, setSending] = useState(false);
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: "", email: "", topic: "project", message: "" },
  });

  const topic = watch("topic");

  async function onSubmit(values: FormValues) {
    setSending(true);
    const result = await sendContactMessage(values);
    setSending(false);
    if (result.ok) {
      toast.success("Message sent", {
        description: "We usually reply within one business day.",
      });
      reset({ name: "", email: "", topic: values.topic, message: "" });
      return;
    }
    toast.error("We could not deliver that message.", {
      description: "Please try again, or email hello@workora.com directly.",
    });
  }

  return (
    <div className="bg-white">
      <a href="#main-content" className="skip-link" />

      <section className="container-page pb-16 pt-14 sm:pt-20">
        <div className="max-w-2xl">
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-brand-700">Contact</p>
          <h1 className="mt-3 max-w-[48ch] text-4xl font-semibold leading-[1.1] tracking-tight text-neutral-900 sm:text-5xl text-wrap-balance">
            Talk to a human
          </h1>
          <p className="mt-4 text-lg leading-relaxed text-neutral-600">
            Project trouble, escrow questions, trust concerns, press or anything else. One inbox, read by the team
            that can act on it.
          </p>
        </div>

        <div className="mt-12 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,400px)]">
          {/* Form */}
          <form onSubmit={handleSubmit(onSubmit)} className="rounded-xl border border-neutral-200 bg-white flex flex-col gap-5 p-6 sm:p-8" noValidate>
            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="Your name" required error={errors.name?.message}>
                <Input placeholder="Amara Okafor" autoComplete="name" {...register("name")} />
              </Field>
              <Field label="Email" required error={errors.email?.message}>
                <Input type="email" placeholder="you@company.com" autoComplete="email" {...register("email")} />
              </Field>
            </div>
            <Field label="Topic" required error={errors.topic?.message}>
              <Select
                ariaLabel="Topic"
                value={topic}
                onChange={(value) => setValue("topic", value, { shouldValidate: true })}
                options={TOPICS}
              />
            </Field>
            <Field label="Message" required error={errors.message?.message} hint="At least 20 characters.">
              <Textarea
                rows={6}
                placeholder="What is going on? Include the project or contract reference if you have one."
                {...register("message")}
              />
            </Field>
            <div className="flex items-center justify-between gap-4 pt-2">
              <p className="hidden text-xs text-neutral-500 sm:block">
                By sending, you agree to our support terms. We never share your details.
              </p>
              <Button type="submit" loading={sending} size="lg">
                Send message
              </Button>
            </div>
          </form>

          {/* Side rail */}
          <div className="flex flex-col gap-4">
            <div className="rounded-xl border border-neutral-200 bg-white p-6">
              <span className="flex size-10 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
                <Icon icon={Message01Icon as any} size={20} strokeWidth={1.8} />
              </span>
              <h2 className="mt-3 text-base font-semibold text-neutral-900">A human replies in about a business day</h2>
              <p className="mt-1.5 text-sm leading-relaxed text-neutral-600">
                Every message lands with the right team on the first read: support, trust and safety, or finance.
                No autoresponders pretending to be people.
              </p>
            </div>

            <div className="rounded-xl border border-neutral-200 bg-white p-6">
              <span className="flex size-10 items-center justify-center rounded-lg bg-neutral-100 text-neutral-600">
                <Icon icon={Clock01Icon as any} size={20} strokeWidth={1.8} />
              </span>
              <h2 className="mt-3 text-base font-semibold text-neutral-900">Support hours</h2>
              <p className="mt-1.5 text-sm leading-relaxed text-neutral-600">Mon to Fri, 08:00 to 18:00 UTC.</p>
              <p className="mt-2 text-sm leading-relaxed text-neutral-600">
                For urgent trust cases, an escrow pause is available in-app from any active contract.
              </p>
            </div>

            <div className="rounded-xl border border-neutral-200 bg-white p-6">
              <span className="flex size-10 items-center justify-center rounded-lg bg-neutral-100 text-neutral-600">
                <Icon icon={ShieldCheckIcon as any} size={20} strokeWidth={1.8} />
              </span>
              <h2 className="mt-3 text-base font-semibold text-neutral-900">Security reports</h2>
              <p className="mt-1.5 text-sm leading-relaxed text-neutral-600">
                Found a vulnerability or suspect an account is compromised? Write to{" "}
                <a href="mailto:security@workora.com" className="font-medium text-brand-700 hover:underline">
                  security@workora.com
                </a>
                . These go straight to our security team, not the general queue.
              </p>
            </div>

            <div className="rounded-xl border border-neutral-200 bg-white p-6">
              <span className="flex size-10 items-center justify-center rounded-lg bg-neutral-100 text-neutral-600">
                <Icon icon={Building01Icon as any} size={20} strokeWidth={1.8} />
              </span>
              <h2 className="mt-3 text-base font-semibold text-neutral-900">Commercial and enterprise</h2>
              <p className="mt-1.5 text-sm leading-relaxed text-neutral-600">
                Custom contracts, team seats, SSO or a security review? Reach{" "}
                <a href="mailto:plans@workora.com" className="font-medium text-brand-700 hover:underline">
                  plans@workora.com
                </a>{" "}
                and we will scope it with you.
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
