import type { OpenLibraryResult } from "@certtrace/library-engine";
import { createDefaultLibraryConfigV1, defaultFieldSchemaV1 } from "@certtrace/types";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  fetchMaterials,
  removeLibrarySchemaDefinition,
  updateLibraryFieldSchema,
} from "../lib/library-client";
import { ShapesEditor } from "./ShapesEditor";

vi.mock("../lib/library-client", () => ({
  updateLibraryFieldSchema: vi.fn(),
  removeLibrarySchemaDefinition: vi.fn(),
  fetchMaterials: vi.fn().mockResolvedValue([]),
}));

function sampleLibrary(
  fieldSchema: OpenLibraryResult["fieldSchema"] = defaultFieldSchemaV1,
): OpenLibraryResult {
  return {
    paths: { root: "/tmp/shop", materials: "/tmp/shop/materials" },
    config: createDefaultLibraryConfigV1("Main Shop"),
    fieldSchema: structuredClone(fieldSchema),
  } as OpenLibraryResult;
}

function mockPersist() {
  vi.mocked(updateLibraryFieldSchema).mockImplementation(async (library, schema) => ({
    ...library,
    fieldSchema: schema,
  }));
  vi.mocked(removeLibrarySchemaDefinition).mockImplementation(async (library, input) => ({
    ...library,
    fieldSchema: {
      ...library.fieldSchema,
      fields: library.fieldSchema.fields.filter((field) => field.key !== input.key),
    },
  }));
}

async function openDimensions(shapeLabel: string) {
  await userEvent.click(screen.getByLabelText(`Dimensions for ${shapeLabel}`));
}

describe("ShapesEditor", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPersist();
  });

  it("lists Shape options with dimensions and no Size pattern column", () => {
    render(
      <ShapesEditor
        library={sampleLibrary()}
        onLibraryUpdated={() => undefined}
        onRefreshLibrary={async () => undefined}
      />,
    );

    expect(screen.getByRole("table", { name: "Shapes" })).toBeTruthy();
    expect(screen.queryByRole("columnheader", { name: "Size pattern" })).toBeNull();
    expect(screen.getByRole("button", { name: "Edit Square bar" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Delete Hexagonal bar" })).toBeTruthy();
    const squareRow = screen.getByRole("button", { name: "Edit Square bar" }).closest("tr");
    expect(squareRow).toBeTruthy();
    expect(within(squareRow as HTMLElement).getByText("Width")).toBeTruthy();
    expect(within(squareRow as HTMLElement).queryByText("{width} x {width} {unit}")).toBeNull();
  });

  it("adds an unpacked Shape from the list", async () => {
    let library = sampleLibrary();
    const onLibraryUpdated = vi.fn((updated: OpenLibraryResult) => {
      library = updated;
    });

    const { rerender } = render(
      <ShapesEditor
        library={library}
        onLibraryUpdated={onLibraryUpdated}
        onRefreshLibrary={async () => undefined}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: "Add Shape" }));
    await userEvent.type(screen.getByLabelText("Shape name"), "Angle");
    await userEvent.click(screen.getByRole("button", { name: "Create" }));

    await waitFor(() => {
      expect(updateLibraryFieldSchema).toHaveBeenCalled();
    });

    rerender(
      <ShapesEditor
        library={library}
        onLibraryUpdated={onLibraryUpdated}
        onRefreshLibrary={async () => undefined}
      />,
    );

    expect(screen.getByRole("button", { name: "Edit Angle" })).toBeTruthy();
    const shape = library.fieldSchema.fields.find((field) => field.key === "shape");
    expect(shape?.options?.at(-1)).toMatchObject({ id: "angle", label: "Angle" });
    expect(shape?.options?.at(-1)?.dimensionKeys).toBeUndefined();
  });

  it("packs a reusable dimension onto a Shape option", async () => {
    let library = sampleLibrary();
    const onLibraryUpdated = vi.fn((updated: OpenLibraryResult) => {
      library = updated;
    });

    render(
      <ShapesEditor
        library={library}
        onLibraryUpdated={onLibraryUpdated}
        onRefreshLibrary={async () => undefined}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: "Edit Square bar" }));
    await openDimensions("Square bar");
    await userEvent.click(screen.getByLabelText("Use Height on Square bar"));
    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => {
      expect(updateLibraryFieldSchema).toHaveBeenCalled();
    });

    const shape = library.fieldSchema.fields.find((field) => field.key === "shape");
    expect(shape?.options?.find((option) => option.id === "square_bar")).toMatchObject({
      dimensionKeys: ["width", "height"],
      sizePattern: "{width} x {width} {unit}",
    });
  });

  it("creates a dimension Field from the Shape editor and lists it on that option", async () => {
    let library = sampleLibrary();
    const onLibraryUpdated = vi.fn((updated: OpenLibraryResult) => {
      library = updated;
    });

    render(
      <ShapesEditor
        library={library}
        onLibraryUpdated={onLibraryUpdated}
        onRefreshLibrary={async () => undefined}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: "Edit Square bar" }));
    await openDimensions("Square bar");
    await userEvent.click(screen.getByRole("button", { name: "Add dimension" }));
    await userEvent.type(screen.getByLabelText("New dimension field for Square bar"), "Leg A");
    await userEvent.click(
      screen.getByRole("button", { name: "Add dimension field to Square bar" }),
    );
    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => {
      expect(updateLibraryFieldSchema).toHaveBeenCalled();
    });

    expect(library.fieldSchema.fields.at(-1)).toMatchObject({
      key: "leg_a",
      label: "Leg A",
      type: "number",
    });
    const shape = library.fieldSchema.fields.find((field) => field.key === "shape");
    const square = shape?.options?.find((option) => option.id === "square_bar");
    expect(square?.dimensionKeys).toEqual(["width", "leg_a"]);
  });

  it("deletes a custom dimension from the dimensions list", async () => {
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

    render(
      <ShapesEditor
        library={sampleLibrary(schema)}
        onLibraryUpdated={() => undefined}
        onRefreshLibrary={async () => undefined}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: "Edit Square bar" }));
    await openDimensions("Square bar");
    expect(screen.queryByRole("button", { name: "Delete Width" })).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "Delete Leg A" }));
    await userEvent.click(screen.getByRole("button", { name: "Delete dimension" }));

    await waitFor(() => {
      expect(removeLibrarySchemaDefinition).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          definitionType: "field",
          key: "leg_a",
          strategy: { type: "delete" },
        }),
      );
    });
  });

  it("renames a dimension from the dimensions list", async () => {
    let library = sampleLibrary();
    const onLibraryUpdated = vi.fn((updated: OpenLibraryResult) => {
      library = updated;
    });

    render(
      <ShapesEditor
        library={library}
        onLibraryUpdated={onLibraryUpdated}
        onRefreshLibrary={async () => undefined}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: "Edit Square bar" }));
    await openDimensions("Square bar");
    await userEvent.click(screen.getByRole("button", { name: "Rename Width" }));
    const rename = screen.getByRole("textbox", { name: "Rename Width" });
    await userEvent.clear(rename);
    await userEvent.type(rename, "Across");
    fireEvent.blur(rename);
    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => {
      expect(updateLibraryFieldSchema).toHaveBeenCalled();
    });
    expect(library.fieldSchema.fields.find((field) => field.key === "width")?.label).toBe("Across");
  });

  it("closes the dimensions dropdown without closing the Shape editor", async () => {
    render(
      <ShapesEditor
        library={sampleLibrary()}
        onLibraryUpdated={() => undefined}
        onRefreshLibrary={async () => undefined}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: "Edit Square bar" }));
    await openDimensions("Square bar");

    expect(screen.getByLabelText("Dimensions for Square bar").getAttribute("aria-expanded")).toBe(
      "true",
    );

    await userEvent.click(screen.getByLabelText("Shape name"));

    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(screen.getByLabelText("Dimensions for Square bar").getAttribute("aria-expanded")).toBe(
      "false",
    );
  });

  it("closes the dimensions dropdown from the backdrop without closing the Shape editor", async () => {
    render(
      <ShapesEditor
        library={sampleLibrary()}
        onLibraryUpdated={() => undefined}
        onRefreshLibrary={async () => undefined}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: "Edit Square bar" }));
    await openDimensions("Square bar");

    const backdrop = document.querySelector(".certtrace-overlay-backdrop");
    expect(backdrop).toBeTruthy();
    await userEvent.click(backdrop as Element);

    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(screen.getByLabelText("Dimensions for Square bar").getAttribute("aria-expanded")).toBe(
      "false",
    );
  });

  it("adds a Height chip to the Size layout via the plus menu", async () => {
    let library = sampleLibrary();
    const onLibraryUpdated = vi.fn((updated: OpenLibraryResult) => {
      library = updated;
    });

    render(
      <ShapesEditor
        library={library}
        onLibraryUpdated={onLibraryUpdated}
        onRefreshLibrary={async () => undefined}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: "Edit Square bar" }));
    expect(screen.getByText("Label Template")).toBeTruthy();

    const editor = screen.getByRole("textbox", { name: "Label Template" });
    editor.focus();
    const endRange = document.createRange();
    endRange.selectNodeContents(editor);
    endRange.collapse(false);
    window.getSelection()?.removeAllRanges();
    window.getSelection()?.addRange(endRange);
    fireEvent.keyUp(editor, { key: "End" });

    await userEvent.click(screen.getByRole("button", { name: "Add value to Size layout" }));
    await userEvent.click(screen.getByRole("menuitem", { name: "Height" }));
    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => {
      expect(updateLibraryFieldSchema).toHaveBeenCalled();
    });
    const square = library.fieldSchema.fields
      .find((field) => field.key === "shape")
      ?.options?.find((option) => option.id === "square_bar");
    expect(square?.sizePattern).toContain("{height}");
    expect(square?.dimensionKeys).toContain("height");
  });

  it("hides dimension keys that no longer correspond to a real field", () => {
    const schema = structuredClone(defaultFieldSchemaV1);
    const shape = schema.fields.find((field) => field.key === "shape");
    const square = shape?.options?.find((option) => option.id === "square_bar");
    if (square) {
      square.dimensionKeys = ["width", "U", "Un", "Uni", "Unit", "nit"];
    }

    render(
      <ShapesEditor
        library={sampleLibrary(schema)}
        onLibraryUpdated={() => undefined}
        onRefreshLibrary={async () => undefined}
      />,
    );

    const row = screen.getByRole("button", { name: "Edit Square bar" }).closest("tr");
    expect(row).toBeTruthy();
    expect(within(row as HTMLElement).getByText("Width")).toBeTruthy();
    for (const junk of ["U", "Un", "Uni", "Unit", "nit"]) {
      expect(within(row as HTMLElement).queryByText(junk)).toBeNull();
    }
  });

  it("strips unknown dimension keys from a Shape when it is saved", async () => {
    const schema = structuredClone(defaultFieldSchemaV1);
    const shape = schema.fields.find((field) => field.key === "shape");
    const square = shape?.options?.find((option) => option.id === "square_bar");
    if (square) {
      square.dimensionKeys = ["width", "U", "Un", "Unit", "nit"];
    }

    let library = sampleLibrary(schema);
    const onLibraryUpdated = vi.fn((updated: OpenLibraryResult) => {
      library = updated;
    });

    render(
      <ShapesEditor
        library={library}
        onLibraryUpdated={onLibraryUpdated}
        onRefreshLibrary={async () => undefined}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: "Edit Square bar" }));
    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => {
      expect(updateLibraryFieldSchema).toHaveBeenCalled();
    });
    const saved = library.fieldSchema.fields
      .find((field) => field.key === "shape")
      ?.options?.find((option) => option.id === "square_bar");
    expect(saved?.dimensionKeys).toEqual(["width"]);
  });

  it("confirms Shape delete with material count", async () => {
    vi.mocked(fetchMaterials).mockResolvedValue([
      { fields: { shape: "hex_bar" } },
      { fields: { shape: "hex_bar" } },
    ] as never);

    render(
      <ShapesEditor
        library={sampleLibrary()}
        onLibraryUpdated={() => undefined}
        onRefreshLibrary={async () => undefined}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: "Delete Hexagonal bar" }));
    await waitFor(() => {
      expect(screen.getByText("This clears Shape and Size on 2 materials.")).toBeTruthy();
    });
    await userEvent.click(screen.getByRole("button", { name: "Delete Shape" }));
    expect(updateLibraryFieldSchema).toHaveBeenCalled();
  });
});
