"use client";

import { forwardRef, useId, isValidElement, cloneElement, useMemo } from "react";
import { cn } from "@/lib/utils";

export const inputClass =
 "h-10 w-full rounded-lg border border-neutral-200 bg-white px-3 text-sm text-neutral-900 placeholder:text-neutral-400 transition-colors hover:border-neutral-300 focus:border-brand-500 disabled:bg-neutral-100 disabled:text-neutral-400 read-only:bg-neutral-50 aria-[invalid=true]:border-rose-400";

export const Input = forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
 function Input({ className, type = "text", ...props }, ref) {
 return <input ref={ref} type={type} className={cn(inputClass, className)} {...props} />;
 }
);

export const Textarea = forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
 function Textarea({ className, rows = 5, ...props }, ref) {
 return (
 <textarea
 ref={ref}
 rows={rows}
 className={cn(inputClass, "h-auto min-h-28 resize-y py-2.5 leading-relaxed", className)}
 {...props}
 />
 );
 }
);

/** Field wrapper: label above, helper text below-left, error below (error wins). */
export function Field({
 label,
 hint,
 error,
 required,
 className,
 children,
 id,
}: {
 label?: string;
 hint?: string;
 error?: string | boolean;
 required?: boolean;
 className?: string;
 children: React.ReactElement;
 id?: string;
}) {
 const autoId = useId();
 const inputId = id ?? (isValidElement(children) ? (children.props as { id?: string }).id : undefined) ?? autoId;
 const errorId = `${inputId}-error`;
 const hintId = `${inputId}-hint`;
 const child = useMemo(() => {
 if (!isValidElement(children)) return children;
 return cloneElement(
 children as React.ReactElement<{ id?: string; "aria-invalid"?: boolean; "aria-describedby"?: string }>,
 {
 id: inputId,
 "aria-invalid": error ? true : undefined,
 "aria-describedby": error ? errorId : hint ? hintId : undefined,
 }
 );
 }, [children, inputId, error, hint, errorId, hintId]);

 return (
 <div className={cn("flex flex-col gap-1.5", className)}>
 {label ? (
 <label htmlFor={inputId} className="flex items-center gap-1 text-sm font-medium text-neutral-800">
 {label}
 {required ? <span aria-hidden className="text-rose-500">*</span> : null}
 </label>
 ) : null}
 {child}
 {error && typeof error === "string" ? (
 <p id={errorId} className="text-[13px] text-rose-600">
 {error}
 </p>
 ) : null}
 {hint && !error ? (
 <p id={hintId} className="text-[13px] text-neutral-500">
 {hint}
 </p>
 ) : null}
 </div>
 );
}

/** Checkbox - appearance-none with the check baked in as a background image. */
export function Checkbox({
 label,
 className,
 labelClass,
 ...props
}: { label?: React.ReactNode; className?: string; labelClass?: string } & Omit<
 React.InputHTMLAttributes<HTMLInputElement>,
 "type"
>) {
 return (
 <label className={cn("inline-flex cursor-pointer items-center gap-2", className)}>
 <input
 type="checkbox"
 className={cn(
 "size-4 shrink-0 cursor-pointer appearance-none rounded border border-neutral-300 bg-white bg-no-repeat bg-center transition-colors hover:border-neutral-400 checked:border-brand-600 checked:bg-brand-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 aria-invalid:border-rose-400 disabled:cursor-auto disabled:opacity-50",
 "checked:bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns=%22http://www.w3.org/2000/svg%22%20viewBox=%220%200%2012%2012%22%20fill=%22none%22%20stroke=%22white%22%20stroke-width=%222%22%20stroke-linecap=%22round%22%20stroke-linejoin=%22round%22%3E%3Cpath%20d=%22M2.5%206.5l2.5%202.5%204.5-5%22/%3E%3C/svg%3E')]",
 "checked:bg-size-[10px_10px] checked:bg-center",
 labelClass
 )}
 {...props}
 />
 {label != null ? <span className="text-sm text-neutral-700">{label}</span> : null}
 </label>
 );
}
