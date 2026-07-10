import type { Locator, Page } from "@playwright/test"
import { expect } from "@playwright/test"

export class TopLevelPagesSelector {
  private readonly page: Page

  public constructor(page: Page) {
    this.page = page
  }

  public getContainer(): Locator {
    return this.page.getByTestId("top-level-pages-container")
  }

  public async waitForTopLevelPagesList(): Promise<void> {
    await this.getContainer().waitFor()
  }

  public getTopLevelPageLink(title: string): Locator {
    return this.getContainer().getByRole("link", { name: title })
  }

  public async getAllTopLevelPageTitles(): Promise<string[]> {
    await this.waitForTopLevelPagesList()
    const pageLinks = this.getContainer().locator("a")
    const raw = await pageLinks.locator("h3").allTextContents()
    return raw.map((t) => t.trim()).filter(Boolean)
  }

  public async clickTopLevelPage(title: string): Promise<void> {
    const link = this.getTopLevelPageLink(title)
    await expect(link).toBeVisible()
    await link.click()
  }
}
