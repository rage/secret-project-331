import { expect, Page } from "@playwright/test"

/**
 * Check if path is correct by skipping specific ids
 * @param page Page from playwright
 * @param path Path to check, e.g.  /organizations/[id]/pages
 */
const expectPath = (page: Page, path: string): void => {
  const items = path.startsWith("/") ? path.split("/").slice(1) : path.split("/")
  const url = page.url().split("/").slice(3)
  expect(url.length === items.length)
  for (let i = 0; i < items.length; i++) {
    if (items[i] === "[id]") continue
    expect(url[i]).toMatch(items[i])
  }
}

export default expectPath
