import { LaunchOptions, PlaywrightTestConfig } from "@playwright/test"

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
export default config
