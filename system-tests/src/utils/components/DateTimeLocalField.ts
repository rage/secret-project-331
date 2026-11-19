import { test } from "@playwright/test"

import { dateTimeSegmentEntries } from "./dateTimeNames"
import { PickerTemporalField } from "./SegmentedTemporalField"

/**
 * Driver for the shared-module `DateTimeLocalField`, whose committed value is `yyyy-MM-ddTHH:mm`.
 *
 * Its calendar stays open after a day is picked, and react-aria only commits a value once a time
 * exists too — either set in the time panel, or filled in with the placeholder time when the
 * popover closes.
 */
export class DateTimeLocalField extends PickerTemporalField {
  protected readonly closesOnDaySelect = false

  /** Types the date and time segment by segment and asserts the field committed the result. */
  public async setValue(isoDateTime: string): Promise<void> {
    // Only a 12-hour field has a day-period segment, and `hourCycle` can override the locale.
    const hasDayPeriodSegment = (await this.getSegment("dayPeriod").count()) > 0
    const entries = dateTimeSegmentEntries(isoDateTime, hasDayPeriodSegment, this.locale)

    await test.step(`Set ${this.testId} to "${isoDateTime}"`, async () => {
      await this.setSegments(entries, isoDateTime)
    })
  }

  /**
   * Picks the day in the calendar and types the time into its time panel, both in the popover
   * opened by clicking the field, then closes it and asserts the field committed the result.
   */
  public async pickValue(isoDateTime: string): Promise<void> {
    const [isoDate, isoTime] = isoDateTime.split("T")
    if (isoDate === undefined || isoTime === undefined) {
      throw new Error(`Expected a yyyy-MM-ddTHH:mm datetime, got "${isoDateTime}".`)
    }

    await test.step(`Pick "${isoDateTime}" for ${this.testId}`, async () => {
      const calendar = await this.openCalendar()
      await calendar.pickDate(isoDate)
      await calendar.getTimeSelector().setTime(isoTime)
      await calendar.close()
      await this.expectValue(isoDateTime)
    })
  }
}
