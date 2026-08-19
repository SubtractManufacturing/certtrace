export type SizePatternPart =
  | { kind: "token"; key: string }
  | { kind: "text"; value: string };

const TOKEN_RE = /\{([A-Za-z][A-Za-z0-9_]*)\}/g;

export function parseSizePattern(
  pattern: string,
  knownKeys?: ReadonlySet<string>,
): SizePatternPart[] {
  const parts: SizePatternPart[] = [];
  let lastIndex = 0;
  const matches = pattern.matchAll(new RegExp(TOKEN_RE.source, "g"));
  for (const match of matches) {
    const start = match.index ?? 0;
    const key = match[1] ?? "";
    const known = !knownKeys || knownKeys.has(key);
    if (!known) {
      continue;
    }
    if (start > lastIndex) {
      parts.push({ kind: "text", value: pattern.slice(lastIndex, start) });
    }
    parts.push({ kind: "token", key });
    lastIndex = start + match[0].length;
  }
  if (lastIndex < pattern.length) {
    parts.push({ kind: "text", value: pattern.slice(lastIndex) });
  }
  return parts;
}

export function serializeSizePattern(parts: readonly SizePatternPart[]): string {
  return parts
    .map((part) => (part.kind === "token" ? `{${part.key}}` : part.value))
    .join("")
    .trim();
}
