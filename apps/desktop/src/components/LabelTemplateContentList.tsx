import type {
  FieldSchemaV1,
  LabelContentAlign,
  LabelContentItem,
  LabelContentSize,
} from "@certtrace/types";
import { cn, Switch } from "@certtrace/ui";
import { AlignCenter, AlignLeft, AlignRight, GripVertical } from "lucide-react";
import {
  type PointerEvent as ReactPointerEvent,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import {
  disableContentItem,
  enableContentItem,
  labelContentListRows,
  labelContentOptions,
  patchContentItem,
  reorderContentItems,
} from "../lib/label-template-content";

const ALIGN_OPTIONS: { value: LabelContentAlign; label: string; Icon: typeof AlignLeft }[] = [
  { value: "left", label: "Left align", Icon: AlignLeft },
  { value: "center", label: "Center", Icon: AlignCenter },
  { value: "right", label: "Right align", Icon: AlignRight },
];

const SIZE_OPTIONS: { value: LabelContentSize; label: string; short: string }[] = [
  { value: "small", label: "Small", short: "S" },
  { value: "medium", label: "Medium", short: "M" },
  { value: "large", label: "Large", short: "L" },
];

const DRAG_SCALE = 1.045;
const FLIP_MS = 200;

interface DragSession {
  key: string;
  width: number;
  height: number;
  offsetX: number;
  offsetY: number;
  left: number;
  top: number;
}

interface LabelTemplateContentListProps {
  fieldSchema: FieldSchemaV1;
  content: LabelContentItem[];
  onContentChange: (content: LabelContentItem[]) => void;
  onInvalidDisable: () => void;
}

function ContentRowBody({
  optionLabel,
  item,
  enabled,
  showControls,
  onAlign,
  onSize,
  onIncludeChange,
}: {
  optionLabel: string;
  item: LabelContentItem | null;
  enabled: boolean;
  showControls: boolean;
  onAlign?: (align: LabelContentAlign) => void;
  onSize?: (size: LabelContentSize) => void;
  onIncludeChange?: (checked: boolean) => void;
}) {
  return (
    <>
      <Switch
        aria-label={`Include ${optionLabel}`}
        checked={enabled}
        onCheckedChange={onIncludeChange}
        disabled={!onIncludeChange}
      />
      <span className="min-w-0 flex-1 truncate">{optionLabel}</span>
      {showControls && item && onAlign && onSize ? (
        <div className="flex shrink-0 items-center gap-1.5">
          <div
            role="radiogroup"
            aria-label={`Align ${optionLabel}`}
            className="inline-flex rounded-md border border-slate-200 p-0.5 dark:border-slate-600"
          >
            {ALIGN_OPTIONS.map(({ value, label, Icon }) => (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={item.align === value}
                aria-label={label}
                className={cn(
                  "rounded px-1 py-0.5 text-slate-500 hover:text-slate-800 dark:hover:text-slate-100",
                  item.align === value &&
                    "bg-slate-200 text-slate-900 dark:bg-slate-700 dark:text-slate-50",
                )}
                onClick={() => onAlign(value)}
              >
                <Icon className="h-3.5 w-3.5" aria-hidden />
              </button>
            ))}
          </div>
          <div
            role="radiogroup"
            aria-label={`Size ${optionLabel}`}
            className="inline-flex overflow-hidden rounded-md border border-slate-200 text-[11px] font-medium leading-none dark:border-slate-600"
          >
            {SIZE_OPTIONS.map(({ value, label, short }, index) => (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={item.size === value}
                aria-label={label}
                className={cn(
                  "px-1.5 py-1 text-slate-500 hover:text-slate-800 dark:hover:text-slate-100",
                  index > 0 && "border-l border-slate-200 dark:border-slate-600",
                  item.size === value &&
                    "bg-slate-200 text-slate-900 dark:bg-slate-700 dark:text-slate-50",
                )}
                onClick={() => onSize(value)}
              >
                {short}
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </>
  );
}

export function LabelTemplateContentList({
  fieldSchema,
  content,
  onContentChange,
  onInvalidDisable,
}: LabelTemplateContentListProps) {
  const listRef = useRef<HTMLDivElement>(null);
  const ghostRef = useRef<HTMLDivElement>(null);
  const rowRefs = useRef(new Map<string, HTMLDivElement>());
  const prevRectsRef = useRef(new Map<string, DOMRect>());
  const contentRef = useRef(content);
  const onContentChangeRef = useRef(onContentChange);
  const [drag, setDrag] = useState<DragSession | null>(null);

  contentRef.current = content;
  onContentChangeRef.current = onContentChange;

  const rows = labelContentListRows(labelContentOptions(fieldSchema), content);
  const draggedRow = drag
    ? rows.find((row) => row.kind === "enabled" && row.option.key === drag.key)
    : null;

  // Re-run when content order changes so FLIP can animate sibling rows during drag.
  // biome-ignore lint/correctness/useExhaustiveDependencies: content triggers FLIP; effect reads DOM refs
  useLayoutEffect(() => {
    if (!drag) {
      prevRectsRef.current.clear();
      return;
    }

    const nextRects = new Map<string, DOMRect>();
    for (const [key, element] of rowRefs.current) {
      if (!element.isConnected) {
        continue;
      }
      const next = element.getBoundingClientRect();
      nextRects.set(key, next);
      const prev = prevRectsRef.current.get(key);
      if (!prev || key === drag.key) {
        continue;
      }
      const dy = prev.top - next.top;
      if (Math.abs(dy) < 0.5) {
        continue;
      }
      element.style.transition = "none";
      element.style.transform = `translateY(${dy}px)`;
      void element.offsetHeight;
      element.style.transition = `transform ${FLIP_MS}ms cubic-bezier(0.2, 0.8, 0.2, 1)`;
      element.style.transform = "translateY(0)";
    }
    prevRectsRef.current = nextRects;
  }, [content, drag]);

  useEffect(() => {
    if (!drag) {
      return;
    }

    function captureRects() {
      const rects = new Map<string, DOMRect>();
      for (const [key, element] of rowRefs.current) {
        if (element.isConnected) {
          rects.set(key, element.getBoundingClientRect());
        }
      }
      prevRectsRef.current = rects;
    }

    /** One adjacent swap per move, only after crossing a neighbor's midpoint. */
    function maybeReorderAdjacent(clientY: number, fromKey: string) {
      const current = contentRef.current;
      const from = current.findIndex((item) => item.key === fromKey);
      if (from < 0) {
        return;
      }

      const above = current[from - 1];
      if (above) {
        const element = rowRefs.current.get(above.key);
        if (element?.isConnected) {
          const rect = element.getBoundingClientRect();
          if (clientY < rect.top + rect.height / 2) {
            const next = reorderContentItems(current, fromKey, above.key);
            contentRef.current = next;
            captureRects();
            onContentChangeRef.current(next);
            return;
          }
        }
      }

      const below = current[from + 1];
      if (below) {
        const element = rowRefs.current.get(below.key);
        if (element?.isConnected) {
          const rect = element.getBoundingClientRect();
          if (clientY > rect.top + rect.height / 2) {
            const next = reorderContentItems(current, fromKey, below.key);
            contentRef.current = next;
            captureRects();
            onContentChangeRef.current(next);
          }
        }
      }
    }

    function handlePointerMove(event: PointerEvent) {
      const ghost = ghostRef.current;
      if (ghost) {
        ghost.style.left = `${event.clientX - drag.offsetX}px`;
        ghost.style.top = `${event.clientY - drag.offsetY}px`;
      }

      maybeReorderAdjacent(event.clientY, drag.key);
    }

    function endDrag() {
      document.body.style.removeProperty("user-select");
      document.body.style.removeProperty("cursor");
      for (const element of rowRefs.current.values()) {
        element.style.transition = "";
        element.style.transform = "";
      }
      setDrag(null);
    }

    document.body.style.userSelect = "none";
    document.body.style.cursor = "grabbing";
    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", endDrag);
    window.addEventListener("pointercancel", endDrag);
    return () => {
      document.body.style.removeProperty("user-select");
      document.body.style.removeProperty("cursor");
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", endDrag);
      window.removeEventListener("pointercancel", endDrag);
    };
  }, [drag]);

  function startDrag(key: string, event: ReactPointerEvent<HTMLButtonElement>) {
    const row = rowRefs.current.get(key);
    if (!row) {
      return;
    }
    event.preventDefault();
    const rect = row.getBoundingClientRect();
    const rects = new Map<string, DOMRect>();
    for (const [rowKey, element] of rowRefs.current) {
      if (element.isConnected) {
        rects.set(rowKey, element.getBoundingClientRect());
      }
    }
    prevRectsRef.current = rects;
    setDrag({
      key,
      width: rect.width,
      height: rect.height,
      offsetX: event.clientX - rect.left,
      offsetY: event.clientY - rect.top,
      left: rect.left,
      top: rect.top,
    });

    // Scale up on the frame after mount so the enlarge animates.
    requestAnimationFrame(() => {
      const ghost = ghostRef.current;
      if (!ghost) {
        return;
      }
      ghost.style.transform = `scale(${DRAG_SCALE})`;
    });
  }

  return (
    <div
      ref={listRef}
      className="relative space-y-1 rounded-md border border-slate-200 p-2 dark:border-slate-700"
    >
      {rows.map((row) => {
        const enabled = row.kind === "enabled";
        const option = row.option;
        const item = row.kind === "enabled" ? row.item : null;
        const isDragging = drag?.key === option.key;

        return (
          <div
            key={option.key}
            ref={(element) => {
              if (element) {
                rowRefs.current.set(option.key, element);
              } else {
                rowRefs.current.delete(option.key);
              }
            }}
            data-content-key={option.key}
            data-enabled={enabled ? "true" : "false"}
            className={cn(
              "relative flex items-center gap-2 rounded-md px-1.5 py-1.5 text-sm will-change-transform",
              enabled && !isDragging && "hover:bg-slate-50 dark:hover:bg-slate-800",
              !enabled && "opacity-60",
              isDragging &&
                "border border-dashed border-slate-300 bg-slate-100/80 dark:border-slate-600 dark:bg-slate-800/50",
            )}
            style={isDragging && drag ? { height: drag.height } : undefined}
          >
            {isDragging ? (
              <span className="sr-only">{option.label} (dragging)</span>
            ) : (
              <>
                {enabled ? (
                  <button
                    type="button"
                    className="shrink-0 cursor-grab touch-none rounded p-0.5 text-slate-400 hover:text-slate-600 active:cursor-grabbing dark:hover:text-slate-200"
                    aria-label={`Drag to reorder ${option.label}`}
                    onPointerDown={(event) => startDrag(option.key, event)}
                  >
                    <GripVertical className="h-4 w-4" aria-hidden />
                  </button>
                ) : (
                  <span className="inline-flex w-5 shrink-0" aria-hidden />
                )}
                <ContentRowBody
                  optionLabel={option.label}
                  item={item}
                  enabled={enabled}
                  showControls={enabled}
                  onAlign={
                    enabled
                      ? (align) => onContentChange(patchContentItem(content, option.key, { align }))
                      : undefined
                  }
                  onSize={
                    enabled
                      ? (size) => onContentChange(patchContentItem(content, option.key, { size }))
                      : undefined
                  }
                  onIncludeChange={(checked) => {
                    if (checked) {
                      onContentChange(enableContentItem(content, option.key));
                      return;
                    }
                    const next = disableContentItem(content, option.key);
                    if (!next) {
                      onInvalidDisable();
                      return;
                    }
                    onContentChange(next);
                  }}
                />
              </>
            )}
          </div>
        );
      })}

      {drag && draggedRow?.kind === "enabled"
        ? createPortal(
            <div
              ref={ghostRef}
              aria-hidden
              className="pointer-events-none fixed z-[200] flex items-center gap-2 rounded-md border border-sky-200 bg-white px-1.5 py-1.5 text-sm shadow-lg ring-1 ring-sky-100 dark:border-sky-800 dark:bg-slate-900 dark:ring-sky-900"
              style={{
                width: drag.width,
                height: drag.height,
                left: drag.left,
                top: drag.top,
                transform: "scale(1)",
                transformOrigin: "top left",
                transition: "transform 140ms cubic-bezier(0.2, 0.8, 0.2, 1)",
              }}
            >
              <span className="shrink-0 rounded p-0.5 text-slate-500">
                <GripVertical className="h-4 w-4" />
              </span>
              <ContentRowBody
                optionLabel={draggedRow.option.label}
                item={draggedRow.item}
                enabled
                showControls
              />
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
