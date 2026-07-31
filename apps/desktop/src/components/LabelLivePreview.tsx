import {
  computeLabelPageLayout,
  LABEL_VALUE_LINE_GAP_PT,
  renderBarcodePreviewDataUrl,
  renderQrDataUrl,
  resolveLabelLayout,
} from "@certtrace/core";
import {
  type FieldSchemaV1,
  type LabelTemplate,
  labelTemplateSizeInches,
  type MaterialMetadataV1,
} from "@certtrace/types";
import { cn } from "@certtrace/ui";
import { useEffect, useRef, useState } from "react";
import { formatDimensionInput } from "../lib/label-dimensions";

interface LabelLivePreviewProps {
  template: LabelTemplate;
  material: MaterialMetadataV1;
  fieldSchema: FieldSchemaV1;
  className?: string;
  showOverflowWarning?: boolean;
}

function LabelQrPreview({ payload, sizePt }: { payload: string; sizePt: number }) {
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setSrc(null);
    void renderQrDataUrl(payload, Math.max(64, Math.round(sizePt * 4)))
      .then((dataUrl) => {
        if (!cancelled) {
          setSrc(dataUrl);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setSrc(null);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [payload, sizePt]);

  return (
    <img
      src={src ?? undefined}
      alt={`QR code for ${payload}`}
      className={cn("block h-full w-full object-contain", !src && "bg-slate-50")}
    />
  );
}

function LabelBarcodePreview({ payload }: { payload: string }) {
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setSrc(null);
    try {
      const dataUrl = renderBarcodePreviewDataUrl(payload);
      if (!cancelled) {
        setSrc(dataUrl);
      }
    } catch {
      if (!cancelled) {
        setSrc(null);
      }
    }
    return () => {
      cancelled = true;
    };
  }, [payload]);

  return (
    <img
      src={src ?? undefined}
      alt={`Barcode for ${payload}`}
      className={cn("block h-full w-full object-contain", !src && "bg-slate-50")}
    />
  );
}

export function LabelLivePreview({
  template,
  material,
  fieldSchema,
  className,
  showOverflowWarning = true,
}: LabelLivePreviewProps) {
  const frameRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const { widthIn, heightIn } = labelTemplateSizeInches(template.size);
  const { slots } = resolveLabelLayout(template, material, fieldSchema);
  const layout = computeLabelPageLayout(template, slots);
  const widthLabel = formatDimensionInput(widthIn, template.displayUnit);
  const heightLabel = formatDimensionInput(heightIn, template.displayUnit);

  useEffect(() => {
    const frame = frameRef.current;
    if (!frame) {
      return;
    }

    const updateScale = () => {
      const nextScale = frame.clientWidth / layout.widthPt;
      setScale(nextScale > 0 ? nextScale : 1);
    };

    updateScale();
    const observer = new ResizeObserver(updateScale);
    observer.observe(frame);
    return () => observer.disconnect();
  }, [layout.widthPt]);

  return (
    <div className="space-y-2">
      <p className="text-xs text-slate-500 dark:text-slate-400">
        {widthLabel} × {heightLabel} {template.displayUnit}
      </p>
      <div
        ref={frameRef}
        className={cn(
          "relative mx-auto w-full max-w-md overflow-hidden rounded-md border border-slate-300 bg-white text-slate-900 shadow-sm dark:border-slate-600",
          className,
        )}
        style={{ aspectRatio: `${widthIn} / ${heightIn}` }}
        data-testid="label-live-preview"
      >
        <div
          className="absolute top-0 left-0 origin-top-left font-sans"
          style={{
            width: layout.widthPt,
            height: layout.heightPt,
            transform: `scale(${scale})`,
            fontFamily: "Helvetica, Arial, sans-serif",
          }}
        >
          {layout.elements.map((element, index) => {
            if (element.kind === "field") {
              return (
                <div
                  key={`${element.line.key}-${index}`}
                  className="absolute"
                  style={{
                    left: element.leftPt,
                    top: element.topPt,
                    width: element.widthPt,
                    textAlign: element.align,
                  }}
                >
                  <div
                    className="text-[rgb(89,89,89)]"
                    style={{
                      fontSize: element.labelFontSizePt,
                      lineHeight: `${element.labelFontSizePt}px`,
                    }}
                  >
                    {element.line.label}
                  </div>
                  <div style={{ marginTop: LABEL_VALUE_LINE_GAP_PT }}>
                    {element.valueLines.map((line, lineIndex) => (
                      <div
                        key={`${element.line.key}-line-${lineIndex}`}
                        className={cn(element.valueBold ? "font-bold" : "font-normal")}
                        style={{
                          fontSize: element.valueFontSizePt,
                          lineHeight: `${element.valueFontSizePt + LABEL_VALUE_LINE_GAP_PT}px`,
                        }}
                      >
                        {line}
                      </div>
                    ))}
                  </div>
                </div>
              );
            }

            if (element.kind === "qr") {
              return (
                <div
                  key={`qr-${index}`}
                  className="absolute"
                  style={{
                    left: element.leftPt,
                    top: element.topPt,
                    width: element.sizePt,
                    height: element.sizePt,
                  }}
                >
                  <LabelQrPreview payload={element.payload} sizePt={element.sizePt} />
                </div>
              );
            }

            return (
              <div
                key={`barcode-${index}`}
                className="absolute"
                style={{
                  left: element.leftPt,
                  top: element.topPt,
                  width: element.widthPt,
                  height: element.heightPt,
                }}
              >
                <LabelBarcodePreview payload={element.payload} />
              </div>
            );
          })}
        </div>
      </div>
      {showOverflowWarning && layout.overflow ? (
        <p
          role="status"
          className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-100"
        >
          Label content may not fit the {template.name} label size.
        </p>
      ) : null}
    </div>
  );
}
