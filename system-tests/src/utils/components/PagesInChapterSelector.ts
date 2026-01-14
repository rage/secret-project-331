import { expect, Locator, Page } from "@playwright/test"

export class PagesInChapterSelector {
  constructor(private readonly page: Page) {}

  getContainer(): Locator {
    return this.page.getByTestId("pages-in-chapter-container")
  }

  async waitForPagesInChapterList(): Promise<void> {
    await this.getContainer().waitFor()
  }

  getPageLinkByTitle(title: string): Locator {
    const container = this.getContainer()
    return container.getByRole("link", { name: new RegExp(`^\\d+ ${title}$`) })
  }

  getPageLinkByIndex(index: number): Locator {
    return this.page.getByTestId(`page-in-chapter-link-${index}`)
  }

  async getAllPageTitles(): Promise<string[]> {
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

  async clickPageByTitle(title: string): Promise<void> {
    const link = this.getPageLinkByTitle(title)
    await expect(link).toBeVisible()
    await link.click()
  }
}
