import type { FieldSchemaV1 } from "@certtrace/types";
import { defaultFieldSchemaV1 } from "@certtrace/types";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import {
  MaterialSchemaForm,
  type MaterialFormValues,
  validateMaterialValues,
} from "./MaterialSchemaForm";

const customSchema: FieldSchemaV1 = {
  version: 1,
  fields: [
    {
      key: "family",
      label: "Material",
      type: "single_select",
      required: false,
      filterable: true,
      options: [
        { id: "aluminum", label: "Aluminum" },
        { id: "steel", label: "Steel" },
      ],
    },
    {
      key: "shop_notes",
      label: "Shop Notes",
      type: "long_text",
      required: false,
      filterable: false,
    },
    {
      key: "date_received",
      label: "Date Received",
      type: "date",
      required: false,
      filterable: true,
    },
  ],
  identifierKinds: [
    { key: "heat_number", label: "Heat Number", required: false, filterable: true },
    { key: "purchase_order", label: "Purchase Order", required: false, filterable: true },
  ],
  attachmentKinds: [],
};

describe("MaterialSchemaForm", () => {
  it("renders field and identifier labels from the library schema", () => {
    render(
      <MaterialSchemaForm
        schema={customSchema}
        values={{ fields: {}, identifiers: {} }}
        onChange={() => undefined}
      />,
    );

    expect(screen.getByLabelText("Material")).toBeTruthy();
    expect(screen.getByLabelText("Shop Notes")).toBeTruthy();
    expect(screen.getByLabelText("Date Received")).toBeTruthy();
    expect(screen.getByLabelText("Heat Number")).toBeTruthy();
    expect(screen.getByLabelText("Purchase Order")).toBeTruthy();
    expect(screen.queryByLabelText("Alloy")).toBeNull();
  });

  it("updates field and identifier values through onChange", async () => {
    const onChange = vi.fn();

    function Harness() {
      const [values, setValues] = useState<MaterialFormValues>({
        fields: {},
        identifiers: {},
      });
      return (
        <MaterialSchemaForm
          schema={customSchema}
          values={values}
          onChange={(next) => {
            onChange(next);
            setValues(next);
          }}
        />
      );
    }

    render(<Harness />);

    await userEvent.selectOptions(screen.getByLabelText("Material"), "aluminum");
    expect(onChange).toHaveBeenCalledWith({
      fields: { family: "aluminum" },
      identifiers: {},
    });

    onChange.mockClear();
    await userEvent.type(screen.getByLabelText("Heat Number"), "H-99");
    expect(onChange.mock.calls.at(-1)?.[0]).toEqual({
      fields: { family: "aluminum" },
      identifiers: { heat_number: "H-99" },
    });
  });

  it("reports required fields and identifier kinds that are empty", () => {
    const schema: FieldSchemaV1 = {
      version: 1,
      fields: [
        {
          key: "family",
          label: "Material",
          type: "single_select",
          required: true,
          filterable: true,
          options: [{ id: "aluminum", label: "Aluminum" }],
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
        { key: "heat_number", label: "Heat Number", required: true, filterable: true },
        { key: "lot_number", label: "Lot Number", required: false, filterable: true },
      ],
      attachmentKinds: [],
    };

    expect(validateMaterialValues(schema, {}, {})).toEqual([
      "Material is required",
      "Heat Number is required",
    ]);
    expect(
      validateMaterialValues(
        schema,
        { family: "aluminum" },
        { heat_number: "H-1" },
      ),
    ).toEqual([]);
  });

  it("allows empty values on the shipped default schema (nothing required)", () => {
    expect(validateMaterialValues(defaultFieldSchemaV1, {}, {})).toEqual([]);
  });
});
