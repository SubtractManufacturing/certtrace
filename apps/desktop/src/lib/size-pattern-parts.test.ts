import { describe, expect, it } from "vitest";
import { parseSizePattern, serializeSizePattern } from "./size-pattern-parts";

const known = new Set(["width", "height", "unit"]);

describe("size pattern parts", () => {
  it("splits tokens and literals", () => {
    const parts = parseSizePattern("{width} x {width} {unit}", known);
    expect(parts.map((part) => (part.kind === "token" ? part.key : part.value))).toEqual([
      "width",
      " x ",
      "width",
      " ",
      "unit",
    ]);
    expect(serializeSizePattern(parts)).toBe("{width} x {width} {unit}");
  });

  it("leaves unknown braces as text", () => {
    const parts = parseSizePattern("{width} {nope}", known);
    expect(parts.map((part) => (part.kind === "token" ? part.key : part.value))).toEqual([
      "width",
      " {nope}",
    ]);
  });

  it("keeps an empty text slot between adjacent tokens as no text at all", () => {
    const parts = parseSizePattern("{width}{height}", known);
    expect(parts).toEqual([
      { kind: "token", key: "width" },
      { kind: "token", key: "height" },
    ]);
    expect(serializeSizePattern(parts)).toBe("{width}{height}");
  });

  it("trims leading and trailing whitespace on serialize", () => {
    const parts = parseSizePattern("  {width} ", known);
    expect(serializeSizePattern(parts)).toBe("{width}");
  });
});
