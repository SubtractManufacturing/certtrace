import { useState, type ButtonHTMLAttributes } from "react";
import { cn } from "../lib/utils.js";

export interface SwitchProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "onChange"> {
  checked?: boolean;
  defaultChecked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
}

export function Switch({
  className,
  checked,
  defaultChecked = false,
  onCheckedChange,
  disabled,
  ...props
}: SwitchProps) {
  const [uncontrolledChecked, setUncontrolledChecked] = useState(defaultChecked);
  const isChecked = checked ?? uncontrolledChecked;

  return (
    <button
      type="button"
      role="switch"
      aria-checked={isChecked}
      disabled={disabled}
      className={cn(
        "peer inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 disabled:cursor-not-allowed disabled:opacity-50 dark:focus-visible:ring-slate-500",
        isChecked ? "bg-slate-900 dark:bg-slate-100" : "bg-slate-200 dark:bg-slate-700",
        className,
      )}
      onClick={(event) => {
        props.onClick?.(event);
        if (event.defaultPrevented || disabled) return;
        const next = !isChecked;
        if (checked === undefined) {
          setUncontrolledChecked(next);
        }
        onCheckedChange?.(next);
      }}
      {...props}
    >
      <span
        className={cn(
          "pointer-events-none block h-5 w-5 rounded-full bg-white shadow-sm transition-transform dark:bg-slate-950",
          isChecked ? "translate-x-5" : "translate-x-0",
        )}
      />
    </button>
  );
}
