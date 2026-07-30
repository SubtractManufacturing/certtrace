import { resolveLabelLayout } from "@certtrace/core";
import {
  type FieldSchemaV1,
  type LabelTemplate,
  labelTemplateSizeInches,
  type MaterialMetadataV1,
} from "@certtrace/types";
import { cn } from "@certtrace/ui";
import { formatDimensionInput } from "../lib/label-dimensions";

interface LabelLivePreviewProps {
  template: LabelTemplate;
  material: MaterialMetadataV1;
  fieldSchema: FieldSchemaV1;
  className?: string;
}

export function LabelLivePreview({
  template,
  material,
  fieldSchema,
  className,
}: LabelLivePreviewProps) {
  const { widthIn, heightIn } = labelTemplateSizeInches(template.size);
  const { slots } = resolveLabelLayout(template, material, fieldSchema);
  const widthLabel = formatDimensionInput(widthIn, template.displayUnit);
  const heightLabel = formatDimensionInput(heightIn, template.displayUnit);

  return (
    <div className="space-y-2">
      <p className="text-xs text-slate-500 dark:text-slate-400">
        {widthLabel} × {heightLabel} {template.displayUnit}
      </p>
      <div
        className={cn(
          "mx-auto w-full max-w-xs overflow-hidden rounded-md border border-slate-300 bg-white p-3 text-slate-900 shadow-sm dark:border-slate-600",
          className,
        )}
        style={{ aspectRatio: `${widthIn} / ${heightIn}` }}
        data-testid="label-live-preview"
      >
        <div className="flex h-full flex-col gap-1.5 overflow-hidden text-xs">
          {slots.map((slot, index) => {
            if (slot.kind === "text") {
              return (
                <div key={`${slot.line.key}-${index}`} className="min-w-0">
                  <div className="text-[10px] uppercase tracking-wide text-slate-500">
                    {slot.line.label}
                  </div>
                  <div className="truncate font-medium">{slot.line.value}</div>
                </div>
              );
            }
            if (slot.kind === "qr") {
              return (
                <div
                  key={`qr-${index}`}
                  className="flex h-14 w-14 shrink-0 items-center justify-center border border-dashed border-slate-400 text-[10px] text-slate-500"
                  aria-label={`QR code for ${slot.payload}`}
                >
                  QR
                </div>
              );
            }
            return (
              <div
                key={`barcode-${index}`}
                className="flex h-8 w-full shrink-0 items-center justify-center border border-dashed border-slate-400 text-[10px] text-slate-500"
                aria-label={`Barcode for ${slot.payload}`}
              >
                Barcode
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
