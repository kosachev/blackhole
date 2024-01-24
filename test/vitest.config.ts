import swc from "unplugin-swc";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [swc.vite()],
  test: {
    deps: {
      interopDefault: true,
    },
    environment: "node",
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "json-summary", "json"],
      reportOnFailure: true,
    },
    reporters: "default",
    include: ["**/*.(e2e-spec|spec).ts"],
  },
  root: ".",
});
