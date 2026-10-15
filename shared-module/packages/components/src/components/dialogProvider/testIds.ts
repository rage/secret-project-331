/**
 * Test ids the Playwright helpers in `system-tests/src/utils/dialogs.ts` select on. The strings are
 * part of that contract: changing a value breaks those tests silently at the next run.
 */
export const DIALOG_PROVIDER_DIALOG_TEST_ID = "dialog-provider-dialog"
export const ALERT_DIALOG_OK_BUTTON_TEST_ID = "alert-dialog-ok-button"
export const CONFIRM_DIALOG_YES_BUTTON_TEST_ID = "confirm-dialog-yes-button"
export const CONFIRM_DIALOG_NO_BUTTON_TEST_ID = "confirm-dialog-no-button"
export const PROMPT_DIALOG_OK_BUTTON_TEST_ID = "prompt-dialog-ok-button"
export const PROMPT_DIALOG_CANCEL_BUTTON_TEST_ID = "prompt-dialog-cancel-button"
export const PROMPT_DIALOG_INPUT_TEST_ID = "prompt-dialog-input"
