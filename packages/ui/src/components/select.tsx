import { cva, type VariantProps } from "class-variance-authority";
import type { SelectHTMLAttributes } from "react";
import { cn } from "../lib/utils.js";

const selectVariants = cva(
  "flex w-full appearance-none rounded-md border border-slate-200 bg-white px-3 py-1 pr-8 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 disabled:cursor-not-allowed disabled:opacity-50",
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

export function Select({ className, fieldSize, ...props }: SelectProps) {
  return (
    <select className={cn(selectVariants({ fieldSize, className }))} {...props} />
  );
}
