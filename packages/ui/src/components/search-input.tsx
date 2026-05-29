import type { InputHTMLAttributes } from "react";
import { cn } from "../lib/utils.js";
import { Input } from "./input.js";

export interface SearchInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "type"> {}

export function SearchInput({ className, ...props }: SearchInputProps) {
  return (
    <div className="relative">
      <svg
        aria-hidden
        className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        viewBox="0 0 24 24"
      >
        <circle cx="11" cy="11" r="7" />
        <path d="M20 20 17 17" strokeLinecap="round" />
      </svg>
      <Input
        type="search"
        className={cn("pl-9", className)}
        {...props}
      />
    </div>
  );
}
