import type { Locator, Page } from "@playwright/test"
import { expect } from "@playwright/test"

export class ChapterSelector {
  private readonly page: Page

  public constructor(page: Page) {
    this.page = page
  }

  public getChapterLink(chapterNumber: number): Locator {
    return this.page.getByTestId(`chapter-link-${chapterNumber}`)
  }

  public async clickChapter(chapterNumber: number): Promise<void> {
    const link = this.getChapterLink(chapterNumber)
    await expect(link).toBeVisible()
    await link.click()
  }

  public async clickChapterByTitle(title: string): Promise<void> {
    // Chapter cards are named "Chapter N title"; this skips the "Previous: title" link.
    const escaped = title.replaceAll(/[.*+?^${}()|[\]\\]/g, "\\$&")
    await this.page.getByRole("link", { name: new RegExp(`^Chapter \\d+ ${escaped}`) }).click()
  }
}
