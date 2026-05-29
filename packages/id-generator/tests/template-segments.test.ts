import { describe, expect, it } from "vitest";
import {
  parseTemplateToSegments,
  segmentsToTemplate,
  strategyFromSegments,
} from "../src/template-segments.js";

describe("template segments", () => {
  it("round-trips material-animal-number template", () => {
    const template = "{material}-{word:animals}-{number}";
    const segments = parseTemplateToSegments(template);
    expect(segmentsToTemplate(segments)).toBe(template);
  });

  it("builds a strategy from segments", () => {
    const strategy = strategyFromSegments("custom", "Custom", [
      { type: "material" },
      { type: "separator", value: "-" },
      { type: "word", listId: "animals" },
      { type: "separator", value: "-" },
      { type: "number", numberPad: 3 },
    ]);

    expect(strategy.template).toBe("{material}-{word:animals}-{number}");
    expect(strategy.numberPad).toBe(3);
  });
});
