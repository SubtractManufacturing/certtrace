import { cn, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@certtrace/ui";
import { ArrowDown, ArrowUp, ArrowUpDown, Paperclip } from "lucide-react";
import { useMemo, useState } from "react";
import type { IndexedMaterial } from "../hooks/useSearchIndex";
import { fieldDisplay, identifierDisplay } from "../lib/material-display";

export type MaterialSortKey =
  | "id"
  | "alloy"
  | "supplier"
  | "heat_number"
  | "storage_location"
  | "libraryName";

interface MaterialTableProps {
  materials: IndexedMaterial[];
  showLibraryColumn?: boolean;
  attachmentCounts: Map<string, number>;
  selectedMaterialId: string | null;
  onSelectMaterial: (material: IndexedMaterial) => void;
}

function sortValue(material: IndexedMaterial, key: MaterialSortKey): string {
  if (key === "id" || key === "libraryName") {
    return String(material[key] ?? "");
  }
  if (key === "heat_number") {
    return identifierDisplay(material, key);
  }
  return fieldDisplay(material, key);
}

export function MaterialTable({
  materials,
  showLibraryColumn = false,
  attachmentCounts,
  selectedMaterialId,
  onSelectMaterial,
}: MaterialTableProps) {
  const [sortKey, setSortKey] = useState<MaterialSortKey>("id");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");

  const sortedMaterials = useMemo(() => {
    const copy = [...materials];
    copy.sort((left, right) => {
      const leftValue = sortValue(left, sortKey).toLowerCase();
      const rightValue = sortValue(right, sortKey).toLowerCase();
      const comparison = leftValue.localeCompare(rightValue);
      return sortDirection === "asc" ? comparison : -comparison;
    });
    return copy;
  }, [materials, sortDirection, sortKey]);

  function toggleSort(key: MaterialSortKey) {
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
            <SortableHead
              label="ID"
              active={sortKey === "id"}
              direction={sortDirection}
              onClick={() => toggleSort("id")}
            />
            <SortableHead
              label="Alloy"
              active={sortKey === "alloy"}
              direction={sortDirection}
              onClick={() => toggleSort("alloy")}
            />
            <SortableHead
              label="Supplier"
              active={sortKey === "supplier"}
              direction={sortDirection}
              onClick={() => toggleSort("supplier")}
            />
            <SortableHead
              label="Heat Number"
              active={sortKey === "heat_number"}
              direction={sortDirection}
              onClick={() => toggleSort("heat_number")}
            />
            <SortableHead
              label="Location"
              active={sortKey === "storage_location"}
              direction={sortDirection}
              onClick={() => toggleSort("storage_location")}
            />
            {showLibraryColumn ? (
              <SortableHead
                label="Library"
                active={sortKey === "libraryName"}
                direction={sortDirection}
                onClick={() => toggleSort("libraryName")}
              />
            ) : null}
            <TableHead className="w-10" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {sortedMaterials.map((material) => {
            const attachmentKey = `${material.libraryPath}:${material.id}`;
            const attachmentCount = attachmentCounts.get(attachmentKey) ?? 0;
            return (
              <TableRow
                key={attachmentKey}
                className={cn(
                  "cursor-pointer",
                  selectedMaterialId === material.id && "bg-slate-50 dark:bg-slate-800/60",
                )}
                onClick={() => onSelectMaterial(material)}
              >
                <TableCell className="font-medium">{material.id}</TableCell>
                <TableCell>{fieldDisplay(material, "alloy") || "—"}</TableCell>
                <TableCell>{fieldDisplay(material, "supplier") || "—"}</TableCell>
                <TableCell>{identifierDisplay(material, "heat_number") || "—"}</TableCell>
                <TableCell>{fieldDisplay(material, "storage_location") || "—"}</TableCell>
                {showLibraryColumn ? <TableCell>{material.libraryName}</TableCell> : null}
                <TableCell>
                  {attachmentCount > 0 ? (
                    <span className="inline-flex items-center gap-1 text-slate-500">
                      <Paperclip className="h-3.5 w-3.5" />
                      {attachmentCount}
                    </span>
                  ) : null}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
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
