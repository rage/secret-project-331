import { expect, Page } from "@playwright/test"

import { ChapterSelector } from "../components/ChapterSelector"

export async function navigateToChapter(page: Page, chapterNumber: number): Promise<void> {
  const chapterSelector = new ChapterSelector(page)
  await chapterSelector.clickChapter(chapterNumber)
  await expect(page).toHaveURL(new RegExp(`/chapter-${chapterNumber}`))
}
