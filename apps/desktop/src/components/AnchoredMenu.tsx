import { cn, overlayBackdropClassName, registerOverlayDismissLayer } from "@certtrace/ui";
import {
  type CSSProperties,
  type ReactNode,
  type RefObject,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";

interface AnchoredMenuProps {
  open: boolean;
  anchorRef: RefObject<HTMLElement | null>;
  onClose: () => void;
  children: ReactNode;
  className?: string;
  role?: string;
  matchAnchorWidth?: boolean;
  align?: "start" | "end";
}

const MENU_GAP = 4;
const VIEWPORT_MARGIN = 8;
const MIN_SPACE = 120;

export function AnchoredMenu({
  open,
  anchorRef,
  onClose,
  children,
  className,
  role,
  matchAnchorWidth = false,
  align = "start",
}: AnchoredMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [style, setStyle] = useState<CSSProperties>({});
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useLayoutEffect(() => {
    if (!open) {
      return;
    }

    function updatePosition() {
      const anchor = anchorRef.current;
      const menu = menuRef.current;
      if (!anchor) {
        return;
      }
      const rect = anchor.getBoundingClientRect();
      const menuWidth = matchAnchorWidth ? rect.width : Math.max(menu?.offsetWidth ?? 160, 160);
      const spaceBelow = window.innerHeight - rect.bottom - VIEWPORT_MARGIN;
      const spaceAbove = rect.top - VIEWPORT_MARGIN;
      const openBelow = spaceBelow >= MIN_SPACE || spaceBelow >= spaceAbove;
      const maxHeight = Math.max(96, (openBelow ? spaceBelow : spaceAbove) - MENU_GAP);
      let left = align === "end" ? rect.right - menuWidth : rect.left;
      left = Math.min(
        Math.max(VIEWPORT_MARGIN, left),
        Math.max(VIEWPORT_MARGIN, window.innerWidth - menuWidth - VIEWPORT_MARGIN),
      );

      setStyle({
        top: openBelow ? rect.bottom + MENU_GAP : "auto",
        bottom: openBelow ? "auto" : window.innerHeight - rect.top + MENU_GAP,
        left,
        width: matchAnchorWidth ? rect.width : undefined,
        minWidth: matchAnchorWidth ? undefined : 160,
        maxHeight,
      });
    }

    updatePosition();
    const frame = window.requestAnimationFrame(updatePosition);
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [open, align, matchAnchorWidth, anchorRef]);

  useLayoutEffect(() => {
    if (!open) {
      return;
    }
    return registerOverlayDismissLayer({
      dismiss: () => onCloseRef.current(),
      shouldDismissOnPointerDown: (target) => {
        if (menuRef.current?.contains(target) || anchorRef.current?.contains(target)) {
          return false;
        }
        return true;
      },
      blockPointerDismiss: (target) =>
        target instanceof Element && target.classList.contains(overlayBackdropClassName),
    });
  }, [open, anchorRef]);

  if (!open) {
    return null;
  }

  return createPortal(
    <div
      ref={menuRef}
      role={role}
      className={cn(
        "fixed z-60 overflow-y-auto rounded-md border border-slate-200 bg-white py-1 shadow-lg dark:border-slate-700 dark:bg-slate-900",
        className,
      )}
      style={style}
    >
      {children}
    </div>,
    document.body,
  );
}
