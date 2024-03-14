import { devices, LaunchOptions, PlaywrightTestConfig, ReporterDescription } from "@playwright/test"
import { freemem } from "os"

function envToNumber(env: string, defaultNumber: number) {
  try {
    return Number(env.trim())
  } catch (error) {
    return defaultNumber
  }
}

const chromeUse = {
  ...devices["Desktop Chrome"],
  launchOptions: {
    // For fighting anti-aliasing from: https://github.com/microsoft/playwright/issues/8161#issuecomment-1369230603
    args: [
      "--font-render-hinting=none",
      "--disable-skia-runtime-opts",
      "--disable-font-subpixel-positioning",
      "--disable-lcd-text",
    ],
  },
}

const freeMemoryGB = freemem() / (1024 * 1024 * 1024)
// If more than 10Gb use most cores, otherwise use half
const defaultWorkersAmount = freeMemoryGB < 10 ? "50%" : "85%"

const config: PlaywrightTestConfig = {
  forbidOnly: !!process.env.CI,
  globalSetup: require.resolve("./src/setup/globalSetup.ts"),
  reporter: [["line"]],
  // We like keeping retries to 0 because by disallowing retries we are forced to keep the tests stable. If were not forced to keep the tests stable, all tests would eventually become flaky. This would slow down test execution a lot and would be major pain. The only exception is when we're deploying master because we don't want flaky tests to randomly prevent urgent deploys.
  retries: process.env.GITHUB_REF === "refs/heads/master" ? 2 : 0,
  // Please don't increase this. Instead, tag your slow test as slow: https://playwright.dev/docs/api/class-test#test-slow-1
  timeout: 100000,
  testDir: "./src/tests",
  snapshotPathTemplate: "./src/__screenshots__/{testFilePath}/{arg}{ext}",

  workers: process.env.SECRET_PROJECT_SYSTEM_TEST_WORKERS ?? defaultWorkersAmount,
  use: {
    navigationTimeout: 15000,
    actionTimeout: 15000,
    headless: true,
    trace: "retain-on-failure",
    baseURL: "http://project-331.local",
    launchOptions: {},
    screenshot: "only-on-failure",
    contextOptions: {
      locale: "en-US",
      timezoneId: "Europe/Helsinki",
    },
  },
  projects: [
    {
      name: "setup",
      testDir: "./src/setup",
      use: chromeUse,
    },
    {
      name: "chromium",
      dependencies: ["setup"],
      use: chromeUse,
    },
  ],
}

if (!config.use) {
  // To make typescript happy
  config.use = {}
}

if (process.env.SLOWMO) {
  const launchOptions = config.use.launchOptions as LaunchOptions
  launchOptions.slowMo = envToNumber(process.env.SLOWMO, 1000)
  config.timeout = 600000
  config.use.video = "on"
}

if (process.env.RECORD_VIDEO) {
  config.use.video = "on"
}

if (process.env.PWDEBUG === "1") {
  config.workers = 1
  config.use.navigationTimeout = 0
  config.use.actionTimeout = 0
}

if (process.env.HTML) {
  const reporters = config.reporter as ReporterDescription[]
  config.reporter = [["html"], ...reporters]
}

if (process.env.CI) {
  const reporters = config.reporter as ReporterDescription[]
  config.workers = "50%"
  config.reporter = [["github"], ...reporters]
}

export default config
