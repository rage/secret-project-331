import { expect, Page } from "@playwright/test"

import { TopLevelPagesSelector } from "../components/TopLevelPagesSelector"

export async function getAllTopLevelPageTitles(page: Page): Promise<string[]> {
  const selector = new TopLevelPagesSelector(page)
  return await selector.getAllTopLevelPageTitles()
}

export async function assertTopLevelPageNotInList(page: Page, pageTitle: string): Promise<void> {
  const titles = await getAllTopLevelPageTitles(page)
  expect(titles).not.toContain(pageTitle)
}

export async function navigateToTopLevelPage(page: Page, pageTitle: string): Promise<void> {
  const selector = new TopLevelPagesSelector(page)
  await selector.clickTopLevelPage(pageTitle)
}
