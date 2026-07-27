import type { FieldSchemaV1 } from "@certtrace/types";
import { describe, expect, it } from "vitest";
import { defaultMaterialColumns } from "./material-columns";

describe("defaultMaterialColumns", () => {
  it("returns the shipped default column set when those keys exist in the schema", () => {
    const schema: FieldSchemaV1 = {
      version: 1,
      fields: [
        {
          key: "family",
          label: "Material",
          type: "single_select",
          required: false,
          filterable: true,
          options: [{ id: "aluminum", label: "Aluminum" }],
        },
        {
          key: "alloy",
          label: "Alloy",
          type: "single_select",
          required: false,
          filterable: true,
          options: [{ id: "6061", label: "6061" }],
        },
        {
          key: "temper",
          label: "Temper",
          type: "single_select",
          required: false,
          filterable: true,
          options: [{ id: "t6", label: "T6" }],
        },
        {
          key: "supplier",
          label: "Supplier",
          type: "single_select",
          required: false,
          filterable: true,
          options: [{ id: "mcmaster", label: "McMaster" }],
        },
        {
          key: "storage_location",
          label: "Storage Location",
          type: "text",
          required: false,
          filterable: true,
        },
        {
          key: "notes",
          label: "Notes",
          type: "long_text",
          required: false,
          filterable: false,
        },
      ],
      identifierKinds: [
        { key: "heat_number", label: "Heat Number", required: false, filterable: true },
      ],
      attachmentKinds: [],
    };

    expect(defaultMaterialColumns(schema)).toEqual([
      { kind: "id", key: "id", label: "ID" },
      { kind: "field", key: "family", label: "Material" },
      { kind: "field", key: "alloy", label: "Alloy" },
      { kind: "field", key: "temper", label: "Temper" },
      { kind: "field", key: "supplier", label: "Supplier" },
      { kind: "field", key: "storage_location", label: "Storage Location" },
      { kind: "attachments", key: "attachments", label: "Attachments" },
      { kind: "identifiers", key: "identifiers", label: "Identifiers" },
    ]);
  });

  it("omits default field columns whose keys are missing from the schema", () => {
    const schema: FieldSchemaV1 = {
      version: 1,
      fields: [
        {
          key: "family",
          label: "Material",
          type: "single_select",
          required: false,
          filterable: true,
          options: [{ id: "aluminum", label: "Aluminum" }],
        },
        {
          key: "storage_location",
          label: "Bin",
          type: "text",
          required: false,
          filterable: true,
        },
      ],
      identifierKinds: [],
      attachmentKinds: [],
    };

    expect(defaultMaterialColumns(schema)).toEqual([
      { kind: "id", key: "id", label: "ID" },
      { kind: "field", key: "family", label: "Material" },
      { kind: "field", key: "storage_location", label: "Bin" },
      { kind: "attachments", key: "attachments", label: "Attachments" },
    ]);
  });
});
