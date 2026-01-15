import { Page } from "@playwright/test"

import { PagesInChapterSelector } from "../components/PagesInChapterSelector"

export async function getAllPageTitlesInChapter(page: Page): Promise<string[]> {
  const selector = new PagesInChapterSelector(page)
  return await selector.getAllPageTitles()
}

export async function clickPageInChapterByTitle(page: Page, pageTitle: string): Promise<void> {
  const selector = new PagesInChapterSelector(page)
  await selector.clickPageByTitle(pageTitle)
}
