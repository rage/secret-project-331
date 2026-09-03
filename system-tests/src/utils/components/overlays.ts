import type { Locator, Page } from "@playwright/test"

/**
 * Locates the overlay a trigger has opened.
 *
 * react-aria portals every popover, listbox and dialog to `document.body`, so an overlay is never a
 * DOM descendant of the control that opened it and cannot be reached by scoping to that control.
 * `useOverlayTrigger` publishes the overlay's id as `aria-controls` on the trigger, but only while
 * the overlay is open, so call this after opening it.
 *
 * Date pickers do not go through `useOverlayTrigger` and emit no `aria-controls`; use
 * {@link dialogLabelledByTrigger} for those.
 */
export async function overlayControlledBy(page: Page, trigger: Locator): Promise<Locator> {
  const overlayId = await trigger.getAttribute("aria-controls")
  if (!overlayId) {
    throw new Error(
      "Trigger has no aria-controls, so no overlay is open. Open it before locating the overlay, " +
        "and use dialogLabelledByTrigger for date pickers, which never set the attribute.",
    )
  }
  // Attribute match, not `#id`: React ids contain characters that are invalid in a CSS id selector.
  return page.locator(`[id="${overlayId}"]`)
}

/**
 * Locates a date picker's calendar dialog, which `useDatePicker` labels by its trigger's id.
 *
 * The sibling for every other overlay is {@link overlayControlledBy}; prefer that one wherever the
 * trigger exposes `aria-controls`.
 */
export async function dialogLabelledByTrigger(page: Page, trigger: Locator): Promise<Locator> {
  const triggerId = await trigger.getAttribute("id")
  if (!triggerId) {
    throw new Error("Trigger has no id, so its calendar dialog cannot be identified.")
  }
  return page.locator(`[role="dialog"][aria-labelledby~="${triggerId}"]`)
}
