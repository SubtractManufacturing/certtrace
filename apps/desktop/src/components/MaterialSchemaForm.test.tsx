import type { FieldSchemaV1 } from "@certtrace/types";
import { defaultFieldSchemaV1 } from "@certtrace/types";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import {
  type MaterialFormValues,
  MaterialSchemaForm,
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

  it("filters dependent select options and clears values invalidated by a parent change", async () => {
    const onChange = vi.fn();

    function Harness() {
      const [values, setValues] = useState<MaterialFormValues>({
        fields: {},
        identifiers: {},
      });
      return (
        <MaterialSchemaForm
          schema={defaultFieldSchemaV1}
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
    const alloy = screen.getByLabelText("Alloy") as HTMLSelectElement;
    expect(Array.from(alloy.options, (option) => option.value)).toEqual([
      "",
      "6061",
      "7075",
      "2024",
    ]);

    await userEvent.selectOptions(alloy, "6061");
    await userEvent.selectOptions(screen.getByLabelText("Material"), "steel");
    expect(onChange.mock.calls.at(-1)?.[0].fields).toEqual({ family: "steel" });
    expect(Array.from(alloy.options, (option) => option.value)).toEqual(["", "1018", "4140"]);
  });

  it("does not render or require a field hidden by its dependency", () => {
    const schema: FieldSchemaV1 = {
      version: 1,
      fields: [
        {
          key: "shape",
          label: "Shape",
          type: "single_select",
          required: false,
          filterable: true,
          options: [
            { id: "round_bar", label: "Round bar" },
            { id: "plate", label: "Plate" },
          ],
        },
        {
          key: "diameter",
          label: "Diameter",
          type: "number",
          required: true,
          filterable: true,
          dependsOn: {
            fieldKey: "shape",
            visibleWhen: ["round_bar"],
          },
        },
      ],
      identifierKinds: [],
      attachmentKinds: [],
    };

    render(
      <MaterialSchemaForm
        schema={schema}
        values={{ fields: { shape: "plate" }, identifiers: {} }}
        onChange={() => undefined}
      />,
    );

    expect(screen.queryByLabelText("Diameter")).toBeNull();
    expect(validateMaterialValues(schema, { shape: "plate" }, {})).toEqual([]);
    expect(validateMaterialValues(schema, { shape: "round_bar" }, {})).toEqual([
      "Diameter is required",
    ]);
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
    expect(validateMaterialValues(schema, { family: "aluminum" }, { heat_number: "H-1" })).toEqual(
      [],
    );
  });

  it("allows empty values on the shipped default schema (nothing required)", () => {
    expect(validateMaterialValues(defaultFieldSchemaV1, {}, {})).toEqual([]);
  });
});
