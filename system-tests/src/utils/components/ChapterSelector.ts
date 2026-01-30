import { expect, Locator, Page } from "@playwright/test"

export class ChapterSelector {
  constructor(private readonly page: Page) {}

  getChapterLink(chapterNumber: number): Locator {
    return this.page.getByTestId(`chapter-link-${chapterNumber}`)
  }

  async clickChapter(chapterNumber: number): Promise<void> {
    const link = this.getChapterLink(chapterNumber)
    await expect(link).toBeVisible()
    await link.click()
  }

  async clickChapterByTitle(title: string): Promise<void> {
    await this.page.getByRole("link", { name: title }).click()
  }
}
