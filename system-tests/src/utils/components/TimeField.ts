import type { Locator } from "@playwright/test"
import { test } from "@playwright/test"

import { DATE_PICKER_LABELS, timeSegmentEntries } from "./dateTimeNames"
import { HybridTimeSelector } from "./HybridTimeSelector"
import { closeDialog, dialogLabelledByTrigger } from "./overlays"
import type { PickerOpener } from "./SegmentedTemporalField"
import { SegmentedTemporalField } from "./SegmentedTemporalField"

/** Driver for the shared-module `TimeField`, whose committed value is an `HH:mm` string. */
export class TimeField extends SegmentedTemporalField {
  /** Types the time segment by segment and asserts the field committed it. */
  public async setValue(isoTime: string): Promise<void> {
    // Only a 12-hour field has a day-period segment, and `hourCycle` can override the locale.
    const hasDayPeriodSegment = (await this.getSegment("dayPeriod").count()) > 0
    const entries = timeSegmentEntries(isoTime, hasDayPeriodSegment, this.locale)

    await test.step(`Set ${this.testId} to "${isoTime}"`, async () => {
      await this.setSegments(entries, isoTime)
    })
  }

  /** Opens the time popover, by default by clicking the field, and returns a driver for its panel. */
  public async openTimePicker(via: PickerOpener = "field"): Promise<HybridTimeSelector> {
    return await test.step(`Open the time picker of ${this.testId} via the ${via}`, async () => {
      const dialog = await this.openPicker(via)
      return this.timeSelectorIn(dialog)
    })
  }

  /** Closes the time popover; the panel commits each change as it is made. */
  public async closeTimePicker(): Promise<void> {
    await test.step(`Close the time picker of ${this.testId}`, async () => {
      await closeDialog(await dialogLabelledByTrigger(this.page, this.getTrigger()))
    })
  }

  /** Types the time into the popover's time panel, closes it and asserts the field committed it. */
  public async pickValue(isoTime: string): Promise<void> {
    await test.step(`Pick "${isoTime}" for ${this.testId}`, async () => {
      const selector = await this.openTimePicker()
      await selector.setTime(isoTime)
      await this.closeTimePicker()
      await this.expectValue(isoTime)
    })
  }

  private timeSelectorIn(dialog: Locator): HybridTimeSelector {
    return new HybridTimeSelector(
      dialog.getByRole("group", { name: DATE_PICKER_LABELS.time, exact: true }),
      { locale: this.locale, hourCycle: this.hourCycle },
    )
  }
}
