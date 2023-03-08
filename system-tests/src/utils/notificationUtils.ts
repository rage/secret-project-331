import { Page } from "playwright"

import {
  SHOW_TOAS_INIFINITELY_IN_SYSTEM_TESTS_EVENT,
  SHOW_TOAST_DURATION_IN_SYSTEM_TESTS_EVENT,
} from "../shared-module/utils/constants"

export const showToasInfinitely = async (page: Page) => {
  await page.dispatchEvent("body", SHOW_TOAS_INIFINITELY_IN_SYSTEM_TESTS_EVENT)
}

export const showToastNormally = async (page: Page) => {
  await page.dispatchEvent("body", SHOW_TOAST_DURATION_IN_SYSTEM_TESTS_EVENT)
}
