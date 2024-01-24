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
      reporter: ["text", "html"],
      reportOnFailure: true,
    },
    reporters: "verbose",
    include: ["**/*.(e2e-spec|spec).ts"],
  },
  root: ".",
});
