import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

const repoRoot = fileURLToPath(new URL("../..", import.meta.url));
const pkg = JSON.parse(
  readFileSync(fileURLToPath(new URL("./package.json", import.meta.url)), "utf8"),
) as { version: string };

export default defineConfig({
  plugins: [react()],
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  resolve: {
    alias: {
      "@certtrace/types": path.join(repoRoot, "packages/types/src/index.ts"),
      "@certtrace/file-storage": path.join(repoRoot, "packages/file-storage/src/index.ts"),
      "@certtrace/id-generator": path.join(repoRoot, "packages/id-generator/src/index.ts"),
      "@certtrace/library-engine": path.join(repoRoot, "packages/library-engine/src/index.ts"),
      "@certtrace/core": path.join(repoRoot, "packages/core/src/index.ts"),
      "@certtrace/ui": path.join(repoRoot, "packages/ui/src/index.ts"),
    },
  },
  test: {
    environment: "jsdom",
    include: ["src/**/*.test.{ts,tsx}"],
    setupFiles: ["src/test/setup.ts"],
  },
});
