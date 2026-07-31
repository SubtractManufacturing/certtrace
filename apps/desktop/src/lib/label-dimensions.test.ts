import { describe, expect, it } from "vitest";
import {
  displayToInches,
  formatDimensionInput,
  inchesToDisplay,
  parseDimensionInput,
} from "./label-dimensions";

describe("label-dimensions", () => {
  it("converts between inches and millimeters", () => {
    expect(inchesToDisplay(1, "in")).toBe(1);
    expect(inchesToDisplay(1, "mm")).toBeCloseTo(25.4, 5);
    expect(displayToInches(25.4, "mm")).toBeCloseTo(1, 5);
    expect(displayToInches(4, "in")).toBe(4);
  });

  it("formats display values without forcing trailing zeros", () => {
    expect(formatDimensionInput(4, "in")).toBe("4");
    expect(formatDimensionInput(8.5, "in")).toBe("8.5");
    expect(formatDimensionInput(displayToInches(100, "mm"), "mm")).toBe("100");
  });

  it("parses plain numbers in the current display unit", () => {
    expect(parseDimensionInput("4", "in")).toEqual({
      valueInches: 4,
      displayUnit: "in",
    });
    expect(parseDimensionInput("101.6", "mm")).toEqual({
      valueInches: 4,
      displayUnit: "mm",
    });
  });

  it("switches display unit when a unit suffix is typed", () => {
    const fromMm = parseDimensionInput("100mm", "in");
    expect(fromMm?.displayUnit).toBe("mm");
    expect(fromMm?.valueInches).toBeCloseTo(100 / 25.4, 5);

    expect(parseDimensionInput('4"', "mm")).toEqual({
      valueInches: 4,
      displayUnit: "in",
    });
    expect(parseDimensionInput("4in", "mm")).toEqual({
      valueInches: 4,
      displayUnit: "in",
    });
    expect(parseDimensionInput("4 in", "mm")).toEqual({
      valueInches: 4,
      displayUnit: "in",
    });
  });

  it("returns null for empty or invalid input", () => {
    expect(parseDimensionInput("", "in")).toBeNull();
    expect(parseDimensionInput("abc", "in")).toBeNull();
    expect(parseDimensionInput("0", "in")).toBeNull();
    expect(parseDimensionInput("-2", "mm")).toBeNull();
  });
});
