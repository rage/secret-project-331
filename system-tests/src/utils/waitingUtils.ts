import { test } from "@playwright/test"
import { Page } from "playwright"

export const waitForFooterTranslationsToLoad = async (page: Page) => {
  await test.step(
    "Wait for footer translations to load",
    async () => {
      await page.getByText("high-quality").waitFor({ state: "attached" })
    },
    { box: true },
  )
}
