import { LaunchOptions, PlaywrightTestConfig, ReporterDescription } from "@playwright/test"

function envToNumber(env: string, defaultNumber: number) {
  try {
    return Number(env.trim())
  } catch (error) {
    return defaultNumber
  }
}

const config: PlaywrightTestConfig = {
  globalSetup: require.resolve("./src/setup/globalSetup.ts"),
  globalTeardown: require.resolve("./src/setup/globalTeardown.ts"),
  reporter: [["./src/utils/customReporter"]],
  timeout: 100000,
  use: {
    headless: true,
    trace: "retain-on-failure",
    baseURL: "http://project-331.local",
    launchOptions: {},
    screenshot: "only-on-failure",
  },
}

if (process.env.SLOWMO) {
  const launchOptions = config.use.launchOptions as LaunchOptions
  launchOptions.slowMo = envToNumber(process.env.SLOWMO, 200)
  config.timeout = 600000
}

if (process.env.RECORD_VIDEO) {
  config.use.video = "on"
}

if (process.env.PWDEBUG === "1") {
  config.workers = 1
}

if (process.env.HTML) {
  const reporters = config.reporter as ReporterDescription[]
  config.reporter = [["html"], ...reporters]
}

if (process.env.CI) {
  const reporters = config.reporter as ReporterDescription[]
  config.reporter = [["github"], ...reporters]
}

export default config
