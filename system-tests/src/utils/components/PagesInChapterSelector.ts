import type { Locator, Page } from "@playwright/test"
import { expect } from "@playwright/test"

export class PagesInChapterSelector {
  private readonly page: Page

  public constructor(page: Page) {
    this.page = page
  }

  public getContainer(): Locator {
    return this.page.getByTestId("pages-in-chapter-container")
  }

  public async waitForPagesInChapterList(): Promise<void> {
    await this.getContainer().waitFor()
  }

  public getPageLinkByTitle(title: string): Locator {
    const container = this.getContainer()
    const escapedTitle = title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    return container.getByRole("link", { name: new RegExp(`^\\d+ ${escapedTitle}$`) })
  }

  public getPageLinkByIndex(index: number): Locator {
    return this.page.getByTestId(`page-in-chapter-link-${index}`)
  }

  public async getAllPageTitles(): Promise<string[]> {
    await this.waitForPagesInChapterList()
    const container = this.getContainer()
    const allLinks = container.locator("a")
    const count = await allLinks.count()
    const links = await Promise.all(
      Array.from({ length: count }, (_, i) => allLinks.nth(i)).map(async (link) => {
        const testId = await link.getAttribute("data-testid")
        return testId?.startsWith("page-in-chapter-link-") ? link : null
      }),
    )
    const titles = await Promise.all(
      links
        .filter((link): link is Locator => link !== null)
        .map(async (link) => {
          const title = await link.locator("span").nth(1).textContent()
          return title?.trim() ?? null
        }),
    )
    return titles.filter((title): title is string => title !== null)
  }

  public async clickPageByTitle(title: string): Promise<void> {
    const link = this.getPageLinkByTitle(title)
    await expect(link).toBeVisible()
    const href = await link.getAttribute("href")
    await link.click()
    // The click starts an async client-side route transition; wait for the URL to change, or a
    // page.reload() right after would reload the old chapter page and cancel the pending
    // navigation.
    if (href) {
      await this.page.waitForURL((url) => url.pathname === href)
    }
  }
}
