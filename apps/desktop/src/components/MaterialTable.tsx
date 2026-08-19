import { compareSizeSortKeys, materialSizeSortKey } from "@certtrace/library-engine";
import type { FieldSchemaV1 } from "@certtrace/types";
import { formatMaterialSize } from "@certtrace/types";
import {
  Badge,
  cn,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@certtrace/ui";
import { ArrowDown, ArrowUp, ArrowUpDown, Paperclip } from "lucide-react";
import { useMemo, useState } from "react";
import type { IndexedMaterial } from "../hooks/useSearchIndex";
import {
  type MaterialColumn,
  materialColumns,
  resolvedMaterialColumnIdentity,
} from "../lib/material-columns";
import { formatFieldValue, formatIdentifiersCue } from "../lib/material-display";

interface MaterialTableProps {
  materials: IndexedMaterial[];
  schema: FieldSchemaV1;
  /** Prefer per-library schema for cell formatting when viewing All libraries. */
  resolveSchema?: (libraryPath: string) => FieldSchemaV1;
  showLibraryColumn?: boolean;
  attachmentCounts: Map<string, number>;
  selectedMaterialId: string | null;
  onSelectMaterial: (material: IndexedMaterial) => void;
}

export function MaterialTable({
  materials,
  schema,
  resolveSchema,
  showLibraryColumn = false,
  attachmentCounts,
  selectedMaterialId,
  onSelectMaterial,
}: MaterialTableProps) {
  const columns = useMemo(() => {
    const base = materialColumns(schema);
    if (!showLibraryColumn) {
      return base;
    }
    const identifiersIndex = base.findIndex((column) => column.kind === "identifiers");
    const libraryColumn: MaterialColumn = {
      kind: "library",
      key: "libraryName",
      label: "Library",
    };
    if (identifiersIndex === -1) {
      return [...base, libraryColumn];
    }
    return [...base.slice(0, identifiersIndex), libraryColumn, ...base.slice(identifiersIndex)];
  }, [schema, showLibraryColumn]);

  const [sortKey, setSortKey] = useState<string>("id");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");

  const sortedMaterials = useMemo(() => {
    const copy = [...materials];
    const sizeSort = sortKey === "size";
    copy.sort((left, right) => {
      if (sizeSort) {
        const schemaForLeft = (resolveSchema ?? (() => schema))(left.libraryPath);
        const schemaForRight = (resolveSchema ?? (() => schema))(right.libraryPath);
        const comparison = compareSizeSortKeys(
          materialSizeSortKey(schemaForLeft, left),
          materialSizeSortKey(schemaForRight, right),
          sortDirection,
        );
        return comparison;
      }
      const leftValue = cellSortValue(left, sortKey, columns, resolveSchema ?? (() => schema));
      const rightValue = cellSortValue(right, sortKey, columns, resolveSchema ?? (() => schema));
      const comparison = leftValue.localeCompare(rightValue);
      return sortDirection === "asc" ? comparison : -comparison;
    });
    return copy;
  }, [columns, materials, resolveSchema, schema, sortDirection, sortKey]);

  function toggleSort(key: string) {
    if (sortKey === key) {
      setSortDirection((current) => (current === "asc" ? "desc" : "asc"));
      return;
    }
    setSortKey(key);
    setSortDirection("asc");
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
      <Table>
        <TableHeader>
          <TableRow>
            {columns.map((column) =>
              column.kind === "attachments" ? (
                <TableHead key={resolvedMaterialColumnIdentity(column)} className="w-10" />
              ) : (
                <SortableHead
                  key={resolvedMaterialColumnIdentity(column)}
                  label={column.label}
                  active={sortKey === resolvedMaterialColumnIdentity(column)}
                  direction={sortDirection}
                  onClick={() => toggleSort(resolvedMaterialColumnIdentity(column))}
                />
              ),
            )}
          </TableRow>
        </TableHeader>
        <TableBody>
          {sortedMaterials.map((material) => {
            const attachmentKey = `${material.libraryPath}:${material.id}`;
            const attachmentCount = attachmentCounts.get(attachmentKey) ?? 0;
            const materialSchema = (resolveSchema ?? (() => schema))(material.libraryPath);
            return (
              <TableRow
                key={attachmentKey}
                className={cn(
                  "cursor-pointer",
                  material.archived && "text-slate-500 dark:text-slate-400",
                  selectedMaterialId === material.id && "bg-slate-50 dark:bg-slate-800/60",
                )}
                onClick={() => onSelectMaterial(material)}
              >
                {columns.map((column) => (
                  <TableCell
                    key={resolvedMaterialColumnIdentity(column)}
                    className={column.kind === "id" ? "font-medium" : undefined}
                  >
                    {renderCell(column, material, materialSchema, attachmentCount)}
                  </TableCell>
                ))}
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

function renderCell(
  column: MaterialColumn,
  material: IndexedMaterial,
  schema: FieldSchemaV1,
  attachmentCount: number,
) {
  switch (column.kind) {
    case "id":
      return (
        <span className="inline-flex items-center gap-2">
          <span>{material.id}</span>
          {material.archived ? <Badge variant="secondary">Archived</Badge> : null}
        </span>
      );
    case "library":
      return material.libraryName;
    case "field": {
      const display = formatFieldValue(schema, column.key, material.fields[column.key]);
      return display || "—";
    }
    case "identifier":
      return material.identifiers[column.key] || "—";
    case "identifiers": {
      const cue = formatIdentifiersCue(schema, material.identifiers);
      return cue || "—";
    }
    case "size": {
      const display = formatMaterialSize(schema, material);
      return display || "—";
    }
    case "attachments":
      return attachmentCount > 0 ? (
        <span className="inline-flex items-center gap-1 text-slate-500">
          <Paperclip className="h-3.5 w-3.5" />
          {attachmentCount}
        </span>
      ) : null;
  }
}

function cellSortValue(
  material: IndexedMaterial,
  key: string,
  columns: MaterialColumn[],
  resolveSchema: (libraryPath: string) => FieldSchemaV1,
): string {
  if (key === "id") {
    return material.id;
  }
  if (key === "library") {
    return material.libraryName;
  }
  const column = columns.find((entry) => resolvedMaterialColumnIdentity(entry) === key);
  if (!column) {
    return "";
  }
  const schema = resolveSchema(material.libraryPath);
  if (column.kind === "field") {
    return formatFieldValue(schema, column.key, material.fields[column.key]);
  }
  if (column.kind === "identifier") {
    return material.identifiers[column.key] ?? "";
  }
  if (column.kind === "size") {
    return formatMaterialSize(schema, material);
  }
  if (column.kind === "identifiers") {
    return formatIdentifiersCue(schema, material.identifiers);
  }
  return "";
}

function SortableHead({
  label,
  active,
  direction,
  onClick,
}: {
  label: string;
  active: boolean;
  direction: "asc" | "desc";
  onClick: () => void;
}) {
  const Icon = active ? (direction === "asc" ? ArrowUp : ArrowDown) : ArrowUpDown;
  return (
    <TableHead>
      <button
        type="button"
        className="inline-flex items-center gap-1 font-medium hover:text-slate-900 dark:hover:text-slate-100"
        onClick={onClick}
      >
        {label}
        <Icon className="h-3.5 w-3.5 text-slate-400" />
      </button>
    </TableHead>
  );
}
