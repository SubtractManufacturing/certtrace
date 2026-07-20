import type { NamingStrategyV1 } from "@certtrace/types";

export type TemplateSegment =
  | { type: "material" }
  | { type: "number"; numberPad?: number; numberStart?: number }
  | { type: "word"; listId: string }
  | { type: "year" }
  | { type: "month" }
  | { type: "day" }
  | { type: "separator"; value: string };

const TOKEN_PATTERN = /\{([^}]+)\}/g;

export function segmentsToTemplate(segments: TemplateSegment[]): string {
  return segments
    .map((segment) => {
      switch (segment.type) {
        case "material":
          return "{material}";
        case "number":
          return "{number}";
        case "word":
          return `{word:${segment.listId}}`;
        case "year":
          return "{year}";
        case "month":
          return "{month}";
        case "day":
          return "{day}";
        case "separator":
          return segment.value;
        default:
          return "";
      }
    })
    .join("");
}

export function parseTemplateToSegments(template: string): TemplateSegment[] {
  const segments: TemplateSegment[] = [];
  let lastIndex = 0;

  for (const match of template.matchAll(TOKEN_PATTERN)) {
    const index = match.index ?? 0;
    if (index > lastIndex) {
      segments.push({ type: "separator", value: template.slice(lastIndex, index) });
    }

    const token = match[1]!;
    if (token === "material") {
      segments.push({ type: "material" });
    } else if (token === "number") {
      segments.push({ type: "number" });
    } else if (token === "year") {
      segments.push({ type: "year" });
    } else if (token === "month") {
      segments.push({ type: "month" });
    } else if (token === "day") {
      segments.push({ type: "day" });
    } else if (token.startsWith("word:")) {
      segments.push({ type: "word", listId: token.slice("word:".length) });
    } else if (token === "animal") {
      segments.push({ type: "word", listId: "animals" });
    } else if (token === "adjective") {
      segments.push({ type: "word", listId: "adjectives" });
    } else if (token === "color") {
      segments.push({ type: "word", listId: "colors" });
    } else if (token === "city") {
      segments.push({ type: "word", listId: "cities" });
    }

    lastIndex = index + match[0].length;
  }

  if (lastIndex < template.length) {
    segments.push({ type: "separator", value: template.slice(lastIndex) });
  }

  return segments;
}

export function strategyFromSegments(
  id: string,
  label: string,
  segments: TemplateSegment[],
  options: Pick<NamingStrategyV1, "case" | "numberPad" | "numberStart"> = {},
): NamingStrategyV1 {
  const numberSegment = segments.find((segment) => segment.type === "number");
  return {
    id,
    label,
    template: segmentsToTemplate(segments),
    case: options.case ?? "lower",
    numberPad: numberSegment?.type === "number" ? numberSegment.numberPad : options.numberPad,
    numberStart: numberSegment?.type === "number" ? numberSegment.numberStart : options.numberStart,
  };
}
