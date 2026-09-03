import type { Locator, Page } from "@playwright/test"
import { expect, test } from "@playwright/test"

import { DatePickerCalendar } from "./DatePickerCalendar"
import type { SegmentEntry, TemporalSegment } from "./dateTimeNames"
import { DEFAULT_TEMPORAL_LOCALE, segmentNamePattern } from "./dateTimeNames"
import { dialogLabelledByTrigger } from "./overlays"

/** Deletes needed to empty any one segment; the year is the widest at four characters. */
const LONGEST_SEGMENT_LENGTH = 4

export interface SegmentedTemporalFieldOptions {
  /** Locale to resolve segment names in; defaults to the one the app's `I18nProvider` uses. */
  locale?: string | undefined
  /** Mirrors the field's `hourCycle` prop, which decides how the calendar's time panel reads back. */
  hourCycle?: 12 | 24 | undefined
}

/**
 * Shared driver for `DateField`, `DateTimeLocalField` and `TimeField`.
 *
 * Addressed by the `data-testid` the caller passes to the component: the id itself lands on the
 * `role="group"`, `${id}-value` on the hidden input and `${id}-trigger` on the calendar button.
 */
export class SegmentedTemporalField {
  protected readonly page: Page
  protected readonly testId: string
  protected readonly locale: string
  protected readonly hourCycle: 12 | 24 | undefined

  public constructor(page: Page, testId: string, options: SegmentedTemporalFieldOptions = {}) {
    this.page = page
    this.testId = testId
    this.locale = options.locale ?? DEFAULT_TEMPORAL_LOCALE
    this.hourCycle = options.hourCycle
  }

  /** The `role="group"` wrapping the segments. */
  public getGroup(): Locator {
    return this.page.getByTestId(this.testId)
  }

  /**
   * The hidden input holding the serialized value, which is the only place the committed value
   * can be read.
   *
   * Rooted at the page, not at the group: the input is the group's *sibling* in the field shell's
   * control slot, so scoping the lookup to the group finds nothing.
   */
  public getValueInput(): Locator {
    return this.page.getByTestId(`${this.testId}-value`)
  }

  /**
   * The field's label, resolved through the group's `aria-labelledby`.
   *
   * Rooted at the page: like the hidden input, the label is the group's sibling in the field
   * shell's control slot, not a descendant.
   */
  public async getLabel(): Promise<Locator> {
    const labelId = await this.getGroup().getAttribute("aria-labelledby")
    if (labelId === null || labelId.length === 0) {
      throw new Error(`${this.testId} has no aria-labelledby to resolve its label through`)
    }
    return this.page.locator(`[id="${labelId}"]`)
  }

  /** One editable segment, located by name because the segment order follows the locale. */
  public getSegment(segment: TemporalSegment): Locator {
    return this.getGroup().getByRole("spinbutton", {
      name: segmentNamePattern(segment, this.locale),
    })
  }

  /** Asserts the committed value, in the field's own serialization (`yyyy-MM-dd`, `HH:mm`, …). */
  public async expectValue(expected: string): Promise<void> {
    await test.step(`Expect ${this.testId} to hold "${expected}"`, async () => {
      await expect(this.getValueInput()).toHaveValue(expected)
    })
  }

  /** Types into a single segment, leaving the other segments alone. */
  public async setSegment(segment: TemporalSegment, text: string): Promise<void> {
    await test.step(`Set the ${segment} segment of ${this.testId} to "${text}"`, async () => {
      await this.revealSegments()
      await this.typeIntoSegment(segment, text)
    })
  }

  /** Empties every segment, leaving the field with no committed value. */
  public async clear(): Promise<void> {
    await test.step(`Clear ${this.testId}`, async () => {
      await this.revealSegments()
      const segments = await this.getGroup().getByRole("spinbutton").all()
      for (const segment of segments) {
        await segment.click()
        for (let deletion = 0; deletion < LONGEST_SEGMENT_LENGTH; deletion += 1) {
          await segment.press("Backspace")
        }
      }
      await expect(this.getValueInput()).toHaveValue("")
    })
  }

  /**
   * Brings the segment row into reach before anything clicks a segment.
   *
   * While the field is empty and unfocused the floating layout collapses the row to zero height,
   * and Playwright will not click a zero-height element, so the row cannot be its own way in.
   * Clicking the label is react-aria's answer: `useDateField` hangs `focusManager.focusFirst()` off
   * the label, which focuses the first segment and expands the row.
   */
  protected async revealSegments(): Promise<void> {
    const label = await this.getLabel()
    await label.click()
    await expect(this.getGroup().getByRole("spinbutton").first()).toBeVisible()
  }

  /** Fills the segments in order and asserts the value the field commits from them. */
  protected async setSegments(entries: readonly SegmentEntry[], expected: string): Promise<void> {
    await this.revealSegments()
    for (const [segment, text] of entries) {
      await this.typeIntoSegment(segment, text)
    }
    await expect(this.getValueInput()).toHaveValue(expected)
  }

  protected async typeIntoSegment(segment: TemporalSegment, text: string): Promise<void> {
    const locator = this.getSegment(segment)
    await locator.click()
    // Segments are contenteditable divs whose `beforeinput` react-aria cancels, feeding `e.data`
    // through a per-character parser. `fill()` delivers the whole string in one event, so it
    // neither throws nor sets anything; only per-character typing reaches the segment.
    await locator.pressSequentially(text)
    await expect(locator).not.toHaveAttribute("data-placeholder", "true")
  }
}

/** Shared driver for the two segmented fields that carry a calendar popover. */
export abstract class PickerTemporalField extends SegmentedTemporalField {
  /** Whether picking a day in the calendar closes it, which `shouldCloseOnSelect` decides. */
  protected abstract readonly closesOnDaySelect: boolean

  /** The calendar affordance at the trailing edge of the group. */
  public getTrigger(): Locator {
    return this.page.getByTestId(`${this.testId}-trigger`)
  }

  /** Opens the calendar popover and returns a driver for it. */
  public async openCalendar(): Promise<DatePickerCalendar> {
    const trigger = this.getTrigger()
    return await test.step(`Open the calendar of ${this.testId}`, async () => {
      await trigger.click()
      const dialog = await dialogLabelledByTrigger(this.page, trigger)
      await expect(dialog).toBeVisible()
      return new DatePickerCalendar(this.page, dialog, {
        closesOnDaySelect: this.closesOnDaySelect,
        locale: this.locale,
        hourCycle: this.hourCycle,
      })
    })
  }

  /**
   * Focuses the trigger, which is always visible and sits inside the group, rather than routing
   * through the label as the base class has to.
   */
  protected override async revealSegments(): Promise<void> {
    await this.getTrigger().focus()
    await expect(this.getGroup().getByRole("spinbutton").first()).toBeVisible()
  }
}
