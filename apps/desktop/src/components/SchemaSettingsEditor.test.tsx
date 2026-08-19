import type { RemoveSchemaDefinitionInput } from "@certtrace/library-engine";
import { defaultFieldSchemaV1, type FieldSchemaV1 } from "@certtrace/types";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { chooseSelectOption } from "../test/select-helpers";
import { SchemaSettingsEditor } from "./SchemaSettingsEditor";

function renderEditor(options?: {
  schema?: FieldSchemaV1;
  onRemoveDefinition?: (input: RemoveSchemaDefinitionInput) => Promise<void>;
  onRemoveShapeOption?: (optionId: string) => Promise<void>;
  onCountShapeOptionMaterials?: (optionId: string) => Promise<number>;
}) {
  const onChange = vi.fn();

  function Harness() {
    const [schema, setSchema] = useState(options?.schema ?? defaultFieldSchemaV1);
    return (
      <SchemaSettingsEditor
        schema={schema}
        onChange={(next) => {
          onChange(next);
          setSchema(next);
        }}
        onRemoveDefinition={options?.onRemoveDefinition}
        onRemoveShapeOption={options?.onRemoveShapeOption}
        onCountShapeOptionMaterials={options?.onCountShapeOptionMaterials}
      />
    );
  }

  render(<Harness />);
  return onChange;
}

function setInputValue(element: HTMLElement, value: string) {
  fireEvent.change(element, { target: { value } });
}

// Full default schema + many Selects is expensive to render; CI hosts need headroom.
describe("SchemaSettingsEditor", { timeout: 20_000 }, () => {
  it("renames a field without changing its stable key", async () => {
    const onChange = renderEditor();

    setInputValue(screen.getByLabelText("Label for field family"), "Stock family");

    const updated = onChange.mock.calls.at(-1)?.[0];
    expect(updated.fields[0]).toMatchObject({
      key: "family",
      label: "Stock family",
    });
    expect((screen.getByDisplayValue("family") as HTMLInputElement).readOnly).toBe(true);
  });

  it("changes field flags and order", async () => {
    const onChange = renderEditor();

    fireEvent.click(screen.getByLabelText("Required field Material"));
    fireEvent.click(screen.getByLabelText("Filterable field Material"));
    fireEvent.click(screen.getByRole("button", { name: "Move Material down" }));

    const updated = onChange.mock.calls.at(-1)?.[0];
    expect(updated.fields.slice(0, 2).map((field: { key: string }) => field.key)).toEqual([
      "alloy",
      "family",
    ]);
    expect(updated.fields[1]).toMatchObject({
      key: "family",
      required: true,
      filterable: false,
    });
  });

  it("adds a typed field with a generated stable key", async () => {
    const onChange = renderEditor();

    setInputValue(screen.getByLabelText("New field label"), "Inspection score");
    await chooseSelectOption(screen.getByLabelText("New field type"), "Number");
    fireEvent.click(screen.getByRole("button", { name: "Add field" }));

    expect(onChange.mock.calls.at(-1)?.[0].fields.at(-1)).toEqual({
      key: "inspection_score",
      label: "Inspection score",
      type: "number",
      required: false,
      filterable: false,
    });
  });

  it("changes an existing field type", async () => {
    const onChange = renderEditor();

    await chooseSelectOption(screen.getByLabelText("Type for field family"), "Text");

    expect(onChange.mock.calls.at(-1)?.[0].fields[0]).toEqual({
      key: "family",
      label: "Material",
      type: "text",
      required: false,
      filterable: true,
    });
  });

  it("edits select option labels and short codes without changing option ids", async () => {
    const onChange = renderEditor();

    setInputValue(screen.getByLabelText("Option label aluminum for field family"), "Aluminium");
    setInputValue(screen.getByLabelText("Option short code aluminum for field family"), "AU");

    expect(onChange.mock.calls.at(-1)?.[0].fields[0].options[0]).toEqual({
      id: "aluminum",
      label: "Aluminium",
      shortCode: "AU",
    });
  });

  it("adds, renames, flags, and reorders identifier kinds", async () => {
    const onChange = renderEditor();

    setInputValue(screen.getByLabelText("Label for identifier heat_number"), "Mill Heat");
    fireEvent.click(screen.getByLabelText("Required identifier Mill Heat"));
    fireEvent.click(screen.getByRole("button", { name: "Move Mill Heat down" }));
    setInputValue(screen.getByLabelText("New identifier label"), "Mill cert");
    fireEvent.click(screen.getByRole("button", { name: "Add identifier" }));

    const updated = onChange.mock.calls.at(-1)?.[0];
    expect(updated.identifierKinds.slice(0, 2)).toEqual([
      { key: "lot_number", label: "Lot Number", required: false, filterable: true },
      { key: "heat_number", label: "Mill Heat", required: true, filterable: true },
    ]);
    expect(updated.identifierKinds.at(-1)).toEqual({
      key: "mill_cert",
      label: "Mill cert",
      required: false,
      filterable: false,
    });
  });

  it("adds, renames, and removes attachment kinds", async () => {
    const onChange = renderEditor();

    setInputValue(screen.getByLabelText("Label for attachment kind mtr"), "Mill test report");
    fireEvent.click(screen.getByRole("button", { name: "Remove Heat cert" }));
    setInputValue(screen.getByLabelText("New attachment kind label"), "Inspection photo");
    fireEvent.click(screen.getByRole("button", { name: "Add attachment kind" }));

    const updated = onChange.mock.calls.at(-1)?.[0];
    expect(updated.attachmentKinds).toEqual([
      { key: "mtr", label: "Mill test report" },
      { key: "coc", label: "COC" },
      { key: "other", label: "Other" },
      { key: "inspection_photo", label: "Inspection photo" },
    ]);
  });

  it("edits dependent select option mappings", async () => {
    const onChange = renderEditor();

    fireEvent.click(screen.getByLabelText("Allow 6061 for Steel in Alloy"));

    const alloy = onChange.mock.calls
      .at(-1)?.[0]
      .fields.find((field: { key: string }) => field.key === "alloy");
    expect(alloy.dependsOn).toMatchObject({
      fieldKey: "family",
      filterOptionsBy: {
        steel: ["1018", "4140", "6061"],
      },
    });
  });

  it("offers user-facing removal choices and disables new field entries", async () => {
    const onRemoveDefinition = vi.fn().mockResolvedValue(undefined);
    renderEditor({ onRemoveDefinition });

    fireEvent.click(screen.getByRole("button", { name: "Remove Supplier" }));

    expect(
      screen.getByText("Keep values already saved, but hide this field on new materials."),
    ).toBeTruthy();
    expect(
      screen.getByText("Permanently erase this field and its values from every material."),
    ).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Disable new entries" }));

    expect(onRemoveDefinition).toHaveBeenCalledWith({
      definitionType: "field",
      key: "supplier",
      strategy: { type: "disable" },
    });
  });

  it("requires the definition name before deleting all values", async () => {
    const onRemoveDefinition = vi.fn().mockResolvedValue(undefined);
    renderEditor({ onRemoveDefinition });

    fireEvent.click(screen.getByRole("button", { name: "Remove Notes" }));
    const deleteButton = screen.getByRole("button", { name: "Delete all values" });
    expect((deleteButton as HTMLButtonElement).disabled).toBe(true);

    setInputValue(screen.getByLabelText("Type Notes to confirm"), "Notes");
    fireEvent.click(deleteButton);

    expect(onRemoveDefinition).toHaveBeenCalledWith({
      definitionType: "field",
      key: "notes",
      strategy: { type: "delete" },
    });
  });

  it("replaces an identifier kind with another kind", async () => {
    const onRemoveDefinition = vi.fn().mockResolvedValue(undefined);
    renderEditor({ onRemoveDefinition });

    fireEvent.click(screen.getByRole("button", { name: "Remove Heat Number" }));
    await chooseSelectOption(screen.getByLabelText("Replacement for Heat Number"), "Lot Number");
    fireEvent.click(screen.getByRole("button", { name: "Replace saved values" }));

    expect(onRemoveDefinition).toHaveBeenCalledWith({
      definitionType: "identifierKind",
      key: "heat_number",
      strategy: { type: "replace", targetKey: "lot_number" },
    });
  });

  it("starts a new Shape option unpacked", async () => {
    const onChange = renderEditor();

    setInputValue(screen.getByLabelText("New option label for field shape"), "Angle");
    fireEvent.click(screen.getByRole("button", { name: "Add option to Shape" }));

    const shape = onChange.mock.calls
      .at(-1)?.[0]
      .fields.find((field: { key: string }) => field.key === "shape");
    expect(shape.options.at(-1)).toEqual({ id: "angle", label: "Angle" });
  });

  it("does not offer removal for shipped dimension fields", async () => {
    renderEditor({ onRemoveDefinition: vi.fn().mockResolvedValue(undefined) });

    expect(screen.queryByRole("button", { name: "Remove Width" })).toBeNull();
    expect(
      screen.getAllByText("Shipped dimension fields cannot be deleted").length,
    ).toBeGreaterThan(0);
  });

  it("confirms Shape option delete with material count", async () => {
    const onRemoveShapeOption = vi.fn().mockResolvedValue(undefined);
    const onCountShapeOptionMaterials = vi.fn().mockResolvedValue(2);
    renderEditor({ onRemoveShapeOption, onCountShapeOptionMaterials });

    fireEvent.click(screen.getByRole("button", { name: "Remove Hexagonal bar option" }));

    await waitFor(() => {
      expect(
        screen.getByText("Delete Hexagonal bar? This clears Shape and Size on 2 materials."),
      ).toBeTruthy();
    });
    fireEvent.click(screen.getByRole("button", { name: "Delete option" }));

    expect(onRemoveShapeOption).toHaveBeenCalledWith("hex_bar");
  });

  it("warns which Shapes list a custom dimension before delete", async () => {
    const onRemoveDefinition = vi.fn().mockResolvedValue(undefined);
    const schema = structuredClone(defaultFieldSchemaV1);
    schema.fields.push({
      key: "leg_a",
      label: "Leg A",
      type: "number",
      required: false,
      filterable: false,
    });
    const shape = schema.fields.find((field) => field.key === "shape");
    const square = shape?.options?.find((option) => option.id === "square_bar");
    if (square) {
      square.dimensionKeys = ["width", "leg_a"];
    }
    renderEditor({ onRemoveDefinition, schema });

    fireEvent.click(screen.getByRole("button", { name: "Remove Leg A" }));
    expect(
      screen.getByText(
        "Listed on Square bar. Delete strips it from those Shape options, Size patterns, and Materials.",
      ),
    ).toBeTruthy();
  });
});
