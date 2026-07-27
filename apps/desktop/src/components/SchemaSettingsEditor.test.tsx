import type { RemoveSchemaDefinitionInput } from "@certtrace/library-engine";
import { defaultFieldSchemaV1 } from "@certtrace/types";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { SchemaSettingsEditor } from "./SchemaSettingsEditor";

function renderEditor(onRemoveDefinition?: (input: RemoveSchemaDefinitionInput) => Promise<void>) {
  const onChange = vi.fn();

  function Harness() {
    const [schema, setSchema] = useState(defaultFieldSchemaV1);
    return (
      <SchemaSettingsEditor
        schema={schema}
        onChange={(next) => {
          onChange(next);
          setSchema(next);
        }}
        onRemoveDefinition={onRemoveDefinition}
      />
    );
  }

  render(<Harness />);
  return onChange;
}

describe("SchemaSettingsEditor", () => {
  it("renames a field without changing its stable key", async () => {
    const onChange = renderEditor();

    const label = screen.getByLabelText("Label for field family");
    await userEvent.clear(label);
    await userEvent.type(label, "Stock family");

    const updated = onChange.mock.calls.at(-1)?.[0];
    expect(updated.fields[0]).toMatchObject({
      key: "family",
      label: "Stock family",
    });
    expect((screen.getByDisplayValue("family") as HTMLInputElement).readOnly).toBe(true);
  });

  it("changes field flags and order", async () => {
    const onChange = renderEditor();

    await userEvent.click(screen.getByLabelText("Required field Material"));
    await userEvent.click(screen.getByLabelText("Filterable field Material"));
    await userEvent.click(screen.getByRole("button", { name: "Move Material down" }));

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

    await userEvent.type(screen.getByLabelText("New field label"), "Inspection score");
    await userEvent.selectOptions(screen.getByLabelText("New field type"), "number");
    await userEvent.click(screen.getByRole("button", { name: "Add field" }));

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

    await userEvent.selectOptions(screen.getByLabelText("Type for field family"), "text");

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

    const optionLabel = screen.getByLabelText("Option label aluminum for field family");
    await userEvent.clear(optionLabel);
    await userEvent.type(optionLabel, "Aluminium");
    const shortCode = screen.getByLabelText("Option short code aluminum for field family");
    await userEvent.clear(shortCode);
    await userEvent.type(shortCode, "AU");

    expect(onChange.mock.calls.at(-1)?.[0].fields[0].options[0]).toEqual({
      id: "aluminum",
      label: "Aluminium",
      shortCode: "AU",
    });
  });

  it("adds, renames, flags, and reorders identifier kinds", async () => {
    const onChange = renderEditor();

    const label = screen.getByLabelText("Label for identifier heat_number");
    await userEvent.clear(label);
    await userEvent.type(label, "Mill Heat");
    await userEvent.click(screen.getByLabelText("Required identifier Mill Heat"));
    await userEvent.click(screen.getByRole("button", { name: "Move Mill Heat down" }));
    await userEvent.type(screen.getByLabelText("New identifier label"), "Mill cert");
    await userEvent.click(screen.getByRole("button", { name: "Add identifier" }));

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

    const label = screen.getByLabelText("Label for attachment kind mtr");
    await userEvent.clear(label);
    await userEvent.type(label, "Mill test report");
    await userEvent.click(screen.getByRole("button", { name: "Remove Heat cert" }));
    await userEvent.type(screen.getByLabelText("New attachment kind label"), "Inspection photo");
    await userEvent.click(screen.getByRole("button", { name: "Add attachment kind" }));

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

    await userEvent.click(screen.getByLabelText("Allow 6061 for Steel in Alloy"));

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
    renderEditor(onRemoveDefinition);

    await userEvent.click(screen.getByRole("button", { name: "Remove Supplier" }));

    expect(
      screen.getByText("Keep values already saved, but hide this field on new materials."),
    ).toBeTruthy();
    expect(
      screen.getByText("Permanently erase this field and its values from every material."),
    ).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "Disable new entries" }));

    expect(onRemoveDefinition).toHaveBeenCalledWith({
      definitionType: "field",
      key: "supplier",
      strategy: { type: "disable" },
    });
  });

  it("requires the definition name before deleting all values", async () => {
    const onRemoveDefinition = vi.fn().mockResolvedValue(undefined);
    renderEditor(onRemoveDefinition);

    await userEvent.click(screen.getByRole("button", { name: "Remove Notes" }));
    const deleteButton = screen.getByRole("button", { name: "Delete all values" });
    expect((deleteButton as HTMLButtonElement).disabled).toBe(true);

    await userEvent.type(screen.getByLabelText("Type Notes to confirm"), "Notes");
    await userEvent.click(deleteButton);

    expect(onRemoveDefinition).toHaveBeenCalledWith({
      definitionType: "field",
      key: "notes",
      strategy: { type: "delete" },
    });
  });

  it("replaces an identifier kind with another kind", async () => {
    const onRemoveDefinition = vi.fn().mockResolvedValue(undefined);
    renderEditor(onRemoveDefinition);

    await userEvent.click(screen.getByRole("button", { name: "Remove Heat Number" }));
    await userEvent.selectOptions(
      screen.getByLabelText("Replacement for Heat Number"),
      "lot_number",
    );
    await userEvent.click(screen.getByRole("button", { name: "Replace saved values" }));

    expect(onRemoveDefinition).toHaveBeenCalledWith({
      definitionType: "identifierKind",
      key: "heat_number",
      strategy: { type: "replace", targetKey: "lot_number" },
    });
  });
});
