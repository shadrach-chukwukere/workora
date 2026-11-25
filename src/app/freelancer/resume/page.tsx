"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { formatMoney, formatRelative } from "@/lib/format";
import { Icon, Check02Icon, CheckCircleIcon, EyeIcon, TrashIcon, File01Icon } from "@/lib/icons";

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

interface ResumeImportBody {
  headline?: string | null;
  about?: string | null;
  skills?: string[] | null;
  experience?: { company: string; role: string; start_date: string; end_date: string | null; description: string }[] | null;
  education?: { school: string; degree: string; field: string | null; start_year: number; end_year: number | null }[] | null;
  certifications?: { name: string; issuer: string | null; year: number | null; credential_url: string | null }[] | null;
  sections?: string[] | null;
}

interface AiQuota {
  limit: number;
  used: number;
  remaining: number;
}

export default function FreelancerResumePage() {
  const router = useRouter();
  const [section, setSection] = useState<headline | about | skills | experience | education | certifications>("headline");
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [showAiPanel, setShowAiPanel] = useState(false);
  const [aiQuota, setAiQuota] = useState<AiQuota>({ limit: 10, used: 0, remaining: 10 });
  const [aiKind, setAiKind] = useState<"parse" | "generate">("parse");

  // Load resume data
  const { data: resume, isLoading: isLoadingResume } = useQuery({
    queryKey: ["freelancer-resume"],
    queryFn: async () => {
      const res = await fetch("/api/v1/users/me/resume", {
        credentials: "include",
      });
      if (res.status === 401) return null;
      if (!res.ok) throw new Error("Failed to load resume");
      return (await res.json()).data;
    },
    staleTime: 60_000,
  });

  if (isLoadingResume) {
    return (
      <div className="flex flex-col items-center py-12">
        <span className="animation-spin rounded-full h-8 w-8 border-b border-brand-600"></span>
        <span className="ml-4 text-sm text-neutral-500">Loading resume…</span>
      </div>
    );
  }

  const resumeData: ResumeSection = resume || {
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

  // Update quota display
  useEffect(() => {
    if (aiQuota.remaining <= 2) {
      toast.warning(`Only ${aiQuota.remaining} AI generation(s) remaining today. Upgrade your plan for more quota.`);
    }
  }, [aiQuota]);

  const handleSetSection = (newSection: keyof ResumeSection) => {
    setSection(newSection);
    setStep(prev => Math.max(1, prev));
  };

  const handleSaveSection = async (values: Partial<ResumeSection>) => {
    setLoading(true);
    try {
      const res = await fetch("/api/v1/users/me/resume-file", {
        method: "PUT",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          url: values.resume_url,
          fileName: values.resume_file_name,
          visibility: values.resume_visibility,
        }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success("Resume saved");
        setShowAiPanel(false);
        router.refresh();
      } else {
        toast.error(data.message ?? "Failed to save resume");
      }
    } catch (e) {
      toast.error("Failed to save resume");
    } finally {
      setLoading(false);
    }
  };

  const handleAiImport = async () => {
    setShowAiPanel(true);
    setAiKind("parse");
  };

  const handleAiGenerate = async () => {
    setShowAiPanel(true);
    setAiKind("generate");
  };

  // AI quota check and usage
  useEffect(() => {
    // Simulate quota fetch - in production would call /ai/quota
    const fakeQuota: AiQuota = { limit: 10, used: 3, remaining: 7 };
    setAiQuota(fakeQuota);
  }, []);

  if (step > 6) {
    return (
      <div className="py-12">
        <h2 className="text-[11px] font-semibold uppercase tracking-wide text-neutral-400">Resume strength</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="card p-4">
            <h3 className="text-sm font-medium text-neutral-900">Headline</h3>
            <p className="mt-1">{resumeData.headline ?? "—"}</p>
          </div>
          <div className="card p-4">
            <h3 className="text-sm font-medium text-neutral-900">About</h3>
            <p className="mt-1">{resumeData.about?.slice(0, 80) ?? "—"}{resumeData.about?.length > 80 ? "…" : ""}</p>
          </div>
          <div className="card p-4">
            <h3 className="text-sm font-medium text-neutral-900">Skills</h3>
            <p className="mt-1">{resumeData.skills.length > 0 ? resumeData.skills.slice(0, 5).join(", ") : "No skills added"}</p>
          </div>
        </div>
        <div className="mt-6">
          <Button onClick={() => router.push("/freelancer/resume")} className="w-full">
            Edit resume
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stepper */}
      <div className="grid grid-cols-6 gap-2 bg-neutral-100 px-2 py-1 rounded text-xs font-medium text-neutral-500">
        <div className="col-span-1">{step} of 6</div>
        <div className={`col-span-1 ${step > 1 ? "bg-brand-600 text-white" : ""}`}>1</div>
        <div className={`col-span-1 ${step > 2 ? "bg-brand-600 text-white" : ""}`}>2</div>
        <div className={`col-span-1 ${step > 3 ? "bg-brand-600 text-white" : ""}`}>3</div>
        <div className={`col-span-1 ${step > 4 ? "bg-brand-600 text-white" : ""}`}>4</div>
        <div className={`col-span-1 ${step > 5 ? "bg-brand-600 text-white" : ""}`}>5</div>
      </div>

      {/* Current step content */}
      <section className="card p-6">
        <h2 className="text-[11px] font-semibold uppercase tracking-wide text-neutral-400">
          {step}/6 - {getStepTitle(step)}
        </h2>

        {step === 1 && renderHeadlineStep(resumeData)}
        {step === 2 && renderAboutStep(resumeData)}
        {step === 3 && renderSkillsStep(resumeData)}
        {step === 4 && renderExperienceStep(resumeData)}
        {step === 5 && renderEducationStep(resumeData)}
        {step === 6 && renderCertificationsStep(resumeData)}

        {step < 6 && (
          <div className="mt-6 flex gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setStep(prev => Math.max(1, prev - 1))}
              disabled={step <= 1}
            >
              Previous
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={() => setStep(prev => Math.min(6, prev + 1))}
              disabled={step >= 6}
            >
              {step < 6 ? "Next" : "Save & Continue"}
            </Button>
          </div>
        )}
        {step === 6 && (
          <div className="mt-6 flex gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setStep(prev => Math.max(1, prev - 1))}
              disabled={step <= 1}
            >
              Previous
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleSaveSection}
            >
              Save Resume
            </Button>
          </div>
        )}
      </section>

      {/* AI Panel */}
      {showAiPanel && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-zxl z-50 flex items-center justify-center">
          <div className="bg-white rounded-lg p-8 max-w-md w-full shadow-2xl">
            <h3 className="text-lg font-semibold text-neutral-900 mb-6">
              {aiKind === "parse" ? "AI Resume Parse" : "AI Profile Generate"}
            </h3>

            {aiKind === "parse" && (
              <>
                <div className="mb-6">
                  <label className="block text-sm text-neutral-700 mb-2">
                    Paste resume text (max 20,000 chars) or upload PDF:
                  </label>
                  <textarea
                    className="w-full rounded-lg border border-neutral-200 p-3 text-sm h-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 focus-visible:ring-offset-1 resize-y"
                    placeholder="Paste your resume text here or describe what you want..."
                    maxLength={20000}
                    onChange={(e) => setResumeText(e.target.value)}
                  ></textarea>
                </div>

                <div className="mb-4">
                  <label className="block text-sm text-neutral-700 mb-2">
                    Or upload PDF (max 10 MB):
                  </label>
                  <input
                    type="file"
                    accept="application/pdf"
                    className="w-full rounded-lg border border-neutral-200 p-2.5 text-sm cursor-pointer hover:border-brand-500"
                    onChange={(e) => setResumeFile(e.target.files?.[0])}
                  />
                  <p className="mt-1 text-[10px] text-neutral-500">
                    PDF must be 10 MB or smaller
                  </p>
                </div>

                <Button
                  onClick={handleAiParse}
                  className="w-full bg-brand-600 text-white hover:bg-brand-700"
                >
                  {aiKind === "parse" ? "Parse with AI" : "Generate profile"}
                </Button>
              </>
            )}

            {aiKind === "generate" && (
              <>
                <p className="text-sm text-neutral-500 mb-4">
                  AI will generate headline options, about section, and skill suggestions based on your profile facts.
                </p>
                <Button onClick={handleAiGenerateConfirm} className="w-full bg-brand-600 text-white hover:bg-brand-700">
                  Generate with AI
                </Button>
              </>
            )}

            <Button
              onClick={() => setShowAiPanel(false)}
              className="mt-4 w-full text-neutral-600 hover:text-neutral-900"
            >
              Close
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function getStepTitle(step: number) {
  const titles = ["Headline", "About", "Skills", "Experience", "Education", "Certifications"];
  return titles[step - 1];
}

function renderHeadlineStep(resume: ResumeSection) {
  return (
    <div>
      <label className="block text-sm text-neutral-700 mb-2">
        Headline (120 chars max)
      </label>
      <Input
        value={resume.headline ?? ""}
        onChange={(e) => {/* update state */}
        }
        placeholder="e.g. Senior Full Stack Engineer | React, TypeScript, Node.js"
        maxLength={120}
        className="block w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-900 placeholder:text-neutral-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 focus-visible:ring-offset-1 hover:border-neutral-300"
      />
    </div>
  );
}

function renderAboutStep(resume: ResumeSection) {
  return (
    <div>
      <label className="block text-sm text-neutral-700 mb-2">
        About section (120-1200 chars)
      </label>
      <textarea
        className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-900 placeholder:text-neutral-400 resize-none h-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 focus-visible:ring-offset-1 hover:border-neutral-300"
        rows={4}
        placeholder="Tell your story. What do you do? Why Workora? What are you passionate about?"
      >
        {resume.about ?? ""}
      </textarea>
    </div>
  );
}

function renderSkillsStep(resume: ResumeSection) {
  return (
    <div>
      <label className="block text-sm text-neutral-700 mb-2">
        Skills (max 30)
      </label>
      <div className="grid grid-cols-2 gap-2">
        {["React", "TypeScript", "Node.js", "Python", "Docker", "Kubernetes", "GraphQL", "AWS"].map((skill) => (
          <Button
            key={skill}
            size="sm"
            variant="outline"
            className="w-full text-left"
          >
            {skill}
          </Button>
        ))}
      </div>
    </div>
  );
}

function renderExperienceStep(resume: ResumeSection) {
  return (
    <div>
      <label className="block text-sm text-neutral-700 mb-2">
        Add work experience
      </label>
      <Input
        placeholder="Company"
        className="block w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-900 placeholder:text-neutral-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 focus-visible:ring-offset-1 hover:border-neutral-300"
      />
      <Input
        placeholder="Role"
        className="block w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-900 placeholder:text-neutral-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 focus-visible:ring-offset-1 hover:border-neutral-300 mt-2"
      />
    </div>
  );
}

function renderEducationStep(resume: ResumeSection) {
  return (
    <div>
      <label className="block text-sm text-neutral-700 mb-2">
        Add education
      </label>
      <Input
        placeholder="School"
        className="block w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-900 placeholder:text-neutral-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 focus-visible:ring-offset-1 hover:border-neutral-300"
      />
    </div>
  );
}

function renderCertificationsStep(resume: ResumeSection) {
  return (
    <div>
      <label className="block text-sm text-neutral-700 mb-2">
        Add certification
      </label>
      <Input
        placeholder="Certification name"
        className="block w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-900 placeholder:text-neutral-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 focus-visible:ring-offset-1 hover:border-neutral-300"
      />
    </div>
  );
}