import type { Locator } from "@playwright/test"
import { expect, test } from "@playwright/test"

import {
  DATE_PICKER_LABELS,
  dayPeriodLabels,
  dayPeriodPattern,
  DEFAULT_TEMPORAL_LOCALE,
  displayedTimePattern,
} from "./dateTimeNames"

export interface HybridTimeSelectorOptions {
  locale?: string | undefined
  /** Mirrors the field's `hourCycle` prop, which decides whether the panel shows AM/PM. */
  hourCycle?: 12 | 24 | undefined
}

/**
 * Driver for the time column the calendar shows in datetime mode.
 *
 * Get one from `DatePickerCalendar.getTimeSelector()` rather than constructing it directly; the
 * panel lives inside the calendar dialog, so this needs no page of its own. Note that the AM/PM
 * buttons carry the fixed element ids `period-am` and `period-pm`, so two datetime pickers open at
 * once would produce duplicate ids; every locator here is scoped to the panel instead.
 */
export class HybridTimeSelector {
  private readonly root: Locator
  private readonly locale: string
  private readonly hourCycle: 12 | 24 | undefined

  public constructor(root: Locator, options: HybridTimeSelectorOptions = {}) {
    this.root = root
    this.locale = options.locale ?? DEFAULT_TEMPORAL_LOCALE
    this.hourCycle = options.hourCycle
  }

  /** The `role="group"` panel holding the time controls. */
  public getPanel(): Locator {
    return this.root
  }

  /** The free-text time field, which reads the committed time back in the locale's format. */
  public getTimeInput(): Locator {
    return this.root.getByRole("textbox", { name: DATE_PICKER_LABELS.time, exact: true })
  }

  /**
   * Types a time and commits it.
   *
   * The input commits on blur and silently restores the previous value when it cannot parse what
   * was typed, so the assertion here is what turns a rejected time into a failure.
   *
   * @param isoTime an `HH:mm` or `HH:mm:ss` time; the panel accepts ISO input in any locale
   */
  public async setTime(isoTime: string): Promise<void> {
    const expected = this.readBackPattern(isoTime)

    await test.step(`Set the time to "${isoTime}"`, async () => {
      const input = this.getTimeInput()
      await input.click()
      await input.fill(isoTime)
      await input.blur()
      await expect(input).toHaveValue(expected)
    })
  }

  public async increaseHour(): Promise<void> {
    await test.step("Increase the hour", async () => {
      await this.pressStepper(DATE_PICKER_LABELS.increaseHour)
    })
  }

  public async decreaseHour(): Promise<void> {
    await test.step("Decrease the hour", async () => {
      await this.pressStepper(DATE_PICKER_LABELS.decreaseHour)
    })
  }

  public async increaseMinute(): Promise<void> {
    await test.step("Increase the minute", async () => {
      await this.pressStepper(DATE_PICKER_LABELS.increaseMinute)
    })
  }

  public async decreaseMinute(): Promise<void> {
    await test.step("Decrease the minute", async () => {
      await this.pressStepper(DATE_PICKER_LABELS.decreaseMinute)
    })
  }

  /** Adds half an hour through the shortcut chip. */
  public async addThirtyMinutes(): Promise<void> {
    await test.step("Add 30 minutes", async () => {
      await this.pressStepper(DATE_PICKER_LABELS.plus30Minutes)
    })
  }

  /** Jumps to 23:59 through the shortcut chip. */
  public async selectEndOfDay(): Promise<void> {
    await test.step("Select the end of the day", async () => {
      await this.getButton(DATE_PICKER_LABELS.endOfDay).click()
      await expect(this.getTimeInput()).toHaveValue(this.readBackPattern("23:59"))
    })
  }

  public async selectAm(): Promise<void> {
    await test.step("Select AM", async () => {
      await this.selectDayPeriod("am")
    })
  }

  public async selectPm(): Promise<void> {
    await test.step("Select PM", async () => {
      await this.selectDayPeriod("pm")
    })
  }

  private getButton(label: string): Locator {
    return this.root.getByRole("button", { name: label, exact: true })
  }

  private async pressStepper(label: string): Promise<void> {
    const input = this.getTimeInput()
    const before = await input.inputValue()
    await this.getButton(label).click()
    await expect(input).not.toHaveValue(before)
  }

  private async selectDayPeriod(period: "am" | "pm"): Promise<void> {
    const toggle = this.root.getByRole("group", {
      name: DATE_PICKER_LABELS.dayPeriod,
      exact: true,
    })
    await toggle
      .getByRole("button", { name: dayPeriodLabels(this.locale)[period], exact: true })
      .click()
    await expect(this.getTimeInput()).toHaveValue(dayPeriodPattern(period, this.locale))
  }

  private readBackPattern(isoTime: string): RegExp {
    const match = /^(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(isoTime)
    if (!match) {
      throw new Error(`Expected an HH:mm or HH:mm:ss time, got "${isoTime}".`)
    }
    return displayedTimePattern(
      Number(match[1]),
      Number(match[2]),
      Number(match[3] ?? "0"),
      this.locale,
      this.hourCycle,
    )
  }
}
