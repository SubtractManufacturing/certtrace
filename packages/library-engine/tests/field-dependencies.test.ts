import type { FieldDefinitionV1, FieldSchemaV1 } from "@certtrace/types";
import { describe, expect, it } from "vitest";
import {
  availableFieldOptions,
  defaultFieldSchemaV1,
  isFieldVisible,
  sanitizeDependentSelectValues,
  validateMaterialValues,
} from "../src/index.js";

function field(key: string): FieldDefinitionV1 {
  const result = defaultFieldSchemaV1.fields.find((candidate) => candidate.key === key);
  if (!result) {
    throw new Error(`Missing default field: ${key}`);
  }
  return result;
}

describe("field dependencies", () => {
  it("filters the shipped Alloy and Temper options by Family", () => {
    expect(
      availableFieldOptions(field("alloy"), { family: "aluminum" }).map((option) => option.id),
    ).toEqual(["6061", "7075", "2024"]);
    expect(
      availableFieldOptions(field("alloy"), { family: "steel" }).map((option) => option.id),
    ).toEqual(["1018", "4140"]);
    expect(
      availableFieldOptions(field("temper"), { family: "plastic" }).map((option) => option.id),
    ).toEqual([]);
  });

  it("evaluates explicit visibility rules from parent values", () => {
    const dependent: FieldDefinitionV1 = {
      key: "diameter",
      label: "Diameter",
      type: "number",
      required: true,
      filterable: true,
      dependsOn: {
        fieldKey: "shape",
        visibleWhen: ["round_bar", "round_tube"],
      },
    };

    expect(isFieldVisible(dependent, { shape: "round_bar" })).toBe(true);
    expect(isFieldVisible(dependent, { shape: "plate" })).toBe(false);
    expect(isFieldVisible(dependent, {})).toBe(false);
  });

  it("removes dependent select values that are unavailable for the parent", () => {
    const schema: FieldSchemaV1 = {
      ...defaultFieldSchemaV1,
      fields: [
        ...defaultFieldSchemaV1.fields,
        {
          key: "diameter",
          label: "Diameter",
          type: "number",
          required: false,
          filterable: true,
          dependsOn: {
            fieldKey: "shape",
            visibleWhen: ["round_bar"],
          },
        },
      ],
    };

    expect(
      sanitizeDependentSelectValues(schema, {
        family: "steel",
        alloy: "6061",
        temper: "t6",
        shape: "plate",
        diameter: 2,
      }),
    ).toEqual({
      family: "steel",
      shape: "plate",
      diameter: 2,
    });
  });

  it("requires fields only while they are visible", () => {
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

    expect(validateMaterialValues(schema, { shape: "plate" }, {})).toEqual([]);
    expect(validateMaterialValues(schema, { shape: "round_bar" }, {})).toEqual([
      "Diameter is required",
    ]);
  });
});
