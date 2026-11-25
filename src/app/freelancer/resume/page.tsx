"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input, Textarea, Field } from "@/components/ui/form";
import { Modal } from "@/components/ui/modal";
import { cn } from "@/lib/utils";
import {
  Icon,
  ArrowLeft02Icon,
  ArrowRight02Icon,
  Tick02Icon,
  SparklesIcon,
  File01Icon,
  TrashIcon,
  PlusSignIcon,
  Briefcase02Icon,
  Mortarboard01Icon,
  Medal01Icon,
  ShieldCheckIcon,
} from "@/lib/icons";

interface ResumeSection {
  headline: string | null;
  about: string | null;
  skills: string[];
  experience: { company: string; role: string; start_date: string; end_date: string | null; description: string }[];
  education: { school: string; degree: string; field: string | null; start_year: number; end_year: number | null }[];
  certifications: { name: string; issuer: string | null; year: number | null; credential_url: string | null }[];
  resume_url: string | null;
  resume_file_name: string | null;
  resume_visibility: "public" | "private";
}

interface AiQuota {
  limit: number;
  used: number;
  remaining: number;
}

type PatchResume = (patch: Partial<ResumeSection>) => void;

const STEPS = [
  { title: "Headline", short: "Headline", description: "One clear line that says what you do and what you are great at." },
  { title: "About", short: "About", description: "A short story of your experience, strengths and the work you enjoy." },
  { title: "Skills", short: "Skills", description: "Pick the skills clients should find you for." },
  { title: "Experience", short: "Experience", description: "Show the roles and projects that built your track record." },
  { title: "Education", short: "Education", description: "Add the qualifications that back up your expertise." },
  { title: "Certifications", short: "Certifications", description: "Add any credentials that help clients trust your work." },
] as const;

const SUGGESTED_SKILLS = [
  "React", "TypeScript", "Node.js", "Python", "Docker", "Kubernetes", "GraphQL", "AWS",
  "Figma", "Product design", "Copywriting", "SEO", "Data analysis", "Project management",
];

const EMPTY_RESUME: ResumeSection = {
  headline: null,
  about: null,
  skills: [],
  experience: [],
  education: [],
  certifications: [],
  resume_url: null,
  resume_file_name: null,
  resume_visibility: "public",
};

export default function FreelancerResumePage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [showAiPanel, setShowAiPanel] = useState(false);
  const [aiQuota, setAiQuota] = useState<AiQuota>({ limit: 10, used: 3, remaining: 7 });
  const [aiKind, setAiKind] = useState<"parse" | "generate">("parse");
  const [resumeText, setResumeText] = useState("");
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [draft, setDraft] = useState<ResumeSection>(EMPTY_RESUME);

  const { data: resume, isLoading: isLoadingResume } = useQuery({
    queryKey: ["freelancer-resume"],
    queryFn: async () => {
      const res = await fetch("/api/v1/users/me/resume", { credentials: "include" });
      if (res.status === 401) return null;
      if (!res.ok) throw new Error("Failed to load resume");
      return (await res.json()).data;
    },
    staleTime: 60_000,
  });

  useEffect(() => {
    if (resume) setDraft(resume as ResumeSection);
  }, [resume]);

  useEffect(() => {
    if (aiQuota.remaining <= 2 && aiQuota.remaining > 0) {
      toast.warning(`Only ${aiQuota.remaining} AI generation(s) left today.`);
    }
  }, [aiQuota]);

  const patchDraft: PatchResume = (patch) => setDraft((prev) => ({ ...prev, ...patch }));

  const useAiCredit = () =>
    setAiQuota((prev) => ({
      ...prev,
      used: prev.used + 1,
      remaining: Math.max(0, prev.remaining - 1),
    }));

  const handleSave = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/v1/users/me/resume", {
        method: "PUT",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(draft),
      });
      const data = await res.json();
      if (data.success) {
        toast.success("Resume saved");
        router.refresh();
      } else {
        toast.error(data.message ?? "Failed to save resume");
      }
    } catch {
      toast.error("Failed to save resume");
    } finally {
      setLoading(false);
    }
  };

  const handleAiParse = async () => {
    if (!resumeText.trim() && !resumeFile) {
      toast.error("Paste your resume text or upload a PDF first");
      return;
    }
    if (aiQuota.remaining <= 0) {
      toast.error("You have no AI generations remaining today");
      return;
    }
    setLoading(true);
    try {
      const body = new FormData();
      body.append("text", resumeText);
      if (resumeFile) body.append("file", resumeFile);
      const res = await fetch("/api/v1/users/me/resume/parse", {
        method: "POST",
        credentials: "include",
        body,
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        toast.error(data.message ?? "Failed to parse resume");
        return;
      }
      useAiCredit();
      toast.success("Resume parsed. Review the sections below.");
      setShowAiPanel(false);
      router.refresh();
    } catch {
      toast.error("Failed to parse resume");
    } finally {
      setLoading(false);
    }
  };

  const handleAiGenerate = async () => {
    if (aiQuota.remaining <= 0) {
      toast.error("You have no AI generations remaining today");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/v1/users/me/resume/generate", {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ headline: draft.headline, about: draft.about, skills: draft.skills }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        toast.error(data.message ?? "Failed to generate profile");
        return;
      }
      useAiCredit();
      toast.success("Profile suggestions generated");
      setShowAiPanel(false);
      router.refresh();
    } catch {
      toast.error("Failed to generate profile");
    } finally {
      setLoading(false);
    }
  };

  if (isLoadingResume) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4">
        <span className="size-8 animate-spin rounded-full border-2 border-neutral-200 border-t-brand-600" aria-hidden="true" />
        <p className="text-sm text-neutral-500">Loading your resume…</p>
      </div>
    );
  }

  const current = STEPS[step - 1];
  const isLast = step === STEPS.length;
  const completedCount = [draft.headline, draft.about, draft.skills.length, draft.experience.length, draft.education.length, draft.certifications.length]
    .filter((value) => (typeof value === "string" ? value.trim().length > 0 : Number(value) > 0)).length;

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
      {/* Page header */}
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="mb-2 flex items-center gap-2 text-brand-700">
            <span className="flex size-8 items-center justify-center rounded-lg bg-brand-50">
              <Icon icon={File01Icon} size={17} strokeWidth={1.8} />
            </span>
            <span className="text-xs font-semibold uppercase tracking-[0.12em]">Your profile</span>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-neutral-900 sm:text-3xl">Build your résumé</h1>
          <p className="mt-1.5 max-w-xl text-sm leading-relaxed text-neutral-600">
            Six short steps. Everything you add here feeds your public profile and helps clients find you.
          </p>
        </div>
        <Badge tone="brand">{completedCount} of 6 sections complete</Badge>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
        {/* Main column */}
        <div className="min-w-0">
          <Stepper step={step} onSelect={setStep} />

          <section className="mt-5 rounded-2xl border border-neutral-200 bg-white p-5 sm:p-8">
            <div className="mb-6">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-brand-600">Step {step} of 6</p>
              <h2 className="mt-1.5 text-xl font-semibold tracking-tight text-neutral-900 sm:text-2xl">{current.title}</h2>
              <p className="mt-1.5 text-sm leading-relaxed text-neutral-600">{current.description}</p>
            </div>

            <div className="min-h-[180px]">
              {step === 1 && <HeadlineStep resume={draft} onChange={patchDraft} />}
              {step === 2 && <AboutStep resume={draft} onChange={patchDraft} />}
              {step === 3 && <SkillsStep resume={draft} onChange={patchDraft} />}
              {step === 4 && <ExperienceStep resume={draft} onChange={patchDraft} />}
              {step === 5 && <EducationStep resume={draft} onChange={patchDraft} />}
              {step === 6 && <CertificationsStep resume={draft} onChange={patchDraft} />}
            </div>

            <div className="mt-8 flex items-center justify-between gap-3 border-t border-neutral-100 pt-6">
              <Button
                variant="secondary"
                onClick={() => setStep((prev) => Math.max(1, prev - 1))}
                disabled={step === 1}
              >
                <Icon icon={ArrowLeft02Icon} size={15} strokeWidth={1.8} />
                Back
              </Button>
              <span className="hidden text-xs text-neutral-400 sm:block">{step} of 6</span>
              {isLast ? (
                <Button onClick={handleSave} loading={loading}>
                  Save résumé
                  <Icon icon={Tick02Icon} size={15} strokeWidth={2} />
                </Button>
              ) : (
                <Button onClick={() => setStep((prev) => Math.min(6, prev + 1))}>
                  Continue
                  <Icon icon={ArrowRight02Icon} size={15} strokeWidth={1.8} />
                </Button>
              )}
            </div>
          </section>
        </div>

        {/* Sidebar */}
        <aside className="flex flex-col gap-5">
          <div className="relative overflow-hidden rounded-2xl border border-brand-100 bg-brand-50/60 p-5">
            <div className="absolute -right-8 -top-8 size-24 rounded-full bg-brand-100/60 blur-2xl" aria-hidden="true" />
            <div className="relative">
              <span className="flex size-9 items-center justify-center rounded-lg bg-brand-600 text-white">
                <Icon icon={SparklesIcon} size={18} strokeWidth={1.8} />
              </span>
              <h3 className="mt-3 text-sm font-semibold text-neutral-900">Let AI do the heavy lifting</h3>
              <p className="mt-1.5 text-xs leading-relaxed text-neutral-600">
                Import an existing résumé or generate suggestions from what you already have.
              </p>
              <div className="mt-4 flex flex-col gap-2">
                <Button
                  variant="secondary"
                  onClick={() => { setAiKind("parse"); setShowAiPanel(true); }}
                >
                  <Icon icon={File01Icon} size={15} strokeWidth={1.8} />
                  Import résumé
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => { setAiKind("generate"); setShowAiPanel(true); }}
                >
                  <Icon icon={SparklesIcon} size={15} strokeWidth={1.8} />
                  Generate suggestions
                </Button>
              </div>
              <p className="mt-3 text-[11px] text-neutral-500">{aiQuota.remaining} AI generations left today</p>
            </div>
          </div>

          <div className="rounded-2xl border border-neutral-200 bg-white p-5">
            <h3 className="text-sm font-semibold text-neutral-900">Profile checklist</h3>
            <ul className="mt-3 space-y-2.5">
              {STEPS.map((item, index) => {
                const done = completedCount > index;
                return (
                  <li key={item.title} className="flex items-center gap-2.5 text-xs">
                    <span className={cn(
                      "flex size-5 shrink-0 items-center justify-center rounded-full",
                      done ? "bg-emerald-50 text-emerald-600" : "bg-neutral-100 text-neutral-400",
                    )}>
                      <Icon icon={done ? Tick02Icon : item.title === "Headline" ? File01Icon : item.title === "Experience" ? Briefcase02Icon : item.title === "Education" ? Mortarboard01Icon : item.title === "Certifications" ? Medal01Icon : ShieldCheckIcon} size={12} strokeWidth={2} />
                    </span>
                    <span className={done ? "text-neutral-700" : "text-neutral-500"}>{item.short}</span>
                  </li>
                );
              })}
            </ul>
          </div>
        </aside>
      </div>

      {/* AI panel */}
      <Modal open={showAiPanel} onClose={() => setShowAiPanel(false)} title={aiKind === "parse" ? "Import your résumé" : "Generate profile suggestions"}>
        <div className="space-y-5">
          {aiKind === "parse" ? (
            <>
              <Field label="Résumé text" hint="Paste up to 20,000 characters, or upload a PDF below.">
                <Textarea
                  rows={6}
                  value={resumeText}
                  onChange={(e) => setResumeText(e.target.value)}
                  maxLength={20000}
                  placeholder="Paste your résumé text here…"
                />
              </Field>
              <Field label="Or upload a PDF" hint="PDF only, up to 10 MB.">
                <input
                  type="file"
                  accept="application/pdf"
                  onChange={(e) => setResumeFile(e.target.files?.[0] ?? null)}
                  className="block w-full cursor-pointer rounded-lg border border-neutral-200 bg-white p-2.5 text-sm file:mr-3 file:rounded-md file:border-0 file:bg-brand-50 file:px-3 file:py-1.5 file:text-brand-700"
                />
              </Field>
              <Button onClick={handleAiParse} loading={loading} className="w-full">Parse with AI</Button>
            </>
          ) : (
            <>
              <p className="text-sm leading-relaxed text-neutral-600">
                AI will suggest a headline, an about section and skills based on the details you have already added.
              </p>
              <Button onClick={handleAiGenerate} loading={loading} className="w-full">Generate with AI</Button>
            </>
          )}
        </div>
      </Modal>
    </div>
  );
}

/* ---------- Stepper ---------- */

function Stepper({ step, onSelect }: { step: number; onSelect: (step: number) => void }) {
  return (
    <nav aria-label="Résumé steps" className="rounded-2xl border border-neutral-200 bg-white px-4 py-4 sm:px-6">
      <ol className="flex items-start justify-between gap-1 sm:gap-2">
        {STEPS.map((item, index) => {
          const number = index + 1;
          const done = number < step;
          const active = number === step;
          return (
            <li key={item.title} className="relative flex min-w-0 flex-1 flex-col items-center text-center">
              {index > 0 ? (
                <span
                  className={cn(
                    "absolute left-0 right-1/2 top-4 h-px",
                    done || active ? "bg-brand-300" : "bg-neutral-200",
                  )}
                  aria-hidden="true"
                />
              ) : null}
              <button
                type="button"
                onClick={() => onSelect(number)}
                aria-current={active ? "step" : undefined}
                className={cn(
                  "relative z-10 flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold transition-colors sm:size-9",
                  active
                    ? "bg-brand-600 text-white shadow-[0_4px_12px_-4px_rgba(90,80,229,0.6)]"
                    : done
                      ? "bg-emerald-50 text-emerald-600"
                      : "bg-neutral-100 text-neutral-400 hover:bg-neutral-200",
                )}
              >
                {done ? <Icon icon={Tick02Icon} size={15} strokeWidth={2.2} /> : number}
              </button>
              <span className={cn(
                "mt-2 hidden truncate text-[11px] font-medium sm:block",
                active ? "text-neutral-900" : "text-neutral-500",
              )}>
                {item.short}
              </span>
            </li>
          );
        })}
      </ol>
      <p className="mt-3 text-center text-xs text-neutral-400 sm:hidden">Step {step} of 6: {STEPS[step - 1].short}</p>
    </nav>
  );
}

/* ---------- Step bodies ---------- */

function HeadlineStep({ resume, onChange }: { resume: ResumeSection; onChange: PatchResume }) {
  const value = resume.headline ?? "";
  return (
    <Field
      label="Your headline"
      hint="A strong headline pairs your role with your top skills."
    >
      <Input
        value={value}
        onChange={(e) => onChange({ headline: e.target.value })}
        placeholder="e.g. Senior Full Stack Engineer, React, TypeScript, Node.js"
        maxLength={120}
      />
    </Field>
  );
}

function AboutStep({ resume, onChange }: { resume: ResumeSection; onChange: PatchResume }) {
  const value = resume.about ?? "";
  return (
    <Field
      label="About you"
      hint={`${value.length} of 1,200 characters. Lead with what you do best.`}
    >
      <Textarea
        rows={7}
        value={value}
        onChange={(e) => onChange({ about: e.target.value })}
        maxLength={1200}
        placeholder="Tell clients what you do, how you work and the kind of projects you enjoy…"
      />
    </Field>
  );
}

function SkillsStep({ resume, onChange }: { resume: ResumeSection; onChange: PatchResume }) {
  const toggle = (skill: string) => {
    const has = resume.skills.includes(skill);
    onChange({
      skills: has ? resume.skills.filter((s) => s !== skill) : [...resume.skills, skill].slice(0, 30),
    });
  };
  return (
    <div>
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <p className="text-sm font-medium text-neutral-800">Choose your skills</p>
        <span className="text-xs text-neutral-500">{resume.skills.length} of 30 selected</span>
      </div>
      <div className="flex flex-wrap gap-2">
        {SUGGESTED_SKILLS.map((skill) => {
          const selected = resume.skills.includes(skill);
          return (
            <button
              key={skill}
              type="button"
              onClick={() => toggle(skill)}
              aria-pressed={selected}
              className={cn(
                "inline-flex min-h-10 items-center gap-1.5 rounded-full border px-4 text-sm font-medium transition-colors",
                selected
                  ? "border-brand-600 bg-brand-600 text-white"
                  : "border-neutral-200 bg-white text-neutral-700 hover:border-brand-300 hover:bg-brand-50",
              )}
            >
              {selected ? <Icon icon={Tick02Icon} size={14} strokeWidth={2.2} /> : <Icon icon={PlusSignIcon} size={14} strokeWidth={1.8} />}
              {skill}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function ExperienceStep({ resume, onChange }: { resume: ResumeSection; onChange: PatchResume }) {
  const [company, setCompany] = useState("");
  const [role, setRole] = useState("");
  const add = () => {
    if (!company.trim() && !role.trim()) return;
    onChange({
      experience: [
        ...resume.experience,
        { company: company.trim(), role: role.trim(), start_date: "", end_date: null, description: "" },
      ],
    });
    setCompany("");
    setRole("");
  };
  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Company"><Input value={company} onChange={(e) => setCompany(e.target.value)} placeholder="e.g. Northwind Studio" /></Field>
        <Field label="Role"><Input value={role} onChange={(e) => setRole(e.target.value)} placeholder="e.g. Senior Engineer" /></Field>
      </div>
      <Button variant="secondary" onClick={add}>
        <Icon icon={PlusSignIcon} size={15} strokeWidth={1.8} />
        Add experience
      </Button>
      {resume.experience.length > 0 ? (
        <ul className="divide-y divide-neutral-100 rounded-xl border border-neutral-200">
          {resume.experience.map((entry, index) => (
            <li key={index} className="flex items-center justify-between gap-3 p-3.5">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-neutral-900">{entry.role || "Role"}</p>
                <p className="truncate text-xs text-neutral-500">{entry.company || "Company"}</p>
              </div>
              <button
                type="button"
                onClick={() => onChange({ experience: resume.experience.filter((_, i) => i !== index) })}
                aria-label={`Remove ${entry.role || "experience"}`}
                className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg text-neutral-400 hover:bg-rose-50 hover:text-rose-600"
              >
                <Icon icon={TrashIcon} size={15} strokeWidth={1.8} />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="rounded-xl border border-dashed border-neutral-200 bg-neutral-50 px-4 py-6 text-center text-sm text-neutral-500">
          No experience added yet.
        </p>
      )}
    </div>
  );
}

function EducationStep({ resume, onChange }: { resume: ResumeSection; onChange: PatchResume }) {
  const [school, setSchool] = useState("");
  const [degree, setDegree] = useState("");
  const add = () => {
    if (!school.trim()) return;
    onChange({
      education: [...resume.education, { school: school.trim(), degree: degree.trim(), field: null, start_year: 0, end_year: null }],
    });
    setSchool("");
    setDegree("");
  };
  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="School"><Input value={school} onChange={(e) => setSchool(e.target.value)} placeholder="e.g. University of Lagos" /></Field>
        <Field label="Degree"><Input value={degree} onChange={(e) => setDegree(e.target.value)} placeholder="e.g. BSc Computer Science" /></Field>
      </div>
      <Button variant="secondary" onClick={add}>
        <Icon icon={PlusSignIcon} size={15} strokeWidth={1.8} />
        Add education
      </Button>
      {resume.education.length > 0 ? (
        <ul className="divide-y divide-neutral-100 rounded-xl border border-neutral-200">
          {resume.education.map((entry, index) => (
            <li key={index} className="flex items-center justify-between gap-3 p-3.5">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-neutral-900">{entry.school}</p>
                <p className="truncate text-xs text-neutral-500">{entry.degree || "Degree not specified"}</p>
              </div>
              <button
                type="button"
                onClick={() => onChange({ education: resume.education.filter((_, i) => i !== index) })}
                aria-label={`Remove ${entry.school}`}
                className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg text-neutral-400 hover:bg-rose-50 hover:text-rose-600"
              >
                <Icon icon={TrashIcon} size={15} strokeWidth={1.8} />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="rounded-xl border border-dashed border-neutral-200 bg-neutral-50 px-4 py-6 text-center text-sm text-neutral-500">
          No education added yet.
        </p>
      )}
    </div>
  );
}

function CertificationsStep({ resume, onChange }: { resume: ResumeSection; onChange: PatchResume }) {
  const [name, setName] = useState("");
  const [issuer, setIssuer] = useState("");
  const add = () => {
    if (!name.trim()) return;
    onChange({
      certifications: [...resume.certifications, { name: name.trim(), issuer: issuer.trim() || null, year: null, credential_url: null }],
    });
    setName("");
    setIssuer("");
  };
  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Certification"><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. AWS Certified Developer" /></Field>
        <Field label="Issuer"><Input value={issuer} onChange={(e) => setIssuer(e.target.value)} placeholder="e.g. Amazon Web Services" /></Field>
      </div>
      <Button variant="secondary" onClick={add}>
        <Icon icon={PlusSignIcon} size={15} strokeWidth={1.8} />
        Add certification
      </Button>
      {resume.certifications.length > 0 ? (
        <ul className="divide-y divide-neutral-100 rounded-xl border border-neutral-200">
          {resume.certifications.map((entry, index) => (
            <li key={index} className="flex items-center justify-between gap-3 p-3.5">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-neutral-900">{entry.name}</p>
                <p className="truncate text-xs text-neutral-500">{entry.issuer ?? "Issuer not specified"}</p>
              </div>
              <button
                type="button"
                onClick={() => onChange({ certifications: resume.certifications.filter((_, i) => i !== index) })}
                aria-label={`Remove ${entry.name}`}
                className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg text-neutral-400 hover:bg-rose-50 hover:text-rose-600"
              >
                <Icon icon={TrashIcon} size={15} strokeWidth={1.8} />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="rounded-xl border border-dashed border-neutral-200 bg-neutral-50 px-4 py-6 text-center text-sm text-neutral-500">
          No certifications added yet.
        </p>
      )}
    </div>
  );
}
