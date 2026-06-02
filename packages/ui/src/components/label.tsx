import type { LabelHTMLAttributes } from "react";
import { cn } from "../lib/utils.js";

export interface LabelProps extends LabelHTMLAttributes<HTMLLabelElement> {}

export function Label({ className, ...props }: LabelProps) {
  return (
    <label
      className={cn(
        "text-sm font-medium leading-none text-slate-700 peer-disabled:cursor-not-allowed peer-disabled:opacity-70 dark:text-slate-200",
        className,
      )}
      {...props}
    />
  );
}
