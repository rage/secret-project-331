import { expect, Locator, Page } from "@playwright/test"

export class TopLevelPagesSelector {
  constructor(private readonly page: Page) {}

  getContainer(): Locator {
    return this.page.getByTestId("top-level-pages-container")
  }

  async waitForTopLevelPagesList(): Promise<void> {
    await this.getContainer().waitFor()
  }

  getTopLevelPageLink(title: string): Locator {
    return this.getContainer().getByRole("link", { name: title })
  }

  async getAllTopLevelPageTitles(): Promise<string[]> {
    await this.waitForTopLevelPagesList()
    const pageLinks = this.getContainer().locator("a")
    const raw = await pageLinks.locator("h3").allTextContents()
    return raw.map((t) => t.trim()).filter(Boolean)
  }

  async clickTopLevelPage(title: string): Promise<void> {
    const link = this.getTopLevelPageLink(title)
    await expect(link).toBeVisible()
    await link.click()
  }
}
