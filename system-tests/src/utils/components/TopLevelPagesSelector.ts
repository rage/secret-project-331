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
    return this.page.getByRole("link", { name: title })
  }

  async getAllTopLevelPageTitles(): Promise<string[]> {
    await this.waitForTopLevelPagesList()
    const container = this.getContainer()
    const pageLinks = container.locator('[data-testid^="top-level-page-link-"]')
    const count = await pageLinks.count()
    const titles: string[] = []
    for (let i = 0; i < count; i++) {
      const link = pageLinks.nth(i)
      const title = await link.locator("h3").textContent()
      if (title) {
        titles.push(title.trim())
      }
    }
    return titles
  }

  async clickTopLevelPage(title: string): Promise<void> {
    const link = this.getTopLevelPageLink(title)
    await expect(link).toBeVisible()
    await link.click()
  }
}
