/* eslint-disable playwright/no-wait-for-timeout */
import { Page } from "@playwright/test"

const waitForFunction = async <T>(page: Page, functionToExecute: () => T): Promise<T> => {
  let res = functionToExecute()
  while (!res) {
    await page.waitForTimeout(10)
    res = functionToExecute()
  }
  return res
}

export default waitForFunction
