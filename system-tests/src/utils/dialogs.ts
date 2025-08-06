import { expect, Page } from "@playwright/test"

const DIALOG_TEST_ID = "dialog-provider-dialog"
const ALERT_DIALOG_OK_BUTTON_TEST_ID = "alert-dialog-ok-button"
const CONFIRM_DIALOG_YES_BUTTON_TEST_ID = "confirm-dialog-yes-button"
const CONFIRM_DIALOG_NO_BUTTON_TEST_ID = "confirm-dialog-no-button"
const PROMPT_DIALOG_OK_BUTTON_TEST_ID = "prompt-dialog-ok-button"
const PROMPT_DIALOG_CANCEL_BUTTON_TEST_ID = "prompt-dialog-cancel-button"
const PROMPT_DIALOG_INPUT_TEST_ID = "prompt-dialog-input"

/**
 * Dismiss an alert dialog by clicking OK
 * @param page - Playwright page object
 * @param expectedMessage - Optional message to verify is present in the dialog
 * @param expectedTitle - Optional title to verify is present in the dialog
 */
export async function dismissAlertDialog(
  page: Page,
  expectedMessage?: string,
  expectedTitle?: string,
): Promise<void> {
  const dialog = page.getByTestId(DIALOG_TEST_ID)
  await dialog.waitFor()

  if (expectedMessage) {
    await expect(dialog.getByText(expectedMessage)).toBeVisible()
  }
  if (expectedTitle) {
    await expect(dialog.getByText(expectedTitle)).toBeVisible()
  }

  await dialog.getByTestId(ALERT_DIALOG_OK_BUTTON_TEST_ID).click()

  await dialog.waitFor({ state: "hidden" })
}

/**
 * Respond to a confirm dialog by clicking Yes or No
 * @param page - Playwright page object
 * @param confirm - Whether to click "Yes" (true) or "No" (false)
 * @param expectedMessage - Optional message to verify is present in the dialog
 * @param expectedTitle - Optional title to verify is present in the dialog
 */
export async function respondToConfirmDialog(
  page: Page,
  confirm: boolean,
  expectedMessage?: string,
  expectedTitle?: string,
): Promise<void> {
  const dialog = page.getByTestId(DIALOG_TEST_ID)
  await dialog.waitFor()

  if (expectedMessage) {
    await expect(dialog.getByText(expectedMessage)).toBeVisible()
  }
  if (expectedTitle) {
    await expect(dialog.getByText(expectedTitle)).toBeVisible()
  }

  const buttonTestId = confirm
    ? CONFIRM_DIALOG_YES_BUTTON_TEST_ID
    : CONFIRM_DIALOG_NO_BUTTON_TEST_ID
  await dialog.getByTestId(buttonTestId).click()

  await dialog.waitFor({ state: "hidden" })
}

/**
 * Fill and submit or cancel a prompt dialog
 * @param page - Playwright page object
 * @param inputValue - The value to enter in the input field
 * @param submit - Whether to click "OK" (true) or "Cancel" (false)
 * @param expectedMessage - Optional message to verify is present in the dialog
 * @param expectedTitle - Optional title to verify is present in the dialog
 */
export async function fillPromptDialog(
  page: Page,
  inputValue: string,
  submit: boolean,
  expectedMessage?: string,
  expectedTitle?: string,
): Promise<void> {
  const dialog = page.getByTestId(DIALOG_TEST_ID)
  await dialog.waitFor()

  if (expectedMessage) {
    await expect(dialog.getByText(expectedMessage)).toBeVisible()
  }
  if (expectedTitle) {
    await expect(dialog.getByText(expectedTitle)).toBeVisible()
  }

  if (submit) {
    const input = dialog.getByTestId(PROMPT_DIALOG_INPUT_TEST_ID)
    await input.fill(inputValue)

    await dialog.getByTestId(PROMPT_DIALOG_OK_BUTTON_TEST_ID).click()
  } else {
    await dialog.getByTestId(PROMPT_DIALOG_CANCEL_BUTTON_TEST_ID).click()
  }

  await dialog.waitFor({ state: "hidden" })
}

/**
 * Wait for a dialog to appear and optionally verify its content
 * @param page - Playwright page object
 * @param expectedMessage - Optional message to verify is present in the dialog
 * @param expectedTitle - Optional title to verify is present in the dialog
 */
export async function waitForDialog(
  page: Page,
  expectedMessage?: string,
  expectedTitle?: string,
): Promise<void> {
  const dialog = page.getByTestId(DIALOG_TEST_ID)
  await dialog.waitFor()

  if (expectedMessage) {
    await expect(dialog.getByText(expectedMessage)).toBeVisible()
  }
  if (expectedTitle) {
    await expect(dialog.getByText(expectedTitle)).toBeVisible()
  }
}

/**
 * Helper function to check if a dialog is currently visible
 * @param page - Playwright page object
 * @returns Promise<boolean> - true if dialog is visible, false otherwise
 */
export async function isDialogVisible(page: Page): Promise<boolean> {
  const dialog = page.getByTestId(DIALOG_TEST_ID)
  return await dialog.isVisible()
}
