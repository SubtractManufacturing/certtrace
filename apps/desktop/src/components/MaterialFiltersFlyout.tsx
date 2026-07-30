import type { MaterialFilterValues } from "@certtrace/library-engine";
import type { FieldSchemaV1, MaterialMetadataV1 } from "@certtrace/types";
import {
  Button,
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@certtrace/ui";
import { X } from "lucide-react";
import { MaterialFiltersPanel } from "./MaterialFiltersPanel";

interface MaterialFiltersFlyoutProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  schema: FieldSchemaV1;
  materials: MaterialMetadataV1[];
  values: MaterialFilterValues;
  onChange: (values: MaterialFilterValues) => void;
  onApply: () => void;
}

export function MaterialFiltersFlyout({
  open,
  onOpenChange,
  schema,
  materials,
  values,
  onChange,
  onApply,
}: MaterialFiltersFlyoutProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="max-w-sm! flex flex-col">
        <SheetHeader>
          <SheetTitle>Filters</SheetTitle>
          <SheetDescription>Narrow the materials table by field values.</SheetDescription>
        </SheetHeader>
        <div className="mt-6 min-h-0 flex-1 overflow-y-auto">
          <MaterialFiltersPanel
            schema={schema}
            materials={materials}
            values={values}
            onChange={onChange}
          />
        </div>
        <SheetFooter className="mt-6 shrink-0">
          <Button type="button" className="w-full" onClick={onApply}>
            Apply filters
          </Button>
        </SheetFooter>
        <SheetClose aria-label="Close filters">
          <X className="h-4 w-4" />
        </SheetClose>
      </SheetContent>
    </Sheet>
  );
}
