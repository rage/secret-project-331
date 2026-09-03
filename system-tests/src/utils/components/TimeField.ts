import { test } from "@playwright/test"

import { timeSegmentEntries } from "./dateTimeNames"
import { SegmentedTemporalField } from "./SegmentedTemporalField"

/**
 * Driver for the shared-module `TimeField`, whose committed value is an `HH:mm` string.
 *
 * It has no calendar and therefore no trigger button to focus, so an empty one is reached through
 * its label; see `SegmentedTemporalField.revealSegments`.
 */
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
}
