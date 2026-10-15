import { test } from "@playwright/test"

import { dateSegmentEntries } from "./dateTimeNames"
import { PickerTemporalField } from "./SegmentedTemporalField"

/** Driver for the shared-module `DateField`, whose committed value is a `yyyy-MM-dd` string. */
export class DateField extends PickerTemporalField {
  protected readonly closesOnDaySelect = true

  /** Types the date segment by segment and asserts the field committed it. */
  public async setValue(isoDate: string): Promise<void> {
    const entries = dateSegmentEntries(isoDate)

    await test.step(`Set ${this.testId} to "${isoDate}"`, async () => {
      await this.setSegments(entries, isoDate)
    })
  }

  /** Picks the date in the calendar opened by clicking the field, and asserts the field committed it. */
  public async pickValue(isoDate: string): Promise<void> {
    await test.step(`Pick "${isoDate}" for ${this.testId}`, async () => {
      const calendar = await this.openCalendar()
      await calendar.pickDate(isoDate)
      await this.expectValue(isoDate)
    })
  }
}
