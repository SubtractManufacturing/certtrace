import { Button, cn } from "@certtrace/ui";
import { Plus } from "lucide-react";
import {
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { parseSizePattern } from "../lib/size-pattern-parts";
import { AnchoredMenu } from "./AnchoredMenu";

interface SizePatternValue {
  key: string;
  label: string;
}

interface SizePatternEditorProps {
  pattern: string;
  values: SizePatternValue[];
  onChange: (pattern: string) => void;
}

interface DragSession {
  chip: HTMLElement;
  pointerId: number;
  startX: number;
  startY: number;
  offsetX: number;
  offsetY: number;
  width: number;
  height: number;
  ghostX: number;
  ghostY: number;
  active: boolean;
}

const DRAG_THRESHOLD = 4;

const CHIP_BASE_CLASS =
  "inline-flex cursor-grab touch-none select-none items-center rounded-md border border-slate-200 bg-slate-100 px-2 py-0.5 mx-0.5 align-baseline text-xs font-medium leading-none text-slate-800 active:cursor-grabbing dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100";

const CHIP_SELECTED_CLASSES = [
  "ring-2",
  "ring-slate-500",
  "bg-slate-200",
  "dark:bg-slate-700",
  "dark:ring-slate-400",
];

function isChip(node: Node | null | undefined): node is HTMLElement {
  return node instanceof HTMLElement && typeof node.dataset.key === "string";
}

function serializeEditor(editor: HTMLElement): string {
  let out = "";
  for (const node of Array.from(editor.childNodes)) {
    if (node.nodeType === Node.TEXT_NODE) {
      out += node.textContent ?? "";
    } else if (isChip(node)) {
      out += `{${node.dataset.key}}`;
    }
  }
  return out;
}

function findNodeBeforeCaret(range: Range, editor: HTMLElement): Node | null {
  const container = range.startContainer;
  const offset = range.startOffset;
  if (container === editor) {
    return editor.childNodes[offset - 1] ?? null;
  }
  if (container.nodeType === Node.TEXT_NODE) {
    if (offset === 0) {
      return container.previousSibling;
    }
    return null;
  }
  return null;
}

function findNodeAfterCaret(range: Range, editor: HTMLElement): Node | null {
  const container = range.startContainer;
  const offset = range.startOffset;
  if (container === editor) {
    return editor.childNodes[offset] ?? null;
  }
  if (container.nodeType === Node.TEXT_NODE) {
    const textLen = container.textContent?.length ?? 0;
    if (offset === textLen) {
      return container.nextSibling;
    }
    return null;
  }
  return null;
}

export function SizePatternEditor({ pattern, values, onChange }: SizePatternEditorProps) {
  const knownKeySignature = values.map((value) => value.key).join("\0");
  const knownKeys = useMemo(() => {
    const keys = new Set<string>(["unit"]);
    for (const key of knownKeySignature.split("\0")) {
      if (key) {
        keys.add(key);
      }
    }
    return keys;
  }, [knownKeySignature]);

  const labelMap = useMemo(() => {
    const map = new Map<string, string>();
    map.set("unit", "Unit");
    for (const value of values) {
      map.set(value.key, value.label);
    }
    return map;
  }, [values]);

  const labelFor = useCallback((key: string) => labelMap.get(key) ?? key, [labelMap]);

  const editorRef = useRef<HTMLDivElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [selectedChip, setSelectedChip] = useState<HTMLElement | null>(null);
  const [drag, setDrag] = useState<DragSession | null>(null);
  const [dropIndicator, setDropIndicator] = useState<{
    left: number;
    top: number;
    height: number;
  } | null>(null);
  const dragRef = useRef<DragSession | null>(null);
  const savedRangeRef = useRef<Range | null>(null);
  const ghostRef = useRef<HTMLDivElement>(null);
  const addButtonRef = useRef<HTMLDivElement>(null);
  const labelId = useId();
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  dragRef.current = drag;

  const makeChipEl = useCallback(
    (key: string): HTMLElement => {
      const span = document.createElement("span");
      span.setAttribute("contenteditable", "false");
      span.setAttribute("draggable", "false");
      span.setAttribute("role", "button");
      span.dataset.key = key;
      const label = labelFor(key);
      span.setAttribute("aria-label", label);
      span.className = CHIP_BASE_CLASS;
      span.textContent = label;
      return span;
    },
    [labelFor],
  );

  const nodesFromPattern = useCallback(
    (source: string): Node[] => {
      const parts = parseSizePattern(source, knownKeys);
      return parts.map((part) =>
        part.kind === "token" ? makeChipEl(part.key) : document.createTextNode(part.value),
      );
    },
    [knownKeys, makeChipEl],
  );

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) {
      return;
    }
    if (serializeEditor(editor).trim() === pattern.trim()) {
      return;
    }
    editor.replaceChildren(...nodesFromPattern(pattern));
  }, [pattern, nodesFromPattern]);

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) {
      return;
    }
    for (const node of Array.from(editor.childNodes)) {
      if (!isChip(node)) {
        continue;
      }
      const key = node.dataset.key ?? "";
      const label = labelFor(key);
      if (node.textContent !== label) {
        node.textContent = label;
      }
      node.setAttribute("aria-label", label);
    }
  }, [labelFor]);

  const emit = useCallback(() => {
    const editor = editorRef.current;
    if (!editor) {
      return;
    }
    onChangeRef.current(serializeEditor(editor).trim());
  }, []);

  const clearChipSelection = useCallback(() => {
    setSelectedChip((current) => {
      if (current) {
        current.classList.remove(...CHIP_SELECTED_CLASSES);
      }
      return null;
    });
  }, []);

  const selectChip = useCallback((chip: HTMLElement) => {
    setSelectedChip((current) => {
      if (current && current !== chip) {
        current.classList.remove(...CHIP_SELECTED_CLASSES);
      }
      chip.classList.add(...CHIP_SELECTED_CLASSES);
      return chip;
    });
  }, []);

  const saveRange = useCallback(() => {
    const editor = editorRef.current;
    if (!editor) {
      return;
    }
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) {
      return;
    }
    const range = selection.getRangeAt(0);
    if (
      !editor.contains(range.commonAncestorContainer) &&
      range.commonAncestorContainer !== editor
    ) {
      return;
    }
    savedRangeRef.current = range.cloneRange();
  }, []);

  const restoreOrEndRange = useCallback((): Range | null => {
    const editor = editorRef.current;
    if (!editor) {
      return null;
    }
    let range = savedRangeRef.current;
    if (
      !range ||
      (!editor.contains(range.commonAncestorContainer) && range.commonAncestorContainer !== editor)
    ) {
      range = document.createRange();
      range.selectNodeContents(editor);
      range.collapse(false);
    }
    const selection = window.getSelection();
    if (selection) {
      selection.removeAllRanges();
      selection.addRange(range);
    }
    return range;
  }, []);

  function insertChipAtCaret(key: string) {
    const editor = editorRef.current;
    if (!editor) {
      return;
    }
    editor.focus();
    const range = restoreOrEndRange();
    if (!range) {
      return;
    }
    range.deleteContents();
    const chip = makeChipEl(key);
    range.insertNode(chip);
    range.setStartAfter(chip);
    range.collapse(true);
    const selection = window.getSelection();
    if (selection) {
      selection.removeAllRanges();
      selection.addRange(range);
    }
    savedRangeRef.current = range.cloneRange();
    clearChipSelection();
    emit();
  }

  function removeChip(chip: HTMLElement, caretSide: "before" | "after") {
    const editor = editorRef.current;
    if (!editor) {
      return;
    }
    const range = document.createRange();
    if (caretSide === "before") {
      range.setStartBefore(chip);
    } else {
      range.setStartAfter(chip);
    }
    range.collapse(true);
    chip.remove();
    const selection = window.getSelection();
    if (selection) {
      selection.removeAllRanges();
      selection.addRange(range);
    }
    savedRangeRef.current = range.cloneRange();
    editor.focus();
    emit();
  }

  function handleKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
    if (event.key === "Enter") {
      event.preventDefault();
      return;
    }
    if (event.key === "Escape" && selectedChip) {
      event.preventDefault();
      clearChipSelection();
      return;
    }

    if (event.key === "Backspace") {
      if (selectedChip) {
        event.preventDefault();
        const chip = selectedChip;
        clearChipSelection();
        removeChip(chip, "before");
        return;
      }
      const selection = window.getSelection();
      if (!selection || selection.rangeCount === 0 || !selection.isCollapsed) {
        return;
      }
      const editor = editorRef.current;
      if (!editor) {
        return;
      }
      const range = selection.getRangeAt(0);
      if (!editor.contains(range.startContainer) && range.startContainer !== editor) {
        return;
      }
      const previous = findNodeBeforeCaret(range, editor);
      if (isChip(previous)) {
        event.preventDefault();
        selectChip(previous);
      }
      return;
    }

    if (event.key === "Delete") {
      if (selectedChip) {
        event.preventDefault();
        const chip = selectedChip;
        clearChipSelection();
        removeChip(chip, "after");
        return;
      }
      const selection = window.getSelection();
      if (!selection || selection.rangeCount === 0 || !selection.isCollapsed) {
        return;
      }
      const editor = editorRef.current;
      if (!editor) {
        return;
      }
      const range = selection.getRangeAt(0);
      if (!editor.contains(range.startContainer) && range.startContainer !== editor) {
        return;
      }
      const next = findNodeAfterCaret(range, editor);
      if (isChip(next)) {
        event.preventDefault();
        selectChip(next);
      }
      return;
    }

    if (event.key.length === 1 || event.key === "ArrowLeft" || event.key === "ArrowRight") {
      if (selectedChip) {
        clearChipSelection();
      }
    }
  }

  function handleInput() {
    const editor = editorRef.current;
    if (!editor) {
      return;
    }
    for (const node of Array.from(editor.childNodes)) {
      if (node instanceof HTMLElement && node.tagName === "BR") {
        node.remove();
      }
    }
    emit();
  }

  function caretRangeAtPoint(x: number, y: number): Range | null {
    if (typeof document.caretRangeFromPoint === "function") {
      return document.caretRangeFromPoint(x, y);
    }
    const legacy = document as unknown as {
      caretPositionFromPoint?: (
        x: number,
        y: number,
      ) => { offsetNode: Node; offset: number } | null;
    };
    if (typeof legacy.caretPositionFromPoint === "function") {
      const pos = legacy.caretPositionFromPoint(x, y);
      if (pos) {
        const range = document.createRange();
        range.setStart(pos.offsetNode, pos.offset);
        range.collapse(true);
        return range;
      }
    }
    return null;
  }

  function neighborChipGeometry(
    editor: HTMLElement,
    draggingChip: HTMLElement,
  ): { top: number; height: number } | null {
    for (const node of Array.from(editor.childNodes)) {
      if (node instanceof HTMLElement && node !== draggingChip && node.dataset.key != null) {
        const rect = node.getBoundingClientRect();
        if (rect.height > 0) {
          return { top: rect.top, height: rect.height };
        }
      }
    }
    return null;
  }

  function computeDropIndicator(
    x: number,
    y: number,
    draggingChip: HTMLElement,
  ): { left: number; top: number; height: number } | null {
    const editor = editorRef.current;
    if (!editor) {
      return null;
    }
    const editorRect = editor.getBoundingClientRect();
    const neighbor = neighborChipGeometry(editor, draggingChip);
    const anchorTop = neighbor?.top ?? editorRect.top + 4;
    const anchorHeight = neighbor?.height ?? Math.max(16, editorRect.height - 8);

    const range = caretRangeAtPoint(x, y);
    if (range && (editor.contains(range.startContainer) || range.startContainer === editor)) {
      let rangeRect: DOMRect | null = null;
      try {
        if (typeof range.getBoundingClientRect === "function") {
          rangeRect = range.getBoundingClientRect();
        }
      } catch {
        rangeRect = null;
      }
      if (rangeRect && rangeRect.height > 0) {
        return { left: rangeRect.left, top: rangeRect.top, height: rangeRect.height };
      }
      const container = range.startContainer;
      const offset = range.startOffset;
      const before =
        container === editor
          ? (editor.childNodes[offset - 1] ?? null)
          : container.nodeType === Node.TEXT_NODE && offset === 0
            ? container.previousSibling
            : null;
      const after =
        container === editor
          ? (editor.childNodes[offset] ?? null)
          : container.nodeType === Node.TEXT_NODE && offset === (container.textContent?.length ?? 0)
            ? container.nextSibling
            : null;
      if (after instanceof HTMLElement && after !== draggingChip) {
        const rect = after.getBoundingClientRect();
        return { left: rect.left, top: rect.top, height: rect.height };
      }
      if (before instanceof HTMLElement && before !== draggingChip) {
        const rect = before.getBoundingClientRect();
        return { left: rect.right, top: rect.top, height: rect.height };
      }
      return { left: x, top: anchorTop, height: anchorHeight };
    }

    let bestLeft = editorRect.right - 4;
    let bestTop = anchorTop;
    let bestHeight = anchorHeight;
    let bestDist = Number.POSITIVE_INFINITY;
    for (const node of Array.from(editor.childNodes)) {
      if (!(node instanceof HTMLElement) || node === draggingChip) {
        continue;
      }
      const rect = node.getBoundingClientRect();
      const midX = rect.left + rect.width / 2;
      const midY = rect.top + rect.height / 2;
      const dist = Math.hypot(x - midX, y - midY);
      if (dist < bestDist) {
        bestDist = dist;
        bestLeft = x < midX ? rect.left : rect.right;
        bestTop = rect.top;
        bestHeight = rect.height;
      }
    }
    return { left: bestLeft, top: bestTop, height: bestHeight };
  }

  function findDropTarget(
    x: number,
    y: number,
    draggingChip: HTMLElement,
  ): {
    parent: HTMLElement;
    before: Node | null;
  } | null {
    const editor = editorRef.current;
    if (!editor) {
      return null;
    }
    const range = caretRangeAtPoint(x, y);
    if (range && (editor.contains(range.startContainer) || range.startContainer === editor)) {
      const container = range.startContainer;
      const offset = range.startOffset;
      if (container === editor) {
        return { parent: editor, before: editor.childNodes[offset] ?? null };
      }
      if (container.nodeType === Node.TEXT_NODE) {
        const textNode = container as Text;
        const length = textNode.textContent?.length ?? 0;
        if (offset === 0) {
          return { parent: editor, before: textNode };
        }
        if (offset >= length) {
          return { parent: editor, before: textNode.nextSibling };
        }
        const rest = textNode.splitText(offset);
        return { parent: editor, before: rest };
      }
    }
    let bestBefore: Node | null = null;
    let bestDist = Number.POSITIVE_INFINITY;
    for (const node of Array.from(editor.childNodes)) {
      if (!(node instanceof HTMLElement) || node === draggingChip) {
        continue;
      }
      const rect = node.getBoundingClientRect();
      const midX = rect.left + rect.width / 2;
      const midY = rect.top + rect.height / 2;
      const dist = Math.hypot(x - midX, y - midY);
      if (dist < bestDist) {
        bestDist = dist;
        bestBefore = x < midX ? node : node.nextSibling;
      }
    }
    return { parent: editor, before: bestBefore };
  }

  function startDrag(chip: HTMLElement, event: ReactPointerEvent<HTMLDivElement>) {
    if (event.button !== 0) {
      return;
    }
    event.preventDefault();
    clearChipSelection();
    const rect = chip.getBoundingClientRect();
    const session: DragSession = {
      chip,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      offsetX: event.clientX - rect.left,
      offsetY: event.clientY - rect.top,
      width: rect.width,
      height: rect.height,
      ghostX: rect.left,
      ghostY: rect.top,
      active: false,
    };
    setMenuOpen(false);
    setDrag(session);
  }

  // biome-ignore lint/correctness/useExhaustiveDependencies: listeners intentionally bind once per chip; mutable drag state is read from dragRef.
  useEffect(() => {
    if (!drag) {
      return;
    }

    function handlePointerMove(event: PointerEvent) {
      const session = dragRef.current;
      if (!session || event.pointerId !== session.pointerId) {
        return;
      }
      const distance = Math.hypot(event.clientX - session.startX, event.clientY - session.startY);
      if (!session.active && distance >= DRAG_THRESHOLD) {
        session.active = true;
        session.chip.style.opacity = "0.4";
      }
      if (!session.active) {
        return;
      }
      session.ghostX = event.clientX - session.offsetX;
      session.ghostY = event.clientY - session.offsetY;
      const ghost = ghostRef.current;
      if (ghost) {
        ghost.style.left = `${session.ghostX}px`;
        ghost.style.top = `${session.ghostY}px`;
      } else {
        setDrag({ ...session });
      }
      setDropIndicator(computeDropIndicator(event.clientX, event.clientY, session.chip));
    }

    function endDrag(event: PointerEvent) {
      const session = dragRef.current;
      if (!session || event.pointerId !== session.pointerId) {
        return;
      }
      document.body.style.removeProperty("user-select");
      document.body.style.removeProperty("cursor");
      session.chip.style.opacity = "";
      if (session.active) {
        const target = findDropTarget(event.clientX, event.clientY, session.chip);
        if (target && target.before !== session.chip) {
          session.chip.remove();
          if (target.before && target.before.parentNode === target.parent) {
            target.parent.insertBefore(session.chip, target.before);
          } else {
            target.parent.appendChild(session.chip);
          }
          const range = document.createRange();
          range.setStartAfter(session.chip);
          range.collapse(true);
          const selection = window.getSelection();
          if (selection) {
            selection.removeAllRanges();
            selection.addRange(range);
          }
          savedRangeRef.current = range.cloneRange();
          emit();
        }
      }
      dragRef.current = null;
      setDrag(null);
      setDropIndicator(null);
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
  }, [drag?.chip]);

  function handlePointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    const target = event.target;
    if (!(target instanceof HTMLElement)) {
      return;
    }
    const chip = target.closest("[data-key]");
    if (chip instanceof HTMLElement && editorRef.current?.contains(chip)) {
      startDrag(chip, event);
    }
  }

  function handleEditorClick(event: ReactMouseEvent<HTMLDivElement>) {
    const target = event.target;
    if (target instanceof HTMLElement && !target.closest("[data-key]") && selectedChip) {
      clearChipSelection();
    }
  }

  const addable = [...values, { key: "unit", label: "Unit" }];

  return (
    <div className="space-y-1.5">
      <p id={labelId} className="text-sm font-medium">
        Size pattern
      </p>
      <p className="text-xs text-slate-500 dark:text-slate-400">
        This is what appears on labels and in the list. Add values, type text between them, and drag
        boxes to reorder.
      </p>
      <div
        className={cn(
          "flex min-h-9 items-center rounded-md border border-slate-200 bg-white px-2 py-1.5 dark:border-slate-700 dark:bg-slate-950",
          drag?.active && "cursor-grabbing",
        )}
        role="group"
        aria-labelledby={labelId}
      >
        <div
          ref={editorRef}
          contentEditable
          suppressContentEditableWarning
          role="textbox"
          aria-multiline="false"
          aria-labelledby={labelId}
          className="min-w-0 flex-1 whitespace-pre-wrap wrap-break-word text-sm leading-6 text-slate-800 outline-none dark:text-slate-100"
          onInput={handleInput}
          onKeyDown={handleKeyDown}
          onKeyUp={saveRange}
          onMouseUp={saveRange}
          onBlur={saveRange}
          onPointerDown={handlePointerDown}
          onClick={handleEditorClick}
        />
        <div className="relative ml-1 shrink-0" ref={addButtonRef}>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            aria-label="Add value to Size pattern"
            aria-expanded={menuOpen}
            onMouseDown={(event) => {
              event.preventDefault();
              saveRange();
            }}
            onClick={() => setMenuOpen((open) => !open)}
          >
            <Plus className="h-4 w-4" />
          </Button>
          <AnchoredMenu
            open={menuOpen}
            anchorRef={addButtonRef}
            align="end"
            role="menu"
            onClose={() => setMenuOpen(false)}
          >
            {addable.map((value) => (
              <button
                key={value.key}
                type="button"
                role="menuitem"
                className="flex w-full px-3 py-1.5 text-left text-sm hover:bg-slate-100 dark:hover:bg-slate-800"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => {
                  insertChipAtCaret(value.key);
                  setMenuOpen(false);
                }}
              >
                {value.label}
              </button>
            ))}
          </AnchoredMenu>
        </div>
      </div>
      {drag?.active
        ? createPortal(
            <div
              ref={ghostRef}
              className="pointer-events-none fixed z-70 inline-flex items-center rounded-md border border-slate-200 bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-800 shadow-lg dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
              style={{
                left: drag.ghostX,
                top: drag.ghostY,
                width: drag.width,
                height: drag.height,
              }}
            >
              {labelFor(drag.chip.dataset.key ?? "")}
            </div>,
            document.body,
          )
        : null}
      {drag?.active && dropIndicator
        ? createPortal(
            <div
              aria-hidden
              data-testid="size-pattern-drop-indicator"
              className="pointer-events-none fixed z-70 rounded-full bg-sky-500 shadow-[0_0_0_1px_rgba(14,165,233,0.35)] dark:bg-sky-400"
              style={{
                left: dropIndicator.left - 1,
                top: dropIndicator.top,
                width: 2,
                height: dropIndicator.height,
              }}
            />,
            document.body,
          )
        : null}
    </div>
  );
}
