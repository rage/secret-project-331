/* oxlint-disable playwright/prefer-locator */
import type { Locator, Page } from "playwright"

import {
  SHOW_TOASTS_INIFINITELY_IN_SYSTEM_TESTS_EVENT,
  SHOW_TOASTS_NORMALLY_IN_SYSTEM_TESTS_EVENT,
} from "@/shared-module/common/utils/constants"

/**
 * Hides all currently visible toasts and instructs next toasts to be shown infinitely. To hide the toasts, call function showToastsNormally.
 * If you use this with expectScreenshotsToMatchSnapshots, you should set also set dontWaitForSpinnersToDisappear to true.
 */
export const showNextToastsInfinitely = async (page: Page) => {
  await hideToasts(page)
  await page.dispatchEvent("body", SHOW_TOASTS_INIFINITELY_IN_SYSTEM_TESTS_EVENT)
}

export const showToastsNormally = async (page: Page) => {
  await page.dispatchEvent("body", SHOW_TOASTS_NORMALLY_IN_SYSTEM_TESTS_EVENT)
}

export const hideToasts = async (page: Page) => {
  await page.evaluate(() => {
    for (const notif of Array.from(
      document.querySelectorAll<HTMLElement>('[data-testid="toast-notification"]'),
    )) {
      notif.style.display = "none"
    }
  })
}

/** Extracts title and message text content from a notification text-wrapper locator. */
const extractNotificationContent = async (
  notificationLocator: Locator,
  kind: "success" | "error",
): Promise<{ title: string; message: string }> => {
  const rawTitle = await notificationLocator
    .getByTestId(`toast-notification-${kind}-title`)
    .textContent()
  const rawMessage = await notificationLocator
    .getByTestId(`toast-notification-${kind}-message`)
    .textContent()
  const title = rawTitle?.trim() || "(missing title)"
  const message = rawMessage?.trim() || "(missing message)"
  return { title, message }
}

/** Renders a string or RegExp matcher as a readable string for error messages. */
const formatTextMatcher = (text: string | RegExp): string =>
  text instanceof RegExp ? text.toString() : JSON.stringify(text)

/** Returns true if the given value matches the expected text (substring for string, test for RegExp). */
const matches = (value: string, text: string | RegExp): boolean =>
  text instanceof RegExp ? text.test(value) : value.includes(text)

/** Returns true if either the toast title or message matches the expected matcher. */
const toastTextMatches = (
  { title, message }: { title: string; message: string },
  text: string | RegExp,
): boolean => matches(title, text) || matches(message, text)

/**
 * Hides existing toasts, runs the provided action that triggers a success toast,
 * then waits for the toast and hides all toasts again.
 *
 * Example:
 * ```ts
 * await waitForSuccessNotification(page, async () => {
 *   await page.getByRole("button", { name: "Submit" }).click()
 * })
 * ```
 *
 * Throws a descriptive error (with the toast's title and message) when an error
 * toast appears instead, or when a success toast appears but its text does not
 * match the expected matcher.
 */
export const waitForSuccessNotification = async (
  page: Page,
  action: () => Promise<void>,
  text: string | RegExp = /Operation successful!?/,
) => {
  await hideToasts(page)
  await action()

  const anyToastLocator = page.getByTestId("toast-notification")
  const successLocator = anyToastLocator.getByTestId("toast-notification-success").first()
  const errorLocator = anyToastLocator.getByTestId("toast-notification-error").first()

  await anyToastLocator.first().waitFor()

  if (await errorLocator.isVisible()) {
    const { title, message } = await extractNotificationContent(errorLocator, "error")
    throw new Error(
      `Expected a success notification matching ${formatTextMatcher(
        text,
      )} but got an error notification. Title: ${title} Message: ${message}`,
    )
  }

  await successLocator.waitFor()
  const { title, message } = await extractNotificationContent(successLocator, "success")
  if (!toastTextMatches({ title, message }, text)) {
    throw new Error(
      `Got a success notification but its text did not match ${formatTextMatcher(
        text,
      )}. Title: ${title} Message: ${message}`,
    )
  }

  await hideToasts(page)
}

/**
 * Hides existing toasts, runs the provided action that is expected to trigger an
 * error toast, then waits for it and hides all toasts again. Returns the observed
 * error title and message.
 *
 * Throws a descriptive error when a success toast appears instead, or when an
 * error toast appears but its text does not match the expected matcher.
 */
export const waitForErrorNotification = async (
  page: Page,
  action: () => Promise<void>,
  text?: string | RegExp,
): Promise<{ title: string; message: string }> => {
  await hideToasts(page)
  await action()

  const anyToastLocator = page.getByTestId("toast-notification")
  const successLocator = anyToastLocator.getByTestId("toast-notification-success").first()
  const errorLocator = anyToastLocator.getByTestId("toast-notification-error").first()

  await anyToastLocator.first().waitFor()

  if (await successLocator.isVisible()) {
    const { title, message } = await extractNotificationContent(successLocator, "success")
    throw new Error(
      `Expected an error notification${
        text ? ` matching ${formatTextMatcher(text)}` : ""
      } but got a success notification. Title: ${title} Message: ${message}`,
    )
  }

  await errorLocator.waitFor()
  const { title, message } = await extractNotificationContent(errorLocator, "error")
  if (text !== undefined && !toastTextMatches({ title, message }, text)) {
    throw new Error(
      `Got an error notification but its text did not match ${formatTextMatcher(
        text,
      )}. Title: ${title} Message: ${message}`,
    )
  }

  await hideToasts(page)
  return { title, message }
}
