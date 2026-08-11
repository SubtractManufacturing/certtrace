import { cva, type VariantProps } from "class-variance-authority";
import {
  type ChangeEvent,
  Children,
  isValidElement,
  type ReactElement,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
  type SelectHTMLAttributes,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { cn } from "../lib/utils.js";
import { Input } from "./input.js";

const selectVariants = cva(
  "flex w-full items-center justify-between gap-2 rounded-md border border-slate-200 bg-white px-3 py-1 text-left text-sm text-slate-900 shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:focus-visible:ring-slate-500",
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

interface ParsedOption {
  value: string;
  label: string;
  disabled?: boolean;
}

function optionLabel(children: ReactNode): string {
  if (children === null || children === undefined || typeof children === "boolean") {
    return "";
  }
  if (typeof children === "string" || typeof children === "number") {
    return String(children);
  }
  return Children.toArray(children)
    .map((child) => optionLabel(child))
    .join("");
}

function parseSelectOptions(children: ReactNode): ParsedOption[] {
  const options: ParsedOption[] = [];

  Children.forEach(children, (child) => {
    if (!isValidElement(child)) {
      return;
    }

    const element = child as ReactElement<{
      value?: string | number;
      disabled?: boolean;
      children?: ReactNode;
    }>;

    if (element.type !== "option") {
      return;
    }

    const rawValue = element.props.value;
    const value =
      rawValue === undefined || rawValue === null
        ? optionLabel(element.props.children)
        : String(rawValue);

    options.push({
      value,
      label: optionLabel(element.props.children) || value,
      disabled: element.props.disabled,
    });
  });

  return options;
}

function createSyntheticChangeEvent(
  value: string | string[],
  options: ParsedOption[],
): ChangeEvent<HTMLSelectElement> {
  const selectedValues = Array.isArray(value) ? value : value === "" ? [] : [value];
  const selectedOptions = selectedValues.map((selectedValue) => {
    const option = options.find((entry) => entry.value === selectedValue);
    return {
      value: selectedValue,
      label: option?.label ?? selectedValue,
    };
  });

  const target = {
    value: Array.isArray(value) ? (value[0] ?? "") : value,
    selectedOptions,
  } as unknown as HTMLSelectElement;

  return {
    target,
    currentTarget: target,
  } as ChangeEvent<HTMLSelectElement>;
}

function ChevronIcon({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden
      className={cn("h-4 w-4 shrink-0 text-slate-500 dark:text-slate-400", className)}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      viewBox="0 0 24 24"
    >
      <path d="m6 9 6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden
      className={cn("h-4 w-4 shrink-0 text-slate-900 dark:text-slate-100", className)}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      viewBox="0 0 24 24"
    >
      <path d="m5 13 4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export interface SelectProps
  extends Omit<SelectHTMLAttributes<HTMLSelectElement>, "children" | "size">,
    VariantProps<typeof selectVariants> {
  children: ReactNode;
  footer?: ReactNode;
  /** When true, the open menu includes a typeahead field that filters options by label. */
  searchable?: boolean;
  searchPlaceholder?: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function Select({
  className,
  fieldSize,
  children,
  footer,
  searchable = false,
  searchPlaceholder = "Search…",
  value,
  defaultValue,
  disabled,
  multiple,
  onChange,
  id,
  name,
  required,
  open: openProp,
  onOpenChange,
  "aria-label": ariaLabel,
  "aria-labelledby": ariaLabelledBy,
}: SelectProps) {
  const options = useMemo(() => parseSelectOptions(children), [children]);
  const listboxId = useId();
  const searchInputId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const open = openProp ?? uncontrolledOpen;
  const isControlled = value !== undefined;
  const [uncontrolledValue, setUncontrolledValue] = useState<string | string[] | undefined>(
    undefined,
  );
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [searchQuery, setSearchQuery] = useState("");
  const [menuStyle, setMenuStyle] = useState<{ top: number; left: number; width: number } | null>(
    null,
  );

  const setOpen = useCallback(
    (next: boolean) => {
      if (openProp === undefined) {
        setUncontrolledOpen(next);
      }
      onOpenChange?.(next);
    },
    [onOpenChange, openProp],
  );

  const selectedValues = useMemo(() => {
    const raw = isControlled ? value : (uncontrolledValue ?? defaultValue ?? (multiple ? [] : ""));
    if (multiple) {
      return Array.isArray(raw)
        ? raw.map(String)
        : raw === "" || raw === undefined
          ? []
          : [String(raw)];
    }
    return Array.isArray(raw) ? [String(raw[0] ?? "")] : [String(raw ?? "")];
  }, [defaultValue, isControlled, multiple, uncontrolledValue, value]);

  const selectedValue = multiple ? selectedValues : (selectedValues[0] ?? "");
  const visibleOptions = useMemo(() => {
    if (!searchable || multiple) {
      return options;
    }
    const needle = searchQuery.trim().toLowerCase();
    if (!needle) {
      return options;
    }
    return options.filter((option) => {
      if (option.value === "") {
        return false;
      }
      return option.label.toLowerCase().includes(needle);
    });
  }, [multiple, options, searchQuery, searchable]);
  const enabledOptions = useMemo(
    () => visibleOptions.filter((option) => !option.disabled),
    [visibleOptions],
  );
  const selectedLabels = options
    .filter((option) => selectedValues.includes(option.value))
    .map((option) => option.label);

  const placeholderOption = options.find((option) => option.value === "");
  const triggerLabel = multiple
    ? selectedLabels.length > 0
      ? selectedLabels.join(", ")
      : (placeholderOption?.label ?? "Select…")
    : (selectedLabels[0] ?? placeholderOption?.label ?? "Select…");

  const showPlaceholder = multiple ? selectedLabels.length === 0 : selectedValue === "";

  const updateMenuPosition = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger) {
      return;
    }

    const rect = trigger.getBoundingClientRect();
    const viewportPadding = 8;
    const searchHeight = searchable && !multiple ? 44 : 0;
    const estimatedMenuHeight = Math.min(
      enabledOptions.length * 36 + (footer ? 44 : 0) + searchHeight + 8,
      280,
    );
    const spaceBelow = window.innerHeight - rect.bottom - viewportPadding;
    const spaceAbove = rect.top - viewportPadding;
    const openUpward = spaceBelow < estimatedMenuHeight && spaceAbove > spaceBelow;
    const top = openUpward
      ? Math.max(viewportPadding, rect.top - estimatedMenuHeight - 4)
      : rect.bottom + 4;

    setMenuStyle({
      top,
      left: rect.left,
      width: rect.width,
    });
  }, [enabledOptions.length, footer, multiple, searchable]);

  const closeMenu = useCallback(() => {
    setOpen(false);
    setHighlightedIndex(-1);
    setSearchQuery("");
  }, [setOpen]);

  const emitChange = useCallback(
    (nextValue: string | string[]) => {
      onChange?.(createSyntheticChangeEvent(nextValue, options));
    },
    [onChange, options],
  );

  const selectOption = useCallback(
    (option: ParsedOption) => {
      if (option.disabled) {
        return;
      }

      if (multiple) {
        const next = selectedValues.includes(option.value)
          ? selectedValues.filter((entry) => entry !== option.value)
          : [...selectedValues, option.value];
        if (!isControlled) {
          setUncontrolledValue(next);
        }
        emitChange(next);
        return;
      }

      if (!isControlled) {
        setUncontrolledValue(option.value);
      }
      emitChange(option.value);
      closeMenu();
      triggerRef.current?.focus();
    },
    [closeMenu, emitChange, isControlled, multiple, selectedValues],
  );

  useLayoutEffect(() => {
    if (!open) {
      return;
    }
    updateMenuPosition();
  }, [open, updateMenuPosition]);

  useEffect(() => {
    if (!open) {
      return;
    }

    function onPointerDown(event: MouseEvent) {
      const target = event.target as Node;
      if (rootRef.current?.contains(target) || listRef.current?.contains(target)) {
        return;
      }
      closeMenu();
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        closeMenu();
        triggerRef.current?.focus();
      }
    }

    function onReposition() {
      updateMenuPosition();
    }

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    window.addEventListener("resize", onReposition);
    window.addEventListener("scroll", onReposition, true);

    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("resize", onReposition);
      window.removeEventListener("scroll", onReposition, true);
    };
  }, [closeMenu, open, updateMenuPosition]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const selectedIndex = enabledOptions.findIndex((option) =>
      multiple ? selectedValues.includes(option.value) : option.value === selectedValue,
    );
    setHighlightedIndex(selectedIndex >= 0 ? selectedIndex : enabledOptions.length > 0 ? 0 : -1);
  }, [enabledOptions, multiple, open, selectedValue, selectedValues]);

  function moveHighlight(delta: number) {
    setHighlightedIndex((current) => {
      if (enabledOptions.length === 0) {
        return -1;
      }
      if (current < 0) {
        return delta > 0 ? 0 : enabledOptions.length - 1;
      }
      const next = current + delta;
      if (next >= enabledOptions.length) {
        return 0;
      }
      if (next < 0) {
        return enabledOptions.length - 1;
      }
      return next;
    });
  }

  function onListNavigationKeyDown(event: ReactKeyboardEvent) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      moveHighlight(1);
      return true;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      moveHighlight(-1);
      return true;
    }

    if (event.key === "Home") {
      event.preventDefault();
      setHighlightedIndex(enabledOptions.length > 0 ? 0 : -1);
      return true;
    }

    if (event.key === "End") {
      event.preventDefault();
      setHighlightedIndex(enabledOptions.length > 0 ? enabledOptions.length - 1 : -1);
      return true;
    }

    if (event.key === "Enter") {
      event.preventDefault();
      const option = enabledOptions[highlightedIndex];
      if (option) {
        selectOption(option);
      }
      return true;
    }

    return false;
  }

  function onTriggerKeyDown(event: ReactKeyboardEvent<HTMLButtonElement>) {
    if (disabled) {
      return;
    }

    if (!open) {
      if (
        event.key === "ArrowDown" ||
        event.key === "ArrowUp" ||
        event.key === "Enter" ||
        event.key === " "
      ) {
        event.preventDefault();
        setOpen(true);
        return;
      }
      if (
        searchable &&
        !multiple &&
        event.key.length === 1 &&
        !event.metaKey &&
        !event.ctrlKey &&
        !event.altKey
      ) {
        event.preventDefault();
        setSearchQuery(event.key);
        setOpen(true);
      }
      return;
    }

    if (event.key === " " && !searchable) {
      event.preventDefault();
      const option = enabledOptions[highlightedIndex];
      if (option) {
        selectOption(option);
      }
      return;
    }

    onListNavigationKeyDown(event);
  }

  function onSearchKeyDown(event: ReactKeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      closeMenu();
      triggerRef.current?.focus();
      return;
    }
    void onListNavigationKeyDown(event);
  }

  if (multiple) {
    return (
      <div ref={rootRef} className={cn("w-full", className)}>
        <div
          id={id}
          role="listbox"
          aria-label={ariaLabel}
          aria-labelledby={ariaLabelledBy}
          aria-multiselectable="true"
          aria-disabled={disabled || undefined}
          data-value={selectedValues.join(",")}
          className={cn(
            "max-h-40 overflow-y-auto rounded-md border border-slate-200 bg-white p-1 shadow-sm dark:border-slate-700 dark:bg-slate-950",
            disabled && "pointer-events-none opacity-50",
          )}
        >
          {options.map((option) => {
            const selected = selectedValues.includes(option.value);
            return (
              <button
                key={option.value || "__empty__"}
                type="button"
                role="option"
                aria-selected={selected}
                data-value={option.value}
                disabled={disabled || option.disabled}
                className={cn(
                  "flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm text-slate-900 transition-colors hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 disabled:cursor-not-allowed disabled:opacity-50 dark:text-slate-100 dark:hover:bg-slate-800 dark:focus-visible:ring-slate-500",
                  selected && "bg-slate-100 dark:bg-slate-800",
                )}
                onClick={() => selectOption(option)}
              >
                <span className="flex h-4 w-4 items-center justify-center">
                  {selected ? <CheckIcon /> : null}
                </span>
                <span className="truncate">{option.label}</span>
              </button>
            );
          })}
          {footer ? (
            <div className="shrink-0 border-t border-slate-200 pt-1 dark:border-slate-700">
              {footer}
            </div>
          ) : null}
        </div>
        {name ? (
          <select
            multiple
            name={name}
            required={required}
            className="sr-only"
            tabIndex={-1}
            aria-hidden
            value={selectedValues}
            onChange={() => undefined}
          >
            {children}
          </select>
        ) : null}
      </div>
    );
  }

  return (
    <div ref={rootRef} className={cn("relative w-full", className)}>
      <button
        ref={triggerRef}
        id={id}
        type="button"
        role="combobox"
        aria-label={ariaLabel}
        aria-labelledby={ariaLabelledBy}
        aria-controls={listboxId}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-required={required || undefined}
        disabled={disabled}
        data-value={selectedValue}
        className={cn(selectVariants({ fieldSize }), "pr-2")}
        onClick={() => {
          if (disabled) {
            return;
          }
          setOpen(!open);
        }}
        onKeyDown={onTriggerKeyDown}
      >
        <span className={cn("truncate", showPlaceholder && "text-slate-500 dark:text-slate-400")}>
          {triggerLabel}
        </span>
        <ChevronIcon className={cn("transition-transform", open && "rotate-180")} />
      </button>

      {name ? (
        <select
          name={name}
          required={required}
          className="sr-only"
          tabIndex={-1}
          aria-hidden
          value={selectedValue}
          onChange={() => undefined}
        >
          {children}
        </select>
      ) : null}

      {open && menuStyle
        ? createPortal(
            <div
              ref={listRef}
              id={listboxId}
              role="listbox"
              aria-label={ariaLabel}
              aria-labelledby={ariaLabelledBy}
              className="fixed z-[100] flex max-h-72 flex-col overflow-hidden rounded-md border border-slate-200 bg-white shadow-lg dark:border-slate-700 dark:bg-slate-950"
              style={{
                top: menuStyle.top,
                left: menuStyle.left,
                width: menuStyle.width,
              }}
            >
              {searchable ? (
                <div className="shrink-0 border-b border-slate-200 p-1.5 dark:border-slate-700">
                  <Input
                    id={searchInputId}
                    value={searchQuery}
                    placeholder={searchPlaceholder}
                    aria-label={searchPlaceholder}
                    className="h-8"
                    autoFocus
                    onChange={(event) => setSearchQuery(event.target.value)}
                    onKeyDown={onSearchKeyDown}
                    onClick={(event) => event.stopPropagation()}
                  />
                </div>
              ) : null}
              <div className="overflow-y-auto p-1">
                {visibleOptions.length === 0 ? (
                  <p className="px-2 py-1.5 text-sm text-slate-500 dark:text-slate-400">
                    No matches
                  </p>
                ) : (
                  visibleOptions.map((option) => {
                    const selected = option.value === selectedValue;
                    const highlighted = enabledOptions[highlightedIndex]?.value === option.value;
                    return (
                      <button
                        key={option.value || "__empty__"}
                        type="button"
                        role="option"
                        aria-selected={selected}
                        data-value={option.value}
                        disabled={option.disabled}
                        data-highlighted={highlighted || undefined}
                        className={cn(
                          "flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm text-slate-900 transition-colors hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 disabled:cursor-not-allowed disabled:opacity-50 dark:text-slate-100 dark:hover:bg-slate-800 dark:focus-visible:ring-slate-500",
                          selected && "bg-slate-100 dark:bg-slate-800",
                          highlighted && !selected && "bg-slate-50 dark:bg-slate-900",
                        )}
                        onMouseEnter={() => {
                          const enabledIndex = enabledOptions.findIndex(
                            (entry) => entry.value === option.value,
                          );
                          if (enabledIndex >= 0) {
                            setHighlightedIndex(enabledIndex);
                          }
                        }}
                        onClick={() => selectOption(option)}
                      >
                        <span className="flex h-4 w-4 items-center justify-center">
                          {selected ? <CheckIcon /> : null}
                        </span>
                        <span className="truncate">{option.label}</span>
                      </button>
                    );
                  })
                )}
              </div>
              {footer ? (
                <div className="shrink-0 border-t border-slate-200 p-1 dark:border-slate-700">
                  {footer}
                </div>
              ) : null}
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
