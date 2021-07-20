import { PlaywrightTestConfig } from "@playwright/test"

const config: PlaywrightTestConfig = {
  globalSetup: require.resolve("./src/setup/globalSetup.ts"),
  globalTeardown: require.resolve("./src/setup/globalTeardown.ts"),
}
export default config
