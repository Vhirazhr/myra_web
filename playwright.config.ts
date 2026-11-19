import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "tests",
  workers: 1,
  timeout: 360000,
  expect: { timeout: 12000 },
  use: {
    baseURL: process.env.MYRA_E2E_WEB_URL || "http://127.0.0.1:8443",
    headless: true,
    launchOptions: {
      executablePath: process.env.MYRA_E2E_BROWSER || undefined,
      args: ["--no-sandbox"],
    },
  },
  reporter: "list",
});
