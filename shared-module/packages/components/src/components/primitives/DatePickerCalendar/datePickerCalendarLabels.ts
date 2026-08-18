"use client"

import { useTranslation } from "react-i18next"

/** Translated labels for the calendar popover, its quick actions, and the time/year/month choosers. */
export function useDatePickerCalendarLabels() {
  const { t } = useTranslation("shared-module")

  return {
    previousMonth: t("datePicker.previousMonth"),
    nextMonth: t("datePicker.nextMonth"),
    previousYears: t("datePicker.previousYears"),
    nextYears: t("datePicker.nextYears"),
    previousYear: t("datePicker.previousYear"),
    nextYear: t("datePicker.nextYear"),
    clear: t("datePicker.clear"),
    today: t("datePicker.today"),
    now: t("datePicker.now"),
    tomorrow: t("datePicker.tomorrow"),
    nextWeek: t("datePicker.nextWeek"),
    time: t("datePicker.time"),
    plus30Minutes: t("datePicker.plus30Minutes"),
    endOfDay: t("datePicker.endOfDay"),
    chooseMonth: t("datePicker.chooseMonth"),
    chooseYear: t("datePicker.chooseYear"),
    chooseMonthAndYear: (value: string) => t("datePicker.chooseMonthAndYear", { value }),
    decreaseHour: t("datePicker.decreaseHour"),
    increaseHour: t("datePicker.increaseHour"),
    decreaseMinute: t("datePicker.decreaseMinute"),
    increaseMinute: t("datePicker.increaseMinute"),
    dayPeriodGroup: t("datePicker.dayPeriod"),
  }
}
