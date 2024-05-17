import { Page } from "playwright"

import {
  SHOW_TOAS_INIFINITELY_IN_SYSTEM_TESTS_EVENT,
  SHOW_TOAST_DURATION_IN_SYSTEM_TESTS_EVENT,
} from "../shared-module/common/utils/constants"

/** Hides all currently visible toasts and instructs next toasts to be shown infinitely. To hide the toasts, call function showToastsNormally. */
export const showNextToastsInfinitely = async (page: Page) => {
  await hideToasts(page)
  await page.dispatchEvent("body", SHOW_TOASTS_INIFINITELY_IN_SYSTEM_TESTS_EVENT)
}

export const showToastsNormally = async (page: Page) => {
  await page.dispatchEvent("body", SHOW_TOASTS_NORMALLY_IN_SYSTEM_TESTS_EVENT)
}

export const hideToasts = async (page: Page) => {
  await page.evaluate(() => {
    for (const notif of Array.from(document.querySelectorAll<HTMLElement>(".toast-notification"))) {
      notif.style.display = "none"
    }
  })
}
