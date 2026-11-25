import { defineConfig } from "vitest/config";

/** Modul murni saja (tanpa Firebase, tanpa DOM): uang, tanggal, ringkasan. */
export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
