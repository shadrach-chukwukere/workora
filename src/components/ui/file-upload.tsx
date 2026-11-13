"use client";

import { useRef, useState } from "react";
import { cn } from "@/lib/utils";

function sizeLabel(bytes: number): string {
 if (bytes < 1024) return `${bytes} B`;
 if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
 return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function FileUpload({
 value,
 onChange,
 multiple = true,
 hint,
 ariaLabel = "Choose files to attach",
}: {
 value: File[];
 onChange: (files: File[]) => void;
 multiple?: boolean;
 hint?: string;
 ariaLabel?: string;
}) {
 const inputRef = useRef<HTMLInputElement>(null);
 const [dragging, setDragging] = useState(false);

 function addFiles(files: File[]) {
 const upper = multiple ? 3 : 1;
 onChange([...value, ...files].slice(0, upper));
 }

 return (
 <div className="flex flex-col gap-2">
 <div
 onDragOver={(e) => {
 e.preventDefault();
 setDragging(true);
 }}
 onDragLeave={() => setDragging(false)}
 onDrop={(e) => {
 e.preventDefault();
 setDragging(false);
 addFiles(Array.from(e.dataTransfer.files));
 }}
 >
 <button
 type="button"
 onClick={() => inputRef.current?.click()}
 className={cn(
 "flex w-full flex-col items-center justify-center gap-1.5 rounded-lg border border-dashed px-4 py-6 text-center transition-colors",
 dragging ? "border-brand-500 bg-brand-50" : "border-neutral-300 hover:border-neutral-400 hover:bg-neutral-50"
 )}
 >
 <span className="font-medium text-neutral-800">Click to upload{multiple ? "" : " a file"}</span>
 <span className="text-[13px] text-neutral-500">or drag and drop{hint ? ` · ${hint}` : ""}</span>
 </button>
 <input
 ref={inputRef}
 type="file"
 multiple={multiple}
 aria-label={ariaLabel}
 className="sr-only"
 onChange={(e) => {
 addFiles(Array.from(e.target.files ?? []));
 e.target.value = "";
 }}
 />
 </div>
 {value.length ? (
 <ul className="flex flex-col gap-1.5">
 {value.map((f, i) => (
 <li key={`${f.name}-${i}`} className="flex items-center gap-2 rounded-lg border border-neutral-200 bg-white px-3 py-2">
 <span aria-hidden className="text-neutral-400">
 <svg viewBox="0 0 16 16" className="size-4" fill="none" stroke="currentColor" strokeWidth={1.4}>
 <path d="M9.5 2H5a1.5 1.5 0 00-1.5 1.5v9A1.5 1.5 0 005 14h6a1.5 1.5 0 001.5-1.5V5L9.5 2z" strokeLinejoin="round" />
 <path d="M9.5 2v3h3" strokeLinejoin="round" />
 </svg>
 </span>
 <span className="min-w-0 flex-1 truncate text-sm text-neutral-800">{f.name}</span>
 <span className="shrink-0 text-xs text-neutral-500">{sizeLabel(f.size)}</span>
 <button
 type="button"
 onClick={() => onChange(value.filter((_, idx) => idx !== i))}
 className="inline-flex size-6 shrink-0 items-center justify-center rounded-md text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700"
 aria-label={`Remove ${f.name}`}
 >
 <svg viewBox="0 0 12 12" className="size-3" fill="none" stroke="currentColor" strokeWidth={1.6}>
 <path d="M3 3l6 6M9 3l-6 6" strokeLinecap="round" />
 </svg>
 </button>
 </li>
 ))}
 </ul>
 ) : null}
 </div>
 );
}
