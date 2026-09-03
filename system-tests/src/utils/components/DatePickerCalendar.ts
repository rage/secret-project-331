import type { Locator, Page } from "@playwright/test"
import { expect, test } from "@playwright/test"

import {
  calendarDayNamePattern,
  chooseMonthAndYearLabel,
  DATE_PICKER_LABELS,
  DEFAULT_TEMPORAL_LOCALE,
} from "./dateTimeNames"
import { HybridTimeSelector } from "./HybridTimeSelector"
import { YearMonthPicker } from "./YearMonthPicker"

export interface DatePickerCalendarOptions {
  /** `false` in datetime mode, where the calendar stays open after a day is picked. */
  closesOnDaySelect: boolean
  locale?: string | undefined
  /** Mirrors the field's `hourCycle` prop; only affects how the time panel is read back. */
  hourCycle?: 12 | 24 | undefined
}

/**
 * Driver for the calendar popover of `DateField` and `DateTimeLocalField`.
 *
 * Construct it through `PickerTemporalField.openCalendar()`, which resolves the portaled dialog and
 * supplies the mode. The dialog element is a child of the popover surface, so it excludes the two
 * invisible "Dismiss" buttons every popover carries.
 */
export class DatePickerCalendar {
  private readonly page: Page
  private readonly dialog: Locator
  private readonly closesOnDaySelect: boolean
  private readonly locale: string
  private readonly hourCycle: 12 | 24 | undefined

  public constructor(page: Page, dialog: Locator, options: DatePickerCalendarOptions) {
    this.page = page
    this.dialog = dialog
    this.closesOnDaySelect = options.closesOnDaySelect
    this.locale = options.locale ?? DEFAULT_TEMPORAL_LOCALE
    this.hourCycle = options.hourCycle
  }

  /** The `role="dialog"` holding the calendar. */
  public getDialog(): Locator {
    return this.dialog
  }

  /** The month grid. Held locators go stale across a switch to the month/year chooser. */
  public getGrid(): Locator {
    return this.dialog.getByRole("grid")
  }

  /**
   * One day button, matched on the full formatted date react-aria labels it with.
   *
   * @param isoDate a `yyyy-MM-dd` date
   */
  public getDay(isoDate: string): Locator {
    return this.dialog.getByRole("button", {
      name: calendarDayNamePattern(isoDate, this.locale),
    })
  }

  /** The currently selected day, if the visible month contains it. */
  public getSelectedDay(): Locator {
    return this.dialog.getByRole("gridcell", { selected: true })
  }

  /** The time column, which only datetime fields render. */
  public getTimeSelector(): HybridTimeSelector {
    return new HybridTimeSelector(
      this.dialog.getByRole("group", { name: DATE_PICKER_LABELS.time, exact: true }),
      { locale: this.locale, hourCycle: this.hourCycle },
    )
  }

  /** Picks a day. In datetime mode the value only commits once a time is set or the popover closes. */
  public async selectDay(isoDate: string): Promise<void> {
    await test.step(`Select ${isoDate} in the calendar`, async () => {
      await this.getDay(isoDate).click()
      await this.assertSelectionSettled()
    })
  }

  public async goToPreviousMonth(): Promise<void> {
    await test.step("Go to the previous month", async () => {
      await this.pageMonth(DATE_PICKER_LABELS.previousMonth)
    })
  }

  public async goToNextMonth(): Promise<void> {
    await test.step("Go to the next month", async () => {
      await this.pageMonth(DATE_PICKER_LABELS.nextMonth)
    })
  }

  /**
   * Opens the month or year chooser from the calendar header.
   *
   * Both header buttons share one label template, so the visible month name or year has to be
   * given to tell them apart: "September" opens the month chooser, "2026" the year chooser.
   */
  public async openChooser(visibleLabel: string): Promise<YearMonthPicker> {
    return await test.step(`Open the "${visibleLabel}" chooser`, async () => {
      await this.dialog
        .getByRole("button", { name: chooseMonthAndYearLabel(visibleLabel), exact: true })
        .click()
      await expect(this.getGrid()).toBeHidden()
      return new YearMonthPicker(this.dialog)
    })
  }

  /** Empties the field through the calendar's own affordance, which also closes the popover. */
  public async clear(): Promise<void> {
    await test.step("Clear the date from the calendar", async () => {
      await this.getButton(DATE_PICKER_LABELS.clear).click()
      await expect(this.dialog).toBeHidden()
    })
  }

  /** Picks today. Rendered by date fields only; datetime fields offer {@link selectNow} instead. */
  public async selectToday(): Promise<void> {
    await test.step("Select today", async () => {
      await this.getButton(DATE_PICKER_LABELS.today).click()
      await this.assertSelectionSettled()
    })
  }

  /** Picks the current date and time. Rendered by datetime fields only. */
  public async selectNow(): Promise<void> {
    await test.step("Select now", async () => {
      await this.getButton(DATE_PICKER_LABELS.now).click()
      await expect(this.getSelectedDay()).toBeVisible()
    })
  }

  public async selectTomorrow(): Promise<void> {
    await test.step("Select tomorrow", async () => {
      await this.getButton(DATE_PICKER_LABELS.tomorrow).click()
      await this.assertSelectionSettled()
    })
  }

  public async selectNextWeek(): Promise<void> {
    await test.step("Select next week", async () => {
      await this.getButton(DATE_PICKER_LABELS.nextWeek).click()
      await this.assertSelectionSettled()
    })
  }

  /**
   * Closes the popover.
   *
   * In datetime mode this is also what commits a day picked without a time: react-aria fills the
   * placeholder time in on close.
   */
  public async close(): Promise<void> {
    await test.step("Close the calendar", async () => {
      await this.page.keyboard.press("Escape")
      await expect(this.dialog).toBeHidden()
    })
  }

  private getButton(label: string): Locator {
    return this.dialog.getByRole("button", { name: label, exact: true })
  }

  private async pageMonth(label: string): Promise<void> {
    const grid = this.getGrid()
    const visibleMonth = (await grid.getAttribute("aria-label")) ?? ""
    await this.getButton(label).click()
    await expect(grid).not.toHaveAttribute("aria-label", visibleMonth)
  }

  private async assertSelectionSettled(): Promise<void> {
    if (this.closesOnDaySelect) {
      await expect(this.dialog).toBeHidden()
      return
    }
    await expect(this.getSelectedDay()).toBeVisible()
  }
}
