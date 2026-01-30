import { Locator, Page } from "playwright"

export function getImgByURLPrefixAndSuffix(
  page: Page,
  urlPrefix: string,
  urlSuffix: string,
): Locator {
  return page.locator(`img[src^="${urlPrefix}"][src$="${urlSuffix}"]`)
}
