import { cva, type VariantProps } from "class-variance-authority";
import type { SelectHTMLAttributes } from "react";
import { cn } from "../lib/utils.js";

const selectVariants = cva(
  "h-9 w-full appearance-none rounded-md border border-slate-200 bg-white px-3 py-1 pr-8 text-sm text-slate-900 shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:focus-visible:ring-slate-500",
  {
    variants: {
      fieldSize: {
        default: "h-9",
        sm: "h-8 text-xs",
      },
    },
    defaultVariants: {
      fieldSize: "default",
    },
  },
);

export interface SelectProps
  extends SelectHTMLAttributes<HTMLSelectElement>,
    VariantProps<typeof selectVariants> {}

export function Select({ className, fieldSize, children, ...props }: SelectProps) {
  return (
    <div className="relative w-full">
      <select className={cn(selectVariants({ fieldSize }), className)} {...props}>
        {children}
      </select>
      <svg
        aria-hidden
        className="pointer-events-none absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500 dark:text-slate-400"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        viewBox="0 0 24 24"
      >
        <path d="m6 9 6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  );
}
