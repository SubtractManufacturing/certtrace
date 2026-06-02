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
      data-state={isChecked ? "checked" : "unchecked"}
      disabled={disabled}
      className={cn("certtrace-switch", className)}
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
      <span className="certtrace-switch-thumb" aria-hidden />
    </button>
  );
}
