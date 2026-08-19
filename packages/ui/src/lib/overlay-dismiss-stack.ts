export interface OverlayDismissLayer {
  dismiss: () => void;
  shouldDismissOnPointerDown: (target: Node) => boolean;
  /** When true, swallow the pointer event so lower layers (e.g. dialog backdrops) do not react. */
  blockPointerDismiss?: (target: Node) => boolean;
}

const GLOBAL_LAYERS_KEY = "__certtraceOverlayDismissLayers";

function getLayers(): OverlayDismissLayer[] {
  const globalStore = globalThis as typeof globalThis & {
    [GLOBAL_LAYERS_KEY]?: OverlayDismissLayer[];
  };
  if (!globalStore[GLOBAL_LAYERS_KEY]) {
    globalStore[GLOBAL_LAYERS_KEY] = [];
  }
  return globalStore[GLOBAL_LAYERS_KEY];
}

let listenersAttached = false;

function onDocumentPointerDown(event: MouseEvent) {
  const layers = getLayers();
  const top = layers.at(-1);
  if (!top) {
    return;
  }

  const target = event.target as Node;
  if (!top.shouldDismissOnPointerDown(target)) {
    return;
  }

  top.dismiss();

  if (top.blockPointerDismiss?.(target)) {
    event.preventDefault();
    event.stopPropagation();
  }
}

function onDocumentKeyDown(event: KeyboardEvent) {
  if (event.key !== "Escape") {
    return;
  }

  const layers = getLayers();
  const top = layers.at(-1);
  if (!top) {
    return;
  }

  event.preventDefault();
  event.stopPropagation();
  top.dismiss();
}

function ensureListeners() {
  if (listenersAttached) {
    return;
  }
  listenersAttached = true;
  document.addEventListener("mousedown", onDocumentPointerDown, true);
  document.addEventListener("keydown", onDocumentKeyDown, true);
}

export function registerOverlayDismissLayer(layer: OverlayDismissLayer): () => void {
  ensureListeners();
  const layers = getLayers();
  layers.push(layer);
  return () => {
    const index = layers.indexOf(layer);
    if (index >= 0) {
      layers.splice(index, 1);
    }
  };
}

export function hasOverlayDismissLayers(): boolean {
  return getLayers().length > 0;
}

/** @internal Test helper */
export function clearOverlayDismissLayersForTests(): void {
  getLayers().length = 0;
}
