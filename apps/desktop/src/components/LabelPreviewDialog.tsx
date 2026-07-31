import type { OpenLibraryResult } from "@certtrace/library-engine";
import type { LabelTemplate, MaterialMetadataV1 } from "@certtrace/types";
import {
  Button,
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Label,
  Select,
} from "@certtrace/ui";
import { Printer, X } from "lucide-react";
import { useEffect, useState } from "react";
import { generateLibraryLabelPdf, printLabelPdf, saveLabelPdfViaDialog } from "../lib/label-client";
import { ErrorBanner } from "./ErrorBanner";
import { LabelLivePreview } from "./LabelLivePreview";

interface LabelPreviewDialogProps {
  library: OpenLibraryResult;
  material: MaterialMetadataV1;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEditTemplates: () => void;
}

function resolveSelectedTemplate(
  templates: LabelTemplate[],
  selectedTemplateId: string,
  defaultLabelTemplateId: string,
): LabelTemplate | undefined {
  return (
    templates.find((template) => template.id === selectedTemplateId) ??
    templates.find((template) => template.id === defaultLabelTemplateId) ??
    templates[0]
  );
}

export function LabelPreviewDialog({
  library,
  material,
  open,
  onOpenChange,
  onEditTemplates,
}: LabelPreviewDialogProps) {
  const templates = library.config.labelTemplates;
  const [selectedTemplateId, setSelectedTemplateId] = useState(
    library.config.defaultLabelTemplateId,
  );
  const [pdfBytes, setPdfBytes] = useState<Uint8Array | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const selectedTemplate = resolveSelectedTemplate(
    templates,
    selectedTemplateId,
    library.config.defaultLabelTemplateId,
  );

  useEffect(() => {
    if (!open) {
      return;
    }
    setSelectedTemplateId(library.config.defaultLabelTemplateId);
    setError(null);
  }, [open, library.config.defaultLabelTemplateId]);

  useEffect(() => {
    if (!open || !selectedTemplate) {
      return;
    }

    const template = selectedTemplate;
    let cancelled = false;
    setBusy(true);
    setError(null);

    void generateLibraryLabelPdf(library, [material], template)
      .then((result) => {
        if (!cancelled) {
          setPdfBytes(result.pdf);
          setWarnings(result.warnings);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setPdfBytes(null);
          setWarnings([]);
          setError(err instanceof Error ? err.message : String(err));
        }
      })
      .finally(() => {
        if (!cancelled) {
          setBusy(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [open, library, material, selectedTemplate]);

  async function handlePrint() {
    if (!pdfBytes) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await printLabelPdf(pdfBytes, material.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  async function handleSavePdf() {
    if (!selectedTemplate) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await saveLabelPdfViaDialog(library, material, selectedTemplate);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Label preview</DialogTitle>
          <DialogDescription>
            Preview and print or save a Label for {material.id}.
          </DialogDescription>
        </DialogHeader>
        <DialogClose aria-label="Close">
          <X className="h-4 w-4" />
        </DialogClose>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="label-preview-template">Label Template</Label>
            <Select
              id="label-preview-template"
              aria-label="Label Template"
              value={selectedTemplate?.id ?? ""}
              onChange={(event) => setSelectedTemplateId(event.target.value)}
            >
              {templates.map((template) => (
                <option key={template.id} value={template.id}>
                  {template.name}
                </option>
              ))}
            </Select>
          </div>

          {selectedTemplate ? (
            <LabelLivePreview
              template={selectedTemplate}
              material={material}
              fieldSchema={library.fieldSchema}
              className="mx-auto w-full max-w-sm"
              showOverflowWarning={false}
            />
          ) : null}

          {warnings.length > 0 ? (
            <div
              role="status"
              className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-100"
            >
              {warnings.map((warning) => (
                <p key={warning}>{warning}</p>
              ))}
            </div>
          ) : null}

          {error ? <ErrorBanner message={error} /> : null}
        </div>

        <DialogFooter className="flex flex-wrap items-center justify-between gap-2 sm:justify-between">
          <Button type="button" variant="ghost" disabled={busy} onClick={onEditTemplates}>
            Edit templates…
          </Button>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={() => void handleSavePdf()}
            >
              Save PDF
            </Button>
            <Button type="button" disabled={busy || !pdfBytes} onClick={() => void handlePrint()}>
              <Printer className="mr-2 h-4 w-4" />
              Print
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
