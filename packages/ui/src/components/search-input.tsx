import type { InputHTMLAttributes } from "react";
import { cn } from "../lib/utils.js";

export interface SearchInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "type"> {}

export function SearchInput({ className, ...props }: SearchInputProps) {
  return (
    <div
      className={cn(
        "flex h-9 min-w-0 flex-1 items-center gap-2 rounded-md border border-slate-200 bg-white px-3 shadow-sm focus-within:ring-2 focus-within:ring-slate-400 dark:border-slate-700 dark:bg-slate-950 dark:focus-within:ring-slate-500",
        className,
      )}
    >
      <svg
        aria-hidden
        className="h-4 w-4 shrink-0 text-slate-400 dark:text-slate-500"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        viewBox="0 0 24 24"
      >
        <circle cx="11" cy="11" r="7" />
        <path d="M20 20 17 17" strokeLinecap="round" />
      </svg>
      <input
        type="text"
        className="min-w-0 flex-1 bg-transparent text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none dark:text-slate-100 dark:placeholder:text-slate-500"
        {...props}
      />
    </div>
  );
}
