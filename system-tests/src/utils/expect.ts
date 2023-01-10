import { expect, Page } from "@playwright/test"

/**
 * Check if path is correct by skipping specific ids. For example `await expectUrlPathWithRandomUuid(page, "/manage/courses/[id]/pages")` would expect the path to match the given structure, but it would allow the id to be any uuid.
 * @param page Page from playwright
 * @param path Path to check, e.g.  /organizations/[id]/pages
 */
const expectUrlPathWithRandomUuid = async (page: Page, path: string): Promise<void> => {
  // e.g. http://project-331.local
  const urlBeginning = new URL(page.url()).origin
  const items = path.startsWith("/") ? path.split("/").slice(1) : path.split("/")
  const url = page.url().split("/").slice(3)
  let regexBuffer = `${urlBeginning}/`.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  expect(url.length).toBe(items.length)
  for (let i = 0; i < items.length; i++) {
    if (items[i] === "[id]") {
      regexBuffer += "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}"
    } else {
      regexBuffer += items[i].replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    }
    if (i !== items.length - 1) {
      regexBuffer += "/"
    }
  }
  const regex = new RegExp(regexBuffer)
  await page.waitForURL(regex)
}

export default expectUrlPathWithRandomUuid
