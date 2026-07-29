import {
  type ButtonHTMLAttributes,
  createContext,
  type HTMLAttributes,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useState,
} from "react";
import { createPortal } from "react-dom";
import {
  overlayBackdropClassName,
  overlayMotionState,
  sheetPanelClassName,
  useOverlayPresence,
} from "../lib/overlay-motion.js";
import { cn } from "../lib/utils.js";

interface SheetContextValue {
  open: boolean;
  setOpen: (open: boolean) => void;
  titleId: string;
  descriptionId: string;
}

const SheetContext = createContext<SheetContextValue | null>(null);

function useSheetContext(component: string) {
  const context = useContext(SheetContext);
  if (!context) {
    throw new Error(`${component} must be used within Sheet`);
  }
  return context;
}

export interface SheetProps {
  children: ReactNode;
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function Sheet({ children, open: openProp, defaultOpen = false, onOpenChange }: SheetProps) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(defaultOpen);
  const open = openProp ?? uncontrolledOpen;
  const titleId = useId();
  const descriptionId = useId();

  const setOpen = useCallback(
    (next: boolean) => {
      if (openProp === undefined) {
        setUncontrolledOpen(next);
      }
      onOpenChange?.(next);
    },
    [openProp, onOpenChange],
  );

  const value = useMemo(
    () => ({ open, setOpen, titleId, descriptionId }),
    [open, setOpen, titleId, descriptionId],
  );

  return <SheetContext.Provider value={value}>{children}</SheetContext.Provider>;
}

export function SheetTrigger({
  children,
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  const { setOpen } = useSheetContext("SheetTrigger");
  return (
    <button
      type="button"
      className={className}
      onClick={(event) => {
        props.onClick?.(event);
        if (!event.defaultPrevented) setOpen(true);
      }}
      {...props}
    >
      {children}
    </button>
  );
}

export function SheetOverlay({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  const { open, setOpen } = useSheetContext("SheetOverlay");
  const { present, visible } = useOverlayPresence(open);

  if (!present) return null;

  return (
    <div
      className={cn("fixed inset-0 z-50 bg-black/50", overlayBackdropClassName, className)}
      data-state={overlayMotionState(visible)}
      onClick={() => setOpen(false)}
      {...props}
    />
  );
}

export function SheetContent({ className, children, ...props }: HTMLAttributes<HTMLDivElement>) {
  const { open, setOpen, titleId, descriptionId } = useSheetContext("SheetContent");
  const { present, visible } = useOverlayPresence(open);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, setOpen]);

  if (!present) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 overflow-hidden">
      <div
        className={cn("absolute inset-0 bg-black/50", overlayBackdropClassName)}
        data-state={overlayMotionState(visible)}
        aria-hidden
        onClick={() => setOpen(false)}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        data-state={overlayMotionState(visible)}
        className={cn(
          "absolute top-0 right-0 bottom-0 z-10 flex w-full max-w-md flex-col overflow-y-auto border-l border-slate-200 bg-white p-6 text-slate-900 shadow-lg dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100",
          sheetPanelClassName,
          className,
        )}
        onClick={(event) => event.stopPropagation()}
        {...props}
      >
        {children}
      </div>
    </div>,
    document.body,
  );
}

export function SheetHeader({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("flex flex-col gap-1.5", className)} {...props} />;
}

export function SheetFooter({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("mt-auto flex flex-col gap-2", className)} {...props} />;
}

export function SheetTitle({ className, ...props }: HTMLAttributes<HTMLHeadingElement>) {
  const { titleId } = useSheetContext("SheetTitle");
  return (
    <h2 id={titleId} className={cn("text-lg font-semibold leading-none", className)} {...props} />
  );
}

export function SheetDescription({ className, ...props }: HTMLAttributes<HTMLParagraphElement>) {
  const { descriptionId } = useSheetContext("SheetDescription");
  return (
    <p id={descriptionId} className={cn("text-sm text-slate-500 dark:text-slate-400", className)} />
  );
}

export function SheetClose({
  className,
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  const { setOpen } = useSheetContext("SheetClose");
  return (
    <button
      type="button"
      className={cn(
        "absolute right-4 top-4 rounded-sm text-slate-500 opacity-70 transition-opacity hover:opacity-100",
        className,
      )}
      onClick={(event) => {
        props.onClick?.(event);
        if (!event.defaultPrevented) setOpen(false);
      }}
      {...props}
    >
      {children ?? (
        <>
          <span className="sr-only">Close</span>
          <span aria-hidden>×</span>
        </>
      )}
    </button>
  );
}
